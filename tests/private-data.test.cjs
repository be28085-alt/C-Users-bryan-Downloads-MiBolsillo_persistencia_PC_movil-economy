'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { preparePrivateFile, createPrivateSnapshot } = require('../scripts/private-files.cjs');
const { createServer } = require('../scripts/serve-sqlite.cjs');
const ROOT = path.resolve(__dirname, '..');

function fixture(t, beforeCleanup = () => {}) {
  const base = path.join(ROOT, 'tmp');
  fs.mkdirSync(base, { recursive: true });
  const folder = fs.mkdtempSync(path.join(base, 'private-data-'));
  t.after(async () => { await beforeCleanup(); fs.rmSync(folder, { recursive: true, force: true }); });
  return folder;
}

test('Git excluye respaldos, diarios, exportaciones y secretos en cualquier nivel', () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0').filter(Boolean);
  const privatePath = /(?:^|\/)backups\/|\.(?:sqlite3?|db3?|sdb)(?:$|-)|(?:^|\/)\.env(?:$|\.(?!example$))|\.(?:pem|key|p12|pfx|jks|keystore|user)$/i;
  assert.deepEqual(tracked.filter(file => privatePath.test(file)), []);
  const probes = ['database/backups/accounts/999/new.json', 'database/backups/database/new.sqlite',
    'database/backups/database/new.sqlite.tmp', 'database/development/profile.json',
    'database/test/fixture.json', 'private/export.json', 'exports/finanzas.csv',
    'other/backups/user.json', 'other/nested/app.sqlite-wal', 'other/app.sqlite-shm',
    'other/app.sqlite-journal', 'other/app.sqlite3', 'other/app.db3-wal',
    '.env', '.env.production', '.env.development', 'nested/.env.local',
    'key.properties', 'credentials.json', 'keys/private.pem', 'id_ed25519'];
  const ignored = execFileSync('git', ['check-ignore', '--stdin'], { cwd: ROOT, input: probes.join('\n') + '\n' })
    .toString().trim().split(/\r?\n/);
  assert.deepEqual(ignored, probes);
  for (const file of ['.env.example', 'database/gestor_financiero.sql', 'src/storage/localStorage.js']) {
    assert.equal(spawnSync('git', ['check-ignore', '--no-index', file], { cwd: ROOT }).status, 1, file);
  }
});

test('archivos nuevos y snapshots privados conservan contenido y rechazan sobrescribir copias', t => {
  const folder = fixture(t), filename = path.join(folder, 'data', 'main.sqlite');
  assert.equal(preparePrivateFile(filename), true);
  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES(\'synthetic\')');
    assert.equal(preparePrivateFile(filename), false);
    const copy = path.join(folder, 'backups', 'snapshot.sqlite');
    createPrivateSnapshot(db, copy);
    const bytes = fs.readFileSync(copy);
    assert.throws(() => createPrivateSnapshot(db, copy), /ya existe/);
    assert.deepEqual(fs.readFileSync(copy), bytes);
    const snapshot = new DatabaseSync(copy, { readOnly: true });
    try {
      assert.equal(snapshot.prepare('PRAGMA quick_check').get().quick_check, 'ok');
      assert.equal(snapshot.prepare('SELECT value FROM sample').get().value, 'synthetic');
    } finally { snapshot.close(); }
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
      assert.equal(fs.statSync(copy).mode & 0o777, 0o600);
      assert.equal(fs.statSync(path.dirname(copy)).mode & 0o777, 0o700);
    }
  } finally { db.close(); }
});

