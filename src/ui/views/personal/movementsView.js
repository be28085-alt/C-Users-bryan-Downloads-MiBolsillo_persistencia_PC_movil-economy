/**
 * ============================================================================
 * PERSONAL MOVEMENTS VIEW
 * Responsabilidad: Renderizado de la tabla completa de movimientos y filtros.
 * ============================================================================
 */
(function () {
  'use strict';

  const movementsView = {
    render(finanzas) {
      const tbody = document.getElementById('tbodyMovimientosCompleto');
      if (!tbody || !finanzas) return;

      const rawMovs = finanzas.getMovimientos();
      const filter = window.PersonalFilters;
      const movs = filter ? filter.aplicar(rawMovs) : rawMovs;

      if (movs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--pc-text-muted); padding: 2.5rem;">No se encontraron movimientos registrados.</td></tr>`;
        return;
      }

      tbody.innerHTML = movs.map(m => `
        <tr>
          <td><strong>${m.fecha}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="mov-icon-mini ${m.tipo === 'INGRESO' ? 'income' : 'expense'}">${m.tipo === 'INGRESO' ? '↙' : '↗'}</span>
              <span>${window.escapeHTML(m.concepto)}</span>
            </div>
          </td>
          <td><span class="badge-category">${window.escapeHTML(m.categoria)}</span></td>
          <td>${window.escapeHTML(m.cuenta || 'Principal')}</td>
          <td style="font-weight: 700;" class="${m.tipo === 'INGRESO' ? 'text-income' : 'text-expense'}">
            ${m.tipo === 'INGRESO' ? '+' : '-'}${window.formatCOP(m.valor)}
          </td>
          <td>
            <button class="btn-table-action" style="color: var(--pc-red);" onclick="pcApp.eliminarMovimiento('${m.id}')" title="Eliminar">🗑️</button>
          </td>
        </tr>
      `).join('');
    }
  };

  window.PersonalMovementsView = movementsView;
})();
