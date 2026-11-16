/**
 * ============================================================================
 * BUSINESS CREDITS VIEW
 * Responsabilidad: Cartera de clientes a crédito, saldos pendientes e historial de abonos.
 * ============================================================================
 */
(function () {
  'use strict';

  const creditsView = {
    render(finanzas, negActivo) {
      if (!finanzas || !negActivo) return;

      const ventasCredito = finanzas.getVentasCredito(negActivo.id);
      const conSaldo = ventasCredito.filter(v => (Number(v.saldoPendiente) || 0) > 0);
      const totalPendiente = conSaldo.reduce((sum, v) => sum + (Number(v.saldoPendiente) || 0), 0);
      const pagos = finanzas.getPagosVenta(negActivo.id);
      const totalRecaudado = pagos.reduce((sum, p) => sum + (Number(p.monto) || 0), 0);

      const elTot = document.getElementById('bizKpiCreditosTotalPendiente');
      const elCount = document.getElementById('bizKpiCreditosClientesCount');
      const elAbonos = document.getElementById('bizKpiCreditosAbonosRecaudados');

      if (elTot) elTot.textContent = window.formatCOP(totalPendiente);
      if (elCount) elCount.textContent = `${conSaldo.length}`;
      if (elAbonos) elAbonos.textContent = window.formatCOP(totalRecaudado);

      // Tabla de facturas pendientes
      const tbody = document.getElementById('bizTbodyCreditosPendientes');
      if (tbody) {
        if (conSaldo.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay cuentas por cobrar pendientes. Toda la cartera está al día.</td></tr>`;
        } else {
          tbody.innerHTML = conSaldo.map(v => `
            <tr>
              <td><strong>#${v.id.substring(v.id.length - 6)}</strong></td>
              <td><strong>${window.escapeHTML(v.clienteNombre)}</strong></td>
              <td>${v.fecha}</td>
              <td>${window.formatCOP(v.total)}</td>
              <td style="font-weight: 700; color: #d97706;">${window.formatCOP(v.saldoPendiente)}</td>
              <td><span class="biz-status-pill warning"><span class="dot"></span> Pendiente</span></td>
              <td>
                <button class="btn-pc-secondary" style="font-size: 0.78rem;" onclick="pcApp.openModalAbonoCliente('${v.id}', '${v.clienteId || ''}')">Abonar</button>
              </td>
            </tr>
          `).join('');
        }
      }

      // Tabla de abonos recibidos
      const tbodyAbonos = document.getElementById('bizTbodyAbonosHistorial');
      if (tbodyAbonos) {
        if (pagos.length === 0) {
          tbodyAbonos.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--pc-text-muted); padding: 1.5rem;">Sin abonos registrados aún.</td></tr>`;
        } else {
          tbodyAbonos.innerHTML = pagos.map(p => `
            <tr>
              <td><strong>${p.fecha}</strong></td>
              <td>#${(p.ventaId || '').substring((p.ventaId || '').length - 6)}</td>
              <td>${window.escapeHTML(p.clienteNombre)}</td>
              <td style="font-weight: 700; color: #059669;">+${window.formatCOP(p.monto)}</td>
              <td>${window.escapeHTML(p.metodoPago)}</td>
              <td><small>${window.escapeHTML(p.notas || 'Sin observaciones')}</small></td>
            </tr>
          `).join('');
        }
      }
    }
  };

  window.BusinessCreditsView = creditsView;
})();
