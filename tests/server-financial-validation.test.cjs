'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer,revisionOf,openStore}=require('../scripts/serve-sqlite.cjs');
async function fixture(t,options={}) {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mibolsillo-validation-'));
  const server=createServer({dbPath:path.join(folder,'qa.sqlite'),...options});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>{server.close(r);server.closeAllConnections();});fs.rmSync(folder,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const result=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:'Validación',email:'test@example.test',password:'Prueba-segura-2026'})});
  const identity=await result.json(),cookie=result.headers.get('set-cookie').split(';')[0];
  const headers={Cookie:cookie,'Content-Type':'application/json','X-MiBolsillo-Token':identity.csrfToken,'X-MiBolsillo-Account':String(identity.user.id)};
  return {server,base,headers,async read(){return(await fetch(base+'/api/storage',{headers})).json();},async write(method,body,extra={}){return fetch(base+'/api/storage',{method,headers:{...headers,...extra},body:JSON.stringify(body)});}};
}
test('API rechaza importes, fechas, campos y referencias inválidos sin cambiar SQLite',async t=>{
  const f=await fixture(t),before=await f.read();
  const movement={id:'test',tipo:'GASTO',concepto:'Prueba',valor:100,fecha:'2026-11-23'};
  for(const invalid of [{...movement,valor:-1},{...movement,valor:'Infinity'},{...movement,valor:null},{...movement,fecha:'2026-02-30'},{...movement,fecha:'23/11/2026'},{...movement,tipo:'OTRO'},{...movement,concepto:''},{...movement,cuentaId:'otra-cuenta'}]) {
    const state=JSON.parse(before.raw);state.data.movimientos=[invalid];
    const response=await f.write('POST',{expectedRaw:before.raw,raw:JSON.stringify(state)});
    assert.equal(response.status,400,JSON.stringify(invalid));assert.ok((await response.json()).error);
    assert.equal((await f.read()).raw,before.raw);
  }
  const state=JSON.parse(before.raw);state.data.productos=[{id:'product',nombre:'Producto',negocioId:'otro-usuario',stock:1}];
  assert.equal((await f.write('POST',{expectedRaw:before.raw,raw:JSON.stringify(state)})).status,400);
  assert.equal((await f.read()).raw,before.raw);
  assert.equal((await f.write('POST',{expectedRaw:before.raw,raw:JSON.stringify(state)},{'X-MiBolsillo-Account':'99999'})).status,401);
});
test('PATCH incremental confirma, recupera reintento, detecta conflictos y bloquea rutas inseguras',async t=>{
  const f=await fixture(t),before=await f.read();
  const operations=[{op:'set',path:['revision'],value:'payment-1'},{op:'splice',path:['data','movimientos'],index:0,deleteCount:0,items:[{id:'m',tipo:'INGRESO',concepto:'Prueba',valor:0.01,fecha:'2026-11-23'}]}];
  const body={expectedRevision:before.revision,operationId:'payment-1',operations};
  let response=await f.write('PATCH',body);assert.equal(response.status,200);assert.equal((await response.json()).revision,'payment-1');
  const saved=await f.read();assert.equal(JSON.parse(saved.raw).data.movimientos.length,1);
  assert.equal(revisionOf(saved.raw),'payment-1');
  response=await f.write('PATCH',body);assert.equal(response.status,200);assert.equal((await response.json()).duplicate,true);
  assert.equal(JSON.parse((await f.read()).raw).data.movimientos.length,1);
  assert.equal((await f.write('PATCH',{...body,operationId:'payment-2'})).status,409);
  const unchanged=await(await fetch(f.base+'/api/storage?revision=payment-1',{headers:f.headers})).json();assert.equal(unchanged.unchanged,true);assert.equal(unchanged.raw,undefined);
  for(const operation of [{op:'set',path:['data','__proto__','polluted'],value:true},{op:'splice',path:['data','movimientos'],index:99,deleteCount:0,items:[]},{op:'set',path:['data','movimientos',0,'valor'],value:-2}]) {
    response=await f.write('PATCH',{expectedRevision:'payment-1',operationId:'payment-2',operations:[{op:'set',path:['revision'],value:'payment-2'},operation]});
    assert.equal(response.status,400);assert.equal((await f.read()).raw,saved.raw);
  }
  const html=await(await fetch(f.base+'/desktop.html',{headers:f.headers})).text();assert.match(html,/initialRaw/);assert.match(html,/initialRevision/);
  const publicHtml=await(await fetch(f.base+'/')).text();assert.doesNotMatch(publicHtml,/"initialRaw"/);
});
test('un registro histórico inválido se conserva sin permitir nuevas alteraciones inválidas',async t=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mibolsillo-legacy-validation-')),dbPath=path.join(folder,'qa.sqlite');
  let store=openStore(dbPath);const old=JSON.stringify({revision:'old',data:{movimientos:[{id:'legacy',tipo:'GASTO',valor:-1,fecha:'bad'}]}});store.compareAndSet(null,old);store.close();
  const server=createServer({requireAuth:false,dbPath});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>{server.close(r);server.closeAllConnections();});fs.rmSync(folder,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`,config=await(await fetch(base+'/api/config')).json(),headers={'Content-Type':'application/json','X-MiBolsillo-Token':config.token};
  const next=JSON.parse(old);next.data.saldoInicial=20;
  assert.equal((await fetch(base+'/api/storage',{method:'POST',headers,body:JSON.stringify({expectedRaw:old,raw:JSON.stringify(next)})})).status,200);
  const saved=await(await fetch(base+'/api/storage')).json();next.data.movimientos[0].valor=-2;
  assert.equal((await fetch(base+'/api/storage',{method:'POST',headers,body:JSON.stringify({expectedRaw:saved.raw,raw:JSON.stringify(next)})})).status,400);
  assert.equal((await(await fetch(base+'/api/storage')).json()).raw,saved.raw);
});
