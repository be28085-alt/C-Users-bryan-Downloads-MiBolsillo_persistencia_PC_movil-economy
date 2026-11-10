const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const key = 'FINANZAS_ETAPA_DATA_V2';

const { app } = require('./helpers/browser-core.cjs');
function prepare(instance) {
  instance.core.state.negocios = [{ id: 'n', nombre: 'Prueba' }];
  instance.core.state.negocioActivoId = 'n';
  instance.core.state.moduloActivo = 'EMPRESARIAL';
  instance.core.state.proveedores = [{ id: 's', negocioId: 'n', nombre: 'Proveedor', saldoPendiente: 0 }];
  instance.core.state.productos = [{ id: 'p', negocioId: 'n', nombre: 'Producto', stock: 5, costoUnitario: 3, precioVenta: 10 }];
  instance.core.state.ventas = [];
  instance.core.state.clientes = [];
  instance.core.state.compras = [];
  instance.core.state.movimientosInventario = [];
  instance.core.guardarEstado();
}
const sale = detalles => ({ clienteNombre: 'Prueba', clienteCedula: '123', detalles, fecha: '2026-11-08' });
const line = (cantidad, precioUnitario = 10) => ({ productoId: 'p', cantidad, precioUnitario });

for (const page of ['desktop.html', 'mobile.html']) {
  test(`${page}: rechaza ventas inválidas sin mutar ni guardar`, async () => {
    const a = app(page); prepare(a);
    for (const detalles of [[line(-2)], [line(0)], [line(Infinity)], [line('abc')], [line(1, -1)], [line(1, 0)], [line(1, Infinity)], [line(4), line(4)], [line(1), { productoId: 'otro', cantidad: 1 }]]) {
      const before = JSON.stringify(a.core.state);
      const disk = a.disk.get(key);
      assert.ok((await a.core.registrarVenta(sale(detalles))).error);
      assert.equal(JSON.stringify(a.core.state), before);
      assert.equal(a.disk.get(key), disk);
    }
    assert.ok((await a.core.registrarVenta({ ...sale([line(1)]), fecha: '2026-02-30' })).error);
    assert.equal(a.core.state.productos[0].stock, 5);
  });
  test(`${page}: venta, cartera, abono y kardex consistentes`, async () => {
    const a = app(page); prepare(a);
    const result = (await a.core.registrarVenta({ ...sale([line(2), line(3)]), tipoPago: 'CREDITO' }));
    assert.equal(result.error, null);
    assert.equal(a.core.state.productos[0].stock, 0);
    assert.equal(result.venta.total, 50);
    assert.equal(result.venta.costoTotalVenta, 15);
    assert.equal(a.core.state.clientes[0].saldoPendiente, 50);
    assert.equal(a.core.state.movimientosInventario.length, 1);
    assert.equal(a.core.state.movimientosInventario[0].cantidad, 5);
    const customer = result.venta.clienteId;
    for (const amount of [-1, 0, Infinity, 51, 'abc']) {
      assert.ok((await a.core.registrarAbonoCliente(result.venta.id, customer, amount)).error);
    }
    assert.ok((await a.core.registrarAbonoCliente(result.venta.id, 'otro', 1)).error);
    assert.equal((await a.core.registrarAbonoCliente(result.venta.id, customer, 20)).pagoRegistro.monto, 20);
    assert.equal(a.core.state.ventas[0].saldoPendiente, 30);
    assert.equal(a.core.state.clientes[0].saldoPendiente, 30);
    const saved = JSON.parse(a.disk.get(key)).data;
    assert.equal(saved.productos[0].stock, 0);
    assert.equal(saved.ventas[0].saldoPendiente, 30);
  });
  test(`${page}: compras atómicas y pago cero`, async () => {
    const a = app(page); prepare(a);
    const before = JSON.stringify(a.core.state);
    assert.ok((await a.core.registrarCompra({ proveedorId: 's', detalles: [line(2), line(-1)] })).error);
    assert.equal(JSON.stringify(a.core.state), before);
    assert.ok((await a.core.registrarCompra({ proveedorId: 's', detalles: [line(2)], montoPagado: 25 })).error);
    const result = (await a.core.registrarCompra({ proveedorId: 's', detalles: [line(2)], montoPagado: 0 }));
    assert.equal(result.compra.montoPagado, 0);
    assert.equal(result.compra.saldoPendiente, 20);
    assert.equal(a.core.state.productos[0].stock, 7);
  });
  test(`${page}: fallo empresarial revierte y reintento con misma clave guarda una sola venta`, async () => {
    const a = app(page); prepare(a);
    const disk = a.disk.get(key), before = JSON.stringify(a.core.state), operationKey = a.context.crypto.randomUUID();
    a.setFailure(true);
    const failed = await a.core.registrarVenta(sale([line(1)]), operationKey);
    assert.ok(failed.error); assert.equal(JSON.stringify(a.core.state), before);
    assert.equal(a.storage.hasPendingChanges(), false); assert.equal(a.disk.get(key), disk);
    a.setFailure(false);
    const result = await a.core.registrarVenta(sale([line(1)]), operationKey);
    assert.equal(result.error, null);
    await a.core.registrarVenta(sale([line(1)]), operationKey);
    const saved = JSON.parse(a.disk.get(key)).data;
    assert.equal(saved.ventas.length, 1); assert.equal(saved.productos[0].stock, 4);
    assert.equal(app(page, { disk: a.disk }).core.state.ventas.length, 1);
  });
}
test('dos pestañas empresariales refrescan bajo bloqueo y conservan ambas ventas', async () => {
  const a = app(); prepare(a);
  const b = app('mobile.html', { disk: a.disk, locks: a.locks });
  const [first, second] = await Promise.all([a.core.registrarVenta(sale([line(1)])), b.core.registrarVenta(sale([line(2)]))]);
  assert.equal(first.error, null); assert.equal(second.error, null);
  const saved = JSON.parse(a.disk.get(key)).data;
  assert.equal(saved.ventas.length, 2); assert.equal(saved.productos[0].stock, 2);
});
test('sincronización acepta la revisión actual y descarta eventos antiguos', async () => {
  const a = app(); prepare(a);
  const b = app('mobile.html', { disk: a.disk });
  const old = JSON.parse(a.disk.get(key));
  (await a.core.registrarVenta(sale([line(1)])));
  b.context.MiBolsilloSync.applyIncomingState(JSON.parse(a.disk.get(key)));
  assert.equal(b.core.state.productos[0].stock, 4);
  b.context.MiBolsilloSync.applyIncomingState(old);
  assert.equal(b.core.state.productos[0].stock, 4);
});
test('almacenamiento corrupto queda protegido frente a escrituras', async () => {
  const disk = new Map([[key, '{invalid']]);
  const a = app('desktop.html', { disk });
  a.core.guardarEstado();
  assert.equal(disk.get(key), '{invalid');
  assert.equal(a.storage.getPersistenceStatus().ok, false);
});
test('copia: valida, restaura y protege datos ante errores', async () => {
  const a = app(); prepare(a);
  const service = a.context.FinanzasExportService;
  const backup = JSON.stringify(a.core.state);
  assert.equal(service.validarCopiaSeguridadJSON(backup).error, null);
  for (const value of ['{}', 'null', '{bad', backup.replace('"stock":5', '"stock":-1')]) {
    const before = a.disk.get(key);
    assert.ok(service.restaurarCopiaSeguridadJSON(value).error);
    assert.equal(a.disk.get(key), before);
  }
  (await a.core.registrarVenta(sale([line(1)])));
  assert.equal(service.restaurarCopiaSeguridadJSON(backup).error, null);
  assert.equal(a.core.state.productos[0].stock, 5);
  a.setFailure(true);
  const changed = backup.replace('"stock":5', '"stock":99');
  assert.ok(service.restaurarCopiaSeguridadJSON(changed).error);
  assert.equal(a.core.state.productos[0].stock, 5);
  a.setFailure(false);
  a.storage.retryPendingSave();
  assert.equal(JSON.parse(a.disk.get(key)).data.productos[0].stock, 5);
});

