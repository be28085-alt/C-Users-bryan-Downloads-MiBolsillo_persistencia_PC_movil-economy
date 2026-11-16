/**
 * ============================================================================
 * PERSONAL DASHBOARD VIEW
 * Responsabilidad: Renderizado de tarjetas KPI, alertas y widgets del dashboard personal.
 * ============================================================================
 */
(function () {
  'use strict';

  const dashboardView = {
    renderKPIs(finanzas, mesActualStr = '') {
      if (!finanzas) return;
      const isHidden = finanzas.state.saldoOculto;

      const elSaldoTotal = document.getElementById('kpiSaldoTotal');
      if (elSaldoTotal) {
        if (isHidden) {
          elSaldoTotal.textContent = '•••••••• COP';
          elSaldoTotal.classList.add('oculto');
        } else {
          elSaldoTotal.textContent = window.formatCOP(finanzas.getSaldoTotal());
          elSaldoTotal.classList.remove('oculto');
        }
      }

      const metricasMes = finanzas.calcularMetricasMes(finanzas.state.periodoAnio, finanzas.state.periodoMes);
      const elIngresos = document.getElementById('kpiIngresosMes') || document.getElementById('kpiIngresos');
      const elGastos = document.getElementById('kpiGastosMes') || document.getElementById('kpiGastos');

      if (elIngresos) {
        elIngresos.textContent = isHidden ? '••••••••' : window.formatCOP(metricasMes.ingresos);
      }
      if (elGastos) {
        elGastos.textContent = isHidden ? '••••••••' : window.formatCOP(metricasMes.gastos);
      }

      const estadoPresupuesto = finanzas.getPresupuesto(finanzas.state.periodoAnio, finanzas.state.periodoMes);
      const elPresupuestoRestante = document.getElementById('kpiPresupuestoRestante');
      const elPresupuestoBarra = document.getElementById('kpiPresupuestoBarra') || document.getElementById('barBudgetLarge');
      const elPresupuestoBadge = document.getElementById('kpiPresupuestoBadge') || document.getElementById('kpiPorcentajePresupuestoBadge');
      const lblBudgetSubtitle = document.getElementById('lblBudgetSubtitle');
      const lblBudgetPercentLarge = document.getElementById('lblBudgetPercentLarge');
      const lblBudgetAvailableText = document.getElementById('lblBudgetAvailableText');

      if (elPresupuestoRestante) {
        elPresupuestoRestante.textContent = isHidden
          ? '••••••••'
          : `${window.formatCOP(Math.max(estadoPresupuesto.restante, 0))} restantes`;
      }
      if (elPresupuestoBarra) {
        elPresupuestoBarra.style.width = `${Math.min(estadoPresupuesto.porcentaje, 100)}%`;
      }
      if (elPresupuestoBadge) {
        elPresupuestoBadge.textContent = `${estadoPresupuesto.porcentaje.toFixed(0)}%`;
      }
      if (lblBudgetSubtitle) {
        lblBudgetSubtitle.textContent = `${window.formatCOP(estadoPresupuesto.gastado)} / ${window.formatCOP(estadoPresupuesto.limite)} COP`;
      }
      if (lblBudgetPercentLarge) {
        lblBudgetPercentLarge.textContent = `${estadoPresupuesto.porcentaje.toFixed(0)} %`;
      }
      if (lblBudgetAvailableText) {
        lblBudgetAvailableText.textContent = isHidden
          ? 'Saldo oculto por privacidad.'
          : `Te quedan ${window.formatCOP(Math.max(estadoPresupuesto.restante, 0))} disponibles para este mes.`;
      }

      const lblMonth = document.getElementById('lblDashboardMonth');
      if (lblMonth && window.FinanzasDates) {
        const nombreMes = window.FinanzasDates.obtenerMesLargo(finanzas.state.periodoMes);
        lblMonth.textContent = `${nombreMes} de ${finanzas.state.periodoAnio}`;
      }
    },

    renderDashboardAlerts(finanzas) {
      const container = document.getElementById('pcDashboardAlerts');
      if (!container || !finanzas) return;
      const alertas = finanzas.evaluarAlertas();

      if (alertas.length === 0) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = alertas.map(a => `
        <div class="alert-notice-box ${a.tipo}" style="margin-bottom: 0.75rem;">
          <span style="font-size: 1.25rem;">${a.icono}</span>
          <div>
            <strong>${window.escapeHTML(a.titulo)}</strong>
            <p>${window.escapeHTML(a.mensaje)}</p>
          </div>
        </div>
      `).join('');
    },

    renderDashboardMovements(finanzas) {
      const container = document.getElementById('tableRecentMovements') || document.getElementById('pcDashboardRecentMovements');
      if (!container || !finanzas) return;
      const movs = finanzas.getMovimientos(finanzas.state.periodoAnio, finanzas.state.periodoMes).slice(0, 5);

      if (movs.length === 0) {
        if (container.tagName === 'TBODY') {
          container.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay movimientos este mes.</td></tr>';
        } else {
          container.innerHTML = '<div style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay movimientos este mes.</div>';
        }
        return;
      }

      if (container.tagName === 'TBODY') {
        container.innerHTML = movs.map(m => `
          <tr>
            <td><strong>${window.escapeHTML(m.concepto)}</strong></td>
            <td>${window.escapeHTML(m.categoria)}</td>
            <td>${window.escapeHTML(m.fecha)}</td>
            <td>${window.escapeHTML(m.cuenta || 'Principal')}</td>
            <td class="${m.tipo === 'INGRESO' ? 'text-income' : 'text-expense'}" style="font-weight: 700;">
              ${m.tipo === 'INGRESO' ? '+' : '-'}${window.formatCOP(m.valor)}
            </td>
            <td>
              <span class="badge-stock ${m.tipo === 'INGRESO' ? 'badge-stock-ok' : 'badge-stock-low'}">${m.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'}</span>
            </td>
          </tr>
        `).join('');
      } else {
        container.innerHTML = movs.map(m => `
          <div class="movement-row-item">
            <div class="mov-icon-bubble ${m.tipo === 'INGRESO' ? 'income' : 'expense'}">
              ${m.tipo === 'INGRESO' ? '↙' : '↗'}
            </div>
            <div class="mov-meta-details">
              <strong>${window.escapeHTML(m.concepto)}</strong>
              <small>${window.escapeHTML(m.categoria)} · ${m.fecha}</small>
            </div>
            <div class="mov-value-col ${m.tipo === 'INGRESO' ? 'positive' : 'negative'}">
              ${m.tipo === 'INGRESO' ? '+' : '-'}${window.formatCOP(m.valor)}
            </div>
          </div>
        `).join('');
      }
    },

    renderDashboardMetas(finanzas) {
      const container = document.getElementById('dashboardMetasList') || document.getElementById('pcDashboardMetas');
      if (!container || !finanzas) return;
      const metas = finanzas.getMetas().slice(0, 3);

      if (metas.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--pc-text-muted); padding: 1.5rem;">No tienes metas de ahorro activas.</div>';
        return;
      }

      container.innerHTML = metas.map(meta => `
        <div class="meta-mini-card">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <strong>${meta.icono} ${window.escapeHTML(meta.nombre)}</strong>
            <span style="font-weight: 700; color: ${meta.color};">${meta.porcentaje.toFixed(0)}%</span>
          </div>
          <div class="meta-progress-bar-bg" style="height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
            <div style="width: ${meta.porcentaje}%; height: 100%; background: ${meta.color};"></div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 0.4rem; font-size: 0.8rem; color: var(--pc-text-muted);">
            <span>${window.formatCOP(meta.montoActual)}</span>
            <span>Meta: ${window.formatCOP(meta.montoObjetivo)}</span>
          </div>
        </div>
      `).join('');
    }
  };

  window.PersonalDashboardView = dashboardView;
  window.MiBolsilloViews = window.MiBolsilloViews || {};
  window.MiBolsilloViews.personalDashboard = dashboardView;
})();
