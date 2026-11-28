const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./helpers/browser-core.cjs');
for (const page of ['desktop.html', 'mobile.html']) {
  test(
    page + ': editar y eliminar confirman persistencia; error conserva registro y rechaza ID ajeno',
    async () => {
      const fixture = app(page),
        core = fixture.core;
      const movement = await core.agregarMovimiento({
        tipo: 'INGRESO',
        concepto: 'Original',
        valor: 25.35,
        fecha: '2026-11-17',
      });
      const before = JSON.stringify(core.state.movimientos);
      const edit = {
        tipo: 'GASTO',
        concepto: 'Editado',
        valor: 10.1,
        fecha: '2026-11-17',
        categoria: 'Otros',
        cuenta: 'Principal',
      };
      fixture.setFailure(true);
      assert.ok((await core.actualizarMovimiento(movement.id, edit)).error);
      assert.equal(JSON.stringify(core.state.movimientos), before);
      assert.equal(await core.eliminarMovimiento(movement.id), false);
      assert.equal(JSON.stringify(core.state.movimientos), before);
      fixture.setFailure(false);
      assert.equal((await core.actualizarMovimiento(movement.id, edit)).error, null);
      assert.equal(
        app(page, { disk: fixture.disk }).core.state.movimientos.find((m) => m.id === movement.id)
          .concepto,
        'Editado',
      );
      assert.ok((await core.actualizarMovimiento('otro-usuario', edit)).error);
      assert.equal(await core.eliminarMovimiento('otro-usuario'), false);
      assert.equal(await core.eliminarMovimiento(movement.id), true);
      assert.equal(
        app(page, { disk: fixture.disk }).core.state.movimientos.some((m) => m.id === movement.id),
        false,
      );
    },
  );
}
