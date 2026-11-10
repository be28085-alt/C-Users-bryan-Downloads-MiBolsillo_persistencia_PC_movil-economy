(function () {
  'use strict';
  function validateState(state) {
    const f = state.facturacion;
    if (f === undefined) return;
    const fail = detail => { throw new Error(`Copia de facturación inválida: ${detail}.`); };
    if (!f || f.version !== 1 || !['documents', 'operations', 'audit', 'refunds'].every(k => Array.isArray(f[k])) || !f.sequences || typeof f.sequences !== 'object') fail('estructura');
    const M = window.InvoiceMoney, docs = new Map(), numbers = new Set(), operations = new Set();
    for (const d of f.documents) {
      if (!d || typeof d.id !== 'string' || !d.id || docs.has(d.id) || !state.negocios.some(n => n.id === d.businessId)) fail('identificador o negocio');
      docs.set(d.id, d);
      if (!['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(d.kind) || !['BORRADOR', 'EN_VALIDACION_SIMULADA', 'VALIDADA_INTERNA', 'RECHAZADA_INTERNA', 'ANULADA'].includes(d.status)) fail('tipo o estado');
      if (!d.customer?.name || !d.customer?.document || !d.supplier?.name || !window.FinanzasDates.esFechaISOValida(d.date) || !window.FinanzasDates.esFechaISOValida(d.dueDate)) fail('datos históricos');
      if (d.compliance?.classification !== 'EXPERIMENTAL' || d.compliance.fiscalValidity !== false || d.compliance.signed !== false || d.compliance.officialCufe !== null || d.compliance.officialCude !== null || d.compliance.authorization !== null) fail('clasificación fiscal');
      const recalculated = M.calculate(d.totals?.lines);
      for (const key of ['gross', 'discount', 'base', 'tax', 'total', 'cost']) if (d.totals[key] !== recalculated[key]) fail(`totales ${key}`);
      for (let i = 0; i < recalculated.lines.length; i++) for (const key of ['gross', 'discount', 'base', 'tax', 'total', 'cost']) if (d.totals.lines[i][key] !== recalculated.lines[i][key]) fail('importes de detalle');
      if (JSON.stringify(d.totals.taxes) !== JSON.stringify(recalculated.taxes)) fail('desglose de impuestos');
      if (d.number) {
        const match = /^SIM-(FV|NC|ND)-(\d{6,})$/.exec(d.number), sequenceKey = `${d.businessId}:${d.kind}`, unique = `${d.businessId}:${d.number}`;
        if (!match || match[1] !== { INVOICE: 'FV', CREDIT_NOTE: 'NC', DEBIT_NOTE: 'ND' }[d.kind] || numbers.has(unique) || !Number.isSafeInteger(f.sequences[sequenceKey]) || f.sequences[sequenceKey] < Number(match[2])) fail('consecutivos');
        numbers.add(unique);
      } else if (d.status !== 'BORRADOR') fail('número faltante');
    }
    for (const d of f.documents) {
      if (d.kind !== 'INVOICE' && (docs.get(d.originalId)?.kind !== 'INVOICE' || docs.get(d.originalId)?.businessId !== d.businessId)) fail('referencia de nota');
      if (d.kind === 'INVOICE' && ['VALIDADA_INTERNA', 'ANULADA'].includes(d.status)) {
        const sales = (state.ventas || []).filter(v => v.invoiceDocumentId === d.id && v.negocioId === d.businessId);
        if (sales.length !== 1 || M.units(sales[0].invoicePaid) + M.units(sales[0].saldoPendiente) !== M.units(sales[0].total)) fail('venta o saldo asociado');
      }
    }
    for (const op of f.operations) {
      const unique = `${op.businessId}:${op.key}`;
      if (!op.key || operations.has(unique) || !/^[a-f0-9]{64}$/.test(op.fingerprint) || !['document', 'payment'].includes(op.resultType)) fail('idempotencia');
      if (op.resultType === 'document' && docs.get(op.resultId)?.businessId !== op.businessId) fail('resultado de operación');
      if (op.resultType === 'payment' && !(state.pagosVenta || []).some(p => p.id === op.resultId && p.negocioId === op.businessId)) fail('pago de operación');
      operations.add(unique);
    }
    for (const a of f.audit) if (!a.id || docs.get(a.documentId)?.businessId !== a.businessId || !a.action || !a.at) fail('auditoría');
    for (const r of f.refunds) if (!r.id || docs.get(r.documentId)?.businessId !== r.businessId || M.units(r.amount) <= 0n) fail('devolución');
  }
  window.InvoiceSchema = { validateState };
})();
