'use strict';
const path = require('node:path');
const { argon2, randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { validateFinancialState } = require('./financial-validation.cjs');
if (typeof argon2 !== 'function') throw new Error('El acceso por cuenta requiere Node.js 24.22 o posterior con Argon2id.');
const derive = promisify(argon2);
const PARAMETERS = Object.freeze({ memory: 65536, passes: 3, parallelism: 1, tagLength: 32 });
const COOKIE = 'mibolsillo_session';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const digest = value => createHash('sha256').update(value).digest('hex');
const error = (status, message) => Object.assign(new Error(message), { status });
let hashing = 0;
async function passwordHash(password, salt) {
  // Limit simultaneous memory-hard computations instead of allowing a burst
  // of login requests to exhaust the local application's memory.
  if (hashing >= 4) throw error(429, 'Hay varios accesos en curso. Espera un momento y reintenta.');
  hashing++;
  try { return await derive('argon2id', { ...PARAMETERS, message: Buffer.from(password), nonce: salt }); }
  finally { hashing--; }
}

function emptyState(user) {
  const data = {
    usuario: { nombre: user.nombre, email: user.email, iniciales: user.nombre.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase(), moneda: 'COP', alertasPresupuesto: true, recordatoriosDeudas: true, notificacionesEmail: false, temaOscuro: false },
    saldoOculto: false, saldoInicial: 0, presupuestoMensual: 0, limitesCategorias: {},
    periodoAnio: new Date().getFullYear(), periodoMes: new Date().getMonth(),
    moduloActivo: 'PERSONAL', negocioActivoId: 'neg-1',
    negocios: [{ id: 'neg-1', nombre: 'Mi negocio', tipo: '', descripcion: '', telefono: '', email: '', direccion: '', moneda: 'COP', estado: 'ACTIVO' }]
  };
  for (const key of ['movimientos','cuentas','metas','deudas','aportesMetas','abonosDeudas','productos','proveedores','clientes','ventas','compras','empleados','gastos','gastosNegocio','ingresosNegocio','pagosEmpleado','pagosVenta','pagosCompra','pagosGasto','movimientosInventario','formulas','producciones','devolucionesNegocio']) data[key] = [];
  return JSON.stringify({ version: 'FINANZAS_V2', updatedAt: new Date().toISOString(), revision: randomBytes(16).toString('hex'), data });
}

function openAccounts(db, filename) {
  let backupPath = null;
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version < 2) {
    // VACUUM INTO produces a consistent SQLite snapshot, including an active WAL.
    if (db.prepare('SELECT raw FROM app_state WHERE id=1').get()) {
      backupPath = path.join(path.dirname(filename), 'respaldo-antes-cuentas-' + Date.now() + '-' + randomBytes(4).toString('hex') + '.sqlite');
      db.prepare('VACUUM INTO ?').run(backupPath);
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS auth_users (
        id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, email TEXT COLLATE NOCASE NOT NULL UNIQUE,
        password_algorithm TEXT NOT NULL CHECK(password_algorithm='argon2id'), password_salt BLOB NOT NULL,
        password_hash BLOB NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES auth_users(id), csrf_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id);
        CREATE TABLE IF NOT EXISTS user_states (
        user_id INTEGER PRIMARY KEY REFERENCES auth_users(id), raw TEXT NOT NULL CHECK(json_valid(raw) AND json_type(raw,'$.data')='object'),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
        PRAGMA user_version=2;`);
      db.exec('COMMIT');
    } catch (failure) { db.exec('ROLLBACK'); throw failure; }
  }
  db.exec('PRAGMA foreign_keys=ON');
  db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(Date.now());
  const publicUser = row => ({ id: Number(row.id), nombre: row.nombre, email: row.email });
  const cookieFor = value => `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${value ? SESSION_SECONDS : 0}`;
  function sessionValues(user) {
    const token = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO auth_sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)').run(digest(token), user.id, csrfToken, Date.now() + SESSION_SECONDS * 1000);
    return { user, csrfToken, cookie: cookieFor(token) };
  }
  return {
    backupPath,
    async register({ nombre, email, password } = {}) {
      if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100) throw error(400, 'Escribe un nombre de 1 a 100 caracteres.');
      if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw error(400, 'Escribe un correo electrónico válido.');
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw error(400, 'La contraseña debe tener entre 8 y 128 caracteres.');
      nombre = nombre.trim(); email = email.trim().toLowerCase();
      if (db.prepare('SELECT id FROM auth_users WHERE email=?').get(email)) throw error(409, 'Ya existe una cuenta con ese correo.');
      const salt = randomBytes(32);
      const hash = await passwordHash(password, salt);
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = db.prepare("INSERT INTO auth_users(nombre,email,password_algorithm,password_salt,password_hash,created_at) VALUES(?,?,'argon2id',?,?,?)").run(nombre, email, salt, hash, Date.now());
        const user = { id: Number(result.lastInsertRowid), nombre, email };
        db.prepare('INSERT INTO user_states(user_id,raw) VALUES(?,?)').run(user.id, emptyState(user));
        const session = sessionValues(user);
        db.exec('COMMIT');
        return session;
      } catch (failure) {
        db.exec('ROLLBACK');
        if (failure.message.includes('UNIQUE')) throw error(409, 'Ya existe una cuenta con ese correo.');
        throw failure;
      }
    },
    async login({ email, password } = {}) {
      if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128) throw error(401, 'Correo o contraseña incorrectos.');
      const row = db.prepare('SELECT * FROM auth_users WHERE email=?').get(email.trim().toLowerCase());
      const salt = row ? Buffer.from(row.password_salt) : Buffer.alloc(32);
      const actual = await passwordHash(password, salt);
      if (!row || Buffer.from(row.password_hash).length !== actual.length || !timingSafeEqual(Buffer.from(row.password_hash), actual)) throw error(401, 'Correo o contraseña incorrectos.');
      db.exec('BEGIN IMMEDIATE');
      try { const session = sessionValues(publicUser(row)); db.exec('COMMIT'); return session; }
      catch (failure) { db.exec('ROLLBACK'); throw failure; }
    },
    session(req) {
      const cookies = String(req.headers.cookie || '').split(';').map(part => part.trim());
      const token = cookies.find(part => part.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
      if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
      const row = db.prepare('SELECT u.id,u.nombre,u.email,s.csrf_token,s.token_hash FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(digest(token), Date.now());
      return row ? { user: publicUser(row), csrfToken: row.csrf_token, tokenHash: row.token_hash } : null;
    },
    logout(session) { db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(session.tokenHash); return cookieFor(''); },
    scoped(userId) {
      return {
        get() { return db.prepare('SELECT raw FROM user_states WHERE user_id=?').get(userId)?.raw ?? null; },
        compareAndSet(expectedRaw, raw) {
          db.exec('BEGIN IMMEDIATE');
          try {
            const current = db.prepare('SELECT raw FROM user_states WHERE user_id=?').get(userId)?.raw ?? null;
            if (current !== expectedRaw) { db.exec('ROLLBACK'); return { ok: false, raw: current }; }
            validateFinancialState(JSON.parse(raw).data, current ? JSON.parse(current).data : null);
            // Profile and login identity are one transaction: a failed/duplicate
            // email must not leave either the financial state or capital changed.
            const before = current ? JSON.parse(current).data.usuario || {} : {};
            const after = JSON.parse(raw).data.usuario || {};
            const identity = db.prepare('SELECT nombre,email FROM auth_users WHERE id=?').get(userId);
            const nombre = after.nombre !== undefined && after.nombre !== before.nombre ? after.nombre : identity.nombre;
            const email = after.email !== undefined && after.email !== before.email ? after.email : identity.email;
            if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100
              || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw error(400, 'Revisa el nombre y el correo electrónico.');
            if (db.prepare('SELECT id FROM auth_users WHERE email=? AND id<>?').get(email.trim().toLowerCase(), userId)) throw error(400, 'Ya existe una cuenta con ese correo.');
            db.prepare('UPDATE auth_users SET nombre=?,email=? WHERE id=?').run(nombre.trim(), email.trim().toLowerCase(), userId);
            const result = db.prepare("UPDATE user_states SET raw=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=?").run(raw, userId);
            if (result.changes !== 1) throw error(409, 'No se pudo identificar el espacio del usuario.');
            db.exec('COMMIT'); return { ok: true };
          } catch (failure) { db.exec('ROLLBACK'); throw failure; }
        }
      };
    },
    legacyStatus() { return { available: Boolean(db.prepare('SELECT 1 FROM app_state WHERE id=1').get()) }; }
  };
}
module.exports = { openAccounts, emptyState, PARAMETERS };
