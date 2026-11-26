'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../scripts/serve-sqlite.cjs');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(root, 'tmp', 'phase2-browser-'));
const server = createServer({ dbPath: path.join(output, 'synthetic.sqlite') });
let browser;
const password = 'Solo-pruebas-2026';
async function state(context, origin) {
  const response = await context.request.get(origin + '/api/storage');
  assert.equal(response.status(), 200);
  return JSON.parse((await response.json()).raw).data;
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true });
  for (const mode of ['desktop', 'mobile']) {
    const mobile = mode === 'mobile';
    const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1366, height: 950 } });
    await context.route('https://**/*', route => route.abort());
    const email = mode + '-a@example.test', otherEmail = mode + '-b@example.test';
    const account = await context.request.post(origin + '/api/auth/register', { data: { nombre: 'Cuenta A sintética', email, password } });
    assert.equal(account.status(), 201);
    const userId = (await account.json()).user.id;
    const otherContext = await browser.newContext();
    assert.equal((await otherContext.request.post(origin + '/api/auth/register', { data: { nombre: 'Cuenta B sintética', email: otherEmail, password } })).status(), 201);
    await otherContext.close();
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const errors = [], notices = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { notices.push(dialog.message()); await dialog.accept(); });
    // Acortar solo el timeout del transporte hace verificable el caso sin esperar un minuto.
    await page.addInitScript(() => { const native = AbortSignal.timeout.bind(AbortSignal); AbortSignal.timeout = ms => native(ms === 30000 && window.__shortTransportTimeout ? 100 : ms); });
    await page.goto(origin + '/' + mode + '.html');
    await page.waitForFunction(() => window.Finanzas);
    await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
    const modal = mobile ? '#modalMobileRegistrar' : '#modalPcNuevoMovimiento';
    const fields = mobile ? ['mobInputMonto','mobInputConcepto','mobInputFecha'] : ['modalQuickValor','modalQuickConcepto','modalQuickFecha'];
    async function open(label) {
      if (mobile) await page.waitForFunction(() => !mobileApp._savingMovement);
      await page.evaluate(m => m ? mobileApp.openModalRegistrar() : pcApp.openModalNuevoMovimiento(), mobile);
      await page.locator('#' + fields[0]).fill('17.25');
      await page.locator('#' + fields[1]).fill(label);
      await page.locator('#' + fields[2]).fill('2026-11-26');
      await page.evaluate(() => document.querySelectorAll('.toast-notice,.mobile-toast').forEach(el => el.remove()));
    }
    async function submit() {
      await page.locator(modal + ' button[type="submit"]').click();
      await page.waitForFunction(m => (m ? mobileApp : pcApp)._pendingForms.size === 0, mobile);
    }
    let fault = null, hits = 0; const operationIds = [];
    await page.route('**/api/storage', async route => {
      if (route.request().method() !== 'PATCH' || !fault) return route.continue();
      hits++; operationIds.push(route.request().postDataJSON().operationId);
      if (fault === 'connection') return route.abort('internetdisconnected');
      if (fault === 'timeout') { await new Promise(resolve => setTimeout(resolve, 250)); return route.abort('timedout'); }
      if (fault === 'lost-response') { await route.fetch(); return route.abort('failed'); }
      return route.fulfill({ status: Number(fault), contentType: 'application/json', body: '{"error":"Rechazo sintético"}' });
    });
    for (const failure of ['403','500','400','503','connection','timeout','lost-response']) {
      const label = mode + '-' + failure;
      await open(label);
      const diskBefore = await state(context, origin), memoryBefore = await page.evaluate(() => Finanzas.state);
      fault = failure; const previousHits = hits;
      await page.evaluate(short => { window.__shortTransportTimeout = short; }, failure === 'timeout');
      await submit();
      assert.ok(hits > previousHits, 'interceptación efectiva: ' + failure);
      assert.equal(await page.locator(modal).evaluate(el => el.classList.contains('hidden')), false);
      assert.equal(await page.locator('#' + fields[1]).inputValue(), label);
      assert.deepEqual(await page.evaluate(() => Finanzas.state), memoryBefore);
      const diskAfter = await state(context, origin);
      if (failure !== 'lost-response') assert.deepEqual(diskAfter, diskBefore);
      else assert.equal(diskAfter.movimientos.filter(m => m.concepto === label).length, 1);
      assert.equal((await page.locator('.toast-notice,.mobile-toast').allTextContents()).some(t => t.includes('✔')), false);
      if (['connection','timeout','lost-response'].includes(failure)) {
        assert.equal(new Set(operationIds.slice(-2)).size, 1, 'el reintento conserva operationId');
        assert.equal((await page.evaluate(() => FinanzasStorage.getPersistenceStatus())).ambiguous, true);
        if (failure === 'timeout') assert.equal((await page.evaluate(() => FinanzasStorage.getPersistenceStatus())).code, 'timeout');
      }
      await page.evaluate(() => { window.__shortTransportTimeout = false; });
      fault = null;
      if (failure === 'lost-response') {
        const beforeEditedRetry = hits;
        await page.locator('#' + fields[1]).fill(label + '-editado'); await submit();
        assert.equal(hits, beforeEditedRetry, 'no se reenvía una operación modificada');
        assert.equal((await state(context, origin)).movimientos.filter(m => m.concepto === label + '-editado').length, 0);
        await page.locator('#' + fields[1]).fill(label);
      }
      await submit();
      assert.equal(await page.locator(modal).evaluate(el => el.classList.contains('hidden')), true);
      assert.equal((await state(context, origin)).movimientos.filter(m => m.concepto === label).length, 1);
      console.log('PASS ' + mode + ': ' + failure + ', conservación y reintento sin duplicados');
    }
    const debtId = await page.evaluate(async () => {
      const debt = await Finanzas.agregarDeuda({ nombre: 'Deuda archivada en navegador', valorInicial: 100, cuotaMensual: 10 });
      const payment = await Finanzas.abonarDeuda(debt.id, 25);
      if (payment.error) throw new Error(payment.error);
      return debt.id;
    });
    await page.evaluate(({ mobile, debtId }) => (mobile ? mobileApp : pcApp).eliminarDeuda(debtId), { mobile, debtId });
    assert.equal(await page.locator(mobile ? '#mobileListDeudasCards' : '#deudasCardsGrid').getByText('Deuda archivada en navegador').count(), 0);
    const archived = await state(context, origin);
    assert.equal(archived.deudas.find(d => d.id === debtId).archivada, true);
    assert.equal(archived.abonosDeudas.filter(p => p.deudaId === debtId).length, 1);
    assert.ok(archived.movimientos.some(m => m.deudaId === debtId));
    assert.equal(archived.ventas.length, 0); assert.equal(archived.gastosNegocio.length, 0);
    await page.reload(); await page.waitForFunction(() => window.Finanzas);
    assert.equal(await page.evaluate(() => Finanzas.getDeudas().totalDeuda), 0);
    assert.equal(await page.locator(mobile ? '#mobileListDeudasCards' : '#deudasCardsGrid').getByText('Deuda archivada en navegador').count(), 0);
    console.log('PASS ' + mode + ': deuda archivada, historial, SQLite tras recarga y separación personal/negocio');
    await page.evaluate(() => Finanzas.setModuloActivo('EMPRESARIAL'));
    fault = 'lost-response';
    const beforeBusinessHits = hits;
    const businessError = await page.evaluate(async () => {
      try { await Finanzas.getBusinessService().execute('saveCustomer', { nombre: 'Cliente incierto sintético', cedula: 'PH2-001' }, 'phase2-customer'); }
      catch (error) { return error.message; }
    });
    assert.match(businessError, /confirm/);
    assert.ok(hits >= beforeBusinessHits + 2);
    fault = null;
    const blocked = await page.evaluate(async () => {
      try { await Finanzas.getBusinessService().execute('saveCustomer', { nombre: 'No crear', cedula: 'PH2-002' }, 'phase2-other'); }
      catch (error) { return error.message; }
    });
    assert.match(blocked, /anterior sin confirmar/);
    await page.evaluate(() => Finanzas.getBusinessService().execute('saveCustomer', { nombre: 'Cliente incierto sintético', cedula: 'PH2-001' }, 'phase2-customer'));
    const businessState = await state(context, origin);
    assert.equal(businessState.clientes.filter(c => c.nombre === 'Cliente incierto sintético').length, 1);
    assert.equal(businessState.clientes.some(c => c.nombre === 'No crear'), false);
    assert.equal(businessState.businessLedger.operations.filter(op => op.key === 'phase2-customer').length, 1);
    await page.evaluate(() => Finanzas.setModuloActivo('PERSONAL'));
    console.log('PASS ' + mode + ': reintento empresarial incierto conserva su clave y bloquea otra intención');
    const beforeReset = await state(context, origin);
    fault = '500';
    await page.evaluate(m => (m ? mobileApp : pcApp).restablecerDatos(), mobile);
    assert.deepEqual(await state(context, origin), beforeReset);
    assert.equal((await page.locator('.toast-notice,.mobile-toast').allTextContents()).some(text => /Datos iniciales (restablecidos|restaurados)/.test(text)), false);
    fault = null;
    await page.evaluate(() => Finanzas.resetState());
    assert.equal((await state(context, origin)).movimientos.length, 0);
    assert.deepEqual(await page.evaluate(() => Finanzas.state), await state(context, origin));
    console.log('PASS ' + mode + ': restablecimiento interno falla sin éxito falso y confirma SQLite al reintentar, sin habilitar botones');
    async function expire(label) {
      await open(label);
      server.sqlite.store.db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(userId);
      await page.locator(modal + ' button[type="submit"]').click();
      await page.locator('#account-reauthentication').waitFor();
      await page.frameLocator('#account-reauthentication').locator('#account-email').waitFor();
    }
    async function loginRecovery(loginEmail) {
      const access = page.frameLocator('#account-reauthentication');
      await access.locator('#account-email').fill(loginEmail);
      await access.locator('#account-password').fill(password);
      await access.locator('#account-submit').click();
    }
    await expire('Borrador A recuperable');
    // Un mensaje del documento equivocado no puede desbloquear el borrador.
    await page.evaluate(() => window.postMessage({ type: 'mibolsillo:reauthenticated' }, location.origin));
    assert.equal(await page.locator('#account-reauthentication').count(), 1);
    await loginRecovery(email);
    await page.locator('#account-reauthentication').waitFor({ state: 'detached' });
    assert.equal(await page.locator('#' + fields[1]).inputValue(), 'Borrador A recuperable');
    assert.equal(await page.evaluate(() => [localStorage,sessionStorage].some(store => Object.values(store).join('').includes('Borrador A recuperable'))), false);
    await page.screenshot({ path: path.join(output, mode + '-recuperado.png') });
    await submit();
    assert.equal((await state(context, origin)).movimientos.filter(m => m.concepto === 'Borrador A recuperable').length, 1);
    // Caducidad: simular el reloj al verificar el retorno, sin esperar quince minutos.
    await expire('Borrador caducado');
    await page.evaluate(() => { const expiry = MiBolsilloSessionRecovery.inspect().expiresAt; Date.now = () => expiry + 1; window.dispatchEvent(new Event('focus')); });
    await page.waitForURL(origin + '/');
    assert.equal(await page.locator('#account-reauthentication').count(), 0);
    assert.equal((await page.locator('body').innerText()).includes('Borrador caducado'), false);
    // Volver a A crea un documento nuevo; el borrador caducado no regresa.
    await context.request.post(origin + '/api/auth/login', { data: { email, password } });
    await page.goto(origin + '/' + mode + '.html'); await page.waitForFunction(() => window.Finanzas);
    await expire('SECRETO-DE-A');
    await loginRecovery(otherEmail);
    await page.waitForURL(origin + '/');
    await page.locator('#mibolsillo-app').waitFor({ state: 'visible' });
    const b = await (await page.locator('#mibolsillo-app').elementHandle()).contentFrame();
    await b.waitForFunction(() => window.Finanzas);
    const bState = await b.evaluate(() => Finanzas.state);
    assert.equal(bState.usuario.email, otherEmail); assert.equal(JSON.stringify(bState).includes('SECRETO-DE-A'), false);
    assert.equal(await b.locator('#account-reauthentication').count(), 0);
    assert.equal((await state(context, origin)).movimientos.length, 0);
    // Cerrar sesión borra el documento privado y vuelve a la pantalla de acceso.
    await b.evaluate(() => pcApp.switchView('perfil'));
    await b.locator('#account-logout').click(); await page.waitForURL(origin + '/');
    await page.locator('#account-email').waitFor({ state: 'visible' });
    assert.deepEqual(errors, []);
    console.log('PASS ' + mode + ': HTTP 401, recuperación A, caducidad, aislamiento A/B y cierre de sesión');
    await context.close();
  }
  console.log('Artifacts: ' + output);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
});
