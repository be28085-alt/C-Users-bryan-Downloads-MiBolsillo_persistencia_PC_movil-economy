/**
 * ============================================================================
 * PERSONAL REPORTS VIEW
 * Responsabilidad: Renderizado de la vista de informes, comparativas y desglose.
 * ============================================================================
 */
(function () {
  'use strict';

  const reportsView = {
    render(finanzas) {
      if (!finanzas) return;
      const movs = finanzas.getMovimientos(finanzas.state.periodoAnio, finanzas.state.periodoMes);
      const metricas = finanzas.calcularMetricasMes(finanzas.state.periodoAnio, finanzas.state.periodoMes);

      const elIngresos = document.getElementById('repTotalIngresos') || document.getElementById('infKpiIngresos');
      const elGastos = document.getElementById('repTotalGastos') || document.getElementById('infKpiGastos');
      const elBalance = document.getElementById('repBalanceNeto') || document.getElementById('infKpiBalanceNeto');
      const elTasaAhorro = document.getElementById('infKpiTasaAhorro');

      if (elIngresos) elIngresos.textContent = window.formatCOP(metricas.ingresos);
      if (elGastos) elGastos.textContent = window.formatCOP(metricas.gastos);
      if (elBalance) {
        elBalance.textContent = window.formatCOP(metricas.balance, true);
        elBalance.style.color = metricas.balance >= 0 ? '#059669' : '#e11d48';
      }
      if (elTasaAhorro) {
        const tasaAhorro = metricas.ingresos > 0 ? (metricas.balance / metricas.ingresos) * 100 : 0;
        elTasaAhorro.textContent = `Conservas el ${tasaAhorro.toFixed(1)} % de tus ingresos`;
      }

      const tbody = document.getElementById('tbodyInformesCategorias') || document.getElementById('tableCategoryBreakdown');
      if (!tbody) return;

      const sumCat = {};
      let totalGasto = 0;
      movs.forEach(m => {
        if (m.tipo === 'GASTO') {
          const c = m.categoria || 'Otros';
          const v = Number(m.valor) || 0;
          sumCat[c] = (sumCat[c] || 0) + v;
          totalGasto += v;
        }
      });

      const categorias = Object.keys(sumCat).sort((a, b) => sumCat[b] - sumCat[a]);
      if (categorias.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--pc-text-muted); padding: 1.5rem;">Sin gastos en este período.</td></tr>`;
        return;
      }

      tbody.innerHTML = categorias.map(cat => {
        const monto = sumCat[cat];
        const pct = totalGasto > 0 ? (monto / totalGasto) * 100 : 0;
        return `
          <tr>
            <td><strong>${window.escapeHTML(cat)}</strong></td>
            <td>${window.formatCOP(monto)}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                  <div style="width: ${pct}%; height: 100%; background: #0f766e;"></div>
                </div>
                <span style="font-size: 0.8rem; font-weight: 700;">${pct.toFixed(1)}%</span>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  };

  window.PersonalReportsView = reportsView;
})();
