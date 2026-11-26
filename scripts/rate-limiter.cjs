'use strict';
const { randomBytes, createHmac } = require('node:crypto');
const { problem } = require('./security-policy.cjs');
/**
 * Combina límites temporales por identidad, origen, cuenta y proceso.
 * @param {object} policy Umbrales administrativos ya validados.
 * @param {Function} now Reloj inyectable para probar vencimientos sin esperas.
 * @returns {object} Contadores de ventana fija con claves HMAC efímeras.
 * @throws {Error} HTTP 429 al agotar una cuota, con retryAfter en segundos.
 * Los contadores no contienen correos ni IP legibles y se pierden al reiniciar.
 */
function createRateLimiter(policy, now = () => Date.now()) {
  const buckets = new Map(), key = randomBytes(32);
  const hash = value => createHmac('sha256', key).update(String(value)).digest('hex');
  function take(kind, subject, limit, windowMs = 5 * 60 * 1000) {
    const time = now();
    for (const [id, bucket] of buckets) if (bucket.until <= time) buckets.delete(id);
    const id = kind + ':' + hash(subject);
    let bucket = buckets.get(id);
    if (!bucket) {
      if (buckets.size >= policy.capacity + 100) throw Object.assign(problem(429, 'Demasiadas solicitudes. Espera unos minutos y reintenta.'), { retryAfter: 300 });
      bucket = { count: 0, until: time + windowMs }; buckets.set(id, bucket);
    }
    if (++bucket.count > limit) throw Object.assign(problem(429, 'Demasiadas solicitudes. Espera unos minutos y reintenta.'), { retryAfter: Math.max(1, Math.ceil((bucket.until - time) / 1000)) });
  }
  return {
    publicApi(client) { take('public-api', client, policy.publicApi, 60000); },
    authentication(client, email) {
      take('auth-global', 'process', policy.authGlobal);
      take('auth-ip', client, policy.authIp);
      take('auth-identity', typeof email === 'string' ? email.trim().toLowerCase() : '', policy.authIdentity);
    },
    authenticated(userId, write, backup) {
      take('api', userId, policy.api, 60000);
      if (write) take('write', userId, policy.writes, 60000);
      if (write && backup) take('backup', userId, policy.backups);
    },
    size() { return buckets.size; }
  };
}
module.exports = { createRateLimiter };
