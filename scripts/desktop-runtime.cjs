'use strict';
// The Qt launcher serves the existing HTML application and its original SQLite
// format. It never copies financial data into the independent QML prototype.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createServer, serverIdentity } = require('./serve-sqlite.cjs');

const ROOT = path.resolve(__dirname, '..');

async function findExisting(port, identity) {
  if (!port) return null;
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/api/app-info',
      timeout: 1500, agent: false }, response => {
      let body = '';
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 8192) request.destroy(new Error('Respuesta local inesperada.'));
      });
      response.on('error', reject);
      response.on('end', () => {
        let info;
        try { info = JSON.parse(body); } catch { /* Treat unrelated HTTP services as occupied. */ }
        if (response.statusCode === 200 && info?.app === 'MiBolsillo'
          && info.backend === 'sqlite' && info.identity === identity && info.authRequired === true) return resolve(true);
        reject(new Error(`El puerto ${port} está ocupado por otro servicio o por otra base. No se abrió un almacenamiento alternativo.`));
      });
    });
    request.on('timeout', () => request.destroy(new Error('El servicio local no responde.')));
    request.on('error', error => error.code === 'ECONNREFUSED' ? resolve(false) : reject(error));
  });
}

async function startDesktop({ root = ROOT, dbPath = path.join(root, 'database', 'mibolsillo.sqlite'),
  port = 5500 } = {}) {
  root = path.resolve(root);
  dbPath = path.resolve(dbPath);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Puerto local inválido.');
  for (const file of ['index.html', 'desktop.html', 'mobile.html', 'src/utils/desktop.js', 'src/utils/mobile.js']) {
    if (!fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile()) {
      throw new Error('Falta un archivo de la aplicación HTML: ' + file);
    }
  }
  const identity = serverIdentity(root, dbPath);
  const attached = () => ({ url: `http://127.0.0.1:${port}/`, database: dbPath,
    ownsServer: false, async close() {} });
  if (await findExisting(port, identity)) return attached();
  const server = createServer({ root, dbPath, host: '127.0.0.1' });
  try {
    await new Promise((resolve, reject) => {
      const failed = error => { server.off('listening', resolve); reject(error); };
      server.once('error', failed);
      server.once('listening', () => { server.off('error', failed); resolve(); });
      server.listen(port, '127.0.0.1');
    });
  } catch (error) {
    server.sqlite.store.close();
    if (error.code === 'EADDRINUSE' && await findExisting(port, identity)) return attached();
    throw error;
  }
  let closed = false;
  return { url: `http://127.0.0.1:${server.address().port}/`, database: dbPath, ownsServer: true, server,
    async close() {
      if (closed) return;
      closed = true;
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    } };
}

if (require.main === module) {
  let service;
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await service?.close();
    process.stdin.pause();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.stdin.on('end', shutdown);
  process.stdin.on('error', shutdown);
  process.stdin.resume();
  (async () => {
    service = await startDesktop({
      root: process.env.MIBOLSILLO_PROJECT_ROOT || ROOT,
      ...(process.env.MIBOLSILLO_DB_PATH ? { dbPath: process.env.MIBOLSILLO_DB_PATH } : {}),
      port: Number(process.env.MIBOLSILLO_PORT ?? 5500)
    });
    if (closing) return service.close();
    process.stdout.write(JSON.stringify({ event: 'ready', url: service.url,
      database: service.database, ownsServer: service.ownsServer }) + '\n');
  })().catch(error => {
    process.stdout.write(JSON.stringify({ event: 'error', message: error.message }) + '\n');
    process.exitCode = 1;
    process.stdin.pause();
  });
}

module.exports = { startDesktop, findExisting };
