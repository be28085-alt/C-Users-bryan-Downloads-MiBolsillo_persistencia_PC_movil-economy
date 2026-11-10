(function () {
  'use strict';
  // Monetary report aggregation uses integer cents, including legacy decimal inputs.
  const round = (n, d) => (n + d / 2n) / d;
  function fraction(value) {
    let text = String(value ?? '0');
    if (typeof value === 'number' && Number.isFinite(value) && /e/i.test(text)) text = value.toFixed(12);
    if (!/^\d{1,16}(?:\.\d{1,12})?$/.test(text)) throw new Error('Importe inválido');
    const [whole, decimal = ''] = text.split('.');
    return { n: BigInt(whole + decimal), d: 10n ** BigInt(decimal.length) };
  }
  function cents(value) { const v = fraction(value); return round(v.n * 100n, v.d); }
  function product(a, b) { const x = fraction(a), y = fraction(b); return round(x.n * y.n * 100n, x.d * y.d); }
  function decimal(n) { const s = (n < 0n ? -n : n).toString().padStart(3, '0'); return `${n < 0n ? '-' : ''}${s.slice(0, -2)}.${s.slice(-2)}`; }
  function percentage(n, d) { return d > 0n ? Number((n < 0n ? -1n : 1n) * round((n < 0n ? -n : n) * 1000n, d)) / 10 : 0; }
  function monthKey(year, month) {
    const d = new Date(Date.UTC(year, month, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const validDate = date => window.FinanzasDates.esFechaISOValida(date);
  function monthRange(key) {
    const [y, m] = key.split('-').map(Number);
    return { from: `${key}-01`, to: `${key}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}` };
  }
  function monthLabel(key) { const [y, m] = key.split('-').map(Number); return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1))); }
  function periodRange(period, today, options = {}) {
    if (!validDate(today)) throw new Error('Fecha de referencia inválida.');
    const [y, m] = today.split('-').map(Number), previous = monthKey(y, m - 2);
    if (period === 'MES_ACTUAL') return { ...monthRange(today.slice(0, 7)), label: monthLabel(today.slice(0, 7)), previous: { ...monthRange(previous), label: monthLabel(previous) } };
    if (period === 'MES_ANTERIOR') { const earlier = monthKey(y, m - 3); return { ...monthRange(previous), label: monthLabel(previous), previous: { ...monthRange(earlier), label: monthLabel(earlier) } }; }
    if (period === 'ANIO_ACTUAL') return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Año ${y}`, previous: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: `Año ${y - 1}` } };
    if (period === 'TODOS') return { from: '', to: '', label: 'Histórico completo', previous: null };
    if (period === 'PERSONALIZADO') {
      if (!validDate(options.from) || !validDate(options.to) || options.from > options.to) throw new Error('Selecciona fechas válidas: Desde debe ser anterior o igual a Hasta.');
      return { from: options.from, to: options.to, label: `${options.from} al ${options.to}`, previous: null };
    }
    throw new Error('Período de informe inválido.');
  }
  const inRange = (date, range) => (!range.from || date >= range.from) && (!range.to || date <= range.to);
  function summarize(events) {
    const t = { sales: 0n, salesTax: 0n, billedTotal: 0n, otherIncome: 0n, cogs: 0n, businessExpenses: 0n, employeePayments: 0n, operatingExpenses: 0n, salesCount: 0 };
    for (const e of events) {
      if (e.type === 'SALE') { t.sales += e.amount; t.cogs += e.cost; t.salesTax += e.tax; t.billedTotal += e.total; t.salesCount++; }
      else if (e.type === 'OTHER_INCOME') t.otherIncome += e.amount;
      else if (e.type === 'PAYROLL') t.employeePayments += e.amount;
      else t.businessExpenses += e.amount;
    }
    t.operatingExpenses = t.businessExpenses + t.employeePayments;
    t.income = t.sales + t.otherIncome; t.expenses = t.cogs + t.operatingExpenses;
    t.grossProfit = t.sales - t.cogs; t.netProfit = t.income - t.expenses;
    t.margin = percentage(t.netProfit, t.income); t.ticket = t.salesCount ? round(t.sales, BigInt(t.salesCount)) : 0n;
    return t;
  }
  function publicTotals(t) { return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, typeof v === 'bigint' ? decimal(v) : v])); }
  function build(state, businessId, options = {}) {
    const today = options.today || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const period = options.period || 'MES_ACTUAL', range = periodRange(period, today, options);
    const business = (state.negocios || []).find(n => n.id === businessId);
    if (!business) throw new Error('Seleccione un negocio para consultar sus informes.');
    const events = []; let invalidCount = 0;
    function add(record, convert) {
      if (record.negocioId !== businessId) return;
      try { if (!validDate(record.fecha)) throw new Error('Fecha inválida'); events.push({ id: record.id || '', date: record.fecha, ...convert(record) }); }
      catch (e) { invalidCount++; }
    }
    for (const sale of state.ventas || []) {
      if (sale.estado === 'ANULADA') continue;
      add(sale, v => {
        const amount = cents(v.invoiceDocumentId || v.businessVersion === 1 ? v.subtotal : v.total), total = cents(v.total);
        return { type: 'SALE', reference: v.numeroFactura || v.id || 'Venta histórica', name: v.clienteNombre || v.clienteSnapshot?.nombre || 'Cliente histórico', amount, total, tax: v.invoiceDocumentId || v.businessVersion === 1 ? cents(v.impuestos ?? 0) : 0n, balance: cents(v.saldoPendiente ?? 0), cost: v.costoTotalVenta !== undefined ? cents(v.costoTotalVenta) : (v.detalles || []).reduce((sum, l) => sum + product(l.cantidad, l.costoUnitario ?? 0), 0n) };
      });
    }
    for (const income of state.ingresosNegocio || []) if (income.estado !== 'ANULADA') add(income, i => ({ type: 'OTHER_INCOME', name: i.descripcion || 'Ingreso adicional', category: i.categoria || 'Otros ingresos', amount: cents(i.monto) }));
    for (const expense of state.gastosNegocio || []) if (expense.estado !== 'ANULADA') add(expense, e => ({ type: 'EXPENSE', name: e.descripcion || 'Gasto empresarial', contact: e.proveedorNombre || e.proveedorSnapshot?.nombre || '', category: String(e.categoria || 'Otros gastos'), amount: cents(e.monto) }));
    for (const payroll of state.pagosEmpleado || []) if (payroll.estado !== 'ANULADA') add(payroll, p => ({ type: 'PAYROLL', name: `Pago a ${p.empleadoNombre || 'empleado'}`, contact: p.periodo || '', category: 'Pagos administrativos al personal', amount: cents(p.monto) }));
    const selected = events.filter(e => inRange(e.date, range)), t = summarize(selected);
    const categoryMap = new Map();
    for (const e of selected) {
      const category = e.type === 'SALE' ? 'Costo de ventas' : e.category;
      const value = e.type === 'SALE' ? e.cost : ['EXPENSE', 'PAYROLL'].includes(e.type) ? e.amount : 0n;
      if (value) categoryMap.set(category, (categoryMap.get(category) || 0n) + value);
    }
    const categories = [...categoryMap].sort((a, b) => a[1] === b[1] ? a[0].localeCompare(b[0], 'es') : a[1] > b[1] ? -1 : 1).map(([name, amount]) => ({ name, amount: decimal(amount), percentage: percentage(amount, t.expenses) }));
    let endMonth = ['MES_ANTERIOR', 'PERSONALIZADO'].includes(period) ? range.to.slice(0, 7) : today.slice(0, 7);
    if (period === 'TODOS' && events.length) endMonth = events.map(e => e.date.slice(0, 7)).sort().at(-1);
    const [ey, em] = endMonth.split('-').map(Number);
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const key = monthKey(ey, em - 6 + i);
      return { key, label: monthLabel(key), ...publicTotals(summarize(events.filter(e => e.date.startsWith(key)))) };
    });
    const p = range.previous ? summarize(events.filter(e => inRange(e.date, range.previous))) : null;
    const comparison = p ? { label: range.previous.label, incomeDelta: decimal(t.income - p.income), expensesDelta: decimal(t.expenses - p.expenses), netProfitDelta: decimal(t.netProfit - p.netProfit), hasData: events.some(e => inRange(e.date, range.previous)) } : null;
    let receivables = 0n;
    for (const c of state.clientes || []) if (c.negocioId === businessId) { try { receivables += cents(c.saldoPendiente); } catch (e) { invalidCount++; } }
    let payables = 0n, inventoryValue = 0n, lowStockCount = 0;
    for (const r of [...(state.compras || []), ...(state.gastosNegocio || [])]) if (r.negocioId === businessId && r.estado !== 'ANULADA') { try { payables += cents(r.saldoPendiente ?? 0); } catch (e) { invalidCount++; } }
    for (const p of state.productos || []) if (p.negocioId === businessId && p.estado !== 'ARCHIVADO') {
      try { inventoryValue += product(p.stock ?? 0, p.costoUnitario ?? p.precioCompra ?? 0); if (Number(p.stock ?? 0) <= Number(p.stockMinimo ?? 0)) lowStockCount++; } catch (e) { invalidCount++; }
    }
    // Reuse the same receipt/payment ledger as the dashboard; never add collections to revenue.
    const cash = { incoming: 0n, outgoing: 0n }; let invalidCashCount = 0;
    const cashDomain = window.BusinessCashFlowDomain;
    if (cashDomain) for (const r of cashDomain.calcularCajaYFlujo(businessId, state).movimientosCaja) {
      if (!validDate(r.fecha)) { invalidCashCount++; continue; }
      if (inRange(r.fecha, range)) cash[r.tipo === 'ENTRADA' ? 'incoming' : 'outgoing'] += cents(r.monto);
    }
    const details = selected.sort((a, b) => b.date.localeCompare(a.date) || String(a.id).localeCompare(String(b.id))).map(e => publicTotals({ ...e, profit: e.type === 'SALE' ? e.amount - e.cost : 0n }));
    return { business: { id: business.id, name: business.nombre }, period, range, today, totals: publicTotals(t), comparison, categories, monthly, details, receivables: decimal(receivables), payables: decimal(payables), inventoryValue: decimal(inventoryValue), lowStockCount, cash: { available: !!cashDomain, invalidCount: invalidCashCount, ...publicTotals({ ...cash, net: cash.incoming - cash.outgoing }) }, invalidCount, hasData: selected.length > 0 };
  }
  window.BusinessReportsDomain = { build, periodRange, decimal, cents, product };
})();
