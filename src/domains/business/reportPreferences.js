(function () {
  'use strict';
  const sections = { overview: 'Resumen', sales: 'Ventas', expenses: 'Gastos e ingresos', purchases: 'Compras', balances: 'Cuentas pendientes', operations: 'Personal y operación', cash: 'Cobros y pagos' };
  const periods = ['MES_ACTUAL', 'MES_ANTERIOR', 'ANIO_ACTUAL', 'TODOS', 'PERSONALIZADO'];
  function validate(value) {
    if (!value || value.version !== 1 || !periods.includes(value.period) || !Object.hasOwn(sections, value.section)) throw new Error('Vista del informe inválida.');
    if (value.period === 'PERSONALIZADO' && (!window.FinanzasDates.esFechaISOValida(value.from) || !window.FinanzasDates.esFechaISOValida(value.to) || value.from > value.to)) throw new Error('Fechas de la vista inválidas.');
    return { version: 1, period: value.period, section: value.section, from: value.period === 'PERSONALIZADO' ? value.from : '', to: value.period === 'PERSONALIZADO' ? value.to : '' };
  }
  window.BusinessReportPreferences = { sections, validate };
})();
