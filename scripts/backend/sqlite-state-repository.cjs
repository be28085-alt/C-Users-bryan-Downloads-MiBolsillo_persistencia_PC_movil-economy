'use strict';
const { DatabaseSync } = require('node:sqlite');
const { preparePrivateFile } = require('../private-files.cjs');
const { initializeReceipts, receipts } = require('../storage-receipts.cjs');
const { validEnvelope } = require('./state-envelope.cjs');
/**
 * Abre la conexión privada y el repositorio legado del estado serializado.
 * Las cuentas siguen usando su repositorio acotado a usuario en auth-store.
 * @param {string} filename Ruta administrativa; nunca procede del cuerpo HTTP.
 * @returns {object} Conexión y contrato get/compareAndSet/receipt/close existente.
 * @throws {Error} Si falla SQLite, la reserva privada o una versión incompatible.
 * El estado y el comprobante se confirman juntos; un conflicto no escribe nada.
 */
function openStore(filename) {
  preparePrivateFile(filename);
  const db = new DatabaseSync(filename);
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 2) {
    db.close();
    throw new Error('La base de datos pertenece a una versión más reciente de MiBolsillo');
  }
  initializeReceipts(db);
  const operations = receipts(db, 'legacy');
  db.exec(`PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      raw TEXT NOT NULL CHECK (json_valid(raw) AND json_type(raw, '$.data') IS 'object'),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    ${version === 0 ? 'PRAGMA user_version = 1;' : ''}`);
  // Las proyecciones de consulta conservan el esquema financiero existente.
  const collections = ['movimientos', 'metas', 'deudas', 'negocios', 'productos', 'proveedores',
    'empleados', 'clientes', 'ventas', 'compras', 'gastos', 'cuentas', 'ingresosNegocio',
    'gastosNegocio', 'pagosEmpleado', 'pagosVenta', 'pagosCompra', 'pagosGasto',
    'movimientosInventario', 'formulas', 'producciones', 'devolucionesNegocio'];
  const views = Object.fromEntries(collections.map(collection => [collection, collection]));
  for (const collection of ['documents', 'operations', 'audit', 'refunds']) {
    views[`facturacion_${collection}`] = `facturacion.${collection}`;
  }
  views.bitacora_operaciones = 'businessLedger.operations';
  views.bitacora_auditoria = 'businessLedger.audit';
  // Al reabrir solo se renuevan vistas; no se reescribe el JSON financiero.
  db.exec('BEGIN');
  try {
    for (const [name, jsonPath] of Object.entries(views)) {
      db.exec(`DROP VIEW IF EXISTS vista_${name};
        CREATE VIEW vista_${name} AS SELECT
          json_extract(item.value, '$.id') AS id,
          coalesce(json_extract(item.value, '$.nombre'), json_extract(item.value, '$.name'),
            json_extract(item.value, '$.customer.name')) AS nombre,
          coalesce(json_extract(item.value, '$.concepto'), json_extract(item.value, '$.descripcion'),
            json_extract(item.value, '$.description'), json_extract(item.value, '$.reason')) AS concepto,
          coalesce(json_extract(item.value, '$.fecha'), json_extract(item.value, '$.date'),
            json_extract(item.value, '$.at'), json_extract(item.value, '$.createdAt')) AS fecha,
          coalesce(json_extract(item.value, '$.tipo'), json_extract(item.value, '$.kind'),
            json_extract(item.value, '$.action')) AS tipo,
          coalesce(json_extract(item.value, '$.monto'), json_extract(item.value, '$.valor'),
            json_extract(item.value, '$.amount')) AS valor,
          coalesce(json_extract(item.value, '$.total'), json_extract(item.value, '$.totals.total'),
            json_extract(item.value, '$.costoTotal')) AS total,
          coalesce(json_extract(item.value, '$.negocioId'), json_extract(item.value, '$.businessId')) AS negocio_id,
          json_extract(item.value, '$.stock') AS stock,
          coalesce(json_extract(item.value, '$.estado'), json_extract(item.value, '$.status')) AS estado,
          item.value AS registro_json
        FROM app_state, json_each(app_state.raw, '$.data.${jsonPath}') AS item;`);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  const read = db.prepare('SELECT raw FROM app_state WHERE id = 1');
  const write = db.prepare(`INSERT INTO app_state (id, raw) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET raw=excluded.raw, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
  return {
    db,
    receipt: id => operations.get(id),
    get() { return read.get()?.raw ?? null; },
    compareAndSet(expectedRaw, raw, receipt) {
      if ((expectedRaw !== null && typeof expectedRaw !== 'string') || !validEnvelope(raw)) {
        throw new TypeError('Formato de estado inválido');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = read.get()?.raw ?? null;
        if (current !== expectedRaw) { db.exec('ROLLBACK'); return { ok: false, raw: current }; }
        write.run(raw);
        operations.remember(receipt);
        db.exec('COMMIT');
        return { ok: true };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { db.close(); }
  };
}
module.exports = { openStore };
