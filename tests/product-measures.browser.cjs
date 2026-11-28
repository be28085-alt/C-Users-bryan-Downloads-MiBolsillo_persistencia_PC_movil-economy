// Localized money and product units through both real interfaces and isolated SQLite.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../scripts/serve-sqlite.cjs');

fs.mkdirSync(path.join(__dirname, '..', 'tmp'), { recursive: true });
const output = fs.mkdtempSync(path.join(__dirname, '..', 'tmp', 'product-measures-'));
const dbPath = path.join(output, 'integration.sqlite');
let server, browser;

function diskState() {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return JSON.parse(db.prepare('SELECT raw FROM app_state WHERE id = 1').get().raw).data;
  } finally {
    db.close();
  }
}
const dialog = (page) => page.locator('.bm-dialog[open]');
async function fill(page, values) {
  for (const [name, value] of Object.entries(values)) {
    await dialog(page).locator(`[name="${name}"]`).fill(String(value));
  }
}
async function submit(page) {
  await dialog(page).locator('button[type="submit"]').click();
}
async function saveAndClose(page) {
  await submit(page);
  await page.waitForFunction(() => !document.querySelector('.bm-dialog')?.open);
}
async function inventory(page, mobile) {
  await page
    .locator(
      mobile
        ? '#mobileBusinessNav [data-business-tab="inventario"]'
        : '#navEmpresarial [data-view="negocio-inventario"]',
    )
    .click();
  return page.locator('[data-business-section="inventory"]');
}
async function rowFor(page, id) {
  return page.locator(`[data-business-section="inventory"] tr[data-record-id="${id}"]`);
}
async function renderedMoney(page, value) {
  return page.evaluate((value) => BusinessNumbers.formatMoney(value), value);
}
async function assertMoneyCell(page, row, label, amount) {
  assert.equal(
    (await row.locator(`[data-label="${label}"]`).innerText()).trim(),
    await renderedMoney(page, amount),
  );
}
async function reload(page, mobile) {
  await page.reload();
  await page.waitForFunction(() => typeof Finanzas !== 'undefined' && Finanzas.state);
  await page.evaluate(() => FinanzasStorage.ready());
  await page.evaluate(
    (m) =>
      m
        ? mobileApp.setModulo('EMPRESARIAL', 'inventario')
        : pcApp.setModulo('EMPRESARIAL', 'negocio-inventario'),
    mobile,
  );
  await inventory(page, mobile);
}

