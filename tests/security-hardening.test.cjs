'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { randomUUID, createHash } = require('node:crypto');
const { createServer } = require('../scripts/serve-sqlite.cjs');
const { securityPolicy } = require('../scripts/security-policy.cjs');
const { createRateLimiter } = require('../scripts/rate-limiter.cjs');
const { createSecurityAudit } = require('../scripts/security-audit.cjs');

async function fixture(t, security = {}) {
  const folder = fs.mkdtempSync(path.resolve(__dirname, '../tmp/security-http-'));
  const dbPath = path.join(folder, 'synthetic.sqlite');
  const servers = new Set();
  async function start(extra = {}) {
    const server = createServer({ dbPath, security: { mode: 'test', ...security }, ...extra });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.add(server);
    return { server, base: 'http://127.0.0.1:' + server.address().port };
  }
  async function stop(server) {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); servers.delete(server);
  }
  t.after(async () => { for (const server of servers) await stop(server); fs.rmSync(folder, { recursive: true, force: true }); });
  return { folder, dbPath, start, stop, ...await start() };
}
function client(base) {
  return {
    cookie: '', token: '', user: null,
    async call(url, body, { method = body === undefined ? 'GET' : 'POST', headers = {} } = {}) {
      const response = await fetch(base + url, { method, headers: { Cookie: this.cookie, 'Content-Type': 'application/json',
        'X-MiBolsillo-Token': this.token, ...(this.user ? { 'X-MiBolsillo-Account': String(this.user.id) } : {}), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const text = await response.text(); let value; try { value = JSON.parse(text); } catch (error) { value = text; }
      if (response.headers.has('set-cookie')) this.cookie = response.headers.get('set-cookie').split(';')[0];
      if (value.user) this.user = value.user;
      if (value.csrfToken) this.token = value.csrfToken;
      return { status: response.status, value, headers: response.headers };
    },
    register(email, password = 'Contraseña-sintética-2026') { return this.call('/api/auth/register', { nombre: 'Persona ficticia', email, password }); },
    read() { return this.call('/api/storage'); },
    write(before, data) { return this.call('/api/storage', { expectedRaw: before, raw: JSON.stringify(data) }); }
  };
}
const movement = (id = 'movimiento-sintético') => ({ id, tipo: 'INGRESO', concepto: 'Movimiento ficticio', fecha: '2026-11-26', valor: 12.34 });

test('Argon2id conserva frases largas sin truncar, sales independientes y respuestas sin secretos', async t => {
  const f = await fixture(t), a = client(f.base), b = client(f.base);
  const password = 'Frase larga con espacios y ñ ' + 'x'.repeat(80);
  assert.equal((await a.register('salt-a@example.test', password)).status, 201);
  assert.equal((await b.register('salt-b@example.test', password)).status, 201);
  const rows = f.server.sqlite.store.db.prepare('SELECT password_algorithm,password_salt,password_hash FROM auth_users ORDER BY id').all();
  assert.ok(rows.every(row => row.password_algorithm === 'argon2id' && row.password_salt.length === 32 && row.password_hash.length === 32));
  assert.equal(Buffer.from(rows[0].password_salt).equals(Buffer.from(rows[1].password_salt)), false);
  assert.equal(Buffer.from(rows[0].password_hash).equals(Buffer.from(rows[1].password_hash)), false);
  const anonymous = client(f.base);
  assert.equal((await anonymous.call('/api/auth/login', { email: 'SALT-A@example.test', password })).status, 200);
  assert.equal((await anonymous.call('/api/auth/login', { email: 'salt-a@example.test', password: password.slice(0, -1) + 'z' })).status, 401);
  const login = await anonymous.call('/api/auth/login', { email: 'salt-a@example.test', password });
  assert.equal(JSON.stringify(login.value).includes(password), false);
  assert.equal(JSON.stringify(login.value).includes('password_hash'), false);
  assert.equal((await client(f.base).register('long@example.test', 'x'.repeat(129))).status, 400);
});

test('login inexistente y contraseña incorrecta responden igual, sin inyección SQL', async t => {
  const f = await fixture(t), a = client(f.base), anonymous = client(f.base);
  await a.register('person@example.test');
  const wrong = await anonymous.call('/api/auth/login', { email: 'person@example.test', password: 'incorrecta' });
  const missing = await anonymous.call('/api/auth/login', { email: "x'OR'1'='1@example.test", password: 'incorrecta' });
  assert.equal(wrong.status, 401); assert.equal(missing.status, 401); assert.equal(wrong.value.error, missing.value.error);
  assert.equal(f.server.sqlite.store.db.prepare('SELECT count(*) n FROM auth_users').get().n, 1);
  assert.equal((await anonymous.read()).status, 401);
});

test('los límites combinan identidad e IP, ignoran X-Forwarded-For local y caducan', async t => {
  const f = await fixture(t, { rates: { authIp: 4, authIdentity: 100 } }), a = client(f.base);
  for (let i = 0; i < 4; i++) assert.equal((await a.call('/api/auth/register', { nombre: '', email: i + '@example.test', password: 'synthetic' }, { headers: { 'X-Forwarded-For': '192.0.2.' + i } })).status, 400);
  const blocked = await a.register('blocked@example.test');
  assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  let clock = 0;
  const limiter = createRateLimiter({ authIp: 100, authGlobal: 100, authIdentity: 2, capacity: 10 }, () => clock);
  limiter.authentication('192.0.2.1', 'Alias@example.test'); limiter.authentication('192.0.2.2', 'alias@example.test');
  assert.throws(() => limiter.authentication('192.0.2.3', 'ALIAS@example.test'), error => error.status === 429);
  clock += 300001; assert.doesNotThrow(() => limiter.authentication('192.0.2.3', 'alias@example.test'));
});

test('la sesión rota al iniciar sesión y no acepta fijación, manipulación ni reutilizar logout', async t => {
  const f = await fixture(t), a = client(f.base);
  a.cookie = 'mibolsillo_session=' + 'a'.repeat(64);
  await a.register('session@example.test'); const original = a.cookie;
  assert.equal(original.endsWith('a'.repeat(64)), false);
  const login = await a.call('/api/auth/login', { email: 'session@example.test', password: 'Contraseña-sintética-2026' });
  assert.equal(login.status, 200); assert.notEqual(a.cookie, original);
  assert.equal((await a.call('/api/storage', undefined, { headers: { Cookie: original } })).status, 401);
  assert.equal((await a.call('/api/storage', undefined, { headers: { Cookie: a.cookie + 'bad' } })).status, 401);
  const current = a.cookie;
  assert.equal((await a.call('/api/auth/logout', {})).status, 200);
  assert.equal((await a.call('/api/storage', undefined, { headers: { Cookie: current } })).status, 401);
});

test('la inactividad persiste tras reiniciar sin alterar las finanzas', async t => {
  const f = await fixture(t, { idleMs: 1000 }), a = client(f.base);
  await a.register('idle@example.test'); const before = (await a.read()).value.raw;
  const cookie = a.cookie; let clock = Date.now(); t.mock.method(Date, 'now', () => clock);
  await f.stop(f.server); clock += 1001;
  const next = await f.start();
  assert.equal((await client(next.base).call('/api/storage', undefined, { headers: { Cookie: cookie } })).status, 401);
  assert.equal(next.server.sqlite.accounts.scoped(a.user.id).get(), before);
});

test('cambiar contraseña verifica la actual, revoca las sesiones y conserva el estado', async t => {
  const f = await fixture(t), a = client(f.base), second = client(f.base);
  await a.register('change@example.test');
  await second.call('/api/auth/login', { email: 'change@example.test', password: 'Contraseña-sintética-2026' });
  const oldA = a.cookie, oldB = second.cookie, before = (await a.read()).value.raw;
  assert.equal((await a.call('/api/auth/password', { currentPassword: 'wrong', newPassword: 'Nueva-frase-sintética-2026' })).status, 401);
  assert.equal((await a.call('/api/auth/password', { currentPassword: 'Contraseña-sintética-2026', newPassword: 'Nueva-frase-sintética-2026' })).status, 200);
  for (const cookie of [oldA, oldB]) assert.equal((await a.call('/api/storage', undefined, { headers: { Cookie: cookie } })).status, 401);
  assert.equal((await a.read()).value.raw, before);
  assert.equal((await client(f.base).call('/api/auth/login', { email: 'change@example.test', password: 'Contraseña-sintética-2026' })).status, 401);
  assert.equal((await client(f.base).call('/api/auth/login', { email: 'change@example.test', password: 'Nueva-frase-sintética-2026' })).status, 200);
});

test('A y B no pueden seleccionar propietario, alterar privilegios ni descargar la copia ajena', async t => {
  const f = await fixture(t), a = client(f.base), b = client(f.base);
  await a.register('owner-a@example.test'); await b.register('owner-b@example.test');
  let beforeA = (await a.read()).value.raw, candidate = JSON.parse(beforeA);
  candidate.data.movimientos.push(movement('privado-A'));
  candidate.data.deudas.push({ id: 'deuda-A', nombre: 'Deuda privada', montoInicial: 100, saldoPendiente: 100 });
  candidate.data.productos.push({ id: 'producto-A', nombre: 'Producto privado', negocioId: 'neg-1', stock: 3 });
  assert.equal((await a.write(beforeA, candidate)).status, 200); beforeA = (await a.read()).value.raw;
  const beforeB = (await b.read()).value.raw;
  for (const uri of ['/api/storage?user_id=' + a.user.id, '/api/storage?ownerId=' + a.user.id]) assert.equal((await b.call(uri)).status, 400);
  assert.equal((await b.call('/api/config', undefined, { headers: { 'X-MiBolsillo-Account': String(a.user.id) } })).status, 401);
  assert.equal((await b.call('/api/storage', { expectedRaw: beforeB, raw: beforeB, userId: a.user.id })).status, 403);
  const changes = [s => { s.usuario.id = a.user.id; }, s => { s.usuario.facturacionRol = 'FACTURADOR'; },
    s => { s.movimientos.push({ ...movement(), ownerId: a.user.id }); }, s => { s.productos.push({ id: 'p', nombre: 'P', negocioId: 'neg-1', stock: 1, user_id: a.user.id }); }];
  for (const mutate of changes) { candidate = JSON.parse(beforeB); mutate(candidate.data); assert.equal((await b.write(beforeB, candidate)).status, 403); }
  const backup = await a.call('/api/backups', {}); const id = backup.value.backup.id;
  assert.equal((await b.call('/api/backups/' + id)).status, 404);
  assert.equal((await b.call('/api/backups', undefined, { headers: { 'X-MiBolsillo-Account': String(a.user.id) } })).status, 401);
  assert.equal((await b.read()).value.raw, beforeB); assert.equal((await a.read()).value.raw, beforeA);
});

test('un rol de lectura configurado en servidor no puede eludirse mediante PATCH', async t => {
  const f = await fixture(t), a = client(f.base); await a.register('reader@example.test');
  const original = JSON.parse((await a.read()).value.raw); original.data.usuario.facturacionRol = 'LECTOR';
  // Configuración administrativa exclusivamente en la base ficticia de esta prueba.
  f.server.sqlite.store.db.prepare('UPDATE user_states SET raw=? WHERE user_id=?').run(JSON.stringify(original), a.user.id);
  const before = (await a.read()).value;
  const operations = [{ op: 'set', path: ['revision'], value: 'reader-write' }, { op: 'splice', path: ['data','productos'], index: 0, deleteCount: 0, items: [{ id: 'p', nombre: 'P', negocioId: 'neg-1', stock: 1 }] }];
  assert.equal((await a.call('/api/storage', { expectedRevision: before.revision, operationId: 'reader-write', operations }, { method: 'PATCH' })).status, 403);
  const allowed = JSON.parse(before.raw); allowed.data.saldoOculto = true;
  allowed.data.businessLedger = { version: 1, operations: [], audit: [], sequences: {} };
  // Orden real del inicializador de facturación; el orden de claves no otorga permisos.
  allowed.data.facturacion = { version: 1, documents: [], sequences: {}, operations: [], audit: [], refunds: [] };
  assert.equal((await a.write(before.raw, allowed)).status, 200);
  assert.equal(JSON.parse((await a.read()).value.raw).data.productos.length, 0);
});

for (const [name, mutate] of [
  ['stock nulo', s => s.productos.push({ id: 'p', nombre: 'P', negocioId: 'neg-1', stock: null })],
  ['estado booleano incorrecto', s => s.deudas.push({ id: 'd', nombre: 'D', montoInicial: 100, saldoPendiente: 100, archivada: 'false' })],
  ['moneda incorrecta', s => { s.usuario.moneda = '<script>'; }],
  ['referencia cruzada de módulos', s => { s.deudas.push({ id: 'd', nombre: 'D', montoInicial: 100, saldoPendiente: 100 }); s.productos.push({ id: 'p', nombre: 'P', negocioId: 'neg-1', stock: 1, deudaId: 'd' }); }],
  ['campo raíz desconocido', s => { s.adminMode = true; }],
  ['fecha inexistente', s => s.movimientos.push({ ...movement(), fecha: '2026-02-30' })],
  ['importe infinito', s => s.movimientos.push({ ...movement(), valor: 'Infinity' })],
  ['prototipo manipulado', s => { Object.defineProperty(s, '__proto__', { value: { polluted: true }, enumerable: true }); }]
]) test('la API rechaza ' + name + ' y conserva SQLite', async t => {
  const f = await fixture(t), a = client(f.base); await a.register('validation@example.test');
  const before = (await a.read()).value.raw, candidate = JSON.parse(before); mutate(candidate.data);
  assert.equal((await a.write(before, candidate)).status, 400); assert.equal((await a.read()).value.raw, before);
  assert.equal({}.polluted, undefined);
});

test('CSRF, Content-Type y tamaño se validan antes de modificar el estado', async t => {
  const f = await fixture(t, { maxStateBytes: 2048 }), a = client(f.base); await a.register('limits@example.test');
  const before = (await a.read()).value.raw, body = { expectedRaw: before, raw: before };
  assert.equal((await a.call('/api/storage', body, { headers: { 'X-MiBolsillo-Token': 'bad' } })).status, 403);
  assert.equal((await a.call('/api/storage', body, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await a.call('/api/backups/restore', {}, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  const candidate = JSON.parse(before); candidate.data.movimientos.push({ ...movement(), concepto: 'x'.repeat(5000) });
  assert.equal((await a.write(before, candidate)).status, 413);
  assert.equal((await client(f.base).register('big@example.test', 'x'.repeat(20000))).status, 413);
  assert.equal((await a.read()).value.raw, before);
});

test('un operationId está ligado al contenido y al usuario, incluso tras reiniciar', async t => {
  const f = await fixture(t), a = client(f.base), b = client(f.base); await a.register('op-a@example.test'); await b.register('op-b@example.test');
  const before = (await a.read()).value;
  const body = { expectedRevision: before.revision, operationId: 'unique-op', operations: [{ op: 'set', path: ['revision'], value: 'unique-op' }, { op: 'splice', path: ['data','movimientos'], index: 0, deleteCount: 0, items: [movement()] }] };
  assert.equal((await a.call('/api/storage', body, { method: 'PATCH' })).status, 200);
  const saved = (await a.read()).value.raw;
  assert.equal((await a.call('/api/storage', body, { method: 'PATCH' })).value.duplicate, true);
  const changed = structuredClone(body); changed.operations[1].items[0].valor = 99;
  assert.equal((await a.call('/api/storage', changed, { method: 'PATCH' })).status, 409);
  assert.equal((await b.call('/api/storage', body, { method: 'PATCH' })).status, 409);
  await f.stop(f.server); const next = await f.start(); const restored = client(next.base); restored.cookie = a.cookie; restored.user = a.user; restored.token = a.token;
  assert.equal((await restored.call('/api/storage', body, { method: 'PATCH' })).value.duplicate, true);
  assert.equal((await restored.read()).value.raw, saved);
});

test('los errores y registros usan correlación sin cuerpos, credenciales ni rutas', async t => {
  const f = await fixture(t), a = client(f.base); await a.register('never-log@example.test'); const before = (await a.read()).value.raw;
  const scoped = f.server.sqlite.accounts.scoped.bind(f.server.sqlite.accounts);
  t.mock.method(f.server.sqlite.accounts, 'scoped', id => ({ ...scoped(id), compareAndSet() { throw new Error('DO_NOT_LOG private/path secret'); } }));
  const response = await a.write(before, JSON.parse(before));
  assert.equal(response.status, 500); assert.match(response.value.requestId, /^[a-f0-9-]{36}$/);
  assert.equal(response.headers.get('x-request-id'), response.value.requestId);
  const logs = fs.readFileSync(path.join(f.folder, 'security-audit/events.jsonl'), 'utf8');
  for (const secret of ['DO_NOT_LOG','private/path','never-log@example.test','Contraseña-sintética-2026',a.token,before]) assert.equal(logs.includes(secret), false);
  assert.ok(logs.includes(response.value.requestId)); assert.equal(JSON.stringify(response.value).includes('private/path'), false);
  assert.equal((await a.read()).value.raw, before);
});

test('los registros rotan, están acotados y sus fallos no exponen errores', t => {
  const folder = fs.mkdtempSync(path.resolve(__dirname, '../tmp/audit-rotation-')); t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const audit = createSecurityAudit(folder, { maxBytes: 150, files: 3 });
  for (let i = 0; i < 20; i++) audit.write({ event: 'rejected', requestId: randomUUID(), status: 403, route: 'storage', method: 'POST', password: 'DO_NOT_LOG' });
  assert.ok(fs.readdirSync(folder).length <= 3);
  assert.equal(fs.readdirSync(folder).map(name => fs.readFileSync(path.join(folder, name), 'utf8')).join('').includes('DO_NOT_LOG'), false);
  const blocked = path.join(folder, 'not-a-directory'); fs.writeFileSync(blocked, 'synthetic');
  const messages = []; t.mock.method(console, 'error', (...args) => messages.push(args.join(' ')));
  const failing = createSecurityAudit(blocked);
  failing.write({ event: 'write' }); failing.write({ event: 'write' });
  assert.equal(failing.getHealth().healthy, false); assert.deepEqual(messages, ['security-audit-unavailable']);
});

test('un permiso empresarial limitado bloquea traslado, borrado y selección ajenos', async t => {
  const f = await fixture(t), a = client(f.base); await a.register('restricted@example.test');
  let before = (await a.read()).value.raw, value = JSON.parse(before);
  value.data.negocios.push({ id: 'neg-2', nombre: 'Otro negocio' });
  value.data.productos.push({ id: 'p2', nombre: 'Producto del segundo', negocioId: 'neg-2', stock: 1 });
  assert.equal((await a.write(before, value)).status, 200);
  value.data.usuario.facturacionNegocios = ['neg-1'];
  f.server.sqlite.store.db.prepare('UPDATE user_states SET raw=? WHERE user_id=?').run(JSON.stringify(value), a.user.id);
  before = (await a.read()).value.raw;
  for (const mutate of [s => { s.productos[0].negocioId = 'neg-1'; }, s => { s.productos = []; },
    s => { s.negocioActivoId = 'neg-2'; }, s => { s.negocios[1].nombre = 'Cambio prohibido'; }]) {
    const candidate = JSON.parse(before); mutate(candidate.data);
    assert.equal((await a.write(before, candidate)).status, 403);
    assert.equal((await a.read()).value.raw, before);
  }
});

test('los permisos también cubren eliminaciones dentro de agregados anidados', () => {
  const { authorizeState } = require('../scripts/state-authorization.cjs');
  const previous = { usuario: { facturacionNegocios: ['neg-1'] }, facturacion: { documents: [{ id: 'doc-2', businessId: 'neg-2' }] } };
  for (const candidate of [{ ...previous, facturacion: { documents: [] } }, { usuario: previous.usuario }]) {
    assert.throws(() => authorizeState(candidate, previous, 1), error => error.status === 403);
  }
});

test('una configuración histórica de permisos inválida deniega nuevas escrituras empresariales', async t => {
  const f = await fixture(t), a = client(f.base); await a.register('invalid-role@example.test');
  const original = JSON.parse((await a.read()).value.raw);
  for (const invalid of [{ facturacionRol: 'ADMIN_NO_DEFINIDO' }, { facturacionNegocios: 'neg-1' }]) {
    const stored = structuredClone(original); Object.assign(stored.data.usuario, invalid);
    f.server.sqlite.store.db.prepare('UPDATE user_states SET raw=? WHERE user_id=?').run(JSON.stringify(stored), a.user.id);
    const before = (await a.read()).value.raw, candidate = JSON.parse(before);
    candidate.data.productos.push({ id: 'p', nombre: 'Producto', negocioId: 'neg-1', stock: 1 });
    assert.equal((await a.write(before, candidate)).status, 403);
    assert.equal((await a.read()).value.raw, before);
  }
});

test('los límites de escritura y respaldos rechazan sin alterar finanzas', async t => {
  const f = await fixture(t, { rates: { writes: 3, backups: 1 } }), a = client(f.base); await a.register('quota@example.test');
  const before = (await a.read()).value.raw;
  assert.equal((await a.call('/api/backups', {})).status, 201);
  assert.equal((await a.call('/api/backups', {})).status, 429);
  assert.equal((await a.write(before, JSON.parse(before))).status, 200);
  const candidate = JSON.parse(before); candidate.data.movimientos.push(movement());
  assert.equal((await a.write(before, candidate)).status, 429);
  assert.equal((await a.read()).value.raw, before);
});

test('restaurar una copia antigua conserva identidad y permisos actuales', async t => {
  const f = await fixture(t), a = client(f.base); await a.register('restore@example.test');
  const backupId = (await a.call('/api/backups', {})).value.backup.id;
  let current = (await a.read()).value;
  const candidate = JSON.parse(current.raw); candidate.data.usuario.id = a.user.id;
  candidate.data.movimientos.push(movement());
  assert.equal((await a.write(current.raw, candidate)).status, 200);
  current = (await a.read()).value;
  assert.equal((await a.call('/api/backups/restore', { id: backupId, confirm: true, expectedRevision: current.revision })).status, 200);
  const restored = JSON.parse((await a.read()).value.raw);
  assert.equal(restored.data.usuario.id, a.user.id); assert.equal(restored.data.movimientos.length, 0);
  const backup = (await a.call('/api/backups/' + backupId)).value;
  const malicious = JSON.parse(backup.raw); malicious.data.usuario.facturacionRol = 'PROPIETARIO_LOCAL';
  backup.raw = JSON.stringify(malicious); backup.checksum = createHash('sha256').update(backup.raw).digest('hex');
  const unchanged = (await a.read()).value;
  assert.equal((await a.call('/api/backups/restore', { backup, confirm: true, expectedRevision: unchanged.revision })).status, 403);
  assert.equal((await a.read()).value.raw, unchanged.raw);
});

test('la expiración absoluta y el máximo de sesiones no eliminan información', async t => {
  const f = await fixture(t, { sessionSeconds: 60, idleMs: 120000, maxSessions: 2 }), a = client(f.base);
  await a.register('absolute@example.test'); const before = (await a.read()).value.raw, first = a.cookie;
  const logins = [];
  for (let i = 0; i < 2; i++) {
    const other = client(f.base);
    await other.call('/api/auth/login', { email: 'absolute@example.test', password: 'Contraseña-sintética-2026' }); logins.push(other);
  }
  assert.equal((await a.call('/api/storage', undefined, { headers: { Cookie: first } })).status, 401);
  assert.equal(f.server.sqlite.store.db.prepare('SELECT count(*) n FROM auth_sessions').get().n, 2);
  const clock = Date.now(); t.mock.method(Date, 'now', () => clock + 60001);
  for (const other of logins) assert.equal((await other.read()).status, 401);
  assert.equal(f.server.sqlite.accounts.scoped(a.user.id).get(), before);
});

test('las exportaciones CSV neutralizan fórmulas con espacios y controles iniciales', () => {
  const vm = require('node:vm'), context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/utils/security.js'), 'utf8'), context);
  const csv = context.window.escaparCSV;
  for (const value of ['=1+1',' +SUM(A1)','\t=1','\rhello','\n=1','\uFEFF@SUM(A1)','-1+2']) assert.ok(csv(value).startsWith('"\''));
  assert.equal(csv('Texto, "seguro"'), '"Texto, ""seguro"""');
  assert.equal(csv(12.34), '"12.34"');
});

test('producción exige TLS por proxy autorizado y emite cookies Secure sin confiar en encabezados locales', async t => {
  assert.throws(() => securityPolicy({ mode: 'production' }), /Producción/);
  assert.throws(() => securityPolicy({ mode: 'production', publicOrigin: 'https://finance.example.test' }, '0.0.0.0'), /Producción/);
  const f = await fixture(t), local = client(f.base); await local.register('local@example.test');
  const localSession = await local.call('/api/auth/session', undefined, { headers: { 'X-Forwarded-Proto': 'https' } });
  assert.equal(localSession.headers.has('strict-transport-security'), false);
  const prod = await f.start({ security: { mode: 'production', publicOrigin: 'https://finance.example.test' } });
  const request = (headers, body) => new Promise((resolve, reject) => {
    const req = http.request(prod.base + (body ? '/api/auth/register' : '/api/app-info'), { method: body ? 'POST' : 'GET', headers: { Host: 'finance.example.test', ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) } }, res => {
      let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    }); req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
  });
  assert.equal((await request({})).status, 403);
  const response = await request({ 'X-Forwarded-Proto': 'https' }, { nombre: 'TLS ficticio', email: 'tls@example.test', password: 'Contraseña-sintética-2026' });
  assert.equal(response.status, 201); assert.ok(response.headers['set-cookie'][0].includes('; Secure;'));
  assert.equal(response.headers['strict-transport-security'], 'max-age=31536000');
});
