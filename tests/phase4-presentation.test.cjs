'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { app } = require('./helpers/browser-core.cjs');

function controller(a, mobile, nodes = new Map()) {
  a.context.document.getElementById = id => nodes.get(id) || null;
  vm.runInContext(fs.readFileSync(mobile ? 'src/utils/mobile.js' : 'src/utils/desktop.js', 'utf8'), a.context);
  return nodes;
}

function csvBrowser(a) {
  const blobs = [], links = [], revoked = [], timers = [];
  a.context.Blob = Blob;
  a.context.URL = { createObjectURL(blob) { blobs.push(blob); return 'blob:synthetic-' + blobs.length; }, revokeObjectURL(url) { revoked.push(url); } };
  a.context.setTimeout = (callback, delay) => { timers.push({ callback, delay }); };
  a.context.document.body = { appendChild() {}, removeChild() {} };
  a.context.document.createElement = () => {
    const link = { click() { links.push({ href: this.href, download: this.download }); } };
    return link;
  };
  return { blobs, links, revoked, timers };
}

test('el filtro personal conserva orden, identidad y campos de búsqueda propios de cada cliente', () => {
  const { context } = app();
  const records = [
    { id: 'primero', tipo: 'GASTO', categoria: 'Alimentación', concepto: 'Mercado', cuenta: 'Caja especial' },
    { id: 'segundo', tipo: 'INGRESO', categoria: 'Salario', concepto: 'Caja mensual', cuenta: 'Banco' },
    { id: 'tercero', tipo: 'GASTO', categoria: 'Alimentación', concepto: 'Mercado adicional', cuenta: 'Banco' }
  ];
  const before = JSON.stringify(records), filter = context.PersonalMovementsDomain.filtrarMovimientos;
  assert.deepEqual(Array.from(filter(records, { tipo: 'GASTO', categoria: 'Alimentación', busqueda: ' MERCADO ' }), item => item.id), ['primero','tercero']);
  assert.strictEqual(filter(records, { busqueda: 'especial' })[0], records[0]);
  assert.equal(filter(records, { busqueda: 'especial', campos: ['concepto','categoria'] }).length, 0);
  assert.equal(JSON.stringify(records), before);
  assert.deepEqual(Array.from(filter(records), item => item.id), ['primero','segundo','tercero']);
});

test('la proyección de presupuesto no guarda, redondea ni modifica los importes de entrada', () => {
  const { context } = app();
  const domain = context.PersonalBudgetDomain;
  assert.equal(domain.clavePeriodo(2026, 0), '2026-01');
  assert.equal(domain.clavePeriodo(2026, 11), '2026-12');
  const values = { tipo: 'GASTO', valor: '10.125', saldoActual: 100, presupuesto: { limite: 100, gastado: 90 }, gastoCategoria: 1, limiteCategoria: 100 };
  const before = JSON.stringify(values), projection = domain.proyectarMovimiento(values);
  assert.equal(projection.saldoProyectado, 89.875); assert.equal(projection.monto, 10.125);
  assert.equal(projection.impactoPresupuesto, 10.125); assert.equal(projection.excedePresupuesto, true);
  assert.equal(projection.excedeCategoria, false); assert.equal(JSON.stringify(values), before);
  const income = domain.proyectarMovimiento({ ...values, tipo: 'INGRESO' });
  assert.equal(income.saldoProyectado, 110.125); assert.equal(income.excedePresupuesto, false); assert.equal(income.excedeCategoria, false);
  assert.equal(domain.proyectarMovimiento({ ...values, valor: 10 }).excedePresupuesto, false, 'alcanzar el límite no significa superarlo');
  for (const valor of ['', 'texto', Infinity, -1]) assert.equal(domain.proyectarMovimiento({ ...values, valor }).monto, 0);
});

