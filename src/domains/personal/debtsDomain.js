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
     * Clasifica sin alterar el historial ni los registros originales.
     * @param {Array<object>} deudas Registros personales confirmados.
     * @returns {{archivadas: Array, visibles: Array, activas: Array, pagadas: Array}}
     */
    clasificar(deudas = []) {
      const todas = Array.isArray(deudas) ? deudas : [];
      const esArchivada = deuda => deuda.archivada || deuda.estado === 'ARCHIVADA';
      const archivadas = todas.filter(esArchivada);
      const visibles = todas.filter(deuda => !esArchivada(deuda));
      return { archivadas, visibles, activas: visibles.filter(d => Number(d.saldoPendiente) > 0),
        pagadas: visibles.filter(d => Number(d.saldoPendiente) <= 0) };
    },
    /**
     * Calcula los saldos consolidados de deudas personales.
     * @param {Array} deudas - Lista de deudas.
     * @returns {{totalDeuda: number, cuotaMensualTotal: number, deudasEnriquecidas: Array}}
     */
    calcularResumenDeudas(deudas = []) {
      if (!Array.isArray(deudas)) return { totalDeuda: 0, cuotaMensualTotal: 0, deudasEnriquecidas: [] };

      let totalDeuda = 0;
      let cuotaMensualTotal = 0;

      const grupos = this.clasificar(deudas);
      const deudasEnriquecidas = grupos.visibles.map(d => {
        const saldo = Number(d.saldoPendiente) || 0;
        const inicial = Number(d.montoInicial) || saldo;
        const cuota = Number(d.cuotaMensual) || 0;
        const pagado = Math.max(inicial - saldo, 0);
        const porcentajePagado = inicial > 0 ? (pagado / inicial) * 100 : 0;

        totalDeuda += saldo;
        if (saldo > 0) cuotaMensualTotal += cuota;

        return {
          ...d,
          saldo,
          pagado,
          porcentajePagado: Math.min(porcentajePagado, 100),
          saldada: saldo <= 0
        };
      });

      return {
        ...grupos,
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
      const valor = Number(monto);
      const saldoActual = Number(deuda.saldoPendiente) || 0;
      if (!Number.isFinite(valor) || valor <= 0 || valor > saldoActual) throw new Error('El abono debe ser positivo y no superar el saldo pendiente.');
      const nuevoSaldo = Math.round((saldoActual - valor + Number.EPSILON) * 100) / 100;

      const abono = {
        id: window.crypto?.randomUUID?.() || `ab-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
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
