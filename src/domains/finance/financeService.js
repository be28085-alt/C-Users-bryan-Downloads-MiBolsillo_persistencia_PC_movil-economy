(function () {
  const financeService = {
    getTotalIncome(movements) {
      return (movements || [])
        .filter(item => item.tipo === 'INGRESO')
        .reduce((total, item) => total + Number(item.valor || 0), 0);
    },

    getTotalExpense(movements) {
      return (movements || [])
        .filter(item => item.tipo === 'GASTO')
        .reduce((total, item) => total + Number(item.valor || 0), 0);
    },

    getCashBalance(initialBalance, movements) {
      const income = this.getTotalIncome(movements);
      const expense = this.getTotalExpense(movements);
      return Number(initialBalance || 0) + income - expense;
    },

    getBudgetStatus(budget, movements) {
      const totalExpense = this.getTotalExpense(movements);
      const available = Number(budget || 0) - totalExpense;
      const consumed = Number(budget || 0) > 0 ? (totalExpense / Number(budget || 0)) * 100 : 0;

      return {
        limite: Number(budget || 0),
        gastado: totalExpense,
        disponible: available,
        porcentajeReal: Number(consumed.toFixed(1))
      };
    }
  };

  window.MiBolsilloFinance = window.MiBolsilloFinance || {};
  window.MiBolsilloFinance = Object.assign(window.MiBolsilloFinance, financeService);
})();