test('HTTP bloquea archivos privados existentes con y sin sesión y conserva PC/móvil y datos al reiniciar', { timeout: 20000 }, async t => {
  let server;
  const folder = fixture(t, () => stop()), webRoot = path.join(folder, 'web');
  fs.mkdirSync(webRoot);
  for (const page of ['index.html', 'desktop.html', 'mobile.html']) fs.copyFileSync(path.join(ROOT, page), path.join(webRoot, page));
  // Exercise the supported pnpm junction layout as well as private aliases.
  const chart = path.join(webRoot, 'node_modules', '.pnpm', 'chart.js@fixture', 'node_modules', 'chart.js');
  fs.mkdirSync(path.join(chart, 'dist'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'node_modules/chart.js/dist/chart.umd.js'), path.join(chart, 'dist/chart.umd.js'));
  fs.symlinkSync(chart, path.join(webRoot, 'node_modules', 'chart.js'), process.platform === 'win32' ? 'junction' : 'dir');
  const privateFiles = ['database/mibolsillo.sqlite', 'database/mibolsillo.sqlite-wal', 'database/mibolsillo.sqlite-shm',
    'database/mibolsillo.sqlite-journal', 'database/backups/accounts/1/synthetic.json',
    'database/backups/database/synthetic.sqlite', 'exports/synthetic.csv', '.env', '.env.production',
    '.git/config', 'keys/private.pem', 'src/accidental.sqlite', 'src/accidental.db-wal', 'database/synthetic.txt'];
  for (const relative of privateFiles) {
    const file = path.join(webRoot, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'PRIVATE_SENTINEL');
  }
  fs.symlinkSync(path.join(webRoot, 'database'), path.join(webRoot, 'src', 'private-alias'), process.platform === 'win32' ? 'junction' : 'dir');
  const dbPath = path.join(folder, 'server', 'test.sqlite');
  async function stop() {
    if (!server) return;
    const closing = server; server = null;
    await new Promise(resolve => { closing.close(resolve); closing.closeAllConnections(); });
  }
  async function start() {
    server = createServer({ root: webRoot, dbPath });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return 'http://127.0.0.1:' + server.address().port;
  }
  let base = await start();
  for (const route of ['/api/storage', '/api/config', '/api/sqlite-bootstrap.js', '/api/backups']) {
    assert.equal((await fetch(base + route)).status, 401);
  }
  const registered = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Synthetic security test', email: 'security@example.test', password: 'Synthetic-only-2026' }) });
  assert.equal(registered.status, 201);
  const session = await registered.json(), headers = { Cookie: registered.headers.get('set-cookie').split(';')[0] };
  const paths = [...privateFiles.map(file => '/' + file), '/database/%62ackups/accounts/1/synthetic.json',
    '/src/%2e%2e%5cdatabase%5cbackups%5caccounts%5c1%5csynthetic.json', '/src/private-alias/synthetic.txt'];
  for (const authenticated of [false, true]) for (const resource of paths) for (const method of ['GET', 'HEAD']) {
    const response = await fetch(base + resource, { method, headers: authenticated ? headers : {} });
    assert.equal(response.status, 404, method + ' ' + resource);
    assert.equal((await response.text()).includes('PRIVATE_SENTINEL'), false);
  }
  for (const page of ['desktop.html', 'mobile.html']) {
    const response = await fetch(base + '/' + page, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'self'/);
    assert.match(await response.text(), /MiBolsilloSQLiteRequired=true/);
  }
  assert.equal((await fetch(base + '/vendor/chart.umd.js', { headers })).status, 200);
  const before = (await (await fetch(base + '/api/storage', { headers })).json()).raw;
  const create = await fetch(base + '/api/backups', { method: 'POST', headers: { ...headers, 'X-MiBolsillo-Token': session.csrfToken } });
  assert.equal(create.status, 201);
  assert.ok(fs.readdirSync(path.join(folder, 'server', 'backups', 'accounts', String(session.user.id))).length);
  const id = (await create.json()).backup.id;
  assert.equal((await fetch(base + '/api/backups/' + id)).status, 401);
  assert.equal((await fetch(base + '/api/backups/' + id, { headers })).status, 200);
  await stop(); base = await start();
  const after = (await (await fetch(base + '/api/storage', { headers })).json()).raw;
  assert.equal(after, before);
  for (const file of privateFiles) assert.equal(fs.readFileSync(path.join(webRoot, file), 'utf8'), 'PRIVATE_SENTINEL');
});