for (const mobile of [false, true]) {
  const page = mobile ? 'mobile.html' : 'desktop.html';
  test(page + ': conserva el alcance de búsqueda visible de movimientos', () => {
    const a = app(page), nodes = new Map();
    a.core.state.periodoAnio = 2026; a.core.state.periodoMes = 10;
    a.core.state.movimientos = [{ id: 'm', tipo: 'GASTO', concepto: 'Compra sintética', categoria: 'Otros', cuenta: 'Cuenta exclusiva', valor: 10, fecha: '2026-11-26' }];
    const container = mobile ? 'mobileGroupedTransactionsList' : 'tableFullMovements';
    nodes.set(container, { innerHTML: '' });
    nodes.set(mobile ? 'mobileInputSearch' : 'inputMovSearchTable', { value: 'exclusiva' });
    controller(a, mobile, nodes);
    vm.runInContext(mobile ? 'mobileApp.renderizarMovimientos()' : 'pcApp.renderMovimientos()', a.context);
    assert.equal(nodes.get(container).innerHTML.includes('Compra sintética'), !mobile);
  });

  test(page + ': conserva saldos, porcentajes y avisos propios usando la proyección compartida', () => {
    const a = app(page), nodes = new Map();
    a.core.calcSaldoTotal = () => 100;
    a.core.calcPresupuestoStatus = () => ({ limite: 100, gastado: 10 });
    a.core.calcGastosPorCategoria = () => ({ Alimentación: 10 });
    a.core.getLimitesCategorias = () => ({ Alimentación: 15 });
    for (const id of mobile
      ? ['mobInputMonto','mobSelectCategoria','mobLblSaldoActual','mobLblSaldoProyectado','mobLblRegCategory','mobLblBudgetImpact','mobRegImpactAlert']
      : ['regInputMonto','lblLiveImpactAmount','lblLiveImpactCategory','lblLiveCurrentBalance','lblLiveProjectedBalance','lblLiveBudgetImpact','liveLogicNoticeArea']) nodes.set(id, { value: '', innerHTML: '', textContent: '' });
    nodes.get(mobile ? 'mobInputMonto' : 'regInputMonto').value = '20';
    if (mobile) nodes.get('mobSelectCategoria').value = 'Alimentación';
    controller(a, mobile, nodes);
    vm.runInContext(mobile ? 'mobileApp.updateLiveImpact()' : 'pcApp.updateLiveImpact()', a.context);
    assert.equal(nodes.get(mobile ? 'mobLblSaldoProyectado' : 'lblLiveProjectedBalance').textContent, a.context.formatCOP(80));
    assert.equal(nodes.get(mobile ? 'mobLblBudgetImpact' : 'lblLiveBudgetImpact').textContent, '+20.0% del presupuesto');
    assert.equal(mobile ? nodes.get('mobRegImpactAlert').textContent.includes('categoría') : Boolean(nodes.get('liveLogicNoticeArea').innerHTML), mobile,
      'móvil avisa por categoría; PC conserva su aviso mensual');
    vm.runInContext(mobile ? "mobileApp.modalType='INGRESO'; mobileApp.updateLiveImpact()" : "pcApp.formType='INGRESO'; pcApp.updateLiveImpact()", a.context);
    assert.equal(nodes.get(mobile ? 'mobLblSaldoProyectado' : 'lblLiveProjectedBalance').textContent, a.context.formatCOP(120));
    assert.equal(nodes.get(mobile ? 'mobLblBudgetImpact' : 'lblLiveBudgetImpact').textContent, 'Aporte a liquidez');
    assert.equal(mobile ? nodes.get('mobRegImpactAlert').textContent : nodes.get('liveLogicNoticeArea').innerHTML, '');
  });

  test(page + ': el CSV conserva bytes, período, nombre y neutralización de fórmulas', async () => {
    const a = app(page); a.core.state.periodoAnio = 2026; a.core.state.periodoMes = 10;
    a.core.state.movimientos = [
      { id: 'm', tipo: 'INGRESO', concepto: '=1+1', categoria: 'Otros', valor: 12.5, fecha: '2026-11-26' },
      { id: 'anterior', tipo: 'GASTO', concepto: 'No exportar', categoria: 'Otros', valor: 1, fecha: '2026-10-26' }
    ];
    const before = JSON.stringify(a.core.state), output = csvBrowser(a);
    controller(a, mobile);
    vm.runInContext(mobile ? 'mobileApp.mostrarToast=()=>{}; mobileApp.exportarCSV()' : 'pcApp.showToast=()=>{}; pcApp.exportarCSV()', a.context);
    assert.equal(output.links[0].download, 'mibolsillo_movimientos_2026_11' + (mobile ? '_movil' : '') + '.csv');
    const expected = 'ID,Tipo,Concepto,Categoria,Cuenta,Monto_COP,Fecha\n"m","INGRESO","\'=1+1","Otros","Principal",12.50,"2026-11-26"\n';
    assert.deepEqual(Buffer.from(await output.blobs[0].arrayBuffer()), Buffer.from(expected));
    assert.equal(output.blobs[0].type, 'text/csv;charset=utf-8;');
    assert.equal(output.timers[0].delay, 1000); assert.equal(output.revoked.length, 0);
    output.timers[0].callback(); assert.equal(output.revoked[0], output.links[0].href);
    assert.equal(JSON.stringify(a.core.state), before);
  });
}

test('el exportador CSV anterior conserva BOM y revocación inmediata por defecto', async () => {
  const a = app(), output = csvBrowser(a);
  a.context.FinanzasExportService.descargarCSV('existente', 'uno;dos');
  assert.equal(output.links[0].download, 'existente.csv');
  assert.deepEqual(Buffer.from(await output.blobs[0].arrayBuffer()), Buffer.from('\uFEFFuno;dos'));
  assert.equal(output.timers.length, 0); assert.equal(output.revoked[0], output.links[0].href);
});
