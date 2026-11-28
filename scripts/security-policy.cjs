'use strict';
const net = require('node:net');
const { timingSafeEqual } = require('node:crypto');
const SESSION_DEFAULTS = Object.freeze({
  sessionSeconds: 12 * 60 * 60,
  idleMs: 30 * 60 * 1000,
  maxSessions: 50,
});

const problem = (status, message, code = 'security') =>
  Object.assign(new Error(message), { status, code });
/** Compara tokens sin aceptar conversiones de tipos ni tamaños arbitrarios. */
function sameToken(actual, expected) {
  return (
    typeof actual === 'string' &&
    typeof expected === 'string' &&
    actual.length === expected.length &&
    Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  );
}
/** Rechaza asignaciones no previstas; los nombres nunca se reflejan al cliente. */
function allowedFields(value, fields, status = 400) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !fields.includes(key))
  ) {
    throw problem(status, 'La solicitud contiene campos no permitidos.');
  }
}
/** Valida configuración administrativa sin aceptar conversiones implícitas de tipos. */
function positive(value, fallback, min, max) {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected < min || selected > max) {
    throw new Error('Configuración de seguridad inválida.');
  }
  return selected;
}
/**
 * Resuelve la política antes de abrir SQLite. Producción requiere un proxy TLS
 * explícito; los encabezados reenviados de clientes directos no dan confianza.
 * @param {object} options Configuración administrativa, nunca tomada de la API.
 * @param {string} host Dirección de escucha local.
 * @returns {object} Política validada.
 * @throws {Error} Si producción podría arrancar sin autenticación o sin TLS.
 */
function securityPolicy(options = {}, host = '127.0.0.1', requireAuth = true) {
  const mode =
    options.mode ||
    process.env.MIBOLSILLO_ENV ||
    (process.env.NODE_ENV === 'production' ? 'production' : 'local');
  if (!['local', 'development', 'test', 'production'].includes(mode)) {
    throw new Error('Entorno de seguridad inválido.');
  }
  const production = mode === 'production';
  let publicOrigin = null;
  const origin = options.publicOrigin || process.env.MIBOLSILLO_PUBLIC_ORIGIN;
  if (origin) {
    let url;
    try {
      url = new URL(origin);
    } catch {
      throw new Error('Origen público inválido.');
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error('El origen público debe ser HTTPS sin credenciales ni rutas.');
    }
    publicOrigin = url.origin;
  }
  const trustedProxies =
    options.trustedProxies ||
    (process.env.MIBOLSILLO_TRUSTED_PROXIES || '127.0.0.1,::1,::ffff:127.0.0.1')
      .split(',')
      .map((ip) => ip.trim());
  if (!Array.isArray(trustedProxies) || trustedProxies.some((ip) => !net.isIP(ip))) {
    throw new Error('Las direcciones de proxy deben ser IP explícitas.');
  }
  if (production && (!requireAuth || !publicOrigin || !['127.0.0.1', '::1'].includes(host))) {
    throw new Error(
      'Producción requiere autenticación, origen HTTPS y escucha en loopback detrás de un proxy autorizado.',
    );
  }
  const rates = {
    publicApi: 600,
    authIp: 60,
    authIdentity: 12,
    authGlobal: 1000,
    capacity: 1000,
    api: 1800,
    writes: 600,
    backups: 60,
  };
  allowedFields(options.rates || {}, Object.keys(rates));
  Object.assign(rates, options.rates);
  for (const value of Object.values(rates)) positive(value, 1, 1, 1000000);
  return Object.freeze({
    mode,
    production,
    publicOrigin,
    trustedProxies,
    sessionSeconds: positive(
      options.sessionSeconds,
      SESSION_DEFAULTS.sessionSeconds,
      60,
      30 * 86400,
    ),
    idleMs: positive(options.idleMs, SESSION_DEFAULTS.idleMs, 1000, 86400000),
    maxSessions: positive(options.maxSessions, SESSION_DEFAULTS.maxSessions, 1, 1000),
    maxStateBytes: positive(options.maxStateBytes, 32 * 1024 * 1024, 1024, 128 * 1024 * 1024),
    requestTimeoutMs: positive(options.requestTimeoutMs, 30000, 1000, 120000),
    rates: Object.freeze(rates),
  });
}
/** Devuelve el origen y cliente efectivos sin confiar en X-Forwarded-* arbitrario. */
function requestIdentity(req, address, hosts, policy) {
  const peer = req.socket.remoteAddress;
  if (policy.production) {
    const origin = new URL(policy.publicOrigin);
    if (
      !policy.trustedProxies.includes(peer) ||
      req.headers.host !== origin.host ||
      req.headers['x-forwarded-proto'] !== 'https'
    ) {
      throw problem(403, 'Canal de acceso no autorizado.');
    }
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && !net.isIP(forwarded)) throw problem(400, 'Encabezado de cliente inválido.');
    return { url: new URL(req.url, origin), client: forwarded || peer };
  }
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host}`);
  } catch {
    throw problem(400, 'Host inválido.');
  }
  if (!hosts.has(url.hostname) || Number(url.port || 80) !== address.port) {
    throw problem(403, 'Host no autorizado.');
  }
  return { url, client: peer };
}
module.exports = {
  securityPolicy,
  requestIdentity,
  allowedFields,
  sameToken,
  problem,
  SESSION_DEFAULTS,
};
