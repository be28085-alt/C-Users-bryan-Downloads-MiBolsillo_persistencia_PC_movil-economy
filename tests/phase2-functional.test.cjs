'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { app } = require('./helpers/browser-core.cjs');

for (const page of ['desktop.html', 'mobile.html']) {
  test(
    page + ': archivar excluye tarjeta, saldo y cuotas activas sin borrar pagos ni egresos',
    async () => {
      const a = app(page),
        c = a.core;
      c.state.deudas = [];
      c.state.abonosDeudas = [];
      c.state.movimientos = [];
      const partial = await c.agregarDeuda({
        nombre: 'Archivada sintética',
        valorInicial: 100,
        cuotaMensual: 10,
      });
      const paid = await c.agregarDeuda({
        nombre: 'Pagada sintética',
        valorInicial: 50,
        cuotaMensual: 5,
      });
      await c.agregarDeuda({ nombre: 'Activa sintética', valorInicial: 20, cuotaMensual: 2 });
      await c.abonarDeuda(partial.id, 25);
      await c.abonarDeuda(paid.id, 50);
      const beforeCash = c.calcSaldoTotal();
      assert.equal(c.getDeudas().activas.length, 2);
      assert.equal(await c.eliminarDeuda(partial.id), true);
      assert.ok(
        (await c.abonarDeuda(partial.id, 5)).error,
        'una deuda archivada no admite pagos desde un formulario antiguo',
      );
      const summary = c.getDeudas();
      assert.equal(summary.activas.length, 1);
      assert.equal(summary.pagadas.length, 1);
      assert.equal(summary.archivadas.length, 1);
      assert.equal(summary.totalDeuda, 20);
      assert.equal(summary.cuotaMensualTotal, 2);
      assert.equal(c.calcTotalDeudasPagado(), 75);
      assert.equal(c.calcSaldoTotal(), beforeCash);
      const reopened = app(page, { disk: a.disk }).core;
      assert.equal(reopened.state.abonosDeudas.length, 2);
      for (const payment of reopened.state.abonosDeudas) {
        assert.ok(reopened.state.movimientos.find((m) => m.id === payment.movimientoId));
      }
      assert.equal(reopened.getDeudas().totalDeuda, 20);
      const nodes = new Map();
      a.context.document.getElementById = (id) => {
        if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', style: {} });
        return nodes.get(id);
      };
      vm.runInContext(
        fs.readFileSync(
          page === 'desktop.html' ? 'src/utils/desktop.js' : 'src/utils/mobile.js',
          'utf8',
        ),
        a.context,
      );
      vm.runInContext(
        page === 'desktop.html' ? 'pcApp.renderDeudasView()' : 'mobileApp.renderPlan()',
        a.context,
      );
      const html = nodes.get(
        page === 'desktop.html' ? 'deudasCardsGrid' : 'mobileListDeudasCards',
      ).innerHTML;
      assert.equal(html.includes('Archivada sintética'), false);
      assert.ok(html.includes('Activa sintética'));
      assert.ok(html.includes('Pagada sintética'));
      if (page === 'desktop.html') {
        assert.equal(nodes.get('deudasKpiActivas').textContent, '1 obligación activa');
      }
    },
  );

  test(
    page + ': restablecimiento fallido conserva memoria y disco y nunca anuncia éxito',
    async () => {
      const a = app(page),
        c = a.core;
      await c.agregarMovimiento({
        tipo: 'INGRESO',
        concepto: 'Conservar',
        valor: 123,
        fecha: '2026-11-26',
      });
      const memory = JSON.stringify(c.state),
        disk = a.storage.getRawState();
      a.setFailure(true);
      await assert.rejects(c.resetState(), /anteriores se conservaron/);
      assert.equal(JSON.stringify(c.state), memory);
      assert.equal(a.storage.getRawState(), disk);
      a.context.confirm = () => true;
      a.context.messages = [];
      vm.runInContext(
        fs.readFileSync(
          page === 'desktop.html' ? 'src/utils/desktop.js' : 'src/utils/mobile.js',
          'utf8',
        ),
        a.context,
      );
      await vm.runInContext(
        page === 'desktop.html'
          ? 'pcApp.showToast = message => messages.push(message); pcApp.restablecerDatos()'
          : 'mobileApp.mostrarToast = message => messages.push(message); mobileApp.restablecerDatos()',
        a.context,
      );
      assert.equal(a.context.messages.length, 1);
      assert.match(a.context.messages[0], /anteriores se conservaron/);
      a.setFailure(false);
      await c.resetState();
      assert.notEqual(a.storage.getRawState(), disk);
      assert.deepEqual(
        JSON.parse(a.storage.getRawState()).data,
        JSON.parse(JSON.stringify(c.state)),
      );
      assert.equal(fs.readFileSync(page, 'utf8').includes('restablecerDatos('), false);
    },
  );
}
