'use strict';

// Aplica parches al sobre candidato; no autoriza usuarios ni escribe en SQLite.
const { createHash } = require('node:crypto');
const MAX_OPERATIONS = 20000;
const MAX_PATH_DEPTH = 40;
const MAX_SPLICE_ITEMS = 20000;
const FORBIDDEN_PATH_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400, code: 'validation' });
};
const ownsField = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/**
 * Obtiene la revisión o la huella compatible de un sobre anterior sin revisión.
 * @param {string|null} raw Sobre serializado del repositorio, o ausencia de estado.
 * @returns {string|null} Revisión existente, huella de compatibilidad o null.
 * La huella identifica contenido; no autentica ni sustituye el recibo de operación.
 */
function revisionOf(raw) {
  if (raw === null) return null;
  try {
    const revision = JSON.parse(raw).revision;
    if (typeof revision === 'string' && revision) return revision;
  } catch {
    // La comparación también reconoce sobres antiguos sin JSON válido. El
    // candidato sigue pasando por validación antes de cualquier escritura.
  }
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * @typedef {object} StorageOperation
 * @property {'set'|'remove'|'splice'} op Operación incremental admitida.
 * @property {Array<string|number>} path Ruta propia del candidato, nunca un prototipo.
 * @property {*} [value] Valor obligatorio para set.
 * @property {number} [index] Posición inicial de splice.
 * @property {number} [deleteCount] Cantidad de elementos a retirar en splice.
 * @property {Array<*>} [items] Elementos a insertar en splice.
 */

/**
 * Construye un candidato conservando el orden de operaciones y validaciones.
 * @param {string|null} raw Sobre actual; null permite únicamente crear su raíz.
 * @param {StorageOperation[]} operations Cambios de una misma intención.
 * @returns {string} Sobre candidato; el llamador aún debe validarlo y autorizarlo.
 * @throws {Error} HTTP 400 ante rutas, operaciones o índices no admitidos.
 * Ningún error modifica el sobre serializado original ni confirma persistencia.
 */
function applyOperations(raw, operations) {
  if (!Array.isArray(operations) || operations.length > MAX_OPERATIONS) {
    fail('Lista de cambios inválida o demasiado extensa.');
  }
  let nextState = raw === null ? null : JSON.parse(raw);

  for (const operation of operations) {
    if (
      !operation ||
      !['set', 'remove', 'splice'].includes(operation.op) ||
      !Array.isArray(operation.path) ||
      operation.path.length > MAX_PATH_DEPTH
    ) {
      fail('Cambio incremental inválido.');
    }
    const pathParts = operation.path;
    if (
      pathParts.some(
        (key) =>
          !(typeof key === 'string' || Number.isSafeInteger(key)) ||
          FORBIDDEN_PATH_KEYS.has(String(key)),
      )
    ) {
      fail('Ruta de cambio no permitida.');
    }
    if (!pathParts.length) {
      if (operation.op !== 'set' || nextState !== null) {
        fail('No se puede reemplazar la raíz por un cambio incremental.');
      }
      nextState = operation.value;
      continue;
    }

    let parent = nextState;
    for (const key of pathParts.slice(0, -1)) {
      if (!parent || typeof parent !== 'object' || !ownsField(parent, key)) {
        fail('La ruta del cambio no existe.');
      }
      parent = parent[key];
    }
    if (!parent || typeof parent !== 'object') fail('La ruta del cambio no es un objeto.');
    const lastKey = pathParts.at(-1);
    if (
      Array.isArray(parent) &&
      (!/^\d+$/.test(String(lastKey)) || Number(lastKey) >= parent.length)
    ) {
      fail('Índice de cambio inválido.');
    }

    if (operation.op === 'set') {
      if (!ownsField(operation, 'value')) fail('Falta el valor del cambio.');
      parent[lastKey] = operation.value;
    } else if (operation.op === 'remove') {
      if (Array.isArray(parent)) fail('Use splice para eliminar elementos de una lista.');
      if (!ownsField(parent, lastKey)) fail('El campo eliminado no existe.');
      delete parent[lastKey];
    } else {
      const targetArray = parent[lastKey];
      const { index, deleteCount, items } = operation;
      if (
        !Array.isArray(targetArray) ||
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index > targetArray.length ||
        !Number.isSafeInteger(deleteCount) ||
        deleteCount < 0 ||
        deleteCount > targetArray.length - index ||
        !Array.isArray(items) ||
        items.length > MAX_SPLICE_ITEMS
      ) {
        fail('Modificación de lista inválida.');
      }
      targetArray.splice(index, deleteCount, ...items);
    }
  }
  return JSON.stringify(nextState);
}

module.exports = { revisionOf, applyOperations };
