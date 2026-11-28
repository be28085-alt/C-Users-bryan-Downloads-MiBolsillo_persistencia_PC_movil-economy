/**
 * ============================================================================
 * BUDGET DOMAIN (FINANZAS PERSONALES)
 * Responsabilidad: Gestión de presupuestos, límites por categoría y evaluación de alertas.
 * ============================================================================
 */
(function () {
  'use strict';

  const budgetDomain = {
    /** Identifica el período presupuestal sin depender de una vista ni del reloj. */
    clavePeriodo(anio, mes) {
      return String(anio) + '-' + String(mes + 1).padStart(2, '0');
    },

    /**
     * Proyecta un movimiento para las vistas previas de PC y móvil, sin guardarlo.
     * @param {object} datos Tipo, importe de entrada, saldo y límites confirmados.
     * @returns {object} Importes y alertas numéricas; el cliente decide cómo mostrarlos.
     * Conserva el tratamiento de entradas incompletas como cero y no redondea la
     * proyección: el redondeo y la validación del guardado siguen en sus servicios.
     */
    proyectarMovimiento({
      tipo,
      valor,
      saldoActual,
      presupuesto,
      gastoCategoria = 0,
      limiteCategoria = 0,
    }) {
      const entrada = Number(valor);
      const monto = Number.isFinite(entrada) && entrada > 0 ? entrada : 0;
      const esIngreso = tipo === 'INGRESO';
      return {
        monto,
        esIngreso,
        saldoActual,
        saldoProyectado: esIngreso ? saldoActual + monto : saldoActual - monto,
        impactoPresupuesto: presupuesto.limite > 0 ? (monto / presupuesto.limite) * 100 : 0,
        excedePresupuesto:
          !esIngreso && presupuesto.limite > 0 && presupuesto.gastado + monto > presupuesto.limite,
        excedeCategoria: !esIngreso && gastoCategoria + monto > limiteCategoria,
      };
    },

    /**
     * Calcula el estado de ejecución presupuestal global para un conjunto de gastos.
     * @param {number} limiteMensual - Presupuesto total asignado.
     * @param {Array} movimientosMes - Movimientos del mes.
     * @returns {{limite: number, gastado: number, restante: number, porcentaje: number, estado: string}}
     */
    calcularEstadoPresupuestoGlobal(limiteMensual = 0, movimientosMes = []) {
      const limite = Number(limiteMensual) || 0;
      let gastado = 0;
      (movimientosMes || []).forEach((m) => {
        if (m.tipo === 'GASTO') gastado += Number(m.valor) || 0;
      });

      gastado = Math.round((gastado + Number.EPSILON) * 100) / 100;
      const restante = Math.round((limite - gastado + Number.EPSILON) * 100) / 100;
      const porcentaje = limite > 0 ? (gastado / limite) * 100 : 0;
      let estado = limite > 0 ? 'NORMAL' : 'SIN_CONFIGURAR';
      if (limite > 0 && gastado > limite) estado = 'EXCEDIDO';
      else if (limite > 0 && gastado === limite) estado = 'AGOTADO';
      else if (porcentaje >= 80) estado = 'ALERTA';

      return {
        configurado: limite > 0,
        limite,
        gastado,
        restante,
        porcentaje,
        estado,
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

      (movimientosMes || []).forEach((m) => {
        if (m.tipo === 'GASTO') {
          const cat = m.categoria || 'Otros';
          gastosPorCat[cat] = (gastosPorCat[cat] || 0) + (Number(m.valor) || 0);
        }
      });

      const categorias = Object.keys(limites);
      return categorias.map((cat) => {
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
          excedido: gastado > limite,
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
          mensaje: `Has consumido el ${estadoPresupuesto.porcentaje.toFixed(1)}% de tu presupuesto asignado.`,
        });
      } else if (estadoPresupuesto && estadoPresupuesto.estado === 'ALERTA') {
        alertas.push({
          tipo: 'warning',
          icono: '⚠️',
          titulo: 'Presupuesto mensual cerca del límite',
          mensaje: `Has consumido el ${estadoPresupuesto.porcentaje.toFixed(1)}% de tu presupuesto asignado.`,
        });
      }

      desgloseCategorias.forEach((c) => {
        if (c.excedido) {
          alertas.push({
            tipo: 'danger',
            icono: '⚠️',
            titulo: `Límite superado en ${c.categoria}`,
            mensaje: `Gastado: $${c.gastado.toLocaleString('es-CO')} de un tope de $${c.limite.toLocaleString('es-CO')}.`,
          });
        }
      });

      return alertas;
    },
  };

  window.PersonalBudgetDomain = budgetDomain;
})();
