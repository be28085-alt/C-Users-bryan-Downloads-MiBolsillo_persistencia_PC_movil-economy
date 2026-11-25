const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../scripts/serve-sqlite.cjs');
fs.mkdirSync(path.join(__dirname, '../tmp'), { recursive: true });
const output = fs.mkdtempSync(path.join(__dirname, '../tmp/expenses-unified-'));
const dbPath = path.join(output, 'check.sqlite');
function disk() { const db = new DatabaseSync(dbPath, { readOnly: true }); try { return JSON.parse(db.prepare('SELECT raw FROM app_state WHERE id=1').get().raw).data; } finally { db.close(); } }
let server, browser;
const dialog = page => page.locator('.bm-dialog[open]');
async function fill(page, data) { for (const [name, value] of Object.entries(data)) await dialog(page).locator(`[name="${name}"]`).fill(value); }
async function save(page) { await dialog(page).locator('[type="submit"]').click(); await page.waitForFunction(() => !document.querySelector('.bm-dialog')?.open); }
(async () => {
  server = createServer({ requireAuth: false, dbPath }); await new Promise(r => server.listen(0, '127.0.0.1', r));
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}) });
  for (const [file, mobile, width, label] of [['desktop.html', false, 1366, 'PC'], ['mobile.html', true, 390, 'MOVIL']]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } }); context.setDefaultTimeout(12000);
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/${file}?modulo=EMPRESARIAL`);
    await page.waitForFunction(() => typeof Finanzas !== 'undefined' && Finanzas.state.moduloActivo === 'EMPRESARIAL');
    await page.evaluate(async label => { await Finanzas.getBusinessService().execute('saveBusiness', { nombre: `Negocio ${label}` }); BusinessUI.renderAll(); }, label);
    assert.equal(await page.locator('[data-business-section="movements"]').count(), 0);
    assert.equal(await page.locator('#navEmpresarial [data-view="negocio-movimientos"]').count(), 0);
    if (mobile) await page.locator('.business-panel.active .bm-mobile-sections [data-section="expenses"]').click();
    else await page.locator('#navEmpresarial [data-view="negocio-gastos"]').click();
    const view = page.locator('[data-business-section="expenses"]');
    await view.getByRole('button', { name: '+ Gasto', exact: true }).click();
    await fill(page, { descripcion: `Gasto ${label}`, categoria: 'Servicios', monto: '500' }); await save(page);
    await view.getByRole('button', { name: '+ Ingreso', exact: true }).click();
    await fill(page, { descripcion: `Ingreso ${label}`, monto: '250' });
    let fail = true;
    await page.route('**/api/storage', route => fail && ['PATCH', 'POST'].includes(route.request().method()) ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"No se pudo guardar (prueba)"}' }) : route.continue());
    await dialog(page).locator('[type="submit"]').click();
    await dialog(page).locator('.bm-form-feedback').filter({ hasText: /No se pudo guardar/ }).waitFor();
    assert.equal(disk().ingresosNegocio.filter(r => r.descripcion === `Ingreso ${label}`).length, 0);
    assert.equal(await dialog(page).locator('[name="descripcion"]').inputValue(), `Ingreso ${label}`);
    fail = false; await save(page);
    await view.locator('[data-bm="tab"][data-tab="all"]').click();
    assert.equal(await view.locator('tr[data-record-id]').count(), 2);
    const totals = () => page.evaluate(() => { const m = BusinessReadModel.build(Finanzas); return { income: m.report.totals.otherIncome, expense: m.report.totals.businessExpenses, profit: m.report.totals.netProfit, cash: m.cash.flujoNeto }; });
    assert.deepEqual(await totals(), { income: '250.00', expense: '500.00', profit: '-250.00', cash: -250 });
    await view.locator('[data-bm="tab"][data-tab="incomes"]').click(); assert.equal(await view.locator('tr[data-record-id]').count(), 1);
    await view.getByRole('button', { name: 'Editar', exact: true }).click(); await fill(page, { monto: '750' }); await save(page);
    await view.locator('[data-bm="tab"][data-tab="expenses"]').click();
    await view.getByRole('button', { name: 'Anular', exact: true }).click(); await fill(page, { motivo: 'Registro duplicado' }); await save(page);
    assert.deepEqual(await totals(), { income: '750.00', expense: '0.00', profit: '750.00', cash: 750 });
    await page.reload(); await page.waitForFunction(() => typeof Finanzas !== 'undefined' && Finanzas.state);
    await page.evaluate(() => FinanzasStorage.ready());
    await page.evaluate(m => m ? mobileApp.switchBusinessTab('movimientos') : pcApp.switchView('negocio-movimientos'), mobile);
    await view.waitFor({ state: 'visible' });
    await view.locator('[data-bm="tab"][data-tab="all"]').click();
    assert.equal(await view.locator('tr[data-record-id]').count(), 2);
    assert.equal(disk().gastosNegocio.find(r => r.descripcion === `Gasto ${label}`).estado, 'ANULADA');
    assert.equal(disk().ingresosNegocio.find(r => r.descripcion === `Ingreso ${label}`).monto, 750);
    assert.deepEqual(await totals(), { income: '750.00', expense: '0.00', profit: '750.00', cash: 750 });
    assert.ok(await view.evaluate(el => el.scrollWidth <= el.clientWidth + 2));
    await page.screenshot({ path: path.join(output, `${label}-expenses.png`), fullPage: true });
    assert.deepEqual(errors, []); await context.close(); console.log(`PASS ${label}: unified expense/income CRUD, filters, SQLite recovery/reload and totals`);
  }
  console.log(`Artifacts: ${output}`);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); if (server) await new Promise(r => server.close(r)); });
