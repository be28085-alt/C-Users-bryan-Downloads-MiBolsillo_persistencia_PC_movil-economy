'use strict';
const fs = require('node:fs');
const path = require('node:path');
/**
 * Registra solo un vocabulario cerrado: nunca cuerpos, cookies, identidades,
 * contraseñas, tokens ni errores originales. Cinco archivos de hasta 1 MiB.
 * Un fallo del registro no convierte un COMMIT financiero confirmado en fallo.
 * @param {string} directory Carpeta privada junto a la base, fuera de recursos web.
 * @param {object} options Retención y tamaño; solo configuración administrativa.
 * @returns {{write: Function, getHealth: Function}} Registro y diagnóstico local.
 * Los fallos se notifican una vez con un código fijo, sin errores originales.
 */
function createSecurityAudit(
  directory,
  { maxBytes = 1024 * 1024, files = 5, maxAgeMs = 7 * 86400000 } = {},
) {
  const target = path.join(directory, 'events.jsonl');
  let healthy = true,
    warned = false;
  function write({ event, requestId, status, route, method }) {
    try {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      for (let i = 1; i < files; i++) {
        const file = target + '.' + i;
        if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs > maxAgeMs) {
          fs.unlinkSync(file);
        }
      }
      if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isSymbolicLink()) throw new Error('audit-link');
        if (
          fs.statSync(target).size >= maxBytes ||
          Date.now() - fs.statSync(target).mtimeMs > maxAgeMs
        ) {
          for (let i = files - 1; i >= 1; i--) {
            const old = i === 1 ? target : target + '.' + (i - 1),
              next = target + '.' + i;
            if (fs.existsSync(next)) fs.unlinkSync(next);
            if (fs.existsSync(old)) fs.renameSync(old, next);
          }
        }
      }
      const value = {
        at: new Date().toISOString(),
        event: [
          'authentication',
          'logout',
          'password-change',
          'rejected',
          'write',
          'internal-error',
        ].includes(event)
          ? event
          : 'rejected',
        requestId: /^[a-f0-9-]{36}$/.test(requestId || '') ? requestId : undefined,
        status: Number.isInteger(status) ? status : 500,
        route: ['access', 'storage', 'backups', 'session', 'other'].includes(route)
          ? route
          : 'other',
        method: ['GET', 'POST', 'PATCH', 'HEAD', 'OPTIONS'].includes(method) ? method : 'OTHER',
      };
      fs.appendFileSync(target, JSON.stringify(value) + '\n', { mode: 0o600 });
      healthy = true;
    } catch {
      healthy = false;
      if (!warned) {
        console.error('security-audit-unavailable');
        warned = true;
      }
    }
  }
  return { write, getHealth: () => ({ healthy }) };
}
module.exports = { createSecurityAudit };
