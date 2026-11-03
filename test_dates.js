const fs = require('fs');
const vm = require('vm');
const window = {};
const context = { window, Date, Number, String, Object, Array, RegExp, Math };
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname + '/src/utils/dates.js', 'utf8'), context);
const historial = window.obtenerHistorialMensualReal([
  { fecha: '2026-01-05', tipo: 'INGRESO', valor: 100000 },
  { fecha: '2026-01-20', tipo: 'GASTO', valor: 25000 },
  { fecha: '2026-02-01', tipo: 'INGRESO', valor: 50000 },
  { fecha: 'fecha-invalida', tipo: 'GASTO', valor: 9000 },
  { fecha: '2026-02-12', tipo: 'GASTO', valor: -10 },
  { fecha: '2026-02-13', tipo: 'GASTO', valor: 'no-numero' }
]);
if (JSON.stringify(historial.labels) !== JSON.stringify(['Ene 2026', 'Feb 2026'])) throw new Error('Etiquetas mensuales incorrectas');
if (JSON.stringify(historial.ingresos) !== JSON.stringify([100000, 50000])) throw new Error('Totales de ingresos incorrectos');
if (JSON.stringify(historial.gastos) !== JSON.stringify([25000, 0])) throw new Error('Totales de gastos incorrectos');
if (!historial.tieneDatos) throw new Error('No detectó datos');
const vacio = window.obtenerHistorialMensualReal([]);
if (vacio.tieneDatos || vacio.labels.length) throw new Error('El caso vacío no es correcto');
console.log('OK: historial mensual real');
