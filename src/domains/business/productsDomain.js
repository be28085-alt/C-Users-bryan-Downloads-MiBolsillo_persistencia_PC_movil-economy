/**
 * ============================================================================
 * PRODUCTS DOMAIN
 * Responsabilidad: Catálogo de productos terminados, materias primas, costos y márgenes.
 * ============================================================================
 */
(function () {
  'use strict';

  const productsDomain = {
    /**
     * Filtra los productos de un negocio por tipo (ALL, PRODUCTO, MATERIA_PRIMA).
     * @param {Array} productos - Catálogo general de productos.
     * @param {string} negocioId - ID del negocio.
     * @param {string} filtroTipo - Tipo de item.
     * @returns {Array}
     */
    getProductos(productos = [], negocioId = '', filtroTipo = 'ALL') {
      if (!Array.isArray(productos)) return [];
      return productos.filter(p => {
        if (p.negocioId !== negocioId) return false;
        if (p.estado === 'ARCHIVADO') return false;
        if (filtroTipo === 'ALL') return true;
        return p.tipo === filtroTipo;
      });
    },

    /**
     * Calcula el margen unitario estimado en pesos y en porcentaje.
     * @param {number} precioVenta - Precio de venta final.
     * @param {number} costoUnitario - Costo de fabricación o compra.
     * @returns {{margenDinero: number, margenPorcentaje: number}}
     */
    calcularMargen(precioVenta = 0, costoUnitario = 0) {
      const pv = Number(precioVenta) || 0;
      const cu = Number(costoUnitario) || 0;
      const margenDinero = pv - cu;
      const margenPorcentaje = pv > 0 ? (margenDinero / pv) * 100 : 0;
      return {
        margenDinero,
        margenPorcentaje
      };
    },

    /**
     * Crea un nuevo registro de producto o materia prima.
     * @param {string} negocioId - ID del negocio propietario.
     * @param {Object} datos - Atributos del producto.
     * @returns {Object}
     */
    crearProducto(negocioId, datos = {}) {
      const tipo = datos.tipo === 'MATERIA_PRIMA' ? 'MATERIA_PRIMA' : 'PRODUCTO';
      const prefix = tipo === 'MATERIA_PRIMA' ? 'prod-mp' : 'prod-pt';
      const precioVenta = tipo === 'PRODUCTO' ? Math.max(Number(datos.precioVenta) || 0, 0) : 0;
      const costoUnitario = Math.max(Number(datos.costoUnitario) || Number(datos.precioCompra) || 0, 0);

      return {
        id: `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        negocioId,
        tipo,
        nombre: (datos.nombre || '').trim(),
        descripcion: (datos.descripcion || '').trim(),
        precioCompra: Math.max(Number(datos.precioCompra) || 0, 0),
        precioVenta,
        costoUnitario,
        unidadMedida: (datos.unidadMedida || 'unidades').trim(),
        stock: Math.max(Number(datos.stock) || 0, 0),
        stockMinimo: Math.max(Number(datos.stockMinimo) || 0, 0),
        estado: 'DISPONIBLE'
      };
    }
  };

  window.BusinessProductsDomain = productsDomain;
})();
