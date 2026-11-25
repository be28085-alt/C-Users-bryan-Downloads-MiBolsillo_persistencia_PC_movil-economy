// One authenticated live document reflows without replacing a controller or draft.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../scripts/serve-sqlite.cjs');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(root, 'tmp', 'responsive-live-'));
let server, browser;
(async () => {
  server = createServer({ dbPath: path.join(output, 'accounts.sqlite') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}) });
  const context = await browser.newContext({ viewport: { width: 1366, height: 950 } });
  await context.route('https://**/*', route => route.abort());
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Iniciar sesión', exact: true }).waitFor();
  assert.equal(await page.locator('#mibolsillo-app').getAttribute('src'), 'about:blank');
  const register = await context.request.post(origin + '/api/auth/register', { data: { nombre: 'Prueba adaptable con un nombre completo suficientemente largo', email: 'prueba.de.distribucion.con.correo.largo@example.test', password: 'Prueba-segura-2026' } });
  assert.equal(register.status(), 201);
  await page.reload();
  await page.waitForFunction(() => MiBolsilloEntry.inspect().opened && !MiBolsilloEntry.inspect().loading);
  const frame = await (await page.locator('#mibolsillo-app').elementHandle()).contentFrame();
  await frame.waitForFunction(() => window.Finanzas && typeof pcApp !== 'undefined');
  await frame.addStyleTag({ content: '*{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
  await frame.evaluate(() => { window.__responsiveCore = Finanzas; window.__responsiveDocument = document; window.__responsiveMarker = crypto.randomUUID(); });
  const marker = await frame.evaluate(() => window.__responsiveMarker);
  assert.equal((await frame.locator('a[href*="mobile.html"],a[href*="desktop.html"],.top-notice-bar,.mobile-top-notice').count()), 0);
  assert.equal(await frame.locator('#btnPcPersonalQuick').count(), 0);
  // Check the actual visible controls, not just a clipped document's width.
  for (const width of [320,375,390,768,800,1024,1366,1920]) {
    await page.setViewportSize({width,height:950});
    for (const view of ['inicio','movimientos','registrar','plan','metas','deudas','informes','perfil']) {
      await frame.evaluate(id => pcApp.switchView(id),view);
      await page.waitForTimeout(30);
      const overflow = await frame.evaluate(() => {
        const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
        const scrollable = element => {
          for(let parent=element.parentElement;parent && parent!==document.body;parent=parent.parentElement)
            if (['auto','scroll'].includes(getComputedStyle(parent).overflowX) && parent.scrollWidth>parent.clientWidth+2) return true;
          return false;
        };
        return [...document.querySelectorAll('.pc-view.active button,.pc-view.active input,.pc-view.active select,.pc-view.active h1,.pc-view.active h2,.pc-view.active h3')]
          .filter(visible).filter(element => !scrollable(element)).filter(element => {
            const bounds=element.getBoundingClientRect(); return bounds.right>innerWidth+2 || bounds.left < -2;
          }).map(element=>({tag:element.tagName,id:element.id,text:element.textContent.trim().slice(0,70)}));
      });
      assert.deepEqual(overflow,[],`${view} has reachable controls at ${width}px`);
      if(view==='perfil') {
        assert.equal(await frame.getByText('Gestión y respaldo de datos',{exact:true}).count(),0);
        assert.equal(await frame.locator('#view-perfil button[onclick*="exportar"],#view-perfil button[onclick*="imprimir"],#view-perfil button[onclick*="restablecer"]').count(),0);
        if([390,1366].includes(width)) await page.screenshot({path:path.join(output,`profile-${width}.png`),animations:'disabled'});
      }
    }
  }
  await page.setViewportSize({width:1366,height:950});
  await frame.evaluate(() => pcApp.switchView('movimientos'));
  await frame.locator('#view-movimientos button[onclick="pcApp.openModalNuevoMovimiento()"]').click();
  await frame.locator('#modalQuickTypeIngreso').click();
  await frame.locator('#modalQuickValor').fill('1234.56');
  await frame.locator('#modalQuickConcepto').fill('Borrador que no se pierde');
  for (const [width, height] of [[390,844],[844,390],[320,568],[1366,950]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    assert.equal(await frame.locator('#modalQuickConcepto').inputValue(), 'Borrador que no se pierde');
    assert.equal(await frame.evaluate(() => window.__responsiveCore === Finanzas && window.__responsiveDocument === document), true);
    assert.equal(await frame.evaluate(() => window.__responsiveMarker), marker);
    assert.equal(await frame.locator('#modalPcNuevoMovimiento').isVisible(), true);
    const narrow = width < 800;
    assert.equal(await frame.locator('#responsiveBottomNav').isVisible(), narrow);
    assert.equal(await frame.locator('#pcSidebar').isVisible(), !narrow);
    if (!(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2))) {
      await page.screenshot({path:path.join(output,`overflow-${width}.png`)});
      console.log(await frame.evaluate(() => ({width:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth,overflow:getComputedStyle(document.body).overflowX})));
      console.log(await frame.evaluate(() => [...document.querySelectorAll("body *")].map(el=>({tag:el.tagName,id:el.id,cls:el.className,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).filter(x=>x.right>innerWidth+2).slice(0,25)));
    }
    assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `no horizontal page overflow ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await frame.locator('#modalPcNuevoMovimiento button[type="submit"]').click();
  await frame.waitForFunction(() => Finanzas.state.movimientos.some(m => m.concepto === 'Borrador que no se pierde'));
  assert.equal(await frame.evaluate(() => Finanzas.state.movimientos.filter(m => m.concepto === 'Borrador que no se pierde').length), 1);
  await page.screenshot({ path: path.join(output, 'narrow-movements.png'), animations: 'disabled' });
  await frame.locator('#responsiveBottomNav [aria-label="Más secciones"]').click();
  await frame.locator('#responsiveMenu [data-responsive-view="metas"]').click();
  assert.equal(await frame.locator('#view-metas').isVisible(), true);
  await page.setViewportSize({ width:1366, height:950 });
  assert.equal(await frame.locator('#view-metas').isVisible(), true);
  await frame.evaluate(() => pcApp.setModulo('EMPRESARIAL', 'negocio-inventario'));
  await page.setViewportSize({ width:390, height:844 });
  await frame.locator('#responsiveBottomNav [data-responsive-view="negocio-inventario"]').waitFor({ state:'visible' });
  assert.equal(await frame.locator('#view-negocio-inventario').isVisible(), true);
  await frame.locator('[data-business-section="inventory"]').getByRole('button',{name:'+ Producto',exact:true}).click();
  const productDialog = frame.locator('.bm-dialog[open]');
  await productDialog.getByRole('button',{name:'+ Registrar producto',exact:true}).click();
  await productDialog.locator('[name="nombre"]').fill('Producto de la cuenta autenticada');
  await productDialog.locator('[name="sku"]').fill('AUTH-RESP');
  await productDialog.locator('[name="stock"]').fill('3');
  await productDialog.locator('button[type="submit"]').click();
  await productDialog.locator('[name="observaciones"]').waitFor();
  await productDialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  await frame.waitForFunction(()=>!document.querySelector('.bm-dialog')?.open);
  const persistedAccount = JSON.parse((await (await context.request.get(origin+'/api/storage')).json()).raw).data;
  assert.equal(persistedAccount.productos.find(p=>p.sku==='AUTH-RESP').stock,3);
  await page.screenshot({ path: path.join(output, 'narrow-business.png'), animations:'disabled' });
  await page.setViewportSize({ width:1366, height:950 });
  await page.screenshot({ path: path.join(output, 'wide-business.png'), animations:'disabled' });
  await page.reload();
  await page.waitForFunction(() => MiBolsilloEntry.inspect().opened && !MiBolsilloEntry.inspect().loading);
  const reloaded = await (await page.locator('#mibolsillo-app').elementHandle()).contentFrame();
  await reloaded.waitForFunction(() => window.Finanzas?.state.movimientos.some(m => m.concepto === 'Borrador que no se pierde'));
  assert.equal(await reloaded.evaluate(()=>Finanzas.state.productos.find(p=>p.sku==='AUTH-RESP').stock),3);
  const directMobile = await context.newPage();
  await directMobile.setViewportSize({width:390,height:844});
  await directMobile.goto(origin + '/mobile.html');
  await directMobile.waitForFunction(() => window.mobileApp && window.Finanzas);
  assert.equal(await directMobile.locator('a[href*="mobile.html"],a[href*="desktop.html"],.top-notice-bar,.mobile-top-notice').count(),0);
  await directMobile.locator('#view-inicio button[onclick="mobileApp.openModalRegistrar()"]').click();
  await directMobile.locator('#mobInputConcepto').fill('Borrador móvil intacto');
  await directMobile.evaluate(() => { window.__sameMobile = mobileApp; window.__mobileDoc = document; });
  await directMobile.setViewportSize({width:1366,height:950});
  assert.equal(await directMobile.locator('#mobInputConcepto').inputValue(),'Borrador móvil intacto');
  assert.equal(await directMobile.evaluate(() => window.__sameMobile === mobileApp && window.__mobileDoc === document),true);
  await directMobile.screenshot({path:path.join(output,'mobile-direct-wide.png'),animations:'disabled'});
  await directMobile.setViewportSize({width:390,height:844});
  assert.equal(await directMobile.locator('#mobInputConcepto').inputValue(),'Borrador móvil intacto');
  await directMobile.screenshot({path:path.join(output,'mobile-direct-narrow.png'),animations:'disabled'});
  await directMobile.evaluate(()=>mobileApp.closeModalRegistrar());
  for(const width of [320,390,768,1024,1366]) {
    await directMobile.setViewportSize({width,height:950});
    for(const tab of ['inicio','movimientos','plan','informes','perfil']) {
      await directMobile.evaluate(tab=>mobileApp.switchTab(tab),tab);
      const clipped=await directMobile.evaluate(()=>[...document.querySelectorAll('.screen-view.active button,.screen-view.active input,.screen-view.active select')].filter(element=>{
        if(!element.getClientRects().length||getComputedStyle(element).visibility==='hidden') return false;
        for(let parent=element.parentElement;parent&&parent!==document.body;parent=parent.parentElement)
          if(['auto','scroll'].includes(getComputedStyle(parent).overflowX)&&parent.scrollWidth>parent.clientWidth+2) return false;
        const bounds=element.getBoundingClientRect();return bounds.right>innerWidth+2||bounds.left < -2;
      }).map(element=>({id:element.id,text:element.textContent.trim().slice(0,50)})));
      assert.deepEqual(clipped,[],`mobile ${tab} controls at ${width}px`);
      if(tab==='perfil') assert.equal(await directMobile.getByRole('heading',{name:'Gestión de datos',exact:true}).count(),0);
    }
  }
  await directMobile.close();
  assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS responsive authenticated HTML: same document/core/session and draft across widths/rotation; no selector; Personal/Business navigation; SQLite save/reload');
  console.log('Artifacts: ' + output);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
});
