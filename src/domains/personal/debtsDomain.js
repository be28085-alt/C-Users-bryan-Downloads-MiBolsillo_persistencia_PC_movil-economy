/**
 * ============================================================================
 * DEBTS DOMAIN (FINANZAS PERSONALES)
 * Responsabilidad: Control de deudas, créditos, abonos y amortización.
 * ============================================================================
 */
(function () {
  'use strict';

  const debtsDomain = {
    /**
     * Calcula los saldos consolidados de deudas personales.
     * @param {Array} deudas - Lista de deudas.
     * @returns {{totalDeuda: number, cuotaMensualTotal: number, deudasEnriquecidas: Array}}
     */
    calcularResumenDeudas(deudas = []) {
      if (!Array.isArray(deudas)) return { totalDeuda: 0, cuotaMensualTotal: 0, deudasEnriquecidas: [] };

      let totalDeuda = 0;
      let cuotaMensualTotal = 0;

      const deudasEnriquecidas = deudas.map(d => {
        const saldo = Number(d.saldoPendiente) || 0;
        const inicial = Number(d.montoInicial) || saldo;
        const cuota = Number(d.cuotaMensual) || 0;
        const pagado = Math.max(inicial - saldo, 0);
        const porcentajePagado = inicial > 0 ? (pagado / inicial) * 100 : 0;

        totalDeuda += saldo;
        cuotaMensualTotal += cuota;

        return {
          ...d,
          saldo,
          pagado,
          porcentajePagado: Math.min(porcentajePagado, 100),
          saldada: saldo <= 0
        };
      });

      return {
        totalDeuda,
        cuotaMensualTotal,
        deudasEnriquecidas
      };
    },

    /**
     * Registra un abono o pago a una deuda específica.
     * @param {Object} deuda - Deuda a abonar.
     * @param {number} monto - Monto del pago.
     * @param {string} metodo - Método de pago utilizado.
     * @returns {{deudaActualizada: Object, abono: Object}}
     */
    registrarPago(deuda, monto, metodo = 'Transferencia') {
      const valor = Math.abs(Number(monto) || 0);
      const saldoActual = Number(deuda.saldoPendiente) || 0;
      const nuevoSaldo = Math.max(saldoActual - valor, 0);

      const abono = {
        id: `ab-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        deudaId: deuda.id,
        monto: valor,
        fecha: window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0],
        metodo: (metodo || 'Transferencia').trim()
      };

      return {
        deudaActualizada: {
          ...deuda,
          saldoPendiente: nuevoSaldo,
          estado: nuevoSaldo === 0 ? 'PAGADA' : deuda.estado
        },
        abono
      };
    }
  };

  window.PersonalDebtsDomain = debtsDomain;
})();
