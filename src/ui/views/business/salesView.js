/**
 * ============================================================================
 * BUSINESS SALES VIEW
 * Responsabilidad: Historial de facturación de ventas, cobranzas y ventas a crédito.
 * ============================================================================
 */
(function () {
  'use strict';

  const salesView = {
    render(finanzas, negActivo) {
      if (!finanzas || !negActivo) return;

      const ventas = finanzas.getVentas(negActivo.id);
      const filter = window.BusinessFilters;
      const filtradas = filter ? filter.filtrarVentas(ventas) : ventas;

      const tbody = document.getElementById('bizTbodyVentas');
      if (!tbody) return;

      if (filtradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No se encontraron ventas para el filtro seleccionado.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtradas.map(v => {
        const esCredito = v.tipoPago === 'CREDITO';
        const tieneSaldo = (Number(v.saldoPendiente) || 0) > 0;

        return `
          <tr>
            <td><strong>#${v.id.substring(v.id.length - 6)}</strong></td>
            <td><strong>${window.escapeHTML(v.clienteNombre)}</strong></td>
            <td>${v.fecha}</td>
            <td><span class="badge-stock ${esCredito ? 'badge-stock-low' : 'badge-stock-ok'}">${v.tipoPago}</span></td>
            <td><strong>${window.formatCOP(v.total)}</strong></td>
            <td style="font-weight: 700; color: ${tieneSaldo ? '#d97706' : '#059669'};">${window.formatCOP(v.saldoPendiente || 0)}</td>
            <td><span class="biz-status-pill ${tieneSaldo ? 'warning' : 'success'}"><span class="dot"></span> ${tieneSaldo ? 'Pendiente' : 'Cobrada'}</span></td>
            <td>
              ${tieneSaldo ? `<button class="btn-pc-secondary" style="font-size: 0.78rem;" onclick="pcApp.openModalAbonoCliente('${v.id}', '${v.clienteId || ''}')">Abonar</button>` : ''}
            </td>
          </tr>
        `;
      }).join('');
    }
  };

  window.BusinessSalesView = salesView;
})();
