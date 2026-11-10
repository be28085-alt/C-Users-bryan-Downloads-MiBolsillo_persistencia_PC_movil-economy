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
  function periodRange(period, today) {
    if (!validDate(today)) throw new Error('Fecha de referencia inválida.');
    const [y, m] = today.split('-').map(Number), previous = monthKey(y, m - 2);
    if (period === 'MES_ACTUAL') return { ...monthRange(today.slice(0, 7)), label: monthLabel(today.slice(0, 7)), previous: { ...monthRange(previous), label: monthLabel(previous) } };
    if (period === 'MES_ANTERIOR') { const earlier = monthKey(y, m - 3); return { ...monthRange(previous), label: monthLabel(previous), previous: { ...monthRange(earlier), label: monthLabel(earlier) } }; }
    if (period === 'ANIO_ACTUAL') return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Año ${y}`, previous: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: `Año ${y - 1}` } };
    if (period === 'TODOS') return { from: '', to: '', label: 'Histórico completo', previous: null };
    throw new Error('Período de informe inválido.');
  }
  const inRange = (date, range) => (!range.from || date >= range.from) && (!range.to || date <= range.to);
  function summarize(events) {
    const t = { sales: 0n, otherIncome: 0n, cogs: 0n, operatingExpenses: 0n, salesCount: 0 };
    for (const e of events) {
      if (e.type === 'SALE') { t.sales += e.amount; t.cogs += e.cost; t.salesCount++; }
      else if (e.type === 'OTHER_INCOME') t.otherIncome += e.amount;
      else t.operatingExpenses += e.amount;
    }
    t.income = t.sales + t.otherIncome; t.expenses = t.cogs + t.operatingExpenses;
    t.grossProfit = t.income - t.cogs; t.netProfit = t.income - t.expenses;
    t.margin = percentage(t.netProfit, t.income); t.ticket = t.salesCount ? round(t.sales, BigInt(t.salesCount)) : 0n;
    return t;
  }
  function publicTotals(t) { return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, typeof v === 'bigint' ? decimal(v) : v])); }
  function build(state, businessId, options = {}) {
    const today = options.today || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const period = options.period || 'MES_ACTUAL', range = periodRange(period, today);
    const business = (state.negocios || []).find(n => n.id === businessId);
    if (!business) throw new Error('Seleccione un negocio para consultar sus informes.');
    const events = []; let invalidCount = 0;
    function add(record, convert) {
      if (record.negocioId !== businessId) return;
      try { if (!validDate(record.fecha)) throw new Error('Fecha inválida'); events.push({ date: record.fecha, ...convert(record) }); }
      catch (e) { invalidCount++; }
    }
    for (const sale of state.ventas || []) {
      if (sale.estado === 'ANULADA') continue;
      add(sale, v => ({ type: 'SALE', amount: cents(v.invoiceDocumentId ? v.subtotal : v.total), cost: v.costoTotalVenta !== undefined ? cents(v.costoTotalVenta) : (v.detalles || []).reduce((sum, l) => sum + product(l.cantidad, l.costoUnitario ?? 0), 0n) }));
    }
    for (const income of state.ingresosNegocio || []) add(income, i => ({ type: 'OTHER_INCOME', amount: cents(i.monto) }));
    for (const expense of state.gastosNegocio || []) add(expense, e => ({ type: 'EXPENSE', category: String(e.categoria || 'Otros gastos'), amount: cents(e.monto) }));
    for (const payroll of state.pagosEmpleado || []) add(payroll, p => ({ type: 'PAYROLL', category: 'Nómina y personal', amount: cents(p.monto) }));
    const selected = events.filter(e => inRange(e.date, range)), t = summarize(selected);
    const categoryMap = new Map();
    for (const e of selected) {
      const category = e.type === 'SALE' ? 'Costo de ventas' : e.category;
      const value = e.type === 'SALE' ? e.cost : ['EXPENSE', 'PAYROLL'].includes(e.type) ? e.amount : 0n;
      if (value) categoryMap.set(category, (categoryMap.get(category) || 0n) + value);
    }
    const categories = [...categoryMap].sort((a, b) => a[1] === b[1] ? a[0].localeCompare(b[0], 'es') : a[1] > b[1] ? -1 : 1).map(([name, amount]) => ({ name, amount: decimal(amount), percentage: percentage(amount, t.expenses) }));
    let endMonth = period === 'MES_ANTERIOR' ? range.to.slice(0, 7) : today.slice(0, 7);
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
    return { business: { id: business.id, name: business.nombre }, period, range, today, totals: publicTotals(t), comparison, categories, monthly, receivables: decimal(receivables), invalidCount, hasData: selected.length > 0 };
  }
  window.BusinessReportsDomain = { build, periodRange, decimal, cents };
})();
