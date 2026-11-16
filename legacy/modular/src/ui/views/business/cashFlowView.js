/**
 * ============================================================================
 * CASH FLOW VIEW
 * Responsabilidad: Vista de Caja y Flujo de Efectivo, cuentas disponibles y movimientos.
 * ============================================================================
 */
(function () {
  'use strict';

  const cashFlowView = {
    render(finanzas, negActivo) {
      if (!finanzas || !negActivo) return;

      const data = finanzas.getCajaYFlujo(negActivo.id);

      const elDisp = document.getElementById('bizCajaSaldoDisponible');
      const elEnt = document.getElementById('bizCajaTotalEntradas');
      const elSal = document.getElementById('bizCajaTotalSalidas');
      const elFlujo = document.getElementById('bizCajaFlujoNeto');

      if (elDisp) elDisp.textContent = window.formatCOP(data.saldoDisponible);
      if (elEnt) elEnt.textContent = window.formatCOP(data.totalEntradas);
      if (elSal) elSal.textContent = window.formatCOP(data.totalSalidas);
      if (elFlujo) {
        elFlujo.textContent = `${data.flujoNeto >= 0 ? '+' : ''}${window.formatCOP(data.flujoNeto)}`;
        elFlujo.style.color = data.flujoNeto >= 0 ? '#059669' : '#e11d48';
      }

      // Tabla de movimientos de caja
      const tbody = document.getElementById('bizTbodyCajaMovimientos');
      if (tbody) {
        tbody.innerHTML = (data.movimientosCaja || []).map(m => `
          <tr>
            <td><strong>${m.fecha}</strong></td>
            <td>${window.escapeHTML(m.cuenta)}</td>
            <td>${window.escapeHTML(m.concepto)}</td>
            <td><span class="biz-status-pill ${m.tipo === 'ENTRADA' ? 'success' : 'danger'}"><span class="dot"></span> ${m.tipo}</span></td>
            <td style="font-weight: 700; color: ${m.tipo === 'ENTRADA' ? '#059669' : '#e11d48'};">${m.tipo === 'ENTRADA' ? '+' : '-'}${window.formatCOP(m.monto)}</td>
            <td><strong>${window.formatCOP(m.saldoPosterior)}</strong></td>
          </tr>
        `).join('');
      }

      // Gráfico de caja
      if (window.BusinessCharts && typeof window.BusinessCharts.renderCajaFlujoChart === 'function') {
        window.BusinessCharts.renderCajaFlujoChart();
      }
    }
  };

  window.BusinessCashFlowView = cashFlowView;
})();
