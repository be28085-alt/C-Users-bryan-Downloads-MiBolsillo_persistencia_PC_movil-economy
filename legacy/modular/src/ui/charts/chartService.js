/**
 * ============================================================================
 * CHART SERVICE
 * Responsabilidad: Configuración, renderizado y ciclo de vida de instancias de Chart.js.
 * ============================================================================
 */
(function () {
  'use strict';

  const chartService = {
    instances: {},

    /**
     * Destruye de forma segura una instancia existente de Chart.js antes de recrearla.
     * @param {string} key - Identificador único del gráfico.
     */
    destroyChart(key) {
      if (this.instances[key]) {
        try {
          this.instances[key].destroy();
        } catch (e) {
          // Ignorar error de destrucción
        }
        delete this.instances[key];
      }
    },

    /**
     * Obtiene el contexto 2D de un elemento canvas por su ID.
     * @param {string} canvasId - ID del elemento en el DOM.
     * @returns {CanvasRenderingContext2D|null}
     */
    getContext(canvasId) {
      const el = document.getElementById(canvasId);
      if (!el || typeof el.getContext !== 'function') return null;
      return el.getContext('2d');
    },

    /**
     * Registra y almacena una instancia activa.
     * @param {string} key - Clave del gráfico.
     * @param {Object} chart - Instancia Chart.js.
     */
    register(key, chart) {
      this.instances[key] = chart;
      return chart;
    }
  };

  window.FinanzasChartService = chartService;
})();
