// Local SQLite service for the active PC/mobile web application. Node.js >= 22.13.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { randomBytes, createHash } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { openAccounts } = require('./auth-store.cjs');
const { validateFinancialState } = require('./financial-validation.cjs');
const { revisionOf, applyOperations } = require('./storage-patch.cjs');
const { createBackupService } = require('./backup-store.cjs');

const ROOT = path.resolve(__dirname, '..');
const MAX_BODY = 20 * 1024 * 1024;

// Identifies an already running instance without exposing private filesystem paths.
function serverIdentity(root, dbPath) {
  const canonical = value => {
    const absolute = path.resolve(value).replace(/\\/g, '/');
    return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
  };
  return createHash('sha256').update(canonical(root) + '\0' + canonical(dbPath)).digest('hex');
}

function validEnvelope(raw) {
  if (typeof raw !== 'string' || !raw.length) return false;
  try {
    const value = JSON.parse(raw);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && value.data !== null && typeof value.data === 'object' && !Array.isArray(value.data);
  } catch { return false; }
}

function openStore(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 2) {
    db.close();
    throw new Error('La base de datos pertenece a una versión más reciente de MiBolsillo');
  }
  db.exec(`PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      raw TEXT NOT NULL CHECK (json_valid(raw) AND json_type(raw, '$.data') IS 'object'),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    ${version === 0 ? 'PRAGMA user_version = 1;' : ''}`);
  // Read-only projections make records browsable without changing the financial schema.
  const collections = ['movimientos', 'metas', 'deudas', 'negocios', 'productos', 'proveedores',
    'empleados', 'clientes', 'ventas', 'compras', 'gastos', 'cuentas', 'ingresosNegocio',
    'gastosNegocio', 'pagosEmpleado', 'pagosVenta', 'pagosCompra', 'pagosGasto',
    'movimientosInventario', 'formulas', 'producciones', 'devolucionesNegocio'];
  const views = Object.fromEntries(collections.map(collection => [collection, collection]));
  for (const collection of ['documents', 'operations', 'audit', 'refunds']) {
    views[`facturacion_${collection}`] = `facturacion.${collection}`;
  }
  views.bitacora_operaciones = 'businessLedger.operations';
  views.bitacora_auditoria = 'businessLedger.audit';
  // Refresh only projections when reopening an existing DB; financial JSON is untouched.
  db.exec('BEGIN');
  try {
    for (const [name, jsonPath] of Object.entries(views)) {
      db.exec(`DROP VIEW IF EXISTS vista_${name};
        CREATE VIEW vista_${name} AS SELECT
          json_extract(item.value, '$.id') AS id,
          coalesce(json_extract(item.value, '$.nombre'), json_extract(item.value, '$.name'),
            json_extract(item.value, '$.customer.name')) AS nombre,
          coalesce(json_extract(item.value, '$.concepto'), json_extract(item.value, '$.descripcion'),
            json_extract(item.value, '$.description'), json_extract(item.value, '$.reason')) AS concepto,
          coalesce(json_extract(item.value, '$.fecha'), json_extract(item.value, '$.date'),
            json_extract(item.value, '$.at'), json_extract(item.value, '$.createdAt')) AS fecha,
          coalesce(json_extract(item.value, '$.tipo'), json_extract(item.value, '$.kind'),
            json_extract(item.value, '$.action')) AS tipo,
          coalesce(json_extract(item.value, '$.monto'), json_extract(item.value, '$.valor'),
            json_extract(item.value, '$.amount')) AS valor,
          coalesce(json_extract(item.value, '$.total'), json_extract(item.value, '$.totals.total'),
            json_extract(item.value, '$.costoTotal')) AS total,
          coalesce(json_extract(item.value, '$.negocioId'), json_extract(item.value, '$.businessId')) AS negocio_id,
          json_extract(item.value, '$.stock') AS stock,
          coalesce(json_extract(item.value, '$.estado'), json_extract(item.value, '$.status')) AS estado,
          item.value AS registro_json
        FROM app_state, json_each(app_state.raw, '$.data.${jsonPath}') AS item;`);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  const read = db.prepare('SELECT raw FROM app_state WHERE id = 1');
  const write = db.prepare(`INSERT INTO app_state (id, raw) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET raw=excluded.raw, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
  return {
    db,
    get() { return read.get()?.raw ?? null; },
    compareAndSet(expectedRaw, raw) {
      if ((expectedRaw !== null && typeof expectedRaw !== 'string') || !validEnvelope(raw)) {
        throw new TypeError('Formato de estado inválido');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = read.get()?.raw ?? null;
        if (current !== expectedRaw) { db.exec('ROLLBACK'); return { ok: false, raw: current }; }
        write.run(raw);
        db.exec('COMMIT');
        return { ok: true };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { db.close(); }
  };
}

function send(res, status, value, type = 'application/json; charset=utf-8') {
  const body = type.startsWith('application/json') ? JSON.stringify(value) : value;
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' });
  res.end(body);
}

function readJSON(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let length = 0;
    const chunks = [];
    req.on('data', chunk => {
      length += chunk.length;
      if (length <= limit) chunks.push(chunk);
    });
    req.on('end', () => {
      if (length > limit) return reject(Object.assign(new Error('Solicitud demasiado grande'), { status: 413 }));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('JSON inválido'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function createServer({ root = ROOT, dbPath = path.join(root, 'database', 'mibolsillo.sqlite'),
  host = '127.0.0.1', requireAuth = true, backupOptions = {} } = {}) {
  root = path.resolve(root);
  dbPath = path.resolve(dbPath);
  const store = openStore(dbPath);
  let accounts;
  try { accounts = requireAuth ? openAccounts(store.db, dbPath) : null; }
  catch (error) { store.close(); throw error; }
  const backups = createBackupService({ db: store.db, dbPath, accounts, validateState: validateFinancialState, revisionOf, ...backupOptions });
  const token = randomBytes(32).toString('hex');
  const baseConfig = { backend: 'sqlite', token, database: path.basename(dbPath), authRequired: requireAuth };
  const attempts = new Map();
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (host === '0.0.0.0' || host === '::') {
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries || []) if (entry.family === 'IPv4') allowedHosts.add(entry.address);
    }
  } else allowedHosts.add(host);

  const server = http.createServer(async (req, res) => {
    try {
      let requested;
      try { requested = new URL(req.url, `http://${req.headers.host}`); }
      catch { return send(res, 400, { error: 'Host inválido' }); }
      const address = server.address();
      if (!allowedHosts.has(requested.hostname) || Number(requested.port || 80) !== address.port
        || req.url.startsWith('http:') || req.url.startsWith('https:')) {
        return send(res, 403, { error: 'Host no autorizado' });
      }
      if ((req.headers.origin && req.headers.origin !== requested.origin)
        || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) {
        return send(res, 403, { error: 'Origen no autorizado' });
      }
      const resource = requested.pathname;
      if (resource === '/api/app-info' && req.method === 'GET') {
        return send(res, 200, { app: 'MiBolsillo', backend: 'sqlite',
          identity: serverIdentity(root, dbPath), authRequired: requireAuth });
      }
      const session = accounts?.session(req);
      if (resource === '/api/auth/session' && req.method === 'GET') {
        if (!requireAuth) return send(res, 200, { legacyMode: true, user: null });
        return session ? send(res, 200, { user: session.user, csrfToken: session.csrfToken })
          : send(res, 401, { error: 'Inicia sesión para continuar.' });
      }
      if (['/api/auth/register', '/api/auth/login'].includes(resource)) {
        if (!accounts) return send(res, 409, { error: 'Las cuentas no están disponibles en este modo de prueba.' });
        if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Use application/json' });
        const body = await readJSON(req, 16384);
        if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 400, { error: 'Datos de acceso inválidos.' });
        const key = String(req.socket.remoteAddress) + ':' + String(body.email || '').trim().toLowerCase();
        const now = Date.now();
        if (attempts.size >= 1000) for (const [id, value] of attempts) if (value.until <= now) attempts.delete(id);
        const previous = attempts.get(key);
        if (previous && previous.until > now && previous.count >= 12) return send(res, 429, { error: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' });
        if (attempts.size >= 1000 && !previous) return send(res, 429, { error: 'Demasiados intentos. Vuelve a intentarlo más tarde.' });
        attempts.set(key, { until: previous?.until > now ? previous.until : now + 5 * 60 * 1000, count: previous?.until > now ? previous.count + 1 : 1 });
        const result = resource.endsWith('/register') ? await accounts.register(body) : await accounts.login(body);
        attempts.delete(key);
        res.setHeader('Set-Cookie', result.cookie);
        return send(res, resource.endsWith('/register') ? 201 : 200, { user: result.user, csrfToken: result.csrfToken });
      }
      if (requireAuth && resource.startsWith('/api/') && !session) return send(res, 401, { error: 'Tu sesión no está activa. Inicia sesión de nuevo.' });
      if (resource === '/api/auth/logout') {
        if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
        if (!accounts) return send(res, 409, { error: 'Este modo no tiene sesión.' });
        if (req.headers['x-mibolsillo-token'] !== session.csrfToken) return send(res, 403, { error: 'Token de sesión no válido.' });
        res.setHeader('Set-Cookie', accounts.logout(session));
        return send(res, 200, { ok: true });
      }
      if (resource === '/api/auth/legacy-status' && req.method === 'GET') return send(res, 200, accounts ? accounts.legacyStatus() : { available: false });
      const config = session ? { ...baseConfig, token: session.csrfToken, user: session.user,
        authenticated: true, allowLegacyImport: false } : baseConfig;
      const activeStore = session ? accounts.scoped(session.user.id) : store;
      const bootstrapConfig = () => {
        const raw = activeStore.get();
        return { ...config, initialRaw: raw, initialRevision: revisionOf(raw) };
      };
      if (resource === '/api/config' && req.method === 'GET') return send(res, 200, bootstrapConfig());
      if (resource === '/api/sqlite-bootstrap.js' && req.method === 'GET') {
        return send(res, 200, `window.MiBolsilloSQLiteConfig = ${JSON.stringify(bootstrapConfig()).replace(/</g, '\\u003c')};`, 'text/javascript; charset=utf-8');
      }
      if (await backups.handle(req, res, { session, readJSON, send })) return;
      if (resource === '/api/storage') {
        if (session && req.headers['x-mibolsillo-account'] && req.headers['x-mibolsillo-account'] !== String(session.user.id)) return send(res, 401, { error: 'La cuenta activa cambió. Inicia sesión de nuevo.' });
        if (req.method === 'GET') {
          const raw = activeStore.get(), revision = revisionOf(raw);
          return send(res, 200, requested.searchParams.has('revision') && requested.searchParams.get('revision') === String(revision)
            ? { unchanged: true, revision } : { raw, revision });
        }
        if (!['POST', 'PATCH'].includes(req.method)) return send(res, 405, { error: 'Método no permitido' });
        if (req.headers['x-mibolsillo-token'] !== config.token) return send(res, 403, { error: 'Token no válido' });
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
          return send(res, 415, { error: 'Use application/json' });
        }
        const body = await readJSON(req);
        if (req.method === 'PATCH') {
          if (!body || !Object.prototype.hasOwnProperty.call(body,'expectedRevision') || (body.expectedRevision !== null && typeof body.expectedRevision !== 'string') || typeof body.operationId !== 'string' || !body.operationId || body.operationId.length > 300) return send(res, 400, { error: 'Revisión u operación inválida.' });
          const current = activeStore.get(), revision = revisionOf(current);
          if (revision === body.operationId) return send(res, 200, { ok: true, duplicate: true, revision });
          if (revision !== body.expectedRevision) return send(res, 409, { error: 'conflict', raw: current, revision });
          const raw = applyOperations(current, body.operations);
          if (!validEnvelope(raw) || revisionOf(raw) !== body.operationId) return send(res, 400, { error: 'El estado incremental o su revisión no es válido.' });
          validateFinancialState(JSON.parse(raw).data, current ? JSON.parse(current).data : null);
          const result = activeStore.compareAndSet(current, raw);
          return send(res, result.ok ? 200 : 409, result.ok ? { ok: true, revision: revisionOf(raw) } : { error: 'conflict', raw: result.raw, revision: revisionOf(result.raw) });
        }
        if (!body || (body.expectedRaw !== null && typeof body.expectedRaw !== 'string') || !validEnvelope(body.raw)) {
          return send(res, 400, { error: 'Formato de estado inválido' });
        }
        const current = activeStore.get();
        if (current === body.expectedRaw) validateFinancialState(JSON.parse(body.raw).data, current ? JSON.parse(current).data : null);
        const result = activeStore.compareAndSet(body.expectedRaw, body.raw);
        return send(res, result.ok ? 200 : 409, result.ok ? result : { error: 'conflict', raw: result.raw });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Método no permitido' });
      let relative;
      try { relative = resource === '/' ? 'index.html' : decodeURIComponent(resource).replace(/^\//, ''); }
      catch { return send(res, 400, { error: 'Ruta inválida' }); }
      if (requireAuth && !session && /^(desktop|mobile)\.html$/.test(relative)) {
        res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' }); return res.end();
      }
      if (relative.includes('\\') || relative.split('/').some(part => part.startsWith('.'))
        || !(/^(?:index|desktop|mobile)\.html$/.test(relative)
          || /^(?:src|styles)\/.+\.(?:js|css|svg|png|jpg|jpeg|webp|gif|woff2?|ttf|txt)$/.test(relative)
          || relative === 'vendor/chart.umd.js')) return send(res, 404, { error: 'Archivo no encontrado' });
      const file = path.resolve(root, relative === 'vendor/chart.umd.js'
        ? 'node_modules/chart.js/dist/chart.umd.js' : relative);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()
        || !fs.realpathSync(file).startsWith(fs.realpathSync(root) + path.sep)) {
        return send(res, 404, { error: 'Archivo no encontrado' });
      }
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
        '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
      let body = fs.readFileSync(file);
      if (relative.endsWith('.html')) {
        const bootstrap = JSON.stringify(session || !requireAuth ? bootstrapConfig() : config).replace(/</g, '\\u003c');
        body = body.toString('utf8').replace(/<head>/i,
          `<head>\n<script>window.MiBolsilloSQLiteRequired=true;window.MiBolsilloSQLiteConfig=${bootstrap};</script>`)
          .replace('https://cdn.jsdelivr.net/npm/chart.js', '/vendor/chart.umd.js');
      }
      send(res, 200, req.method === 'HEAD' ? '' : body, types[path.extname(file)]);
    } catch (error) {
      if (!error.status) console.error('SQLite:', error.message);
      if (!res.headersSent) send(res, error.status || 500, { error: error.status ? error.message : 'No se pudo acceder a la base de datos' });
      else res.end();
    }
  });
  server.on('close', () => { backups.close(); store.close(); });
  server.sqlite = { store, dbPath, host, requireAuth, accounts, backups };
  return server;
}

if (require.main === module) {
  const host = process.env.MIBOLSILLO_HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 5500);
  const server = createServer({ host, ...(process.env.MIBOLSILLO_DB_PATH ? { dbPath: process.env.MIBOLSILLO_DB_PATH } : {}) });
  server.listen(port, host, () => {
    console.log(`MiBolsillo SQLite: http://${host}:${server.address().port}/desktop.html`);
    console.log(`Móvil: http://${host}:${server.address().port}/mobile.html`);
    console.log(`Base de datos: ${server.sqlite.dbPath}`);
  });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; server.sqlite.store.close(); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}

module.exports = { createServer, openStore, validEnvelope, serverIdentity, revisionOf, validateFinancialState };
