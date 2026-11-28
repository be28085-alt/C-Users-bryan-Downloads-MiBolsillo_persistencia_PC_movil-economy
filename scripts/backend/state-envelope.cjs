'use strict';
/**
 * Comprueba el contenedor serializado del estado, sin interpretar sus finanzas.
 * Es compartido por el repositorio SQLite y el adaptador HTTP; no depende de ambos.
 * @param {unknown} raw Contenido recibido o leído del repositorio.
 * @returns {boolean} Si contiene un objeto data compatible con el contrato actual.
 */
function validEnvelope(raw) {
  if (typeof raw !== 'string' || !raw.length) return false;
  try {
    const value = JSON.parse(raw);
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value.data !== null &&
      typeof value.data === 'object' &&
      !Array.isArray(value.data)
    );
  } catch {
    // No reflejar el JSON recibido; la ruta devuelve el rechazo genérico de formato.
    return false;
  }
}
module.exports = { validEnvelope };
