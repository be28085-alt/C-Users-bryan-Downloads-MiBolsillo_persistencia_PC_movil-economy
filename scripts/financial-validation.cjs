'use strict';
// Valida candidatos en el servidor; no normaliza ni reescribe datos financieros.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const MAX_STATE_DEPTH = 45;
const MAX_AMOUNT = 1e14;
const MAX_REQUIRED_TEXT_LENGTH = 10000;
const MAX_TEXT_LENGTH = 20000;
const MAX_RECORD_ID_LENGTH = 200;
const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400, code: 'validation' });
};
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const collections = [
  'movimientos',
  'cuentas',
  'metas',
  'deudas',
  'aportesMetas',
  'abonosDeudas',
  'negocios',
  'productos',
  'clientes',
  'proveedores',
  'ventas',
  'compras',
  'ingresosNegocio',
  'gastosNegocio',
  'gastos',
  'empleados',
  'pagosEmpleado',
  'pagosVenta',
  'pagosCompra',
  'pagosGasto',
  'movimientosInventario',
  'formulas',
  'producciones',
  'devolucionesNegocio',
];
const rootFields = new Set([
  ...collections,
  'usuario',
  'saldoOculto',
  'saldoInicial',
  'capitalBase',
  'presupuestoMensual',
  'limitesCategorias',
  'periodoAnio',
  'periodoMes',
  'moduloActivo',
  'negocioActivoId',
  'version',
  'presupuestosVersion',
  'presupuestosPorPeriodo',
  'recordatoriosDeudasVistos',
  'businessSchemaVersion',
  'businessLedger',
  'facturacion',
]);
const businessCollections = new Set(collections.slice(collections.indexOf('productos')));
const moneyFields = new Set([
  'valor',
  'monto',
  'saldoInicial',
  'presupuestoMensual',
  'limite',
  'saldo',
  'saldoPendiente',
  'montoInicial',
  'valorInicial',
  'montoObjetivo',
  'objetivo',
  'montoActual',
  'ahorrado',
  'cuotaMensual',
  'total',
  'subtotal',
  'montoPagado',
  'costoTotalVenta',
  'costoTotal',
  'costoUnitario',
  'precioVenta',
  'precioCompra',
  'precioUnitario',
  'stock',
  'stockMinimo',
  'stockAnterior',
  'stockPosterior',
  'cantidad',
  'cantidadBase',
  'cantidadRequerida',
  'cantidadProducida',
  'salario',
  'impuestos',
  'impuesto',
  'amount',
  'unitPrice',
  'unitCost',
  'quantity',
  'gross',
  'discount',
  'base',
  'tax',
  'cost',
  'invoicePaid',
  'taxRate',
  'discountPercent',
]);
const dateFields = new Set([
  'fecha',
  'fechaLimite',
  'fechaVencimiento',
  'fechaIngreso',
  'proximoPago',
  'date',
  'dueDate',
  'from',
  'to',
]);
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
/**
 * @param {unknown} value Fecha candidata del contrato AAAA-MM-DD.
 * @returns {boolean} Si representa un día real, sin conversiones de zona horaria.
 */
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const daysInMonth = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1];
}
/**
 * @param {number|string} value Importe numérico o decimal de la API, no texto localizado.
 * @param {string} label Ruta lógica del campo usada en el error de validación.
 * @param {boolean} positive Exige mayor que cero cuando la regla lo requiere.
 * @returns {void}
 * @throws {Error} HTTP 400 si el tipo, signo, finitud o límite no son admisibles.
 * Comprueba la regla existente; no redondea ni convierte el importe guardado.
 */
