'use strict';
const {createHash}=require('node:crypto');
const fail=message=>{throw Object.assign(new Error(message),{status:400,code:'validation'});};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function revisionOf(raw) { if(raw===null)return null;try{const r=JSON.parse(raw).revision;if(typeof r==='string'&&r)return r;}catch{}return createHash('sha256').update(raw).digest('hex'); }
function applyOperations(raw,operations) {
  if(!Array.isArray(operations)||operations.length>20000)fail('Lista de cambios inválida o demasiado extensa.');
  let next=raw===null?null:JSON.parse(raw);
  for(const operation of operations) {
    if(!operation||!['set','remove','splice'].includes(operation.op)||!Array.isArray(operation.path)||operation.path.length>40)fail('Cambio incremental inválido.');
    const keys=operation.path;
    if(keys.some(k=>!(typeof k==='string'||Number.isSafeInteger(k))||['__proto__','prototype','constructor'].includes(String(k))))fail('Ruta de cambio no permitida.');
    if(!keys.length) {if(operation.op!=='set'||next!==null)fail('No se puede reemplazar la raíz por un cambio incremental.');next=operation.value;continue;}
    let target=next;
    for(const key of keys.slice(0,-1)) {if(!target||typeof target!=='object'||!own(target,key))fail('La ruta del cambio no existe.');target=target[key];}
    if(!target||typeof target!=='object')fail('La ruta del cambio no es un objeto.');
    const key=keys.at(-1);
    if(Array.isArray(target)&&(!/^\d+$/.test(String(key))||Number(key)>=target.length))fail('Índice de cambio inválido.');
    if(operation.op==='set') {if(!own(operation,'value'))fail('Falta el valor del cambio.');target[key]=operation.value;}
    else if(operation.op==='remove') {if(Array.isArray(target))fail('Use splice para eliminar elementos de una lista.');if(!own(target,key))fail('El campo eliminado no existe.');delete target[key];}
    else {
      const array=target[key];const {index,deleteCount,items}=operation;
      if(!Array.isArray(array)||!Number.isSafeInteger(index)||index<0||index>array.length||!Number.isSafeInteger(deleteCount)||deleteCount<0||deleteCount>array.length-index||!Array.isArray(items)||items.length>20000)fail('Modificación de lista inválida.');
      array.splice(index,deleteCount,...items);
    }
  }
  return JSON.stringify(next);
}
module.exports={revisionOf,applyOperations};
