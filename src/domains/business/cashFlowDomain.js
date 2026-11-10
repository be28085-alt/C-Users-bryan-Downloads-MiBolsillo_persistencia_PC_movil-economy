/**
 * ============================================================================
 * CASH FLOW DOMAIN
 * Responsabilidad: Disponibilidad en cuentas, entradas, salidas y flujo neto de caja.
 * ============================================================================
 */
(function () {
  'use strict';

  const cashFlowDomain = {
    /**
     * Calcula la posición de caja, bancos y flujo neto del negocio.
     * @param {string} negocioId - Negocio evaluado.
     * @param {Object} datasets - Colecciones de datos.
     * @returns {Object}
     */
    calcularCajaYFlujo(negocioId, datasets = {}) {
      const cuentas = [
        { id: 'caja-1', nombre: 'Caja Menor / Efectivo', tipo: 'EFECTIVO', saldo: 4200000, numero: 'Caja Principal' },
        { id: 'banco-1', nombre: 'Bancolombia Negocio', tipo: 'BANCO', saldo: 9000000, numero: 'Cta Corriente *4589' }
      ];

      const saldoDisponible = cuentas.reduce((acc, c) => acc + c.saldo, 0); // $13.200.000
      const totalEntradas = 21600000;
      const totalSalidas = 14240000;
      const flujoNeto = totalEntradas - totalSalidas; // +$7.360.000

      const movimientosCaja = [
        { fecha: '2026-10-28', cuenta: 'Bancolombia Negocio', concepto: 'Abono cliente Cafetería del Parque', tipo: 'ENTRADA', monto: 1200000, saldoPosterior: 9000000 },
        { fecha: '2026-10-27', cuenta: 'Bancolombia Negocio', concepto: 'Pago factura Molinos del Valle', tipo: 'SALIDA', monto: 2450000, saldoPosterior: 7800000 },
        { fecha: '2026-10-26', cuenta: 'Caja Menor / Efectivo', concepto: 'Venta mostrador turno tarde', tipo: 'ENTRADA', monto: 850000, saldoPosterior: 4200000 },
        { fecha: '2026-10-25', cuenta: 'Caja Menor / Efectivo', concepto: 'Pago servicios y suministros', tipo: 'SALIDA', monto: 140000, saldoPosterior: 3350000 },
        { fecha: '2026-10-24', cuenta: 'Bancolombia Negocio', concepto: 'Transferencia ventas datáfono del día', tipo: 'ENTRADA', monto: 1650000, saldoPosterior: 10250000 }
      ];

      // Preserve the existing demo cash view and add the actual simulated invoice ledger once.
      const invoicePayments = (datasets.pagosVenta || []).filter(p => p.negocioId === negocioId && p.invoiceDocumentId);
      const invoiceRefunds = (datasets.facturacion?.refunds || []).filter(r => r.businessId === negocioId);
      const M = window.InvoiceMoney;
      const receipts = M ? invoicePayments.reduce((s, p) => s + M.units(p.monto), 0n) : 0n;
      const refunds = M ? invoiceRefunds.reduce((s, p) => s + M.units(p.amount), 0n) : 0n;
      const invoiceNet = M ? Number(M.decimal(receipts - refunds)) : 0;
      if (invoicePayments.length || invoiceRefunds.length) {
        cuentas.push({ id: 'invoice-local-ledger', nombre: 'Flujo de facturación simulada', tipo: 'SIMULACION', saldo: invoiceNet, numero: 'Registro interno' });
        movimientosCaja.push(...invoicePayments.map(p => ({ fecha: p.fecha, cuenta: 'Facturación simulada', concepto: `Cobro ${p.ventaId}`, tipo: 'ENTRADA', monto: p.monto })), ...invoiceRefunds.map(r => ({ fecha: r.date, cuenta: 'Facturación simulada', concepto: `Devolución ${r.documentId}`, tipo: 'SALIDA', monto: Number(r.amount) })));
      }
      return {
        saldoDisponible: saldoDisponible + invoiceNet,
        cuentas,
        totalEntradas: totalEntradas + (M ? Number(M.decimal(receipts)) : 0),
        totalSalidas: totalSalidas + (M ? Number(M.decimal(refunds)) : 0),
        flujoNeto: flujoNeto + invoiceNet,
        movimientosCaja
      };
    }
  };

  window.BusinessCashFlowDomain = cashFlowDomain;
})();
