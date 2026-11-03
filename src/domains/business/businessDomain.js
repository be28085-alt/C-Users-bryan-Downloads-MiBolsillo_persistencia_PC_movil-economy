/**
 * ============================================================================
 * BUSINESS DOMAIN
 * Responsabilidad: Gestión de empresas/negocios registrados y conmutación de negocio activo.
 * ============================================================================
 */
(function () {
  'use strict';

  const businessDomain = {
    /**
     * Obtiene el negocio activo a partir del ID registrado.
     * @param {Array} negocios - Lista de negocios.
     * @param {string} activoId - ID del negocio activo.
     * @returns {Object|null}
     */
    getNegocioActivo(negocios = [], activoId = '') {
      if (!Array.isArray(negocios) || negocios.length === 0) return null;
      const found = negocios.find(n => n.id === activoId);
      return found || negocios[0];
    },

    /**
     * Crea un nuevo registro de negocio con validación.
     * @param {Object} datos - Datos del negocio.
     * @returns {Object}
     */
    crearNegocio(datos = {}) {
      return {
        id: `neg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        nombre: (datos.nombre || 'Nuevo Negocio').trim(),
        tipo: (datos.tipo || 'Comercio / Servicios').trim(),
        descripcion: (datos.descripcion || '').trim(),
        telefono: (datos.telefono || '').trim(),
        email: (datos.email || '').trim(),
        direccion: (datos.direccion || '').trim(),
        moneda: 'COP',
        estado: 'ACTIVO',
        fechaCreacion: window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0]
      };
    }
  };

  window.BusinessDomain = businessDomain;
})();
