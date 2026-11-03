/**
 * ============================================================================
 * PURCHASES DOMAIN
 * Responsabilidad: Órdenes de compra a proveedores y actualización de inventario (Regla 1).
 * ============================================================================
 */
(function () {
  'use strict';

  const purchasesDomain = {
    /**
     * Procesa y valida una nueva compra de insumos o productos.
     * Incrementa automáticamente el stock de los productos adquiridos (Regla 1).
     * @param {string} negocioId - Negocio activo.
     * @param {Object} datos - Encabezado y lista de detalles de compra.
     * @param {Array} productosActuales - Lista actual de productos para mutación in-memory.
     * @returns {{compra: Object, kardexEntries: Array, error: string|null}}
     */
    procesarCompra(negocioId, datos = {}, productosActuales = []) {
      const detalles = Array.isArray(datos.detalles) ? datos.detalles : [];
      if (detalles.length === 0) {
        return { compra: null, kardexEntries: [], error: 'La compra debe incluir al menos un producto o insumo.' };
      }

      let totalCompra = 0;
      const detallesValidados = [];
      const kardexEntries = [];

      detalles.forEach(d => {
        const prod = (productosActuales || []).find(p => p.id === d.productoId && p.negocioId === negocioId);
        const cantidad = Math.max(Number(d.cantidad) || 0, 0);
        const precioUnitario = Math.max(Number(d.precioUnitario) || 0, 0);
        const subtotal = cantidad * precioUnitario;
        totalCompra += subtotal;

        detallesValidados.push({
          productoId: d.productoId,
          productoNombre: prod ? prod.nombre : (d.productoNombre || 'Item'),
          cantidad,
          precioUnitario,
          subtotal
        });

        // Regla 1: Aumentar inventario automáticamente
        if (prod && cantidad > 0) {
          const anterior = Number(prod.stock) || 0;
          prod.stock = anterior + cantidad;
          if (precioUnitario > 0) {
            prod.costoUnitario = precioUnitario;
            prod.precioCompra = precioUnitario;
          }

          kardexEntries.push({
            id: `mov-inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            negocioId,
            productoId: prod.id,
            productoNombre: prod.nombre,
            tipo: 'ENTRADA',
            cantidad,
            stockAnterior: anterior,
            stockPosterior: prod.stock,
            motivo: `Compra confirmada #${datos.id || ''}`,
            fecha: datos.fecha || (window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0])
          });
        }
      });

      const montoPagado = Math.min(Math.max(Number(datos.montoPagado) || totalCompra, 0), totalCompra);
      const saldoPendiente = Math.max(totalCompra - montoPagado, 0);

      const compra = {
        id: datos.id || `comp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        negocioId,
        proveedorId: datos.proveedorId || null,
        proveedorNombre: (datos.proveedorNombre || 'Proveedor General').trim(),
        fecha: datos.fecha || (window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0]),
        total: totalCompra,
        montoPagado,
        saldoPendiente,
        estado: 'CONFIRMADA',
        observaciones: (datos.observaciones || '').trim(),
        detalles: detallesValidados
      };

      return {
        compra,
        kardexEntries,
        error: null
      };
    }
  };

  window.BusinessPurchasesDomain = purchasesDomain;
})();
