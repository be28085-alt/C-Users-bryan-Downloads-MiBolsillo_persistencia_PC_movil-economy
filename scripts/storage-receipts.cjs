'use strict';
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
 * @throws {Error} Si SQLite rechaza la escritura; el llamador debe hacer ROLLBACK.
 */
function receipts(db, scope) {
  return {
    get(id) { return db.prepare('SELECT request_hash FROM storage_receipts WHERE scope=? AND operation_id=?').get(scope, id); },
    remember(receipt) {
      if (!receipt) return;
      db.prepare('INSERT INTO storage_receipts(scope,operation_id,request_hash,created_at) VALUES(?,?,?,?)').run(scope, receipt.operationId, receipt.requestHash, Date.now());
      db.prepare('DELETE FROM storage_receipts WHERE scope=? AND rowid NOT IN (SELECT rowid FROM storage_receipts WHERE scope=? ORDER BY created_at DESC,rowid DESC LIMIT 5000)').run(scope, scope);
    }
  };
}
module.exports = { initializeReceipts, receipts };
