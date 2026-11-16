/**
 * ============================================================================
 * EMPLOYEES & PAYROLL DOMAIN
 * Responsabilidad: Directorio de empleados, cargos, salarios y comprobantes de nómina.
 * ============================================================================
 */
(function () {
  'use strict';

  const employeesDomain = {
    /**
     * Crea un nuevo registro de empleado.
     * @param {string} negocioId - Negocio activo.
     * @param {Object} datos - Datos del empleado.
     * @returns {Object}
     */
    crearEmpleado(negocioId, datos = {}) {
      return {
        id: `emp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        negocioId,
        nombre: (datos.nombre || '').trim(),
        cargo: (datos.cargo || 'Operario').trim(),
        telefono: (datos.telefono || '').trim(),
        salario: Math.max(Number(datos.salario) || 0, 0),
        fechaIngreso: datos.fechaIngreso || (window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0]),
        estado: 'ACTIVO'
      };
    },

    /**
     * Genera un comprobante de pago de nómina.
     * @param {string} negocioId - Negocio activo.
     * @param {Object} empleado - Empleado destinatario.
     * @param {number} monto - Valor cancelado.
     * @param {string} concepto - Detalle del pago.
     * @param {string} periodo - Período liquidado.
     * @param {string} metodo - Medio de pago.
     * @returns {Object}
     */
    crearPagoNomina(negocioId, empleado, monto, concepto, periodo, metodo = 'Transferencia') {
      return {
        id: `pago-emp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        negocioId,
        empleadoId: empleado.id,
        empleadoNombre: empleado.nombre,
        monto: Math.max(Number(monto) || 0, 0),
        concepto: (concepto || 'Nómina mensual').trim(),
        periodo: (periodo || 'Mes Actual').trim(),
        fecha: window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0],
        metodoPago: (metodo || 'Transferencia').trim()
      };
    }
  };

  window.BusinessEmployeesDomain = employeesDomain;
})();
