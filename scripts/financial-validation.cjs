'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const fail = message => { throw Object.assign(new Error(message), { status: 400, code: 'validation' }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const collections = ['movimientos','cuentas','metas','deudas','aportesMetas','abonosDeudas','negocios','productos','clientes','proveedores','ventas','compras','ingresosNegocio','gastosNegocio','gastos','empleados','pagosEmpleado','pagosVenta','pagosCompra','pagosGasto','movimientosInventario','formulas','producciones','devolucionesNegocio'];
const rootFields = new Set([...collections,'usuario','saldoOculto','saldoInicial','capitalBase','presupuestoMensual','limitesCategorias','periodoAnio','periodoMes','moduloActivo','negocioActivoId','version','presupuestosVersion','presupuestosPorPeriodo','recordatoriosDeudasVistos','businessSchemaVersion','businessLedger','facturacion']);
const businessCollections = new Set(collections.slice(collections.indexOf('productos')));
const moneyFields = new Set(['valor','monto','saldoInicial','presupuestoMensual','limite','saldo','saldoPendiente','montoInicial','valorInicial','montoObjetivo','objetivo','montoActual','ahorrado','cuotaMensual','total','subtotal','montoPagado','costoTotalVenta','costoTotal','costoUnitario','precioVenta','precioCompra','precioUnitario','stock','stockMinimo','stockAnterior','stockPosterior','cantidad','cantidadBase','cantidadRequerida','cantidadProducida','salario','impuestos','impuesto','amount','unitPrice','unitCost','quantity','gross','discount','base','tax','cost','invoicePaid','taxRate','discountPercent']);
const dateFields = new Set(['fecha','fechaLimite','fechaVencimiento','fechaIngreso','proximoPago','date','dueDate','from','to']);
const forbidden = new Set(['__proto__','prototype','constructor']);
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d] = value.split('-').map(Number);
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const days = [31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  return d <= days[m-1];
}
function amount(value, label, positive = false) {
  if (!['number','string'].includes(typeof value) || (typeof value==='string' && !/^\d+(?:\.\d+)?$/.test(value)) || !Number.isFinite(Number(value)) || Number(value)<0 || (positive && Number(value)<=0) || Number(value)>1e14) fail(`Importe inválido en ${label}: debe ser ${positive?'positivo':'no negativo'} y finito.`);
}
function required(value, label) { if (typeof value !== 'string' || !value.trim() || value.length>10000) fail(`Falta un texto válido en ${label}.`); }
function inspect(value, label, key = '', depth = 0) {
  if (depth > 45) fail('Los datos superan la profundidad permitida.');
  if (typeof value === 'number' && !Number.isFinite(value)) fail(`Número no finito en ${label}.`);
  if (moneyFields.has(key) && value !== undefined) amount(value,label);
  if (typeof value === 'string' && value.length > 20000) fail('El texto supera la longitud permitida.');
  if (['archivada','saldada','pagada','fiscalValidity','signed'].includes(key) && typeof value !== 'boolean') fail('Indicador de estado inválido.');
  if (dateFields.has(key) && value !== undefined && value !== null && value !== '' && !date(value)) fail(`Fecha inválida en ${label}; use una fecha real AAAA-MM-DD.`);
  if (value && typeof value === 'object') for (const [k,v] of Object.entries(value)) {
    if (forbidden.has(k)) fail('Campo no permitido.');
    // Historical snapshots are not rewritten or normalized by validation.
    if (['legacyPrecisionOriginal','previous','formulaSnapshot','empleadoSnapshot'].includes(k)) continue;
    inspect(v,`${label}.${k}`,k,depth+1);
  }
}
let schemas;
function sharedSchemas() {
  if (schemas) return schemas;
  const context = vm.createContext({ console }); context.window=context;
  for (const file of ['src/utils/dates.js','src/invoicing/money.js','src/domains/business/reportPreferences.js','src/domains/business/businessSchema.js','src/invoicing/schema.js']) vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
  schemas=context; return schemas;
}
function validateFinancialState(next, previous = null, { strict = false } = {}) {
  if (!object(next)) fail('El estado financiero debe ser un objeto.');
  for (const key of Object.keys(next)) if (!rootFields.has(key) && JSON.stringify(next[key]) !== JSON.stringify(previous?.[key])) fail('El estado contiene un campo no permitido.');
  if (next.moduloActivo !== undefined && !['PERSONAL','EMPRESARIAL'].includes(next.moduloActivo)) fail('Módulo inválido.');
  if (next.saldoOculto !== undefined && typeof next.saldoOculto !== 'boolean') fail('Preferencia inválida.');
  (function rejectUnsafe(value,depth=0){
    if(depth>45)fail('Los datos superan la profundidad permitida.');
    if(value&&typeof value==='object')for(const [key,child]of Object.entries(value)){
      if(forbidden.has(key))fail('Campo no permitido.');rejectUnsafe(child,depth+1);
    }
  })(next);
  for(const k of Object.keys(next)) if(forbidden.has(k)) fail('Campo no permitido.');
  if(next.usuario!==undefined && !object(next.usuario)) fail('Usuario inválido.');
  if(next.usuario && (strict || JSON.stringify(next.usuario)!==JSON.stringify(previous?.usuario))) {
    for (const key of ['alertasPresupuesto','recordatoriosDeudas','notificacionesEmail','temaOscuro']) if (next.usuario[key] !== undefined && typeof next.usuario[key] !== 'boolean') fail('Preferencia del perfil inválida.');
    if (next.usuario.moneda !== undefined && (typeof next.usuario.moneda !== 'string' || !/^[A-Z]{3}$/.test(next.usuario.moneda))) fail('Código de moneda inválido.');
    required(next.usuario.nombre,'usuario.nombre'); required(next.usuario.email,'usuario.email');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.usuario.email)) fail('Correo electrónico inválido.');
  }
  for(const field of ['saldoInicial','presupuestoMensual']) if(next[field]!==undefined && (strict||next[field]!==previous?.[field])) amount(next[field],field);
  for(const field of ['limitesCategorias','presupuestosPorPeriodo']) if(next[field]!==undefined) {
    if(!object(next[field])) fail(`${field} debe ser un objeto.`);
    if(field==='limitesCategorias') for(const [k,v] of Object.entries(next[field])) amount(v,`${field}.${k}`);
    else for(const [period,budget] of Object.entries(next[field])) {
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||!object(budget)) fail('Período de presupuesto inválido.');
      amount(budget.limite,`presupuesto ${period}`);
      if(!object(budget.limitesCategorias)) fail('Límites de categoría inválidos.');
      for(const [k,v] of Object.entries(budget.limitesCategorias)) amount(v,`presupuesto ${period}.${k}`);
    }
  }
  if(next.periodoMes!==undefined && (!Number.isInteger(next.periodoMes)||next.periodoMes<0||next.periodoMes>11)) fail('Mes inválido.');
  if(next.periodoAnio!==undefined && (!Number.isInteger(next.periodoAnio)||next.periodoAnio<1||next.periodoAnio>9999)) fail('Año inválido.');
  const maps={};
  for(const key of collections) {
    if(previous?.[key]!==undefined&&next[key]===undefined)fail(`Falta la colección ${key}.`);
    if(next[key]===undefined) { maps[key]=new Map(); continue; }
    if(!Array.isArray(next[key])) fail(`La colección ${key} debe ser una lista.`);
    const ids=new Map();maps[key]=ids;
    for(const r of next[key]) {
      if(!object(r)||typeof r.id!=='string'||!r.id||r.id.length>200||ids.has(r.id)) fail(`Identificador inválido o repetido en ${key}.`);
      ids.set(r.id,r);
    }
  }
  // Indexar el historial evita búsquedas cuadráticas por cada registro guardado.
  const previousMaps = Object.fromEntries(collections.map(key => [key, new Map((Array.isArray(previous?.[key]) ? previous[key] : []).map(record => [record.id, JSON.stringify(record)]))]));
  const same=(key,r)=>!strict && previousMaps[key].get(r.id) === JSON.stringify(r);
  const ref=(r,field,target,label,requiredRef=false)=>{
    if(!r[field]&&!requiredRef)return;
    if(typeof r[field]!=='string'||!maps[target]?.has(r[field]))fail(`Referencia inexistente en ${label}.${field}.`);
    const linked=maps[target].get(r[field]);
    if(r.negocioId && linked.negocioId && r.negocioId!==linked.negocioId)fail(`La referencia ${field} pertenece a otro negocio.`);
  };
  for(const key of collections) for(const r of next[key]||[]) {
    const unchanged=same(key,r);
    // Always check references for retained records, so deletes cannot orphan data.
    if(businessCollections.has(key) && r.negocioId) ref(r,'negocioId','negocios',key,true);
    for(const [field,target] of Object.entries({clienteId:'clientes',proveedorId:'proveedores',productoId:'productos',empleadoId:'empleados',ventaId:'ventas',compraId:'compras',gastoId:'gastosNegocio',formulaId:'formulas',metaId:'metas',deudaId:'deudas',movimientoId:'movimientos',abonoDeudaId:'abonosDeudas',cuentaId:'cuentas'})) {
      if(!unchanged || r[field] && previousMaps[target]?.has(r[field])) ref(r,field,target,key);
    }
    if(key==='abonosDeudas'&&r.movimientoId) {
      const movement=maps.movimientos.get(r.movimientoId);
      if(!movement||movement.tipo!=='GASTO'||Number(movement.valor)!==Number(r.monto??r.valor)||movement.deudaId!==r.deudaId||movement.abonoDeudaId!==r.id)fail('El abono y su egreso no concilian.');
    }
    if(unchanged)continue;
    const crossRefs = businessCollections.has(key) || key === 'negocios' ? ['metaId','deudaId','abonoDeudaId']
      : ['negocioId','clienteId','proveedorId','productoId','empleadoId','ventaId','compraId','gastoId','formulaId'];
    if (crossRefs.some(field => r[field] !== undefined)) fail('La referencia cruza módulos no autorizados.');
    inspect(r,key);
    const requiredRefs={aportesMetas:['metaId','metas'],abonosDeudas:['deudaId','deudas'],pagosVenta:['ventaId','ventas'],pagosCompra:['compraId','compras'],pagosGasto:['gastoId','gastosNegocio'],pagosEmpleado:['empleadoId','empleados'],movimientosInventario:['productoId','productos'],formulas:['productoId','productos'],producciones:['formulaId','formulas']};
    if(requiredRefs[key])ref(r,...requiredRefs[key],key,true);
    if(key==='movimientos') {
      if(!['INGRESO','GASTO'].includes(r.tipo))fail('Tipo de movimiento inválido.');
      amount(r.valor,'movimientos.valor',true);required(r.concepto,'movimientos.concepto');
      if(!date(r.fecha))fail('Fecha de movimiento inválida.');
    }
    if(key==='negocios'||['productos','clientes','proveedores','empleados','cuentas'].includes(key)) required(r.nombre,`${key}.nombre`);
    if(key==='metas') { required(r.nombre,'metas.nombre');amount(r.montoObjetivo??r.objetivo,'metas.objetivo',true);amount(r.montoActual??r.ahorrado??0,'metas.ahorrado'); }
    if(key==='deudas') { required(r.nombre||r.concepto,'deudas.nombre');amount(r.montoInicial??r.valorInicial,'deudas.montoInicial',true);amount(r.saldoPendiente,'deudas.saldoPendiente'); if(Number(r.saldoPendiente)>Number(r.montoInicial??r.valorInicial))fail('La deuda pendiente supera el importe inicial.'); }
    if(['aportesMetas','abonosDeudas','pagosVenta','pagosCompra','pagosGasto','pagosEmpleado','gastosNegocio','ingresosNegocio','ventas','compras','producciones','movimientosInventario'].includes(key)) {
      if(!date(r.fecha))fail(`Fecha requerida o inválida en ${key}.`);
      if(['aportesMetas','abonosDeudas','pagosVenta','pagosCompra','pagosGasto','pagosEmpleado','gastosNegocio','ingresosNegocio'].includes(key)) amount(r.monto??r.valor,`${key}.monto`,true);
    }
    if(businessCollections.has(key)) ref(r,'negocioId','negocios',key,true);
    for(const line of r.detalles||[]) { ref({...line,negocioId:r.negocioId},'productoId','productos',`${key}.detalles`,r.businessVersion===1); }
    for(const line of r.ingredientes||[]) ref({...line,negocioId:r.negocioId},'materiaPrimaId','productos',`${key}.ingredientes`,true);
  }
  if(next.negocioActivoId && !maps.negocios.has(next.negocioActivoId))fail('El negocio activo no existe.');
  const shared=sharedSchemas();
  for(const validate of [shared.BusinessSchema.validate,shared.InvoiceSchema.validateState]) try { validate(next); }
  catch(error) {
    // Keep previously stored legacy records readable without weakening the
    // validation of newly supplied fields or accepting a new schema failure.
    let preexisting=false;
    if(!strict&&previous)try{validate(previous);}catch(old){preexisting=old.message===error.message;}
    if(!preexisting)fail(error.message);
  }
  return true;
}
module.exports={validateFinancialState,date,amount};