function amount(value, label, positive = false) {
  if (
    !['number', 'string'].includes(typeof value) ||
    (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value)) ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0 ||
    (positive && Number(value) <= 0) ||
    Number(value) > MAX_AMOUNT
  ) {
    fail(
      `Importe inválido en ${label}: debe ser ${positive ? 'positivo' : 'no negativo'} y finito.`,
    );
  }
}
function required(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_REQUIRED_TEXT_LENGTH) {
    fail(`Falta un texto válido en ${label}.`);
  }
}
function inspect(value, label, key = '', depth = 0) {
  if (depth > MAX_STATE_DEPTH) fail('Los datos superan la profundidad permitida.');
  if (typeof value === 'number' && !Number.isFinite(value)) fail(`Número no finito en ${label}.`);
  if (moneyFields.has(key) && value !== undefined) amount(value, label);
  if (typeof value === 'string' && value.length > MAX_TEXT_LENGTH) {
    fail('El texto supera la longitud permitida.');
  }
  if (
    ['archivada', 'saldada', 'pagada', 'fiscalValidity', 'signed'].includes(key) &&
    typeof value !== 'boolean'
  ) {
    fail('Indicador de estado inválido.');
  }
  if (
    dateFields.has(key) &&
    value !== undefined &&
    value !== null &&
    value !== '' &&
    !date(value)
  ) {
    fail(`Fecha inválida en ${label}; use una fecha real AAAA-MM-DD.`);
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (forbidden.has(k)) fail('Campo no permitido.');
      // Los snapshots históricos no se normalizan ni se reescriben al validarlos.
      if (
        ['legacyPrecisionOriginal', 'previous', 'formulaSnapshot', 'empleadoSnapshot'].includes(k)
      ) {
        continue;
      }
      inspect(v, `${label}.${k}`, k, depth + 1);
    }
  }
}
let schemas;
/** Reutiliza los esquemas compartidos en una VM sin cargar presentación ni almacenamiento. */
function sharedSchemas() {
  if (schemas) return schemas;
  const context = vm.createContext({ console });
  context.window = context;
  for (const file of [
    'src/utils/dates.js',
    'src/invoicing/money.js',
    'src/domains/business/reportPreferences.js',
    'src/domains/business/businessSchema.js',
    'src/invoicing/schema.js',
  ]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
  schemas = context;
  return schemas;
}
/**
 * @param {object} next Candidato completo todavía no confirmado por el repositorio.
 * @param {object|null} previous Estado previo para reconocer registros históricos intactos.
 * @param {{strict?:boolean}} options strict valida también esos registros, como al restaurar.
 * @returns {true} Candidato válido bajo las reglas financieras y de estructura actuales.
 * @throws {Error} HTTP 400 cuando falla un contrato; no escribe ni corrige el candidato.
 * La autorización de propietario y permisos sigue siendo una comprobación adicional.
 */
function validateFinancialState(next, previous = null, { strict = false } = {}) {
  if (!object(next)) fail('El estado financiero debe ser un objeto.');
  for (const key of Object.keys(next)) {
    if (!rootFields.has(key) && JSON.stringify(next[key]) !== JSON.stringify(previous?.[key])) {
      fail('El estado contiene un campo no permitido.');
    }
  }
  if (next.moduloActivo !== undefined && !['PERSONAL', 'EMPRESARIAL'].includes(next.moduloActivo)) {
    fail('Módulo inválido.');
  }
  if (next.saldoOculto !== undefined && typeof next.saldoOculto !== 'boolean') {
    fail('Preferencia inválida.');
  }
  (function rejectUnsafe(value, depth = 0) {
    if (depth > MAX_STATE_DEPTH) fail('Los datos superan la profundidad permitida.');
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (forbidden.has(key)) fail('Campo no permitido.');
        rejectUnsafe(child, depth + 1);
      }
    }
  })(next);
  for (const k of Object.keys(next)) if (forbidden.has(k)) fail('Campo no permitido.');
  if (next.usuario !== undefined && !object(next.usuario)) fail('Usuario inválido.');
  if (
    next.usuario &&
    (strict || JSON.stringify(next.usuario) !== JSON.stringify(previous?.usuario))
  ) {
    for (const key of [
      'alertasPresupuesto',
      'recordatoriosDeudas',
      'notificacionesEmail',
      'temaOscuro',
    ]) {
      if (next.usuario[key] !== undefined && typeof next.usuario[key] !== 'boolean') {
        fail('Preferencia del perfil inválida.');
      }
    }
    if (
      next.usuario.moneda !== undefined &&
      (typeof next.usuario.moneda !== 'string' || !/^[A-Z]{3}$/.test(next.usuario.moneda))
    ) {
      fail('Código de moneda inválido.');
    }
    required(next.usuario.nombre, 'usuario.nombre');
    required(next.usuario.email, 'usuario.email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.usuario.email)) {
      fail('Correo electrónico inválido.');
    }
  }
  for (const field of ['saldoInicial', 'presupuestoMensual']) {
    if (next[field] !== undefined && (strict || next[field] !== previous?.[field])) {
      amount(next[field], field);
    }
  }
  for (const field of ['limitesCategorias', 'presupuestosPorPeriodo']) {
    if (next[field] !== undefined) {
      if (!object(next[field])) fail(`${field} debe ser un objeto.`);
      if (field === 'limitesCategorias') {
        for (const [k, v] of Object.entries(next[field])) amount(v, `${field}.${k}`);
      } else {
        for (const [period, budget] of Object.entries(next[field])) {
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || !object(budget)) {
            fail('Período de presupuesto inválido.');
          }
          amount(budget.limite, `presupuesto ${period}`);
          if (!object(budget.limitesCategorias)) fail('Límites de categoría inválidos.');
          for (const [k, v] of Object.entries(budget.limitesCategorias)) {
            amount(v, `presupuesto ${period}.${k}`);
          }
        }
      }
    }
  }
  if (
    next.periodoMes !== undefined &&
    (!Number.isInteger(next.periodoMes) || next.periodoMes < 0 || next.periodoMes > 11)
  ) {
    fail('Mes inválido.');
  }
  if (
    next.periodoAnio !== undefined &&
    (!Number.isInteger(next.periodoAnio) || next.periodoAnio < 1 || next.periodoAnio > 9999)
  ) {
    fail('Año inválido.');
  }
  const maps = {};
  for (const key of collections) {
    if (previous?.[key] !== undefined && next[key] === undefined) {
      fail(`Falta la colección ${key}.`);
    }
    if (next[key] === undefined) {
      maps[key] = new Map();
      continue;
    }
    if (!Array.isArray(next[key])) fail(`La colección ${key} debe ser una lista.`);
    const ids = new Map();
    maps[key] = ids;
    for (const record of next[key]) {
      if (
        !object(record) ||
        typeof record.id !== 'string' ||
        !record.id ||
        record.id.length > MAX_RECORD_ID_LENGTH ||
        ids.has(record.id)
      ) {
        fail(`Identificador inválido o repetido en ${key}.`);
      }
      ids.set(record.id, record);
    }
  }
  // Indexar el historial evita búsquedas cuadráticas por cada registro guardado.
  const previousMaps = Object.fromEntries(
    collections.map((key) => [
      key,
      new Map(
        (Array.isArray(previous?.[key]) ? previous[key] : []).map((record) => [
          record.id,
          JSON.stringify(record),
        ]),
      ),
    ]),
  );
  const isUnchanged = (key, record) =>
    !strict && previousMaps[key].get(record.id) === JSON.stringify(record);
  const validateReference = (record, field, target, label, requiredRef = false) => {
    if (!record[field] && !requiredRef) return;
    if (typeof record[field] !== 'string' || !maps[target]?.has(record[field])) {
      fail(`Referencia inexistente en ${label}.${field}.`);
    }
    const linked = maps[target].get(record[field]);
    if (record.negocioId && linked.negocioId && record.negocioId !== linked.negocioId) {
      fail(`La referencia ${field} pertenece a otro negocio.`);
    }
  };
  for (const key of collections) {
    for (const record of next[key] || []) {
      const unchanged = isUnchanged(key, record);
      // Conservar las referencias también al retener un registro impide dejarlo
      // huérfano si otra parte del mismo candidato elimina su destino.
      if (businessCollections.has(key) && record.negocioId) {
        validateReference(record, 'negocioId', 'negocios', key, true);
      }
      for (const [field, target] of Object.entries({
        clienteId: 'clientes',
        proveedorId: 'proveedores',
        productoId: 'productos',
        empleadoId: 'empleados',
        ventaId: 'ventas',
        compraId: 'compras',
        gastoId: 'gastosNegocio',
        formulaId: 'formulas',
        metaId: 'metas',
        deudaId: 'deudas',
        movimientoId: 'movimientos',
        abonoDeudaId: 'abonosDeudas',
        cuentaId: 'cuentas',
      })) {
        if (!unchanged || (record[field] && previousMaps[target]?.has(record[field]))) {
          validateReference(record, field, target, key);
        }
      }
      if (key === 'abonosDeudas' && record.movimientoId) {
        const movement = maps.movimientos.get(record.movimientoId);
        if (
          !movement ||
          movement.tipo !== 'GASTO' ||
          Number(movement.valor) !== Number(record.monto ?? record.valor) ||
          movement.deudaId !== record.deudaId ||
          movement.abonoDeudaId !== record.id
        ) {
          fail('El abono y su egreso no concilian.');
        }
      }
      if (unchanged) continue;
      const crossRefs =
        businessCollections.has(key) || key === 'negocios'
          ? ['metaId', 'deudaId', 'abonoDeudaId']
          : [
              'negocioId',
              'clienteId',
              'proveedorId',
              'productoId',
              'empleadoId',
              'ventaId',
              'compraId',
              'gastoId',
              'formulaId',
            ];
      if (crossRefs.some((field) => record[field] !== undefined)) {
        fail('La referencia cruza módulos no autorizados.');
      }
      inspect(record, key);
      const requiredRefs = {
        aportesMetas: ['metaId', 'metas'],
        abonosDeudas: ['deudaId', 'deudas'],
        pagosVenta: ['ventaId', 'ventas'],
        pagosCompra: ['compraId', 'compras'],
        pagosGasto: ['gastoId', 'gastosNegocio'],
        pagosEmpleado: ['empleadoId', 'empleados'],
        movimientosInventario: ['productoId', 'productos'],
        formulas: ['productoId', 'productos'],
        producciones: ['formulaId', 'formulas'],
      };
      if (requiredRefs[key]) validateReference(record, ...requiredRefs[key], key, true);
      if (key === 'movimientos') {
        if (!['INGRESO', 'GASTO'].includes(record.tipo)) fail('Tipo de movimiento inválido.');
        amount(record.valor, 'movimientos.valor', true);
        required(record.concepto, 'movimientos.concepto');
        if (!date(record.fecha)) fail('Fecha de movimiento inválida.');
      }
      if (
        key === 'negocios' ||
        ['productos', 'clientes', 'proveedores', 'empleados', 'cuentas'].includes(key)
      ) {
        required(record.nombre, `${key}.nombre`);
      }
      if (key === 'metas') {
        required(record.nombre, 'metas.nombre');
        amount(record.montoObjetivo ?? record.objetivo, 'metas.objetivo', true);
        amount(record.montoActual ?? record.ahorrado ?? 0, 'metas.ahorrado');
      }
      if (key === 'deudas') {
        required(record.nombre || record.concepto, 'deudas.nombre');
        amount(record.montoInicial ?? record.valorInicial, 'deudas.montoInicial', true);
        amount(record.saldoPendiente, 'deudas.saldoPendiente');
        if (Number(record.saldoPendiente) > Number(record.montoInicial ?? record.valorInicial)) {
          fail('La deuda pendiente supera el importe inicial.');
        }
      }
      if (
        [
          'aportesMetas',
          'abonosDeudas',
          'pagosVenta',
          'pagosCompra',
          'pagosGasto',
          'pagosEmpleado',
          'gastosNegocio',
          'ingresosNegocio',
          'ventas',
          'compras',
          'producciones',
          'movimientosInventario',
        ].includes(key)
      ) {
        if (!date(record.fecha)) fail(`Fecha requerida o inválida en ${key}.`);
        if (
          [
            'aportesMetas',
            'abonosDeudas',
            'pagosVenta',
            'pagosCompra',
            'pagosGasto',
            'pagosEmpleado',
            'gastosNegocio',
            'ingresosNegocio',
          ].includes(key)
        ) {
          amount(record.monto ?? record.valor, `${key}.monto`, true);
        }
      }
      if (businessCollections.has(key)) {
        validateReference(record, 'negocioId', 'negocios', key, true);
      }
      for (const line of record.detalles || []) {
        validateReference(
          { ...line, negocioId: record.negocioId },
          'productoId',
          'productos',
          `${key}.detalles`,
          record.businessVersion === 1,
        );
      }
      for (const line of record.ingredientes || []) {
        validateReference(
          { ...line, negocioId: record.negocioId },
          'materiaPrimaId',
          'productos',
          `${key}.ingredientes`,
          true,
        );
      }
    }
  }
  if (next.negocioActivoId && !maps.negocios.has(next.negocioActivoId)) {
    fail('El negocio activo no existe.');
  }
  const shared = sharedSchemas();
  for (const validate of [shared.BusinessSchema.validate, shared.InvoiceSchema.validateState]) {
    try {
      validate(next);
    } catch (error) {
      // Una incompatibilidad histórica idéntica puede permanecer en el sobre;
      // los campos nuevos y un error de esquema distinto siguen validándose.
      let preexisting = false;
      if (!strict && previous) {
        try {
          validate(previous);
        } catch (old) {
          preexisting = old.message === error.message;
        }
      }
      if (!preexisting) fail(error.message);
    }
  }
  return true;
}
module.exports = { validateFinancialState, date, amount };
