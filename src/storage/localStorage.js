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

    ['movimientos', 'metas', 'deudas', 'negocios', 'productos', 'proveedores', 'empleados', 'clientes', 'ventas', 'compras', 'gastos', 'cuentas'].forEach((key) => {
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
        if (!raw) {
          const seeded = { ...fallback, version: fallback.version || STORAGE_VERSION };
          this.saveState(seeded);
          return seeded;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
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

        this.saveState(merged);
        return merged;
      } catch (err) {
        console.warn('Advertencia al leer localStorage, cargando datos iniciales:', err);
        return fallback;
      }
    },

    saveState(state) {
      if (!state || typeof state !== 'object') return false;
      try {
        const normalized = mergeState({}, state);
        const envelope = {
          version: STORAGE_VERSION,
          updatedAt: new Date().toISOString(),
          updatedBy: CLIENT_ID,
          data: normalized
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
        if (!applyingRemoteState && syncChannel) {
          try { syncChannel.postMessage({ type: 'STATE_UPDATED', ...envelope }); } catch (error) {}
        }
        return true;
      } catch (err) {
        console.error('Error al guardar en localStorage (posible límite de cuota):', err);
        return false;
      }
    },

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
