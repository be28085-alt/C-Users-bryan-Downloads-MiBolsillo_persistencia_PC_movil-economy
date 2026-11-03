const fs = require('fs');
const vm = require('vm');
const store = new Map();
const window = {
  localStorage: { getItem:k=>store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,v), removeItem:k=>store.delete(k) },
  sessionStorage: { getItem:k=>store.has('s:'+k)?store.get('s:'+k):null, setItem:(k,v)=>store.set('s:'+k,v), removeItem:k=>store.delete('s:'+k) },
  addEventListener:()=>{}
};
const document = { createElement:()=>({set textContent(v){this._v=v},get innerHTML(){return this._v}}) };
const code = fs.readFileSync(__dirname + '/shared.js','utf8') + `
(() => {
  const m = Finanzas.agregarMovimiento({tipo:'INGRESO', concepto:'Prueba', categoria:'Salario', valor:100000, fecha:obtenerFechaHoyISO()});
  if (m.error) throw new Error(m.error);
  if (Finanzas.calcTotalIngresos() < 100000) throw new Error('No calcula ingresos');
  const meta = Finanzas.agregarMeta({nombre:'Meta test', objetivo:50000, ahorrado:10000});
  if (meta.error) throw new Error(meta.error);
  if (!Finanzas.state.aportesMetas.some(a=>a.metaId===meta.id && a.valor===10000)) throw new Error('No registra aporte inicial');
  Finanzas.eliminarMeta(meta.id);
  if (Finanzas.state.aportesMetas.some(a=>a.metaId===meta.id)) throw new Error('Quedaron aportes huérfanos');
  const deuda = Finanzas.agregarDeuda({nombre:'Deuda test', valorInicial:50000});
  Finanzas.abonarDeuda(deuda.id, 10000);
  Finanzas.eliminarDeuda(deuda.id);
  if (Finanzas.state.abonosDeudas.some(a=>a.deudaId===deuda.id)) throw new Error('Quedaron abonos huérfanos');
  if (!Finanzas.lastPersistence.local) throw new Error('No confirmó localStorage');
  const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  if (!saved || !saved.data || !saved.data.movimientos.some(x=>x.id===m.id)) throw new Error('No persistió el movimiento');
  return 'OK';
})();`;
const context = {window, document, console, Date, Math, JSON, Number, String, Object, Array, Boolean, RegExp, isFinite, setTimeout, clearTimeout};
vm.createContext(context);
const result = vm.runInContext(code, context);
console.log(result);
