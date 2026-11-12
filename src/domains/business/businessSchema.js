(function () {
  'use strict';
  const collections = ['negocios', 'productos', 'clientes', 'proveedores', 'ventas', 'compras', 'ingresosNegocio', 'gastosNegocio', 'empleados', 'pagosEmpleado', 'pagosVenta', 'pagosCompra', 'pagosGasto', 'movimientosInventario', 'formulas', 'producciones', 'devolucionesNegocio'];
  function migrate(state) {
    for (const key of collections) if (state[key] === undefined) state[key] = [];
    // Normalize excess legacy precision once, retaining original values for review.
    // BigInt HALF_UP avoids repeating binary floating-point errors from old writers.
    const moneyFields = ['total', 'subtotal', 'monto', 'saldoPendiente', 'montoPagado', 'costoTotalVenta', 'costoTotal'];
    const unitFields = ['stock', 'stockMinimo', 'precioVenta', 'precioCompra', 'costoUnitario', 'cantidad', 'cantidadProducida', 'cantidadBase', 'cantidadRequerida'];
    function normalize(record, field, scale) {
      const value = record[field]; if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
      const raw = String(value), s = /e/i.test(raw) ? value.toFixed(12) : raw;
      const match = /^(\d+)\.(\d+)$/.exec(s); if (!match || match[2].length <= scale) return;
      const denominator = 10n ** BigInt(match[2].length), numerator = BigInt(match[1] + match[2]) * 10n ** BigInt(scale);
      const rounded = (numerator + denominator / 2n) / denominator;
      const digits = rounded.toString().padStart(scale + 1, '0'), normalized = Number(`${digits.slice(0, -scale)}.${digits.slice(-scale)}`);
      if (normalized !== value) { record.legacyPrecisionOriginal ||= {}; record.legacyPrecisionOriginal[field] ??= value; record[field] = normalized; }
    }
    for (const key of collections) if (Array.isArray(state[key])) for (const r of state[key]) {
      if (!r || r.businessVersion === 1) continue;
      moneyFields.forEach(k => normalize(r, k, 2)); unitFields.forEach(k => normalize(r, k, 4));
      for (const l of r.detalles || []) { moneyFields.forEach(k => normalize(l, k, 2)); unitFields.forEach(k => normalize(l, k, 4)); }
      for (const i of r.ingredientes || []) unitFields.forEach(k => normalize(i, k, 4));
    }
    state.businessSchemaVersion = 1;
    if (state.businessLedger === undefined) state.businessLedger = { version: 1, operations: [], audit: [], sequences: {} };
    return state;
  }
  function validate(state) {
    if (state.businessSchemaVersion === undefined) return;
    if (state.businessSchemaVersion !== 1) throw new Error('Versión empresarial no compatible.');
    const idsByCollection = {};
    for (const key of collections) {
      if (!Array.isArray(state[key])) throw new Error(`Colección empresarial inválida: ${key}.`);
      const ids = new Set(); idsByCollection[key] = ids;
      for (const record of state[key]) {
        if (!record || typeof record.id !== 'string' || !record.id || ids.has(record.id)) throw new Error(`Identificador duplicado o inválido en ${key}.`);
        ids.add(record.id);
      }
    }
    for (const b of state.negocios) if (b.reportPreferences !== undefined) window.BusinessReportPreferences.validate(b.reportPreferences);
    for (const key of collections.filter(k => k !== 'negocios')) for (const r of state[key]) {
      // Legacy data stays readable; newly written records use the strict contract.
      if (r.businessVersion !== 1) continue;
      if (!idsByCollection.negocios.has(r.negocioId)) throw new Error(`Negocio inexistente en ${key}.`);
      for (const field of ['stock', 'stockMinimo', 'precioVenta', 'costoUnitario', 'monto', 'total', 'saldoPendiente', 'montoPagado']) if (r[field] !== undefined && (!Number.isFinite(Number(r[field])) || Number(r[field]) < 0)) throw new Error(`Valor inválido: ${key}.${field}.`);
      const refs = { clienteId: 'clientes', proveedorId: 'proveedores', productoId: 'productos', empleadoId: 'empleados', ventaId: 'ventas', compraId: 'compras', gastoId: 'gastosNegocio', formulaId: 'formulas' };
      for (const [field, target] of Object.entries(refs)) if (r[field] && !state[target].some(p => p.id === r[field] && p.negocioId === r.negocioId)) throw new Error(`Referencia inválida: ${key}.${field}.`);
      for (const l of r.detalles || []) if (!state.productos.some(p => p.id === l.productoId && p.negocioId === r.negocioId)) throw new Error('Detalle sin producto del mismo negocio.');
      if (r.estado !== 'ANULADA' && ['ventas', 'compras', 'gastosNegocio'].includes(key)) {
        const M = window.InvoiceMoney;
        if (M.units(r.montoPagado) + M.units(r.saldoPendiente) !== M.units(r.total ?? r.monto)) throw new Error('El pago y el saldo no concilian con el total.');
      }
    }
    const ledger = state.businessLedger;
    if (!ledger || ledger.version !== 1 || !Array.isArray(ledger.operations) || !Array.isArray(ledger.audit)) throw new Error('Bitácora empresarial inválida.');
    if (!ledger.sequences || typeof ledger.sequences !== 'object' || Array.isArray(ledger.sequences) || Object.values(ledger.sequences).some(v => !Number.isSafeInteger(v) || v < 0 || v > 999999999)) throw new Error('Consecutivos empresariales inválidos.');
    const keys = new Set();
    for (const op of ledger.operations) { const key = `${op.businessId}:${op.key}`; if (typeof op.key !== 'string' || !op.key || keys.has(key) || !/^[a-f0-9]{64}$/.test(op.fingerprint) || !collections.includes(op.result?.collection) || typeof op.result?.record?.id !== 'string') throw new Error('Idempotencia empresarial inválida.'); keys.add(key); }
  }
  window.BusinessSchema = { migrate, validate, collections };
})();