async function flow(page, mobile, label) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForFunction(() => typeof Finanzas !== 'undefined' && Finanzas.state);
  await page.evaluate(
    (m) =>
      m
        ? mobileApp.setModulo('EMPRESARIAL', 'inventario')
        : pcApp.setModulo('EMPRESARIAL', 'negocio-inventario'),
    mobile,
  );
  await page.addStyleTag({
    content:
      '*{animation:none!important;transition:none!important}.toast-container,.pc-toast-container{display:none!important}',
  });
  assert.equal(await page.evaluate(() => FinanzasStorage.getBackendInfo().mode), 'sqlite');
  assert.equal(await renderedMoney(page, 10490), '10.490.00 COP');
  const view = await inventory(page, mobile);
  await view.getByRole('button', { name: '+ Producto', exact: true }).click();
  const payment = dialog(page).locator('[name="montoPagado"]');
  assert.equal(await payment.getAttribute('placeholder'), '0.000.00');
  await payment.focus();
  assert.equal(await payment.evaluate((el) => getComputedStyle(el, '::placeholder').opacity), '0');
  assert.equal(await payment.inputValue(), '');
  const addSupplier = dialog(page).getByRole('button', {
    name: '+ Registrar proveedor',
    exact: true,
  });
  assert.equal(
    await addSupplier.evaluate((el) => getComputedStyle(el).backgroundColor),
    'rgb(36, 87, 107)',
  );
  assert.equal(await dialog(page).locator('legend').first().innerText(), 'Art\u00edculos');
  await addSupplier.click();
  await fill(page, { nombre: `Proveedor medidas ${label}`, cedula: mobile ? '940002' : '940001' });
  await submit(page);
  await dialog(page).locator('[name="observaciones"]').waitFor();
  const supplier = diskState().proveedores.find((p) => p.nombre === `Proveedor medidas ${label}`);
  assert.ok(supplier);
  await fill(page, {
    fecha: '2026-11-25',
    fechaVencimiento: '2026-12-25',
    observaciones: `Compra con unidades ${label}`,
  });
  await dialog(page).locator('[name="tipoPago"]').selectOption('CREDITO');

  await dialog(page).getByRole('button', { name: '+ Registrar producto', exact: true }).click();
  const costInput = dialog(page).locator('[name="costoUnitario"]');
  for (const name of ['costoUnitario', 'precioVenta', 'stock', 'stockMinimo']) {
    assert.equal(
      await dialog(page).locator(`[name="${name}"]`).inputValue(),
      '',
      `${name}: no prefilled zero`,
    );
  }
  await costInput.focus();
  await costInput.pressSequentially('12abc.50');
  assert.equal(await costInput.inputValue(), '12.50');
  await costInput.evaluate((el) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', '99letters');
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
    );
  });
  assert.equal(await costInput.inputValue(), '12.50');
  const stockInput = dialog(page).locator('[name="stock"]');
  await stockInput.focus();
  await stockInput.pressSequentially('23123x');
  assert.equal(await stockInput.inputValue(), '23123');
  await stockInput.fill('0');
  const nameInput = dialog(page).locator('[name="nombre"]');
  await nameInput.pressSequentially('Papa123');
  assert.equal(await nameInput.inputValue(), 'Papa');
  await nameInput.fill('Arroz integral');
  await dialog(page).locator('[name="sku"]').fill('PROD-123');
  assert.equal(await dialog(page).locator('[name="sku"]').inputValue(), 'PROD-123');
  await dialog(page).locator('[name="descripcion"]').fill('Paquete de 500 g');
  assert.equal(await dialog(page).locator('[name="descripcion"]').inputValue(), 'Paquete de 500 g');
  const unitValues = await dialog(page)
    .locator('select[name="unidadMedida"] option')
    .evaluateAll((options) => options.map((option) => option.value));
  for (const unit of ['UND', 'KG', 'G', 'L', 'ML', 'M', 'M2', 'M3', 'PZA', 'PAQ', 'CAJA', 'PAR']) {
    assert.ok(unitValues.includes(unit), `Missing product unit ${unit}`);
  }
  await dialog(page).locator('select[name="unidadMedida"]').selectOption('KG');
  await fill(page, {
    nombre: `Producto por peso ${label}`,
    sku: `MEASURE-${label}`,
    costoUnitario: '10.490',
    precioVenta: '11.500',
  });
  await submit(page);
  await dialog(page).locator('[name="observaciones"]').waitFor();
  const product = diskState().productos.find((p) => p.sku === `MEASURE-${label}`);
  assert.ok(product);
  assert.equal(product.costoUnitario, 10490);
  assert.equal(product.precioVenta, 11500);
  assert.equal(product.unidadMedida, 'KG');
  assert.equal(await dialog(page).locator('[name="precioUnitario"]').getAttribute('readonly'), '');
  assert.equal(await dialog(page).locator('[name="precioUnitario"]').inputValue(), '10.490.00');
  await fill(page, { cantidad: '1,5', montoPagado: '0' });
  await page.screenshot({
    path: path.join(output, `${label.toLowerCase()}-purchase.png`),
    fullPage: true,
  });
  await saveAndClose(page);

  let disk = diskState();
  const purchase = disk.compras.find((p) => p.proveedorId === supplier.id);
  assert.equal(purchase.total, 15735);
  assert.equal(purchase.saldoPendiente, 15735);
  assert.equal(purchase.montoPagado, 0);
  assert.equal(disk.productos.find((p) => p.id === product.id).stock, 1.5);
  assert.equal(disk.productos.find((p) => p.id === product.id).costoUnitario, 10490);
  await reload(page, mobile);
  let row = await rowFor(page, product.id);
  await assertMoneyCell(page, row, 'Costo unitario', 10490);
  await assertMoneyCell(page, row, 'Precio de venta', 11500);
  assert.match(await row.locator('[data-label="Existencias"]').innerText(), /1,5\s*kg/i);
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(output, `${label.toLowerCase()}-inventory-prices.png`),
    fullPage: true,
  });

  // All requested unit families survive editing and a fresh database reload.
  for (const unit of ['L', 'M', 'PZA', 'PAQ']) {
    await row.getByRole('button', { name: 'Editar', exact: true }).click();
    await dialog(page).locator('select[name="unidadMedida"]').selectOption(unit);
    await saveAndClose(page);
    assert.equal(diskState().productos.find((p) => p.id === product.id).unidadMedida, unit);
    await reload(page, mobile);
    row = await rowFor(page, product.id);
    await row.getByRole('button', { name: 'Editar', exact: true }).click();
    assert.equal(await dialog(page).locator('select[name="unidadMedida"]').inputValue(), unit);
    await dialog(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
    await assertMoneyCell(page, row, 'Precio de venta', 11500);
  }
  assert.equal(
    diskState().compras.find((p) => p.id === purchase.id).calculo.lines[0].unit,
    'KG',
    'Changing the catalog measure must retain the historical purchase unit',
  );

  // Custom measures cover businesses outside the predefined catalog.
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  await dialog(page).locator('select[name="unidadMedida"]').selectOption('__CUSTOM__');
  await fill(page, { unidadPersonalizada: 'Rollo', costoUnitario: '4.416,6667' });
  await saveAndClose(page);
  assert.equal(diskState().productos.find((p) => p.id === product.id).unidadMedida, 'Rollo');
  assert.equal(diskState().productos.find((p) => p.id === product.id).costoUnitario, 4416.6667);
  await reload(page, mobile);
  row = await rowFor(page, product.id);
  await assertMoneyCell(page, row, 'Costo unitario', 4416.6667);
  assert.match(await row.locator('[data-label="Existencias"]').innerText(), /Rollo/);
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  assert.equal(await dialog(page).locator('[name="unidadPersonalizada"]').inputValue(), 'Rollo');
  const unchangedCost = await dialog(page).locator('[name="costoUnitario"]').inputValue();
  await fill(page, { descripcion: `Conserva precisión ${label}` });
  await saveAndClose(page);
  assert.equal(
    diskState().productos.find((p) => p.id === product.id).costoUnitario,
    4416.6667,
    `Editing another field must retain cost precision (${unchangedCost})`,
  );

  // A failed SQLite edit preserves both the previous record and the entered recovery values.
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  await dialog(page).locator('select[name="unidadMedida"]').selectOption('KG');
  await fill(page, { precioVenta: '12.000.50' });
  const before = diskState();
  let fail = true;
  await page.route('**/api/storage', (route) =>
    fail && ['PATCH', 'POST'].includes(route.request().method())
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"No se pudo guardar en SQLite (prueba)."}',
        })
      : route.continue(),
  );
  await submit(page);
  await dialog(page)
    .locator('.bm-form-feedback')
    .filter({ hasText: /No se pudo guardar/ })
    .waitFor();
  assert.deepEqual(diskState(), before);
  assert.equal(await dialog(page).locator('select[name="unidadMedida"]').inputValue(), 'KG');
  fail = false;
  await saveAndClose(page);
  await reload(page, mobile);
  disk = diskState();
  assert.equal(disk.productos.find((p) => p.id === product.id).unidadMedida, 'KG');
  assert.equal(disk.productos.find((p) => p.id === product.id).precioVenta, 12000.5);
  row = await rowFor(page, product.id);
  await assertMoneyCell(page, row, 'Precio de venta', 12000.5);

  // Persisted fractional prices remain fractional; formatting must not multiply existing data.
  const decimal = await page.evaluate(
    async (label) =>
      (
        await Finanzas.getBusinessService().execute('saveProduct', {
          nombre: `Precio decimal real ${label}`,
          sku: `DECIMAL-${label}`,
          costoUnitario: '10.49',
          precioVenta: '11.5',
          unidadMedida: 'L',
          stock: '2',
        })
      ).record,
    label,
  );
  await reload(page, mobile);
  const decimalRow = await rowFor(page, decimal.id);
  await assertMoneyCell(page, decimalRow, 'Costo unitario', 10.49);
  await assertMoneyCell(page, decimalRow, 'Precio de venta', 11.5);
  assert.equal(diskState().productos.find((p) => p.id === decimal.id).costoUnitario, 10.49);
  assert.equal(diskState().productos.find((p) => p.id === decimal.id).precioVenta, 11.5);

  await row.scrollIntoViewIfNeeded();
  const bounds = await view.evaluate((el) => ({
    scroll: el.scrollWidth,
    width: el.clientWidth,
    right: el.getBoundingClientRect().right,
    viewport: innerWidth,
  }));
  assert.ok(
    bounds.scroll <= bounds.width + 2 && bounds.right <= bounds.viewport + 2,
    `Inventory overflow: ${JSON.stringify(bounds)}`,
  );
  await page.screenshot({
    path: path.join(output, `${label.toLowerCase()}-inventory.png`),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => FinanzasStorage.getPersistenceStatus().ok), true);
  console.log(
    `PASS ${label}: localized monetary inputs/display, all unit families/custom measures, exact cost precision and SQLite reload/error recovery`,
  );
}

(async () => {
  server = createServer({ requireAuth: false, dbPath });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}),
  });
  for (const [name, mobile, width, label] of [
    ['desktop.html', false, 1516, 'PC'],
    ['mobile.html', true, 390, 'MOVIL'],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    context.setDefaultTimeout(12000);
    await context.route('https://**/*', (route) => route.abort());
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/${name}?modulo=EMPRESARIAL`);
    try {
      await flow(page, mobile, label);
    } catch (error) {
      await page.screenshot({
        path: path.join(output, `${label.toLowerCase()}-failure.png`),
        fullPage: true,
      });
      throw error;
    } finally {
      await context.close();
    }
  }
  console.log(`Artifacts: ${output}`);
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  });
