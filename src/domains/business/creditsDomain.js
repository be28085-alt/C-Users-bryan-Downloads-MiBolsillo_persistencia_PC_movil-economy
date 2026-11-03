/**
 * ============================================================================
 * CREDITS & ACCOUNTS RECEIVABLE DOMAIN
 * Responsabilidad: Cartera de clientes a crédito y registro de abonos (Regla 5).
 * ============================================================================
 */
(function () {
  'use strict';

  const creditsDomain = {
    /**
     * Aplica un abono de cliente a una factura a crédito y actualiza el saldo del cliente.
     * @param {string} negocioId - Negocio activo.
     * @param {Object} venta - Venta con saldo pendiente.
     * @param {Object} cliente - Cliente deudor.
     * @param {number} monto - Valor abonado.
     * @param {string} metodoPago - Efectivo, Transferencia, etc.
     * @param {string} notas - Comentario.
     * @returns {{ventaActualizada: Object, clienteActualizado: Object, pagoRegistro: Object}}
     */
    registrarAbono(negocioId, venta, cliente, monto, metodoPago = 'Efectivo', notas = '') {
      const valorAbono = Math.abs(Number(monto) || 0);

      // Descontar saldo de la factura
      const saldoVentaActual = Number(venta.saldoPendiente) || 0;
      const nuevoSaldoVenta = Math.max(saldoVentaActual - valorAbono, 0);
      const nuevoEstadoVenta = nuevoSaldoVenta === 0 ? 'PAGADA' : 'PENDIENTE';

      // Descontar saldo del cliente
      const saldoClienteActual = cliente ? (Number(cliente.saldoPendiente) || 0) : 0;
      const nuevoSaldoCliente = Math.max(saldoClienteActual - valorAbono, 0);

      const pagoRegistro = {
        id: `pago-v-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        negocioId,
        ventaId: venta.id,
        clienteId: cliente ? cliente.id : venta.clienteId,
        clienteNombre: cliente ? cliente.nombre : venta.clienteNombre,
        monto: valorAbono,
        fecha: window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0],
        metodoPago: (metodoPago || 'Efectivo').trim(),
        notas: (notas || '').trim()
      };

      return {
        ventaActualizada: {
          ...venta,
          saldoPendiente: nuevoSaldoVenta,
          estado: nuevoEstadoVenta
        },
        clienteActualizado: cliente ? {
          ...cliente,
          saldoPendiente: nuevoSaldoCliente
        } : null,
        pagoRegistro
      };
    }
  };

  window.BusinessCreditsDomain = creditsDomain;
})();
