/**
 * ============================================================================
 * PERSONAL GOALS VIEW
 * Responsabilidad: Renderizado de tarjetas de metas de ahorro y aportes.
 * ============================================================================
 */
(function () {
  'use strict';

  const goalsView = {
    render(finanzas) {
      const container = document.getElementById('gridMetasCompleto') || document.getElementById('metasCardsGrid');
      if (!container || !finanzas) return;
      const metas = finanzas.getMetas();

      const totalAhorrado = document.getElementById('metasKpiTotalAhorrado');
      const objetivoTotal = document.getElementById('metasKpiObjetivoTotal');
      const restante = document.getElementById('metasKpiRestante');

      const total = metas.reduce((sum, meta) => sum + Number(meta.montoActual || 0), 0);
      const metaObjetivo = metas.reduce((sum, meta) => sum + Number(meta.montoObjetivo || 0), 0);
      const restanteTotal = Math.max(metaObjetivo - total, 0);

      if (totalAhorrado) totalAhorrado.textContent = window.formatCOP(total);
      if (objetivoTotal) objetivoTotal.textContent = window.formatCOP(metaObjetivo);
      if (restante) restante.textContent = window.formatCOP(restanteTotal);

      if (metas.length === 0) {
        container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--pc-text-muted); padding: 3rem;">No tienes metas de ahorro registradas. Crea una para comenzar.</div>`;
        return;
      }

      container.innerHTML = metas.map(m => `
        <div class="pc-card goal-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div>
              <span style="font-size: 2rem;">${m.icono}</span>
              <h3 style="margin: 0.5rem 0 0.2rem 0; font-size: 1.15rem;">${window.escapeHTML(m.nombre)}</h3>
              <small style="color: var(--pc-text-muted);">${m.categoria} · Hasta: ${m.fechaLimite || 'Sin fecha'}</small>
            </div>
            <button class="btn-pc-secondary" style="font-size: 0.8rem;" onclick="pcApp.openModalAbonarMeta('${m.id}')">+ Aportar</button>
          </div>
          <div style="margin-bottom: 0.5rem;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 0.35rem;">
              <span>${window.formatCOP(m.montoActual)}</span>
              <span style="color: ${m.color};">${m.porcentajeReal.toFixed(0)}%</span>
            </div>
            <div style="height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
              <div style="width: ${m.porcentaje}%; height: 100%; background: ${m.color};"></div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--pc-text-muted); margin-top: 0.5rem;">
            <span>Faltan: ${window.formatCOP(m.restante)}</span>
            <span>Objetivo: ${window.formatCOP(m.montoObjetivo)}</span>
          </div>
        </div>
      `).join('');
    }
  };

  window.PersonalGoalsView = goalsView;
})();
