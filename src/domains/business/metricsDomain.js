/**
 * ============================================================================
 * BUSINESS METRICS & P&L DOMAIN
 * Responsabilidad: Estado de Resultados (P&L), Utilidad Bruta, COGS Real (Regla 9)
 * y Utilidad Neta consolidada.
 * ============================================================================
 */
(function () {
  'use strict';

  const metricsDomain = {
    /**
     * Calcula el estado de resultados y métricas financieras de un negocio para un período dado.
     * @param {string} negocioId - Negocio evaluado.
     * @param {Object} datasets - Colecciones de datos (ventas, gastos, empleadosPagos, clientes, productos).
     * @param {string} filtroPeriodo - 'MES_ACTUAL' | 'ANIO_ACTUAL' | 'TODOS'.
     * @returns {Object} Resumen financiero completo.
     */
    calcularMetricasEmpresariales(negocioId, datasets = {}, filtroPeriodo = 'MES_ACTUAL') {
      const D = window.BusinessReportsDomain;
      const r = D.build(datasets, negocioId, { period: filtroPeriodo });
      const products = (datasets.productos || []).filter(p => p.negocioId === negocioId && p.estado !== 'ARCHIVADO');
      const inventory = products.reduce((sum, p) => sum + D.product(p.stock || 0, p.costoUnitario ?? p.precioCompra ?? 0), 0n);
      const payable = [...(datasets.compras || []), ...(datasets.gastosNegocio || [])].filter(p => p.negocioId === negocioId && p.estado !== 'ANULADA').reduce((sum, p) => sum + D.cents(p.saldoPendiente || 0), 0n);
      const t = r.totals;
      return { ventasTotales: Number(t.sales), costoProductosVendidos: Number(t.cogs), utilidadBruta: Number(t.grossProfit), gastosOperativos: Number(t.operatingExpenses), utilidadNeta: Number(t.netProfit), margenBrutoPct: Number(t.sales) > 0 ? Number(t.grossProfit) / Number(t.sales) * 100 : 0, margenNetoPct: t.margin, cuentasPorCobrar: Number(r.receivables), cuentasPorPagar: Number(D.decimal(payable)), valorInventario: Number(D.decimal(inventory)), productosAlerta: products.filter(p => Number(p.stock) <= Number(p.stockMinimo || 0)).length, cantidadProductos: products.length, cantidadVentas: t.salesCount };
    }
  };

  window.BusinessMetricsDomain = metricsDomain;
})();
