/**
 * ============================================================================
 * BUSINESS REPORTS VIEW
 * Responsabilidad: Estado de Resultados (P&L), Ingresos, COGS Real (Regla 9),
 * Gastos Operativos y Utilidad Neta consolidada.
 * ============================================================================
 */
(function () {
  'use strict';

  const businessReportsView = {
    render(finanzas, negActivo, filtroPeriodo = 'MES_ACTUAL') {
      if (!finanzas || !negActivo) return;

      const m = finanzas.calcularMetricasEmpresariales(negActivo.id, filtroPeriodo);

      const elVentas = document.getElementById('repVentasTotales');
      const elCosto = document.getElementById('repCostoVentas');
      const elBruta = document.getElementById('repUtilidadBruta');
      const elGastos = document.getElementById('repGastosOperativos');
      const elNeta = document.getElementById('repUtilidadNeta');
      const elMBruto = document.getElementById('repMargenBruto');
      const elMNeto = document.getElementById('repMargenNeto');

      if (elVentas) elVentas.textContent = window.formatCOP(m.ventasTotales);
      if (elCosto) elCosto.textContent = window.formatCOP(m.costoProductosVendidos);
      if (elBruta) elBruta.textContent = window.formatCOP(m.utilidadBruta);
      if (elGastos) elGastos.textContent = window.formatCOP(m.gastosOperativos);
      if (elNeta) {
        elNeta.textContent = window.formatCOP(m.utilidadNeta);
        elNeta.style.color = m.utilidadNeta >= 0 ? '#059669' : '#e11d48';
      }
      if (elMBruto) elMBruto.textContent = `${m.margenBrutoPct.toFixed(1)}%`;
      if (elMNeto) elMNeto.textContent = `${m.margenNetoPct.toFixed(1)}%`;
    }
  };

  window.BusinessReportsView = businessReportsView;
})();
