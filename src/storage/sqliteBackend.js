/* SQLite transport: cached reads and asynchronous, incremental atomic writes. */
(function () {
  'use strict';
  if (!window.MiBolsilloSQLiteConfig && !window.MiBolsilloSQLiteRequired) return;

  const config = window.MiBolsilloSQLiteConfig || {};
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
    catch (_) { throw new Error('No se confirmó el guardado. Comprueba el servidor y reintenta con el formulario abierto.'); }
    let result; try { result = await response.json(); } catch (_) { result = {}; }
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('mibolsillo:session-expired'));
      throw Object.assign(new Error('La sesión cambió o caducó. Conserva el formulario antes de iniciar sesión.'), { code: 'session' });
    }
    if (!response.ok) throw Object.assign(new Error(result.error || (response.status === 413 ? 'La operación supera el tamaño permitido. Conserva una copia antes de reintentar.' : 'No se pudo guardar en SQLite.')), { code: response.status === 409 ? 'conflict' : 'write', status: response.status });
    return result;
  }
  window.MiBolsilloSQLiteBackend = {
    getItem() {
      if (!initialized) throw new Error('Falta la lectura inicial de SQLite. Recarga desde el servidor actualizado.');
      return raw;
    },
    async refresh() {
      const result = await request('GET', null, revision ? '?revision=' + encodeURIComponent(revision) : '');
      if (!result.unchanged) { raw = result.raw; revision = result.revision; initialized = true; }
      return raw;
    },
    async setItem(key, nextRaw, expectedRaw) {
      if (!initialized || raw !== expectedRaw) throw Object.assign(new Error('La copia local cambió antes del guardado.'), { code: 'conflict' });
      const envelope = JSON.parse(nextRaw);
      const body = { expectedRevision: revision, operationId: envelope.revision, operations: changes(raw ? JSON.parse(raw) : null, envelope) };
      let result;
      try { result = await request('PATCH', body); }
      catch (error) { if (error.code || error.status) throw error; result = await request('PATCH', body); }
      raw = nextRaw; revision = result.revision; initialized = true;
    },
    getInfo() { return { mode: 'sqlite', database: config.database || 'mibolsillo.sqlite', crossDevice: false }; }
  };
})();
