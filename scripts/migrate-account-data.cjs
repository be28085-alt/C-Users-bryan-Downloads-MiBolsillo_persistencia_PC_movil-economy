'use strict';
// Deliberate, local administrator migration. Never assigns old records on login.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
function migrateAccountData({ dbPath, email, sourceFile, apply = false, confirmOwner }) {
  const db = new DatabaseSync(path.resolve(dbPath), { readOnly: !apply });
  try {
    const user = db.prepare('SELECT id,email FROM auth_users WHERE email=?').get(String(email || '').trim().toLowerCase());
    if (!user) throw new Error('Crea primero la cuenta destinataria en MiBolsillo.');
    const raw = sourceFile ? fs.readFileSync(path.resolve(sourceFile), 'utf8') : db.prepare('SELECT raw FROM app_state WHERE id=1').get()?.raw;
    if (!raw) throw new Error('No hay datos anteriores para migrar.');
    const source = JSON.parse(raw);
    const data = source.data || source;
    if (typeof data.usuario?.email !== 'string' || data.usuario.email.trim().toLowerCase() !== user.email.toLowerCase())
      throw new Error('El correo del perfil anterior no identifica esta cuenta. No se asignó ningún registro.');
    for (const [key, values] of Object.entries(data)) if (Array.isArray(values)) {
      const ids = new Set();
      for (const item of values) if (item && typeof item === 'object' && item.id) {
        if (ids.has(item.id)) throw new Error('La copia contiene identificadores duplicados en ' + key + '.');
        ids.add(item.id);
      }
    }
    const fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const auditExists = db.prepare("SELECT 1 FROM sqlite_master WHERE name='account_imports'").get();
    if (auditExists && db.prepare('SELECT 1 FROM account_imports WHERE source_hash=?').get(fingerprint)) return { status: 'already-imported', changed: false };
    const current = JSON.parse(db.prepare('SELECT raw FROM user_states WHERE user_id=?').get(user.id).raw).data;
    const arrays = Object.keys(current).filter(key => Array.isArray(current[key]) && key !== 'negocios');
    const businesses = current.negocios || [];
    const customBusiness = businesses.length > 1 || businesses.some(business => business.nombre !== 'Mi negocio'
      || Object.entries(business).some(([key,value]) => !['id','nombre','moneda','estado'].includes(key) && value !== '' && value !== null && value !== undefined));
    const hasNestedRecords = value => value && typeof value === 'object' && Object.values(value).some(item =>
      Array.isArray(item) ? item.length > 0 : typeof item === 'object' && item !== null ? hasNestedRecords(item) : false);
    if (arrays.some(key => current[key].length) || customBusiness || hasNestedRecords(current.facturacion) || hasNestedRecords(current.businessLedger)
      || Number(current.saldoInicial || 0) !== 0 || Number(current.presupuestoMensual || 0) !== 0)
      throw new Error('La cuenta ya tiene datos. No se reemplazaron ni mezclaron registros.');
    if (!apply) return { status: 'preview', changed: false, collections: Object.keys(data).filter(key => Array.isArray(data[key])).length };
    if (String(confirmOwner || '').trim().toLowerCase() !== user.email.toLowerCase())
      throw new Error('Verifica la propiedad y proporciona --confirm-owner con el correo destinatario.');
    const backup = path.join(path.dirname(path.resolve(dbPath)), 'respaldo-antes-importar-' + Date.now() + '-' + randomBytes(4).toString('hex') + '.sqlite');
    db.prepare('VACUUM INTO ?').run(backup);
    const envelope = JSON.stringify({ ...source, version: 'FINANZAS_V2', data, revision: randomBytes(16).toString('hex'), updatedAt: new Date().toISOString() });
    db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
    try {
      // Recheck under the write lock, avoiding a race with a user operation.
      const latest = JSON.parse(db.prepare('SELECT raw FROM user_states WHERE user_id=?').get(user.id).raw).data;
      if (JSON.stringify(latest) !== JSON.stringify(current)) throw new Error('La cuenta cambió durante la migración. Revisa los datos y reintenta.');
      db.exec('CREATE TABLE IF NOT EXISTS account_imports (source_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES auth_users(id),imported_at TEXT NOT NULL)');
      db.prepare('UPDATE user_states SET raw=?,updated_at=? WHERE user_id=?').run(envelope, new Date().toISOString(), user.id);
      db.prepare('INSERT INTO account_imports VALUES(?,?,?)').run(fingerprint, user.id, new Date().toISOString());
      db.exec('COMMIT');
      return { status: 'imported', changed: true, backup };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } finally { db.close(); }
}
if (require.main === module) {
  try {
    const args = process.argv.slice(2), values = {};
    for (let i=0;i<args.length;i++) {
      if (args[i] === '--apply') values.apply = true;
      else if (['--db','--email','--source','--confirm-owner'].includes(args[i]) && args[i+1]) values[args[i++].slice(2)] = args[i];
      else throw new Error('Argumento inválido. Usa --db archivo --email correo [--source copia.json] [--apply --confirm-owner correo].');
    }
    if (!values.db || !values.email) throw new Error('Se requieren --db y --email. Sin --apply solo se comprueba la migración.');
    console.log(JSON.stringify(migrateAccountData({ dbPath: values.db, email: values.email, sourceFile: values.source, apply: values.apply, confirmOwner: values['confirm-owner'] }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { migrateAccountData };
