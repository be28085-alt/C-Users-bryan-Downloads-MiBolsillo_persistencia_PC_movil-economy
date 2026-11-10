const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID, webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const storageKey = 'FINANZAS_ETAPA_DATA_V2';
function locks() {
  let queue = Promise.resolve();
  return { request(name, options, fn) { const result = queue.then(fn); queue = result.catch(() => {}); return result; } };
}
function setup({ disk = new Map(), lock = locks(), page = 'desktop.html', seed = true } = {}) {
  let fail = false;
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error() {} }, document: { readyState: 'loading', addEventListener() {} }, setTimeout, clearTimeout, URL, Uint8Array, TextEncoder, crypto: { randomUUID, subtle: webcrypto.subtle }, navigator: { locks: lock }, location: { origin: 'http://localhost:5500', pathname: `/${page}` }, localStorage: { getItem: k => disk.get(k) ?? null, setItem(k, v) { if (fail) throw new Error('QuotaExceededError'); disk.set(k, v); } }, addEventListener() {} });
  ctx.window = ctx;
  for (const [, source] of fs.readFileSync(path.join(root, page), 'utf8').matchAll(/<script\s+src="([^"?]+)/g)) {
    if (!source.startsWith('src/') || ['src/utils/desktop.js', 'src/utils/mobile.js', 'src/ui/shared/persistenceStatus.js'].includes(source)) continue;
    vm.runInContext(fs.readFileSync(path.join(root, source), 'utf8'), ctx, { filename: source });
  }
  const core = ctx.Finanzas;
  if (seed) {
    Object.assign(core.state, { moduloActivo: 'EMPRESARIAL', negocioActivoId: 'n', negocios: [{ id: 'n', nombre: 'Negocio Ágil', direccion: 'Bogotá', email: 'n@example.co' }], productos: [{ id: 'p', negocioId: 'n', nombre: 'Café & Pan <especial>', stock: 10, costoUnitario: '1.2345', precioVenta: '10.0050', unidadMedida: 'UND' }], ventas: [], clientes: [], movimientosInventario: [], pagosVenta: [], ingresosNegocio: [], facturacion: undefined });
    core.guardarEstado();
  }
  return { ctx, core, disk, service: new ctx.InvoiceService(core), lock, failure: v => { fail = v; } };
}
const line = overrides => ({ productId: 'p', quantity: '1', unitPrice: '10.0050', discountPercent: '10', taxKind: 'IVA', taxRate: '19', ...overrides });
const input = overrides => ({ date: '2026-11-09', dueDate: '2026-12-09', customer: { name: 'María Gómez', documentType: 'CC', document: '123456789', email: 'maria@example.co', address: 'Calle 10 # 5-20', phone: '3001234567' }, paymentTerms: 'CREDITO', paymentMethod: 'Transferencia', lines: [line()], ...overrides });
async function issue(a, overrides = {}) { const d = await a.service.saveDraft(input(overrides), randomUUID()); return a.service.submit(d.id, randomUUID()); }
async function adjustment(a, d, overrides = {}) {
  return a.service.saveDraft(input({ kind: 'CREDIT_NOTE', originalId: d.id, reason: 'Devolución acordada', lines: [line({ productId: null, description: 'Descuento comercial', unitPrice: '1', discountPercent: '0' })], ...overrides }), randomUUID());
}

