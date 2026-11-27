// Composición HTTP de la aplicación PC/móvil; los adaptadores preservan sus contratos.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { randomBytes, createHash, randomUUID } = require('node:crypto');
const { openAccounts } = require('./auth-store.cjs');
const { validateFinancialState } = require('./financial-validation.cjs');
const { revisionOf } = require('./storage-patch.cjs');
const { createBackupService } = require('./backup-store.cjs');
const { securityPolicy, requestIdentity, allowedFields, sameToken } = require('./security-policy.cjs');
const { createRateLimiter } = require('./rate-limiter.cjs');
const { createSecurityAudit } = require('./security-audit.cjs');
const { openStore } = require('./backend/sqlite-state-repository.cjs');
const { validEnvelope } = require('./backend/state-envelope.cjs');
const { send, readJSON } = require('./backend/http-transport.cjs');
const { handleStorage } = require('./backend/storage-controller.cjs');

const ROOT = path.resolve(__dirname, '..');

// Identifies an already running instance without exposing private filesystem paths.
function serverIdentity(root, dbPath) {
  const canonical = value => {
    const absolute = path.resolve(value).replace(/\\/g, '/');
    return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
  };
  return createHash('sha256').update(canonical(root) + '\0' + canonical(dbPath)).digest('hex');
}

function publicResource(relative) {
  return !relative.includes('\\') && !relative.split('/').some(part => part.startsWith('.'))
    && (/^(?:index|desktop|mobile)\.html$/.test(relative)
      || /^(?:src|styles)\/.+\.(?:js|css|svg|png|jpg|jpeg|webp|gif|woff2?|ttf|txt)$/.test(relative));
}

