// Unified inventory registration against an isolated SQLite database, on PC and mobile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../scripts/serve-sqlite.cjs');

fs.mkdirSync(path.join(__dirname, '..', 'tmp'), { recursive: true });
const output = fs.mkdtempSync(path.join(__dirname, '..', 'tmp', 'inventory-unified-'));
const dbPath = path.join(output, 'integration.sqlite');
let server, browser;

function diskState() {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try { return JSON.parse(db.prepare('SELECT raw FROM app_state WHERE id = 1').get().raw).data; }
  finally { db.close(); }
}
const dialog = page => page.locator('.bm-dialog[open]');
async function fill(page, values) {
  for (const [name, value] of Object.entries(values)) await dialog(page).locator(`[name="${name}"]`).fill(String(value));
}
async function submit(page) { await dialog(page).locator('button[type="submit"]').click(); }
async function inventory(page, mobile) {
  const nav = mobile ? '#mobileBusinessNav [data-business-tab="inventario"]' : '#navEmpresarial [data-view="negocio-inventario"]';
  await page.locator(nav).click();
  return page.locator('[data-business-section="inventory"]');
}
async function reports(page, mobile) {
  const nav = mobile ? '#mobileBusinessNav [data-business-tab="informes"]' : '#navEmpresarial [data-view="negocio-informes"]';
  await page.locator(nav).click();
  await page.locator('[data-report-tab="purchases"]').click();
  return page.locator('[data-report-panel="purchases"]');
}
async function flow(page, mobile, label) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => typeof Finanzas !== 'undefined' && Finanzas.state);
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}.toast-container,.pc-toast-container{display:none!important}' });
  await page.evaluate(m => m ? mobileApp.setModulo('EMPRESARIAL', 'inventario') : pcApp.setModulo('EMPRESARIAL', 'negocio-inventario'), mobile);
  assert.equal(await page.evaluate(() => FinanzasStorage.getBackendInfo().mode), 'sqlite');
  assert.equal(await page.locator('#navEmpresarial [data-view="negocio-compras"], #navEmpresarial [data-view="negocio-proveedores"], #mobileBusinessNav [data-business-tab="compras"], #mobileBusinessNav [data-business-tab="proveedores"]').count(), 0);
  assert.equal(await page.locator('[data-business-section="contacts"], [data-business-section="purchases"]').count(), 0);

  let view = await inventory(page, mobile);
  await view.getByRole('button', { name: '+ Producto', exact: true }).click();
  await dialog(page).locator('[name="proveedorId"]').waitFor();
  await fill(page, { fecha: '2026-11-25', fechaVencimiento: '2026-12-25', observaciones: `Reposición ${label}` });
  await dialog(page).locator('[name="tipoPago"]').selectOption('CREDITO');

  // Creating a supplier returns to the same purchase, with its entered fields intact.
  await dialog(page).getByRole('button', { name: '+ Registrar proveedor', exact: true }).click();
  await fill(page, { nombre: `Proveedor ${label}`, cedula: mobile ? '920002' : '920001', email: `proveedor-${label.toLowerCase()}@example.co` });
  await submit(page);
  await dialog(page).locator('[name="observaciones"]').waitFor();
  assert.equal(await dialog(page).locator('[name="observaciones"]').inputValue(), `Reposición ${label}`);
  assert.equal(await dialog(page).locator('[name="tipoPago"]').inputValue(), 'CREDITO');
  const supplier = diskState().proveedores.find(p => p.nombre === `Proveedor ${label}`);
  assert.ok(supplier);
  assert.equal(await dialog(page).locator('[name="proveedorId"]').inputValue(), supplier.id);

  // Cancelling the nested catalog editor returns without discarding registration.
  await dialog(page).getByRole('button', { name: '+ Registrar producto', exact: true }).click();
  await fill(page, { nombre: 'Catálogo cancelado' });
  await dialog(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
  await dialog(page).locator('[name="observaciones"]').waitFor();
  assert.equal(await dialog(page).locator('[name="observaciones"]').inputValue(), `Reposición ${label}`);
  assert.equal(diskState().productos.some(p => p.nombre === 'Catálogo cancelado'), false);

  // Creating a product also returns to registration and selects the new catalog item.
  await dialog(page).getByRole('button', { name: '+ Registrar producto', exact: true }).click();
  await fill(page, { nombre: `Producto ${label}`, sku: `UNIFIED-${label}`, costoUnitario: '1250', precioVenta: '2000' });
  await submit(page);
  await dialog(page).locator('[name="observaciones"]').waitFor();
  const product = diskState().productos.find(p => p.sku === `UNIFIED-${label}`);
  assert.ok(product);
  assert.equal(await dialog(page).locator('[name="productoId"]').inputValue(), product.id);
  assert.equal(await dialog(page).locator('[name="proveedorId"]').inputValue(), supplier.id);
  assert.equal(await dialog(page).locator('[name="observaciones"]').inputValue(), `Reposición ${label}`);
  await fill(page, { cantidad: '4', montoPagado: '1000' });
  await dialog(page).getByRole('button', { name: '+ Agregar artículo', exact: true }).click();
  await dialog(page).getByRole('button', { name: '+ Registrar producto', exact: true }).click();
  await fill(page, { nombre: `Artículo adicional ${label}`, sku: `UNIFIED-EXTRA-${label}`, costoUnitario: '500', precioVenta: '900' });
  await submit(page);
  await dialog(page).locator('[name="observaciones"]').waitFor();
  const extra = diskState().productos.find(p => p.sku === `UNIFIED-EXTRA-${label}`);
  assert.equal(await dialog(page).locator('.bm-line').count(), 2);
  assert.equal(await dialog(page).locator('.bm-line').first().locator('[name="cantidad"]').inputValue(), '4');
  assert.equal(await dialog(page).locator('.bm-line').first().locator('[name="precioUnitario"]').inputValue(), '1.250.00');
  assert.equal(await dialog(page).locator('.bm-line').last().locator('[name="productoId"]').inputValue(), extra.id);
  await dialog(page).locator('.bm-line').last().locator('[name="cantidad"]').fill('2');
  assert.equal(await dialog(page).locator('.bm-line').last().locator('[name="precioUnitario"]').inputValue(), '500.00');
  await page.screenshot({ path: path.join(output, `${label.toLowerCase()}-registration.png`), animations: 'disabled', fullPage: true });

  // A rejected SQLite write keeps the registration available for an exact retry.
  const before = diskState();
  let fail = true;
  await page.route('**/api/storage', route => fail && ['PATCH', 'POST'].includes(route.request().method())
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"No se pudo guardar en SQLite (prueba)."}' }) : route.continue());
  await submit(page);
  await dialog(page).locator('.bm-form-feedback').filter({ hasText: /No se pudo guardar/ }).waitFor();
  assert.deepEqual(diskState(), before);
  assert.equal(await dialog(page).locator('.bm-line').first().locator('[name="cantidad"]').inputValue(), '4');
  assert.equal(await dialog(page).locator('[name="observaciones"]').inputValue(), `Reposición ${label}`);
  fail = false;
  await submit(page);
  await page.waitForFunction(() => !document.querySelector('.bm-dialog')?.open);

  const persisted = diskState();
  assert.equal(persisted.productos.find(p => p.id === product.id).stock, 4);
  assert.equal(persisted.productos.find(p => p.id === product.id).costoUnitario, 1250);
  assert.equal(persisted.productos.find(p => p.id === extra.id).stock, 2);
  const purchases = persisted.compras.filter(p => p.proveedorId === supplier.id);
  assert.equal(purchases.length, 1);
  assert.equal(purchases[0].total, 6000);
  assert.equal(purchases[0].montoPagado, 1000);
  assert.equal(purchases[0].saldoPendiente, 5000);
  assert.equal(persisted.proveedores.find(p => p.id === supplier.id).saldoPendiente, 5000);

  view = await inventory(page, mobile);
  let row = view.locator('tr[data-record-id]').filter({ hasText: `Producto ${label}` });
  assert.equal(await row.getByRole('button', { name: /Consultar|Editar|Movimiento|Eliminar \/ archivar/, exact: false }).count(), 4);
  await row.scrollIntoViewIfNeeded();
  const positions = await row.locator('[data-label="Acciones"] button').evaluateAll(buttons => buttons.map(b => ({ text: b.textContent.trim(), x: b.getBoundingClientRect().x, y: b.getBoundingClientRect().y, right: b.getBoundingClientRect().right })));
  assert.equal(positions.length, 4);
  assert.equal(positions[0].y, positions[1].y);
  assert.equal(positions[2].y, positions[3].y);
  assert.ok(positions[2].y > positions[0].y, 'Product actions should align in two rows');
  assert.ok(positions.every(p => p.right <= page.viewportSize().width), `Actions overflow: ${JSON.stringify(positions)}`);
  await page.screenshot({ path: path.join(output, `${label.toLowerCase()}-inventory.png`), animations: 'disabled', fullPage: true });
  if (mobile) {
    await page.setViewportSize({ width: 320, height: 1000 });
    await row.scrollIntoViewIfNeeded();
    const narrowButtons = await row.locator('[data-label="Acciones"] button').evaluateAll(buttons => buttons.map(b => ({ width: b.clientWidth, textWidth: b.scrollWidth, right: b.getBoundingClientRect().right })));
    assert.ok(narrowButtons.every(b => b.textWidth <= b.width && b.right <= 320), `Narrow mobile actions overflow: ${JSON.stringify(narrowButtons)}`);
    await page.screenshot({ path: path.join(output, 'movil-320-inventory.png'), animations: 'disabled', fullPage: true });
    await page.setViewportSize({ width: 390, height: 1000 });
  }
  await row.getByRole('button', { name: 'Consultar', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Cerrar', exact: true }).click();

  // Each reorganized product action uses the same confirmed SQLite storage flow.
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  await fill(page, { descripcion: `Edición confirmada ${label}` });
  await submit(page);
  await page.waitForFunction(() => !document.querySelector('.bm-dialog')?.open);
  assert.equal(diskState().productos.find(p => p.id === product.id).descripcion, `Edición confirmada ${label}`);
  const movementReason = `Acciones inventario ${label}`;
  for (const [type, expectedStock] of [['ENTRADA', 5], ['SALIDA', 4]]) {
    await row.getByRole('button', { name: 'Movimiento', exact: true }).click();
    await dialog(page).locator('[name="tipo"]').selectOption(type);
    await fill(page, { cantidad: '1', motivo: movementReason, fecha: '2026-11-25' });
    await submit(page);
    await page.waitForFunction(() => !document.querySelector('.bm-dialog')?.open);
    assert.equal(diskState().productos.find(p => p.id === product.id).stock, expectedStock);
  }
  const savedMovements = diskState().movimientosInventario.filter(m => m.productoId === product.id && m.motivo === movementReason);
  assert.deepEqual(savedMovements.map(m => [m.tipo, m.cantidad, m.stockPosterior]), [['ENTRADA', 1, 5], ['SALIDA', 1, 4]]);

  const report = await reports(page, mobile);
  row = report.locator('tr').filter({ hasText: `Proveedor ${label}` }).filter({ has: page.locator('[data-bm="form"][data-kind="supplier"]') });
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  await fill(page, { telefono: mobile ? '3002220002' : '3001110001' });
  await submit(page);
  await page.waitForFunction(() => !document.querySelector('.bm-dialog')?.open);
  assert.equal(diskState().proveedores.find(p => p.id === supplier.id).telefono, mobile ? '3002220002' : '3001110001');
  await reports(page, mobile);
  await page.screenshot({ path: path.join(output, `${label.toLowerCase()}-suppliers.png`), animations: 'disabled', fullPage: true });

  // Reports retain the former directory's lookup/archive operations and customer access.
  const directory = page.locator('[data-report-detail="suppliers"]');
  await directory.locator('[data-report-contact-search]').fill(`Proveedor ${label}`);
  assert.equal(await directory.locator('tr[data-report-contact-id]').count(), 1);
  await directory.locator(`[data-report-contact-id="${supplier.id}"] [data-bm="archive"]`).click();
  await submit(page);
  await page.waitForFunction(() => !document.querySelector('.bm-dialog')?.open);
  assert.equal(diskState().proveedores.find(p => p.id === supplier.id).estado, 'ARCHIVADO');
  assert.equal(diskState().compras.find(p => p.id === purchases[0].id).saldoPendiente, 5000);
  await page.locator('[data-report-tab="sales"]').click();
  await page.locator('[data-report-detail="customers"]').getByRole('button', { name: '+ Cliente', exact: true }).click();
  await fill(page, { nombre: `Cliente ${label}`, cedula: mobile ? '930002' : '930001' });
  await submit(page);
  await page.waitForFunction(() => !document.querySelector('.bm-dialog')?.open);
  assert.ok(diskState().clientes.find(p => p.nombre === `Cliente ${label}`));

  await page.reload();
  await page.waitForFunction(() => typeof Finanzas !== 'undefined' && Finanzas.state);
  await page.evaluate(() => FinanzasStorage.ready());
  const reloaded = await page.evaluate(() => ({ productos: Finanzas.state.productos, proveedores: Finanzas.state.proveedores, clientes: Finanzas.state.clientes, compras: Finanzas.state.compras, movimientosInventario: Finanzas.state.movimientosInventario }));
  const disk = diskState();
  assert.deepEqual(reloaded, { productos: disk.productos, proveedores: disk.proveedores, clientes: disk.clientes, compras: disk.compras, movimientosInventario: disk.movimientosInventario });
  assert.equal(reloaded.productos.find(p => p.id === product.id).stock, 4);
  assert.equal(reloaded.productos.find(p => p.id === product.id).descripcion, `Edición confirmada ${label}`);
  assert.equal(await page.evaluate(() => FinanzasStorage.getPersistenceStatus().ok), true);
  assert.deepEqual(errors, []);
  console.log(`PASS ${label}: nested inventory registration, SQLite failure/retry, financial results, product actions/movements, supplier editing and reload`);
}

(async () => {
  server = createServer({ requireAuth: false, dbPath });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}) });
  for (const [name, mobile, width, label] of [['desktop.html', false, 1516, 'PC'], ['mobile.html', true, 390, 'MOVIL']]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    context.setDefaultTimeout(12000);
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/${name}`);
    try { await flow(page, mobile, label); }
    catch (error) { await page.screenshot({ path: path.join(output, `${label.toLowerCase()}-failure.png`), fullPage: true }); throw error; }
    finally { await context.close(); }
  }
  console.log(`Artifacts: ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
