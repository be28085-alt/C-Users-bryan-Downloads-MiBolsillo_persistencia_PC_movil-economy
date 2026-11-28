const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openStore } = require('../scripts/serve-sqlite.cjs');
const { openAccounts } = require('../scripts/auth-store.cjs');
const { migrateAccountData } = require('../scripts/migrate-account-data.cjs');
test('migración local exige propietario, conserva originales y respaldo, no duplica ni mezcla cuentas', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mibolsillo-owner-'));
  const dbPath = path.join(folder, 'state.sqlite');
  const store = openStore(dbPath);
  try {
    const raw = JSON.stringify({
      version: 'FINANZAS_V2',
      data: {
        usuario: { nombre: 'Titular', email: 'owner@example.test' },
        movimientos: [{ id: 'conservar', valor: 15 }],
        metas: [],
        deudas: [],
        negocios: [],
        productos: [],
      },
    });
    store.compareAndSet(null, raw);
    const accounts = openAccounts(store.db, dbPath);
    await accounts.register({
      nombre: 'Titular',
      email: 'owner@example.test',
      password: 'Clave-segura-2026',
    });
    await accounts.register({
      nombre: 'Otro',
      email: 'other@example.test',
      password: 'Clave-segura-2026',
    });
    assert.throws(
      () => migrateAccountData({ dbPath, email: 'other@example.test' }),
      /no identifica/,
    );
    assert.equal(migrateAccountData({ dbPath, email: 'owner@example.test' }).status, 'preview');
    assert.throws(
      () => migrateAccountData({ dbPath, email: 'owner@example.test', apply: true }),
      /confirm-owner/,
    );
    const result = migrateAccountData({
      dbPath,
      email: 'owner@example.test',
      apply: true,
      confirmOwner: 'owner@example.test',
    });
    assert.equal(result.changed, true);
    assert.ok(fs.existsSync(result.backup));
    assert.equal(store.get(), raw);
    assert.equal(
      migrateAccountData({
        dbPath,
        email: 'owner@example.test',
        apply: true,
        confirmOwner: 'owner@example.test',
      }).status,
      'already-imported',
    );
    const rows = store.db.prepare('SELECT user_id,raw FROM user_states ORDER BY user_id').all();
    assert.equal(JSON.parse(rows[0].raw).data.movimientos.length, 1);
    assert.equal(JSON.parse(rows[1].raw).data.movimientos.length, 0);
    const otherFile = path.join(folder, 'other.json');
    fs.writeFileSync(
      otherFile,
      JSON.stringify({
        data: { ...JSON.parse(raw).data, usuario: { email: 'other@example.test' } },
      }),
    );
    const custom = JSON.parse(rows[1].raw);
    custom.data.negocios[0].nombre = 'Negocio ya editado';
    store.db
      .prepare('UPDATE user_states SET raw=? WHERE user_id=?')
      .run(JSON.stringify(custom), rows[1].user_id);
    assert.throws(
      () => migrateAccountData({ dbPath, email: 'other@example.test', sourceFile: otherFile }),
      /ya tiene datos/,
    );
    custom.data.negocios[0].nombre = 'Mi negocio';
    custom.data.facturacion = { documents: [{ id: 'conservar-documento' }] };
    store.db
      .prepare('UPDATE user_states SET raw=? WHERE user_id=?')
      .run(JSON.stringify(custom), rows[1].user_id);
    assert.throws(
      () => migrateAccountData({ dbPath, email: 'other@example.test', sourceFile: otherFile }),
      /ya tiene datos/,
    );
  } finally {
    store.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
