/**
 * ============================================================================
 * INVENTORY DOMAIN
 * Responsabilidad: Control de existencias, umbrales de alerta, valorización y Kardex.
 * ============================================================================
 */
(function () {
  'use strict';

  const inventoryDomain = {
    /**
     * Calcula la valorización total del stock en bodega y unidades acumuladas.
     * @param {Array} productos - Catálogo de items del negocio.
     * @returns {{valorTotal: number, unidadesTotales: number, enAlerta: number}}
     */
    calcularValorInventario(productos = []) {
      let valorTotal = 0;
      let unidadesTotales = 0;
      let enAlerta = 0;

      (productos || []).forEach(p => {
        const stock = Math.max(Number(p.stock) || 0, 0);
        const costo = Number(p.costoUnitario) || Number(p.precioCompra) || 0;
        const minimo = Number(p.stockMinimo) || 0;

        valorTotal += (stock * costo);
        unidadesTotales += stock;
        if (stock <= minimo) enAlerta++;
      });

      return {
        valorTotal,
        unidadesTotales,
        enAlerta
      };
    },

    /**
     * Obtiene los productos con existencias iguales o inferiores al stock mínimo de seguridad.
     * @param {Array} productos - Catálogo de items.
     * @returns {Array} Items en condición crítica.
     */
    getAlertasStockBajo(productos = []) {
      if (!Array.isArray(productos)) return [];
      return productos.filter(p => Number(p.stock) <= Number(p.stockMinimo));
    },

    /**
     * Genera una entrada de Kardex para registrar trazabilidad de inventario.
     * @param {string} negocioId - ID del negocio.
     * @param {Object} item - Producto o materia prima.
     * @param {string} tipo - 'ENTRADA' | 'SALIDA' | 'PRODUCCION' | 'AJUSTE'.
     * @param {number} cantidad - Cantidad afectada.
     * @param {number} stockAnterior - Existencia previa.
     * @param {number} stockPosterior - Existencia resultante.
     * @param {string} motivo - Descripción de la operación.
     * @returns {Object}
     */
    crearMovimientoKardex(negocioId, item, tipo, cantidad, stockAnterior, stockPosterior, motivo) {
      return {
        id: `mov-inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        negocioId,
        productoId: item.id,
        productoNombre: item.nombre,
        tipo,
        cantidad: Number(cantidad) || 0,
        stockAnterior: Number(stockAnterior) || 0,
        stockPosterior: Number(stockPosterior) || 0,
        motivo: (motivo || '').trim(),
        fecha: window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0]
      };
    }
  };

  window.BusinessInventoryDomain = inventoryDomain;
})();
