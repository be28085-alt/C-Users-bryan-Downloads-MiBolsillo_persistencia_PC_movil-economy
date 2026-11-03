/**
 * ============================================================================
 * GOALS DOMAIN (FINANZAS PERSONALES)
 * Responsabilidad: Gestión de metas de ahorro, aportes y cálculo de porcentajes.
 * ============================================================================
 */
(function () {
  'use strict';

  const goalsDomain = {
    /**
     * Calcula métricas y porcentaje de cumplimiento para cada meta.
     * @param {Array} metas - Lista de metas de ahorro.
     * @returns {Array} Metas enriquecidas con porcentaje y restante.
     */
    enriquecerMetas(metas = []) {
      if (!Array.isArray(metas)) return [];
      return metas.map(meta => {
        const objetivo = Number(meta.montoObjetivo) || 0;
        const actual = Number(meta.montoActual) || 0;
        const restante = Math.max(objetivo - actual, 0);
        const porcentaje = objetivo > 0 ? (actual / objetivo) * 100 : 0;
        return {
          ...meta,
          restante,
          porcentaje: Math.min(porcentaje, 100),
          porcentajeReal: porcentaje,
          completada: actual >= objetivo
        };
      });
    },

    /**
     * Crea un aporte para una meta y actualiza su monto acumulado.
     * @param {Object} meta - Meta destino.
     * @param {number} monto - Monto a ingresar.
     * @param {string} nota - Comentario opcional.
     * @returns {{metaActualizada: Object, aporte: Object}}
     */
    registrarAporte(meta, monto, nota = '') {
      const valor = Math.abs(Number(monto) || 0);
      const nuevoActual = (Number(meta.montoActual) || 0) + valor;
      const aporte = {
        id: `ap-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        metaId: meta.id,
        monto: valor,
        fecha: window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0],
        nota: (nota || '').trim()
      };

      return {
        metaActualizada: {
          ...meta,
          montoActual: nuevoActual
        },
        aporte
      };
    }
  };

  window.PersonalGoalsDomain = goalsDomain;
})();
