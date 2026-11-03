/**
 * ============================================================================
 * SECURITY MODULE
 * Responsabilidad: Prevención de inyecciones XSS, sanitización de textos y CSV injection.
 * ============================================================================
 */
(function () {
  'use strict';

  const security = {
    /**
     * Escapa caracteres especiales en cadenas para prevenir inyecciones HTML (XSS).
     * @param {*} str - Texto a escapar.
     * @returns {string} Cadena sanitizada.
     */
    escapeHTML(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    /**
     * Escapa valores para uso seguro dentro de atributos HTML (value="", title="").
     * @param {*} value - Valor de atributo.
     * @returns {string} Cadena sanitizada.
     */
    escapeHTMLAttribute(value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },

    /**
     * Escapa campos para exportación CSV evitando inyecciones de fórmulas (=, +, -, @).
     * @param {*} valor - Celda a exportar.
     * @returns {string} Celda entrecomillada y protegida.
     */
    escaparCSV(valor) {
      if (valor === null || valor === undefined) return '""';
      let str = String(valor).replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str}"`;
    },

    /**
     * Asigna texto plano de forma segura a un nodo DOM.
     * @param {HTMLElement} node - Elemento DOM.
     * @param {*} text - Texto a insertar.
     */
    setText(node, text) {
      if (!node) return;
      node.textContent = text !== null && text !== undefined ? String(text) : '';
    }
  };

  // Exportar en namespaces compatibles y globales
  window.FinanzasSecurity = security;
  window.escapeHTML = security.escapeHTML;
  window.escapeHTMLAttribute = security.escapeHTMLAttribute;
  window.escaparCSV = security.escaparCSV;
})();
