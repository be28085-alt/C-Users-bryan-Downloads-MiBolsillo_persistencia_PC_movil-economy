/**
 * ============================================================================
 * SALES DOMAIN
 * Responsabilidad: Facturación de ventas, validación de stock (Regla 3), descuento
 * de inventario (Regla 2), cuentas por cobrar (Regla 4) y cálculo de COGS real (Regla 9).
 * ============================================================================
 */
(function () {
  'use strict';

  const salesDomain = {
    /**
     * Procesa y valida una nueva venta comercial.
     * @param {string} negocioId - Negocio activo.
     * @param {Object} datos - Parámetros de la venta y líneas de detalle.
     * @param {Array} productosActuales - Lista actual de productos.
     * @returns {{venta: Object, kardexEntries: Array, error: string|null}}
     */
    procesarVenta(negocioId, datos = {}, productosActuales = []) {
      const detalles = Array.isArray(datos.detalles) ? datos.detalles : [];
      if (detalles.length === 0) {
        return { venta: null, kardexEntries: [], error: 'La venta debe incluir al menos un producto.' };
      }

      // Regla 3: Validación previa estricta de stock disponible
      for (const d of detalles) {
        const prod = (productosActuales || []).find(p => p.id === d.productoId && p.negocioId === negocioId);
        const cantRequerida = Number(d.cantidad) || 0;
        if (!prod) {
          return { venta: null, kardexEntries: [], error: `El producto ID "${d.productoId}" no existe en este negocio.` };
        }
        if (prod.stock < cantRequerida) {
          return {
            venta: null,
            kardexEntries: [],
            error: `Stock insuficiente para "${prod.nombre}". Solicitado: ${cantRequerida}, Disponible: ${prod.stock} ${prod.unidadMedida}.`
          };
        }
      }

      let totalVenta = 0;
      let costoTotalVenta = 0;
      const detallesValidados = [];
      const kardexEntries = [];

      detalles.forEach(d => {
        const prod = (productosActuales || []).find(p => p.id === d.productoId && p.negocioId === negocioId);
        const cantidad = Number(d.cantidad) || 0;
        const precioUnitario = Number(d.precioUnitario) || prod.precioVenta || 0;
        const costoUnitario = Number(prod.costoUnitario) || 0;
        const subtotal = cantidad * precioUnitario;

        totalVenta += subtotal;
        costoTotalVenta += (cantidad * costoUnitario);

        detallesValidados.push({
          productoId: prod.id,
          productoNombre: prod.nombre,
          cantidad,
          precioUnitario,
          costoUnitario, // Regla 9: Guardar costo real al momento de la venta
          subtotal
        });

        // Regla 2: Descontar existencias automáticamente
        const stockAnterior = Number(prod.stock) || 0;
        prod.stock = Math.max(stockAnterior - cantidad, 0);

        kardexEntries.push({
          id: `mov-inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          negocioId,
          productoId: prod.id,
          productoNombre: prod.nombre,
          tipo: 'SALIDA',
          cantidad,
          stockAnterior,
          stockPosterior: prod.stock,
          motivo: `Venta facturada #${datos.id || ''}`,
          fecha: datos.fecha || (window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0])
        });
      });

      const tipoPago = datos.tipoPago === 'CREDITO' ? 'CREDITO' : 'CONTADO';
      // Regla 4: Ventas a crédito generan saldo pendiente
      const saldoPendiente = tipoPago === 'CREDITO' ? totalVenta : 0;
      const estado = tipoPago === 'CREDITO' ? 'PENDIENTE' : 'PAGADA';

      const venta = {
        id: datos.id || `vent-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        negocioId,
        clienteId: datos.clienteId || null,
        clienteNombre: (datos.clienteNombre || 'Cliente Mostrador').trim(),
        fecha: datos.fecha || (window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0]),
        tipoPago,
        metodoPago: (datos.metodoPago || (tipoPago === 'CREDITO' ? 'Crédito' : 'Efectivo')).trim(),
        subtotal: totalVenta,
        total: totalVenta,
        saldoPendiente,
        costoTotalVenta,
        estado,
        notas: (datos.notas || '').trim(),
        detalles: detallesValidados
      };

      return {
        venta,
        kardexEntries,
        error: null
      };
    }
  };

  window.BusinessSalesDomain = salesDomain;
})();
