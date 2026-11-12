const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function context() {
  const c = vm.createContext({ document: { readyState: 'loading', addEventListener() {} }, URL, location: { href: 'http://localhost:5500/desktop.html' } }); c.window = c;
  for (const f of ['src/utils/dates.js', 'src/domains/business/reportPreferences.js', 'src/domains/business/reportOperationsDomain.js', 'src/domains/business/reportsDomain.js', 'src/domains/business/cashFlowDomain.js', 'src/ui/views/business/businessReportOperationsView.js', 'src/ui/views/business/businessReportsView.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), c);
  return c;
}
function fixture() {
  return {
    negocios: [{ id: 'n', nombre: 'Café & Pan' }, { id: 'other', nombre: 'Otro' }],
    ventas: [
      { negocioId: 'n', fecha: '2026-11-01', total: '119', subtotal: '100', invoiceDocumentId: 'sim', costoTotalVenta: '40', detalles: [{ cantidad: 10, costoUnitario: 99 }] },
      { negocioId: 'n', fecha: '2026-11-09', total: '50', detalles: [{ cantidad: '2', costoUnitario: '5' }] },
      { negocioId: 'n', fecha: '2026-10-31', total: '80', costoTotalVenta: '20' },
      { negocioId: 'n', fecha: '2026-11-09', total: '1000', costoTotalVenta: '900', estado: 'ANULADA' },
      { negocioId: 'other', fecha: '2026-11-09', total: '1000000' }
    ],
    ingresosNegocio: [{ negocioId: 'n', fecha: '2026-11-09', monto: '20' }],
    gastosNegocio: [{ negocioId: 'n', fecha: '2026-11-09', monto: '15', categoria: 'Arriendo' }],
    pagosEmpleado: [{ negocioId: 'n', fecha: '2026-11-09', monto: '5' }],
    compras: [{ negocioId: 'n', fecha: '2026-11-09', total: '999999' }],
    pagosVenta: [{ negocioId: 'n', fecha: '2026-11-09', monto: '100' }],
    clientes: [{ negocioId: 'n', saldoPendiente: '42.25' }, { negocioId: 'other', saldoPendiente: '999999' }],
    movimientos: [{ tipo: 'INGRESO', valor: 9999999, fecha: '2026-11-09' }]
  };
}
const options = { today: '2026-11-09', period: 'MES_ACTUAL' };
test('reporte empresarial: concilia estado de resultados, categorías y comparación sin duplicar compras ni cobros', () => {
  const c = context(), state = fixture(), before = JSON.stringify(state), m = c.BusinessReportsDomain.build(state, 'n', options);
  assert.equal(m.totals.income, '170.00'); assert.equal(m.totals.sales, '150.00'); assert.equal(m.totals.cogs, '50.00');
  assert.equal(m.totals.operatingExpenses, '20.00'); assert.equal(m.totals.expenses, '70.00'); assert.equal(m.totals.netProfit, '100.00'); assert.equal(m.totals.grossProfit, '100.00');
  assert.equal(m.totals.salesCount, 2); assert.equal(m.totals.ticket, '75.00'); assert.equal(m.receivables, '42.25'); assert.equal(m.comparison.incomeDelta, '90.00'); assert.equal(m.comparison.netProfitDelta, '40.00');
  assert.equal(m.categories.reduce((sum, cat) => sum + c.BusinessReportsDomain.cents(cat.amount), 0n), 7000n);
  assert.equal(m.monthly.at(-1).income, m.totals.income); assert.equal(m.monthly.at(-1).expenses, m.totals.expenses);
  assert.equal(m.monthly.at(-2).key, '2026-10'); assert.equal(m.monthly.at(-2).income, '80.00'); assert.equal(JSON.stringify(state), before);
});
test('períodos reales: no mezcla octubre demo con noviembre y cruza diciembre/enero', () => {
  const d = context().BusinessReportsDomain;
  assert.equal(d.build(fixture(), 'n', { ...options, period: 'MES_ANTERIOR' }).totals.income, '80.00');
  assert.equal(d.build(fixture(), 'n', { ...options, period: 'TODOS' }).totals.income, '250.00');
  assert.equal(d.build(fixture(), 'n', { ...options, period: 'ANIO_ACTUAL' }).totals.income, '250.00');
  const january = d.periodRange('MES_ACTUAL', '2026-01-10'); assert.equal(january.previous.from, '2025-12-01'); assert.equal(january.previous.to, '2025-12-31');
  assert.equal(d.periodRange('MES_ANTERIOR', '2024-03-05').to, '2024-02-29');
  assert.throws(() => d.periodRange('BAD', options.today), /inválido/);
  assert.throws(() => d.build(fixture(), 'missing', options), /negocio/);
});
test('sin ingresos, pérdidas y datos inválidos producen estados claros sin NaN ni valores inventados', () => {
  const c = context(), s = { negocios: [{ id: 'n', nombre: 'Prueba' }], gastosNegocio: [{ negocioId: 'n', fecha: '2026-11-09', monto: '10', categoria: 'Servicios' }, { negocioId: 'n', fecha: '2026-02-30', monto: '90' }, { negocioId: 'n', fecha: '2026-11-09', monto: '-1' }] };
  const m = c.BusinessReportsDomain.build(s, 'n', options); assert.equal(m.totals.netProfit, '-10.00'); assert.equal(m.totals.margin, 0); assert.equal(m.invalidCount, 2);
  const html = c.BusinessReportsView.markup(m); assert.match(html, /br-loss/); assert.match(html, /Sin ingresos registrados/); assert.doesNotMatch(html, /NaN|Infinity/);
  const empty = c.BusinessReportsDomain.build({ negocios: s.negocios }, 'n', options); assert.equal(empty.hasData, false); assert.equal(empty.totals.income, '0.00');
  assert.match(c.BusinessReportsView.markup(empty), /No hay movimientos/); assert.match(c.BusinessReportsView.markup(empty), /SIN GASTOS/);
});
test('sumas decimales, costo histórico y redondeo de costos conservan centavos', () => {
  const c = context(), s = { negocios: [{ id: 'n', nombre: 'Decimal' }], ventas: [{ negocioId: 'n', fecha: options.today, total: '0.10', detalles: [{ cantidad: '0.3333', costoUnitario: '0.05' }] }, { negocioId: 'n', fecha: options.today, total: '0.20', costoTotalVenta: '0.01' }] };
  const m = c.BusinessReportsDomain.build(s, 'n', options); assert.equal(m.totals.income, '0.30'); assert.equal(m.totals.cogs, '0.03'); assert.equal(m.totals.netProfit, '0.27'); assert.equal(m.totals.ticket, '0.15');
  assert.equal(c.BusinessReportsView.money('1234567.89'), '1.234.567,89 COP'); assert.equal(c.BusinessReportsView.money('-0.10'), '-0,10 COP');
});
test('CSV y vista imprimible corresponden al filtro, escapan texto y protegen fórmulas', () => {
  const c = context(), s = fixture(); s.negocios[0].nombre = '=HYPERLINK("https://example.com")'; s.gastosNegocio[0].categoria = '<img src=x onerror=alert(1)>';
  const m = c.BusinessReportsDomain.build(s, 'n', { ...options, period: 'MES_ANTERIOR' }), csv = c.BusinessReportsView.csv(m);
  assert.match(csv, /'\=HYPERLINK/); assert.match(csv, /"Ingresos totales";"80.00"/); assert.doesNotMatch(csv, /"Ingresos totales";"170.00"/);
  const current = c.BusinessReportsDomain.build(s, 'n', options), print = c.BusinessReportsView.printDocument(current);
  assert.match(print, /&lt;img/); assert.doesNotMatch(print, /<img src=x|data-report-action/); assert.match(print, /businessReports.css/);
  assert.match(c.BusinessReportsView.markup(current), /Ver datos mensuales/);
});


test('detalle de ventas y gastos concilia con el resumen y distingue impuestos, costo y personal', () => {
  const c = context(), s = fixture();
  s.gastosNegocio.push({ negocioId: 'n', fecha: options.today, monto: '999', estado: 'ANULADA' });
  s.ventas[0].impuestos = '19'; s.ventas[0].clienteNombre = '<Cliente>';
  const m = c.BusinessReportsDomain.build(s, 'n', options), sum = rows => c.BusinessReportsDomain.decimal(rows.reduce((total, row) => total + c.BusinessReportsDomain.cents(row.amount), 0n));
  assert.equal(sum(m.details.filter(r => r.type === 'SALE')), m.totals.sales);
  assert.equal(sum(m.details.filter(r => ['EXPENSE', 'PAYROLL'].includes(r.type))), m.totals.operatingExpenses);
  assert.equal(m.totals.businessExpenses, '15.00'); assert.equal(m.totals.employeePayments, '5.00');
  assert.equal(m.totals.salesTax, '19.00'); assert.equal(m.totals.billedTotal, '169.00');
  assert.equal(m.details.filter(r => r.type === 'SALE').map(r => r.profit).sort().join(','), '40.00,60.00');
  const html = c.BusinessReportsView.markup(m), csv = c.BusinessReportsView.csv(m);
  assert.match(html, /Detalle de ventas y ganancia bruta/); assert.match(html, /&lt;Cliente&gt;/); assert.doesNotMatch(html, /<Cliente>/);
  assert.match(csv, /Detalle de gastos y pagos al personal/); assert.match(csv, /"100.00";"40.00";"60.00";"19.00";"119.00"/);
});

test('rango personalizado es inclusivo, valida fechas y exporta exactamente el período aplicado', () => {
  const c = context(), s = fixture(), opts = { ...options, period: 'PERSONALIZADO', from: '2026-11-09', to: '2026-11-09' };
  const m = c.BusinessReportsDomain.build(s, 'n', opts);
  assert.equal(m.totals.sales, '50.00'); assert.equal(m.totals.netProfit, '40.00');
  assert.ok(m.details.every(r => r.date === '2026-11-09')); assert.equal(m.comparison, null);
  const csv = c.BusinessReportsView.csv(m); assert.match(csv, /"Desde";"2026-11-09"/); assert.match(csv, /"Ingresos totales";"70.00"/);
  assert.throws(() => c.BusinessReportsDomain.build(s, 'n', { ...opts, from: '2026-11-10' }), /Desde/);
  assert.throws(() => c.BusinessReportsDomain.build(s, 'n', { ...opts, to: '2026-02-30' }), /fechas/);
  const print = c.BusinessReportsView.printDocument(m); assert.match(print, /2026-11-09 al 2026-11-09/); assert.doesNotMatch(print, /data-report-from|Aplicar fechas/);
});

test('flujo usa fechas de cobro y pago sin duplicarlos y separa saldos actuales del resultado', () => {
  const c = context(), s = { negocios: [{ id: 'n', nombre: 'Caja' }],
    ventas: [{ id: 'v', negocioId: 'n', fecha: '2026-10-31', total: '100', montoPagado: '40', saldoPendiente: '60', costoTotalVenta: '20' }],
    pagosVenta: [{ id: 'pv', negocioId: 'n', ventaId: 'v', fecha: options.today, monto: '40' }],
    compras: [{ id: 'p', negocioId: 'n', fecha: options.today, total: '80', montoPagado: '30', saldoPendiente: '50' }],
    pagosCompra: [{ id: 'pc', negocioId: 'n', compraId: 'p', fecha: options.today, monto: '30' }],
    gastosNegocio: [{ id: 'g', negocioId: 'n', fecha: options.today, monto: '10', montoPagado: '0', saldoPendiente: '10' }],
    clientes: [{ negocioId: 'n', saldoPendiente: '60' }], productos: [{ negocioId: 'n', stock: '2.5', costoUnitario: '4.25', stockMinimo: '3' }, { negocioId: 'other', stock: 99, costoUnitario: 99 }]
  };
  const m = c.BusinessReportsDomain.build(s, 'n', options);
  assert.equal(m.totals.sales, '0.00'); assert.equal(m.totals.netProfit, '-10.00');
  assert.equal(m.cash.incoming, '40.00'); assert.equal(m.cash.outgoing, '30.00'); assert.equal(m.cash.net, '10.00');
  assert.equal(m.receivables, '60.00'); assert.equal(m.payables, '60.00'); assert.equal(m.inventoryValue, '10.63'); assert.equal(m.lowStockCount, 1);
  const previous = c.BusinessReportsDomain.build(s, 'n', { ...options, period: 'MES_ANTERIOR' });
  assert.equal(previous.cash.incoming, '0.00'); assert.equal(previous.receivables, m.receivables); assert.equal(previous.payables, m.payables);
});


test('compras, cartera, personal y producción usan el negocio y los períodos correctos sin duplicar gastos', () => {
  const c = context(), s = fixture();
  s.compras = [
    { id: 'purchase-uuid-123456', negocioId: 'n', proveedorNombre: 'Proveedor A', fecha: options.today, fechaVencimiento: '2026-11-08', total: '100.25', montoPagado: '20.10', saldoPendiente: '80.15' },
    { id: 'old', negocioId: 'n', fecha: '2026-10-02', total: '30', montoPagado: '10', saldoPendiente: '20', fechaVencimiento: '2026-12-01' },
    { id: 'cancelled', negocioId: 'n', fecha: options.today, total: '999', estado: 'ANULADA' },
    { id: 'foreign', negocioId: 'other', fecha: options.today, total: '999' }
  ];
  s.empleados = [{ id: 'e', negocioId: 'n', nombre: 'Colaborador', cargo: 'Apoyo', estado: 'ACTIVO' }];
  s.pagosEmpleado[0].empleadoId = 'e';
  s.producciones = [{ id: 'lot', negocioId: 'n', fecha: options.today, productoNombre: 'Pan', cantidadProducida: '12.5', costoTotal: '4.75' }];
  const m = c.BusinessReportsDomain.build(s, 'n', options), o = m.operations;
  assert.equal(o.purchases.length, 1); assert.equal(o.purchaseTotals.total, '100.25'); assert.equal(o.purchaseTotals.paid, '20.10'); assert.equal(o.purchaseTotals.balance, '80.15');
  assert.equal(o.cancelledPurchases, 1); assert.equal(o.payableTotal, '100.15'); assert.equal(o.overduePayables, '80.15'); assert.equal(o.payables[0].status, 'Vencida');
  assert.equal(o.employees[0].paid, '5.00'); assert.equal(o.activeEmployees, 1); assert.equal(o.productionCost, '4.75'); assert.equal(o.productions[0].quantity, '12.5');
  assert.equal(m.totals.netProfit, '100.00');
  const csv = c.BusinessReportsView.csv(m), print = c.BusinessReportsView.printDocument(m);
  assert.match(csv, /"100.25";"20.10";"80.15"/); assert.match(csv, /Personal actual/); assert.match(csv, /Producción del período/);
  assert.match(print, /Compras y proveedores/); assert.match(print, /Cuentas por pagar/); assert.doesNotMatch(print, /data-report-record|data-report-tab|save-view/);
});
