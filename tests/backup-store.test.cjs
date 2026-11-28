'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { openAccounts } = require('../scripts/auth-store.cjs');
const { createBackupService } = require('../scripts/backup-store.cjs');
const hash = (raw) => createHash('sha256').update(raw).digest('hex');
const revisionOf = (raw) => (raw ? JSON.parse(raw).revision || hash(raw) : null);

async function fixture(t, options = {}) {
  const tmpRoot = path.resolve(__dirname, '..', 'tmp');
  fs.mkdirSync(tmpRoot, { recursive: true });
  const folder = fs.mkdtempSync(path.join(tmpRoot, 'backup-test-')),
    filename = path.join(folder, 'test.sqlite');
  const db = new DatabaseSync(filename);
  db.exec(
    'PRAGMA journal_mode=WAL;CREATE TABLE app_state(id INTEGER PRIMARY KEY,raw TEXT);PRAGMA user_version=1',
  );
  const accounts = openAccounts(db, filename);
  const session = await accounts.register({
    nombre: 'Persona de prueba',
    email: 'backup@example.test',
    password: 'Respaldo-prueba-2026',
  });
  const validateState = (data) => {
    if (
      !Array.isArray(data.movimientos) ||
      data.movimientos.some((row) => !Number.isFinite(row.valor) || row.valor < 0)
    ) {
      throw Object.assign(new Error('Importe inválido.'), { status: 400 });
    }
  };
  const service = createBackupService({
    db,
    dbPath: filename,
    accounts,
    validateState,
    revisionOf,
    ...options,
  });
  t.after(() => {
    service.close();
    db.close();
    if (!folder.startsWith(tmpRoot + path.sep)) throw Error('Directorio de prueba fuera de tmp');
    fs.rmSync(folder, { recursive: true, force: true });
  });
  async function call(url, method = 'GET', body, active = session, token = active.csrfToken) {
    const result = { headers: {} };
    const res = {
      setHeader(key, value) {
        result.headers[key] = value;
      },
    };
    const handled = await service.handle(
      { url, method, headers: { 'x-mibolsillo-token': token, 'content-type': 'application/json' } },
      res,
      {
        session: active,
        readJSON: async () => body,
        send(res, status, payload) {
          result.status = status;
          result.body = payload;
        },
      },
    );
    assert.equal(handled, true);
    return result;
  }
  function change(value) {
    const store = accounts.scoped(session.user.id),
      current = store.get(),
      next = JSON.parse(current);
    next.data.saldoInicial = value;
    next.revision = 'revision-' + value;
    assert.equal(store.compareAndSet(current, JSON.stringify(next)).ok, true);
  }
  return { db, filename, accounts, session, service, call, change };
}

