/**
 * ============================================================================
 * BUSINESS DASHBOARD VIEW
 * Responsabilidad: Renderizado del Dashboard Empresarial ("Tu negocio, de un vistazo"),
 * fila de 4 KPIs (1ra card teal #0f3b3e), alertas de stock y últimas ventas.
 * ============================================================================
 */
(function () {
  'use strict';

  const businessDashboardView = {
    render(finanzas, negActivo, metricas) {
      if (!finanzas || !negActivo) return;

      // 1. Selector global de negocios
      this.renderBusinessSelectors(finanzas, negActivo);

      // 2. KPIs Principales
      const elVentas = document.getElementById('bizKpiVentas');
      const elVentasCount = document.getElementById('bizKpiVentasCount');
      const elCosto = document.getElementById('bizKpiCostoVentas');
      const elGastos = document.getElementById('bizKpiGastosOperativos');
      const elUtilidad = document.getElementById('bizKpiUtilidadNeta');
      const elMargen = document.getElementById('bizKpiMargenNeto');
      const elCobrar = document.getElementById('bizKpiCuentasCobrar');
      const elInventario = document.getElementById('bizKpiValorInventario');
      const elAlertasStock = document.getElementById('bizKpiAlertasStock');

      if (elVentas) elVentas.textContent = window.formatCOP(metricas.ventasTotales);
      if (elVentasCount) elVentasCount.textContent = `${metricas.cantidadVentas} facturas emitidas`;
      if (elCosto) elCosto.textContent = window.formatCOP(metricas.costoProductosVendidos);
      if (elGastos) elGastos.textContent = window.formatCOP(metricas.gastosOperativos);
      if (elUtilidad) elUtilidad.textContent = window.formatCOP(metricas.utilidadNeta);
      if (elMargen) elMargen.textContent = `Margen: ${metricas.margenNetoPct.toFixed(1)}% · COGS: $ ${(metricas.costoProductosVendidos / 1000000).toFixed(1)}M`;
      if (elCobrar) elCobrar.textContent = window.formatCOP(metricas.cuentasPorCobrar);
      if (elInventario) elInventario.textContent = window.formatCOP(metricas.valorInventario);
      if (elAlertasStock) elAlertasStock.textContent = `${metricas.productosAlerta} en alerta`;

      // 3. Tabla de últimas ventas
      const tbodyVentas = document.getElementById('bizTbodyDashboardVentas');
      if (tbodyVentas) {
        const ventas = finanzas.getVentas(negActivo.id).slice(0, 5);
        if (ventas.length === 0) {
          tbodyVentas.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--pc-text-muted); padding: 1.5rem;">No se han registrado ventas aún.</td></tr>`;
        } else {
          tbodyVentas.innerHTML = ventas.map(v => `
            <tr>
              <td><strong>#${v.id.substring(v.id.length - 6)}</strong></td>
              <td>${window.escapeHTML(v.clienteNombre)}</td>
              <td>${v.fecha}</td>
              <td><span class="biz-status-pill ${v.tipoPago === 'CREDITO' ? 'warning' : 'success'}"><span class="dot"></span> ${v.tipoPago}</span></td>
              <td><strong>${window.formatCOP(v.total)}</strong></td>
              <td><span class="biz-status-pill ${v.estado === 'PAGADA' ? 'success' : 'warning'}"><span class="dot"></span> ${v.estado === 'PAGADA' ? 'Cobrada' : 'Pendiente'}</span></td>
            </tr>
          `).join('');
        }
      }

      // 4. Alertas de stock bajo en dashboard
      const containerAlertas = document.getElementById('bizContainerAlertasStock');
      if (containerAlertas) {
        const bajas = finanzas.getAlertasStockBajo(negActivo.id);
        if (bajas.length === 0) {
          containerAlertas.innerHTML = `
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: var(--radius-sm); padding: 0.75rem 1rem; color: #065f46; font-size: 0.85rem;">
              ✓ Todo el inventario se encuentra por encima del stock mínimo de seguridad.
            </div>
          `;
        } else {
          containerAlertas.innerHTML = bajas.map(b => `
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-sm); padding: 0.6rem 0.85rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;">
              <div>
                <strong>⚠️ ${window.escapeHTML(b.nombre)}</strong>
                <span style="color: var(--pc-text-muted); margin-left: 6px;">(${b.tipo === 'MATERIA_PRIMA' ? 'Materia Prima' : 'Producto'})</span>
              </div>
              <div>
                <span class="biz-status-pill warning"><span class="dot"></span> Stock: ${b.stock} / Mín: ${b.stockMinimo} ${b.unidadMedida}</span>
              </div>
            </div>
          `).join('');
        }
      }

      // 5. Gráfico de barras Ventas vs COGS
      if (window.BusinessCharts && typeof window.BusinessCharts.renderVentasCostoChart === 'function') {
        window.BusinessCharts.renderVentasCostoChart();
      }
    },

    renderBusinessSelectors(finanzas, negActivo) {
      const negocios = finanzas.getNegocios();
      document.querySelectorAll('.sel-biz-global').forEach(sel => {
        sel.innerHTML = negocios.map(n =>
          `<option value="${n.id}" ${negActivo && negActivo.id === n.id ? 'selected' : ''}>${window.escapeHTML(n.nombre)} (${window.escapeHTML(n.tipo)})</option>`
        ).join('');
      });
    }
  };

  window.BusinessDashboardView = businessDashboardView;
})();
