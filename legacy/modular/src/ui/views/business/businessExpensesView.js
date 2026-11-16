/**
 * ============================================================================
 * BUSINESS EXPENSES VIEW
 * Responsabilidad: Historial y clasificación de gastos operativos del negocio (Regla 7).
 * ============================================================================
 */
(function () {
  'use strict';

  const businessExpensesView = {
    render(finanzas, negActivo) {
      if (!finanzas || !negActivo) return;

      const gastos = finanzas.getGastosNegocio(negActivo.id);
      const tbody = document.getElementById('bizTbodyGastos');
      if (!tbody) return;

      if (gastos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay gastos operativos registrados en este negocio.</td></tr>`;
        return;
      }

      tbody.innerHTML = gastos.map(g => `
        <tr>
          <td><strong>${g.fecha}</strong></td>
          <td><span class="badge-stock badge-stock-low">${window.escapeHTML(g.categoria)}</span></td>
          <td>${window.escapeHTML(g.descripcion || 'Sin descripción')}</td>
          <td style="font-weight: 700; color: #e11d48;">-${window.formatCOP(g.monto)}</td>
          <td>
            <button class="btn-table-action" style="color: var(--pc-red);" onclick="pcApp.eliminarGastoNegocio('${g.id}')">🗑️</button>
          </td>
        </tr>
      `).join('');

      // Gráfico dona de gastos
      if (window.BusinessCharts && typeof window.BusinessCharts.renderGastosNegocioChart === 'function') {
        window.BusinessCharts.renderGastosNegocioChart(gastos);
      }
    }
  };

  window.BusinessExpensesView = businessExpensesView;
})();
