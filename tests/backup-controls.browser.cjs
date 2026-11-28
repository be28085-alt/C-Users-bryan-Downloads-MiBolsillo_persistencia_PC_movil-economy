'use strict';
// Real authenticated PC/mobile backup UI; all records live in a temporary DB.
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../scripts/serve-sqlite.cjs');
const output = fs.mkdtempSync(path.resolve(__dirname, '..', 'tmp', 'backup-ui-'));
let browser, server;
(async () => {
  server = createServer({ dbPath: path.join(output, 'qa.sqlite') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}),
  });
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: mobile ? 390 : 1366, height: 950 },
      acceptDownloads: true,
    });
    context.setDefaultTimeout(15000);
    await context.route('https://**/*', (route) => route.abort());
    const account = await context.request.post(origin + '/api/auth/register', {
      data: {
        nombre: 'Titular respaldos',
        email: `${mobile ? 'mobile' : 'desktop'}@backup.test`,
        password: 'Respaldo-2026-seguro',
      },
    });
    assert.equal(account.status(), 201);
    const identity = await account.json(),
      token = identity.csrfToken;
    const get = async () => (await context.request.get(origin + '/api/storage')).json();
    async function setAmount(amount) {
      const current = await get(),
        next = JSON.parse(current.raw);
      next.data.saldoInicial = amount;
      next.revision = randomUUID();
      const saved = await context.request.post(origin + '/api/storage', {
        headers: { 'X-MiBolsillo-Token': token },
        data: { expectedRaw: current.raw, raw: JSON.stringify(next) },
      });
      assert.equal(saved.status(), 200);
    }
    await setAmount(100);
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin + `/${mobile ? 'mobile' : 'desktop'}.html`);
    await page.evaluate(
      (mobile) => (mobile ? mobileApp.switchTab('perfil') : pcApp.switchView('perfil')),
      mobile,
    );
    const card = page.locator('#backup-controls');
    await card.waitFor();
    await page.waitForFunction(
      () => document.querySelector('#backup-controls')?.getAttribute('aria-busy') === 'false',
    );
    await card.locator('[data-backup="create"]').click();
    await card.locator('.backup-notice').filter({ hasText: 'Respaldo local creado' }).waitFor();
    const selected = await card.locator('select').inputValue();
    const download = page.waitForEvent('download');
    await card.locator('[data-backup="download"]').click();
    const file = await download,
      filename = path.join(output, `${mobile ? 'mobile' : 'pc'}-backup.json`);
    await file.saveAs(filename);
    assert.equal(JSON.parse(fs.readFileSync(filename, 'utf8')).owner.email, identity.user.email);
    await setAmount(200);
    await card.locator('select').selectOption(selected);
    page.once('dialog', (dialog) => dialog.dismiss());
    await card.locator('[data-backup="restore"]').click();
    await page.waitForFunction(
      () => document.querySelector('#backup-controls')?.getAttribute('aria-busy') === 'false',
    );
    assert.equal(JSON.parse((await get()).raw).data.saldoInicial, 200);
    await page.screenshot({ path: path.join(output, `${mobile ? 'mobile' : 'pc'}-backups.png`) });
    page.once('dialog', (dialog) => dialog.accept());
    await Promise.all([page.waitForEvent('load'), card.locator('[data-backup="restore"]').click()]);
    assert.equal(JSON.parse((await get()).raw).data.saldoInicial, 100);
    assert.equal(JSON.parse((await get()).raw).data.usuario.email, identity.user.email);
    const listed = await (await context.request.get(origin + '/api/backups')).json();
    assert.ok(listed.backups.some((row) => row.reason === 'before-restore'));
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `PASS ${mobile ? 'mobile' : 'desktop'}: create, download, cancel, confirm restore and reload`,
    );
  }
  console.log('Artifacts: ' + output);
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
  });
