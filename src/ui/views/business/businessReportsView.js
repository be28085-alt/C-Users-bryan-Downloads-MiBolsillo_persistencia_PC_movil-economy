(function () {
  'use strict';
  const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const colors = ['#0f8b65', '#d93858', '#e6a23d', '#6776c8', '#278fa4', '#98a6b6'];
  const periods = { MES_ACTUAL: 'Mes actual', MES_ANTERIOR: 'Mes anterior', ANIO_ACTUAL: 'Año actual', TODOS: 'Histórico', PERSONALIZADO: 'Elegir fechas' };
  const cents = value => BigInt(String(value).replace('.', ''));
  function money(value, signed = false) {
    const [whole, fraction = '00'] = String(value).split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${signed && cents(value) > 0n ? '+' : ''}${grouped}${fraction !== '00' ? ',' + fraction : ''} COP`;
  }
  function trend(model, field) {
    if (!model.comparison) return model.period === 'TODOS' ? 'Todos los registros del negocio' : 'Resultado del rango de fechas aplicado';
    if (!model.comparison.hasData) return `Sin registros en ${E(model.comparison.label)}`;
    return `${E(money(model.comparison[field], true))} frente a ${E(model.comparison.label)}`;
  }
  function line(label, value, total = false, expense = false) {
    return `<tr class="${total ? 'br-total-row' : ''} ${cents(value) < 0n ? 'br-result-loss' : ''}"><th scope="row">${label}</th><td>${expense && cents(value) > 0n ? '−' : ''}${E(money(value))}</td></tr>`;
  }
  function bars(model, includeSales = false) {
    const max = model.monthly.reduce((m, row) => [row.income, row.expenses].reduce((a, v) => cents(v) > a ? cents(v) : a, m), 0n);
    if (!max) return '<div class="br-chart-empty">Aún no hay ingresos ni gastos en estos seis meses.</div>';
    const grid = Array.from({ length: 4 }, (_, i) => {
      const y = 190 - i * 48;
      const label = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(max * BigInt(i) / 3n) / 100).replace(/\s/g, '');
      return `<line x1="66" y1="${y}" x2="610" y2="${y}" stroke="#e7edf1"/><text x="57" y="${y + 4}" text-anchor="end" class="br-axis">${E(label)}</text>`;
    }).join('');
    const columns = model.monthly.map((row, i) => {
      const x = 91 + i * 87, ih = Number(cents(row.income) * 144n / max), eh = Number(cents(row.expenses) * 144n / max);
      const title = `${row.label}: ingresos ${money(row.income)}, costos y gastos ${money(row.expenses)}`;
      const salesHeight = Number(cents(row.sales) * 144n / max);
      const width = includeSales ? 15 : 23;
      return `<g><title>${E(includeSales ? `Ventas netas ${money(row.sales)}; ${title}` : title)}</title>${includeSales ? `<rect x="${x}" y="${190 - salesHeight}" width="15" height="${salesHeight}" rx="3" fill="#278fa4"/>` : ''}<rect x="${x + (includeSales ? 19 : 0)}" y="${190 - ih}" width="${width}" height="${ih || (cents(row.income) ? 1 : 0)}" rx="4" fill="#0f8b65"/><rect x="${x + (includeSales ? 38 : 28)}" y="${190 - eh}" width="${width}" height="${eh || (cents(row.expenses) ? 1 : 0)}" rx="4" fill="#d93858"/><text x="${x + 25}" y="214" text-anchor="middle" class="br-axis">${E(row.label.split(' ')[0].slice(0, 3))} ${row.key.slice(2, 4)}</text></g>`;
    }).join('');
    return `<svg class="br-bars" viewBox="0 0 630 230" role="img" aria-label="Ingresos frente a costos y gastos durante seis meses. Consulte los valores en Ver datos mensuales."><title>Evolución mensual del negocio</title>${grid}${columns}</svg>`;
  }
  function donut(model) {
    const total = cents(model.totals.expenses);
    let grouped = model.categories;
    if (grouped.length > 6) grouped = [...grouped.slice(0, 5), { name: 'Otros rubros', amount: window.BusinessReportsDomain.decimal(grouped.slice(5).reduce((sum, c) => sum + cents(c.amount), 0n)) }];
    let start = 0;
    const segments = grouped.map((c, i) => {
      const end = i === grouped.length - 1 ? 100 : start + Number(cents(c.amount) * 10000n / total) / 100;
      const result = `${colors[i % colors.length]} ${start}% ${end}%`; start = end; return result;
    });
    return `<div class="br-distribution"><div class="br-donut" style="background:conic-gradient(${segments.join(',') || '#e7edf1 0% 100%'})" role="img" aria-label="Distribución de costos y gastos por rubro; valores en el desglose inferior."><div><small>${total ? 'TOTAL' : 'SIN GASTOS'}</small><strong>${E(money(model.totals.expenses))}</strong></div></div><ul class="br-legend-list">${grouped.map((c, i) => `<li><span class="br-dot" style="background:${colors[i % colors.length]}"></span><div><span>${E(c.name)}</span><strong>${E(money(c.amount))}</strong></div></li>`).join('') || '<li>El desglose aparecerá al registrar costos o gastos.</li>'}</ul></div>`;
  }
  function detailsMarkup(model) {
    const sales = model.details.filter(r => r.type === 'SALE'), expenses = model.details.filter(r => ['EXPENSE', 'PAYROLL'].includes(r.type)), incomes = model.details.filter(r => r.type === 'OTHER_INCOME');
    function section(title, subtitle, rows, columns, type) {
      return `<section class="br-card br-ledger" data-report-detail="${type}"><h2>${title} <span class="br-record-count">${rows.length}</span></h2><p>${subtitle}</p><div class="br-table-wrap"><table><thead><tr>${columns.map(c => `<th scope="col">${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${columns.map(c => `<td data-label="${E(c[0])}">${E(c[2] ? money(r[c[1]]) : r[c[1]] || '—')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${columns.length}">No hay registros en el período seleccionado.</td></tr>`}</tbody></table></div></section>`;
    }
    return { sales: section('Detalle de ventas y ganancia bruta', 'Valores históricos de cada venta confirmada. La ganancia bruta todavía no descuenta los gastos del negocio. Las anuladas se excluyen.', sales, [['Fecha', 'date'], ['Número', 'reference'], ['Cliente', 'name'], ['Venta neta', 'amount', true], ['Costo vendido', 'cost', true], ['Ganancia bruta', 'profit', true], ['Impuestos', 'tax', true], ['Total con impuestos', 'total', true]], 'sales'),
      expenses: section('Detalle de gastos y pagos al personal', 'Gastos registrados en el período, incluidos los pendientes de pago. Los desembolsos de compras de inventario se consultan en el flujo de dinero.', expenses, [['Fecha', 'date'], ['Concepto', 'name'], ['Categoría', 'category'], ['Proveedor / período', 'contact'], ['Valor', 'amount', true]], 'expenses')
      + section('Detalle de otros ingresos', 'Ingresos adicionales a las ventas; no incluye cobros de cartera duplicados.', incomes, [['Fecha', 'date'], ['Concepto', 'name'], ['Categoría', 'category'], ['Valor', 'amount', true]], 'income') };
  }
  function currentSituation(model) {
    const cash = model.cash;
    return `<section class="br-card br-current"><div class="br-card-heading"><div><h2>Dinero recibido, pagos y saldos pendientes</h2><p>El flujo corresponde al período seleccionado. Las cuentas pendientes y el inventario son saldos actuales de todos los períodos.</p></div></div><div class="br-summary-grid">${[
      ['Dinero recibido en el período', cash.available ? cash.incoming : null], ['Dinero pagado en el período', cash.available ? cash.outgoing : null], ['Flujo neto del período', cash.available ? cash.net : null], ['Cuentas por cobrar actuales', model.receivables], ['Cuentas por pagar actuales', model.payables], ['Inventario actual al costo', model.inventoryValue]
    ].map(([label, value]) => `<div><span>${label}</span><strong>${value === null ? 'No disponible' : E(money(value))}</strong></div>`).join('')}</div><p class="br-note">${model.lowStockCount} productos con inventario bajo. El flujo neto es cobros menos pagos registrados; no representa un saldo bancario ni la ganancia del período.</p></section>`;
  }
  function markup(model, printing = false) {
    const t = model.totals, positive = cents(t.netProfit) >= 0n;
    const sections = window.BusinessReportPreferences.sections, selected = model.section || 'overview';
    const details = detailsMarkup(model), operations = window.BusinessReportOperationsView.markup(model, printing);
    const panel = (key, content) => `<section id="br-panel-${key}" data-report-panel="${key}" ${printing ? '' : `role="tabpanel" aria-labelledby="br-tab-${key}" ${selected === key ? '' : 'hidden'}`}>${printing ? `<h2 class="br-print-section">${sections[key]}</h2>` : ''}${content}</section>`;
    const marginText = cents(t.income) > 0n ? `${positive ? 'Conservas el ' : 'Margen neto negativo: '}${String(t.margin).replace('.', ',')}%${positive ? ' de tus ingresos' : ''}` : 'Sin ingresos registrados en el período';
    return `<header class="br-header"><div><span class="br-eyebrow">INFORMES DE MI NEGOCIO</span><h1>Tu negocio, en perspectiva</h1><p>${E(model.business.name)} · <span data-report-period-label>${E(model.range.label)}</span></p></div>${printing ? '' : `<div class="br-controls"><label>Período del informe<select data-report-period>${Object.entries(periods).map(([v, l]) => `<option value="${v}" ${model.period === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><div class="br-export-actions"><button type="button" data-report-action="csv">↓ Descargar CSV</button><button type="button" data-report-action="save-view">Guardar vista</button><button type="button" class="br-button-primary" data-report-action="print">Imprimir / PDF</button></div></div>`}</header>
      ${!printing && model.period === 'PERSONALIZADO' ? `<div class="br-date-range"><label>Desde<input type="date" data-report-from value="${E(model.range.from)}" required></label><label>Hasta<input type="date" data-report-to value="${E(model.range.to)}" required></label><button type="button" class="br-button-primary" data-report-action="range">Aplicar fechas</button></div>` : ''}
      <p class="br-feedback" role="status" aria-live="polite"></p>
      ${!model.hasData ? '<div class="br-empty" role="status"><strong>No hay movimientos de ventas, gastos u otros ingresos en este período.</strong><span>Los cobros, pagos y saldos se muestran por separado. Selecciona otro período para consultar más registros.</span></div>' : ''}
      ${model.invalidCount ? `<div class="br-empty br-warning">Se excluyeron ${model.invalidCount} registros del negocio con fechas o valores inválidos. Revisa esos registros para completar el informe.</div>` : ''}
      ${model.cash.invalidCount ? `<div class="br-empty br-warning">El flujo de dinero omite ${model.cash.invalidCount} movimientos sin fecha válida. Revisa su registro de origen.</div>` : ''}
      ${model.operations.invalidCount ? `<div class="br-empty br-warning">Se omitieron ${model.operations.invalidCount} registros operativos con importes o saldos inconsistentes. Revisa los documentos originales.</div>` : ''}
      ${printing ? '' : `<nav class="br-section-nav" role="tablist" aria-label="Secciones del informe">${Object.entries(sections).map(([key, label]) => `<button type="button" role="tab" id="br-tab-${key}" aria-controls="br-panel-${key}" aria-selected="${selected === key}" tabindex="${selected === key ? '0' : '-1'}" data-report-tab="${key}">${label}</button>`).join('')}</nav><p class="br-storage-note">Fuente: datos del negocio en este navegador · el informe se actualiza con cada operación. Usa Guardar vista para recordar el período y la sección.</p>`}
      <section id="br-panel-overview" data-report-panel="overview" ${printing ? '' : `role="tabpanel" aria-labelledby="br-tab-overview" ${selected === 'overview' ? '' : 'hidden'}`}>
      <div class="br-kpis"><article class="br-kpi br-hero ${positive ? '' : 'br-loss'}"><span>Utilidad neta del período</span><strong data-report-value="netProfit">${E(money(t.netProfit, true))}</strong><span class="br-chip">${E(marginText)}</span><small>${trend(model, 'netProfitDelta')}</small></article><article class="br-kpi"><span>Ingresos totales <b class="br-arrow br-positive">↗</b></span><strong class="br-positive" data-report-value="income">${E(money(t.income))}</strong><span class="br-chip">Ventas netas + otros ingresos</span><small>${trend(model, 'incomeDelta')}</small></article><article class="br-kpi"><span>Costos y gastos <b class="br-arrow br-negative">↘</b></span><strong class="br-negative" data-report-value="expenses">${E(money(t.expenses))}</strong><span class="br-chip">Costo de ventas + operación</span><small>${trend(model, 'expensesDelta')}</small></article></div>
      <div class="br-secondary-kpis br-activity-summary"><div><span>Ventas del período</span><strong data-report-value="salesCount">${t.salesCount}</strong></div><div><span>Ticket promedio de venta</span><strong>${E(money(t.ticket))}</strong></div></div>
      <div class="br-summary-grid br-financial-summary">${[['Ventas netas', 'sales'], ['Costo de productos vendidos', 'cogs'], ['Ganancia bruta de ventas', 'grossProfit'], ['Gastos del negocio', 'businessExpenses'], ['Pagos administrativos al personal', 'employeePayments'], ['Impuestos de ventas', 'salesTax']].map(([label, field]) => `<article><span>${label}</span><strong data-report-value="${field}">${E(money(t[field]))}</strong></article>`).join('')}</div>
      <div class="br-chart-grid"><section class="br-card"><div class="br-card-heading"><div><h2>Evolución mensual</h2><p>Contexto: seis meses completos hasta ${E(model.monthly.at(-1).label)}</p></div><div class="br-chart-key"><span><i class="br-dot" style="background:#278fa4"></i>Ventas netas</span><span><i class="br-dot" style="background:#0f8b65"></i>Ingresos</span><span><i class="br-dot" style="background:#d93858"></i>Costos y gastos</span></div></div>${bars(model, true)}<details class="br-monthly-data"><summary>Ver datos mensuales</summary><div class="br-table-wrap"><table><caption>Valores de la evolución mensual, en COP</caption><thead><tr><th scope="col">Mes</th><th scope="col">Ventas netas</th><th scope="col">Ingresos</th><th scope="col">Costos y gastos</th><th scope="col">Utilidad neta</th></tr></thead><tbody>${model.monthly.map(m => `<tr><th scope="row">${E(m.label)}</th><td>${E(money(m.sales))}</td><td>${E(money(m.income))}</td><td>${E(money(m.expenses))}</td><td>${E(money(m.netProfit))}</td></tr>`).join('')}</tbody></table></div></details></section><section class="br-card"><div class="br-card-heading"><div><h2>¿En qué se va el dinero?</h2><p>Distribución de costos y gastos del período</p></div></div>${donut(model)}</section></div>
      <div class="br-detail-grid"><section class="br-card"><div class="br-card-heading"><div><h2>Desglose por categoría</h2><p>El impacto de cada rubro sobre tus costos y gastos</p></div></div><div class="br-table-wrap"><table class="br-categories"><thead><tr><th scope="col">Rubro</th><th scope="col">Total</th><th scope="col">Participación</th></tr></thead><tbody>${model.categories.map(c => `<tr><th scope="row">${E(c.name)}</th><td>${E(money(c.amount))}</td><td><div class="br-share"><span class="br-track"><span style="width:${Math.min(c.percentage, 100)}%"></span></span><strong>${c.percentage.toFixed(1).replace('.', ',')}%</strong></div></td></tr>`).join('') || '<tr><td colspan="3">Sin costos ni gastos en el período seleccionado.</td></tr>'}</tbody>${model.categories.length ? `<tfoot><tr><th scope="row">Total</th><td>${E(money(t.expenses))}</td><td>100%</td></tr></tfoot>` : ''}</table></div></section>
      <section class="br-card"><div class="br-card-heading"><div><h2>Estado de resultados</h2><p>De los ingresos a la utilidad neta</p></div></div><table class="br-results"><tbody>${line('Ventas netas', t.sales)}${line('Costo de productos vendidos', t.cogs, false, true)}${line('Ganancia bruta de ventas', t.grossProfit, true)}${line('Otros ingresos', t.otherIncome)}${line('Gastos del negocio', t.businessExpenses, false, true)}${line('Pagos administrativos al personal', t.employeePayments, false, true)}${line('Ganancia neta', t.netProfit, true)}</tbody></table><p class="br-results-note">Margen neto: <strong>${t.margin.toFixed(1).replace('.', ',')}%</strong></p></section></div>
      ${currentSituation(model)}
      <aside class="br-reading"><strong>Cómo leer tu informe</strong><p>Ganancia bruta = ventas netas − costo de los productos vendidos. Ganancia neta = ganancia bruta + otros ingresos − gastos del negocio − pagos administrativos al personal. Estos pagos no constituyen una liquidación legal de nómina.</p><p>Las compras de inventario no se descuentan nuevamente como gasto. Los cobros de cartera no se suman otra vez como ingresos. Las ventas actuales se muestran sin impuestos; los datos históricos conservan los importes disponibles. Las notas simuladas ajustan la venta en su fecha original.</p></aside></section>${panel('sales', details.sales)}${panel('expenses', details.expenses)}${panel('purchases', operations.purchases)}${panel('balances', operations.balances)}${panel('operations', operations.operations)}${panel('cash', (printing ? '' : currentSituation(model)) + operations.cash)}`;
  }
  function render(finanzas, business, period = 'MES_ACTUAL') {
    const root = document.querySelector?.('[data-business-report]');
    if (!root) return;
    if (!business) { root.innerHTML = '<div class="br-empty">Crea o selecciona un negocio para ver tus informes.</div>'; return; }
    if (root.dataset.businessId !== business.id) {
      let saved;
      try { saved = business.reportPreferences && window.BusinessReportPreferences.validate(business.reportPreferences); } catch (e) { /* Invalid preferences never prevent reading financial data. */ }
      root.dataset.reportPeriod = saved?.period || period;
      root.dataset.reportSection = saved?.section || 'overview';
      root.dataset.reportFrom = saved?.from || ''; root.dataset.reportTo = saved?.to || '';
    }
    const selected = root.dataset.reportPeriod || period;
    const options = { period: selected, from: root.dataset.reportFrom, to: root.dataset.reportTo };
    if (selected === 'PERSONALIZADO' && (!options.from || !options.to)) {
      const current = window.BusinessReportsDomain.build(finanzas.state, business.id);
      options.from = current.range.from; options.to = current.today;
      root.dataset.reportFrom = options.from; root.dataset.reportTo = options.to;
    }
    const model = window.BusinessReportsDomain.build(finanzas.state, business.id, options);
    model.section = root.dataset.reportSection || 'overview';
    root.dataset.reportPeriod = selected; root.dataset.businessId = business.id; root.innerHTML = markup(model);
  }
  function csv(model) {
    const t = model.totals;
    const rows = [['INFORME DE MI NEGOCIO', model.business.name], ['Período', model.range.label], ['Desde', model.range.from], ['Hasta', model.range.to], ['Moneda', 'COP'], [], ['Estado de resultados', 'Valor COP'], ['Ventas netas', t.sales], ['Otros ingresos', t.otherIncome], ['Ingresos totales', t.income], ['Costo de ventas', t.cogs], ['Ganancia bruta de ventas', t.grossProfit], ['Gastos del negocio', t.businessExpenses], ['Pagos administrativos al personal', t.employeePayments], ['Costos y gastos totales', t.expenses], ['Utilidad neta', t.netProfit], ['Margen neto %', t.margin], ['Ventas del período', t.salesCount], ['Ticket promedio', t.ticket], ['Impuestos de ventas', t.salesTax], ['Total de ventas con impuestos', t.billedTotal], [], ['Saldos actuales (todos los períodos)', 'Valor COP'], ['Cuentas por cobrar', model.receivables], ['Cuentas por pagar', model.payables], ['Inventario al costo', model.inventoryValue], ['Productos con inventario bajo', model.lowStockCount], [], ['Flujo de dinero del período', 'Valor COP'], ['Dinero recibido', model.cash.available ? model.cash.incoming : 'No disponible'], ['Dinero pagado', model.cash.available ? model.cash.outgoing : 'No disponible'], ['Flujo neto', model.cash.available ? model.cash.net : 'No disponible'], [], ['Rubro', 'Total COP', 'Participación %'], ...model.categories.map(c => [c.name, c.amount, c.percentage]), [], ['Evolución mensual de contexto: meses completos, independiente del rango aplicado'], ['Mes', 'Ventas netas COP', 'Ingresos COP', 'Costos y gastos COP', 'Utilidad neta COP'], ...model.monthly.map(m => [m.key, m.sales, m.income, m.expenses, m.netProfit]), [], ['Detalle de ventas'], ['Fecha', 'Número', 'Cliente', 'Venta neta COP', 'Costo vendido COP', 'Ganancia bruta COP', 'Impuestos COP', 'Total con impuestos COP'], ...model.details.filter(r => r.type === 'SALE').map(r => [r.date, r.reference, r.name, r.amount, r.cost, r.profit, r.tax, r.total]), [], ['Detalle de gastos y pagos al personal'], ['Fecha', 'Concepto', 'Categoría', 'Proveedor / período', 'Valor COP'], ...model.details.filter(r => ['EXPENSE', 'PAYROLL'].includes(r.type)).map(r => [r.date, r.name, r.category, r.contact, r.amount]), [], ['Detalle de otros ingresos'], ['Fecha', 'Concepto', 'Categoría', 'Valor COP'], ...model.details.filter(r => r.type === 'OTHER_INCOME').map(r => [r.date, r.name, r.category, r.amount])];
    rows.push(...window.BusinessReportOperationsView.csvRows(model));
    const escape = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(?:\.\d+)?$/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
    return rows.map(row => row.map(escape).join(';')).join('\r\n');
  }
  function printDocument(model, cssText = '') {
    const stylesheet = cssText ? `<style>${cssText}</style>` : `<link rel="stylesheet" href="${E(new URL('styles/businessReports.css?v=20261110-2', window.location.href).href)}">`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de ${E(model.business.name)} - ${E(model.range.label)}</title>${stylesheet}</head><body class="br-print-page"><main class="business-reports">${markup(model, true)}</main></body></html>`;
  }
  function init() {
    function selectSection(root, section, focus = false) {
      if (!Object.hasOwn(window.BusinessReportPreferences.sections, section)) return;
      root.dataset.reportSection = section;
      root.querySelectorAll('[data-report-panel]').forEach(panel => { panel.hidden = panel.dataset.reportPanel !== section; });
      root.querySelectorAll('[data-report-tab]').forEach(tab => { const active = tab.dataset.reportTab === section; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; if (active && focus) { tab.focus(); tab.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } });
    }
    document.addEventListener('keydown', event => {
      const tab = event.target.closest('[data-report-tab]'); if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const root = tab.closest('[data-business-report]'), keys = Object.keys(window.BusinessReportPreferences.sections), index = keys.indexOf(tab.dataset.reportTab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length;
      selectSection(root, keys[next], true);
    });
    document.addEventListener('change', event => {
      if (event.target.matches('[data-report-from], [data-report-to]')) {
        event.target.closest('[data-business-report]').querySelector('.br-feedback').textContent = 'Pulsa Aplicar fechas para actualizar el informe y sus exportaciones.';
        return;
      }
      if (!event.target.matches('[data-report-period]')) return;
      const root = event.target.closest('[data-business-report]'); root.dataset.reportPeriod = event.target.value;
      render(window.Finanzas, window.Finanzas.getNegocioActivo(), event.target.value); root.querySelector('[data-report-period]').focus();
    });
    let savingView = false;
    document.addEventListener('click', async event => {
      const tab = event.target.closest('[data-report-tab]'); if (tab) { selectSection(tab.closest('[data-business-report]'), tab.dataset.reportTab); return; }
      const record = event.target.closest('[data-report-record]');
      if (record) {
        const root = record.closest('[data-business-report]');
        try {
          if (root.dataset.businessId !== window.Finanzas.state.negocioActivoId) throw new Error('Cambió el negocio activo. Actualiza el informe.');
          const { id, collection, reportRecord: action } = record.dataset;
          if (!['compras', 'ventas', 'gastosNegocio', 'empleados', 'producciones', 'productos'].includes(collection)) throw new Error('Documento no disponible.');
          if (action === 'detail') window.BusinessUI.detail(collection, id);
          else if (action === 'payment') window.BusinessUI.form('payment', id, collection);
          else if (action === 'cancel' && collection === 'compras') window.BusinessUI.form('cancel', id, collection);
          else if (action === 'print') window.BusinessUI.printRecord(collection, id);
        } catch (e) { root.querySelector('.br-feedback').textContent = e.message; }
        return;
      }
      const button = event.target.closest('[data-report-action]'); if (!button) return;
      const root = button.closest('[data-business-report]'), feedback = root.querySelector('.br-feedback');
      try {
        const options = { period: root.dataset.reportPeriod, from: root.dataset.reportFrom, to: root.dataset.reportTo };
        if (button.dataset.reportAction === 'range') {
          options.from = root.querySelector('[data-report-from]').value; options.to = root.querySelector('[data-report-to]').value;
        }
        const model = window.BusinessReportsDomain.build(window.Finanzas.state, window.Finanzas.state.negocioActivoId, options);
        if (button.dataset.reportAction === 'save-view') {
          if (savingView) return;
          savingView = true; button.disabled = true;
          const businessId = model.business.id;
          try {
            await window.Finanzas.getBusinessService().execute('saveReportPreferences', { version: 1, period: model.period, from: model.range.from, to: model.range.to, section: root.dataset.reportSection || 'overview' });
            if (root.dataset.businessId === businessId) root.querySelector('.br-feedback').textContent = 'Vista guardada y verificada. Se recuperará al abrir este negocio en PC o móvil.';
          } finally { savingView = false; root.querySelector('[data-report-action="save-view"]').disabled = false; }
          return;
        }
        if (button.dataset.reportAction === 'range') {
          root.dataset.reportFrom = options.from; root.dataset.reportTo = options.to;
          render(window.Finanzas, window.Finanzas.getNegocioActivo()); root.querySelector('[data-report-action="range"]').focus();
          return;
        }
        if (button.dataset.reportAction === 'csv') {
          window.FinanzasExportService.descargarCSV(`informe_negocio_${model.business.id}_${model.period}_${model.today}.csv`, csv(model)); feedback.textContent = 'Se descargó el informe del período seleccionado.';
        } else {
          const popup = window.open('', '_blank');
          if (!popup) throw new Error('Permite abrir la ventana de impresión para guardar o imprimir el informe.');
          // Reuse the already loaded local stylesheet; printing also works without another fetch.
          const sheet = document.querySelector('link[href*="styles/businessReports.css"]')?.sheet;
          const cssText = sheet ? Array.from(sheet.cssRules, rule => rule.cssText).join('\n') : '';
          popup.document.open(); popup.document.write(printDocument(model, cssText)); popup.document.close(); popup.opener = null;
          const print = () => { popup.focus(); popup.print(); };
          if (popup.document.readyState === 'complete') popup.setTimeout(print, 0);
          else popup.addEventListener('load', print, { once: true });
          feedback.textContent = 'En la ventana de impresión puedes elegir Guardar como PDF.';
        }
      } catch (e) { root.querySelector('.br-feedback').textContent = e.message; }
    });
    render(window.Finanzas, window.Finanzas?.getNegocioActivo());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function openSection(section = 'overview') {
    if (!Object.hasOwn(window.BusinessReportPreferences.sections, section)) return;
    if (typeof pcApp !== 'undefined') pcApp.switchView('negocio-informes');
    else if (window.mobileApp) window.mobileApp.switchBusinessTab('informes');
    const root = document.querySelector('[data-business-report]'); root.dataset.reportSection = section;
    render(window.Finanzas, window.Finanzas.getNegocioActivo());
  }
  window.BusinessReportsView = { render, csv, printDocument, markup, money, bars, donut, openSection };
})();
