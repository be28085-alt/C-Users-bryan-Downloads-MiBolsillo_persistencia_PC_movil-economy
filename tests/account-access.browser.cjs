'use strict';
// Real account, browser and SQLite integration. All financial data is temporary.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../scripts/serve-sqlite.cjs');

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
const output = fs.mkdtempSync(path.join(root, 'tmp', 'account-access-'));
const dbPath = path.join(output, 'accounts.sqlite');
let server, browser;

async function startServer(port = 0) {
  server = createServer({ dbPath });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port;
}
async function stopServer() {
  const current = server;
  server = null;
  if (current) await new Promise(resolve => { current.close(resolve); current.closeAllConnections(); });
}
async function frame(page) {
  await page.locator('#mibolsillo-app').waitFor({ state: 'visible' });
  const app = await (await page.locator('#mibolsillo-app').elementHandle()).contentFrame();
  await app.waitForFunction(() => window.Finanzas && window.FinanzasStorage);
  await app.addStyleTag({ content: '*{animation:none!important;transition:none!important;scroll-behavior:auto!important}.pc-toast-container,.toast-container{display:none!important}' });
  return app;
}
async function register(page, email, name = 'Usuario de prueba') {
  await page.locator('#account-toggle').click();
  await page.locator('#account-name').fill(name);
  await page.locator('#account-email').fill(email);
  await page.locator('#account-password').fill('Cuenta-prueba-2026');
  await page.locator('#account-confirm').fill('Cuenta-prueba-2026');
  await page.locator('#account-submit').click();
}
async function login(page, email, password = 'Cuenta-prueba-2026') {
  await page.locator('#account-email').fill(email);
  await page.locator('#account-password').fill(password);
  await page.locator('#account-submit').click();
}
async function logout(page, app) {
  await app.evaluate(() => pcApp.switchView('perfil'));
  await app.locator('#account-logout').click();
  await page.locator('#account-submit').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#mibolsillo-app').isVisible(), false);
}
async function state(context, origin) {
  const response = await context.request.get(origin + '/api/storage');
  assert.equal(response.status(), 200);
  return JSON.parse((await response.json()).raw).data;
}

