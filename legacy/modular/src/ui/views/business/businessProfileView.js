/**
 * ============================================================================
 * BUSINESS PROFILE VIEW
 * Responsabilidad: Vista de "Mi Negocio", configuración y conmutación entre empresas.
 * ============================================================================
 */
(function () {
  'use strict';

  const businessProfileView = {
    render(finanzas, negActivo) {
      if (!finanzas || !negActivo) return;

      const elNom = document.getElementById('inputBizNombre');
      const elTipo = document.getElementById('inputBizTipo');
      const elDesc = document.getElementById('inputBizDescripcion');
      const elTel = document.getElementById('inputBizTelefono');
      const elMail = document.getElementById('inputBizEmail');
      const elDir = document.getElementById('inputBizDireccion');

      if (elNom) elNom.value = negActivo.nombre || '';
      if (elTipo) elTipo.value = negActivo.tipo || '';
      if (elDesc) elDesc.value = negActivo.descripcion || '';
      if (elTel) elTel.value = negActivo.telefono || '';
      if (elMail) elMail.value = negActivo.email || '';
      if (elDir) elDir.value = negActivo.direccion || '';

      // Lista de negocios registrados
      const container = document.getElementById('bizContainerListaNegocios');
      if (container) {
        const list = finanzas.getNegocios();
        container.innerHTML = list.map(n => `
          <div style="border: 2px solid ${n.id === negActivo.id ? 'var(--pc-teal-primary)' : 'var(--pc-border)'}; background: ${n.id === negActivo.id ? 'var(--pc-teal-subtle)' : '#ffffff'}; border-radius: var(--radius-md); padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <strong style="font-size: 1.05rem;">${window.escapeHTML(n.nombre)}</strong>
                ${n.id === negActivo.id ? '<span class="biz-status-pill success"><span class="dot"></span> Activo ahora</span>' : ''}
              </div>
              <p style="font-size: 0.82rem; color: var(--pc-text-muted); margin: 4px 0 0 0;">${window.escapeHTML(n.tipo)} · ${window.escapeHTML(n.direccion || 'Sin dirección')}</p>
            </div>
            <div>
              ${n.id !== negActivo.id ? `<button class="btn-pc-secondary" style="font-size: 0.78rem;" onclick="pcApp.cambiarNegocioActivo('${n.id}')">Seleccionar</button>` : ''}
              ${list.length > 1 ? `<button class="btn-pc-secondary" style="font-size: 0.78rem; color: var(--pc-red); border-color: #fecdd3; margin-left: 4px;" onclick="pcApp.eliminarNegocio('${n.id}')">🗑️</button>` : ''}
            </div>
          </div>
        `).join('');
      }
    }
  };

  window.BusinessProfileView = businessProfileView;
})();
