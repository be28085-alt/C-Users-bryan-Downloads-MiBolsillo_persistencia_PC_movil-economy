/**
 * ============================================================================
 * SHARED STORAGE MODULE
 * Responsabilidad: Persistencia SQLite local o del navegador, manejo de errores,
 * serialización segura y respaldo/restauración de datos.
 * ============================================================================
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'FINANZAS_ETAPA_DATA_V2';
  const STORAGE_VERSION = 'FINANZAS_V2';
  const ACCOUNT_ID = window.MiBolsilloSQLiteConfig?.user?.id;
  const SYNC_CHANNEL = 'mibolsillo-sync-v1' + (ACCOUNT_ID ? ':user-' + ACCOUNT_ID : '');
  const CLIENT_ID = (window.crypto && typeof window.crypto.randomUUID === 'function')
    ? window.crypto.randomUUID()
    : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let applyingRemoteState = false;
  let syncChannel = null;
  let expectedRaw = null;
  let pendingState = null;
  let readBlocked = false;
  let lastResult = { ok: true, status: 'ready' };
  let localRevision = 0;
  const backend = window.MiBolsilloSQLiteBackend || window.localStorage;
  const sqlite = Boolean(window.MiBolsilloSQLiteBackend);
  let refreshing = false;
  let writeQueue = Promise.resolve();
  let writes = 0;

  function readRaw() { return backend.getItem(STORAGE_KEY); }

  function report(ok, status, message) {
    lastResult = { ok, status, ...(message ? { message } : {}) };
    if (window.Finanzas) window.Finanzas.lastPersistence = { ...lastResult };
    if (typeof window.CustomEvent === 'function') {
      window.dispatchEvent(new window.CustomEvent('mibolsillo:persistence', { detail: lastResult }));
    }
    return ok;
  }

  try {
    if ('BroadcastChannel' in window) syncChannel = new BroadcastChannel(SYNC_CHANNEL);
  } catch (error) { syncChannel = null; }

  function clone(val) {
    if (val === null || val === undefined) return val;
    try {
      return JSON.parse(JSON.stringify(val));
    } catch (e) {
      return val;
    }
  }

  function ensureArray(value, fallback = []) {
    if (Array.isArray(value)) return value.slice();
    return Array.isArray(fallback) ? fallback.slice() : [];
  }

  function mergeState(base, incoming) {
    const fallback = clone(base || {});
    const source = clone(incoming || {});
    const merged = {
      ...fallback,
      ...source,
      usuario: {
        ...(fallback.usuario || {}),
        ...(source.usuario || {})
      },
      limitesCategorias: {
        ...(fallback.limitesCategorias || {}),
        ...(source.limitesCategorias || {})
      }
    };

    ['movimientos', 'metas', 'deudas', 'negocios', 'productos', 'proveedores', 'empleados', 'clientes', 'ventas', 'compras', 'gastos', 'cuentas', 'ingresosNegocio'].forEach((key) => {
      merged[key] = ensureArray(source[key], fallback[key]);
    });

    merged.version = source.version || fallback.version || STORAGE_VERSION;
    return merged;
  }

  function migrateLegacyState(state, fallback = {}) {
    const source = clone(state || {});
    const base = clone(fallback || {});
    const migrated = mergeState(base, source);

    if (typeof migrated.saldoInicial === 'undefined' && typeof migrated.capitalBase !== 'undefined') {
      migrated.saldoInicial = Number(migrated.capitalBase) || 0;
    }
    if (typeof migrated.moduloActivo === 'undefined') {
      migrated.moduloActivo = 'PERSONAL';
    }
    if (!migrated.usuario) migrated.usuario = {};
    migrated.usuario.nombre = migrated.usuario.nombre || 'Usuario';
    migrated.usuario.iniciales = migrated.usuario.iniciales || 'US';
    migrated.version = STORAGE_VERSION;
    return migrated;
  }

  const storageService = {
    getStorageKey() {
      return STORAGE_KEY;
    },

    getRawState() { return readRaw(); },
    getBackendInfo() {
      return sqlite ? backend.getInfo() : { mode: 'browser', database: 'localStorage', crossDevice: false };
    },

    loadState(defaultState) {
      const fallback = clone(defaultState || {});
      try {
        let raw = readRaw();
        expectedRaw = raw;
        // Solo importar automáticamente a una base vacía, conservando la copia
        // original del navegador. Nunca sustituir una base SQLite ya existente.
        if (sqlite && raw === null && window.MiBolsilloSQLiteConfig?.allowLegacyImport !== false) {
          raw = window.localStorage.getItem(STORAGE_KEY);
        }
        if (!raw) {
          const seeded = { ...fallback, version: fallback.version || STORAGE_VERSION };
          window.BusinessSchema?.migrate(seeded);
          this.saveState(seeded);
          return seeded;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || (parsed.data && (typeof parsed.data !== 'object' || Array.isArray(parsed.data)))) {
          readBlocked = true;
          report(false, 'read-error');
          return fallback;
        }

        // Compatibilidad con el formato envolvente que usa la versión de PC.
        const payload = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        let merged = mergeState(fallback, payload);
        if (window.MiBolsilloMigrations && typeof window.MiBolsilloMigrations.applyMigrations === 'function') {
          merged = window.MiBolsilloMigrations.applyMigrations(merged, fallback);
        } else {
          merged = migrateLegacyState(merged, fallback);
        }

        if (sqlite && expectedRaw === null) this.saveState(merged);
        else report(true, 'saved');
        return merged;
      } catch (err) {
        console.warn('No se pudo leer el almacenamiento; se bloquea la escritura:', err);
        readBlocked = true;
        report(false, 'read-error');
        return fallback;
      }
    },

    ready() { return writeQueue; },
    isSaving() { return writes > 0; },
    async refreshFromBackend() {
      await writeQueue;
      if (readBlocked || pendingState) return false;
      try {
        const raw = sqlite ? await backend.refresh() : readRaw();
        if (raw !== expectedRaw) {
          if (!raw) return report(false, 'conflict');
          applyIncomingState(JSON.parse(raw), true);
        }
        return true;
      } catch (error) { return report(false, error.code === 'conflict' ? 'conflict' : 'error', error.message); }
    },

    saveState(state, { keepPending = true } = {}) {
      if (sqlite) {
        const candidate = clone(state);
        const task = writeQueue.then(() => this.commitSQLite(candidate, keepPending));
        writeQueue = task.then(() => {}, () => {});
        return task;
      }
      if (!state || typeof state !== 'object') return false;
      if (keepPending) pendingState = clone(state);
      if (readBlocked) return report(false, 'read-error');
      try {
        // Evitar que una pestaña con una copia antigua sobrescriba cambios ajenos.
        if (readRaw() !== expectedRaw) return report(false, 'conflict');
        const normalized = mergeState({}, state);
        const envelope = {
          version: STORAGE_VERSION,
          updatedAt: new Date().toISOString(),
          updatedBy: CLIENT_ID,
          revision: `${CLIENT_ID}:${++localRevision}`,
          data: normalized
        };
        const serialized = JSON.stringify(envelope);
        backend.setItem(STORAGE_KEY, serialized, expectedRaw);
        if (readRaw() !== serialized) return report(false, 'conflict');
        expectedRaw = serialized;
        pendingState = null;
        if (!applyingRemoteState && syncChannel) {
          try { syncChannel.postMessage({ type: 'STATE_UPDATED', ...envelope }); } catch (error) {}
        }
        return report(true, 'saved');
      } catch (err) {
        console.error('Error al guardar en el almacenamiento:', err);
        return report(false, err.code === 'conflict' ? 'conflict' : 'error', err.message);
      }
    },

    async commitSQLite(state, keepPending) {
      if (!state || typeof state !== 'object') return false;
      if (keepPending) pendingState = clone(state);
      if (readBlocked) return report(false, 'read-error');
      writes++;
      report(false, 'saving');
      try {
        if (readRaw() !== expectedRaw) return report(false, 'conflict');
        const envelope = { version: STORAGE_VERSION, updatedAt: new Date().toISOString(), updatedBy: CLIENT_ID,
          revision: `${CLIENT_ID}:${++localRevision}`, data: mergeState({}, state) };
        const serialized = JSON.stringify(envelope);
        await backend.setItem(STORAGE_KEY, serialized, expectedRaw);
        expectedRaw = serialized;
        pendingState = null;
        if (syncChannel) { try { syncChannel.postMessage({ type: 'STATE_UPDATED', revision: envelope.revision }); } catch (_) {} }
        return report(true, 'saved');
      } catch (error) { return report(false, error.code === 'conflict' ? 'conflict' : 'error', error.message); }
      finally { writes--; }
    },

    getPersistenceStatus() { return { ...lastResult }; },
    hasPendingChanges() { return pendingState !== null; },
    retryPendingSave() { return pendingState ? this.saveState(pendingState) : lastResult.ok; },

    async resetState(defaultState) {
      const fresh = clone(defaultState || {});
      const normalized = { ...fresh, version: fresh.version || STORAGE_VERSION };
      if (!await this.saveState(normalized)) throw new Error('No se pudo guardar el restablecimiento.');
      return normalized;
    }
  };

  function applyIncomingState(raw, force = false) {
    if (!raw || typeof raw !== 'object' || !raw.data || typeof raw.data !== 'object') return;
    if (!force && raw.updatedBy === CLIENT_ID) return;
    if (pendingState || readBlocked) { report(false, 'conflict'); return; }
    // storage y BroadcastChannel pueden entregar eventos de una revisión antigua.
    try {
      const current = readRaw();
      const envelope = JSON.parse(current);
      if (envelope.updatedAt !== raw.updatedAt || envelope.updatedBy !== raw.updatedBy) return;
      if (envelope.revision && envelope.revision !== raw.revision) return;
      expectedRaw = current;
      report(true, 'saved');
    } catch (error) { return; }
    applyingRemoteState = true;
    try {
      const core = window.Finanzas;
      if (core && typeof core.normalizeState === 'function') {
        core.state = core.normalizeState(raw.data);
        if (typeof core.notify === 'function') core.notify();
        else if (typeof core.notifyListeners === 'function') core.notifyListeners();
      }
      if (window.MiBolsilloStore && typeof window.MiBolsilloStore.setState === 'function') {
        // El store conserva la misma fuente de verdad y no genera escrituras recursivas.
        window.MiBolsilloStore.state = clone(raw.data);
        window.MiBolsilloStore.notifyListeners?.();
      }
    } finally {
      applyingRemoteState = false;
    }
  }

  window.addEventListener('storage', (event) => {
    if (ACCOUNT_ID) return; // Browser legacy data has no authenticated owner.
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try { applyIncomingState(JSON.parse(event.newValue)); }
    catch (error) { console.warn('No se pudo sincronizar el estado recibido:', error); }
  });

  if (syncChannel) {
    syncChannel.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'STATE_UPDATED') {
        if (sqlite) storageService.refreshFromBackend();
        else applyIncomingState(event.data);
      }
    });
  }

  window.MiBolsilloSync = {
    clientId: CLIENT_ID,
    getStatus() { return { mode: sqlite ? 'sqlite-local-server' : 'same-origin-local', crossTab: true, crossDevice: false }; },
    applyIncomingState
  };

  window.FinanzasStorage = storageService;
  window.MiBolsilloStorage = storageService;

  // Actualizar cambios de otra ventana o de DB Browser al volver a la app.
  // No usar temporizadores que bloqueen la interfaz con lecturas síncronas.
  if (sqlite) window.addEventListener('focus', async () => {
    if (refreshing || readBlocked) return;
    refreshing = true;
    try {
      await storageService.refreshFromBackend();
    } catch (error) { report(false, 'error'); }
    finally { refreshing = false; }
  });
})();
