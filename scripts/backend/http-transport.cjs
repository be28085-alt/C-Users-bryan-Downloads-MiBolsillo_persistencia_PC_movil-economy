'use strict';
const MAX_BODY = 20 * 1024 * 1024;
const BODY_READ_TIMEOUT_MS = 15000;

/**
 * Envía la respuesta con los encabezados privados y la correlación existentes.
 * @param {import('node:http').ServerResponse} res Respuesta de la solicitud.
 * @param {number} status Código HTTP.
 * @param {*} value Cuerpo compatible con el tipo de contenido.
 * @param {string} type Tipo de contenido; JSON por defecto.
 * @returns {void}
 */
function send(res, status, value, type = 'application/json; charset=utf-8') {
  if (status >= 400 && type.startsWith('application/json')) {
    value = { ...value, requestId: res.getHeader('X-Request-Id') };
  }
  const body = type.startsWith('application/json') ? JSON.stringify(value) : value;
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
  });
  res.end(body);
}

/**
 * Lee JSON con límites de bytes y tiempo, sin registrar ni reflejar su contenido.
 * @param {import('node:http').IncomingMessage} req Solicitud a consumir.
 * @param {number} limit Techo de bytes administrado por la ruta.
 * @returns {Promise<unknown>} Cuerpo JSON; su validación corresponde al controlador.
 * @throws {Error} HTTP 400, 408 o 413 si la lectura no es admisible.
 */
function readJSON(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let length = 0;
    const chunks = [];
    let settled = false;
    const finish = (failure, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chunks.length = 0;
      if (failure) reject(failure);
      else resolve(value);
    };
    const timer = setTimeout(
      () => finish(Object.assign(new Error('Se agotó el tiempo de lectura.'), { status: 408 })),
      BODY_READ_TIMEOUT_MS,
    );
    timer.unref();
    if (Number(req.headers['content-length']) > limit) {
      req.resume();
      finish(Object.assign(new Error('Solicitud demasiado grande'), { status: 413 }));
      return;
    }
    req.on('data', (chunk) => {
      if (settled) return;
      length += chunk.length;
      if (length > limit) {
        return finish(Object.assign(new Error('Solicitud demasiado grande'), { status: 413 }));
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      try {
        finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        finish(Object.assign(new Error('JSON inválido'), { status: 400 }));
      }
    });
    req.on('error', () =>
      finish(Object.assign(new Error('No se pudo leer la solicitud.'), { status: 400 })),
    );
    req.on('aborted', () =>
      finish(Object.assign(new Error('Solicitud interrumpida.'), { status: 400 })),
    );
  });
}
module.exports = { send, readJSON };
