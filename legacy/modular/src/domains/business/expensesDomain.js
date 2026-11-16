/**
 * ============================================================================
 * BUSINESS EXPENSES DOMAIN
 * Responsabilidad: Registro y clasificación de gastos operativos del negocio (Regla 7).
 * ============================================================================
 */
(function () {
  'use strict';

  const expensesDomain = {
    /**
     * Crea un gasto operativo empresarial debidamente clasificado.
     * @param {string} negocioId - Negocio activo.
     * @param {Object} datos - Detalle del gasto.
     * @returns {Object}
     */
    crearGastoNegocio(negocioId, datos = {}) {
      return {
        id: `gast-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        negocioId,
        categoria: (datos.categoria || 'Otros gastos operativos').trim(),
        monto: Math.max(Number(datos.monto) || 0, 0),
        fecha: datos.fecha || (window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0]),
        descripcion: (datos.descripcion || '').trim()
      };
    }
  };

  window.BusinessExpensesDomain = expensesDomain;
})();
