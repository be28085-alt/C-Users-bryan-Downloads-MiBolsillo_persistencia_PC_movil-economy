/* SQLite transport: cached reads and asynchronous, incremental atomic writes. */
(function () {
  'use strict';
  if (!window.MiBolsilloSQLiteConfig && !window.MiBolsilloSQLiteRequired) return;

  const config = window.MiBolsilloSQLiteConfig || {};
  const failure = window.MiBolsilloErrors.create;
  let uncertain = null;
  let confirmedOperation = null;
  let raw = config.initialRaw ?? null;
  let revision = config.initialRevision ?? (raw ? JSON.parse(raw).revision : null);
  let initialized = Object.prototype.hasOwnProperty.call(config, 'initialRaw');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function changes(before, after, path = [], out = []) {
    if (same(before, after)) return out;
    if (Array.isArray(before) && Array.isArray(after)) {
      if (before.length === after.length) after.forEach((value, index) => changes(before[index], value, [...path, index], out));
      else {
        let start = 0, end = 0;
        while (start < Math.min(before.length, after.length) && same(before[start], after[start])) start++;
        while (end < Math.min(before.length, after.length) - start && same(before[before.length - 1 - end], after[after.length - 1 - end])) end++;
        out.push({ op: 'splice', path, index: start, deleteCount: before.length - start - end, items: after.slice(start, after.length - end) });
      }
    } else if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
      for (const key of Object.keys(before)) if (!Object.prototype.hasOwnProperty.call(after, key)) out.push({ op: 'remove', path: [...path, key] });
      for (const key of Object.keys(after)) changes(before[key], after[key], [...path, key], out);
    } else out.push({ op: 'set', path, value: after });
    return out;
  }
  async function request(method, body, query = '') {
    if (!config.token) throw new Error('No se pudo iniciar SQLite. Abre la aplicación desde su servidor local.');
    const headers = { 'X-MiBolsillo-Token': config.token };
    if (config.user?.id) headers['X-MiBolsillo-Account'] = String(config.user.id);
    if (body) headers['Content-Type'] = 'application/json';
    let response;
    try { response = await fetch('/api/storage' + query, { method, headers, credentials: 'same-origin', cache: 'no-store', ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) }); }
    catch (error) { throw failure(error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : 'connection', { ambiguous: method === 'PATCH' }); }
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('mibolsillo:session-expired'));
      throw failure('session', { status: 401 });
    }
    let result;
    try { result = await response.json(); }
    catch (error) {
      if (response.ok) throw failure('persistence', { ambiguous: method === 'PATCH' });
      result = {};
    }
    if (!response.ok) throw failure(response.status === 403 ? 'authorization' : response.status === 409 ? 'conflict'
      : [400,413,422].includes(response.status) ? 'validation' : 'persistence', { status: response.status,
      message: response.status < 500 && response.status !== 401 && response.status !== 403 ? result?.error : undefined });
    return result;
  }
  async function confirm(write) {
    const result = await request('PATCH', write.body);
    if (!result || result.revision !== write.body.operationId) throw failure('persistence', { ambiguous: true });
    raw = write.nextRaw; revision = result.revision; initialized = true;
    confirmedOperation = write.body.operationId; uncertain = null;
  }
  window.MiBolsilloSQLiteBackend = {
    getItem() {
      if (!initialized) throw new Error('Falta la lectura inicial de SQLite. Recarga desde el servidor actualizado.');
      return raw;
    },
    async refresh({ recover = false } = {}) {
      if (uncertain) {
        if (!recover) throw failure('pending', { ambiguous: true });
        // Solo un reintento explícito puede reenviar una escritura incierta.
        await confirm(uncertain);
        return raw;
      }
      const result = await request('GET', null, revision ? '?revision=' + encodeURIComponent(revision) : '');
      if (!result.unchanged) { raw = result.raw; revision = result.revision; initialized = true; }
      return raw;
    },
    async setItem(key, nextRaw, expectedRaw) {
      if (!initialized || raw !== expectedRaw) throw Object.assign(new Error('La copia local cambió antes del guardado.'), { code: 'conflict' });
      const envelope = JSON.parse(nextRaw);
      const body = { expectedRevision: revision, operationId: envelope.revision, operations: changes(raw ? JSON.parse(raw) : null, envelope) };
      if (uncertain) throw failure('pending', { ambiguous: true });
      const write = { body, nextRaw };
      try { await confirm(write); }
      catch (error) {
        if (!error.ambiguous) throw error;
        uncertain = write;
        try { await confirm(write); }
        catch (retryError) {
          // Incluso un 401/409 posterior no prueba que el primer COMMIT fallara.
          throw Object.assign(retryError, { ambiguous: true });
        }
      }
    },
    getWriteStatus() { return { uncertainOperation: uncertain?.body.operationId || null, confirmedOperation }; },
    getInfo() { return { mode: 'sqlite', database: config.database || 'mibolsillo.sqlite', crossDevice: false }; }
  };
})();
