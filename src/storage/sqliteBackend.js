/**
 * Adaptador SQLite del navegador: lecturas en caché y escrituras PATCH atómicas.
 * La caché solo avanza tras confirmar la revisión. Una respuesta perdida conserva
 * el mismo cuerpo de la intención para que el servidor no aplique dos veces el pago.
 * Este módulo no abre SQLite ni cambia a Web Storage al fallar el transporte.
 */
(function () {
  'use strict';
  if (!window.MiBolsilloSQLiteConfig && !window.MiBolsilloSQLiteRequired) return;

  const config = window.MiBolsilloSQLiteConfig || {};
  const REQUEST_TIMEOUT_MS = 30_000;
  const failure = window.MiBolsilloErrors.create;
  let uncertainWrite = null;
  let confirmedOperation = null;
  let cachedRaw = config.initialRaw ?? null;
  let revision = config.initialRevision ?? (cachedRaw ? JSON.parse(cachedRaw).revision : null);
  let initialized = Object.prototype.hasOwnProperty.call(config, 'initialRaw');
  const hasEqualJSONValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  /**
   * Acumula operaciones compatibles con storage-patch, sin mutar los sobres.
   * El prefijo/sufijo común evita reenviar un arreglo completo al añadir un registro.
   * @param {*} before Valor confirmado antes de la intención.
   * @param {*} after Valor candidato después de la intención.
   * @param {Array<string|number>} path Ruta dentro del sobre, nunca una ruta de archivo.
   * @param {Array<object>} operations Acumulador de set/remove/splice.
   * @returns {Array<object>} Operaciones en el orden del contrato actual.
   */
  function collectChanges(before, after, path = [], operations = []) {
    if (hasEqualJSONValue(before, after)) return operations;
    if (Array.isArray(before) && Array.isArray(after)) {
      if (before.length === after.length) {
        after.forEach((value, index) =>
          collectChanges(before[index], value, [...path, index], operations),
        );
      } else {
        let start = 0,
          end = 0;
        while (
          start < Math.min(before.length, after.length) &&
          hasEqualJSONValue(before[start], after[start])
        ) {
          start++;
        }
        while (
          end < Math.min(before.length, after.length) - start &&
          hasEqualJSONValue(before[before.length - 1 - end], after[after.length - 1 - end])
        ) {
          end++;
        }
        operations.push({
          op: 'splice',
          path,
          index: start,
          deleteCount: before.length - start - end,
          items: after.slice(start, after.length - end),
        });
      }
    } else if (
      before &&
      after &&
      typeof before === 'object' &&
      typeof after === 'object' &&
      !Array.isArray(before) &&
      !Array.isArray(after)
    ) {
      for (const key of Object.keys(before)) {
        if (!Object.prototype.hasOwnProperty.call(after, key)) {
          operations.push({ op: 'remove', path: [...path, key] });
        }
      }
      for (const key of Object.keys(after)) {
        collectChanges(before[key], after[key], [...path, key], operations);
      }
    } else operations.push({ op: 'set', path, value: after });
    return operations;
  }
  /** Traduce únicamente los estados rechazados; un 401 se resuelve antes como sesión. */
  function responseFailureCode(status) {
    if (status === 403) return 'authorization';
    if (status === 409) return 'conflict';
    return [400, 413, 422].includes(status) ? 'validation' : 'persistence';
  }

  /**
   * @param {string} method Método del contrato GET/PATCH existente.
   * @param {object|null} body Intención serializada; no se registra en consola.
   * @param {string} query Selector de revisión generado por el adaptador.
   * @returns {Promise<object>} Respuesta JSON confirmada por el transporte.
   * @throws {Error} Error público clasificado, incluida ambigüedad de una escritura.
   */
  async function request(method, body, query = '') {
    if (!config.token) {
      throw new Error('No se pudo iniciar SQLite. Abre la aplicación desde su servidor local.');
    }
    const headers = { 'X-MiBolsillo-Token': config.token };
    if (config.user?.id) headers['X-MiBolsillo-Account'] = String(config.user.id);
    if (body) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetch('/api/storage' + query, {
        method,
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw failure(
        error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : 'connection',
        { ambiguous: method === 'PATCH' },
      );
    }
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('mibolsillo:session-expired'));
      throw failure('session', { status: 401 });
    }
    let result;
    try {
      result = await response.json();
    } catch {
      if (response.ok) throw failure('persistence', { ambiguous: method === 'PATCH' });
      result = {};
    }
    if (!response.ok) {
      throw failure(responseFailureCode(response.status), {
        status: response.status,
        message:
          response.status < 500 && response.status !== 401 && response.status !== 403
            ? result?.error
            : undefined,
      });
    }
    return result;
  }
  /**
   * @param {{body: object, nextRaw: string}} write Misma intención en todos sus reintentos.
   * @returns {Promise<void>}
   * @throws {Error} Si la revisión no confirma exactamente la operación enviada.
   * No basta un HTTP 200: solo esa revisión permite publicar la caché siguiente.
   */
  async function confirmPendingWrite(write) {
    const result = await request('PATCH', write.body);
    if (!result || result.revision !== write.body.operationId) {
      throw failure('persistence', { ambiguous: true });
    }
    cachedRaw = write.nextRaw;
    revision = result.revision;
    initialized = true;
    confirmedOperation = write.body.operationId;
    uncertainWrite = null;
  }
  window.MiBolsilloSQLiteBackend = {
    /** @returns {string|null} Último sobre confirmado; no realiza E/S síncrona. */
    getItem() {
      if (!initialized) {
        throw new Error(
          'Falta la lectura inicial de SQLite. Recarga desde el servidor actualizado.',
        );
      }
      return cachedRaw;
    },
    /**
     * @param {{recover?: boolean}} options Solo un reintento explícito permite recuperar PATCH.
     * @returns {Promise<string|null>} Sobre confirmado o caché sin cambios.
     * @throws {Error} Sesión, conflicto o transporte; no confirma otra intención.
     */
    async refresh({ recover = false } = {}) {
      if (uncertainWrite) {
        if (!recover) throw failure('pending', { ambiguous: true });
        // Solo un reintento explícito puede reenviar una escritura incierta.
        await confirmPendingWrite(uncertainWrite);
        return cachedRaw;
      }
      const result = await request(
        'GET',
        null,
        revision ? '?revision=' + encodeURIComponent(revision) : '',
      );
      if (!result.unchanged) {
        cachedRaw = result.raw;
        revision = result.revision;
        initialized = true;
      }
      return cachedRaw;
    },
    /**
     * @param {string} _storageKey Posición compatible con Storage; este adaptador usa un sobre.
     * @param {string} nextRaw Candidato completo, del que se calculan los cambios.
     * @param {string|null} expectedRaw Copia confirmada que fundamenta el CAS.
     * @returns {Promise<void>}
     * @throws {Error} Rechazo o confirmación incierta; la caché anterior se conserva.
     */
    async setItem(_storageKey, nextRaw, expectedRaw) {
      if (!initialized || cachedRaw !== expectedRaw) {
        throw Object.assign(new Error('La copia local cambió antes del guardado.'), {
          code: 'conflict',
        });
      }
      const envelope = JSON.parse(nextRaw);
      const body = {
        expectedRevision: revision,
        operationId: envelope.revision,
        operations: collectChanges(cachedRaw ? JSON.parse(cachedRaw) : null, envelope),
      };
      if (uncertainWrite) throw failure('pending', { ambiguous: true });
      const write = { body, nextRaw };
      try {
        await confirmPendingWrite(write);
      } catch (error) {
        if (!error.ambiguous) throw error;
        uncertainWrite = write;
        try {
          await confirmPendingWrite(write);
        } catch (retryError) {
          // Incluso un 401/409 posterior no prueba que el primer COMMIT fallara.
          throw Object.assign(retryError, { ambiguous: true });
        }
      }
    },
    getWriteStatus() {
      return { uncertainOperation: uncertainWrite?.body.operationId || null, confirmedOperation };
    },
    getInfo() {
      return {
        mode: 'sqlite',
        database: config.database || 'mibolsillo.sqlite',
        crossDevice: false,
      };
    },
  };
})();
