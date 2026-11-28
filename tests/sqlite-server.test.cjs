'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createServer, openStore } = require('../scripts/serve-sqlite.cjs');

function temp(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mibolsillo-sqlite-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  return path.join(folder, 'mibolsillo.sqlite');
}
const envelope = (amount) =>
  JSON.stringify({
    version: 'FINANZAS_V2',
    data: {
      movimientos: [
        {
          id: 'm1',
          tipo: 'INGRESO',
          concepto: 'Ingreso de prueba',
          valor: amount,
          fecha: '2026-11-16',
        },
      ],
      productos: [{ id: 'p1', nombre: 'Producto', negocioId: 'n1', stock: 5 }],
      negocios: [{ id: 'n1', nombre: 'Negocio de prueba' }],
      gastosNegocio: [
        { id: 'g1', negocioId: 'n1', descripcion: 'Arriendo', monto: 120, fecha: '2026-11-16' },
      ],
    },
  });

test('SQLite conserva el estado tras reabrir y rechaza sobrescrituras obsoletas', (t) => {
  const dbPath = temp(t);
  let store = openStore(dbPath);
  assert.equal(store.get(), null);
  const first = envelope(100);
  assert.deepEqual(store.compareAndSet(null, first), { ok: true });
  store.close();
  store = openStore(dbPath);
  try {
    assert.equal(store.get(), first);
    assert.deepEqual(store.compareAndSet(null, envelope(200)), { ok: false, raw: first });
    assert.equal(store.get(), first);
    assert.equal(
      store.db.prepare('SELECT id, registro_json FROM vista_movimientos').get().id,
      'm1',
    );
    assert.equal(
      JSON.parse(store.db.prepare('SELECT registro_json FROM vista_productos').get().registro_json)
        .stock,
      5,
    );
    const expense = store.db
      .prepare('SELECT concepto, valor, negocio_id FROM vista_gastosNegocio')
      .get();
    assert.deepEqual({ ...expense }, { concepto: 'Arriendo', valor: 120, negocio_id: 'n1' });
    assert.equal(
      store.db.prepare('SELECT count(*) AS n FROM vista_facturacion_documents').get().n,
      0,
    );
    for (const view of [
      'pagosEmpleado',
      'pagosVenta',
      'pagosCompra',
      'pagosGasto',
      'movimientosInventario',
      'formulas',
      'producciones',
      'devolucionesNegocio',
    ]) {
      assert.equal(store.db.prepare(`SELECT count(*) AS n FROM vista_${view}`).get().n, 0);
    }
    assert.throws(() => store.compareAndSet(first, '{"data":[]}'), /inválido/);
    assert.throws(
      () => store.db.prepare('UPDATE app_state SET raw = ? WHERE id = 1').run('{}'),
      /CHECK/,
    );
    assert.equal(store.get(), first);
  } finally {
    store.close();
  }
});

async function running(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mibolsillo-sqlite-http-'));
  const server = createServer({
    requireAuth: false,
    dbPath: path.join(folder, 'mibolsillo.sqlite'),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
    fs.rmSync(folder, { recursive: true, force: true });
  });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test(
  'API guarda, lee, exige token y detecta conflicto sin modificar el estado',
  { timeout: 10000 },
  async (t) => {
    const { base } = await running(t);
    const config = await (await fetch(base + '/api/config')).json();
    assert.equal(config.backend, 'sqlite');
    assert.equal((await (await fetch(base + '/api/storage')).json()).raw, null);
    const body = JSON.stringify({ expectedRaw: null, raw: envelope(350) });
    const headers = { 'Content-Type': 'application/json', 'X-MiBolsillo-Token': config.token };
    assert.equal(
      (
        await fetch(base + '/api/storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(base + '/api/storage', { method: 'POST', headers, body })).status,
      200,
    );
    const conflict = await fetch(base + '/api/storage', { method: 'POST', headers, body });
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).raw, envelope(350));
    assert.equal((await (await fetch(base + '/api/storage')).json()).raw, envelope(350));
    assert.equal(
      (await fetch(base + '/api/storage', { method: 'POST', headers, body: '{' })).status,
      400,
    );
    assert.equal(
      (
        await fetch(base + '/api/storage', {
          method: 'POST',
          headers,
          body: JSON.stringify({ expectedRaw: envelope(350), raw: '{"data":[]}' }),
        })
      ).status,
      400,
    );
  },
);

test(
  'Servidor limita archivos y orígenes e inyecta SQLite en PC y móvil',
  { timeout: 10000 },
  async (t) => {
    const { base, server } = await running(t);
    for (const page of ['desktop.html', 'mobile.html']) {
      const response = await fetch(base + '/' + page);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /window.MiBolsilloSQLiteRequired=true;window.MiBolsilloSQLiteConfig=/);
      assert.match(html, /\/vendor\/chart.umd.js/);
    }
    assert.match(
      await (await fetch(base + '/api/sqlite-bootstrap.js')).text(),
      /MiBolsilloSQLiteConfig/,
    );
    for (const resource of [
      '/database/mibolsillo.sqlite',
      '/database/mibolsillo.sqlite-wal',
      '/package.json',
      '/.git/config',
      '/legacy/web/app.js',
      '/src/%2e%2e%5cpackage.json',
    ]) {
      assert.equal((await fetch(base + resource)).status, 404, resource);
    }
    assert.equal(
      (await fetch(base + '/api/config', { headers: { Origin: 'https://malicious.example' } }))
        .status,
      403,
    );
    assert.equal(
      (await fetch(base + '/api/storage', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status,
      403,
    );
    const status = await new Promise((resolve, reject) => {
      const req = http.get(
        base + '/api/config',
        { headers: { Host: `evil.example:${server.address().port}` } },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on('error', reject);
    });
    assert.equal(status, 403);
  },
);