test('motor decimal: HALF_UP por línea, descuentos, impuestos agrupados y fracciones exactas', () => {
  const { ctx } = setup(), M = ctx.InvoiceMoney;
  const t = M.calculate([line(), line({ quantity: '0.3333', unitPrice: '1', discountPercent: '0', taxRate: '5' })]);
  assert.equal(t.lines[0].gross, '10.01'); assert.equal(t.lines[0].discount, '1.00'); assert.equal(t.lines[0].base, '9.01'); assert.equal(t.lines[0].tax, '1.71'); assert.equal(t.total, '11.07');
  assert.equal(M.calculate([line({ quantity: '0.1', unitPrice: '0.2', discountPercent: '0', taxRate: '0' })]).total, '0.02');
  assert.equal(M.calculate([line({ unitPrice: '0.005', discountPercent: '0', taxRate: '0' })]).total, '0.01');
  for (const v of ['1e3', '-1', 'NaN', 'Infinity', '1,23', '1.23456', '']) assert.throws(() => M.units(v, 4));
  for (const l of [line({ quantity: '0' }), line({ discountPercent: '101' }), line({ taxRate: '101' }), line({ taxKind: 'EXENTO' })]) assert.throws(() => M.calculate([l]));
  assert.throws(() => M.calculate([line({ unitPrice: '1000000000001' })]));
});

