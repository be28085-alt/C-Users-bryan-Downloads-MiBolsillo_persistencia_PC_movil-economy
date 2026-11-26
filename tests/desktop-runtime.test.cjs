'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { startDesktop } = require('../scripts/desktop-runtime.cjs');

function database(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mibolsillo-desktop-'));
  const closers = [];
  t.after(async () => {
    for (const close of closers.reverse()) await close();
    fs.rmSync(folder, { recursive: true, force: true });
  });
  return { path: path.join(folder, 'app.sqlite'), after(close) { closers.push(close); } };
}

test('Qt reutiliza toda la app HTML y la misma base SQLite sin abrir otro almacén', async t => {
  const fixture = database(t), dbPath = fixture.path;
  const owner = await startDesktop({ dbPath, port: 0 });
  fixture.after(() => owner.close());
  assert.equal(owner.ownsServer, true);
  const port = new URL(owner.url).port;
  const attached = await startDesktop({ dbPath, port: Number(port) });
  assert.equal(attached.ownsServer, false);
  assert.equal(attached.url, owner.url);
  const registered = await fetch(owner.url + 'api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Prueba Qt', email: 'qt@example.test', password: 'Prueba-segura-2026' }) });
  assert.equal(registered.status, 201);
  const cookie = registered.headers.get('set-cookie').split(';')[0];
  const sessionHeaders = { Cookie: cookie };
  for (const page of ['', 'desktop.html', 'mobile.html']) {
    const response = await fetch(owner.url + page, { headers: sessionHeaders });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /MiBolsilloSQLiteRequired=true/);
  }
  const config = await (await fetch(owner.url + 'api/config', { headers: sessionHeaders })).json();
  const before = await (await fetch(owner.url + 'api/storage', { headers: sessionHeaders })).json();
  const invalid = JSON.stringify({ version: 'FINANZAS_V2', data: { movimientos: [{ id: 'incomplete', valor: 125.35 }] } });
  assert.equal((await fetch(owner.url + 'api/storage', { method: 'POST',
    headers: { ...sessionHeaders, 'Content-Type': 'application/json', 'X-MiBolsillo-Token': config.token },
    body: JSON.stringify({ expectedRaw: before.raw, raw: invalid }) })).status, 400);
  assert.equal((await (await fetch(owner.url + 'api/storage', { headers: sessionHeaders })).json()).raw, before.raw);
  // Partir de la cuenta válida conserva identidad y colecciones obligatorias.
  const candidate = JSON.parse(before.raw);
  candidate.revision = randomUUID();
  candidate.data.movimientos.push({ id: 'original', tipo: 'INGRESO', concepto: 'Ingreso sintético', valor: 125.35, fecha: '2026-11-26' });
  candidate.data.productos.push({ id: 'stock-original', negocioId: candidate.data.negocioActivoId, nombre: 'Producto sintético', stock: 7 });
  candidate.data.metas.push({ id: 'meta-original', nombre: 'Meta sintética', objetivo: 200, ahorrado: 0 });
  const raw = JSON.stringify(candidate);
  assert.equal((await fetch(owner.url + 'api/storage', { method: 'POST',
    headers: { ...sessionHeaders, 'Content-Type': 'application/json', 'X-MiBolsillo-Token': config.token },
    body: JSON.stringify({ expectedRaw: before.raw, raw }) })).status, 200);
  await attached.close();
  assert.equal((await (await fetch(owner.url + 'api/storage', { headers: sessionHeaders })).json()).raw, raw);
  await owner.close();
  const reopened = await startDesktop({ dbPath, port: 0 });
  fixture.after(() => reopened.close());
  assert.equal((await (await fetch(reopened.url + 'api/storage', { headers: sessionHeaders })).json()).raw, raw);
});

test('un puerto ajeno o una base distinta no producen caída silenciosa a otro almacenamiento', async t => {
  const fixture = database(t), dbPath = fixture.path;
  const unrelated = http.createServer((req, res) => { res.writeHead(200); res.end('{}'); });
  await new Promise(resolve => unrelated.listen(0, '127.0.0.1', resolve));
  fixture.after(() => new Promise(resolve => { unrelated.close(resolve); unrelated.closeAllConnections(); }));
  await assert.rejects(startDesktop({ dbPath, port: unrelated.address().port }), /ocupado/);
  assert.equal(fs.existsSync(dbPath), false);
  const owner = await startDesktop({ dbPath, port: 0 });
  fixture.after(() => owner.close());
  await assert.rejects(startDesktop({ dbPath: dbPath + '.other', port: owner.server.address().port }), /otra base/);
  assert.equal(fs.existsSync(dbPath + '.other'), false);
});

test('el proceso auxiliar cierra solo su servidor al cerrar la aplicación Qt', { timeout: 10000 }, async t => {
  const fixture = database(t), dbPath = fixture.path;
  const child = spawn(process.execPath, ['scripts/desktop-runtime.cjs'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, MIBOLSILLO_PORT: '0', MIBOLSILLO_DB_PATH: dbPath },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  fixture.after(async () => {
    if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
  });
  const exited = once(child, 'exit');
  let output = '';
  const ready = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.includes('\n')) {
        const message = JSON.parse(output.split('\n')[0]);
        message.event === 'ready' ? resolve(message) : reject(new Error(message.message));
      }
    });
    child.once('exit', code => reject(new Error('Auxiliar terminó antes de iniciar: ' + code)));
  });
  assert.equal((await fetch(ready.url)).status, 200);
  child.stdin.end();
  const [code] = await exited;
  assert.equal(code, 0);
  await assert.rejects(fetch(ready.url));
});
