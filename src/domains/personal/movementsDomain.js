/**
 * ============================================================================
 * MOVEMENTS DOMAIN (FINANZAS PERSONALES)
 * Responsabilidad: Reglas de negocio para ingresos, gastos, cálculo de saldos y filtrado.
 * ============================================================================
 */
(function () {
  'use strict';

  const movementsDomain = {
    /**
     * Obtiene los movimientos asociados a un mes y año específicos, o todos si se solicita.
     * @param {Array} movimientos - Lista de transacciones.
     * @param {number|null} anio - Año (ej: 2026).
     * @param {number|null} mes - Mes (0-11).
     * @returns {Array} Movimientos ordenados por fecha descendente.
     */
    getMovimientos(movimientos = [], anio = null, mes = null) {
      if (!Array.isArray(movimientos)) return [];
      let filtrados = [...movimientos];

      if (anio !== null && mes !== null) {
        filtrados = filtrados.filter(m => {
          if (!m.fecha) return false;
          const f = window.parseFechaLocal ? window.parseFechaLocal(m.fecha) : new Date(m.fecha);
          if (!f || isNaN(f.getTime())) return false;
          return f.getFullYear() === anio && f.getMonth() === mes;
        });
      }

      return filtrados.sort((a, b) => {
        const da = window.parseFechaLocal ? window.parseFechaLocal(a.fecha) : new Date(a.fecha);
        const db = window.parseFechaLocal ? window.parseFechaLocal(b.fecha) : new Date(b.fecha);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });
    },

    /**
     * Calcula el saldo total consolidado considerando saldo inicial, ingresos y gastos.
     * @param {number} saldoInicial - Capital base inicial.
     * @param {Array} movimientos - Todas las transacciones registradas.
     * @returns {number} Saldo neto actual.
     */
    calcularSaldoTotal(saldoInicial = 0, movimientos = []) {
      const base = Number(saldoInicial) || 0;
      let total = base;
      (movimientos || []).forEach(m => {
        const val = Number(m.valor) || 0;
        if (m.tipo === 'INGRESO') total += val;
        else if (m.tipo === 'GASTO') total -= val;
      });
      return total;
    },

    /**
     * Calcula los totales de ingresos y gastos para un período dado.
     * @param {Array} movimientos - Movimientos del período.
     * @returns {{ingresos: number, gastos: number, balance: number}}
     */
    calcularResumenPeriodo(movimientos = []) {
      let ingresos = 0;
      let gastos = 0;
      (movimientos || []).forEach(m => {
        const val = Number(m.valor) || 0;
        if (m.tipo === 'INGRESO') ingresos += val;
        else if (m.tipo === 'GASTO') gastos += val;
      });
      return {
        ingresos,
        gastos,
        balance: ingresos - gastos
      };
    },

    /**
     * Crea un nuevo registro de movimiento validado.
     * @param {Object} datos - Parámetros del movimiento.
     * @returns {Object} Objeto de movimiento normalizado.
     */
    crearMovimiento(datos) {
      const tipo = datos.tipo === 'INGRESO' ? 'INGRESO' : 'GASTO';
      const valor = Math.abs(Number(datos.valor) || 0);
      const concepto = (datos.concepto || '').trim();
      const categoria = (datos.categoria || 'Otros').trim();
      const cuenta = (datos.cuenta || 'Principal').trim();
      const fecha = datos.fecha || (window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0]);
      const grupoFecha = window.formatearGrupoFecha ? window.formatearGrupoFecha(fecha) : fecha;

      return {
        id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tipo,
        concepto,
        categoria,
        cuenta,
        valor,
        fecha,
        grupoFecha
      };
    }
  };

  window.PersonalMovementsDomain = movementsDomain;
})();
