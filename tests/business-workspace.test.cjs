const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { app } = require('./helpers/browser-core.cjs');
const KEY = 'FINANZAS_ETAPA_DATA_V2';
const date = '2026-11-09';
async function setup(page = 'desktop.html') {
  const a = app(page); a.core.setModuloActivo('EMPRESARIAL');
  const s = a.core.getBusinessService();
  const supplier = (await s.execute('saveSupplier', { nombre: 'Proveedor A', cedula: '900123', email: 'a@example.co' })).record;
  const customer = (await s.execute('saveCustomer', { nombre: 'Cliente A', cedula: '123456', email: 'c@example.co' })).record;
  const product = (await s.execute('saveProduct', { nombre: 'Producto A', sku: 'SKU-A', stock: '10', stockMinimo: '2', costoUnitario: '2', precioVenta: '10', proveedorId: supplier.id })).record;
  return { ...a, s, supplier, customer, product };
}
const saleData = a => ({ clienteId: a.customer.id, fecha: date, fechaVencimiento: '2026-12-09', tipoPago: 'CREDITO', detalles: [{ productoId: a.product.id, cantidad: '3', precioUnitario: '10', descuentoPorcentaje: '10', tarifaImpuesto: '19' }] });
const purchaseData = a => ({ proveedorId: a.supplier.id, fecha: date, fechaVencimiento: '2026-12-09', montoPagado: '5', detalles: [{ productoId: a.product.id, cantidad: '5', precioUnitario: '4' }] });

