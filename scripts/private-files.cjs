'use strict';
const fs = require('node:fs');
const path = require('node:path');

/**
 * Reserva un archivo nuevo antes de escribir cualquier contenido privado.
 * @param {string} filename Ruta administrativa del archivo privado.
 * @returns {boolean} true si se creó; false si ya existía y se conservó.
 * @throws {Error} Si el sistema rechaza crear la carpeta o reservar el archivo.
 * Los modos POSIX no sustituyen la ACL NTFS heredada en Windows.
 */
function preparePrivateFile(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  let fileDescriptor;
  try {
    fileDescriptor = fs.openSync(filename, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  } finally {
    if (fileDescriptor !== undefined) fs.closeSync(fileDescriptor);
  }
  return true;
}

/**
 * @param {import('node:sqlite').DatabaseSync} db Conexión privada a respaldar.
 * @param {string} filename Destino nuevo, nunca una copia que deba reemplazarse.
 * @returns {void}
 * @throws {Error} Si existe el destino o SQLite no completa la instantánea.
 */
function createPrivateSnapshot(db, filename) {
  // VACUUM INTO admite un destino vacío. La reserva exclusiva evita crear la
  // instantánea con permisos derivados de una umask demasiado permisiva.
  if (!preparePrivateFile(filename)) {
    throw new Error('El destino del respaldo ya existe; se conservó sin cambios.');
  }
  try {
    db.prepare('VACUUM INTO ?').run(filename);
  } catch (error) {
    // Solo retirar el archivo incompleto recién reservado, no una copia anterior.
    fs.unlinkSync(filename);
    throw error;
  }
}

module.exports = { preparePrivateFile, createPrivateSnapshot };
