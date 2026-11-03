/**
 * ============================================================================
 * PERSONAL PLAN & BUDGET VIEW
 * Responsabilidad: Renderizado del plan presupuestal y desglose por categorías.
 * ============================================================================
 */
(function () {
  'use strict';

  const planView = {
    render(finanzas) {
      if (!finanzas) return;
      const estado = finanzas.getPresupuesto(finanzas.state.periodoAnio, finanzas.state.periodoMes);
      const desglose = finanzas.getPresupuestoDesglose(finanzas.state.periodoAnio, finanzas.state.periodoMes);

      const elTotal = document.getElementById('lblPlanPresupuestoTotal') || document.getElementById('planKpiLimite');
      const elGastado = document.getElementById('lblPlanGastadoTotal') || document.getElementById('planKpiGastado');
      const elRestante = document.getElementById('lblPlanRestanteTotal') || document.getElementById('planKpiDisponible');
      const elPct = document.getElementById('lblPlanPorcentaje') || document.getElementById('planKpiPorcentaje') || document.getElementById('lblPlanGaugePercent');
      const elBarra = document.getElementById('barraPlanPresupuestoGlobal');

      if (elTotal) elTotal.textContent = window.formatCOP(estado.limite);
      if (elGastado) elGastado.textContent = window.formatCOP(estado.gastado);
      if (elRestante) elRestante.textContent = window.formatCOP(Math.max(estado.restante, 0));
      if (elPct) {
        const texto = typeof elPct.textContent === 'string' && elPct.textContent.includes('%')
          ? `${estado.porcentaje.toFixed(1)}%`
          : `${estado.porcentaje.toFixed(1)}%`;
        elPct.textContent = texto;
      }
      if (elBarra) elBarra.style.width = `${Math.min(estado.porcentaje, 100)}%`;

      const container = document.getElementById('gridPlanCategorias') || document.getElementById('planDetailedCategoriesList');
      if (!container) return;

      container.innerHTML = desglose.map(cat => `
        <div class="pc-card category-budget-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>${window.escapeHTML(cat.categoria)}</strong>
            <span style="font-weight: 700; color: ${cat.excedido ? 'var(--pc-red)' : 'var(--pc-text-dark)'};">${cat.porcentajeReal.toFixed(0)}%</span>
          </div>
          <div style="height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-bottom: 0.75rem;">
            <div style="width: ${cat.porcentaje}%; height: 100%; background: ${cat.excedido ? '#e11d48' : '#0f766e'};"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--pc-text-muted);">
            <span>Gastado: ${window.formatCOP(cat.gastado)}</span>
            <span>Límite: ${window.formatCOP(cat.limite)}</span>
          </div>
        </div>
      `).join('');
    }
  };

  window.PersonalPlanView = planView;
})();
