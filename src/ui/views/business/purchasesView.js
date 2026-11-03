/**
 * ============================================================================
 * BUSINESS PURCHASES VIEW
 * Responsabilidad: Historial de compras a proveedores y órdenes de abastecimiento.
 * ============================================================================
 */
(function () {
  'use strict';

  const purchasesView = {
    render(finanzas, negActivo) {
      if (!finanzas || !negActivo) return;

      const compras = finanzas.getCompras(negActivo.id);
      const filter = window.BusinessFilters;
      const filtradas = filter ? filter.filtrarCompras(compras) : compras;

      const tbody = document.getElementById('bizTbodyCompras');
      if (!tbody) return;

      if (filtradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No se encontraron órdenes de compra registradas.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtradas.map(c => {
        const cantItems = (c.detalles || []).reduce((acc, d) => acc + (Number(d.cantidad) || 0), 0);
        const tieneSaldo = (Number(c.saldoPendiente) || 0) > 0;

        return `
          <tr>
            <td><strong>#${c.id.substring(c.id.length - 6)}</strong></td>
            <td><strong>${window.escapeHTML(c.proveedorNombre)}</strong></td>
            <td>${c.fecha}</td>
            <td><strong>${window.formatCOP(c.total)}</strong></td>
            <td>${cantItems} uds (${(c.detalles || []).length} items)</td>
            <td><span class="biz-status-pill ${tieneSaldo ? 'warning' : 'success'}"><span class="dot"></span> ${tieneSaldo ? 'Por pagar' : 'Pagada'}</span></td>
            <td><small>${window.escapeHTML(c.observaciones || 'Sin notas')}</small></td>
          </tr>
        `;
      }).join('');
    }
  };

  window.BusinessPurchasesView = purchasesView;
})();
