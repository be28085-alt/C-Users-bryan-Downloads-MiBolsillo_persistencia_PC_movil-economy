'use strict';
// Cuentas, sesiones y estado por propietario comparten transacciones SQLite.
const path = require('node:path');
const { argon2, randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { validateFinancialState } = require('./financial-validation.cjs');
const { createPrivateSnapshot } = require('./private-files.cjs');
const { authorizeState } = require('./state-authorization.cjs');
const { initializeReceipts, receipts } = require('./storage-receipts.cjs');
const { SESSION_DEFAULTS } = require('./security-policy.cjs');
if (typeof argon2 !== 'function') {
  throw new Error('El acceso por cuenta requiere Node.js 24.22 o posterior con Argon2id.');
}
const deriveArgon2 = promisify(argon2);
const PARAMETERS = Object.freeze({ memory: 65536, passes: 3, parallelism: 1, tagLength: 32 });
const MAX_CONCURRENT_PASSWORD_HASHES = 4;
const MAX_ACTIVITY_CHECKPOINT_MS = 60000;
const COOKIE = 'mibolsillo_session';
const digest = (value) => createHash('sha256').update(value).digest('hex');
const error = (status, message) => Object.assign(new Error(message), { status });
let hashing = 0;
/**
 * @param {string} password Credencial recibida; nunca se registra ni se devuelve.
 * @param {Buffer} salt Sal aleatoria de esa credencial.
 * @returns {Promise<Buffer>} Derivación Argon2id con los parámetros vigentes.
 * @throws {Error} HTTP 429 si la concurrencia agotaría el presupuesto de memoria.
 */
async function passwordHash(password, salt) {
  // Limitar trabajos simultáneos evita que una ráfaga multiplique sin techo
  // la memoria reservada por Argon2; el contador siempre se libera en finally.
  if (hashing >= MAX_CONCURRENT_PASSWORD_HASHES) {
    throw error(429, 'Hay varios accesos en curso. Espera un momento y reintenta.');
  }
  hashing++;
  try {
    return await deriveArgon2('argon2id', {
      ...PARAMETERS,
      message: Buffer.from(password),
      nonce: salt,
    });
  } finally {
    hashing--;
  }
}

/**
 * @param {{nombre:string,email:string}} user Identidad pública de la cuenta nueva.
 * @returns {string} Sobre inicial sin operaciones financieras de demostración.
 */
function emptyState(user) {
  const data = {
    usuario: {
      nombre: user.nombre,
      email: user.email,
      iniciales: user.nombre
        .split(/\s+/)
        .slice(0, 2)
        .map((x) => x[0])
        .join('')
        .toUpperCase(),
      moneda: 'COP',
      alertasPresupuesto: true,
      recordatoriosDeudas: true,
      notificacionesEmail: false,
      temaOscuro: false,
    },
    saldoOculto: false,
    saldoInicial: 0,
    presupuestoMensual: 0,
    limitesCategorias: {},
    periodoAnio: new Date().getFullYear(),
    periodoMes: new Date().getMonth(),
    moduloActivo: 'PERSONAL',
    negocioActivoId: 'neg-1',
    negocios: [
      {
        id: 'neg-1',
        nombre: 'Mi negocio',
        tipo: '',
        descripcion: '',
        telefono: '',
        email: '',
        direccion: '',
        moneda: 'COP',
        estado: 'ACTIVO',
      },
    ],
  };
  for (const key of [
    'movimientos',
    'cuentas',
    'metas',
    'deudas',
    'aportesMetas',
    'abonosDeudas',
    'productos',
    'proveedores',
    'clientes',
    'ventas',
    'compras',
    'empleados',
    'gastos',
    'gastosNegocio',
    'ingresosNegocio',
    'pagosEmpleado',
    'pagosVenta',
    'pagosCompra',
    'pagosGasto',
    'movimientosInventario',
    'formulas',
    'producciones',
    'devolucionesNegocio',
  ]) {
    data[key] = [];
  }
  return JSON.stringify({
    version: 'FINANZAS_V2',
    updatedAt: new Date().toISOString(),
    revision: randomBytes(16).toString('hex'),
    data,
  });
}

/**
 * Prepara repositorios de cuenta y sesiones sin asignar datos legados al ingresar.
 * @param {import('node:sqlite').DatabaseSync} db Conexión privada del servidor.
 * @param {string} filename Ruta administrativa para la copia previa a cuentas.
 * @param {object} options Política validada por la composición del servidor.
 * @returns {object} Servicios de acceso, sesión y repositorio acotado por propietario.
 * @throws {Error} Si fallan preparación, derivación de credenciales o persistencia.
 * Las tablas aditivas no convierten la migración manual de datos en automática.
 */
function openAccounts(
  db,
  filename,
  {
    secureCookies = false,
    sessionSeconds = SESSION_DEFAULTS.sessionSeconds,
    idleMs = SESSION_DEFAULTS.idleMs,
    maxSessions = SESSION_DEFAULTS.maxSessions,
  } = {},
) {
  let backupPath = null;
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version < 2) {
    // VACUUM INTO conserva una instantánea consistente, incluso con WAL activo.
    if (db.prepare('SELECT raw FROM app_state WHERE id=1').get()) {
      backupPath = path.join(
        path.dirname(filename),
        'respaldo-antes-cuentas-' + Date.now() + '-' + randomBytes(4).toString('hex') + '.sqlite',
      );
      createPrivateSnapshot(db, backupPath);
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
    } catch (failure) {
      db.exec('ROLLBACK');
      throw failure;
    }
  }
  db.exec('PRAGMA foreign_keys=ON');
  initializeReceipts(db);
  // Tabla aditiva: no reescribe cuentas, hashes ni estados financieros previos.
  db.exec(`CREATE TABLE IF NOT EXISTS auth_session_activity (
    token_hash TEXT PRIMARY KEY REFERENCES auth_sessions(token_hash) ON DELETE CASCADE,
    last_seen INTEGER NOT NULL)`);
  db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(Date.now());
  const publicUser = (row) => ({ id: Number(row.id), nombre: row.nombre, email: row.email });
  const cookieFor = (value) =>
    `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict;${secureCookies ? ' Secure;' : ''} Max-Age=${value ? sessionSeconds : 0}`;
  function sessionValues(user) {
    const token = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    db.prepare(
      'DELETE FROM auth_sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM auth_sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT ?)',
    ).run(user.id, user.id, maxSessions - 1);
    db.prepare(
      'INSERT INTO auth_sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)',
    ).run(digest(token), user.id, csrfToken, Date.now() + sessionSeconds * 1000);
    db.prepare('INSERT INTO auth_session_activity(token_hash,last_seen) VALUES(?,?)').run(
      digest(token),
      Date.now(),
    );
    return { user, csrfToken, cookie: cookieFor(token) };
  }
  return {
    backupPath,
    /** Crea identidad, estado vacío y sesión en una transacción; no devuelve hashes. */
    async register({ nombre, email, password } = {}, { replaceToken } = {}) {
      if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100) {
        throw error(400, 'Escribe un nombre de 1 a 100 caracteres.');
      }
      if (
        typeof email !== 'string' ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ) {
        throw error(400, 'Escribe un correo electrónico válido.');
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        throw error(400, 'La contraseña debe tener entre 8 y 128 caracteres.');
      }
      nombre = nombre.trim();
      email = email.trim().toLowerCase();
      const salt = randomBytes(32);
      const hash = await passwordHash(password, salt);
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = db
          .prepare(
            "INSERT INTO auth_users(nombre,email,password_algorithm,password_salt,password_hash,created_at) VALUES(?,?,'argon2id',?,?,?)",
          )
          .run(nombre, email, salt, hash, Date.now());
        const user = { id: Number(result.lastInsertRowid), nombre, email };
        db.prepare('INSERT INTO user_states(user_id,raw) VALUES(?,?)').run(
          user.id,
          emptyState(user),
        );
        const session = sessionValues(user);
        if (replaceToken) {
          db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(replaceToken);
        }
        db.exec('COMMIT');
        return session;
      } catch (failure) {
        db.exec('ROLLBACK');
        if (failure.message.includes('UNIQUE')) {
          throw error(409, 'Ya existe una cuenta con ese correo.');
        }
        throw failure;
      }
    },
    /** Verifica la credencial vigente y rota la sesión del navegador al confirmar. */
    async login({ email, password } = {}, { replaceToken } = {}) {
      if (
        typeof email !== 'string' ||
        typeof password !== 'string' ||
        email.length > 254 ||
        password.length > 128
      ) {
        throw error(401, 'Correo o contraseña incorrectos.');
      }
      const row = db
        .prepare('SELECT * FROM auth_users WHERE email=?')
        .get(email.trim().toLowerCase());
      const salt = row ? Buffer.from(row.password_salt) : Buffer.alloc(32);
      const actual = await passwordHash(password, salt);
      if (
        !row ||
        Buffer.from(row.password_hash).length !== actual.length ||
        !timingSafeEqual(Buffer.from(row.password_hash), actual)
      ) {
        throw error(401, 'Correo o contraseña incorrectos.');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        // Revalidar dentro de la transacción evita aceptar un hash que cambió
        // mientras Argon2 estaba trabajando en otro hilo.
        const current = db
          .prepare('SELECT id,nombre,email,password_hash FROM auth_users WHERE id=?')
          .get(row.id);
        if (
          !current ||
          current.email !== email.trim().toLowerCase() ||
          !timingSafeEqual(Buffer.from(current.password_hash), Buffer.from(row.password_hash))
        ) {
          throw error(401, 'Correo o contraseña incorrectos.');
        }
        const session = sessionValues(publicUser(current));
        if (replaceToken) {
          db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(replaceToken);
        }
        db.exec('COMMIT');
        return session;
      } catch (failure) {
        db.exec('ROLLBACK');
        throw failure;
      }
    },
    /**
     * @param {import('node:http').IncomingMessage} req Portador de la cookie HttpOnly.
     * @returns {{user:object,csrfToken:string,tokenHash:string}|null} Contexto validado.
     * Solo actualiza actividad de sesión; nunca toca el estado financiero.
     */
    session(req) {
      const cookies = String(req.headers.cookie || '')
        .split(';')
        .map((part) => part.trim());
      const token = cookies.find((part) => part.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
      if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
      const row = db
        .prepare(
          'SELECT u.id,u.nombre,u.email,s.csrf_token,s.token_hash,a.last_seen FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id LEFT JOIN auth_session_activity a ON a.token_hash=s.token_hash WHERE s.token_hash=? AND s.expires_at>?',
        )
        .get(digest(token), Date.now());
      if (row && row.last_seen !== null && Date.now() - row.last_seen >= idleMs) {
        db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(row.token_hash);
        return null;
      }
      if (
        row &&
        (row.last_seen === null ||
          Date.now() - row.last_seen >= Math.min(MAX_ACTIVITY_CHECKPOINT_MS, idleMs / 4))
      ) {
        db.prepare(
          'INSERT INTO auth_session_activity(token_hash,last_seen) VALUES(?,?) ON CONFLICT(token_hash) DO UPDATE SET last_seen=excluded.last_seen',
        ).run(row.token_hash, Date.now());
      }
      return row
        ? { user: publicUser(row), csrfToken: row.csrf_token, tokenHash: row.token_hash }
        : null;
    },
    logout(session) {
      db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(session.tokenHash);
      return cookieFor('');
    },
    /**
     * Cambia la credencial verificada y revoca sesiones en una sola transacción.
     * @param {object} session Sesión validada por el servidor y vinculada a la cuenta.
     * @param {object} credentials Contraseña actual y frase nueva de 8 a 128 caracteres.
     * @returns {Promise<object>} Nueva sesión; nunca devuelve hashes ni contraseñas.
     * @throws {Error} Rechazo de validación, credencial, sesión o escritura SQLite.
     * El estado financiero no participa en esta operación.
     */
    async changePassword(session, { currentPassword, newPassword } = {}) {
      if (
        typeof currentPassword !== 'string' ||
        currentPassword.length > 128 ||
        typeof newPassword !== 'string' ||
        newPassword.length < 8 ||
        newPassword.length > 128
      ) {
        throw error(400, 'Revisa las contraseñas; la nueva debe tener entre 8 y 128 caracteres.');
      }
      const row = db.prepare('SELECT * FROM auth_users WHERE id=?').get(session.user.id);
      const actual = await passwordHash(currentPassword, Buffer.from(row.password_salt));
      if (!timingSafeEqual(Buffer.from(row.password_hash), actual)) {
        throw error(401, 'No se pudo verificar la contraseña actual.');
      }
      const salt = randomBytes(32),
        hash = await passwordHash(newPassword, salt);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (
          !db
            .prepare(
              'SELECT 1 FROM auth_sessions WHERE token_hash=? AND user_id=? AND expires_at>?',
            )
            .get(session.tokenHash, session.user.id, Date.now())
        ) {
          throw error(401, 'Inicia sesión de nuevo para continuar.');
        }
        const changed = db
          .prepare(
            'UPDATE auth_users SET password_salt=?,password_hash=? WHERE id=? AND password_hash=?',
          )
          .run(salt, hash, session.user.id, row.password_hash);
        if (changed.changes !== 1) {
          throw error(409, 'La credencial cambió. Inicia sesión de nuevo.');
        }
        db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(session.user.id);
        const result = sessionValues(
          publicUser(
            db.prepare('SELECT id,nombre,email FROM auth_users WHERE id=?').get(session.user.id),
          ),
        );
        db.exec('COMMIT');
        return result;
      } catch (failure) {
        db.exec('ROLLBACK');
        throw failure;
      }
    },
    /**
     * @param {number} userId Identidad del servidor, nunca elegida desde el cuerpo HTTP.
     * @returns {object} Puerto get/receipt/compareAndSet de una sola cuenta.
     */
    scoped(userId) {
      const operations = receipts(db, 'user:' + userId);
      return {
        receipt: (id) => operations.get(id),
        get() {
          return db.prepare('SELECT raw FROM user_states WHERE user_id=?').get(userId)?.raw ?? null;
        },
        compareAndSet(expectedRaw, raw, receipt) {
          db.exec('BEGIN IMMEDIATE');
          try {
            const current =
              db.prepare('SELECT raw FROM user_states WHERE user_id=?').get(userId)?.raw ?? null;
            if (current !== expectedRaw) {
              db.exec('ROLLBACK');
              return { ok: false, raw: current };
            }
            validateFinancialState(JSON.parse(raw).data, current ? JSON.parse(current).data : null);
            authorizeState(JSON.parse(raw).data, current ? JSON.parse(current).data : null, userId);
            // Perfil e identidad confirman juntos: un correo duplicado o una
            // escritura fallida no deben dejar cambios parciales en finanzas.
            const before = current ? JSON.parse(current).data.usuario || {} : {};
            const after = JSON.parse(raw).data.usuario || {};
            const identity = db
              .prepare('SELECT nombre,email FROM auth_users WHERE id=?')
              .get(userId);
            const nombre =
              after.nombre !== undefined && after.nombre !== before.nombre
                ? after.nombre
                : identity.nombre;
            const email =
              after.email !== undefined && after.email !== before.email
                ? after.email
                : identity.email;
            if (
              typeof nombre !== 'string' ||
              !nombre.trim() ||
              nombre.trim().length > 100 ||
              typeof email !== 'string' ||
              email.length > 254 ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
            ) {
              throw error(400, 'Revisa el nombre y el correo electrónico.');
            }
            if (
              db
                .prepare('SELECT id FROM auth_users WHERE email=? AND id<>?')
                .get(email.trim().toLowerCase(), userId)
            ) {
              throw error(400, 'Ya existe una cuenta con ese correo.');
            }
            db.prepare('UPDATE auth_users SET nombre=?,email=? WHERE id=?').run(
              nombre.trim(),
              email.trim().toLowerCase(),
              userId,
            );
            const result = db
              .prepare(
                "UPDATE user_states SET raw=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=?",
              )
              .run(raw, userId);
            if (result.changes !== 1) {
              throw error(409, 'No se pudo identificar el espacio del usuario.');
            }
            operations.remember(receipt);
            db.exec('COMMIT');
            return { ok: true };
          } catch (failure) {
            db.exec('ROLLBACK');
            throw failure;
          }
        },
      };
    },
    legacyStatus() {
      return { available: Boolean(db.prepare('SELECT 1 FROM app_state WHERE id=1').get()) };
    },
  };
}
module.exports = { openAccounts, emptyState, PARAMETERS };
