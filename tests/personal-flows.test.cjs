'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./helpers/browser-core.cjs');

for (const page of ['desktop.html', 'mobile.html']) {
  test(page + ': metas sobrecumplidas no cubren otras metas y las cuotas saldadas dejan de sumar', async () => {
    const a = app(page), c = a.core;
    c.state.metas = []; c.state.aportesMetas = []; c.state.deudas = []; c.state.movimientos = [];
    (await c.agregarMeta({ nombre: 'Cumplida', objetivo: 10000, ahorrado: 20000 }));
    (await c.agregarMeta({ nombre: 'Pendiente', objetivo: 10000 }));
    assert.equal(c.calcTotalRestanteMetas(), 10000);
    const d = (await c.agregarDeuda({ nombre: 'Cuota', valorInicial: 10000, cuotaMensual: 2000 }));
    assert.equal(c.getDeudas().cuotaMensualTotal, 2000);
    (await c.abonarDeuda(d.id, 10000));
    assert.equal(c.getDeudas().cuotaMensualTotal, 0);
    (await c.agregarMovimiento({ tipo: 'INGRESO', concepto: 'Ingreso del mes', valor: 10000, fecha: '2026-11-10' }));
    c.state.aportesMetas = [{ valor: 1000, fecha: '2026-11-10' }, { valor: 9000, fecha: '2026-10-10' }];
    assert.equal(c.calcTasaAhorro(), 10);
  });

  test(page + ': el período filtra totales, categorías y presupuesto sin modificar el saldo global', async () => {
    const a = app(page), c = a.core;
    c.state.movimientos = [];
    (await c.setSaldoInicial(500));
    (await c.agregarMovimiento({ tipo: 'GASTO', concepto: 'Anterior', categoria: 'Otros', valor: 2000, fecha: '2026-10-10' }));
    (await c.agregarMovimiento({ tipo: 'GASTO', concepto: 'Actual', categoria: 'Otros', valor: 1000, fecha: '2026-11-10' }));
    (await c.agregarMovimiento({ tipo: 'INGRESO', concepto: 'Actual', valor: 4000, fecha: '2026-11-10' }));
    (await c.actualizarPresupuesto(800));
    assert.equal(c.calcTotalGastos(), 1000);
    assert.equal(c.calcTotalIngresos(), 4000);
    assert.equal(c.calcBalanceNeto(), 3000);
    assert.equal(c.calcSaldoTotal(), 1500);
    assert.equal(c.calcGastosPorCategoria().Otros, 1000);
    assert.equal(c.calcPresupuestoStatus().porcentajeReal, 125);
    assert.equal(c.getPresupuestoPeriodo(), 800);
    assert.equal(c.getPresupuesto().gastado, 1000);
    assert.equal((await c.cambiarPeriodo(-1)).error, undefined);
    assert.equal(c.calcTotalGastos(), 2000);
    assert.equal(c.calcTotalIngresos(), 0);
    assert.match(c.getNombrePeriodo(), /Octubre.*2026/);
    assert.equal(c.calcSaldoTotal(), 1500);
    (await c.cambiarPeriodo(3));
    assert.equal(c.state.periodoMes, 0); assert.equal(c.state.periodoAnio, 2027);
    const reopened = app(page, { disk: a.disk }).core;
    assert.match(reopened.getNombrePeriodo(), /Enero.*2027/);
    assert.equal(reopened.calcTotalGastos(), 0);
    assert.equal(reopened.calcSaldoTotal(), 1500);
  });

  test(page + ': metas y deudas guardan importes e historial, rechazan sobrepagos y limpian relaciones', async () => {
    const a = app(page), c = a.core;
    const meta = (await c.agregarMeta({ nombre: 'Viaje', objetivo: 20000, ahorrado: 1000, plazo: 'Diciembre de 2027' }));
    assert.ok(meta.id);
    assert.equal((await c.aportarMeta(meta.id, 2500)).valor, 2500);
    const deuda = (await c.agregarDeuda({ nombre: 'Equipo', valorInicial: 10000, cuotaMensual: 2000, condiciones: 'Sin interés' }));
    assert.equal((await c.abonarDeuda(deuda.id, 2500)).monto, 2500);
    assert.ok((await c.abonarDeuda(deuda.id, 7501)).error);
    let reopened = app(page, { disk: a.disk }).core;
    assert.equal(reopened.state.metas.find(m => m.id === meta.id).ahorrado, 3500);
    assert.equal(reopened.state.metas.find(m => m.id === meta.id).plazo, 'Diciembre de 2027');
    assert.equal(reopened.state.aportesMetas.find(m => m.metaId === meta.id && m.valor === 2500).metaNombre, 'Viaje');
    assert.equal(reopened.state.deudas.find(d => d.id === deuda.id).saldoPendiente, 7500);
    assert.equal(reopened.state.deudas.find(d => d.id === deuda.id).condiciones, 'Sin interés');
    assert.equal(reopened.state.abonosDeudas.find(d => d.deudaId === deuda.id).deudaNombre, 'Equipo');
    (await c.abonarDeuda(deuda.id, 7500));
    assert.equal(c.getDeudas().deudasEnriquecidas.find(d => d.id === deuda.id).saldada, true);
    assert.equal((await c.eliminarMeta(meta.id)), true);
    assert.equal((await c.eliminarDeuda(deuda.id)), true);
    reopened = app(page, { disk: a.disk }).core;
    assert.equal(reopened.state.aportesMetas.some(a => a.metaId === meta.id), false);
    assert.equal(reopened.state.abonosDeudas.some(a => a.deudaId === deuda.id), false);
  });

  test(page + ': todos los escritores personales conservan estado y disco al fallar, y permiten reintentar', async () => {
    const a = app(page), c = a.core;
    const meta = (await c.agregarMeta({ nombre: 'Meta', objetivo: 5000 }));
    const deuda = (await c.agregarDeuda({ nombre: 'Deuda', valorInicial: 10000 }));
    const writes = [
      async () => (await c.agregarMovimiento({ tipo: 'GASTO', concepto: 'Reintento', valor: 1500, fecha: '2026-11-10' })),
      async () => (await c.agregarMeta({ nombre: 'Nueva meta', objetivo: 2000 })),
      async () => (await c.agregarDeuda({ nombre: 'Nueva deuda', valorInicial: 3000 })),
      async () => (await c.aportarMeta(meta.id, 1000)), async () => (await c.abonarDeuda(deuda.id, 2000)),
      async () => (await c.actualizarPerfil({ nombre: 'Nombre editado', email: 'nuevo@example.test', saldoInicial: 123 })),
      async () => (await c.actualizarPresupuesto(5000)), async () => (await c.actualizarLimiteCategoria('Otros', 1000)),
      async () => (await c.actualizarSaldoInicial(123)), async () => (await c.cambiarPeriodo(1)),
      async () => (await c.toggleSaldoOculto()), async () => (await c.actualizarPreferencia('recordatoriosDeudas', false))
    ];
    const before = JSON.stringify(c.state), disk = a.storage.getRawState();
    a.setFailure(true);
    for (const write of writes) {
      assert.ok((await write()).error);
      assert.equal(JSON.stringify(c.state), before);
      assert.equal(a.storage.getRawState(), disk);
      assert.equal(a.storage.hasPendingChanges(), false);
    }
    assert.equal((await c.eliminarMeta(meta.id)), false);
    assert.equal((await c.eliminarDeuda(deuda.id)), false);
    a.setFailure(false);
    for (const write of writes) assert.equal((await write()).error, undefined);
    const reopened = app(page, { disk: a.disk }).core;
    assert.equal(reopened.state.movimientos.filter(m => m.concepto === 'Reintento').length, 1);
    assert.equal(reopened.state.usuario.email, 'nuevo@example.test');
    assert.equal(reopened.state.saldoInicial, 123);
    assert.equal(reopened.state.usuario.recordatoriosDeudas, false);
    assert.equal(reopened.state.aportesMetas.filter(a => a.metaId === meta.id).length, 1);
    assert.equal(reopened.state.abonosDeudas.filter(a => a.deudaId === deuda.id).length, 1);
  });

  test(page + ': entradas inválidas no se convierten en movimientos, aportes ni deudas válidas', async () => {
    const a = app(page), c = a.core;
    const before = a.storage.getRawState();
    for (const value of [-1, Infinity, NaN, '', null, 1e13, 0]) {
      assert.ok((await c.agregarMovimiento({ tipo: 'INGRESO', concepto: 'Inválido', valor: value, fecha: '2026-11-10' })).error);
      assert.ok((await c.agregarMeta({ nombre: 'Inválida', objetivo: value })).error);
      assert.ok((await c.agregarDeuda({ nombre: 'Inválida', valorInicial: value })).error);
    }
    assert.ok((await c.agregarMovimiento({ tipo: 'GASTO', concepto: 'Fecha inválida', valor: 10, fecha: '2026-02-30' })).error);
    assert.ok((await c.aportarMeta('ajena', 1)).error); assert.ok((await c.abonarDeuda('ajena', 1)).error);
    assert.equal(a.storage.getRawState(), before);
  });
}