function createServer({ root = ROOT, dbPath = path.join(root, 'database', 'mibolsillo.sqlite'),
  host = '127.0.0.1', requireAuth = true, backupOptions = {}, security = {} } = {}) {
  const policy = securityPolicy(security, host, requireAuth);
  root = path.resolve(root);
  dbPath = path.resolve(dbPath);
  const store = openStore(dbPath);
  let accounts;
  try { accounts = requireAuth ? openAccounts(store.db, dbPath, { secureCookies: policy.production,
    sessionSeconds: policy.sessionSeconds, idleMs: policy.idleMs, maxSessions: policy.maxSessions }) : null; }
  catch (error) { store.close(); throw error; }
  const backups = createBackupService({ db: store.db, dbPath, accounts, validateState: validateFinancialState, revisionOf, ...backupOptions });
  const token = randomBytes(32).toString('hex');
  const baseConfig = { backend: 'sqlite', authRequired: requireAuth,
    ...(!requireAuth ? { token, database: path.basename(dbPath) } : {}) };
  const limiter = createRateLimiter(policy.rates);
  const audit = createSecurityAudit(path.join(path.dirname(dbPath), 'security-audit'));
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (host === '0.0.0.0' || host === '::') {
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries || []) if (entry.family === 'IPv4') allowedHosts.add(entry.address);
    }
  } else allowedHosts.add(host);

  const server = http.createServer({ requestTimeout: policy.requestTimeoutMs, headersTimeout: Math.min(10000, policy.requestTimeoutMs),
    keepAliveTimeout: 5000, maxHeaderSize: 16384 }, async (req, res) => {
    const requestId = randomUUID(); let auditRoute = 'other';
    res.setHeader('X-Request-Id', requestId);
    res.once('finish', () => {
      const status = res.statusCode;
      const event = status >= 500 ? 'internal-error' : status >= 400 ? 'rejected'
        : auditRoute === 'access' ? 'authentication' : req.url === '/api/auth/logout' ? 'logout'
        : req.url === '/api/auth/password' ? 'password-change' : ['POST','PATCH'].includes(req.method) ? 'write' : null;
      if (event) audit.write({ event, requestId, status, route: auditRoute, method: req.method });
    });
    try {
      if (!req.url.startsWith('/') || req.url.startsWith('//')) return send(res, 403, { error: 'Ruta no autorizada.' });
      const address = server.address();
      const { url: requested, client } = requestIdentity(req, address, allowedHosts, policy);
      if (policy.production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      if ((req.headers.origin && req.headers.origin !== requested.origin)
        || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) {
        return send(res, 403, { error: 'Origen no autorizado' });
      }
      const resource = requested.pathname;
      if (resource.startsWith('/api/')) limiter.publicApi(client);
      auditRoute = resource.startsWith('/api/auth/login') || resource.startsWith('/api/auth/register') ? 'access'
        : resource.startsWith('/api/backups') ? 'backups' : resource === '/api/storage' ? 'storage' : resource.startsWith('/api/auth/') ? 'session' : 'other';
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
        allowedFields(body, resource.endsWith('/register') ? ['nombre','email','password'] : ['email','password']);
        limiter.authentication(client, body.email);
        const result = resource.endsWith('/register') ? await accounts.register(body, { replaceToken: session?.tokenHash }) : await accounts.login(body, { replaceToken: session?.tokenHash });
        res.setHeader('Set-Cookie', result.cookie);
        return send(res, resource.endsWith('/register') ? 201 : 200, { user: result.user, csrfToken: result.csrfToken });
      }
      if (requireAuth && resource.startsWith('/api/') && !session) return send(res, 401, { error: 'Tu sesión no está activa. Inicia sesión de nuevo.' });
      if (session && resource.startsWith('/api/')) {
        if (req.headers['x-mibolsillo-account'] && req.headers['x-mibolsillo-account'] !== String(session.user.id)) return send(res, 401, { error: 'La cuenta activa cambió. Inicia sesión de nuevo.' });
        limiter.authenticated(session.user.id, ['POST','PATCH'].includes(req.method), resource.startsWith('/api/backups'));
      }
      if (resource === '/api/auth/password') {
        if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido.' });
        if (!accounts || !sameToken(req.headers['x-mibolsillo-token'], session.csrfToken)) return send(res, 403, { error: 'Token de sesión no válido.' });
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Use application/json' });
        limiter.authentication(client, session.user.email);
        const body = await readJSON(req, 16384); allowedFields(body, ['currentPassword','newPassword']);
        const result = await accounts.changePassword(session, body);
        res.setHeader('Set-Cookie', result.cookie);
        return send(res, 200, { user: result.user, csrfToken: result.csrfToken });
      }
      if (resource === '/api/auth/logout') {
        if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
        if (!accounts) return send(res, 409, { error: 'Este modo no tiene sesión.' });
        if (!sameToken(req.headers['x-mibolsillo-token'], session.csrfToken)) return send(res, 403, { error: 'Token de sesión no válido.' });
        res.setHeader('Set-Cookie', accounts.logout(session));
        return send(res, 200, { ok: true });
      }
      if (resource === '/api/auth/legacy-status' && req.method === 'GET') return send(res, 200, accounts ? accounts.legacyStatus() : { available: false });
      const config = session ? { ...baseConfig, token: session.csrfToken, database: path.basename(dbPath), user: session.user,
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
      if (resource === '/api/storage') return await handleStorage(req, res, { requested, session, activeStore, token: config.token, maxStateBytes: policy.maxStateBytes });
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Método no permitido' });
      let relative;
      try { relative = resource === '/' ? 'index.html' : decodeURIComponent(resource).replace(/^\//, ''); }
      catch { return send(res, 400, { error: 'Ruta inválida' }); }
      if (requireAuth && !session && /^(desktop|mobile)\.html$/.test(relative)) {
        res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' }); return res.end();
      }
      if (!publicResource(relative) && relative !== 'vendor/chart.umd.js') return send(res, 404, { error: 'Archivo no encontrado' });
      const file = path.resolve(root, relative === 'vendor/chart.umd.js'
        ? 'node_modules/chart.js/dist/chart.umd.js' : relative);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()
        || !fs.realpathSync(file).startsWith(fs.realpathSync(root) + path.sep)) {
        return send(res, 404, { error: 'Archivo no encontrado' });
      }
      // A public-looking symlink/junction must not expose database/, backups/ or
      // other private files inside the project. Validate the resolved path too.
      const resolved = path.relative(fs.realpathSync(root), fs.realpathSync(file)).split(path.sep).join('/');
      const vendor = relative === 'vendor/chart.umd.js'
        && /^node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?chart\.js\/dist\/chart\.umd\.js$/.test(resolved);
      if (!publicResource(resolved) && !vendor) return send(res, 404, { error: 'Archivo no encontrado' });
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
      if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
      if (!res.headersSent) send(res, error.status || 500, { error: error.status ? error.message : 'No se pudo acceder a la base de datos' });
      else res.end();
    }
  });
  server.maxConnections = 128;
  server.maxRequestsPerSocket = 1000;
  server.on('close', () => { backups.close(); store.close(); });
  server.sqlite = { store, dbPath, host, requireAuth, accounts, backups, security: { policy, audit, limiter } };
  return server;
}

if (require.main === module) {
  try {
    const host = process.env.MIBOLSILLO_HOST || '127.0.0.1';
    const port = Number(process.env.PORT || 5500);
    const server = createServer({ host, ...(process.env.MIBOLSILLO_DB_PATH ? { dbPath: process.env.MIBOLSILLO_DB_PATH } : {}) });
    server.listen(port, host, () => {
      const origin = server.sqlite.security.policy.publicOrigin || `http://${host}:${server.address().port}`;
      console.log(`MiBolsillo SQLite: ${origin}/desktop.html`);
      console.log(`Móvil: ${origin}/mobile.html`);
      console.log('Base SQLite configurada; consulta la ruta en la configuración local.');
    });
    server.on('error', error => { console.error('No se pudo iniciar el servicio local. Comprueba el puerto y los permisos.'); process.exitCode = 1; server.sqlite.store.close(); });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
  } catch (error) {
    console.error('No se pudo iniciar el servicio. Revisa la configuración y los permisos. Referencia:', randomUUID());
    process.exitCode = 1;
  }
}

module.exports = { createServer, openStore, validEnvelope, serverIdentity, revisionOf, validateFinancialState };
