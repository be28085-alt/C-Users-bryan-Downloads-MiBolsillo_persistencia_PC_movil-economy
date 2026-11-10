(function () {
  'use strict';
  function calcularCajaYFlujo(negocioId, state = {}) {
    const D = window.BusinessReportsDomain;
    if (!D) return { saldoDisponible: 0, totalEntradas: 0, totalSalidas: 0, flujoNeto: 0, cuentas: [], movimientosCaja: [] };
    const rows = [], safe = v => { try { return D.cents(v ?? '0'); } catch (e) { return 0n; } };
    function add(id, fecha, concepto, type, value, method = 'Sin especificar') { const amount = safe(value); if (amount) rows.push({ id, fecha, cuenta: method, concepto, tipo: type, cents: amount, monto: Number(D.decimal(amount)) }); }
    function linked(parents, payments, field, direction, label) {
      for (const p of payments.filter(p => p.negocioId === negocioId)) add(p.id, p.fecha, label, direction, p.monto, p.metodoPago);
      for (const p of parents.filter(p => p.negocioId === negocioId)) {
        const recorded = payments.filter(x => x.negocioId === negocioId && x[field] === p.id).reduce((s, x) => s + safe(x.monto), 0n);
        const paid = p.montoPagado !== undefined ? safe(p.montoPagado) : p.invoicePaid !== undefined ? safe(p.invoicePaid) : safe(p.total ?? p.monto) - safe(p.saldoPendiente);
        // Only the unrecorded historical opening payment is inferred; partial payments never count twice.
        if (paid > recorded) add(`opening-${p.id}`, p.fecha, `${label} · pago histórico`, direction, D.decimal(paid - recorded), p.metodoPago);
      }
    }
    linked(state.ventas || [], state.pagosVenta || [], 'ventaId', 'ENTRADA', 'Cobro de venta');
    linked(state.compras || [], state.pagosCompra || [], 'compraId', 'SALIDA', 'Pago de compra');
    linked(state.gastosNegocio || [], state.pagosGasto || [], 'gastoId', 'SALIDA', 'Pago de gasto');
    for (const i of (state.ingresosNegocio || []).filter(r => r.negocioId === negocioId)) add(i.id, i.fecha, i.descripcion || 'Ingreso adicional', 'ENTRADA', i.monto, i.metodoPago);
    for (const p of (state.pagosEmpleado || []).filter(r => r.negocioId === negocioId)) add(p.id, p.fecha, `Pago a ${p.empleadoNombre}`, 'SALIDA', p.monto, p.metodoPago);
    for (const r of (state.devolucionesNegocio || []).filter(r => r.negocioId === negocioId)) add(r.id, r.fecha, `Reversión: ${r.motivo}`, r.tipo, r.monto, r.metodoPago);
    for (const r of (state.facturacion?.refunds || []).filter(r => r.businessId === negocioId)) add(r.id, r.date, `Devolución de factura ${r.documentId}`, 'SALIDA', r.amount, r.method);
    let incoming = 0n, outgoing = 0n; const accounts = new Map();
    for (const r of rows) { if (r.tipo === 'ENTRADA') incoming += r.cents; else outgoing += r.cents; accounts.set(r.cuenta, (accounts.get(r.cuenta) || 0n) + (r.tipo === 'ENTRADA' ? r.cents : -r.cents)); }
    const num = n => Number(D.decimal(n));
    return { saldoDisponible: num(incoming - outgoing), totalEntradas: num(incoming), totalSalidas: num(outgoing), flujoNeto: num(incoming - outgoing), cuentas: [...accounts].map(([nombre, value], i) => ({ id: `method-${i}`, nombre, tipo: 'REGISTRO_INTERNO', saldo: num(value), numero: 'Flujo registrado, sin saldo bancario inicial' })), movimientosCaja: rows.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).map(({ cents, ...r }) => r) };
  }
  window.BusinessCashFlowDomain = { calcularCajaYFlujo };
})();
