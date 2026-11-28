'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { app } = require('./helpers/browser-core.cjs');
const { openStore } = require('../scripts/serve-sqlite.cjs');
const KEY = 'FINANZAS_ETAPA_DATA_V2';
const root = path.resolve(__dirname, '..');
function units() {
  const context = vm.createContext({});
  context.window = context;
  vm.runInContext(
    fs.readFileSync(path.join(root, 'src/domains/business/productUnits.js'), 'utf8'),
    context,
  );
  return context.BusinessProductUnits;
}
test('catálogo de unidades cubre cantidades, masa, volumen, longitud y empaques con códigos estables', () => {
  const u = units();
  for (const [value, code, symbol] of [
    ['unidades', 'UND', 'und'],
    ['Kilos', 'KG', 'kg'],
    ['kilogramo', 'KG', 'kg'],
    ['grs.', 'G', 'g'],
    ['Litros', 'L', 'l'],
    ['Mililitros', 'ML', 'ml'],
    ['metro', 'M', 'm'],
    ['m²', 'M2', 'm²'],
    ['Metros cúbicos', 'M3', 'm³'],
    ['pieza', 'PZA', 'pza'],
    ['paquete', 'PAQ', 'paq'],
    ['cajas', 'CAJA', 'caja'],
    ['pares', 'PAR', 'par'],
  ]) {
    assert.equal(u.normalize(value), code);
    assert.equal(u.get(value).symbol, symbol);
  }
  assert.equal(u.normalize(''), 'UND');
  assert.equal(u.formatQuantity('2.125', 'Kilos'), '2,125 kg');
  assert.equal(u.formatQuantity('10490', 'pieza'), '10.490 pza');
});
test('unidades personalizadas conservan su etiqueta y el catálogo permite seguir editándolas', () => {
  const u = units(),
    custom = 'Rollo de tela de 25 m';
  assert.equal(u.normalize(` ${custom} `), custom);
  assert.equal(u.get(custom).symbol, custom);
  assert.ok(u.options(custom).some(([value, label]) => value === custom && label === custom));
  assert.equal(u.options('Kilogramos').filter(([value]) => value === 'KG').length, 1);
  for (const value of ['x'.repeat(201), 'kg\nkg', {}, 25]) {
    assert.throws(() => u.normalize(value), /unidad de medida/);
  }
});
for (const page of ['desktop.html', 'mobile.html']) {
  test(`${page}: guardar, editar y recargar preserva unidades y cantidades sin convertir existencias`, async () => {
    const a = app(page);
    await a.core.setModuloActivo('EMPRESARIAL');
    const s = a.core.getBusinessService();
    const created = (
      await s.execute('saveProduct', {
        nombre: 'Tela',
        stock: '2.75',
        costoUnitario: '10490',
        precioVenta: '11500',
        unidadMedida: 'Metros',
      })
    ).record;
    assert.equal(created.unidadMedida, 'M');
    const unchanged = {
      ...JSON.parse(JSON.stringify(created)),
      descripcion: 'Unidad omitida al editar',
    };
    delete unchanged.unidadMedida;
    const edited = (await s.execute('saveProduct', unchanged)).record;
    assert.equal(edited.unidadMedida, 'M');
    const custom = (
      await s.execute('saveProduct', {
        ...JSON.parse(JSON.stringify(edited)),
        unidadMedida: 'Rollo de 25 m',
      })
    ).record;
    assert.equal(custom.stock, 2.75);
    const loaded = app(page, { disk: a.disk }).core.getProductoById(created.id);
    assert.equal(loaded.unidadMedida, 'Rollo de 25 m');
    assert.equal(loaded.stock, 2.75);
    assert.equal(loaded.costoUnitario, 10490);
    assert.equal(loaded.precioVenta, 11500);
    const before = JSON.stringify(a.core.state),
      disk = a.disk.get(KEY);
    a.setFailure(true);
    await assert.rejects(
      s.execute('saveProduct', { ...JSON.parse(JSON.stringify(custom)), unidadMedida: 'KG' }),
      /No se pudo guardar/,
    );
    assert.equal(JSON.stringify(a.core.state), before);
    assert.equal(a.disk.get(KEY), disk);
  });
  test(`${page}: compra conserva la unidad histórica aunque se edite después el catálogo`, async () => {
    const a = app(page);
    await a.core.setModuloActivo('EMPRESARIAL');
    const s = a.core.getBusinessService();
    const supplier = (await s.execute('saveSupplier', { nombre: 'Proveedor de fruta' })).record;
    const product = (
      await s.execute('saveProduct', {
        nombre: 'Fruta',
        unidadMedida: 'Kilos',
        stock: '0',
        costoUnitario: '10490',
        precioVenta: '11500',
      })
    ).record;
    const purchase = (
      await s.execute('purchase', {
        proveedorId: supplier.id,
        detalles: [{ productoId: product.id, cantidad: '0.125', precioUnitario: '10490' }],
      })
    ).record;
    assert.equal(purchase.total, 1311.25);
    assert.equal(purchase.calculo.lines[0].unit, 'KG');
    const current = a.core.getProductoById(product.id);
    await s.execute('saveProduct', {
      ...JSON.parse(JSON.stringify(current)),
      unidadMedida: 'pieza',
    });
    assert.equal(a.core.getProductoById(product.id).stock, 0.125);
    assert.equal(a.core.state.compras[0].calculo.lines[0].unit, 'KG');
    const loaded = app(page, { disk: a.disk }).core;
    assert.equal(loaded.getProductoById(product.id).unidadMedida, 'PZA');
    assert.equal(loaded.state.compras[0].calculo.lines[0].unit, 'KG');
  });
}
test('SQLite conserva la unidad normalizada y su edición al cerrar y reabrir la base', async () => {
  const a = app();
  await a.core.setModuloActivo('EMPRESARIAL');
  const s = a.core.getBusinessService();
  const product = (
    await s.execute('saveProduct', {
      nombre: 'Material para piscina',
      unidadMedida: 'Metros cúbicos',
      stock: '2.5',
      costoUnitario: '10490',
      precioVenta: '11500',
    })
  ).record;
  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
  const folder = fs.mkdtempSync(path.join(root, 'tmp', 'product-units-')),
    dbPath = path.join(folder, 'units.sqlite');
  let store = openStore(dbPath);
  try {
    const first = a.disk.get(KEY);
    assert.deepEqual(store.compareAndSet(null, first), { ok: true });
    assert.equal(
      JSON.parse(
        store.db.prepare('SELECT registro_json FROM vista_productos WHERE id = ?').get(product.id)
          .registro_json,
      ).unidadMedida,
      'M3',
    );
    await s.execute('saveProduct', {
      ...JSON.parse(JSON.stringify(product)),
      unidadMedida: 'Paquetes',
    });
    assert.deepEqual(store.compareAndSet(first, a.disk.get(KEY)), { ok: true });
    store.close();
    store = openStore(dbPath);
    const stored = JSON.parse(store.get()).data.productos.find((p) => p.id === product.id);
    assert.equal(stored.unidadMedida, 'PAQ');
    assert.equal(stored.stock, 2.5);
  } finally {
    store.close();
  }
});
