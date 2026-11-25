// Integration against the real local SQLite server; all records stay in tmp/.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../scripts/serve-sqlite.cjs');

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
const output = fs.mkdtempSync(path.join(root, 'tmp', 'sqlite-browser-'));
const databasePath = path.join(output, 'integration.sqlite');
let service, browser;

async function startServer(dbPath = databasePath) {
  service = createServer({ requireAuth: false, dbPath });
  await new Promise(resolve => service.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${service.address().port}`;
}

async function stopServer() {
  if (!service) return;
  await new Promise(resolve => service.close(resolve));
  service = null;
}

function diskState(dbPath = databasePath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try { return JSON.parse(db.prepare('SELECT raw FROM app_state WHERE id = 1').get().raw).data; }
  finally { db.close(); }
}

async function fill(dialog, values) {
  for (const [name, value] of Object.entries(values)) await dialog.locator(`[name="${name}"]`).fill(String(value));
}

async function saveDialog(page) {
  await page.locator('.bm-dialog[open] button[type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector('.bm-dialog')?.open);
}

async function addPersonalMovement(page, mobile, marker, value) {
  await page.evaluate(m => m ? mobileApp.setModulo('PERSONAL', 'inicio') : pcApp.setModulo('PERSONAL', 'inicio'), mobile);
  if (mobile) {
    await page.locator('#view-inicio button[onclick="mobileApp.openModalRegistrar()"]').click();
    await page.locator('#mobInputMonto').fill(String(value));
    await page.locator('#mobInputConcepto').fill(marker);
    await page.locator('#mobInputFecha').fill('2026-11-16');
    await page.locator('#modalMobileRegistrar button[type="submit"]').click();
  } else {
    await page.evaluate(() => pcApp.switchView('movimientos'));
    await page.locator('#view-movimientos button[onclick="pcApp.openModalNuevoMovimiento()"]').click();
    await page.locator('#modalQuickValor').fill(String(value));
    await page.locator('#modalQuickConcepto').fill(marker);
    await page.locator('#modalQuickFecha').fill('2026-11-16');
    await page.locator('#modalPcNuevoMovimiento button[type="submit"]').click();
  }
  await page.waitForFunction(text => Finanzas.state.movimientos.some(m => m.concepto === text), marker);
  assert.equal(await page.evaluate(() => FinanzasStorage.getPersistenceStatus().ok), true);
  assert.equal(diskState().movimientos.find(m => m.concepto === marker).valor, value);
}

async function businessForms(page, mobile, label) {
  await page.evaluate(m => m ? mobileApp.setModulo('EMPRESARIAL', 'negocio') : pcApp.setModulo('EMPRESARIAL', 'negocio-dashboard'), mobile);
  if (mobile) await page.locator('#mobileBusinessNav [data-business-tab="inventario"]').click();
  else await page.locator('#navEmpresarial [data-view="negocio-inventario"]').click();
  await page.locator('[data-business-section="inventory"]').getByRole('button', { name: '+ Producto', exact: true }).click();
  await page.locator('.bm-dialog[open]').getByRole('button', { name: '+ Registrar proveedor', exact: true }).click();
  await fill(page.locator('.bm-dialog[open]'), { nombre: `Proveedor SQLite ${label}`, cedula: mobile ? '222002' : '111001' });
  await page.locator('.bm-dialog[open] button[type="submit"]').click();
  await page.locator('.bm-dialog[open] [name="productoId"]').waitFor();
  await page.locator('.bm-dialog[open]').getByRole('button', { name: '+ Registrar producto', exact: true }).click();
  await fill(page.locator('.bm-dialog[open]'), { nombre: `Producto SQLite ${label}`, sku: `SQL-${label}`, costoUnitario: '1500', precioVenta: '2300' });
  await page.locator('.bm-dialog[open] button[type="submit"]').click();
  await page.locator('.bm-dialog[open] [name="productoId"]').waitFor();
  await fill(page.locator('.bm-dialog[open]'), { cantidad: '7' });
  await saveDialog(page);
  const state = diskState();
  assert.ok(state.proveedores.some(p => p.nombre === `Proveedor SQLite ${label}`));
  assert.equal(state.productos.find(p => p.sku === `SQL-${label}`).stock, 7);
  assert.equal(state.compras.find(p => p.proveedorNombre === `Proveedor SQLite ${label}`).total, 10500);
  if (mobile) await page.locator('#mobileBusinessNav [data-business-tab="informes"]').click();
  else await page.locator('#navEmpresarial [data-view="negocio-informes"]').click();
  await page.locator('[data-report-tab="purchases"]').click();
  assert.equal(await page.locator('[data-report-detail="suppliers"]').getByText(`Proveedor SQLite ${label}`, { exact: true }).count(), 1);
}

(async () => {
  let origin = await startServer();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}) });
  let persisted;
  for (const [name, mobile, width] of [['desktop.html', false, 1366], ['mobile.html', true, 390]]) {
    // Fresh contexts have no browser-local data; both must load the same SQLite file.
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    context.setDefaultTimeout(10000);
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/${name}`);
    await page.waitForFunction(() => typeof Finanzas !== 'undefined' && Finanzas.state);
    await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}.toast-container,.pc-toast-container{display:none!important}' });
    assert.equal(await page.evaluate(() => FinanzasStorage.getBackendInfo().mode), 'sqlite');
    if (mobile) assert.ok(await page.evaluate(() => Finanzas.state.movimientos.some(m => m.concepto === 'Gasto SQLite PC')));
    await addPersonalMovement(page, mobile, `Gasto SQLite ${mobile ? 'móvil' : 'PC'}`, mobile ? 2450.75 : 1234.5);
    await businessForms(page, mobile, mobile ? 'MOVIL' : 'PC');
    persisted = diskState();
    await page.reload();
    assert.deepEqual(await page.evaluate(() => ({ movimientos: Finanzas.state.movimientos, productos: Finanzas.state.productos, proveedores: Finanzas.state.proveedores })), {
      movimientos: persisted.movimientos, productos: persisted.productos, proveedores: persisted.proveedores
    });
    await page.screenshot({ path: path.join(output, mobile ? 'mobile-sqlite.png' : 'desktop-sqlite.png'), animations: 'disabled' });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS SQLite ${name}: real personal/business forms, disk commit and reload`);
  }

  // A server write failure cannot publish business changes or claim success.
  const failContext = await browser.newContext({ viewport: { width: 1366, height: 950 } });
  await failContext.route('https://**/*', route => route.abort());
  const failurePage = await failContext.newPage();
  await failurePage.goto(`${origin}/desktop.html?modulo=EMPRESARIAL`);
  await failurePage.waitForFunction(() => typeof Finanzas !== 'undefined' && Finanzas.state.moduloActivo === 'EMPRESARIAL');
  const before = diskState();
  await failurePage.route('**/api/storage', route => ['POST', 'PATCH'].includes(route.request().method())
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }) : route.continue());
  const failed = await failurePage.evaluate(async () => {
    let error;
    try { await Finanzas.getBusinessService().execute('saveSupplier', { nombre: 'No debe guardarse', cedula: '333003' }); }
    catch (e) { error = e.message; }
    return { error, persistence: FinanzasStorage.getPersistenceStatus(), exists: Finanzas.state.proveedores.some(p => p.nombre === 'No debe guardarse') };
  });
  assert.match(failed.error, /No se pudo guardar/);
  assert.equal(failed.persistence.ok, false);
  assert.equal(failed.exists, false);
  assert.deepEqual(diskState(), before);
  await failContext.close();
  console.log('PASS SQLite: failed server write retains database and does not publish a business operation');

  // Close and reopen the database and HTTP process state, then read from a new context.
  await stopServer();
  origin = await startServer();
  const fresh = await browser.newContext();
  await fresh.route('https://**/*', route => route.abort());
  const reopened = await fresh.newPage();
  await reopened.goto(`${origin}/mobile.html`);
  assert.deepEqual(await reopened.evaluate(() => ({ movimientos: Finanzas.state.movimientos, productos: Finanzas.state.productos, proveedores: Finanzas.state.proveedores })), {
    movimientos: persisted.movimientos, productos: persisted.productos, proveedores: persisted.proveedores
  });
  assert.equal(diskState().movimientos.filter(m => m.concepto.startsWith('Gasto SQLite ')).length, 2);
  console.log('PASS SQLite: persisted records survive server/database restart and an empty browser context');
  await fresh.close();

  // Independent contexts do not share BroadcastChannel/localStorage. A stale personal
  // state commit must fail its compare-and-set instead of replacing another
  // context's data. Normal personal commands refresh their state before writing.
  const staleContext = await browser.newContext();
  const writerContext = await browser.newContext();
  for (const c of [staleContext, writerContext]) await c.route('https://**/*', route => route.abort());
  const stale = await staleContext.newPage();
  await stale.goto(`${origin}/desktop.html`);
  const writer = await writerContext.newPage();
  await writer.goto(`${origin}/mobile.html`);
  await writer.evaluate(() => Finanzas.agregarMovimiento({ tipo: 'GASTO', concepto: 'Escritor vigente', categoria: 'Otros', valor: 999, fecha: '2026-11-16' }));
  const concurrent = diskState();
  const staleResult = await stale.evaluate(async () => {
    const next = structuredClone(Finanzas.state);
    next.movimientos.push({ id: crypto.randomUUID(), tipo: 'GASTO', concepto: 'Escritura antigua rechazada', categoria: 'Otros', valor: 1000, fecha: '2026-11-16' });
    const saved = await Finanzas.persistirEstado(next);
    return { saved, status: FinanzasStorage.getPersistenceStatus(), pending: FinanzasStorage.hasPendingChanges() };
  });
  assert.equal(staleResult.saved, false);
  assert.equal(staleResult.status.ok, false);
  assert.equal(staleResult.status.status, 'conflict');
  assert.equal(staleResult.pending, false);
  assert.deepEqual(diskState(), concurrent);
  await staleContext.close();
  await writerContext.close();
  console.log('PASS SQLite: stale independent browser writer reports conflict without replacing committed changes');
  await stopServer();

  // A browser's existing envelope migrates only into a genuinely empty database.
  const migrationPath = path.join(output, 'migration.sqlite');
  origin = await startServer(migrationPath);
  const importedRaw = JSON.stringify({ version: 'FINANZAS_V2', data: {
    usuario: { nombre: 'Migración comprobada', iniciales: 'MC' }, saldoInicial: 123,
    movimientos: [{ id: 'migration-old-1', concepto: 'Movimiento anterior del navegador', tipo: 'INGRESO', categoria: 'Otros', valor: 10001.25, fecha: '2026-11-15' }]
  } });
  const migrationContext = await browser.newContext();
  await migrationContext.route('https://**/*', route => route.abort());
  await migrationContext.addInitScript(raw => localStorage.setItem('FINANZAS_ETAPA_DATA_V2', raw), importedRaw);
  const migrationPage = await migrationContext.newPage();
  await migrationPage.goto(`${origin}/desktop.html`);
  assert.equal(diskState(migrationPath).movimientos.find(m => m.id === 'migration-old-1').valor, 10001.25);
  assert.equal(await migrationPage.evaluate(() => localStorage.getItem('FINANZAS_ETAPA_DATA_V2')), importedRaw);
  await migrationContext.close();

  const unrelatedContext = await browser.newContext();
  await unrelatedContext.route('https://**/*', route => route.abort());
  await unrelatedContext.addInitScript(() => localStorage.setItem('FINANZAS_ETAPA_DATA_V2', JSON.stringify({ data: { movimientos: [{ id: 'must-not-import', valor: 1 }] } })));
  const unrelated = await unrelatedContext.newPage();
  await unrelated.goto(`${origin}/mobile.html`);
  assert.equal(await unrelated.evaluate(() => Finanzas.state.movimientos.some(m => m.id === 'migration-old-1')), true);
  assert.equal(diskState(migrationPath).movimientos.some(m => m.id === 'must-not-import'), false);
  await unrelatedContext.close();
  console.log('PASS SQLite: first-run localStorage import keeps its backup; an existing database ignores unrelated browser-local data');
  await stopServer();

  // Corrupt local data is never replaced by seeded/demo data during import.
  const corruptPath = path.join(output, 'corrupt-migration.sqlite');
  origin = await startServer(corruptPath);
  const corruptContext = await browser.newContext();
  await corruptContext.route('https://**/*', route => route.abort());
  await corruptContext.addInitScript(() => localStorage.setItem('FINANZAS_ETAPA_DATA_V2', '{datos corruptos'));
  const corruptPage = await corruptContext.newPage();
  await corruptPage.goto(`${origin}/desktop.html`);
  const corrupt = await corruptPage.evaluate(async () => ({
    status: FinanzasStorage.getPersistenceStatus(),
    saved: await FinanzasStorage.saveState(Finanzas.state),
    local: localStorage.getItem('FINANZAS_ETAPA_DATA_V2')
  }));
  assert.equal(corrupt.status.status, 'read-error');
  assert.equal(corrupt.saved, false);
  assert.equal(corrupt.local, '{datos corruptos');
  assert.equal(service.sqlite.store.get(), null);
  await corruptContext.close();
  console.log('PASS SQLite: corrupt migration blocks writes and preserves the original local data');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  await stopServer();
});
