(function () {
  function safeNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Number(fallback) || 0;
  }

  const selectors = {
    getMovements(state) {
      return Array.isArray(state && state.movimientos) ? state.movimientos : [];
    },

    getMovementByType(state, type) {
      return this.getMovements(state).filter(item => item.tipo === type);
    },

    getTotalIncome(state) {
      return this.getMovementByType(state, 'INGRESO').reduce((sum, item) => sum + safeNumber(item.valor), 0);
    },

    getTotalExpense(state) {
      return this.getMovementByType(state, 'GASTO').reduce((sum, item) => sum + safeNumber(item.valor), 0);
    },

    getCashBalance(state) {
      const initialBalance = safeNumber(state && state.saldoInicial, 0);
      return initialBalance + this.getTotalIncome(state) - this.getTotalExpense(state);
    },

    getBudgetStatus(state, budget = (state && state.presupuestoMensual) || 0) {
      const limit = safeNumber(budget, 0);
      const spent = this.getTotalExpense(state);
      const available = limit - spent;
      const percentage = limit > 0 ? (spent / limit) * 100 : 0;

      return {
        limite: limit,
        gastado: spent,
        disponible: available,
        porcentajeReal: Number(percentage.toFixed(1)),
        porcentaje: Math.min(100, Math.round(percentage))
      };
    },

    getActiveBusiness(state) {
      const businesses = Array.isArray(state && state.negocios) ? state.negocios : [];
      const activeId = state && state.negocioActivoId;
      return businesses.find(item => item.id === activeId) || businesses[0] || null;
    }
  };

  window.MiBolsilloSelectors = window.MiBolsilloSelectors || {};
  window.MiBolsilloSelectors = Object.assign(window.MiBolsilloSelectors, selectors);
})();