(async () => {
  let origin = await startServer();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}) });
  for (const width of [1366, 390]) {
    let context = await browser.newContext({ viewport: { width, height: 900 } });
    context.setDefaultTimeout(12000);
    await context.route('https://**/*', route => route.abort());
    let page = await context.newPage();
    const email = 'cuenta-' + width + '@example.test';
    await page.goto(origin + '/');
    await page.locator('#account-submit').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(output, `login-${width}.png`) });
    assert.equal(await page.locator('#mibolsillo-app').isVisible(), false);
    assert.equal((await context.request.get(origin + '/api/storage')).status(), 401);
    const protectedPage = await context.request.get(origin + '/desktop.html', { maxRedirects: 0 });
    assert.equal(protectedPage.status(), 302);
    await register(page, email);
    let app = await frame(page);
    assert.equal((await state(context, origin)).movimientos.length, 0, 'no seeded financial examples');
    assert.equal((await state(context, origin)).usuario.email, email);
    assert.equal((await app.locator('#sidebarUserEmail').innerText()).trim(), email);
    assert.equal(await app.locator('a[href*="mobile.html"],a[href*="desktop.html"],.btn-switch-version,.btn-switch-link').count(), 0);

    // Preserve the same document and an unsaved modal while changing width.
    await app.evaluate(() => pcApp.switchView('movimientos'));
    await app.locator('#view-movimientos button[onclick="pcApp.openModalNuevoMovimiento()"]').click();
    await app.locator('#modalQuickTypeIngreso').click();
    await app.locator('#modalQuickValor').fill('125.35');
    await app.locator('#modalQuickConcepto').fill('Movimiento de ' + width);
    const identity = await app.evaluate(() => { window.__accountTestDocument = 'same'; return window.location.href; });
    await page.setViewportSize({ width: width < 800 ? 1366 : 390, height: 844 });
    assert.equal(await app.locator('#modalQuickConcepto').inputValue(), 'Movimiento de ' + width);
    assert.equal(await app.evaluate(() => window.__accountTestDocument), 'same');
    assert.equal(app.url(), identity);
    await app.locator('#modalPcNuevoMovimiento button[type="submit"]').click();
    await app.waitForFunction(() => Finanzas.state.movimientos.length === 1);
    let saved = await state(context, origin);
    assert.equal(saved.movimientos[0].valor, 125.35);
    const id = saved.movimientos[0].id;
    await page.screenshot({ path: path.join(output, `signed-in-${width}.png`) });
    const cookies = await context.storageState();
    await context.close();
    const samePort = Number(new URL(origin).port);
    await stopServer();
    origin = await startServer(samePort);
    context = await browser.newContext({ storageState: cookies, viewport: { width, height: 900 } });
    context.setDefaultTimeout(12000);
    await context.route('https://**/*', route => route.abort());
    page = await context.newPage();
    await page.goto(origin + '/');
    app = await frame(page);
    assert.equal((await state(context, origin)).movimientos[0].id, id);

    // Edit through the real existing-history action and shared editor.
    await app.locator('#view-inicio [data-edit-movement]').first().click();
    const editor = app.locator('#personal-movement-editor[open]');
    await editor.locator('[name="concepto"]').fill('Movimiento editado ' + width);
    await editor.locator('[name="valor"]').fill('200.50');
    await editor.getByRole('button', { name: 'Guardar movimiento', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
    assert.equal((await state(context, origin)).movimientos[0].valor, 200.50);
    const editedCookie = await context.storageState();
    await context.close();
    await stopServer();
    origin = await startServer(samePort);
    context = await browser.newContext({ storageState: editedCookie, viewport: { width, height: 900 } });
    context.setDefaultTimeout(12000);
    await context.route('https://**/*', route => route.abort());
    page = await context.newPage();
    await page.goto(origin + '/');
    app = await frame(page);
    assert.equal((await state(context, origin)).movimientos[0].concepto, 'Movimiento editado ' + width);
    assert.equal((await state(context, origin)).movimientos[0].valor, 200.50);
    await logout(page, app);
    await login(page, email, 'Contraseña-equivocada');
    await page.locator('#account-error').waitFor({ state: 'visible' });
    assert.match(await page.locator('#account-error').innerText(), /contraseña|incorrect/i);
    await register(page, email);
    await page.locator('#account-error').waitFor({ state: 'visible' });
    assert.match(await page.locator('#account-error').innerText(), /existe|correo/i);
    await page.locator('#account-toggle').click();
    await login(page, email);
    app = await frame(page);
    assert.equal((await state(context, origin)).movimientos[0].id, id);

    const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
    other.setDefaultTimeout(12000);
    await other.route('https://**/*', route => route.abort());
    const secondPage = await other.newPage();
    await secondPage.goto(origin + '/');
    await register(secondPage, 'segunda-' + width + '@example.test', 'Segunda cuenta');
    await frame(secondPage);
    assert.equal((await state(other, origin)).movimientos.length, 0);
    // Forged account/id parameters cannot redirect the owner resolved by session.
    const cfg = await (await other.request.get(origin + '/api/config')).json();
    const otherRaw = (await (await other.request.get(origin + '/api/storage')).json()).raw;
    const tampered = JSON.parse(otherRaw);
    tampered.data.movimientos = [];
    const write = await other.request.post(origin + '/api/storage?user_id=1&id=' + encodeURIComponent(id), {
      headers: { 'X-MiBolsillo-Token': cfg.token }, data: { expectedRaw: otherRaw, raw: JSON.stringify(tampered), user_id: 1 }
    });
    assert.equal(write.status(), 400);
    assert.equal((await (await other.request.get(origin + '/api/storage')).json()).raw, otherRaw);
    assert.equal((await other.request.post(origin + '/api/storage', {
      headers: { 'X-MiBolsillo-Token': cfg.token }, data: { expectedRaw: otherRaw, raw: JSON.stringify(tampered) }
    })).status(), 200);
    assert.equal((await state(context, origin)).movimientos[0].id, id);
    await other.close();
    // Delete via its real confirmation and verify it after a full restart.
    await app.evaluate(() => pcApp.switchView('inicio'));
    page.once('dialog', dialog => dialog.accept());
    await app.locator('#view-inicio [data-pc-action="delete-movement"]').first().click();
    await app.waitForFunction(() => Finanzas.state.movimientos.length === 0);
    assert.equal((await state(context, origin)).movimientos.length, 0);
    const deletedCookie = await context.storageState();
    await context.close();
    await stopServer();
    origin = await startServer(samePort);
    context = await browser.newContext({ storageState: deletedCookie, viewport: { width, height: 900 } });
    context.setDefaultTimeout(12000);
    await context.route('https://**/*', route => route.abort());
    page = await context.newPage();
    await page.goto(origin + '/');
    app = await frame(page);
    assert.equal((await state(context, origin)).movimientos.length, 0);
    // Exercise restored-private-document protection independently of logout's
    // BroadcastChannel: a cached page must recheck the server before display.
    const beforeExpire = await (await context.request.get(origin + '/api/config')).json();
    await app.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    assert.equal(await app.evaluate(() => document.documentElement.classList.contains('account-loading')), true);
    assert.equal((await context.request.post(origin + '/api/auth/logout', { headers: { 'X-MiBolsillo-Token': beforeExpire.token } })).status(), 200);
    await app.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await page.locator('#account-submit').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#mibolsillo-app').isVisible(), false);
    await context.close();
    console.log('PASS accounts ' + width + ': real registration/login, duplicate/wrong password, no selectors, no resize reload, draft preservation, movement create/edit/delete survive full restarts, logout, restored-session protection and second-user isolation');
  }
  console.log('Artifacts: ' + output);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  await stopServer();
});
