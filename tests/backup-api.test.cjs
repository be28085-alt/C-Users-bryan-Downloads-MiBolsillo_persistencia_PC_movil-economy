'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { createServer } = require('../scripts/serve-sqlite.cjs');
const hash = raw => createHash('sha256').update(raw).digest('hex');

test('API real de respaldo aísla cuentas, valida restauraciones y conserva copia anterior', { timeout: 15000 }, async t => {
  const tmpRoot = path.resolve(__dirname, '..', 'tmp'); fs.mkdirSync(tmpRoot, { recursive: true });
  const folder = fs.mkdtempSync(path.join(tmpRoot, 'backup-api-'));
  const server = createServer({ dbPath: path.join(folder, 'qa.sqlite') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (!folder.startsWith(tmpRoot + path.sep)) throw Error('Carpeta de prueba fuera de tmp');
    fs.rmSync(folder, { recursive: true, force: true });
  });
  async function register(email) {
    const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: 'Prueba respaldos', email, password: 'Respaldo-2026-seguro' }) });
    assert.equal(response.status, 201);
    return { body: await response.json(), cookie: response.headers.get('set-cookie').split(';')[0] };
  }
  async function call(account, route, method = 'GET', body) {
    const response = await fetch(base + route, { method, headers: { Cookie: account.cookie, 'Content-Type': 'application/json', 'X-MiBolsillo-Token': account.body.csrfToken }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await fetch(base + '/api/backups')).status, 401);
  const owner = await register('owner@example.test'), other = await register('other@example.test');
  const original = await call(owner, '/api/storage');
  const created = await call(owner, '/api/backups', 'POST'); assert.equal(created.status, 201);
  const id = created.body.backup.id;
  const exported = (await call(owner, '/api/backups/' + id)).body;
  assert.equal(exported.checksum, hash(exported.raw));
  assert.equal((await call(other, '/api/backups/' + id)).status, 404);
  assert.equal((await call(other, '/api/backups/restore', 'POST', { backup: exported, confirm: true, expectedRevision: (await call(other, '/api/storage')).body.revision })).status, 403);
  const next = JSON.parse(original.body.raw); next.data.saldoInicial = 987.65; next.revision = randomUUID();
  assert.equal((await call(owner, '/api/storage', 'POST', { expectedRaw: original.body.raw, raw: JSON.stringify(next) })).status, 200);
  const current = (await call(owner, '/api/storage')).body;
  const invalid = JSON.parse(exported.raw);
  invalid.data.movimientos = [{ id: 'invalid', tipo: 'GASTO', concepto: 'Prueba', categoria: 'Otros', cuenta: 'Principal', valor: 1, fecha: '2026-02-30' }];
  const invalidRaw = JSON.stringify(invalid);
  assert.equal((await call(owner, '/api/backups/restore', 'POST', { backup: { ...exported, raw: invalidRaw, checksum: hash(invalidRaw) }, confirm: true, expectedRevision: current.revision })).status, 400);
  assert.equal((await call(owner, '/api/storage')).body.raw, current.raw);
  const restored = await call(owner, '/api/backups/restore', 'POST', { id, confirm: true, expectedRevision: current.revision });
  assert.equal(restored.status, 200);
  const saved = JSON.parse((await call(owner, '/api/storage')).body.raw);
  assert.equal(saved.data.saldoInicial, 0); assert.equal(saved.data.usuario.email, owner.body.user.email);
  const safety = (await call(owner, '/api/backups/' + restored.body.safetyBackup.id)).body;
  assert.equal(JSON.parse(safety.raw).data.saldoInicial, 987.65);
  assert.equal((await call(owner, '/api/backups/restore', 'POST', { id, confirm: true, expectedRevision: current.revision })).status, 409);
});
