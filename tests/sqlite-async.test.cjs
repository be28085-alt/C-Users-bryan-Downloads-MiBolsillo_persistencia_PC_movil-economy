'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {applyOperations,revisionOf}=require('../scripts/storage-patch.cjs');
const source=fs.readFileSync(path.join(__dirname,'../src/storage/sqliteBackend.js'),'utf8');
function transport(handler){
 const initial=JSON.stringify({version:'FINANZAS_V2',revision:'r1',data:{movimientos:Array.from({length:1000},(_,i)=>({id:String(i),valor:10,concepto:'Registro existente '+i}))}});
 const config={token:'test',user:{id:1},initialRaw:initial,initialRevision:'r1'};
 const context=vm.createContext({AbortSignal,fetch:handler,CustomEvent:class {},dispatchEvent(){},MiBolsilloSQLiteConfig:config});context.window=context;
 vm.runInContext(source,context);return{backend:context.MiBolsilloSQLiteBackend,initial};
}
test('SQLite async: envía solo cambios y mantiene caché anterior hasta confirmar el COMMIT',async()=>{
 let release,request,serverRaw;
 const{backend,initial}=transport(async(url,options)=>{request=JSON.parse(options.body);await new Promise(r=>release=r);serverRaw=applyOperations(initial,request.operations);return{ok:true,json:async()=>({revision:revisionOf(serverRaw)})};});
 const next=JSON.parse(initial);next.revision='r2';next.data.movimientos.unshift({id:'new',valor:0.01,concepto:'Nuevo'});
 const promise=backend.setItem('state',JSON.stringify(next),initial);
 assert.equal(backend.getItem(),initial);assert.ok(JSON.stringify(request).length<initial.length/10);assert.equal(request.operations.find(o=>o.op==='splice').items.length,1);
 release();await promise;assert.equal(backend.getItem(),JSON.stringify(next));assert.deepEqual(JSON.parse(serverRaw),next);
});
test('SQLite async: reintento ambiguo conserva operationId; 413 y conflicto no publican caché',async()=>{
 let attempts=0,committed;
 const{backend,initial}=transport(async(url,options)=>{const body=JSON.parse(options.body);attempts++;if(attempts===1){committed=applyOperations(initial,body.operations);throw Error('Response lost');}assert.equal(body.operationId,'r2');return{ok:true,json:async()=>({revision:revisionOf(committed),duplicate:true})};});
 const next=JSON.parse(initial);next.revision='r2';await backend.setItem('state',JSON.stringify(next),initial);assert.equal(attempts,2);
 for(const status of [409,413]){
  const t=transport(async()=>({ok:false,status,json:async()=>({error:'Rechazado'})}));
  const n=JSON.parse(t.initial);n.revision='blocked';await assert.rejects(t.backend.setItem('state',JSON.stringify(n),t.initial),/Rechazado/);assert.equal(t.backend.getItem(),t.initial);
 }
});