test('inicio limpio: Mi Negocio no precarga clientes, ventas, caja ni inventario ficticios', () => {
  const a = app(); assert.equal(a.core.state.ventas.length, 0); assert.equal(a.core.state.productos.length, 0); assert.equal(a.core.state.clientes.length, 0);
  assert.equal(a.core.getCajaYFlujo().flujoNeto, 0); assert.equal(a.core.getCajaYFlujo().cuentas.length, 0); assert.equal(a.core.state.businessSchemaVersion, 1);
});
for (const page of ['desktop.html', 'mobile.html']) test(`${page}: compra, venta, gastos, ingreso, empleados y pagos concilian sin duplicar resultados`, async () => {
  const a = await setup(page), personal = JSON.stringify(a.core.state.movimientos);
  const purchase = (await a.s.execute('purchase', purchaseData(a))).record;
  assert.equal(a.core.getProductoById(a.product.id).stock, 15); assert.equal(a.core.getProductoById(a.product.id).costoUnitario, 2.6667);
  const sale = (await a.s.execute('sale', saleData(a))).record;
  assert.equal(sale.subtotal, 27); assert.equal(sale.impuestos, 5.13); assert.equal(sale.total, 32.13); assert.equal(sale.costoTotalVenta, 8); assert.equal(a.core.getProductoById(a.product.id).stock, 12);
  const paymentKey = randomUUID(); await a.s.execute('paySale', { ventaId: sale.id, clienteId: a.customer.id, monto: '10', fecha: date }, paymentKey); await a.s.execute('paySale', { ventaId: sale.id, clienteId: a.customer.id, monto: '10', fecha: date }, paymentKey);
  await a.s.execute('payPurchase', { id: purchase.id, monto: '7', fecha: date });
  await a.s.execute('saveExpense', { descripcion: 'Servicios', categoria: 'Servicios', monto: '3', montoPagado: '1', proveedorId: a.supplier.id, fecha: date });
  await a.s.execute('saveIncome', { descripcion: 'Ingreso adicional', monto: '4', fecha: date });
  const employee = (await a.s.execute('saveEmployee', { nombre: 'Colaborador A', salario: '20', fechaIngreso: date })).record;
  await a.s.execute('payroll', { empleadoId: employee.id, monto: '2', concepto: 'Pago de apoyo', periodo: '2026-11', fecha: date });
  const m = a.context.BusinessReadModel.build(a.core, a.core.state.negocioActivoId, 'TODOS');
  assert.equal(m.receivableTotal, '22.13'); assert.equal(m.payableTotal, '10.00'); assert.equal(m.report.totals.income, '31.00'); assert.equal(m.report.totals.netProfit, '18.00'); assert.equal(m.cash.totalEntradas, 14); assert.equal(m.cash.totalSalidas, 15); assert.equal(m.cash.flujoNeto, -1);
  assert.equal(a.core.state.pagosVenta.length, 1); assert.equal(a.core.state.clientes[0].saldoPendiente, 22.13); assert.equal(a.core.state.proveedores[0].saldoPendiente, 10);
  assert.equal(JSON.stringify(a.core.state.movimientos), personal);
  const loaded = app(page, { disk: a.disk }); assert.equal(loaded.core.state.ventas[0].total, 32.13); assert.equal(loaded.core.getProductoById(a.product.id).stock, 12); assert.equal(loaded.core.state.pagosCompra.length, 2);
});
test('catálogos: editar mantiene ID, detecta revisión obsoleta, duplicados y archiva el historial', async () => {
  const a = await setup();
  const p = (await a.s.execute('saveProduct', { ...a.product, nombre: 'Nombre actualizado', revision: a.product.revision })).record;
  assert.equal(p.id, a.product.id); assert.equal(a.core.state.productos.length, 1);
  await assert.rejects(() => a.s.execute('saveProduct', { ...a.product, nombre: 'Edición obsoleta', revision: a.product.revision }), /otra pestaña/);
  await assert.rejects(() => a.s.execute('saveProduct', { nombre: 'Duplicado', sku: 'SKU-A' }), /ya existe/);
  await assert.rejects(() => a.s.execute('saveCustomer', { nombre: 'Duplicado', cedula: '123456' }), /existe/);
  const sold = (await a.s.execute('sale', saleData(a))).record;
  await a.s.execute('archive', { collection: 'clientes', id: a.customer.id });
  await a.s.execute('archive', { collection: 'proveedores', id: a.supplier.id });
  await a.s.execute('archive', { collection: 'productos', id: a.product.id });
  assert.equal(a.core.state.productos[0].estado, 'ARCHIVADO'); assert.equal(a.core.state.ventas[0].clienteSnapshot.nombre, 'Cliente A'); assert.equal(a.core.state.ventas[0].id, sold.id); assert.equal(a.core.getProductos().length, 0);
  const audit = a.core.state.businessLedger.audit.find(x => x.action === 'saveProduct' && x.previous);
  assert.equal(audit.previous.nombre, 'Producto A');
});
test('errores de almacenamiento y peticiones repetidas nunca publican un agregado parcial', async () => {
  const a = await setup(), key = randomUUID(), before = JSON.stringify(a.core.state), disk = a.disk.get(KEY);
  a.setFailure(true); await assert.rejects(() => a.s.execute('sale', saleData(a), key), /No se pudo guardar/);
  assert.equal(JSON.stringify(a.core.state), before); assert.equal(a.disk.get(KEY), disk); assert.equal(a.storage.hasPendingChanges(), false);
  a.setFailure(false); const first = await a.s.execute('sale', saleData(a), key); const second = await a.s.execute('sale', saleData(a), key);
  assert.equal(first.record.id, second.record.id); assert.equal(a.core.state.ventas.length, 1); assert.equal(a.core.getProductoById(a.product.id).stock, 7);
  await assert.rejects(() => a.s.execute('sale', { ...saleData(a), notas: 'Cambió el comando' }, key), /otros datos/);
});
test('validaciones: referencias ajenas, importes no finitos, cero, fechas y saldos superiores se rechazan sin cambios', async () => {
  const a = await setup();
  const cases = [
    ['sale', { ...saleData(a), detalles: [{ productoId: a.product.id, cantidad: '11', precioUnitario: '1' }] }],
    ['sale', { ...saleData(a), detalles: [{ productoId: a.product.id, cantidad: '1', precioUnitario: null }] }],
    ['sale', { ...saleData(a), detalles: [{ productoId: a.product.id, cantidad: '1', precioUnitario: Infinity }] }],
    ['purchase', { ...purchaseData(a), proveedorId: 'otro' }],
    ['inventoryMovement', { productoId: a.product.id, tipo: 'SALIDA', cantidad: '99', motivo: 'Error' }],
    ['saveExpense', { descripcion: 'Error', monto: '-1' }], ['saveIncome', { descripcion: 'Error', monto: '1', fecha: '2026-02-30' }],
    ['saveCustomer', { nombre: 'Error', cedula: '1', email: 'bad' }],
    ['saveProduct', { ...a.product, stock: '99' }], ['saveEmployee', { nombre: '', salario: '1' }],
    ['sale', { ...saleData(a), negocioId: 'otro' }]
  ];
  for (const [name, data] of cases) { const before = JSON.stringify(a.core.state); await assert.rejects(() => a.s.execute(name, data)); assert.equal(JSON.stringify(a.core.state), before, name); }
  const sale = (await a.s.execute('sale', saleData(a))).record;
  for (const monto of ['0', '-1', '99']) await assert.rejects(() => a.s.execute('paySale', { ventaId: sale.id, monto }), /pago|Importe|Decimal|saldo/i);
});
test('anulaciones conservan documentos y revierten stock, cartera y pagos con trazabilidad', async () => {
  const a = await setup(), purchase = (await a.s.execute('purchase', purchaseData(a))).record;
  const sale = (await a.s.execute('sale', { ...saleData(a), tipoPago: 'CONTADO' })).record;
  const before = a.core.getProductoById(a.product.id).stock;
  await a.s.execute('cancel', { collection: 'ventas', id: sale.id, motivo: 'Devolución', fecha: date });
  assert.equal(a.core.getProductoById(a.product.id).stock, before + 3); assert.equal(a.core.state.ventas.length, 1); assert.equal(a.core.state.ventas[0].estado, 'ANULADA');
  await a.s.execute('cancel', { collection: 'compras', id: purchase.id, motivo: 'Devolución al proveedor', fecha: date });
  assert.equal(a.core.getProductoById(a.product.id).stock, 10); assert.equal(a.core.state.proveedores[0].saldoPendiente, 0); assert.equal(a.core.getCajaYFlujo().flujoNeto, 0);
  assert.equal(a.core.state.devolucionesNegocio.length, 2); assert.equal(a.context.BusinessReportsDomain.build(a.core.state, a.core.state.negocioActivoId, { period: 'TODOS' }).totals.income, '0.00');
});
test('empleados: estados y pagos administrativos persistentes, sin nómina legal ficticia', async () => {
  const a = await setup(), employee = (await a.s.execute('saveEmployee', { nombre: 'Empleado', salario: '100', fechaIngreso: date })).record;
  await a.s.execute('payroll', { empleadoId: employee.id, monto: '50', concepto: 'Anticipo', periodo: '2026-11', fecha: date });
  await a.s.execute('saveEmployee', { ...employee, estado: 'INACTIVO', revision: 1 });
  await assert.rejects(() => a.s.execute('payroll', { empleadoId: employee.id, monto: '1', concepto: 'No permitido', periodo: '2026-11' }), /activo/);
  await a.s.execute('archive', { collection: 'empleados', id: employee.id });
  assert.equal(a.core.state.empleados[0].estado, 'ARCHIVADO'); assert.equal(a.core.state.pagosEmpleado[0].empleadoSnapshot.nombre, 'Empleado');
});
test('producción valida ingredientes acumulados, registra costos y no descuenta insumos al fallar', async () => {
  const a = await setup(), out = (await a.s.execute('saveProduct', { nombre: 'Producto fabricado', stock: '0', precioVenta: '20', costoUnitario: '0' })).record;
  const formula = (await a.s.execute('saveFormula', { nombre: 'Receta', productoId: out.id, cantidadBase: '1', ingredientes: [{ materiaPrimaId: a.product.id, cantidadRequerida: '1' }, { materiaPrimaId: a.product.id, cantidadRequerida: '2' }] })).record;
  const before = JSON.stringify(a.core.state); await assert.rejects(() => a.s.execute('production', { formulaId: formula.id, cantidad: '4', fecha: date }), /insuficiente/); assert.equal(JSON.stringify(a.core.state), before);
  const produced = (await a.s.execute('production', { formulaId: formula.id, cantidad: '2', fecha: date })).record;
  assert.equal(a.core.getProductoById(a.product.id).stock, 4); assert.equal(a.core.getProductoById(out.id).stock, 2); assert.equal(produced.costoTotal, 12); assert.equal(produced.costoUnitario, 6);
  await a.s.execute('archive', { collection: 'formulas', id: formula.id }); assert.equal(a.core.state.producciones[0].formulaSnapshot.nombre, 'Receta');
});
test('concurrencia: facturación y venta comparten el bloqueo y compiten por la misma existencia', async () => {
  const a = await setup(); await a.s.execute('adjustStock', { productoId: a.product.id, nuevoStock: '1', motivo: 'Última unidad' });
  const b = app('mobile.html', { disk: a.disk, locks: a.locks });
  const invoices = new b.context.InvoiceService(b.core), invoice = await invoices.saveDraft({ customer: { name: 'Cliente factura', document: '8888', email: 'f@example.co', address: 'Bogotá' }, date, paymentTerms: 'CONTADO', paymentMethod: 'Efectivo', lines: [{ productId: a.product.id, quantity: '1', unitPrice: '10', taxRate: '0' }] }, randomUUID());
  const results = await Promise.allSettled([a.s.execute('sale', { ...saleData(a), detalles: [{ productoId: a.product.id, cantidad: '1', precioUnitario: '10' }] }), invoices.submit(invoice.id, randomUUID())]);
  const data = JSON.parse(a.disk.get(KEY)).data; assert.equal(data.ventas.length, 1); assert.equal(data.productos[0].stock, 0);
  assert.ok(results.some(r => r.status === 'fulfilled'));
});
test('copias, migración y aislamiento preservan relaciones y rechazan restauraciones inconsistentes', async () => {
  const a = await setup(), purchase = (await a.s.execute('purchase', purchaseData(a))).record, backup = JSON.stringify(a.core.state);
  assert.equal(a.context.FinanzasExportService.validarCopiaSeguridadJSON(backup).error, null);
  const bad = JSON.parse(backup); bad.compras[0].saldoPendiente = 999; assert.ok(a.context.FinanzasExportService.validarCopiaSeguridadJSON(JSON.stringify(bad)).error);
  a.core.state.moduloActivo = 'PERSONAL'; a.core.guardarEstado(); await assert.rejects(() => a.s.execute('saveProduct', { nombre: 'Inválido' }), /exclusivamente/);
  a.core.state.moduloActivo = 'EMPRESARIAL'; a.core.guardarEstado(); a.core.state.usuario.facturacionRol = 'LECTOR'; a.core.guardarEstado(); await assert.rejects(() => a.s.execute('payPurchase', { id: purchase.id, monto: '1' }), /lectura/);
  const restored = a.context.FinanzasExportService.restaurarCopiaSeguridadJSON(backup); assert.equal(restored.error, null); assert.equal(a.core.state.compras[0].saldoPendiente, 15);
});
test('migración de precisión heredada conserva originales y permite operar después de recargar', async () => {
  const a = app(), original = JSON.parse(a.disk.get(KEY));
  original.data.productos = [{ id: 'old', negocioId: 'neg-1', nombre: 'Histórico', stock: 0.30000000000000004, costoUnitario: 1.234567, precioVenta: 5 }];
  delete original.data.businessSchemaVersion; delete original.data.businessLedger;
  a.disk.set(KEY, JSON.stringify(original));
  const loaded = app('mobile.html', { disk: a.disk }); loaded.core.setModuloActivo('EMPRESARIAL');
  assert.equal(loaded.core.state.productos[0].stock, 0.3); assert.equal(loaded.core.state.productos[0].legacyPrecisionOriginal.stock, 0.30000000000000004);
  assert.equal(loaded.core.state.productos[0].costoUnitario, 1.2346);
  await loaded.core.getBusinessService().execute('inventoryMovement', { productoId: 'old', tipo: 'SALIDA', cantidad: '0.1', motivo: 'Salida comprobada' });
  assert.equal(loaded.core.state.productos[0].stock, 0.2);
});
test('costos de compra incluyen descuentos; anulación sin consumo restaura el costo histórico exacto', async () => {
  const a = await setup(), before = a.core.getProductoById(a.product.id).costoUnitario;
  const p = (await a.s.execute('purchase', { ...purchaseData(a), detalles: [{ productoId: a.product.id, cantidad: '5', precioUnitario: '4', descuentoPorcentaje: '25' }] })).record;
  assert.equal(p.total, 15); assert.equal(a.core.getProductoById(a.product.id).costoUnitario, 2.3333);
  await a.s.execute('cancel', { collection: 'compras', id: p.id, motivo: 'Compra corregida', fecha: date });
  assert.equal(a.core.getProductoById(a.product.id).stock, 10); assert.equal(a.core.getProductoById(a.product.id).costoUnitario, before);
});
test('una copia sin negocios puede crear el primero sin duplicarlo al reintentar', async () => {
  const a = app(); a.core.state.negocios = []; a.core.state.negocioActivoId = null; a.core.setModuloActivo('EMPRESARIAL');
  const key = randomUUID(), s = a.core.getBusinessService();
  const first = await s.execute('saveBusiness', { nombre: 'Primer negocio' }, key);
  const again = await s.execute('saveBusiness', { nombre: 'Primer negocio' }, key);
  assert.equal(first.record.id, again.record.id); assert.equal(a.core.state.negocios.length, 1);
});


