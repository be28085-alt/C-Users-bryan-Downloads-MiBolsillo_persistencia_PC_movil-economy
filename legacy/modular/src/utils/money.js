(function () {
  const money = {
    formatCOP(value) {
      const numeric = Number(value) || 0;
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(numeric);
    },

    parseCOP(value) {
      if (value === null || value === undefined || value === '') return 0;
      const normalized = String(value).replace(/[$.\s]/g, '').replace(',', '.');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    },

    roundToCurrency(value) {
      return Math.round((Number(value) || 0) * 100) / 100;
    }
  };

  window.MiBolsilloUtils = window.MiBolsilloUtils || {};
  window.MiBolsilloUtils.money = money;
})();
