/**
 * ============================================================================
 * FORMATTERS MODULE
 * Responsabilidad: Funciones de formateo monetario (COP), numérico y de texto.
 * ============================================================================
 */
(function () {
  'use strict';

  const formatters = {
    /**
     * Formatea un valor numérico a moneda colombiana (COP).
     * @param {number|string} valor - Valor numérico a formatear.
     * @param {boolean} incluirSigno - Si true, antepone '+' para positivos o '-' para negativos.
     * @returns {string} Texto formateado con separadores de miles y sufijo COP.
     */
    formatCOP(valor, incluirSigno = false) {
      const parsed = Number(valor);
      const num = Number.isFinite(parsed) ? parsed : 0;
      const formatted = num.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
      if (incluirSigno && num > 0) return `+${formatted} COP`;
      if (incluirSigno && num < 0) return `${formatted} COP`;
      return `${formatted} COP`;
    },

    /**
     * Formatea un número como porcentaje con decimales especificados.
     * @param {number|string} valor - Valor porcentual.
     * @param {number} decimales - Cantidad de decimales (por defecto 1).
     * @returns {string} Texto porcentual (ej: "42.1%").
     */
    formatPercent(valor, decimales = 1) {
      const parsed = Number(valor);
      const num = Number.isFinite(parsed) ? parsed : 0;
      return `${num.toFixed(decimales)}%`;
    },

    /**
     * Obtiene las iniciales en mayúsculas a partir de un nombre completo.
     * @param {string} nombre - Nombre del usuario.
     * @returns {string} 2 iniciales (ej: "Lucía Martín" -> "LM").
     */
    obtenerIniciales(nombre) {
      if (!nombre || typeof nombre !== 'string') return 'US';
      const partes = nombre.trim().split(/\s+/);
      if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
      return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    },

    /**
     * Configura el formateo y validación automática de inputs monetarios.
     * @param {HTMLElement|Document} root - Contenedor raíz donde buscar inputs.
     */
    configurarEntradasMonetarias(root = document) {
      if (!root || typeof root.querySelectorAll !== 'function') return;
      root.querySelectorAll('input[type="number"][data-money="true"]').forEach(input => {
        input.addEventListener('blur', () => {
          const val = parseFloat(input.value);
          if (!isNaN(val) && val >= 0) {
            input.value = val.toFixed(0);
          }
        });
      });
    }
  };

  // Exportar en namespaces compatibles y globales
  window.FinanzasFormatters = formatters;
  window.formatCOP = formatters.formatCOP;
  window.obtenerIniciales = formatters.obtenerIniciales;
  window.configurarEntradasMonetarias = formatters.configurarEntradasMonetarias;
})();
