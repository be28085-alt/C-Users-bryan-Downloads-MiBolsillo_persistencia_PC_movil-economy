(function () {
  function ensureStore() {
    if (window.MiBolsilloStore && typeof window.MiBolsilloStore.getState === 'function') {
      return window.MiBolsilloStore;
    }

    if (!window.MiBolsilloStore) {
      window.MiBolsilloStore = {
        state: null,
        listeners: [],
        getState() { return this.state; },
        setState(value) {
          const next = value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : {};
          this.state = next;
          this.notifyListeners && this.notifyListeners();
          return this.state;
        },
        update(mutator) {
          const current = this.getState() || {};
          const nextState = typeof mutator === 'function' ? mutator(current) : mutator;
          return this.setState(nextState);
        },
        subscribe(listener) {
          if (typeof listener === 'function') this.listeners.push(listener);
          return () => {
            this.listeners = this.listeners.filter(item => item !== listener);
          };
        },
        notifyListeners() {
          this.listeners.forEach(listener => {
            try { listener(this.state); } catch (error) { console.error('Error en listener del store:', error); }
          });
        }
      };
    }
    return window.MiBolsilloStore;
  }

  const actions = {
    setState(nextState) {
      return ensureStore().setState(nextState);
    },

    updateState(mutator) {
      return ensureStore().update(mutator);
    },

    addMovement(movement) {
      const store = ensureStore();
      const nextState = store.getState ? store.getState() : {};
      const list = Array.isArray(nextState.movimientos) ? nextState.movimientos.slice() : [];
      list.unshift(movement);
      return store.setState({ ...nextState, movimientos: list });
    },

    removeMovement(movementId) {
      const store = ensureStore();
      const nextState = store.getState ? store.getState() : {};
      const list = (nextState.movimientos || []).filter(item => item.id !== movementId);
      return store.setState({ ...nextState, movimientos: list });
    },

    addMeta(meta) {
      const store = ensureStore();
      const nextState = store.getState ? store.getState() : {};
      const list = Array.isArray(nextState.metas) ? nextState.metas.slice() : [];
      list.push(meta);
      return store.setState({ ...nextState, metas: list });
    },

    addDebt(debt) {
      const store = ensureStore();
      const nextState = store.getState ? store.getState() : {};
      const list = Array.isArray(nextState.deudas) ? nextState.deudas.slice() : [];
      list.push(debt);
      return store.setState({ ...nextState, deudas: list });
    },

    updateProfile(profile) {
      const store = ensureStore();
      const nextState = store.getState ? store.getState() : {};
      return store.setState({
        ...nextState,
        usuario: {
          ...(nextState.usuario || {}),
          ...profile
        }
      });
    },

    setModulo(modulo) {
      const store = ensureStore();
      const nextState = store.getState ? store.getState() : {};
      return store.setState({
        ...nextState,
        moduloActivo: modulo === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PERSONAL'
      });
    }
  };

  window.MiBolsilloActions = window.MiBolsilloActions || {};
  window.MiBolsilloActions = Object.assign(window.MiBolsilloActions, actions);
})();
