(function () {
  'use strict';
  // Read-only summaries for the PC and mobile workspaces, using the report's
  // integer-cent arithmetic and the same receipt/payment ledger.
  function build(model) {
    const D = window.BusinessReportsDomain, report = model.report;
    const sum = (rows, field) => D.decimal(rows.reduce((n, r) => n + D.cents(r[field] ?? 0), 0n));
    const percentage = (n, d) => d > 0n ? Number((n < 0n ? -1n : 1n) * (((n < 0n ? -n : n) * 1000n + d / 2n) / d)) / 10 : 0;
    const products = model.products.map(p => {
      const cost = D.product(p.stock || 0, p.costoUnitario || 0), value = D.product(p.stock || 0, p.precioVenta || 0);
      const price = D.cents(p.precioVenta || 0), unitCost = D.cents(p.costoUnitario || 0);
      return { ...p, inventoryCost: D.decimal(cost), inventoryValue: D.decimal(value), unitProfit: D.decimal(price - unitCost), margin: percentage(price - unitCost, price) };
    });
    const categories = new Map();
    for (const r of report.details.filter(r => r.type === 'EXPENSE')) categories.set(r.category, (categories.get(r.category) || 0n) + D.cents(r.amount));
    const expenseCategories = [...categories].sort((a, b) => a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : a[0].localeCompare(b[0], 'es')).map(([name, value]) => ({ name, amount: D.decimal(value), percentage: percentage(value, D.cents(report.totals.businessExpenses)) }));
    const within = r => r.estado !== 'ANULADA' && window.FinanzasDates.esFechaISOValida(r.fecha) && (!report.range.from || r.fecha >= report.range.from) && (!report.range.to || r.fecha <= report.range.to);
    const suppliers = model.suppliers.map(s => {
      const purchases = model.purchases.filter(r => r.proveedorId === s.id && within(r));
      return { ...s, purchaseTotal: sum(purchases, 'total'), pendingTotal: sum(model.payables.filter(r => r.proveedorId === s.id), 'saldoPendiente'), lastPurchase: purchases.map(r => r.fecha).sort().at(-1) || '' };
    });
    const monthlyCash = report.monthly.map(month => {
      const rows = model.cash.movimientosCaja.filter(r => String(r.fecha).startsWith(month.key));
      return { ...month, income: sum(rows.filter(r => r.tipo === 'ENTRADA'), 'monto'), expenses: sum(rows.filter(r => r.tipo === 'SALIDA'), 'monto') };
    });
    return { products, suppliers, expenseCategories, monthlyCash,
      inventorySaleValue: sum(products, 'inventoryValue'), inventoryCost: report.inventoryValue,
      stockUnits: model.products.reduce((n, p) => n + Number(p.stock || 0), 0),
      expenseShare: percentage(D.cents(report.totals.businessExpenses), D.cents(report.totals.sales)),
      expensePending: sum(model.expenses.filter(r => r.estado !== 'ANULADA'), 'saldoPendiente'),
      periodSales: model.sales.filter(within), periodExpenses: model.expenses.filter(within),
      periodCash: model.cash.movimientosCaja.filter(r => within(r)) };
  }
  window.BusinessWorkspaceMetrics = { build };
})();