for (const page of ['desktop.html', 'mobile.html']) test(`${page}: la vista del informe persiste, se aísla por negocio y revierte ante fallo de guardado`, async () => {
  const a = await setup(page), n = a.core.state.negocioActivoId, preferences = { version: 1, period: 'PERSONALIZADO', from: '2026-10-01', to: '2026-11-09', section: 'purchases' };
  const financial = JSON.stringify([a.core.state.ventas, a.core.state.compras, a.core.state.productos, a.core.state.movimientos]);
  const key = randomUUID(); await a.s.execute('saveReportPreferences', preferences, key); await a.s.execute('saveReportPreferences', preferences, key);
  assert.equal(a.core.state.businessLedger.operations.filter(o => o.key === key).length, 1);
  assert.equal(JSON.stringify([a.core.state.ventas, a.core.state.compras, a.core.state.productos, a.core.state.movimientos]), financial);
  const loaded = app(page, { disk: a.disk }); assert.equal(loaded.core.getNegocioActivo().reportPreferences.section, 'purchases');
  assert.equal(loaded.core.getNegocioActivo().reportPreferences.from, '2026-10-01');
  a.setFailure(true); await assert.rejects(() => a.s.execute('saveReportPreferences', { ...preferences, section: 'cash' }), /No se pudo guardar/); a.setFailure(false);
  assert.equal(a.core.getNegocioActivo().reportPreferences.section, 'purchases');
  await assert.rejects(() => a.s.execute('saveReportPreferences', { ...preferences, from: '2026-12-01' }), /Fechas/);
  await assert.rejects(() => a.s.execute('saveReportPreferences', { ...preferences, section: 'constructor' }), /inválida/);
  const second = (await a.s.execute('saveBusiness', { nombre: 'Otro negocio' })).record;
  assert.equal(a.core.getNegocioActivo().reportPreferences, undefined);
  await a.s.execute('saveReportPreferences', { version: 1, period: 'TODOS', section: 'cash' });
  await a.s.execute('selectBusiness', { id: n }); assert.equal(a.core.getNegocioActivo().reportPreferences.section, 'purchases');
  await a.s.execute('selectBusiness', { id: second.id }); assert.equal(a.core.getNegocioActivo().reportPreferences.section, 'cash');
});
