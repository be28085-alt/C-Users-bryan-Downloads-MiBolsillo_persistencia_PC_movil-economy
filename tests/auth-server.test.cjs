'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createServer, openStore } = require('../scripts/serve-sqlite.cjs');

function fixture(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mibolsillo-auth-'));
  const dbPath = path.join(folder, 'accounts.sqlite');
  const live = new Set();
  async function stop(server) {
    if (!live.has(server)) return;
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
    live.delete(server);
  }
  t.after(async () => {
    for (const server of live) await stop(server);
    fs.rmSync(folder, { recursive: true, force: true });
  });
  return {
    folder,
    dbPath,
    stop,
    async start(options = {}) {
      const server = createServer({ dbPath, ...options });
      live.add(server);
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      return {
        server,
        base: `http://127.0.0.1:${server.address().port}`,
        stop: () => stop(server),
      };
    },
  };
}
function client(base, cookie = '') {
  return {
    cookie,
    token: '',
    user: null,
    async request(route, body, extra = {}) {
      const response = await fetch(base + route, {
        redirect: 'manual',
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          ...(this.cookie ? { Cookie: this.cookie } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const raw = await response.text();
      let result;
      try {
        result = JSON.parse(raw);
      } catch {
        result = raw;
      }
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) this.cookie = setCookie.split(';')[0];
      if (result?.csrfToken) {
        this.token = result.csrfToken;
        this.user = result.user;
      }
      return { status: response.status, value: result, headers: response.headers };
    },
    async register(nombre, email) {
      return this.request('/api/auth/register', { nombre, email, password: 'Cuenta-segura-2026' });
    },
    async read() {
      return this.request(
        '/api/storage',
        undefined,
        this.user ? { 'X-MiBolsillo-Account': String(this.user.id) } : {},
      );
    },
    async write(expectedRaw, data, extra = {}) {
      return this.request(
        '/api/storage',
        { expectedRaw, raw: JSON.stringify(data), ...extra },
        { 'X-MiBolsillo-Token': this.token },
      );
    },
  };
}

test('acceso real: Argon2id, duplicados, errores, cookie privada y protección antes del login', async (t) => {
  const fixtureDb = fixture(t);
  const { base } = await fixtureDb.start();
  const browser = client(base);
  for (const route of [
    '/api/storage',
    '/api/config',
    '/api/sqlite-bootstrap.js',
    '/api/auth/legacy-status',
    '/api/auth/session',
  ]) {
    const result = await browser.request(route);
    assert.equal(result.status, 401, route);
    assert.equal(JSON.stringify(result.value).includes('movimientos'), false);
  }
  for (const route of ['/desktop.html', '/mobile.html', '/%64esktop.html']) {
    const response = await browser.request(route);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/');
  }
  assert.equal((await browser.request('/')).status, 200);
  assert.equal(
    (await browser.request('/api/auth/register', { nombre: '', email: 'bad', password: 'short' }))
      .status,
    400,
  );
  const registered = await browser.register('Persona Uno', 'UNO@example.test');
  assert.equal(registered.status, 201);
  assert.equal(registered.value.user.email, 'uno@example.test');
  assert.match(registered.headers.get('set-cookie'), /HttpOnly/);
  assert.match(registered.headers.get('set-cookie'), /SameSite=Strict/);
  assert.equal((await browser.read()).status, 200);
  const initial = JSON.parse((await browser.read()).value.raw).data;
  assert.deepEqual(initial.movimientos, []);
  assert.deepEqual(initial.productos, []);
  assert.deepEqual(initial.cuentas, []);
  assert.equal(initial.presupuestoMensual, 0);
  assert.equal((await browser.register('Otra', 'uno@example.test')).status, 409);
  const wrong = client(base);
  assert.equal(
    (await wrong.request('/api/auth/login', { email: 'uno@example.test', password: 'incorrecta' }))
      .status,
    401,
  );
  assert.equal(
    (
      await wrong.request('/api/auth/login', {
        email: 'missing@example.test',
        password: 'incorrecta',
      })
    ).status,
    401,
  );
  assert.equal((await wrong.read()).status, 401);
  const config = await browser.request('/api/config');
  assert.equal(config.value.authenticated, true);
  assert.equal(config.value.allowLegacyImport, false);
  assert.equal(config.value.token, browser.token);
  const db = new DatabaseSync(fixtureDb.dbPath, { readOnly: true });
  try {
    const user = db.prepare('SELECT * FROM auth_users').get();
    assert.equal(user.password_algorithm, 'argon2id');
    assert.equal(user.password_salt.length, 32);
    assert.equal(user.password_hash.length, 32);
    assert.equal(
      Buffer.from(user.password_hash).includes(Buffer.from('Cuenta-segura-2026')),
      false,
    );
    const session = db.prepare('SELECT token_hash FROM auth_sessions').get();
    assert.equal(session.token_hash.length, 64);
    assert.notEqual(session.token_hash, browser.cookie.split('=')[1]);
  } finally {
    db.close();
  }
});

test('cada lectura y escritura usa el usuario de sesión, incluida edición/eliminación y referencias ajenas', async (t) => {
  const fixtureDb = fixture(t);
  const { base } = await fixtureDb.start();
  const a = client(base),
    b = client(base);
  await a.register('Usuario A', 'a@example.test');
  await b.register('Usuario B', 'b@example.test');
  const initialA = (await a.read()).value.raw;
  const stateA = JSON.parse(initialA);
  stateA.data.movimientos.push({
    id: 'movimiento-A',
    tipo: 'INGRESO',
    concepto: 'Privado A',
    valor: 125.35,
    fecha: '2026-11-17',
  });
  stateA.data.productos.push({
    id: 'producto-A',
    nombre: 'Producto A',
    stock: 7,
    negocioId: 'neg-1',
  });
  assert.equal((await a.write(initialA, stateA)).status, 200);
  const savedA = (await a.read()).value.raw;
  assert.equal((await b.read()).value.raw.includes('Privado A'), false);
  const stolenLookup = await b.request('/api/storage?user_id=' + a.user.id);
  assert.equal(stolenLookup.status, 400);
  assert.equal(stolenLookup.value.raw, undefined);
  assert.equal((await b.read()).value.raw.includes('Privado A'), false);
  assert.equal(
    (await b.request('/api/storage', undefined, { 'X-MiBolsillo-Account': String(a.user.id) }))
      .status,
    401,
  );
  assert.equal(
    (await b.write(savedA, { data: { movimientos: [] } }, { user_id: a.user.id })).status,
    403,
  );
  const ownRawB = (await b.read()).value.raw;
  const ownB = JSON.parse(ownRawB);
  ownB.data.movimientos = [];
  assert.equal((await b.write(ownRawB, ownB, { user_id: a.user.id })).status, 403);
  assert.equal((await b.read()).value.raw, ownRawB);
  assert.equal((await a.read()).value.raw, savedA);
  stateA.data.movimientos[0].valor = 140.25;
  assert.equal((await a.write(savedA, stateA)).status, 200);
  const editedA = (await a.read()).value.raw;
  assert.equal(JSON.parse(editedA).data.movimientos[0].valor, 140.25);
  assert.equal(
    (await a.request('/api/storage', { expectedRaw: editedA, raw: JSON.stringify({ data: {} }) }))
      .status,
    403,
  );
  assert.equal((await a.write(editedA, stateA, {})).status, 200);
  const beforeDelete = (await a.read()).value.raw;
  stateA.data.movimientos = [];
  assert.equal((await a.write(beforeDelete, stateA)).status, 200);
  assert.deepEqual(JSON.parse((await a.read()).value.raw).data.movimientos, []);
  assert.equal((await b.read()).value.raw.includes('producto-A'), false);
  assert.equal(
    (await a.request('/api/storage', undefined, { Origin: 'https://unrelated.example' })).status,
    403,
  );
  assert.equal(
    (await a.request('/api/auth/logout', {}, { 'X-MiBolsillo-Token': 'bad' })).status,
    403,
  );
});

test('sesión y cambios sobreviven al reinicio completo; cerrar sesión revoca el token sin borrar finanzas', async (t) => {
  const fixtureDb = fixture(t);
  let running = await fixtureDb.start();
  const browser = client(running.base);
  await browser.register('Persistente', 'persistente@example.test');
  const raw = (await browser.read()).value.raw,
    state = JSON.parse(raw);
  state.data.movimientos.push({
    id: 'reinicio',
    tipo: 'GASTO',
    concepto: 'Gasto de prueba',
    fecha: '2026-11-17',
    valor: 35.25,
  });
  assert.equal((await browser.write(raw, state)).status, 200);
  const cookie = browser.cookie;
  await running.stop();
  running = await fixtureDb.start();
  const restored = client(running.base, cookie);
  const session = await restored.request('/api/auth/session');
  assert.equal(session.status, 200);
  assert.equal(JSON.parse((await restored.read()).value.raw).data.movimientos[0].id, 'reinicio');
  assert.equal(
    (await restored.request('/api/auth/logout', {}, { 'X-MiBolsillo-Token': restored.token }))
      .status,
    200,
  );
  const expired = client(running.base, cookie);
  assert.equal((await expired.read()).status, 401);
  assert.equal((await expired.request('/api/auth/session')).status, 401);
  assert.equal(
    (
      await restored.request('/api/auth/login', {
        email: 'persistente@example.test',
        password: 'Cuenta-segura-2026',
      })
    ).status,
    200,
  );
  assert.equal(JSON.parse((await restored.read()).value.raw).data.movimientos[0].valor, 35.25);
});

test('perfil: identidad, correo de acceso y capital cambian juntos; duplicados y errores revierten todo', async (t) => {
  const fixtureDb = fixture(t);
  const { base } = await fixtureDb.start();
  const owner = client(base),
    other = client(base);
  await owner.register('Titular', 'titular@example.test');
  await other.register('Otro', 'ocupado@example.test');
  const raw = (await owner.read()).value.raw;
  const state = JSON.parse(raw);
  state.data.usuario = {
    ...state.data.usuario,
    nombre: 'Nuevo nombre',
    email: 'ocupado@example.test',
  };
  state.data.saldoInicial = 900;
  assert.equal((await owner.write(raw, state)).status, 400);
  assert.equal((await owner.read()).value.raw, raw);
  assert.equal((await owner.request('/api/auth/session')).value.user.email, 'titular@example.test');

  state.data.usuario.email = 'nuevo@example.test';
  const db = new DatabaseSync(fixtureDb.dbPath);
  try {
    db.exec(
      "CREATE TRIGGER reject_profile_write BEFORE UPDATE ON user_states BEGIN SELECT RAISE(ABORT,'fallo de disco simulado'); END;",
    );
    assert.equal((await owner.write(raw, state)).status, 500);
    assert.equal((await owner.read()).value.raw, raw);
    assert.equal(
      (await owner.request('/api/auth/session')).value.user.email,
      'titular@example.test',
    );
    db.exec('DROP TRIGGER reject_profile_write');
  } finally {
    db.close();
  }
  assert.equal((await owner.write(raw, state)).status, 200);
  const identity = (await owner.request('/api/auth/session')).value.user;
  assert.equal(identity.nombre, 'Nuevo nombre');
  assert.equal(identity.email, 'nuevo@example.test');
  const login = client(base);
  assert.equal(
    (
      await login.request('/api/auth/login', {
        email: 'titular@example.test',
        password: 'Cuenta-segura-2026',
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await login.request('/api/auth/login', {
        email: 'nuevo@example.test',
        password: 'Cuenta-segura-2026',
      })
    ).status,
    200,
  );
  assert.equal(JSON.parse((await login.read()).value.raw).data.saldoInicial, 900);
});

test('migración aditiva conserva datos anteriores sin propietario y prepara respaldo consistente', async (t) => {
  const fixtureDb = fixture(t);
  const legacy = openStore(fixtureDb.dbPath);
  const old = JSON.stringify({
    version: 'FINANZAS_V2',
    data: {
      usuario: { nombre: 'Dueño anterior', email: 'old@example.test' },
      movimientos: [{ id: 'legado-real', valor: 700 }],
      productos: [{ id: 'legado-stock', stock: 4 }],
    },
  });
  assert.equal(legacy.compareAndSet(null, old).ok, true);
  legacy.close();
  const { base, server } = await fixtureDb.start();
  assert.equal(server.sqlite.store.get(), old);
  const backups = fs
    .readdirSync(fixtureDb.folder)
    .filter((name) => name.startsWith('respaldo-antes-cuentas-'));
  assert.equal(backups.length, 1);
  const copied = new DatabaseSync(path.join(fixtureDb.folder, backups[0]), { readOnly: true });
  try {
    assert.equal(copied.prepare('SELECT raw FROM app_state WHERE id=1').get().raw, old);
  } finally {
    copied.close();
  }
  const browser = client(base);
  await browser.register('Nueva cuenta', 'old@example.test');
  assert.equal((await browser.read()).value.raw.includes('legado-real'), false);
  assert.equal((await browser.request('/api/auth/legacy-status')).value.available, true);
  assert.equal(server.sqlite.store.get(), old);
  await fixtureDb.stop(server);
  const second = await fixtureDb.start();
  assert.equal(second.server.sqlite.store.get(), old);
  assert.equal(
    fs.readdirSync(fixtureDb.folder).filter((name) => name.startsWith('respaldo-antes-cuentas-'))
      .length,
    1,
  );
});

test(
  'el límite de intentos libera los correos vencidos y vuelve a permitir cuentas nuevas',
  { timeout: 20000 },
  async (t) => {
    const fixtureDb = fixture(t);
    // Este caso agota el límite global; el límite por IP se prueba por separado.
    const { base } = await fixtureDb.start({
      security: { rates: { authIp: 2000, publicApi: 2000 } },
    });
    const browser = client(base);
    let clock = Date.now();
    t.mock.method(Date, 'now', () => clock);
    // Invalid names are rejected before Argon2, so this exercises the bounded
    // HTTP limiter without performing a thousand expensive password hashes.
    for (let index = 0; index < 1000; index++) {
      const result = await browser.request('/api/auth/register', {
        nombre: '',
        email: `fallo-${index}@example.test`,
        password: 'short',
      });
      assert.equal(result.status, 400);
    }
    assert.equal((await browser.register('Después del límite', 'nueva@example.test')).status, 429);
    clock += 5 * 60 * 1000 + 1;
    assert.equal((await browser.register('Después del límite', 'nueva@example.test')).status, 201);
    assert.equal((await browser.read()).status, 200);
  },
);
