/**
 * ============================================================================
 * BUSINESS SUPPLIERS VIEW
 * Responsabilidad: Directorio de proveedores, datos de contacto y cuentas por pagar.
 * ============================================================================
 */
(function () {
  'use strict';

  const suppliersView = {
    render(finanzas, negActivo) {
      if (!finanzas || !negActivo) return;

      const provs = finanzas.getProveedores(negActivo.id);
      const tbody = document.getElementById('bizTbodyProveedores');
      if (!tbody) return;

      if (provs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay proveedores registrados.</td></tr>`;
        return;
      }

      tbody.innerHTML = provs.map(p => `
        <tr>
          <td><strong>${window.escapeHTML(p.nombre)}</strong></td>
          <td>${window.escapeHTML(p.telefono || 'Sin teléfono')}</td>
          <td>${window.escapeHTML(p.email || 'Sin correo')}</td>
          <td>${window.escapeHTML(p.direccion || 'Sin dirección')}</td>
          <td>
            <button class="btn-table-action" style="color: var(--pc-red);" onclick="pcApp.eliminarProveedor('${p.id}')">🗑️</button>
          </td>
        </tr>
      `).join('');
    }
  };

  window.BusinessSuppliersView = suppliersView;
})();
