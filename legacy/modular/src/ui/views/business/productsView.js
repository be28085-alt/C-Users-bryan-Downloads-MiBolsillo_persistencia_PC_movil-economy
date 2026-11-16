/**
 * ============================================================================
 * BUSINESS PRODUCTS VIEW
 * Responsabilidad: Catálogo de productos terminados, materias primas, costos y márgenes.
 * ============================================================================
 */
(function () {
  'use strict';

  const productsView = {
    render(finanzas, negActivo) {
      if (!finanzas || !negActivo) return;

      // 1. Productos terminados
      const tbodyProd = document.getElementById('bizTbodyProductos');
      if (tbodyProd) {
        const prods = finanzas.getProductos(negActivo.id, 'PRODUCTO');
        const countEl = document.getElementById('bizCountProductos');
        if (countEl) countEl.textContent = `${prods.length} productos`;

        if (prods.length === 0) {
          tbodyProd.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay productos terminados registrados.</td></tr>`;
        } else {
          tbodyProd.innerHTML = prods.map(p => {
            const margen = (p.precioVenta || 0) - (p.costoUnitario || 0);
            const pct = p.precioVenta > 0 ? (margen / p.precioVenta) * 100 : 0;
            return `
              <tr>
                <td><strong>${window.escapeHTML(p.nombre)}</strong></td>
                <td>${window.escapeHTML(p.unidadMedida)}</td>
                <td><strong>${window.formatCOP(p.precioVenta)}</strong></td>
                <td>${window.formatCOP(p.costoUnitario)}</td>
                <td><span style="font-weight: 700; color: #059669;">${pct.toFixed(1)}% ($${margen.toLocaleString('es-CO')})</span></td>
                <td><strong>${p.stock}</strong></td>
                <td><span class="biz-status-pill ${p.stock <= p.stockMinimo ? 'warning' : 'success'}"><span class="dot"></span> ${p.stock <= p.stockMinimo ? 'Stock bajo' : 'En stock'}</span></td>
                <td>
                  <button class="btn-table-action" style="color: var(--pc-red);" onclick="pcApp.eliminarProducto('${p.id}')">🗑️</button>
                </td>
              </tr>
            `;
          }).join('');
        }
      }

      // 2. Materias primas
      const tbodyMat = document.getElementById('bizTbodyMaterias');
      if (tbodyMat) {
        const mats = finanzas.getProductos(negActivo.id, 'MATERIA_PRIMA');
        const countMat = document.getElementById('bizCountMaterias');
        if (countMat) countMat.textContent = `${mats.length} insumos`;

        if (mats.length === 0) {
          tbodyMat.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay materias primas registradas.</td></tr>`;
        } else {
          tbodyMat.innerHTML = mats.map(m => `
            <tr>
              <td><strong>${window.escapeHTML(m.nombre)}</strong></td>
              <td>${window.escapeHTML(m.unidadMedida)}</td>
              <td>${window.formatCOP(m.costoUnitario || m.precioCompra)}</td>
              <td><strong>${m.stock}</strong></td>
              <td>${m.stockMinimo}</td>
              <td><span class="biz-status-pill ${m.stock <= m.stockMinimo ? 'danger' : 'success'}"><span class="dot"></span> ${m.stock <= m.stockMinimo ? 'Crítico' : 'Disponible'}</span></td>
              <td>
                <button class="btn-table-action" style="color: var(--pc-red);" onclick="pcApp.eliminarProducto('${m.id}')">🗑️</button>
              </td>
            </tr>
          `).join('');
        }
      }
    }
  };

  window.BusinessProductsView = productsView;
})();
