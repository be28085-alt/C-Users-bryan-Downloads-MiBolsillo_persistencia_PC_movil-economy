'use strict';
// Pruebas locales: cuentas ficticias, SQLite aislado y recursos externos bloqueados.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../scripts/serve-sqlite.cjs');
const output = fs.mkdtempSync(path.resolve(__dirname, '../tmp/security-browser-'));
const server = createServer({ dbPath: path.join(output, 'synthetic.sqlite'), security: { mode: 'test' } });
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true });
  for (const mode of ['desktop', 'mobile']) {
    const context = await browser.newContext({ viewport: { width: mode === 'mobile' ? 390 : 1366, height: 950 } });
    await context.route('https://**/*', route => route.abort());
    const script = '</script><script>window.__phase3Xss=2</script>';
    const html = '\"><img src=x onerror="window.__phase3Xss=1">';
    const response = await context.request.post(origin + '/api/auth/register', { data: { nombre: script, email: mode + '@example.test', password: 'Contraseña-sintética-2026' } });
    assert.equal(response.status(), 201);
    const account = await response.json();
    const before = (await (await context.request.get(origin + '/api/storage')).json()).raw;
    const envelope = JSON.parse(before), state = envelope.data;
    state.movimientos.push({ id: 'm-xss', tipo: 'INGRESO', valor: 15, concepto: html, fecha: '2026-11-26', categoria: html, cuenta: 'Efectivo' });
    state.metas.push({ id: 'g-xss', nombre: html, montoObjetivo: 100, montoActual: 0 });
    state.deudas.push({ id: 'd-xss', nombre: html, montoInicial: 100, saldoPendiente: 100 });
    state.productos.push({ id: 'p-xss', negocioId: 'neg-1', nombre: html, stock: 1, precioVenta: 3, costoUnitario: 1 });
    const write = await context.request.post(origin + '/api/storage', { headers: { 'X-MiBolsillo-Token': account.csrfToken, 'X-MiBolsillo-Account': String(account.user.id) }, data: { expectedRaw: before, raw: JSON.stringify(envelope) } });
    assert.equal(write.status(), 200);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const navigation = await page.goto(origin + '/' + mode + '.html');
    assert.match(navigation.headers()['content-security-policy'], /connect-src 'self'/);
    assert.match(navigation.headers()['content-security-policy'], /frame-ancestors 'self'/);
    assert.equal(navigation.headers()['cache-control'], 'no-store');
    await page.waitForFunction(() => window.Finanzas && window.BusinessUI);
    for (const section of mode === 'mobile' ? ['inicio','movimientos','plan','informes','perfil','negocio'] : ['inicio','movimientos','plan','metas','deudas','perfil','negocio-productos']) {
      await page.evaluate(async ({ mode, section }) => {
        if (mode === 'mobile') await mobileApp.switchTab(section);
        else if (section.startsWith('negocio-')) await pcApp.setModulo('EMPRESARIAL', section);
        else pcApp.switchView(section);
        BusinessUI.renderAll();
      }, { mode, section });
      assert.equal(await page.evaluate(() => window.__phase3Xss), undefined);
      assert.equal(await page.locator('img[src="x"], script:not([src])').evaluateAll(nodes => nodes.filter(node => node.tagName === 'IMG' || node.textContent === 'window.__phase3Xss=2').length), 0);
    }
    assert.ok((await page.locator('body').textContent()).includes(html), 'el contenido malicioso se muestra como texto');
    const privateStorage = await page.evaluate(() => [localStorage, sessionStorage].map(storage => Object.keys(storage).map(key => storage.getItem(key)).join('')).join(''));
    assert.equal(privateStorage.includes(account.csrfToken), false);
    assert.equal(privateStorage.includes(html), false);
    const session = (await context.cookies()).find(cookie => cookie.name === 'mibolsillo_session');
    assert.ok(session.httpOnly); assert.equal(session.sameSite, 'Strict');
    assert.equal(privateStorage.includes(session.value), false);
    await page.reload(); await page.waitForFunction(() => window.Finanzas);
    assert.equal(await page.evaluate(() => window.__phase3Xss), undefined);
    assert.equal(await page.evaluate(() => Finanzas.state.movimientos.find(item => item.id === 'm-xss').concepto), html);
    assert.equal(JSON.parse((await (await context.request.get(origin + '/api/storage')).json()).raw).data.productos[0].nombre, html);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS ' + mode + ': XSS almacenado en perfil, movimientos, metas, deudas e inventario; CSP, cookie, memoria y persistencia');
  }
  console.log('Artifacts: ' + output);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
});
