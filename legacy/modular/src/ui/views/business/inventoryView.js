/**
 * ============================================================================
 * BUSINESS INVENTORY VIEW
 * Responsabilidad: Renderizado de existencias en bodega, alertas de stock y Kardex.
 * ============================================================================
 */
(function () {
  'use strict';

  const inventoryView = {
    render(finanzas, negActivo) {
      if (!finanzas || !negActivo) return;

      const prods = finanzas.getProductos(negActivo.id, 'ALL');
      const filter = window.BusinessFilters;
      const filtrados = filter ? filter.filtrarInventario(prods) : prods;

      // 1. Tabla de Existencias
      const tbodyStock = document.getElementById('bizTbodyInventarioStock');
      if (tbodyStock) {
        if (filtrados.length === 0) {
          tbodyStock.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No se encontraron artículos en inventario.</td></tr>`;
        } else {
          tbodyStock.innerHTML = filtrados.map(p => {
            const stock = Number(p.stock) || 0;
            const costo = Number(p.costoUnitario) || Number(p.precioCompra) || 0;
            const valorTotal = stock * costo;
            const esAlerta = stock <= Number(p.stockMinimo);

            return `
              <tr>
                <td><span class="badge-stock ${p.tipo === 'PRODUCTO' ? 'badge-pt' : 'badge-mp'}">${p.tipo === 'PRODUCTO' ? 'Terminado' : 'Insumo'}</span></td>
                <td><strong>${window.escapeHTML(p.nombre)}</strong></td>
                <td>${window.formatCOP(costo)}</td>
                <td><strong>${stock} ${p.unidadMedida}</strong></td>
                <td>${p.stockMinimo} ${p.unidadMedida}</td>
                <td><strong>${window.formatCOP(valorTotal)}</strong></td>
                <td><span class="biz-status-pill ${esAlerta ? 'warning' : 'success'}"><span class="dot"></span> ${esAlerta ? 'Stock bajo' : 'En stock'}</span></td>
              </tr>
            `;
          }).join('');
        }
      }

      // 2. Alertas de inventario
      const containerAlertas = document.getElementById('bizInventarioAlertasBox');
      if (containerAlertas) {
        const alertas = finanzas.getAlertasStockBajo(negActivo.id);
        if (alertas.length > 0) {
          containerAlertas.innerHTML = `
            <div class="biz-notice-banner warning">
              <span class="icon">⚠️</span>
              <div>
                <strong>Atención: ${alertas.length} artículos están por debajo del umbral mínimo de seguridad:</strong>
                <p style="margin: 4px 0 0 0;">${alertas.map(a => `${a.nombre} (${a.stock} ${a.unidadMedida})`).join(' · ')}</p>
              </div>
            </div>
          `;
        } else {
          containerAlertas.innerHTML = '';
        }
      }
    }
  };

  window.BusinessInventoryView = inventoryView;
})();
