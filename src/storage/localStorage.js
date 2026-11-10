/**
 * ============================================================================
 * LOCAL STORAGE MODULE
 * Responsabilidad: Persistencia local robusta en el navegador, manejo de cuota,
 * serialización segura y respaldo/restauración de datos.
 * ============================================================================
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'FINANZAS_ETAPA_DATA_V2';
  const STORAGE_VERSION = 'FINANZAS_V2';
  const SYNC_CHANNEL = 'mibolsillo-sync-v1';
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

  function report(ok, status) {
    lastResult = { ok, status };
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

    loadState(defaultState) {
      const fallback = clone(defaultState || {});
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        expectedRaw = raw;
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

        report(true, 'saved');
        return merged;
      } catch (err) {
        console.warn('Advertencia al leer localStorage, cargando datos iniciales:', err);
        readBlocked = true;
        report(false, 'read-error');
        return fallback;
      }
    },

    saveState(state, { keepPending = true } = {}) {
      if (!state || typeof state !== 'object') return false;
      if (keepPending) pendingState = clone(state);
      if (readBlocked) return report(false, 'read-error');
      try {
        // Evitar que una pestaña con una copia antigua sobrescriba cambios ajenos.
        if (localStorage.getItem(STORAGE_KEY) !== expectedRaw) return report(false, 'conflict');
        const normalized = mergeState({}, state);
        const envelope = {
          version: STORAGE_VERSION,
          updatedAt: new Date().toISOString(),
          updatedBy: CLIENT_ID,
          revision: `${CLIENT_ID}:${++localRevision}`,
          data: normalized
        };
        const serialized = JSON.stringify(envelope);
        localStorage.setItem(STORAGE_KEY, serialized);
        if (localStorage.getItem(STORAGE_KEY) !== serialized) return report(false, 'conflict');
        expectedRaw = serialized;
        pendingState = null;
        if (!applyingRemoteState && syncChannel) {
          try { syncChannel.postMessage({ type: 'STATE_UPDATED', ...envelope }); } catch (error) {}
        }
        return report(true, 'saved');
      } catch (err) {
        console.error('Error al guardar en localStorage (posible límite de cuota):', err);
        return report(false, 'error');
      }
    },

    getPersistenceStatus() { return { ...lastResult }; },
    hasPendingChanges() { return pendingState !== null; },
    retryPendingSave() { return pendingState ? this.saveState(pendingState) : lastResult.ok; },

    resetState(defaultState) {
      const fresh = clone(defaultState || {});
      const normalized = { ...fresh, version: fresh.version || STORAGE_VERSION };
      this.saveState(normalized);
      return normalized;
    }
  };

  function applyIncomingState(raw) {
    if (!raw || typeof raw !== 'object' || !raw.data || typeof raw.data !== 'object') return;
    if (raw.updatedBy === CLIENT_ID) return;
    if (pendingState || readBlocked) { report(false, 'conflict'); return; }
    // storage y BroadcastChannel pueden entregar eventos de una revisión antigua.
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      const envelope = JSON.parse(current);
      if (envelope.updatedAt !== raw.updatedAt || envelope.updatedBy !== raw.updatedBy) return;
      if (envelope.revision && envelope.revision !== raw.revision) return;
      expectedRaw = current;
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
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try { applyIncomingState(JSON.parse(event.newValue)); }
    catch (error) { console.warn('No se pudo sincronizar el estado recibido:', error); }
  });

  if (syncChannel) {
    syncChannel.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'STATE_UPDATED') applyIncomingState(event.data);
    });
  }

  window.MiBolsilloSync = {
    clientId: CLIENT_ID,
    getStatus() { return { mode: 'same-origin-local', crossTab: true, crossDevice: false }; },
    applyIncomingState
  };

  window.FinanzasStorage = storageService;
  window.MiBolsilloStorage = storageService;
})();
