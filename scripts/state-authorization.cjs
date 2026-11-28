'use strict';
const { problem } = require('./security-policy.cjs');
const { isDeepStrictEqual: same } = require('node:util');
const MAX_STATE_DEPTH = 45;
const editableProfile = new Set([
  'nombre',
  'email',
  'iniciales',
  'moneda',
  'alertasPresupuesto',
  'recordatoriosDeudas',
  'notificacionesEmail',
  'temaOscuro',
]);
const protectedKeys =
  /^(?:user_?id|owner_?id|propietario_?id|account_?id|role|roles|permissions|privileges|isAdmin|password|password_hash|password_salt|csrfToken|token)$/i;
const business = [
  'negocios',
  'productos',
  'clientes',
  'proveedores',
  'ventas',
  'compras',
  'ingresosNegocio',
  'gastosNegocio',
  'empleados',
  'pagosEmpleado',
  'pagosVenta',
  'pagosCompra',
  'pagosGasto',
  'movimientosInventario',
  'formulas',
  'producciones',
  'devolucionesNegocio',
  'facturacion',
  'businessLedger',
];
const emptyAggregates = {
  businessLedger: { version: 1, operations: [], audit: [], sequences: {} },
  facturacion: { version: 1, documents: [], operations: [], audit: [], refunds: [], sequences: {} },
};
/**
 * Autoriza el cambio completo dentro de la cuenta elegida por la sesión.
 * La API no puede crear privilegios ni trasladar registros entre propietarios.
 * @param {object} next Estado candidato.
 * @param {object|null} previous Estado ya confirmado.
 * @param {number} userId Propietario autenticado; nunca procede del cuerpo.
 * @throws {Error} HTTP 403 cuando se modifican campos reservados o privilegios.
 */
function authorizeState(next, previous, userId) {
  const before = previous?.usuario || {},
    after = next.usuario || {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (editableProfile.has(key)) continue;
    if (key === 'id' && after.id === userId && (before.id === undefined || before.id === userId)) {
      continue;
    }
    if (!same(before[key], after[key])) {
      throw problem(403, 'No se permite modificar la identidad ni los permisos de la cuenta.');
    }
  }
  const permitted = Array.isArray(before.facturacionNegocios)
    ? new Set(before.facturacionNegocios)
    : null;
  const identity = (item, index) =>
    String(
      item?.id ??
        (item?.key !== undefined
          ? `${item.businessId || item.negocioId || ''}:${item.key}`
          : index),
    );
  const businessIdOf = (record, collection) =>
    collection === 'negocios' ? record?.id : record?.negocioId || record?.businessId;
  function removal(value, collection, depth) {
    if (depth > MAX_STATE_DEPTH) throw problem(400, 'Los datos superan la profundidad permitida.');
    if (!permitted || !value || typeof value !== 'object') return;
    const id = businessIdOf(value, collection);
    if (id && !permitted.has(id)) {
      throw problem(403, 'No se puede eliminar un registro de otro negocio.');
    }
    for (const [key, child] of Object.entries(value)) {
      removal(child, Array.isArray(value) ? collection : key, depth + 1);
    }
  }
  function reserved(value, old, depth = 0, collection = '') {
    if (depth > MAX_STATE_DEPTH) throw problem(400, 'Los datos superan la profundidad permitida.');
    if (!value || typeof value !== 'object') {
      removal(old, collection, depth);
      return;
    }
    for (const key of ['negocioId', 'businessId']) {
      if (old?.[key] && value[key] !== old[key]) {
        throw problem(403, 'No se permite trasladar un registro a otro negocio.');
      }
    }
    const businessId = businessIdOf(value, collection);
    if (businessId && permitted && !permitted.has(businessId) && !same(value, old)) {
      throw problem(403, 'La operación pertenece a un negocio no autorizado.');
    }
    const oldById =
      Array.isArray(value) && Array.isArray(old)
        ? new Map(old.map((item, index) => [identity(item, index), item]))
        : null;
    if (permitted && Array.isArray(old)) {
      const retained = new Set((Array.isArray(value) ? value : []).map(identity));
      for (const [index, record] of old.entries()) {
        if (!retained.has(identity(record, index))) removal(record, collection, depth + 1);
      }
    }
    if (permitted && old && !Array.isArray(old)) {
      for (const key of Object.keys(old)) {
        if (!Object.hasOwn(value, key)) removal(old[key], key, depth + 1);
      }
    }
    if (permitted && collection === 'sequences') {
      for (const key of new Set([...Object.keys(old || {}), ...Object.keys(value)])) {
        if (!permitted.has(key.split(':')[0]) && !same(value[key], old?.[key])) {
          throw problem(403, 'El consecutivo pertenece a un negocio no autorizado.');
        }
      }
    }
    for (const [key, child] of Object.entries(value)) {
      const original = oldById ? oldById.get(identity(child, key)) : old?.[key];
      const auditRole =
        key === 'role' &&
        value.documentId &&
        value.action &&
        value.at &&
        ['PROPIETARIO_LOCAL', 'FACTURADOR', 'LECTOR'].includes(child);
      if (protectedKeys.test(key) && !auditRole && !same(child, original)) {
        throw problem(403, 'El estado contiene propiedades de seguridad no autorizadas.');
      }
      reserved(child, original, depth + 1, Array.isArray(value) ? collection : key);
    }
  }
  reserved(next, previous);
  // El primer uso puede añadir contenedores vacíos sin conceder una escritura financiera.
  const businessChanged = business.some(
    (key) =>
      !same(next[key], previous?.[key]) &&
      !(
        previous?.[key] === undefined &&
        emptyAggregates[key] &&
        same(next[key], emptyAggregates[key])
      ),
  );
  const role = before.facturacionRol ?? 'PROPIETARIO_LOCAL';
  if (
    businessChanged &&
    (!['PROPIETARIO_LOCAL', 'FACTURADOR', 'LECTOR'].includes(role) ||
      (before.facturacionNegocios !== undefined && !Array.isArray(before.facturacionNegocios)))
  ) {
    throw problem(403, 'La configuración de permisos requiere revisión administrativa.');
  }
  if (role === 'LECTOR' && businessChanged) {
    throw problem(403, 'La cuenta tiene acceso de lectura a Mi Negocio.');
  }
  if (
    permitted &&
    next.negocioActivoId !== previous?.negocioActivoId &&
    next.negocioActivoId &&
    !permitted.has(next.negocioActivoId)
  ) {
    throw problem(403, 'Negocio no autorizado.');
  }
}
/**
 * Conserva los metadatos reservados al restaurar un perfil portable.
 * @param {object} candidate Perfil de la copia, todavía no autorizado para guardar.
 * @param {object} current Perfil confirmado de la cuenta destinataria.
 * @returns {object} Perfil con ID y permisos actuales preservados.
 * @throws {Error} HTTP 403 si la copia pretende cambiar permisos reservados.
 * El servicio de restauración fija además nombre/correo antes de invocarlo.
 */
function restoredProfile(candidate, current) {
  const profile = { ...candidate };
  for (const [key, value] of Object.entries(current)) {
    if (!editableProfile.has(key)) {
      if (key !== 'id' && candidate[key] !== undefined && !same(candidate[key], value)) {
        throw problem(403, 'La copia no puede modificar los permisos de la cuenta.');
      }
      profile[key] = value;
    }
  }
  if (current.id === undefined) delete profile.id;
  return profile;
}
module.exports = { authorizeState, restoredProfile };
