'use strict';
// El lanzador Qt reutiliza la aplicación HTML y su formato SQLite original;
// no copia finanzas al prototipo QML independiente.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createServer, serverIdentity } = require('./serve-sqlite.cjs');

const ROOT = path.resolve(__dirname, '..');
const LOCAL_PROBE_TIMEOUT_MS = 1500;
const MAX_PROBE_RESPONSE_CHARACTERS = 8192;
const MAX_LOCAL_PORT = 65535;

/**
 * @param {number} port Puerto loopback a comprobar; cero omite la búsqueda.
 * @param {string} identity Huella de instalación y base esperadas.
 * @returns {Promise<boolean|null>} Coincidencia, puerto libre o comprobación omitida.
 * @throws {Error} Si otro servicio ocupa el puerto o falla la comprobación local.
 * La información de app-info es metadata pública; no se consultan finanzas.
 */
async function findExisting(port, identity) {
  if (!port) return null;
  return new Promise((resolve, reject) => {
    const request = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/app-info',
        timeout: LOCAL_PROBE_TIMEOUT_MS,
        agent: false,
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
          if (body.length > MAX_PROBE_RESPONSE_CHARACTERS) {
            request.destroy(new Error('Respuesta local inesperada.'));
          }
        });
        response.on('error', reject);
        response.on('end', () => {
          let info;
          try {
            info = JSON.parse(body);
          } catch {
            /* JSON ajeno identifica un puerto ocupado, nunca otra base válida. */
          }
          if (
            response.statusCode === 200 &&
            info?.app === 'MiBolsillo' &&
            info.backend === 'sqlite' &&
            info.identity === identity &&
            info.authRequired === true
          ) {
            return resolve(true);
          }
          reject(
            new Error(
              `El puerto ${port} está ocupado por otro servicio o por otra base. No se abrió un almacenamiento alternativo.`,
            ),
          );
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error('El servicio local no responde.')));
    request.on('error', (error) =>
      error.code === 'ECONNREFUSED' ? resolve(false) : reject(error),
    );
  });
}

/**
 * @param {object} options Instalación, base y puerto elegidos por el lanzador local.
 * @returns {Promise<object>} Servicio con close; ownsServer distingue instancia propia.
 * @throws {Error} Si faltan recursos, el puerto está ocupado o no puede abrir SQLite.
 * Solo una instancia propia se cierra: reutilizar servidor no crea otro almacén.
 */
async function startDesktop({
  root = ROOT,
  dbPath = path.join(root, 'database', 'mibolsillo.sqlite'),
  port = 5500,
} = {}) {
  root = path.resolve(root);
  dbPath = path.resolve(dbPath);
  if (!Number.isInteger(port) || port < 0 || port > MAX_LOCAL_PORT) {
    throw new Error('Puerto local inválido.');
  }
  for (const file of [
    'index.html',
    'desktop.html',
    'mobile.html',
    'src/utils/desktop.js',
    'src/utils/mobile.js',
  ]) {
    if (!fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile()) {
      throw new Error('Falta un archivo de la aplicación HTML: ' + file);
    }
  }
  const identity = serverIdentity(root, dbPath);
  const attached = () => ({
    url: `http://127.0.0.1:${port}/`,
    database: dbPath,
    ownsServer: false,
    async close() {
      /* La instancia compartida pertenece a otro proceso. */
    },
  });
  if (await findExisting(port, identity)) return attached();
  const server = createServer({ root, dbPath, host: '127.0.0.1' });
  try {
    await new Promise((resolve, reject) => {
      const failed = (error) => {
        server.off('listening', resolve);
        reject(error);
      };
      server.once('error', failed);
      server.once('listening', () => {
        server.off('error', failed);
        resolve();
      });
      server.listen(port, '127.0.0.1');
    });
  } catch (error) {
    server.sqlite.store.close();
    if (error.code === 'EADDRINUSE' && (await findExisting(port, identity))) return attached();
    throw error;
  }
  let closed = false;
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    database: dbPath,
    ownsServer: true,
    server,
    async close() {
      if (closed) return;
      closed = true;
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    },
  };
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
      port: Number(process.env.MIBOLSILLO_PORT ?? 5500),
    });
    if (closing) return service.close();
    process.stdout.write(
      JSON.stringify({
        event: 'ready',
        url: service.url,
        database: service.database,
        ownsServer: service.ownsServer,
      }) + '\n',
    );
  })().catch((error) => {
    process.stdout.write(JSON.stringify({ event: 'error', message: error.message }) + '\n');
    process.exitCode = 1;
    process.stdin.pause();
  });
}

module.exports = { startDesktop, findExisting };