test('instantáneas SQLite incorporan WAL, son consistentes y conservan retención', async (t) => {
  const f = await fixture(t, { retention: 2, accountRetention: 3 });
  f.change(100);
  f.service.createScheduledBackup(true);
  const directory = path.join(f.service.directory, 'database');
  const first = fs.readdirSync(directory).find((name) => name.endsWith('.sqlite'));
  f.change(200);
  const snapshot = new DatabaseSync(path.join(directory, first), { readOnly: true });
  try {
    assert.equal(snapshot.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    assert.equal(
      JSON.parse(
        snapshot.prepare('SELECT raw FROM user_states WHERE user_id=?').get(f.session.user.id).raw,
      ).data.saldoInicial,
      100,
    );
  } finally {
    snapshot.close();
  }
  f.service.createScheduledBackup(true);
  f.service.createScheduledBackup(true);
  assert.equal(fs.readdirSync(directory).filter((name) => name.endsWith('.sqlite')).length, 2);
  assert.ok(f.service.list(f.session.user.id).every((row) => row.reason === 'periodic'));
});

test('crear, descargar y restaurar una cuenta crea copia previa y confirma el reemplazo', async (t) => {
  const f = await fixture(t);
  f.change(100);
  const created = await f.call('/api/backups', 'POST');
  assert.equal(created.status, 201);
  const id = created.body.backup.id;
  const downloaded = await f.call('/api/backups/' + id);
  assert.equal(downloaded.status, 200);
  assert.match(downloaded.headers['Content-Disposition'], /attachment/);
  assert.equal(downloaded.body.checksum, hash(downloaded.body.raw));
  f.change(200);
  const current = f.accounts.scoped(f.session.user.id).get();
  const response = await f.call('/api/backups/restore', 'POST', {
    id,
    confirm: true,
    expectedRevision: revisionOf(current),
  });
  assert.equal(response.status, 200);
  const restored = JSON.parse(f.accounts.scoped(f.session.user.id).get());
  assert.equal(restored.data.saldoInicial, 100);
  assert.equal(restored.data.usuario.email, f.session.user.email);
  assert.equal(restored.revision, response.body.revision);
  const safety = (await f.call('/api/backups/' + response.body.safetyBackup.id)).body;
  assert.equal(JSON.parse(safety.raw).data.saldoInicial, 200);
  assert.equal(safety.reason, 'before-restore');
  const retried = await f.call('/api/backups/restore', 'POST', {
    id,
    confirm: true,
    expectedRevision: revisionOf(current),
  });
  assert.equal(retried.status, 409);
});

test('los respaldos rechazan otras cuentas, corrupción, importes inválidos y confirmaciones obsoletas', async (t) => {
  const f = await fixture(t);
  const id = (await f.call('/api/backups', 'POST')).body.backup.id;
  const backup = (await f.call('/api/backups/' + id)).body;
  const other = await f.accounts.register({
    nombre: 'Otra persona',
    email: 'other@example.test',
    password: 'Otra-cuenta-2026',
  });
  assert.equal((await f.call('/api/backups/' + id, 'GET', null, other)).status, 404);
  assert.equal(
    (
      await f.call(
        '/api/backups/restore',
        'POST',
        {
          backup,
          confirm: true,
          expectedRevision: revisionOf(f.accounts.scoped(other.user.id).get()),
        },
        other,
      )
    ).status,
    403,
  );
  assert.equal((await f.call('/api/backups', 'POST', null, f.session, 'incorrecto')).status, 403);
  const current = f.accounts.scoped(f.session.user.id).get();
  assert.equal(
    (
      await f.call('/api/backups/restore', 'POST', {
        id,
        confirm: false,
        expectedRevision: revisionOf(current),
      })
    ).status,
    400,
  );
  assert.equal(
    (await f.call('/api/backups/restore', 'POST', { id, confirm: true, expectedRevision: 'old' }))
      .status,
    409,
  );
  assert.equal(
    (
      await f.call('/api/backups/restore', 'POST', {
        backup: { ...backup, raw: '{}' },
        confirm: true,
        expectedRevision: revisionOf(current),
      })
    ).status,
    400,
  );
  const invalid = JSON.parse(backup.raw);
  invalid.data.movimientos = [{ id: 'bad', valor: -1 }];
  const raw = JSON.stringify(invalid);
  assert.equal(
    (
      await f.call('/api/backups/restore', 'POST', {
        backup: { ...backup, raw, checksum: hash(raw) },
        confirm: true,
        expectedRevision: revisionOf(current),
      })
    ).status,
    400,
  );
  assert.equal(f.accounts.scoped(f.session.user.id).get(), current);
});

test('el intervalo programa copias locales y se detiene al cerrar el servicio', async (t) => {
  const f = await fixture(t, { intervalMs: 100, retention: 2 });
  await new Promise((resolve) => setTimeout(resolve, 260));
  assert.ok(f.service.list(f.session.user.id).length >= 2);
  f.service.close();
  const count = f.service.list(f.session.user.id).length;
  await new Promise((resolve) => setTimeout(resolve, 130));
  assert.equal(f.service.list(f.session.user.id).length, count);
});
