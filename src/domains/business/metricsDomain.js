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
      const ventas = (datasets.ventas || []).filter(v => v.negocioId === negocioId);
      const ingresosNegocio = (datasets.ingresosNegocio || []).filter(i => i.negocioId === negocioId);
      const gastos = (datasets.gastosNegocio || []).filter(g => g.negocioId === negocioId);
      const nomina = (datasets.pagosEmpleado || []).filter(p => p.negocioId === negocioId);
      const clientes = (datasets.clientes || []).filter(c => c.negocioId === negocioId);
      const productos = (datasets.productos || []).filter(p => p.negocioId === negocioId);

      const ahora = new Date();
      const mesActual = ahora.getMonth();
      const anioActual = ahora.getFullYear();

      const coincidePeriodo = (fechaStr) => {
        if (filtroPeriodo === 'TODOS') return true;
        const f = window.parseFechaLocal ? window.parseFechaLocal(fechaStr) : new Date(fechaStr);
        if (!f || isNaN(f.getTime())) return false;
        if (filtroPeriodo === 'MES_ACTUAL') {
          // Compatible tanto con el mes del reloj como con el mes demo (Octubre 2026)
          return (f.getFullYear() === anioActual && f.getMonth() === mesActual) || (f.getFullYear() === 2026 && f.getMonth() === 9);
        }
        if (filtroPeriodo === 'ANIO_ACTUAL') {
          return f.getFullYear() === anioActual || f.getFullYear() === 2026;
        }
        return true;
      };

      // 1. Total Ventas y COGS Real (Regla 9)
      let ventasTotales = 0;
      let costoProductosVendidos = 0;
      const ventasFiltradas = ventas.filter(v => coincidePeriodo(v.fecha));

      ventasFiltradas.forEach(v => {
        ventasTotales += Number(v.total) || 0;
        (v.detalles || []).forEach(d => {
          const cant = Number(d.cantidad) || 0;
          const costo = Number(d.costoUnitario) || 0;
          costoProductosVendidos += (cant * costo);
        });
        ingresosNegocio.filter(i => coincidePeriodo(i.fecha)).forEach(i => {
          ventasTotales += Number(i.monto) || 0;
        });
      });

      // 2. Gastos Operativos (Gastos negocio + Nómina de empleados)
      let totalGastosOperativos = 0;
      const gastosFiltrados = gastos.filter(g => coincidePeriodo(g.fecha));
      gastosFiltrados.forEach(g => {
        totalGastosOperativos += Number(g.monto) || 0;
      });

      const nominaFiltrada = nomina.filter(p => coincidePeriodo(p.fecha));
      nominaFiltrada.forEach(p => {
        totalGastosOperativos += Number(p.monto) || 0;
      });

      // 3. Utilidades y Márgenes
      const utilidadBruta = ventasTotales - costoProductosVendidos;
      const utilidadNeta = utilidadBruta - totalGastosOperativos;
      const margenBrutoPct = ventasTotales > 0 ? (utilidadBruta / ventasTotales) * 100 : 0;
      const margenNetoPct = ventasTotales > 0 ? (utilidadNeta / ventasTotales) * 100 : 0;

      // 4. Cartera (Cuentas por cobrar)
      let totalCuentasPorCobrar = 0;
      clientes.forEach(c => {
        totalCuentasPorCobrar += Number(c.saldoPendiente) || 0;
      });

      // 5. Inventario en Bodega
      let valorInventario = 0;
      let productosAlerta = 0;
      productos.forEach(p => {
        valorInventario += (Number(p.stock) || 0) * (Number(p.costoUnitario) || Number(p.precioCompra) || 0);
        if (Number(p.stock) <= Number(p.stockMinimo)) productosAlerta++;
      });

      return {
        ventasTotales,
        costoProductosVendidos,
        utilidadBruta,
        gastosOperativos: totalGastosOperativos,
        utilidadNeta,
        margenBrutoPct,
        margenNetoPct,
        cuentasPorCobrar: totalCuentasPorCobrar,
        valorInventario,
        productosAlerta,
        cantidadProductos: productos.length,
        cantidadVentas: ventasFiltradas.length
      };
    }
  };

  window.BusinessMetricsDomain = metricsDomain;
})();
