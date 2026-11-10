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
      const clienteNombre = String(datos.clienteNombre || '').trim();
      const clienteCedula = String(datos.clienteCedula || '').trim();
      if (!clienteNombre) {
        return { venta: null, kardexEntries: [], error: 'El nombre del cliente es obligatorio para la factura.' };
      }
      if (!clienteCedula) {
        return { venta: null, kardexEntries: [], error: 'La cédula del cliente es obligatoria para la factura.' };
      }

      // Validar el documento completo antes de tocar existencias.
      const cantidades = new Map();
      let totalPrevisto = 0;
      let costoPrevisto = 0;
      for (const d of detalles) {
        if (!d || typeof d !== 'object') return { venta: null, kardexEntries: [], error: 'Detalle de venta inválido.' };
        const prod = (productosActuales || []).find(p => p.id === d.productoId && p.negocioId === negocioId);
        const cantidad = Number(d.cantidad);
        if (!prod) {
          return { venta: null, kardexEntries: [], error: `El producto ID "${d.productoId}" no existe en este negocio.` };
        }
        const precio = Number(d.precioUnitario ?? prod.precioVenta);
        const costo = Number(prod.costoUnitario ?? 0);
        const stock = Number(prod.stock);
        if (!Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precio) || precio <= 0 ||
            !Number.isFinite(stock) || stock < 0 || !Number.isFinite(costo) || costo < 0) {
          return { venta: null, kardexEntries: [], error: 'Cantidad y precio deben ser números positivos; stock y costo deben ser válidos.' };
        }
        const cantRequerida = (cantidades.get(prod.id) || 0) + cantidad;
        cantidades.set(prod.id, cantRequerida);
        totalPrevisto += cantidad * precio;
        costoPrevisto += cantidad * costo;
        if (!Number.isFinite(totalPrevisto) || !Number.isFinite(costoPrevisto)) {
          return { venta: null, kardexEntries: [], error: 'El importe de la venta excede el límite permitido.' };
        }
        if (stock < cantRequerida) {
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
      const fecha = String(datos.fecha || (window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0]));
      if (!window.FinanzasDates.esFechaISOValida(fecha)) {
        return { venta: null, kardexEntries: [], error: 'La fecha de la venta no es válida.' };
      }
      const id = String(datos.id || `vent-${Date.now()}-${Math.floor(Math.random() * 1000)}`);

      detalles.forEach(d => {
        const prod = (productosActuales || []).find(p => p.id === d.productoId && p.negocioId === negocioId);
        const cantidad = Number(d.cantidad) || 0;
        const precioUnitario = Number(d.precioUnitario ?? prod.precioVenta);
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
        prod.stock = stockAnterior - cantidad;

        kardexEntries.push({
          id: `mov-inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          negocioId,
          productoId: prod.id,
          productoNombre: prod.nombre,
          tipo: 'SALIDA',
          cantidad,
          stockAnterior,
          stockPosterior: prod.stock,
          motivo: `Venta facturada #${id}`,
          fecha
        });
      });

      const tipoPago = datos.tipoPago === 'CREDITO' ? 'CREDITO' : 'CONTADO';
      // Regla 4: Ventas a crédito generan saldo pendiente
      const saldoPendiente = tipoPago === 'CREDITO' ? totalVenta : 0;
      const estado = tipoPago === 'CREDITO' ? 'PENDIENTE' : 'PAGADA';
      const numeroFactura = datos.numeroFactura || `FV-${fecha.replace(/-/g, '')}-${id.replace(/^vent-/, '').toUpperCase()}`;

      const venta = {
        id,
        numeroFactura,
        tipoDocumento: 'FACTURA_VENTA',
        negocioId,
        clienteId: datos.clienteId || null,
        clienteNombre,
        clienteCedula,
        clienteTelefono: String(datos.clienteTelefono || '').trim(),
        clienteEmail: String(datos.clienteEmail || '').trim(),
        clienteDireccion: String(datos.clienteDireccion || '').trim(),
        fecha,
        tipoPago,
        metodoPago: String(datos.metodoPago || (tipoPago === 'CREDITO' ? 'Crédito' : 'Efectivo')).trim(),
        subtotal: totalVenta,
        total: totalVenta,
        saldoPendiente,
        costoTotalVenta,
        estado,
        notas: String(datos.notas || '').trim(),
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
