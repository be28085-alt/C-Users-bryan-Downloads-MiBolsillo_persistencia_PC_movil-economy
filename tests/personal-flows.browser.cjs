'use strict';
// Actual forms, authenticated users and disk commits. All data stays under tmp/.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../scripts/serve-sqlite.cjs');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(root, 'tmp', 'personal-flows-'));
const dbPath = path.join(output, 'accounts.sqlite');
let server, browser;
async function start(port = 0) {
  server = createServer({ dbPath });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port;
}
async function stop() {
  if (!server) return;
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  server = null;
}
async function data(context, origin) {
  const response = await context.request.get(origin + '/api/storage');
  assert.equal(response.status(), 200);
  return JSON.parse((await response.json()).raw).data;
}
(async () => {
  let origin = await start();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}) });
  for (const mode of ['desktop', 'compact', 'mobile']) {
    const mobile = mode === 'mobile';
    const context = await browser.newContext({ viewport: { width: mode === 'desktop' ? 1366 : 390, height: 950 } });
    context.setDefaultTimeout(10000);
    await context.route('https://**/*', route => route.abort());
    const originalEmail = `${mode}@example.test`, email = `editado-${mode}@example.test`;
    const password = 'Prueba-personal-2026';
    assert.equal((await context.request.post(origin + '/api/auth/register', { data: { nombre: 'Titular de prueba', email: originalEmail, password } })).status(), 201);
    const page = await context.newPage();
    const errors = [], notices = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { notices.push(dialog.message()); await dialog.accept(); });
    await page.goto(origin + (mode === 'compact' ? '/' : `/${mode}.html`));
    if (mode === 'compact') await page.locator('#mibolsillo-app').waitFor({ state: 'visible' });
    const app = mode === 'compact' ? await (await page.locator('#mibolsillo-app').elementHandle()).contentFrame() : page;
    await app.waitForFunction(m => window.Finanzas && (m ? typeof mobileApp !== 'undefined' : typeof pcApp !== 'undefined'), mobile);
    await app.addStyleTag({ content: '*{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
    let fail = false;
    await page.route('**/api/storage', route => fail && route.request().method() === 'POST'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Fallo temporal de prueba"}' }) : route.continue());
    async function open(fn, args = []) {
      await app.evaluate(({ mobile, fn, args }) => (mobile ? mobileApp : pcApp)[fn](...args), { mobile, fn, args });
    }
    async function submit({ modal, fields, open: opener }, verify) {
      await opener();
      for (const [id, value] of Object.entries(fields)) await app.locator('#' + id).fill(String(value));
      const before = await data(context, origin);
      fail = true;
      const alertCount = notices.length;
      await app.locator(modal + ' button[type="submit"]').click();
      await app.waitForTimeout(40);
      assert.equal(await app.locator(modal).evaluate(el => el.classList.contains('hidden')), false, modal + ' stays open on failed save');
      for (const [id, value] of Object.entries(fields)) assert.equal(await app.locator('#' + id).inputValue(), String(value));
      assert.deepEqual(await data(context, origin), before, modal + ' did not alter disk');
      assert.deepEqual(await app.evaluate(() => Finanzas.state), before, modal + ' did not publish uncommitted state');
      assert.equal(await app.evaluate(() => FinanzasStorage.hasPendingChanges()), false);
      const toast = await app.locator('.toast-notice,.toast-container').allTextContents();
      assert.equal(toast.some(t => t.includes('✔')), false, 'no success message for an uncommitted write');
      if (!mobile) assert.equal(notices.length, alertCount + 1);
      if (modal.includes('NuevaDeuda')) await page.screenshot({ path: path.join(output, mode + '-failed-save.png'), animations: 'disabled' });
      fail = false;
      await app.locator(modal + ' button[type="submit"]').click();
      await app.waitForFunction(selector => document.querySelector(selector).classList.contains('hidden'), modal);
      await verify(await data(context, origin));
      // Remove previous success messages before exercising the next failure.
      await app.evaluate(() => document.querySelectorAll('.toast-notice,.toast-container').forEach(el => el.remove()));
    }
    async function movement(fecha, valor) {
      await submit({
        open: () => open(mobile ? 'openModalRegistrar' : 'openModalNuevoMovimiento'),
        modal: mobile ? '#modalMobileRegistrar' : '#modalPcNuevoMovimiento',
        fields: { [mobile ? 'mobInputMonto' : 'modalQuickValor']: valor, [mobile ? 'mobInputConcepto' : 'modalQuickConcepto']: 'Gasto ' + fecha, [mobile ? 'mobInputFecha' : 'modalQuickFecha']: fecha }
      }, state => assert.equal(state.movimientos.filter(m => m.concepto === 'Gasto ' + fecha).length, 1));
    }
    await movement('2026-10-10', 2000);
    if (mobile) await app.waitForTimeout(650); // Existing double-click protection.
    await movement('2026-11-10', 1000);
    assert.equal(await app.evaluate(() => Finanzas.calcTotalGastos()), 1000);
    assert.equal(await app.locator(mobile ? '#lblMobileHeroGastos' : '#kpiGastos').textContent(), '-1.000 COP');
    assert.equal(await app.evaluate(() => Finanzas.calcSaldoTotal()), -3000);
    await app.locator(mobile ? '#view-inicio button[onclick="mobileApp.cambiarMes(-1)"]' : '#view-inicio button[onclick="pcApp.cambiarMes(-1)"]').click();
    assert.equal(await app.evaluate(() => Finanzas.calcTotalGastos()), 2000);
    await open('cambiarMes', [1]);
    await submit({
      open: () => open(mobile ? 'openModalConfigPresupuesto' : 'openModalAjustarPresupuesto'),
      modal: mobile ? '#modalMobilePresupuesto' : '#modalPcAjustarPresupuesto',
      fields: { [mobile ? 'mobInputPresupuestoMonto' : 'inputPresupuestoGlobal']: 100000 }
    }, state => assert.equal(state.presupuestoMensual, 100000));
    await open(mobile ? 'openModalConfigPresupuesto' : 'openModalAjustarPresupuesto');
    assert.equal(await app.locator(mobile ? '#mobInputPresupuestoMonto' : '#inputPresupuestoGlobal').inputValue(), '100000');
    await open(mobile ? 'closeModalConfigPresupuesto' : 'closeModalAjustarPresupuesto');
    let metaId, deudaId;
    await submit({ open: () => open('openModalNuevaMeta'), modal: mobile ? '#modalMobileNuevaMeta' : '#modalPcNuevaMeta', fields: {
      [mobile ? 'mobMetaNombre' : 'inputMetaNombre']: 'Meta real', [mobile ? 'mobMetaObjetivo' : 'inputMetaObjetivo']: 20000,
      [mobile ? 'mobMetaAhorrado' : 'inputMetaAhorrado']: 1000, [mobile ? 'mobMetaPlazo' : 'inputMetaPlazo']: 'Diciembre de 2027'
    } }, state => { assert.equal(state.metas.length, 1); metaId = state.metas[0].id; });
    await submit({ open: () => open('openModalAportarMeta', [metaId, 'Meta real']), modal: mobile ? '#modalMobileAportarMeta' : '#modalPcAportarMeta', fields: {
      [mobile ? 'mobAporteMetaValor' : 'inputAporteMetaValor']: 2500
    } }, state => { assert.equal(state.metas[0].ahorrado, 3500); assert.equal(state.aportesMetas.length, 2); });
    if (!mobile) {
      assert.equal(await app.locator('#metasKpiEnProgreso').textContent(), '1 meta en progreso');
      assert.equal(await app.locator('#metasKpiAvance').textContent(), '17.5 % de avance global');
    }
    await submit({ open: () => open('openModalNuevaDeuda'), modal: mobile ? '#modalMobileNuevaDeuda' : '#modalPcNuevaDeuda', fields: {
      [mobile ? 'mobDeudaNombre' : 'inputDeudaNombre']: 'Deuda real', [mobile ? 'mobDeudaValorInicial' : 'inputDeudaMontoInicial']: 10000,
      [mobile ? 'mobDeudaSaldoPendiente' : 'inputDeudaSaldoPendiente']: 10000, [mobile ? 'mobDeudaCuota' : 'inputDeudaCuota']: 2000,
      [mobile ? 'mobDeudaCondiciones' : 'inputDeudaCondiciones']: 'Sin interés'
    } }, state => { assert.equal(state.deudas.length, 1); deudaId = state.deudas[0].id; });
    assert.equal(await app.locator(mobile ? '#lblMobileDeudasCuotas' : '#deudasKpiCuotas').textContent(), '2.000 COP/mes');
    await submit({ open: () => open('openModalAbonarDeuda', [deudaId, 'Deuda real']), modal: mobile ? '#modalMobileAbonarDeuda' : '#modalPcAbonarDeuda', fields: {
      [mobile ? 'mobAbonoDeudaValor' : 'inputAbonoDeudaValor']: 2500
    } }, state => { assert.equal(state.deudas[0].saldoPendiente, 7500); assert.equal(state.abonosDeudas.length, 1); });
    await submit({ open: () => open('openModalEditarPerfil'), modal: mobile ? '#modalMobileEditarPerfil' : '#modalPcEditarPerfil', fields: {
      [mobile ? 'mobInputPerfilNombre' : 'inputPerfilNombre']: 'Perfil actualizado', [mobile ? 'mobInputPerfilEmail' : 'inputPerfilEmail']: email,
      [mobile ? 'mobInputPerfilSaldoInicial' : 'inputPerfilSaldoInicial']: 5000
    } }, state => { assert.equal(state.usuario.email, email); assert.equal(state.saldoInicial, 5000); });
    assert.equal((await (await context.request.get(origin + '/api/auth/session')).json()).user.email, email);
    const saved = await data(context, origin);
    await page.reload();
    const reloaded = mode === 'compact' ? await (await page.locator('#mibolsillo-app').elementHandle()).contentFrame() : page;
    await reloaded.waitForFunction(() => window.Finanzas);
    await reloaded.addStyleTag({ content: '*{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
    assert.deepEqual(await reloaded.evaluate(() => Finanzas.state), saved);
    await reloaded.evaluate(m => m ? mobileApp.setModulo('PERSONAL', 'plan') : pcApp.switchView('metas'), mobile);
    await page.screenshot({ path: path.join(output, mode + '-persisted.png') });
    assert.deepEqual(errors, []);
    await context.close();
    const port = new URL(origin).port;
    await stop(); origin = await start(Number(port));
    const fresh = await browser.newContext();
    assert.equal((await fresh.request.post(origin + '/api/auth/login', { data: { email: originalEmail, password } })).status(), 401);
    assert.equal((await fresh.request.post(origin + '/api/auth/login', { data: { email, password } })).status(), 200);
    assert.deepEqual(await data(fresh, origin), saved);
    await fresh.close();
    console.log('PASS ' + mode + ': real personal forms reject failed writes, retry once, correct monthly totals, preserved history and profile/login after reload and full server restart');
  }
  console.log('Artifacts: ' + output);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await stop(); });
