// Optional browser verification: node tests/business-reports.browser.cjs (requires Playwright).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'tmp', 'business-reports');
fs.mkdirSync(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
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
    const results = [];
    for (const [name, width, height] of ['desktop.html', 'mobile.html'].flatMap(name => [320, 375, 390, 768, 1024, 1366, 1920].map(width => [name, width, width < 500 ? 900 : 1100]))) {
      const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
      context.setDefaultTimeout(10000);
      await context.route('https://**/*', route => route.abort());
      await context.addInitScript(() => { window.print = () => { window.__reportPrinted = true; }; });
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        const NativeDate = Date;
        window.Date = class extends NativeDate {
          constructor(...args) { super(...(args.length ? args : ['2026-11-09T20:00:00.000Z'])); }
          static now() { return new NativeDate('2026-11-09T20:00:00.000Z').getTime(); }
        };
      });
      await page.goto(`${origin}/${name}?modulo=EMPRESARIAL`);
      await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; } .toast-container { display: none !important; }' });
      await page.evaluate(() => {
        const n = Finanzas.state.negocioActivoId;
        Finanzas.state.negocios.find(b => b.id === n).nombre = 'Panadería del Sol';
        Finanzas.state.ventas = [
          { id: 'r1', negocioId: n, fecha: '2026-11-09', total: 4500000, costoTotalVenta: 1700000, detalles: [{ cantidad: 100, costoUnitario: 17000 }] },
          { id: 'r2', negocioId: n, fecha: '2026-11-01', total: 2300000, costoTotalVenta: 900000, detalles: [{ cantidad: 100, costoUnitario: 9000 }] },
          { id: 'r3', negocioId: n, fecha: '2026-10-31', total: 5200000, costoTotalVenta: 2100000, detalles: [{ cantidad: 100, costoUnitario: 21000 }] },
          ...['06', '07', '08', '09'].map((m, i) => ({ id: 'h' + m, negocioId: n, fecha: `2026-${m}-15`, total: 2500000 + i * 450000, costoTotalVenta: 1000000 + i * 120000, detalles: [] }))
        ];
        Finanzas.state.ingresosNegocio = [{ id: 'i', negocioId: n, fecha: '2026-11-05', monto: 200000 }];
        Finanzas.state.gastosNegocio = [
          { id: 'g1', negocioId: n, fecha: '2026-11-02', monto: 850000, categoria: 'Arriendo' },
          { id: 'g2', negocioId: n, fecha: '2026-11-03', monto: 280000, categoria: 'Servicios públicos' },
          { id: 'g3', negocioId: n, fecha: '2026-11-04', monto: 120000, categoria: 'Transporte' },
          { id: 'g4', negocioId: n, fecha: '2026-11-05', monto: 150000, categoria: 'Marketing y publicidad' },
          { id: 'g5', negocioId: n, fecha: '2026-10-02', monto: 900000, categoria: 'Arriendo' }
        ];
        Finanzas.state.pagosEmpleado = [{ id: 'pay', negocioId: n, fecha: '2026-11-05', monto: 1000000 }];
        Finanzas.state.clientes = [{ id: 'cli', negocioId: n, nombre: 'Cliente', saldoPendiente: 1250000 }];
        Finanzas.guardarEstado();
        if (typeof pcApp !== 'undefined') pcApp.switchView('negocio-informes');
        else mobileApp.switchBusinessTab('informes');
      });
      const report = page.locator('[data-business-report]');
      await report.getByRole('heading', { name: 'Tu negocio, en perspectiva' }).waitFor();
      const values = await Promise.all(['netProfit', 'income', 'expenses', 'salesCount'].map(field => report.locator(`[data-report-value="${field}"]`).innerText()));
      assert.deepEqual(values, ['+2.000.000 COP', '7.000.000 COP', '5.000.000 COP', '2']); results.push(values);
      assert.equal(await report.locator('svg.br-bars').count(), 1);
      assert.equal(await report.locator('[data-report-value="sales"]').innerText(), '6.800.000 COP');
      assert.equal(await report.locator('[data-report-value="grossProfit"]').innerText(), '4.200.000 COP');
      assert.equal(await report.locator('[data-report-value="businessExpenses"]').innerText(), '1.400.000 COP');
      assert.equal(await report.locator('[data-report-value="employeePayments"]').innerText(), '1.000.000 COP');
      assert.equal(await report.locator('[data-report-detail="sales"] tbody tr').count(), 2);
      assert.equal(await report.locator('[data-report-detail="expenses"] tbody tr').count(), 5);
      await report.locator('[data-report-period]').selectOption('PERSONALIZADO');
      await report.locator('[data-report-from]').fill('2026-11-03'); await report.locator('[data-report-to]').fill('2026-11-05');
      await report.locator('[data-report-action="range"]').click();
      assert.equal(await report.locator('[data-report-value="netProfit"]').innerText(), '-1.350.000 COP');
      assert.equal(await report.locator('[data-report-detail="expenses"] tbody tr').count(), 4);
      assert.equal(await report.locator('[data-report-detail="sales"]').getByText('No hay registros en el período seleccionado.').count(), 1);
      await report.locator('[data-report-from]').fill('2026-11-10'); await report.locator('[data-report-action="range"]').click();
      assert.match(await report.locator('.br-feedback').innerText(), /Desde/);
      assert.equal(await report.locator('[data-report-value="netProfit"]').innerText(), '-1.350.000 COP');
      const customDownload = page.waitForEvent('download'); await report.locator('[data-report-action="csv"]').click();
      const customCSV = await customDownload, customPath = path.join(output, `${name}-${width}-custom.csv`); await customCSV.saveAs(customPath);
      assert.match(fs.readFileSync(customPath, 'utf8'), /"Desde";"2026-11-03"/);
      assert.match(fs.readFileSync(customPath, 'utf8'), /"Utilidad neta";"-1350000.00"/);
      await report.locator('[data-report-period]').selectOption('MES_ACTUAL');
      assert.equal(await report.locator('.br-results tr').count(), 7);
      const dataBefore = await page.evaluate(() => JSON.stringify(Finanzas.state));
      await page.screenshot({ path: path.join(output, `${width}-overview.png`) });
      await report.locator('summary').click(); assert.equal(await report.locator('.br-monthly-data tr').count(), 7);
      await report.locator('summary').click();
      await report.locator('[data-report-period]').selectOption('MES_ANTERIOR');
      assert.equal(await report.locator('[data-report-value="income"]').innerText(), '5.200.000 COP');
      const downloaded = page.waitForEvent('download'); await report.locator('[data-report-action="csv"]').click();
      const csv = await downloaded; const csvPath = path.join(output, `${width}-october.csv`); await csv.saveAs(csvPath);
      assert.match(fs.readFileSync(csvPath, 'utf8'), /"Ingresos totales";"5200000.00"/);
      await page.evaluate(() => { const original = window.open.bind(window); window.open = (...args) => { const p = original(...args); if (p) p.print = () => { p.__reportPrinted = true; }; return p; }; });
      const popupPromise = page.waitForEvent('popup'); await report.locator('[data-report-action="print"]').click(); const popup = await popupPromise;
      await popup.waitForLoadState();
      try { await popup.waitForFunction(() => window.__reportPrinted === true, null, { timeout: 5000 }); }
      catch (e) { console.error(await popup.evaluate(() => ({ ready: document.readyState, print: window.print.toString(), body: document.body.innerText.slice(0, 200), styleCount: document.styleSheets.length, url: location.href }))); throw e; }
      assert.match(await popup.locator('body').innerText(), /octubre de 2026/);
      assert.notEqual(await popup.locator('.br-hero').evaluate(el => getComputedStyle(el).backgroundImage), 'none', 'print CSS must be applied');
      assert.equal(await popup.locator('[data-report-action]').count(), 0);
      assert.equal(await popup.locator('[data-report-detail="sales"] tbody tr').count(), 1);
      assert.match(await popup.locator('body').innerText(), /Detalle de gastos y pagos al personal/);
      if (name === 'desktop.html' && width === 1366) await popup.pdf({ path: path.join(output, 'business-report.pdf'), format: 'A4', printBackground: true });
      await popup.close();
      await report.locator('[data-report-period]').selectOption('MES_ACTUAL');
      assert.equal(await page.evaluate(() => JSON.stringify(Finanzas.state)), dataBefore);
      await report.locator('.br-detail-grid').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, `${width}-breakdown.png`) });
      await report.locator('[data-report-detail="sales"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `${name}-${width}-sales-detail.png`) });
      const layout = await report.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, overflowing: [...el.querySelectorAll('*')].filter(child => child.getBoundingClientRect().right > el.getBoundingClientRect().right + 2 && !child.closest('.br-table-wrap')).map(child => ({ tag: child.tagName, cls: child.className, width: child.getBoundingClientRect().width, text: child.textContent.slice(0, 50) })).slice(0, 10) }));
      assert.ok(layout.scroll <= layout.width + 2, `${name} ${width}: report overflow ${JSON.stringify(layout)}`);
      assert.ok(await report.evaluate(el => el.getBoundingClientRect().right <= innerWidth + 2), `${width}: report must fit viewport`);
      const previousPersonal = await page.evaluate(() => JSON.stringify(Finanzas.state.movimientos));
      await page.evaluate(() => { if (typeof pcApp !== 'undefined') pcApp.setModulo('PERSONAL', 'informes'); else mobileApp.setModulo('PERSONAL', 'informes'); });
      assert.equal(await page.evaluate(() => JSON.stringify(Finanzas.state.movimientos)), previousPersonal);
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS ${name} ${width}px: indicators, offline charts, periods, CSV, print, state isolation, responsive layout`);
    }
    assert.ok(results.every(values => JSON.stringify(values) === JSON.stringify(results[0])));
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