for (const page of ['desktop.html', 'mobile.html']) {
  test(`${page}: confirmación atómica, snapshots, reportes, filtros y persistencia`, async () => {
    const a = setup({ page }), personal = JSON.stringify({ movimientos: a.core.state.movimientos, metas: a.core.state.metas, deudas: a.core.state.deudas });
    const d = await issue(a);
    assert.equal(d.status, 'VALIDADA_INTERNA'); assert.equal(d.number, 'SIM-FV-000001'); assert.equal(d.compliance.officialCufe, null);
    assert.equal(a.core.state.ventas.length, 1); assert.equal(a.core.state.productos[0].stock, 9); assert.equal(a.core.state.clientes[0].saldoPendiente, 10.72);
    assert.equal(a.core.calcularMetricasEmpresariales('n', 'TODOS').ventasTotales, 9.01);
    assert.equal(a.core.calcularMetricasEmpresariales('n', 'TODOS').costoProductosVendidos, 1.23);
    assert.equal(a.service.list({ customer: 'María', min: '10', max: '11', number: '000001', status: 'VALIDADA_INTERNA', from: '2026-11-09', to: '2026-11-09' }).length, 1);
    assert.equal(a.service.list({ min: '12' }).length, 0);
    a.core.state.productos[0].nombre = 'Nuevo'; a.core.state.clientes[0].nombre = 'Otra persona'; a.core.guardarEstado();
    assert.equal(a.service.get(d.id).customer.name, 'María Gómez'); assert.equal(a.service.get(d.id).totals.lines[0].description, 'Café & Pan <especial>');
    const b = setup({ disk: a.disk, seed: false, page }); assert.equal(b.service.get(d.id).number, d.number);
    assert.equal(JSON.stringify({ movimientos: a.core.state.movimientos, metas: a.core.state.metas, deudas: a.core.state.deudas }), personal);
    assert.ok(a.service.auditTrail(d.id).some(e => e.action === 'VALIDADA_INTERNA'));
    await assert.rejects(() => a.service.saveDraft({ ...input(), id: d.id, revision: d.revision }, randomUUID()), /inmutable/);
  });
}
test('doble clic, reintento y recarga mantienen una sola venta, pago y salida', async () => {
  const a = setup(), saveKey = randomUUID();
  const [d, duplicate] = await Promise.all([a.service.saveDraft(input({ paymentTerms: 'CONTADO' }), saveKey), a.service.saveDraft(input({ paymentTerms: 'CONTADO' }), saveKey)]);
  assert.equal(d.id, duplicate.id);
  const submitKey = randomUUID();
  await Promise.all([a.service.submit(d.id, submitKey), a.service.submit(d.id, submitKey), a.service.submit(d.id, randomUUID())]);
  const b = setup({ disk: a.disk, seed: false }); await b.service.submit(d.id, submitKey);
  assert.equal(b.core.state.ventas.length, 1); assert.equal(b.core.state.pagosVenta.length, 1); assert.equal(b.core.state.movimientosInventario.length, 1);
  await assert.rejects(() => a.service.saveDraft(input({ notes: 'changed' }), saveKey), /otros datos/);
});
test('dos pestañas comparten consecutivos y no sobrevenden el último stock', async () => {
  const a = setup(); a.core.state.productos[0].stock = 1; a.core.guardarEstado();
  const b = setup({ disk: a.disk, lock: a.lock, seed: false });
  const da = await a.service.saveDraft(input(), randomUUID()), db = await b.service.saveDraft(input(), randomUUID());
  const results = await Promise.all([a.service.submit(da.id, randomUUID()), b.service.submit(db.id, randomUUID())]);
  assert.deepEqual(results.map(d => d.status).sort(), ['RECHAZADA_INTERNA', 'VALIDADA_INTERNA']);
  const saved = JSON.parse(a.disk.get(storageKey)).data;
  assert.equal(saved.ventas.length, 1); assert.equal(saved.productos[0].stock, 0); assert.equal(saved.facturacion.sequences['n:INVOICE'], 2);
});
test('fallo de escritura revierte el borrador y permite reintento con misma clave', async () => {
  const a = setup(), before = JSON.stringify(a.core.state), disk = a.disk.get(storageKey), k = randomUUID();
  a.failure(true); await assert.rejects(() => a.service.saveDraft(input(), k), /No se pudo guardar/);
  assert.equal(JSON.stringify(a.core.state), before); assert.equal(a.disk.get(storageKey), disk); assert.equal(a.ctx.FinanzasStorage.hasPendingChanges(), false);
  a.failure(false);
  const d = await a.service.saveDraft(input(), k); assert.equal(a.service.list().length, 1); assert.ok(d.id);
});
test('error al finalizar conserva EN_VALIDACION y permite recuperación sin efectos parciales', async () => {
  const a = setup(); const d = await a.service.saveDraft(input(), randomUUID());
  a.service.provider = { async validate() { a.failure(true); return { accepted: true, source: 'INTERNAL_SIMULATION', errors: [] }; } };
  await assert.rejects(() => a.service.submit(d.id, randomUUID()), /No se pudo guardar/);
  assert.equal(a.service.get(d.id).status, 'EN_VALIDACION_SIMULADA'); assert.equal(a.core.state.ventas.length, 0);
  const b = setup({ disk: a.disk, seed: false }); const result = await b.service.submit(d.id, randomUUID());
  assert.equal(result.status, 'VALIDADA_INTERNA'); assert.equal(b.core.state.ventas.length, 1);
});
test('rechazo interno, edición con revisión y proveedor real desactivado', async () => {
  const a = setup(); let d = await issue(a, { customer: { ...input().customer, address: '' } });
  assert.equal(d.status, 'RECHAZADA_INTERNA'); assert.equal(a.core.state.ventas.length, 0);
  await assert.rejects(() => a.service.saveDraft({ ...input(), id: d.id, revision: 0 }, randomUUID()), /otra pestaña/);
  d = await a.service.saveDraft({ ...input(), id: d.id, revision: d.revision }, randomUUID());
  d = await a.service.submit(d.id, randomUUID()); assert.equal(d.status, 'VALIDADA_INTERNA'); assert.equal(d.number, 'SIM-FV-000001');
  await assert.rejects(() => new a.ctx.RealDianProvider().validate(d), /deshabilitada/);
});
test('notas parciales, débito, pago idempotente y devolución al reducir importe pagado', async () => {
  const a = setup(), d = await issue(a);
  const paymentKey = randomUUID(); await a.service.pay(d.id, '5.00', 'Efectivo', paymentKey); await a.service.pay(d.id, '5.00', 'Efectivo', paymentKey);
  assert.equal(a.core.state.pagosVenta.length, 1); assert.equal(a.core.state.ventas[0].saldoPendiente, 5.72);
  assert.ok((await a.core.registrarAbonoCliente(a.core.state.ventas[0].id, a.core.state.clientes[0].id, 1)).error);
  let note = await adjustment(a, d); note = await a.service.submit(note.id, randomUUID()); assert.equal(note.status, 'VALIDADA_INTERNA');
  assert.equal(a.core.state.ventas[0].total, 9.53); assert.equal(a.core.state.productos[0].stock, 9);
  let debit = await adjustment(a, d, { kind: 'DEBIT_NOTE' }); debit = await a.service.submit(debit.id, randomUUID()); assert.equal(debit.status, 'VALIDADA_INTERNA'); assert.equal(a.core.state.ventas[0].total, 10.72);
  await a.service.pay(d.id, '5.72', 'Tarjeta', randomUUID());
  let credit = await adjustment(a, d); await a.service.submit(credit.id, randomUUID());
  assert.equal(a.core.state.facturacion.refunds[0].amount, '1.19'); assert.equal(a.core.state.ventas[0].saldoPendiente, 0);
  assert.equal(a.core.getCajaYFlujo().totalEntradas, 10.72); assert.equal(a.core.getCajaYFlujo().totalSalidas, 1.19);
  const retry = await adjustment(a, d, { lines: [line({ productId: null, description: 'exceso', unitPrice: '100' })] });
  assert.equal((await a.service.submit(retry.id, randomUUID())).status, 'RECHAZADA_INTERNA');
  assert.equal(a.core.state.ventas[0].total, 9.53);
});
test('anulación total mediante nota crédito revierte stock, cartera, costos y reembolsa contado', async () => {
  const a = setup(), d = await issue(a, { paymentTerms: 'CONTADO' });
  const note = await adjustment(a, d, { cancellation: true });
  await a.service.submit(note.id, randomUUID()); await a.service.submit(note.id, randomUUID());
  assert.equal(a.service.get(d.id).status, 'ANULADA'); assert.equal(a.core.state.productos[0].stock, 10); assert.equal(a.core.state.ventas[0].total, 0); assert.equal(a.core.state.clientes[0].saldoPendiente, 0);
  assert.equal(a.core.state.facturacion.refunds.length, 1); assert.equal(a.core.state.facturacion.refunds[0].amount, '10.72'); assert.equal(a.core.calcularMetricasEmpresariales('n', 'TODOS').ventasTotales, 0);
  await assert.rejects(() => a.service.pay(d.id, '1', 'Efectivo', randomUUID()), /validadas/);
  assert.equal(a.ctx.FinanzasExportService.validarCopiaSeguridadJSON(JSON.stringify(a.core.state)).error, null);
});
test('copias de facturación: restaura todo el agregado y rechaza importes, claves y referencias alteradas', async () => {
  const a = setup(), d = await issue(a), backup = JSON.stringify(a.core.state), exp = a.ctx.FinanzasExportService;
  for (const mutate of [
    s => { s.facturacion.documents[0].totals.total = '999.00'; },
    s => { s.facturacion.documents[0].totals.lines[0].tax = '0.00'; },
    s => { s.facturacion.documents[0].compliance.fiscalValidity = true; },
    s => { s.facturacion.operations.push(s.facturacion.operations[0]); },
    s => { s.facturacion.sequences = {}; },
    s => { s.ventas = []; }
  ]) {
    const bad = JSON.parse(backup); mutate(bad); const before = a.disk.get(storageKey);
    assert.ok(exp.restaurarCopiaSeguridadJSON(JSON.stringify(bad)).error); assert.equal(a.disk.get(storageKey), before);
  }
  await a.service.pay(d.id, '1', 'Efectivo', randomUUID());
  assert.equal(exp.restaurarCopiaSeguridadJSON(backup).error, null);
  assert.equal(a.core.state.ventas[0].saldoPendiente, 10.72); assert.equal(a.core.state.pagosVenta.length, 0);
  a.core.state.negocios.push({ id: 'second', nombre: 'Segundo' }); a.core.guardarEstado();
  assert.ok((await a.core.eliminarNegocio('n')).error); const archived = await a.core.eliminarCliente(a.core.state.clientes[0].id); assert.equal(archived.record.estado, 'ARCHIVADO');
  assert.throws(() => a.service.list({ min: '50', max: '1' }), /límite/);
  assert.throws(() => a.service.list({ from: '2026-12-01', to: '2026-01-01' }), /límite/);
});
test('permisos, aislamiento de negocios, datos inválidos y bloqueo sin Web Locks', async () => {
  const a = setup(), d = await issue(a);
  a.core.state.usuario.facturacionRol = 'LECTOR'; a.core.guardarEstado();
  assert.equal(a.service.get(d.id).id, d.id); await assert.rejects(() => a.service.saveDraft(input(), randomUUID()), /permiso/);
  a.core.state.usuario.facturacionRol = 'PROPIETARIO_LOCAL'; a.core.state.moduloActivo = 'PERSONAL'; a.core.guardarEstado();
  assert.throws(() => a.service.list(), /exclusivamente/);
  a.core.state.moduloActivo = 'EMPRESARIAL'; a.core.state.negocios.push({ id: 'other' }); a.core.state.negocioActivoId = 'other'; a.core.guardarEstado();
  assert.throws(() => a.service.get(d.id), /no encontrado/);
  await assert.rejects(() => a.service.saveDraft(input(), randomUUID()), /producto/);
  a.core.state.negocioActivoId = 'n'; a.core.guardarEstado();
  for (const bad of [input({ date: '2026-02-30' }), input({ dueDate: '2026-01-01' }), input({ customer: { ...input().customer, email: 'bad' } })]) await assert.rejects(() => a.service.saveDraft(bad, randomUUID()));
  a.ctx.navigator.locks = null; await assert.rejects(() => a.service.saveDraft(input(), randomUUID()), /bloquear/);
});
test('XML experimental para los tres tipos, escape, PDF multipágina y QR interno', async () => {
  const a = setup(), d = await issue(a);
  const x = a.ctx.InvoiceExports.xml(d);
  assert.match(x, /SIMULACIÓN SIN VALIDEZ FISCAL/); assert.match(x, /Café &amp; Pan &lt;especial&gt;/); assert.doesNotMatch(x, /<cbc:UUID|<ds:Signature/);
  assert.throws(() => a.ctx.InvoiceExports.xml(d, 'CONFORMANT'), /deshabilitada/);
  for (const [kind, tag] of [['CREDIT_NOTE', 'CreditNote'], ['DEBIT_NOTE', 'DebitNote']]) {
    const note = await adjustment(a, d, { kind }); assert.match(a.ctx.InvoiceExports.xml(note), new RegExp(`<${tag} xmlns=`));
  }
  assert.match(a.ctx.InvoiceExports.consultationUrl(d), /localhost:5500\/desktop.html\?modulo=EMPRESARIAL&facturaSimulada=/);
  assert.ok(a.ctx.InvoiceExports.qr(d).getModuleCount() > 20);
  const bytes = a.ctx.InvoiceExports.pdf(d), text = Buffer.from(bytes).toString('latin1');
  assert.match(text, /%PDF-1.4/); assert.match(text, /SIN VALIDEZ FISCAL/); assert.match(text, /QR DE CONSULTA INTERNA/);
  const long = JSON.parse(JSON.stringify(d)); long.totals.lines = Array.from({ length: 100 }, (_, i) => ({ ...d.totals.lines[0], description: `Artículo ${i} ` + 'descripción extensa '.repeat(8) }));
  assert.ok(Number(/\/Count (\d+)/.exec(Buffer.from(a.ctx.InvoiceExports.pdf(long)).toString('latin1'))[1]) > 1);
  assert.equal(a.ctx.FinanzasExportService.validarCopiaSeguridadJSON(JSON.stringify(a.core.state)).error, null);
});

module.exports = { setup, input, issue, adjustment };
