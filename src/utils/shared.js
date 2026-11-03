/**
 * ============================================================================
 * SHARED MODULE (FAÇADE DE COMPATIBILIDAD)
 * Responsabilidad: Punto de entrada unificado y puente de compatibilidad retroactiva
 * para scripts legacy, versión móvil y pruebas.
 * ============================================================================
 */
(function () {
  'use strict';

  if (window.MiBolsilloApp && typeof window.MiBolsilloApp.ensureFinanzas === 'function') {
    window.MiBolsilloApp.ensureFinanzas();
  }

  // Garantizar que INITIAL_STATE y catálogos estén disponibles globalmente
  const seed = window.FinanzasSeed || {};
  const demo = window.FinanzasDemoData || {};

  window.CATEGORIAS_GASTO = window.CATEGORIAS_GASTO || seed.CATEGORIAS_GASTO || [];
  window.CATEGORIAS_INGRESO = window.CATEGORIAS_INGRESO || seed.CATEGORIAS_INGRESO || [];
  window.INITIAL_STATE = window.INITIAL_STATE || demo;

  // Re-exportar utilidades en el ámbito global para retrocompatibilidad total
  if (window.FinanzasFormatters) {
    window.formatCOP = window.FinanzasFormatters.formatCOP;
    window.obtenerIniciales = window.FinanzasFormatters.obtenerIniciales;
    window.configurarEntradasMonetarias = window.FinanzasFormatters.configurarEntradasMonetarias;
  }
  if (window.FinanzasDates) {
    window.parseFechaLocal = window.FinanzasDates.parseFechaLocal;
    window.obtenerAnioMesDeFecha = window.FinanzasDates.obtenerAnioMesDeFecha;
    window.esFechaISOValida = window.FinanzasDates.esFechaISOValida;
    window.formatearGrupoFecha = window.FinanzasDates.formatearGrupoFecha;
    window.obtenerMesCorto = window.FinanzasDates.obtenerMesCorto;
    window.obtenerFechaHoyISO = window.FinanzasDates.obtenerFechaHoyISO;
  }
  if (window.FinanzasSecurity) {
    window.escapeHTML = window.FinanzasSecurity.escapeHTML;
    window.escapeHTMLAttribute = window.FinanzasSecurity.escapeHTMLAttribute;
    window.escaparCSV = window.FinanzasSecurity.escaparCSV;
  }
  if (window.FinanzasValidators) {
    window.esMontoValido = window.FinanzasValidators.esMontoValido;
  }

  // Garantizar que la instancia Finanzas esté lista
  if (!window.Finanzas && window.FinanzasCore) {
    window.Finanzas = new window.FinanzasCore();
  }
})();
