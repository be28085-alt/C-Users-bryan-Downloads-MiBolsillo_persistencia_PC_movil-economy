(function () {
  'use strict';
  function build(core, businessId = core.state.negocioActivoId, period = 'MES_ACTUAL') {
    const state = core.state, report = window.BusinessReportsDomain.build(state, businessId, { period });
    const items = key => (state[key] || []).filter(r => r.negocioId === businessId);
    const products = items('productos').filter(p => p.estado !== 'ARCHIVADO');
    const payables = [...items('compras').map(r => ({ ...r, collection: 'compras' })), ...items('gastosNegocio').filter(r => r.proveedorId).map(r => ({ ...r, collection: 'gastosNegocio' }))].filter(r => r.estado !== 'ANULADA' && Number(r.saldoPendiente) > 0);
    const receivables = items('ventas').filter(r => r.estado !== 'ANULADA' && Number(r.saldoPendiente) > 0);
    const total = records => window.BusinessReportsDomain.decimal(records.reduce((s, r) => s + window.BusinessReportsDomain.cents(r.saldoPendiente), 0n));
    const docs = (state.facturacion?.documents || []).filter(d => d.businessId === businessId);
    return { report, products, payables, receivables, payableTotal: total(payables), receivableTotal: total(receivables), lowStock: products.filter(p => Number(p.stock) <= Number(p.stockMinimo || 0)), customers: items('clientes'), suppliers: items('proveedores'), employees: items('empleados'), sales: items('ventas'), purchases: items('compras'), expenses: items('gastosNegocio'), incomes: items('ingresosNegocio'), stockHistory: items('movimientosInventario'), productions: items('producciones'), formulas: items('formulas'), invoiceCount: docs.filter(d => d.kind === 'INVOICE' && d.number).length, draftCount: docs.filter(d => d.status === 'BORRADOR').length, cash: core.getCajaYFlujo(businessId) };
  }
  window.BusinessReadModel = { build };
})();
