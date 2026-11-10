(function () {
  'use strict';
  const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const colors = ['#0f8b65', '#d93858', '#e6a23d', '#6776c8', '#278fa4', '#98a6b6'];
  const periods = { MES_ACTUAL: 'Mes actual', MES_ANTERIOR: 'Mes anterior', ANIO_ACTUAL: 'Año actual', TODOS: 'Histórico' };
  const cents = value => BigInt(String(value).replace('.', ''));
  function money(value, signed = false) {
    const [whole, fraction = '00'] = String(value).split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${signed && cents(value) > 0n ? '+' : ''}${grouped}${fraction !== '00' ? ',' + fraction : ''} COP`;
  }
  function trend(model, field) {
    if (!model.comparison) return 'Todos los registros del negocio';
    if (!model.comparison.hasData) return `Sin registros en ${E(model.comparison.label)}`;
    return `${E(money(model.comparison[field], true))} frente a ${E(model.comparison.label)}`;
  }
  function line(label, value, total = false, expense = false) {
    return `<tr class="${total ? 'br-total-row' : ''} ${cents(value) < 0n ? 'br-result-loss' : ''}"><th scope="row">${label}</th><td>${expense && cents(value) > 0n ? '−' : ''}${E(money(value))}</td></tr>`;
  }
  function bars(model) {
    const max = model.monthly.reduce((m, row) => [row.income, row.expenses].reduce((a, v) => cents(v) > a ? cents(v) : a, m), 0n);
    if (!max) return '<div class="br-chart-empty">Aún no hay ingresos ni gastos en estos seis meses.</div>';
    const grid = Array.from({ length: 4 }, (_, i) => {
      const y = 190 - i * 48;
      const label = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(max * BigInt(i) / 3n) / 100);
      return `<line x1="66" y1="${y}" x2="610" y2="${y}" stroke="#e7edf1"/><text x="57" y="${y + 4}" text-anchor="end" class="br-axis">${E(label)}</text>`;
    }).join('');
    const columns = model.monthly.map((row, i) => {
      const x = 91 + i * 87, ih = Number(cents(row.income) * 144n / max), eh = Number(cents(row.expenses) * 144n / max);
      const title = `${row.label}: ingresos ${money(row.income)}, costos y gastos ${money(row.expenses)}`;
      return `<g><title>${E(title)}</title><rect x="${x}" y="${190 - ih}" width="23" height="${ih || (cents(row.income) ? 1 : 0)}" rx="4" fill="#0f8b65"/><rect x="${x + 28}" y="${190 - eh}" width="23" height="${eh || (cents(row.expenses) ? 1 : 0)}" rx="4" fill="#d93858"/><text x="${x + 25}" y="214" text-anchor="middle" class="br-axis">${E(row.label.split(' ')[0].slice(0, 3))} ${row.key.slice(2, 4)}</text></g>`;
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
  function markup(model, printing = false) {
    const t = model.totals, positive = cents(t.netProfit) >= 0n;
    const marginText = cents(t.income) > 0n ? `${positive ? 'Conservas el ' : 'Margen neto negativo: '}${String(t.margin).replace('.', ',')}%${positive ? ' de tus ingresos' : ''}` : 'Sin ingresos registrados en el período';
    return `<header class="br-header"><div><span class="br-eyebrow">INFORMES DE MI NEGOCIO</span><h1>Tu negocio, en perspectiva</h1><p>${E(model.business.name)} · <span data-report-period-label>${E(model.range.label)}</span></p></div>${printing ? '' : `<div class="br-controls"><label>Período del informe<select data-report-period>${Object.entries(periods).map(([v, l]) => `<option value="${v}" ${model.period === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><div class="br-export-actions"><button type="button" data-report-action="csv">↓ Descargar CSV</button><button type="button" class="br-button-primary" data-report-action="print">Imprimir / PDF</button></div></div>`}</header>
      <p class="br-feedback" role="status" aria-live="polite"></p>
      ${!model.hasData ? '<div class="br-empty" role="status"><strong>No hay movimientos en este período.</strong><span>Selecciona Mes anterior o Histórico para consultar otros registros del negocio.</span></div>' : ''}
      ${model.invalidCount ? `<div class="br-empty br-warning">Se excluyeron ${model.invalidCount} registros del negocio con fechas o valores inválidos. Revisa esos registros para completar el informe.</div>` : ''}
      <div class="br-kpis"><article class="br-kpi br-hero ${positive ? '' : 'br-loss'}"><span>Utilidad neta del período</span><strong data-report-value="netProfit">${E(money(t.netProfit, true))}</strong><span class="br-chip">${E(marginText)}</span><small>${trend(model, 'netProfitDelta')}</small></article><article class="br-kpi"><span>Ingresos totales <b class="br-arrow br-positive">↗</b></span><strong class="br-positive" data-report-value="income">${E(money(t.income))}</strong><span class="br-chip">Ventas netas + otros ingresos</span><small>${trend(model, 'incomeDelta')}</small></article><article class="br-kpi"><span>Costos y gastos <b class="br-arrow br-negative">↘</b></span><strong class="br-negative" data-report-value="expenses">${E(money(t.expenses))}</strong><span class="br-chip">Costo de ventas + operación</span><small>${trend(model, 'expensesDelta')}</small></article></div>
      <div class="br-secondary-kpis"><div><span>Ventas del período</span><strong data-report-value="salesCount">${t.salesCount}</strong></div><div><span>Ticket promedio de venta</span><strong>${E(money(t.ticket))}</strong></div><div><span>Cuentas por cobrar actuales</span><strong>${E(money(model.receivables))}</strong><small>Saldo de todos los períodos</small></div></div>
      <div class="br-chart-grid"><section class="br-card"><div class="br-card-heading"><div><h2>Evolución mensual</h2><p>Seis meses hasta ${E(model.monthly.at(-1).label)}</p></div><div class="br-chart-key"><span><i class="br-dot" style="background:#0f8b65"></i>Ingresos</span><span><i class="br-dot" style="background:#d93858"></i>Costos y gastos</span></div></div>${bars(model)}<details class="br-monthly-data"><summary>Ver datos mensuales</summary><div class="br-table-wrap"><table><caption>Valores de la evolución mensual, en COP</caption><thead><tr><th scope="col">Mes</th><th scope="col">Ingresos</th><th scope="col">Costos y gastos</th><th scope="col">Utilidad neta</th></tr></thead><tbody>${model.monthly.map(m => `<tr><th scope="row">${E(m.label)}</th><td>${E(money(m.income))}</td><td>${E(money(m.expenses))}</td><td>${E(money(m.netProfit))}</td></tr>`).join('')}</tbody></table></div></details></section><section class="br-card"><div class="br-card-heading"><div><h2>¿En qué se va el dinero?</h2><p>Distribución de costos y gastos del período</p></div></div>${donut(model)}</section></div>
      <div class="br-detail-grid"><section class="br-card"><div class="br-card-heading"><div><h2>Desglose por categoría</h2><p>El impacto de cada rubro sobre tus costos y gastos</p></div></div><div class="br-table-wrap"><table class="br-categories"><thead><tr><th scope="col">Rubro</th><th scope="col">Total</th><th scope="col">Participación</th></tr></thead><tbody>${model.categories.map(c => `<tr><th scope="row">${E(c.name)}</th><td>${E(money(c.amount))}</td><td><div class="br-share"><span class="br-track"><span style="width:${Math.min(c.percentage, 100)}%"></span></span><strong>${c.percentage.toFixed(1).replace('.', ',')}%</strong></div></td></tr>`).join('') || '<tr><td colspan="3">Sin costos ni gastos en el período seleccionado.</td></tr>'}</tbody>${model.categories.length ? `<tfoot><tr><th scope="row">Total</th><td>${E(money(t.expenses))}</td><td>100%</td></tr></tfoot>` : ''}</table></div></section>
      <section class="br-card"><div class="br-card-heading"><div><h2>Estado de resultados</h2><p>De los ingresos a la utilidad neta</p></div></div><table class="br-results"><tbody>${line('Ventas netas', t.sales)}${line('Otros ingresos', t.otherIncome)}${line('Ingresos totales', t.income, true)}${line('Costo de ventas', t.cogs, false, true)}${line('Resultado bruto', t.grossProfit, true)}${line('Gastos operativos y nómina', t.operatingExpenses, false, true)}${line('Utilidad neta', t.netProfit, true)}</tbody></table><p class="br-results-note">Margen neto: <strong>${t.margin.toFixed(1).replace('.', ',')}%</strong></p></section></div>
      <aside class="br-reading"><strong>Cómo leer tu informe</strong><p>La utilidad descuenta el costo de los productos vendidos, los gastos operativos y la nómina. Las compras de inventario no se descuentan nuevamente como gasto. Los cobros de cartera no se suman otra vez como ingresos.</p><p>Las ventas de facturación simulada se muestran sin impuestos. Sus notas ajustan el valor de la venta en su fecha original.</p></aside>`;
  }
  function render(finanzas, business, period = 'MES_ACTUAL') {
    const root = document.querySelector?.('[data-business-report]');
    if (!root) return;
    if (!business) { root.innerHTML = '<div class="br-empty">Crea o selecciona un negocio para ver tus informes.</div>'; return; }
    const selected = root.dataset.reportPeriod || period;
    const model = window.BusinessReportsDomain.build(finanzas.state, business.id, { period: selected });
    root.dataset.reportPeriod = selected; root.dataset.businessId = business.id; root.innerHTML = markup(model);
  }
  function csv(model) {
    const rows = [['INFORME DE MI NEGOCIO', model.business.name], ['Período', model.range.label], ['Desde', model.range.from], ['Hasta', model.range.to], ['Moneda', 'COP'], [], ['Estado de resultados', 'Valor COP'], ['Ventas netas', model.totals.sales], ['Otros ingresos', model.totals.otherIncome], ['Ingresos totales', model.totals.income], ['Costo de ventas', model.totals.cogs], ['Resultado bruto', model.totals.grossProfit], ['Gastos operativos y nómina', model.totals.operatingExpenses], ['Utilidad neta', model.totals.netProfit], ['Margen neto %', model.totals.margin], ['Ventas del período', model.totals.salesCount], ['Ticket promedio', model.totals.ticket], ['Cuentas por cobrar actuales (todos los períodos)', model.receivables], [], ['Rubro', 'Total COP', 'Participación %'], ...model.categories.map(c => [c.name, c.amount, c.percentage]), [], ['Mes', 'Ingresos COP', 'Costos y gastos COP', 'Utilidad neta COP'], ...model.monthly.map(m => [m.key, m.income, m.expenses, m.netProfit])];
    const escape = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(?:\.\d+)?$/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
    return rows.map(row => row.map(escape).join(';')).join('\r\n');
  }
  function printDocument(model, cssText = '') {
    const stylesheet = cssText ? `<style>${cssText}</style>` : `<link rel="stylesheet" href="${E(new URL('styles/businessReports.css?v=20261109-2', window.location.href).href)}">`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de ${E(model.business.name)} - ${E(model.range.label)}</title>${stylesheet}</head><body class="br-print-page"><main class="business-reports">${markup(model, true)}</main></body></html>`;
  }
  function init() {
    document.addEventListener('change', event => {
      if (!event.target.matches('[data-report-period]')) return;
      const root = event.target.closest('[data-business-report]'); root.dataset.reportPeriod = event.target.value;
      render(window.Finanzas, window.Finanzas.getNegocioActivo(), event.target.value); root.querySelector('[data-report-period]').focus();
    });
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-report-action]'); if (!button) return;
      const root = button.closest('[data-business-report]'), feedback = root.querySelector('.br-feedback');
      try {
        const model = window.BusinessReportsDomain.build(window.Finanzas.state, window.Finanzas.state.negocioActivoId, { period: root.dataset.reportPeriod });
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
      } catch (e) { feedback.textContent = e.message; }
    });
    render(window.Finanzas, window.Finanzas?.getNegocioActivo());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.BusinessReportsView = { render, csv, printDocument, markup, money };
})();
