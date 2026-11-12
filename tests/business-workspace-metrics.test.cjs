const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./helpers/browser-core.cjs');

for (const page of ['desktop.html', 'mobile.html']) test(`${page}: indicadores del nuevo espacio concilian inventario, proveedores, gastos y caja`, async () => {
  const a = app(page); a.core.setModuloActivo('EMPRESARIAL');
  const service = a.core.getBusinessService(), date = '2026-11-09';
  const supplier = (await service.execute('saveSupplier', { nombre: 'Proveedor', cedula: '9001' })).record;
  const customer = (await service.execute('saveCustomer', { nombre: 'Cliente', cedula: '1001' })).record;
  const product = (await service.execute('saveProduct', { nombre: 'Producto', stock: '10', costoUnitario: '100', precioVenta: '200' })).record;
  await service.execute('purchase', { proveedorId: supplier.id, fecha: date, tipoPago: 'CREDITO', montoPagado: '0', detalles: [{ productoId: product.id, cantidad: '2', precioUnitario: '100' }] });
  const sale = (await service.execute('sale', { clienteId: customer.id, fecha: date, tipoPago: 'CREDITO', montoPagado: '0', detalles: [{ productoId: product.id, cantidad: '2', precioUnitario: '200', tarifaImpuesto: '19' }] })).record;
  await service.execute('paySale', { ventaId: sale.id, monto: '100', fecha: date });
  await service.execute('saveExpense', { descripcion: 'Servicios', categoria: 'Servicios', monto: '50', fecha: date });
  await service.execute('saveExpense', { descripcion: 'Arriendo', categoria: 'Arriendo', monto: '150', fecha: date, tipoPago: 'CREDITO', montoPagado: '0', proveedorId: supplier.id });
  await service.execute('saveIncome', { descripcion: 'Ingreso', monto: '20', fecha: date });
  const model = a.context.BusinessReadModel.build(a.core, a.core.state.negocioActivoId, 'TODOS');
  const before = JSON.stringify(a.core.state), metrics = a.context.BusinessWorkspaceMetrics.build(model);
  assert.equal(metrics.inventoryCost, '1000.00'); assert.equal(metrics.inventorySaleValue, '2000.00');
  assert.equal(metrics.stockUnits, 10); assert.equal(metrics.products[0].unitProfit, '100.00'); assert.equal(metrics.products[0].margin, 50);
  assert.equal(metrics.suppliers[0].purchaseTotal, '200.00'); assert.equal(metrics.suppliers[0].pendingTotal, '350.00');
  assert.equal(metrics.suppliers[0].lastPurchase, date); assert.equal(metrics.expensePending, '150.00'); assert.equal(metrics.expenseShare, 50);
  assert.equal(metrics.expenseCategories[0].name, 'Arriendo'); assert.equal(metrics.expenseCategories[0].percentage, 75);
  assert.equal(metrics.monthlyCash.find(r => r.key === '2026-11').income, '120.00');
  assert.equal(metrics.monthlyCash.find(r => r.key === '2026-11').expenses, '50.00');
  assert.equal(JSON.stringify(a.core.state), before, 'consultar indicadores no modifica datos');
  await service.execute('saveBusiness', { nombre: 'Segundo negocio' });
  const empty = a.context.BusinessWorkspaceMetrics.build(a.context.BusinessReadModel.build(a.core, a.core.state.negocioActivoId, 'TODOS'));
  assert.equal(empty.inventoryCost, '0.00'); assert.equal(empty.inventorySaleValue, '0.00'); assert.equal(empty.suppliers.length, 0); assert.equal(empty.expenseCategories.length, 0);
});

test('márgenes negativos y precios cero se muestran sin NaN ni divisiones por cero', async () => {
  const a = app(); a.core.setModuloActivo('EMPRESARIAL'); const service = a.core.getBusinessService();
  await service.execute('saveProduct', { nombre: 'Pérdida', stock: '0.1', costoUnitario: '0.3', precioVenta: '0.2' });
  await service.execute('saveProduct', { nombre: 'Sin precio', stock: '1', costoUnitario: '1', precioVenta: '0' });
  const metrics = a.context.BusinessWorkspaceMetrics.build(a.context.BusinessReadModel.build(a.core, a.core.state.negocioActivoId, 'TODOS'));
  assert.equal(metrics.products[0].unitProfit, '-0.10'); assert.equal(metrics.products[0].margin, -50); assert.equal(metrics.products[1].margin, 0);
  assert.equal(metrics.inventoryCost, '1.03'); assert.equal(metrics.inventorySaleValue, '0.02');
});
