/**
 * ============================================================================
 * PERSONAL DEBTS VIEW
 * Responsabilidad: Renderizado de deudas, obligaciones financieras y abonos.
 * ============================================================================
 */
(function () {
  'use strict';

  const debtsView = {
    render(finanzas) {
      if (!finanzas) return;
      const { totalDeuda, cuotaMensualTotal, deudasEnriquecidas } = finanzas.getDeudas();

      const elTotal = document.getElementById('lblDeudasTotalPendiente') || document.getElementById('deudasKpiPendiente');
      const elCuota = document.getElementById('lblDeudasCuotaMensual') || document.getElementById('deudasKpiCuotas');
      const elCount = document.getElementById('lblDeudasActivasCount');

      if (elTotal) elTotal.textContent = window.formatCOP(totalDeuda);
      if (elCuota) elCuota.textContent = window.formatCOP(cuotaMensualTotal);
      if (elCount) elCount.textContent = `${deudasEnriquecidas.filter(d => !d.saldada).length} activas`;

      const container = document.getElementById('deudasCardsGrid');
      const tbody = document.getElementById('tbodyDeudasCompleto') || document.getElementById('tableAbonosDeudas');

      if (container) {
        if (deudasEnriquecidas.length === 0) {
          container.innerHTML = '<div style="text-align: center; color: var(--pc-text-muted); padding: 2.5rem;">No tienes deudas registradas. ¡Felicitaciones!</div>';
        } else {
          container.innerHTML = deudasEnriquecidas.map(d => `
            <div class="pc-card debt-card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <strong>${window.escapeHTML(d.concepto)}</strong>
                <span class="badge-stock ${d.saldada ? 'badge-stock-ok' : 'badge-stock-low'}">${d.saldada ? 'SALDADA' : 'ACTIVA'}</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--pc-text-muted); margin-bottom: 0.5rem;">Acreedor: ${window.escapeHTML(d.acreedor)}</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
                <span>Saldo</span>
                <strong style="color: ${d.saldada ? 'var(--pc-teal-primary)' : 'var(--pc-red)'};">${window.formatCOP(d.saldo)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
                <span>Cuota</span>
                <strong>${window.formatCOP(d.cuotaMensual)}</strong>
              </div>
              ${!d.saldada ? `<button class="btn-pc-secondary" style="font-size: 0.78rem; width: 100%;" onclick="pcApp.openModalPagarDeuda('${d.id}')">Abonar</button>` : ''}
            </div>
          `).join('');
        }
      }

      if (tbody && tbody.tagName === 'TBODY') {
        if (deudasEnriquecidas.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--pc-text-muted); padding: 2.5rem;">No tienes deudas registradas. ¡Felicitaciones!</td></tr>`;
          return;
        }

        tbody.innerHTML = deudasEnriquecidas.map(d => `
          <tr>
            <td><strong>${window.escapeHTML(d.concepto)}</strong></td>
            <td>${window.escapeHTML(d.acreedor)}</td>
            <td>${window.formatCOP(d.montoInicial)}</td>
            <td style="font-weight: 700; color: ${d.saldada ? 'var(--pc-teal-primary)' : 'var(--pc-red)'};">${window.formatCOP(d.saldo)}</td>
            <td>${window.formatCOP(d.cuotaMensual)}</td>
            <td><span class="badge-stock ${d.saldada ? 'badge-stock-ok' : 'badge-stock-low'}">${d.saldada ? 'SALDADA' : 'ACTIVA'}</span></td>
            <td>
              ${!d.saldada ? `<button class="btn-pc-secondary" style="font-size: 0.78rem;" onclick="pcApp.openModalPagarDeuda('${d.id}')">Abonar</button>` : ''}
              <button class="btn-table-action" style="color: var(--pc-red); margin-left: 4px;" onclick="pcApp.eliminarDeuda('${d.id}')">🗑️</button>
            </td>
          </tr>
        `).join('');
      }
    }
  };

  window.PersonalDebtsView = debtsView;
})();
