'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createPrivateSnapshot } = require('./private-files.cjs');

const FORMAT = 'MIBOLSILLO_ACCOUNT_BACKUP';
const DAY = 24 * 60 * 60 * 1000;
const fail = (status, message) => Object.assign(new Error(message), { status });
const digest = raw => createHash('sha256').update(raw).digest('hex');
const validId = id => typeof id === 'string' && /^\d{13}-[0-9a-f-]{36}$/.test(id);
const validRaw = raw => {
  if (typeof raw !== 'string') throw fail(400, 'La copia no contiene datos financieros.');
  let envelope;
  try { envelope = JSON.parse(raw); } catch (_) { throw fail(400, 'La copia contiene JSON inválido.'); }
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) throw fail(400, 'Formato de copia inválido.');
  return envelope;
};

function createBackupService({ db, dbPath, accounts, validateState, revisionOf, intervalMs = DAY,
  retention = 7, accountRetention = 30, directory = path.join(path.dirname(dbPath), 'backups') }) {
  directory = path.resolve(directory);
  const systemDirectory = path.join(directory, 'database');
  fs.mkdirSync(systemDirectory, { recursive: true, mode: 0o700 });
  db.exec('CREATE TABLE IF NOT EXISTS backup_meta (id INTEGER PRIMARY KEY CHECK(id=1), instance_id TEXT NOT NULL)');
  db.prepare('INSERT OR IGNORE INTO backup_meta(id,instance_id) VALUES(1,?)').run(randomUUID());
  const sourceDatabase = db.prepare('SELECT instance_id FROM backup_meta WHERE id=1').get().instance_id;
  let lastError = null;
  const accountDirectory = id => {
    if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) throw fail(403, 'Cuenta no válida.');
    return path.join(directory, 'accounts', String(id));
  };
  const atomicWrite = (filename, content) => {
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    const temporary = filename + '.tmp-' + randomUUID();
    try {
      fs.writeFileSync(temporary, content, { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, filename);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  };
  function prune(folder, suffix, count) {
    const files = fs.readdirSync(folder).filter(name => name.endsWith(suffix) && /^\d{13}-[0-9a-f-]{36}\./.test(name)).sort().reverse();
    for (const filename of files.slice(Math.max(1, count))) fs.unlinkSync(path.join(folder, filename));
  }
  function accountBackup(user, reason = 'manual', raw = accounts.scoped(user.id).get()) {
    validRaw(raw);
    const id = Date.now() + '-' + randomUUID();
    const backup = { format: FORMAT, version: 1, id, createdAt: new Date().toISOString(), reason,
      owner: { id: Number(user.id), email: user.email }, sourceDatabase, checksum: digest(raw), raw };
    const folder = accountDirectory(user.id);
    atomicWrite(path.join(folder, id + '.json'), JSON.stringify(backup));
    prune(folder, '.json', accountRetention);
    return backup;
  }
  function readBackup(userId, id) {
    if (!validId(id)) throw fail(400, 'Identificador de respaldo no válido.');
    try { return JSON.parse(fs.readFileSync(path.join(accountDirectory(userId), id + '.json'), 'utf8')); }
    catch (_) { throw fail(404, 'No se encontró ese respaldo de tu cuenta.'); }
  }
  function publicBackup(backup) { return { id: backup.id, createdAt: backup.createdAt, reason: backup.reason, bytes: Buffer.byteLength(backup.raw) }; }
  function list(userId) {
    const folder = accountDirectory(userId);
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder).filter(name => name.endsWith('.json') && validId(name.slice(0, -5)))
      .sort().reverse().map(name => { try { return publicBackup(readBackup(userId, name.slice(0, -5))); } catch (_) { return null; } }).filter(Boolean);
  }
  function createScheduledBackup(force = false) {
    const previous = fs.readdirSync(systemDirectory).filter(name => /^\d{13}-[0-9a-f-]{36}\.sqlite$/.test(name)).sort().at(-1);
    if (!force && previous && Date.now() - Number(previous.slice(0, 13)) < intervalMs) return false;
    const id = Date.now() + '-' + randomUUID(), filename = path.join(systemDirectory, id + '.sqlite');
    const temporary = filename + '.tmp';
    try {
      // VACUUM INTO creates a transactionally consistent snapshot, including WAL.
      createPrivateSnapshot(db, temporary);
      const check = new DatabaseSync(temporary, { readOnly: true });
      try { if (check.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw Error('La instantánea SQLite no superó la verificación.'); }
      finally { check.close(); }
      fs.renameSync(temporary, filename);
      prune(systemDirectory, '.sqlite', retention);
      if (accounts) for (const user of db.prepare('SELECT id,email FROM auth_users').all()) accountBackup(user, 'periodic');
      lastError = null;
      return true;
    } catch (error) { lastError = error.message; throw error; }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  function scheduled() {
    try { createScheduledBackup(); }
    catch (error) { console.error('No se pudo crear el respaldo local automático:', error.message); }
  }
  // Start on the next turn, after the server has finished opening its database.
  const initial = setImmediate(scheduled);
  const timer = setInterval(scheduled, Math.max(100, intervalMs));
  timer.unref();

  async function handle(req, res, { session, readJSON, send }) {
    const resource = new URL(req.url, 'http://localhost').pathname;
    if (!/^\/api\/backups(?:\/|$)/.test(resource)) return false;
    if (!session?.user || !accounts) { send(res, 401, { error: 'Inicia sesión para consultar tus respaldos.' }); return true; }
    try {
      const user = session.user;
      if (req.method !== 'GET' && req.headers['x-mibolsillo-token'] !== session.csrfToken) throw fail(403, 'Token de sesión no válido.');
      if (req.method === 'GET' && resource === '/api/backups') {
        send(res, 200, { backups: list(user.id), automaticIntervalHours: intervalMs / 3600000,
          automaticError: lastError ? 'No se pudo crear el respaldo automático más reciente. Puedes crear uno manual.' : null });
      } else if (req.method === 'POST' && resource === '/api/backups') {
        const created = accountBackup(user);
        send(res, 201, { backup: publicBackup(created) });
      } else if (req.method === 'POST' && resource === '/api/backups/restore') {
        const body = await readJSON(req);
        if (!body || body.confirm !== true || (Boolean(body.id) === Boolean(body.backup))) throw fail(400, 'Selecciona una copia y confirma que deseas reemplazar tus datos actuales.');
        const backup = body.id ? readBackup(user.id, body.id) : body.backup;
        if (!backup || backup.format !== FORMAT || backup.version !== 1 || typeof backup.raw !== 'string'
          || backup.checksum !== digest(backup.raw)) throw fail(400, 'La copia está dañada o no es un respaldo compatible.');
        const ownLocal = backup.sourceDatabase === sourceDatabase && Number(backup.owner?.id) === Number(user.id);
        const ownPortable = typeof backup.owner?.email === 'string' && backup.owner.email.toLowerCase() === user.email.toLowerCase();
        if (!ownLocal && !ownPortable) throw fail(403, 'La copia pertenece a otra cuenta.');
        const current = accounts.scoped(user.id).get();
        if (body.expectedRevision !== revisionOf(current)) throw fail(409, 'Tus datos cambiaron mientras revisabas la copia. Actualiza la lista y vuelve a intentarlo.');
        const candidate = validRaw(backup.raw), original = validRaw(current);
        // A finance restore never changes the login email, password or current identity.
        candidate.data.usuario = { ...candidate.data.usuario, nombre: original.data.usuario.nombre,
          email: original.data.usuario.email, iniciales: original.data.usuario.iniciales };
        validateState(candidate.data, null, { strict: true });
        const safety = accountBackup(user, 'before-restore', current);
        const raw = JSON.stringify({ ...candidate, updatedAt: new Date().toISOString(), updatedBy: 'backup-restore', revision: randomUUID() });
        const result = accounts.scoped(user.id).compareAndSet(current, raw);
        if (!result.ok) throw fail(409, 'Los datos cambiaron antes de restaurar. Se conservó una copia de seguridad; vuelve a revisar el estado actual.');
        send(res, 200, { ok: true, safetyBackup: publicBackup(safety), revision: revisionOf(raw) });
      } else if (req.method === 'GET' && resource.startsWith('/api/backups/')) {
        const backup = readBackup(user.id, resource.slice('/api/backups/'.length));
        res.setHeader('Content-Disposition', `attachment; filename="mibolsillo-respaldo-${backup.id}.json"`);
        send(res, 200, backup);
      } else send(res, 405, { error: 'Método no permitido.' });
    } catch (error) { send(res, error.status || 500, { error: error.status ? error.message : 'No se pudo completar el respaldo. Tus datos actuales se conservan.' }); }
    return true;
  }
  return { handle, close() { clearImmediate(initial); clearInterval(timer); }, createScheduledBackup, directory, list, accountBackup };
}
module.exports = { createBackupService, FORMAT };
