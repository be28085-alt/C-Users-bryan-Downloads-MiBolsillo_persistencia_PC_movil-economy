// Real UI, persistence and viewport checks. Optional dependency: Playwright.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'tmp', 'business-workspace');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, data) => { if (e) { res.writeHead(404); res.end(); } else { res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream'); res.end(data); } });
});
const routes = { dashboard: ['negocio-dashboard', 'negocio'], inventory: ['negocio-inventario', 'inventario'], movements: ['negocio-movimientos', 'movimientos'], sales: ['negocio-ventas', 'ventas'], contacts: ['negocio-proveedores', 'proveedores'], management: ['negocio-gestion', 'gestion'] };
async function nav(page, section, mobile) {
  const route = routes[section][mobile ? 1 : 0];
  if (!mobile) await page.locator(`#navEmpresarial [data-view="${route}"]`).click();
  else if (section === 'movements') { await page.locator('#mobileBusinessOptionsToggle').click(); await page.locator('[data-quick-action="business-movements"]').click(); }
  else await page.locator(`#mobileBusinessNav [data-business-tab="${route}"]`).click();
  return page.locator(`[data-business-section="${section}"]`);
}
async function fill(dialog, values) { for (const [name, value] of Object.entries(values)) await dialog.locator(`[name="${name}"]`).fill(String(value)); }
async function save(page, double = false) {
  const dialog = page.locator('.bm-dialog[open]');
  if (double) await dialog.locator('button[type="submit"]').evaluate(b => { b.click(); b.click(); });
  else await dialog.locator('button[type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector('.bm-dialog')?.open);
}
async function flow(page, mobile) {
  let view = await nav(page, 'contacts', mobile); await view.locator('[data-tab="suppliers"]').click(); await view.getByRole('button', { name: '+ Proveedor', exact: true }).click();
  let dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { nombre: 'Proveedor A', cedula: '900123', email: 'proveedor@example.co' }); await save(page);
  await view.locator('[data-tab="customers"]').click(); await view.getByRole('button', { name: '+ Cliente', exact: true }).click();
  dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { nombre: 'Cliente A', cedula: '123456', email: 'cliente@example.co', direccion: 'Bogotá' }); await save(page);
  // Exercise the formerly decorative quick action from each platform.
  if (mobile) { await page.locator('#mobileBusinessOptionsToggle').click(); await page.locator('[data-quick-action="business-product"]').click(); }
  else { await page.locator('#btnPcBusinessQuick').click(); await page.locator('.bm-dialog[open] [data-kind="product"]').click(); }
  dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { nombre: 'Artículo principal', sku: 'SKU-A', stock: '10', stockMinimo: '2', costoUnitario: '1000', precioVenta: '2000' });
  await dialog.locator('[name="proveedorId"]').selectOption({ label: 'Proveedor A · 900123' }); await save(page, true);
  assert.equal(await page.evaluate(() => Finanzas.state.productos.length), 1);
  view = await nav(page, 'management', mobile); await view.getByRole('button', { name: '+ Compra', exact: true }).click();
  dialog = page.locator('.bm-dialog[open]'); await dialog.locator('[name="proveedorId"]').selectOption({ label: 'Proveedor A · 900123' });
  await dialog.locator('[name="productoId"]').selectOption({ label: 'Artículo principal · stock 10' });
  await fill(dialog, { cantidad: '5', precioUnitario: '1200', fecha: '2026-11-09', fechaVencimiento: '2026-12-09' }); await dialog.locator('[name="tipoPago"]').selectOption('CREDITO'); await save(page);
  view = await nav(page, 'sales', mobile); await view.getByRole('button', { name: '+ Confirmar venta', exact: true }).click();
  dialog = page.locator('.bm-dialog[open]'); await dialog.locator('[name="clienteId"]').selectOption({ label: 'Cliente A · 123456' }); await dialog.locator('[name="productoId"]').selectOption({ label: 'Artículo principal · stock 15' });
  await fill(dialog, { cantidad: '3', descuentoPorcentaje: '10', fecha: '2026-11-09', fechaVencimiento: '2026-12-09' }); await dialog.locator('[name="impuesto"]').selectOption('IVA:19'); await dialog.locator('[name="tipoPago"]').selectOption('CREDITO'); await save(page, true);
  assert.equal(await page.evaluate(() => Finanzas.state.ventas.length), 1);
  await view.getByRole('button', { name: 'Registrar pago', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { monto: '2000', fecha: '2026-11-09' }); await save(page);
  view = await nav(page, 'management', mobile); await view.locator('[data-tab="payables"]').click(); await view.getByRole('button', { name: 'Registrar pago', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { monto: '1000', fecha: '2026-11-09' }); await save(page);
  view = await nav(page, 'movements', mobile); await view.getByRole('button', { name: '+ Gasto', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { descripcion: 'Servicios empresariales', categoria: 'Servicios', monto: '500', fecha: '2026-11-09' }); await save(page);
  await view.getByRole('button', { name: '+ Ingreso', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { descripcion: 'Ingreso adicional', monto: '250', fecha: '2026-11-09' }); await save(page);
  view = await nav(page, 'management', mobile); await view.locator('[data-tab="employees"]').click(); await view.getByRole('button', { name: '+ Empleado', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { nombre: 'Colaborador A', salario: '2000', fechaIngreso: '2026-11-09' }); await save(page);
  await view.getByRole('button', { name: 'Registrar pago', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { monto: '300', periodo: '2026-11', fecha: '2026-11-09' }); await save(page);
  // Edit the existing item instead of silently adding a second one.
  view = await nav(page, 'inventory', mobile); await view.getByRole('button', { name: 'Editar', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { nombre: 'Artículo editado' }); await save(page);
  assert.equal(await page.evaluate(() => Finanzas.state.productos.length), 1); assert.equal(await page.evaluate(() => Finanzas.state.ventas[0].detalles[0].productoNombre), 'Artículo principal');
  const snapshot = await page.evaluate(() => { const m = BusinessReadModel.build(Finanzas, Finanzas.state.negocioActivoId, 'TODOS'); return { stock: Finanzas.state.productos[0].stock, revenue: m.report.totals.income, profit: m.report.totals.netProfit, ar: m.receivableTotal, ap: m.payableTotal, cash: m.cash.flujoNeto }; });
  assert.deepEqual(snapshot, { stock: 12, revenue: '5650.00', profit: '1650.00', ar: '4426.00', ap: '5000.00', cash: 450 });
  // Storage failure keeps the form and its key; retry creates exactly one record.
  await view.getByRole('button', { name: '+ Producto', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { nombre: 'Producto reintentado', sku: 'RETRY' });
  await page.evaluate(() => { window.__originalStorageSet = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (window.__storageFailure && k === 'FINANZAS_ETAPA_DATA_V2') throw new Error('QuotaExceededError'); return window.__originalStorageSet.call(this, k, v); }; window.__storageFailure = true; });
  await dialog.locator('button[type="submit"]').click(); await dialog.locator('.bm-form-feedback').filter({ hasText: 'No se pudo guardar' }).waitFor(); assert.equal(await page.evaluate(() => Finanzas.state.productos.length), 1);
  await page.evaluate(() => { window.__storageFailure = false; }); await save(page); assert.equal(await page.evaluate(() => Finanzas.state.productos.length), 2);
  // Search, CSV and consultation must use the saved records.
  await view.locator('[data-bm-search]').fill('Artículo editado'); assert.equal(await view.locator('tr[data-record-id]').count(), 1);
  const downloaded = page.waitForEvent('download'); await view.getByRole('button', { name: 'Descargar CSV', exact: true }).click(); const file = await downloaded; await file.saveAs(path.join(output, `${mobile ? 'mobile' : 'pc'}-products.csv`));
  await view.getByRole('button', { name: 'Consultar', exact: true }).click(); await page.locator('.bm-dialog[open] [data-bm="close"]').first().click();
  // Print a real sale voucher (the normal flow does not fabricate an official invoice).
  view = await nav(page, 'sales', mobile); const popupPromise = page.waitForEvent('popup'); await view.getByRole('button', { name: 'Comprobante', exact: true }).click(); const popup = await popupPromise; await popup.waitForLoadState(); assert.match(await popup.locator('body').innerText(), /SIN VALIDEZ FISCAL/); await popup.close();
  // Recipes, stock consumption and the produced lot are exercised through the actual forms.
  view = await nav(page, 'inventory', mobile); await view.getByRole('button', { name: '+ Producto', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { nombre: 'Producto fabricado', sku: 'FAB', precioVenta: '5000' }); await save(page);
  view = await nav(page, 'management', mobile); await view.locator('[data-tab="production"]').click(); await view.getByRole('button', { name: '+ Receta', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { nombre: 'Receta comprobada', cantidadBase: '1' });
  await dialog.locator('[name="productoId"]').selectOption({ label: 'Producto fabricado' }); await dialog.locator('[name="materiaPrimaId"]').selectOption({ label: 'Artículo editado · stock 12' }); await dialog.locator('[name="cantidadRequerida"]').fill('2'); await save(page);
  await view.getByRole('button', { name: 'Producir', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { cantidad: '1', fecha: '2026-11-09' }); await save(page);
  assert.equal(await page.evaluate(() => Finanzas.state.producciones.length), 1); assert.equal(await page.evaluate(() => Finanzas.state.productos.find(p => p.sku === 'SKU-A').stock), 10);
  // Business settings and switching do not move records into another business.
  await view.locator('[data-tab="business"]').click(); await view.getByRole('button', { name: 'Editar negocio activo', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { nombre: 'Negocio comprobado' }); await save(page);
  const originalBusiness = await page.evaluate(() => Finanzas.state.negocioActivoId);
  view = await nav(page, 'management', mobile); await view.locator('[data-tab="business"]').click(); await view.getByRole('button', { name: '+ Crear negocio', exact: true }).click(); dialog = page.locator('.bm-dialog[open]'); await fill(dialog, { nombre: 'Segundo negocio' }); await save(page);
  assert.equal(await page.evaluate(() => Finanzas.getVentas().length), 0); await page.locator('[data-business-section="dashboard"] [data-bm-active]').selectOption(originalBusiness); await page.waitForFunction(id => Finanzas.state.negocioActivoId === id, originalBusiness);
  // The bell/menu now shows business alerts instead of opening the personal plan.
  if (mobile) { await page.locator('#mobileBusinessOptionsToggle').click(); await page.locator('[data-quick-action="business-alerts"]').click(); }
  else await page.evaluate(() => pcApp.toggleAlertsSummary());
  await page.locator('.bm-dialog[open]').getByRole('heading', { name: 'Alertas de Mi Negocio' }).waitFor(); await page.locator('.bm-dialog[open] [data-bm="close"]').first().click();
  const persisted = await page.evaluate(() => JSON.stringify({ ventas: Finanzas.state.ventas, compras: Finanzas.state.compras, productos: Finanzas.state.productos, pagosCompra: Finanzas.state.pagosCompra, pagosVenta: Finanzas.state.pagosVenta }));
  await page.reload(); assert.equal(await page.evaluate(() => JSON.stringify({ ventas: Finanzas.state.ventas, compras: Finanzas.state.compras, productos: Finanzas.state.productos, pagosCompra: Finanzas.state.pagosCompra, pagosVenta: Finanzas.state.pagosVenta })), persisted);
  await page.evaluate(async () => { for (let i = 0; i < 11; i++) await Finanzas.getBusinessService().execute('saveSupplier', { nombre: `Proveedor adicional ${i}`, cedula: String(80010000 + i) }); });
  view = await nav(page, 'contacts', mobile); await view.locator('[data-tab="suppliers"]').click(); assert.equal(await view.locator('tr[data-record-id]').count(), 10); await view.getByRole('button', { name: 'Siguiente', exact: true }).click(); assert.equal(await view.locator('tr[data-record-id]').count(), 2); await view.getByRole('button', { name: 'Anterior', exact: true }).click(); assert.equal(await view.locator('tr[data-record-id]').count(), 10);
  // Archive a related customer and retain the sale and customer snapshot.
  view = await nav(page, 'contacts', mobile); await view.locator('[data-tab="customers"]').click(); await view.getByRole('button', { name: 'Eliminar / archivar', exact: true }).click(); await save(page);
  assert.equal(await page.evaluate(() => Finanzas.state.clientes[0].estado), 'ARCHIVADO'); assert.equal(await page.evaluate(() => Finanzas.state.ventas[0].clienteSnapshot.nombre), 'Cliente A');
}
async function seed(page) {
  await page.evaluate(async () => {
    const s = Finanzas.getBusinessService();
    await s.execute('saveSupplier', { nombre: 'Proveedor de prueba', cedula: '9001' });
    const c = (await s.execute('saveCustomer', { nombre: 'Cliente de prueba', cedula: '1234' })).record;
    const p = (await s.execute('saveProduct', { nombre: 'Producto con descripción para pantalla estrecha', stock: '12', stockMinimo: '15', precioVenta: '15000', costoUnitario: '7000', sku: 'P-01' })).record;
    await s.execute('sale', { clienteId: c.id, fecha: '2026-11-09', tipoPago: 'CREDITO', detalles: [{ productoId: p.id, cantidad: '2', precioUnitario: '15000' }] });
  });
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}) });
  try {
    for (const [name, mobile] of [['desktop.html', false], ['mobile.html', true]]) for (const width of [320, 375, 390, 768, 1024, 1366, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: width < 500 ? 900 : 1100 }, acceptDownloads: true }); context.setDefaultTimeout(10000);
      await context.route('https://**/*', route => route.abort()); await context.addInitScript(() => { window.print = () => {}; });
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${origin}/${name}?modulo=EMPRESARIAL`); await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}.toast-container,.pc-toast-container{display:none!important}' });
      if ((!mobile && width === 1366) || (mobile && width === 390)) await flow(page, mobile); else await seed(page);
      await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}.toast-container,.toast-notice{display:none!important}' });
      for (const section of Object.keys(routes)) {
        const view = await nav(page, section, mobile);
        assert.equal(await view.locator('.bm-error').count(), 0, `${name} ${width} ${section}`);
        const bounds = await view.evaluate(el => ({ right: el.getBoundingClientRect().right, scroll: el.scrollWidth, client: el.clientWidth, viewport: innerWidth }));
        assert.ok(bounds.right <= bounds.viewport + 2, `${name} ${width} ${section}: right=${bounds.right}`);
        assert.ok(bounds.scroll <= bounds.client + 2, `${name} ${width} ${section}: horizontal overflow ${bounds.scroll}/${bounds.client}`);
      }
      await nav(page, 'dashboard', mobile);
      if (!mobile && width >= 768) assert.ok(await page.locator('.top-notice-bar').evaluate(bar => {
        const bounds = bar.getBoundingClientRect();
        return Array.from(bar.querySelectorAll('a')).every(link => { const r = link.getBoundingClientRect(); return r.top >= bounds.top && r.bottom <= bounds.bottom && r.right <= bounds.right; });
      }), `desktop ${width}: version links must fit the header`);
      await page.screenshot({ path: path.join(output, `${mobile ? 'mobile' : 'pc'}-${width}-dashboard.png`), animations: 'disabled' });
      await nav(page, 'inventory', mobile); await page.locator('[data-business-section="inventory"]').getByRole('button', { name: '+ Producto', exact: true }).click();
      const dialog = page.locator('.bm-dialog[open]'); assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 2)); await page.screenshot({ path: path.join(output, `${mobile ? 'mobile' : 'pc'}-${width}-form.png`) }); await dialog.locator('[data-bm="close"]').first().click();
      const personal = await page.evaluate(() => JSON.stringify(Finanzas.state.movimientos));
      await page.evaluate(() => { if (typeof pcApp !== 'undefined') pcApp.setModulo('PERSONAL', 'inicio'); else mobileApp.setModulo('PERSONAL', 'inicio'); });
      assert.equal(await page.evaluate(() => JSON.stringify(Finanzas.state.movimientos)), personal); assert.equal(await page.locator('#view-inicio').evaluate(el => el.classList.contains('active')), true);
      assert.deepEqual(errors, []); await context.close(); console.log(`PASS ${name} ${width}px: business views, forms, navigation and isolation${(!mobile && width === 1366) || (mobile && width === 390) ? '; full CRUD/payment/reload/storage-error flow' : ''}`);
    }
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
