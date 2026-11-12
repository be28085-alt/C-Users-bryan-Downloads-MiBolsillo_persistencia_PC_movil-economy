// Optional real-browser suite. Uses Playwright from the project or PLAYWRIGHT_MODULE.
// node tests/invoicing.browser.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tmp', 'invoicing');
fs.mkdirSync(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); res.end(); } else { res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(data); } });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}) });
  try {
    for (const [pageName, width, height] of [['desktop.html', 1440, 1050], ['mobile.html', 390, 844], ['desktop.html', 820, 1180]]) {
      const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
      await context.route('https://**/*', route => route.abort());
      const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/${pageName}?modulo=EMPRESARIAL`);
      await page.evaluate(() => {
        Finanzas.state.moduloActivo = 'EMPRESARIAL';
        Finanzas.state.productos = [{ id: 'qa-p', negocioId: Finanzas.state.negocioActivoId, nombre: 'Café colombiano especial', stock: 30, costoUnitario: 4500, precioVenta: 10000, unidadMedida: 'UND' }];
        Finanzas.guardarEstado();
        BusinessUI.navigate('sales');
      });
      await page.evaluate(async () => { await Finanzas.getBusinessService().execute('saveCustomer', { nombre: 'Cliente automático', cedula: '123456789', email: 'auto@example.co', direccion: 'Bogotá' }); });
      await page.locator('[data-business-section="sales"] .bm-header .bm-primary').click();
      assert.equal(await page.locator('[name="name"]').inputValue(), 'Cliente automático');
      assert.equal(await page.locator('[name="email"]').inputValue(), 'auto@example.co');
      assert.equal(await page.locator('[name="unitPrice"]').inputValue(), '10000');
      await page.locator('[name="name"]').fill('María Gómez'); await page.locator('[name="document"]').fill('123456789');
      await page.locator('[name="email"]').fill('maria@example.co'); await page.locator('[name="address"]').fill('Calle 10 # 5-20, Bogotá');
      await page.locator('[name="paymentTerms"]').selectOption('CREDITO'); await page.locator('[name="quantity"]').fill('2'); await page.locator('[name="discountPercent"]').fill('5');
      await page.screenshot({ path: path.join(output, `form-${width}.png`) });
      await page.locator('#inv-editor [value="submit"]').click();
      await page.getByRole('heading', { name: 'SIM-FV-000001', exact: true }).waitFor();
      assert.equal(await page.locator('.inv-message').innerText(), '');
      assert.equal(await page.locator('.inv-status').innerText(), 'Validada internamente');
      await page.locator('.inv-sale-complete').waitFor();
      const popupEvent = page.waitForEvent('popup'); await page.locator('[data-inv="print"]').click(); const printed = await popupEvent; await printed.waitForLoadState(); assert.match(await printed.locator('body').innerText(), /SIM-FV-000001/); await printed.close();
      const info = await page.evaluate(() => ({ documents: Finanzas.state.facturacion.documents.length, sales: Finanzas.state.ventas.filter(v => v.invoiceDocumentId).length, total: Finanzas.state.facturacion.documents[0].totals.total, stock: Finanzas.state.productos[0].stock }));
      assert.deepEqual(info, { documents: 1, sales: 1, total: '22610.00', stock: 28 });
      const xml = await page.evaluate(() => { const x = InvoiceExports.xml(Finanzas.state.facturacion.documents[0]); return { xml: x, errors: new DOMParser().parseFromString(x, 'application/xml').querySelectorAll('parsererror').length }; });
      assert.equal(xml.errors, 0); fs.writeFileSync(path.join(output, 'invoice-experimental.xml'), xml.xml);
      await page.screenshot({ path: path.join(output, `detail-${width}.png`) });
      const downloadPromise = page.waitForEvent('download'); await page.locator('[data-inv="pdf"]').click(); const download = await downloadPromise;
      await download.saveAs(path.join(output, 'invoice-simulation.pdf'));
      if (width === 1440) {
        const longPdf = await page.evaluate(() => { const d = structuredClone(Finanzas.state.facturacion.documents[0]); d.totals.lines = Array.from({ length: 30 }, (_, i) => ({ ...d.totals.lines[0], description: `Artículo ${i + 1}: ` + 'producto con descripción extendida '.repeat(4) })); return Array.from(InvoiceExports.pdf(d)); });
        fs.writeFileSync(path.join(output, 'invoice-pagination-qa.pdf'), Buffer.from(longPdf));
      }
      await page.locator('#inv-payment [name="amount"]').fill('10000'); await page.locator('#inv-payment button').click();
      await page.waitForFunction(() => Finanzas.state.ventas.find(v => v.invoiceDocumentId)?.saldoPendiente === 12610);
      await page.locator('[data-inv="cancel-invoice"]').click(); await page.locator('[name="reason"]').fill('Anulación de prueba con devolución de inventario y pago.');
      await page.locator('#inv-editor [value="submit"]').click(); await page.getByRole('heading', { name: 'SIM-NC-000001', exact: true }).waitFor();
      const cancelled = await page.evaluate(() => ({ status: Finanzas.state.facturacion.documents.find(d => d.kind === 'INVOICE').status, stock: Finanzas.state.productos[0].stock, refunds: Finanzas.state.facturacion.refunds.length }));
      assert.deepEqual(cancelled, { status: 'ANULADA', stock: 30, refunds: 1 });
      await page.locator('[data-inv="home"]').click(); await page.screenshot({ path: path.join(output, `history-${width}.png`) });
      assert.equal(await page.locator('.invoice-dialog').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
      const url = await page.evaluate(() => InvoiceExports.consultationUrl(Finanzas.state.facturacion.documents.find(d => d.kind === 'INVOICE')));
      await page.goto(url); await page.getByRole('heading', { name: 'SIM-FV-000001', exact: true }).waitFor();
      assert.match(await page.locator('.inv-status').innerText(), /Anulada/);
      assert.deepEqual(errors, []);
      await context.close(); console.log(`PASS ${pageName} ${width}px: form, issue, payment, cancellation, PDF, XML, QR reload, overflow`);
    }
    // Real cross-tab Web Locks: two invoices compete for the last unit.
    const context = await browser.newContext(); await context.route('https://**/*', route => route.abort());
    const a = await context.newPage(), b = await context.newPage();
    await a.goto(`${origin}/desktop.html?modulo=EMPRESARIAL`);
    await a.evaluate(() => { Finanzas.state.productos = [{ id: 'last', negocioId: Finanzas.state.negocioActivoId, nombre: 'Última unidad', stock: 1, costoUnitario: 1, precioVenta: 10 }]; Finanzas.guardarEstado(); });
    await b.goto(`${origin}/mobile.html?modulo=EMPRESARIAL`);
    const createDraft = () => new InvoiceService().saveDraft({ customer: { name: 'Prueba', document: '1234', email: 'test@example.co', address: 'Bogotá' }, date: '2026-11-09', paymentTerms: 'CONTADO', paymentMethod: 'Efectivo', lines: [{ productId: 'last', quantity: '1', unitPrice: '10', taxKind: 'IVA', taxRate: '19' }] }, crypto.randomUUID());
    const da = await a.evaluate(createDraft), db = await b.evaluate(createDraft);
    const results = await Promise.all([a.evaluate(id => new InvoiceService().submit(id, crypto.randomUUID()), da.id), b.evaluate(id => new InvoiceService().submit(id, crypto.randomUUID()), db.id)]);
    assert.deepEqual(results.map(d => d.status).sort(), ['RECHAZADA_INTERNA', 'VALIDADA_INTERNA']);
    const aggregate = await a.evaluate(() => JSON.parse(localStorage.getItem('FINANZAS_ETAPA_DATA_V2')).data);
    assert.equal(aggregate.productos[0].stock, 0); assert.equal(aggregate.ventas.filter(v => v.invoiceDocumentId).length, 1);
    await context.close(); console.log('PASS real Web Locks cross-tab: one sale, two unique sequences, no overselling');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
