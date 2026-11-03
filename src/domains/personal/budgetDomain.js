/**
 * ============================================================================
 * BUDGET DOMAIN (FINANZAS PERSONALES)
 * Responsabilidad: Gestión de presupuestos, límites por categoría y evaluación de alertas.
 * ============================================================================
 */
(function () {
  'use strict';

  const budgetDomain = {
    /**
     * Calcula el estado de ejecución presupuestal global para un conjunto de gastos.
     * @param {number} limiteMensual - Presupuesto total asignado.
     * @param {Array} movimientosMes - Movimientos del mes.
     * @returns {{limite: number, gastado: number, restante: number, porcentaje: number, estado: string}}
     */
    calcularEstadoPresupuestoGlobal(limiteMensual = 0, movimientosMes = []) {
      const limite = Number(limiteMensual) || 0;
      let gastado = 0;
      (movimientosMes || []).forEach(m => {
        if (m.tipo === 'GASTO') gastado += Number(m.valor) || 0;
      });

      const restante = limite - gastado;
      const porcentaje = limite > 0 ? (gastado / limite) * 100 : 0;
      let estado = 'NORMAL';
      if (porcentaje >= 100) estado = 'EXCEDIDO';
      else if (porcentaje >= 80) estado = 'ALERTA';

      return {
        limite,
        gastado,
        restante,
        porcentaje,
        estado
      };
    },

    /**
     * Calcula el consumo y balance para cada categoría con límite presupuestal.
     * @param {Object} limitesCategorias - Diccionario { [categoria]: limite }.
     * @param {Array} movimientosMes - Movimientos del mes.
     * @returns {Array<{categoria: string, limite: number, gastado: number, restante: number, porcentaje: number}>}
     */
    calcularDesgloseCategorias(limitesCategorias = {}, movimientosMes = []) {
      const limites = limitesCategorias || {};
      const gastosPorCat = {};

      (movimientosMes || []).forEach(m => {
        if (m.tipo === 'GASTO') {
          const cat = m.categoria || 'Otros';
          gastosPorCat[cat] = (gastosPorCat[cat] || 0) + (Number(m.valor) || 0);
        }
      });

      const categorias = Object.keys(limites);
      return categorias.map(cat => {
        const limite = Number(limites[cat]) || 0;
        const gastado = Number(gastosPorCat[cat]) || 0;
        const restante = limite - gastado;
        const porcentaje = limite > 0 ? (gastado / limite) * 100 : 0;
        return {
          categoria: cat,
          limite,
          gastado,
          restante,
          porcentaje: Math.min(porcentaje, 100),
          porcentajeReal: porcentaje,
          excedido: gastado > limite
        };
      });
    },

    /**
     * Evalúa las alertas del sistema (presupuesto excedido, advertencia al 80%).
     * @param {Object} estadoPresupuesto - Resultado de calcularEstadoPresupuestoGlobal.
     * @param {Array} desgloseCategorias - Desglose de categorías.
     * @param {boolean} alertasHabilitadas - Flag de configuración del usuario.
     * @returns {Array<{tipo: string, titulo: string, mensaje: string, icono: string}>}
     */
    evaluarAlertas(estadoPresupuesto, desgloseCategorias = [], alertasHabilitadas = true) {
      if (!alertasHabilitadas) return [];
      const alertas = [];

      if (estadoPresupuesto && estadoPresupuesto.estado === 'EXCEDIDO') {
        alertas.push({
          tipo: 'danger',
          icono: '🚨',
          titulo: 'Presupuesto mensual superado',
          mensaje: `Has sobrepasado tu límite global en un ${estadoPresupuesto.porcentaje.toFixed(1)}%.`
        });
      } else if (estadoPresupuesto && estadoPresupuesto.estado === 'ALERTA') {
        alertas.push({
          tipo: 'warning',
          icono: '⚠️',
          titulo: 'Presupuesto mensual cerca del límite',
          mensaje: `Has consumido el ${estadoPresupuesto.porcentaje.toFixed(1)}% de tu presupuesto asignado.`
        });
      }

      desgloseCategorias.forEach(c => {
        if (c.excedido) {
          alertas.push({
            tipo: 'danger',
            icono: '⚠️',
            titulo: `Límite superado en ${c.categoria}`,
            mensaje: `Gastado: $${c.gastado.toLocaleString('es-CO')} de un tope de $${c.limite.toLocaleString('es-CO')}.`
          });
        }
      });

      return alertas;
    }
  };

  window.PersonalBudgetDomain = budgetDomain;
})();
