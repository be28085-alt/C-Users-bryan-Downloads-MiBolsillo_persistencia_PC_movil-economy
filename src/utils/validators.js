/**
 * ============================================================================
 * VALIDATORS MODULE
 * Responsabilidad: Validación de montos, números, textos requeridos y entradas.
 * ============================================================================
 */
(function () {
  'use strict';

  const validators = {
    /**
     * Valida si un valor es un monto monetario estrictamente positivo y finito.
     * @param {*} valor - Valor a evaluar.
     * @returns {boolean} True si es número > 0.
     */
    esMontoValido(valor) {
      if (valor === null || valor === undefined || valor === '') return false;
      const num = Number(valor);
      return Number.isFinite(num) && num > 0;
    },

    /**
     * Convierte de forma segura una entrada a número, retornando fallback si no es válido.
     * @param {*} value - Valor de entrada.
     * @param {number} fallback - Valor por defecto.
     * @returns {number}
     */
    safeNumber(value, fallback = 0) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : Number(fallback);
    },

    /**
     * Limpia un string monetario y lo convierte a número flotante.
     * @param {string|number} value - Cadena con signos de pesos o separadores.
     * @param {number} fallback - Fallback numérico.
     * @returns {number}
     */
    parseMoney(value, fallback = 0) {
      if (value === null || value === undefined || value === '') {
        return Number(fallback) || 0;
      }
      const normalized = String(value)
        .replace(/[$.\s]/g, '')
        .replace(/,/g, '.')
        .trim();
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : Number(fallback) || 0;
    },

    /**
     * Normaliza y trimea un texto.
     * @param {*} value - Texto a limpiar.
     * @returns {string}
     */
    normalizeText(value) {
      if (typeof value !== 'string') return '';
      return value.trim();
    },

    /**
     * Valida que un objeto contenga campos obligatorios no vacíos.
     * @param {Object} data - Datos a validar.
     * @param {string[]} fields - Nombres de campos requeridos.
     * @returns {{ok: boolean, missing: string[]}}
     */
    validateRequiredFields(data, fields = []) {
      if (!data || typeof data !== 'object') {
        return { ok: false, missing: fields };
      }
      const missing = fields.filter(field => {
        const value = data[field];
        return value === null || value === undefined || String(value).trim() === '';
      });
      return {
        ok: missing.length === 0,
        missing
      };
    }
  };

  // Exportar en namespaces compatibles y globales
  window.FinanzasValidators = validators;
  window.esMontoValido = validators.esMontoValido;
})();