test('aviso accesible: aparece al fallar y desaparece tras reintentar', async () => {
  const a = app(); prepare(a);
  const nodes = [];
  function element(tag) {
    const node = { tag, children: [], attributes: {}, style: {}, setAttribute(k, v) { this.attributes[k] = v; }, append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); } };
    nodes.push(node);
    return node;
  }
  a.context.document = {
    readyState: 'complete', createElement: element,
    body: element('body'), querySelector() { return null; }
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'src/ui/shared/persistenceStatus.js'), 'utf8'), a.context);
  const panel = nodes.find(n => n.tag === 'aside');
  const alert = nodes.find(n => n.attributes.role === 'alert');
  const retry = nodes.find(n => n.textContent === 'Reintentar guardado');
  assert.equal(panel.hidden, true);
  const personalCount = a.core.state.movimientos.length;
  a.setFailure(true);
  a.core.agregarMovimiento({ tipo: 'INGRESO', concepto: 'Prueba', valor: 1, categoria: 'Otros', fecha: '2026-11-08' });
  assert.equal(panel.hidden, false);
  assert.match(alert.textContent, /solo en memoria/);
  assert.equal(retry.hidden, false);
  a.setFailure(false);
  retry.onclick();
  assert.equal(panel.hidden, true);
  assert.equal(JSON.parse(a.disk.get(key)).data.movimientos.length, personalCount + 1);
});

test('todos los scripts locales activos existen y tienen sintaxis válida', async () => {
  for (const page of ['desktop.html', 'mobile.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    for (const [, source] of html.matchAll(/<script\s+src="([^"?]+)(?:\?[^"\s]*)?"/g)) {
      if (!source.startsWith('src/')) continue;
      new vm.Script(fs.readFileSync(path.join(root, source), 'utf8'), { filename: source });
    }
  }
});
