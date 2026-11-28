'use strict';
/**
 * @typedef {object} StorageReceipt
 * @property {string} operationId Identificador opaco de la intención del cliente.
 * @property {string} requestHash Huella del contenido, ligada al scope del servidor.
 */
/**
 * Prepara metadatos aditivos de idempotencia sin reescribir estados financieros.
 * @param {import('node:sqlite').DatabaseSync} db Conexión privada del servidor.
 * @returns {void}
 */
function initializeReceipts(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS storage_receipts (
    scope TEXT NOT NULL, operation_id TEXT NOT NULL, request_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL, PRIMARY KEY(scope,operation_id))`);
}
/**
 * @param {import('node:sqlite').DatabaseSync} db Conexión con transacción activa al recordar.
 * @param {string} scope Propietario resuelto por el servidor.
 * @returns {object} Consulta y guardado acotado a 5000 huellas por propietario.
 * Los métodos propagan errores SQLite; al fallar remember el llamador debe
 * revertir la misma transacción que incluye el estado financiero.
 */
function receipts(db, scope) {
  return {
    /** Busca solo en el scope autenticado; no interpreta la huella como credencial. */
    get(id) {
      return db
        .prepare('SELECT request_hash FROM storage_receipts WHERE scope=? AND operation_id=?')
        .get(scope, id);
    },
    /**
     * @param {StorageReceipt|undefined} receipt Recibo opcional del PATCH confirmado.
     * @returns {void}
     * El llamador conserva su transacción abierta; aquí no hay COMMIT independiente.
     */
    remember(receipt) {
      if (!receipt) return;
      db.prepare(
        'INSERT INTO storage_receipts(scope,operation_id,request_hash,created_at) VALUES(?,?,?,?)',
      ).run(scope, receipt.operationId, receipt.requestHash, Date.now());
      db.prepare(
        'DELETE FROM storage_receipts WHERE scope=? AND rowid NOT IN (SELECT rowid FROM storage_receipts WHERE scope=? ORDER BY created_at DESC,rowid DESC LIMIT 5000)',
      ).run(scope, scope);
    },
  };
}
module.exports = { initializeReceipts, receipts };
