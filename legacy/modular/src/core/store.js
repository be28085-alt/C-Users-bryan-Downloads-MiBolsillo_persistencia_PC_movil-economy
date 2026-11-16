(function () {
  function clone(value) {
    if (value === undefined || value === null) return value;
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {
        // Fall through to JSON clone
      }
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function normalizeSourceState(rawState, fallback = {}) {
    const source = rawState && typeof rawState === 'object' && !Array.isArray(rawState) ? rawState : {};
    const base = fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? fallback : {};

    const merged = {
      ...(clone(base) || {}),
      ...(clone(source) || {})
    };

    merged.usuario = {
      ...(clone(base.usuario) || {}),
      ...(clone(source.usuario) || {})
    };
    merged.limitesCategorias = {
      ...(clone(base.limitesCategorias) || {}),
      ...(clone(source.limitesCategorias) || {})
    };

    const ensureArray = (key) => {
      const value = merged[key];
      merged[key] = Array.isArray(value) ? value.slice() : (Array.isArray(base[key]) ? base[key].slice() : []);
    };

    ['movimientos', 'metas', 'deudas', 'negocios', 'productos', 'proveedores', 'empleados', 'clientes', 'ventas', 'compras', 'gastos', 'cuentas'].forEach(ensureArray);

    if (!merged.moduloActivo) merged.moduloActivo = 'PERSONAL';
    if (!merged.version) merged.version = 'FINANZAS_V2';
    return merged;
  }

  const store = {
    state: null,
    listeners: [],

    init(defaultState) {
      const baseState = defaultState && typeof defaultState === 'object' ? clone(defaultState) : {};
      const fallback = clone(baseState);
      const loaded = window.MiBolsilloStorage && typeof window.MiBolsilloStorage.loadState === 'function'
        ? window.MiBolsilloStorage.loadState(fallback)
        : fallback;
      this.state = normalizeSourceState(loaded || fallback, fallback);
      return this.state;
    },

    getState() {
      return this.state;
    },

    setState(nextState) {
      const baseState = this.getState() ? clone(this.getState()) : {};
      const sanitized = normalizeSourceState(nextState, baseState);
      this.state = clone(sanitized);
      if (window.MiBolsilloStorage && typeof window.MiBolsilloStorage.saveState === 'function') {
        this.lastPersistence = { ok: window.MiBolsilloStorage.saveState(this.state) };
      }
      this.notifyListeners();
      return this.state;
    },

    update(mutator) {
      const current = this.getState() ? clone(this.getState()) : {};
      const nextState = typeof mutator === 'function' ? mutator(current) : mutator;
      return this.setState(nextState);
    },

    subscribe(listener) {
      if (typeof listener === 'function') {
        this.listeners.push(listener);
      }
      return () => {
        this.listeners = this.listeners.filter(item => item !== listener);
      };
    },

    notifyListeners() {
      this.listeners.forEach(listener => {
        try {
          listener(this.state);
        } catch (error) {
          console.error('Error en listener del store:', error);
        }
      });
    },

    reset(defaultState) {
      const baseState = defaultState && typeof defaultState === 'object' ? clone(defaultState) : {};
      this.state = normalizeSourceState(baseState, baseState);
      if (window.MiBolsilloStorage && typeof window.MiBolsilloStorage.resetState === 'function') {
        window.MiBolsilloStorage.resetState(this.state);
      }
      this.notifyListeners();
      return this.state;
    }
  };

  window.MiBolsilloStore = window.MiBolsilloStore || {};
  window.MiBolsilloStore = Object.assign(window.MiBolsilloStore, store);
  window.MiBolsilloState = window.MiBolsilloStore;
})();
