(function () {
  function createDashboardComponent(app) {
    const security = window.DesktopModules && window.DesktopModules.security;

    return {
      renderUserMeta() {
        if (!app || !app.ui) return;
        const u = Finanzas.state.usuario;
        const nameEl = document.getElementById('lblDashboardUser');
        if (nameEl) {
          security && security.setText ? security.setText(nameEl, (u.nombre || 'Usuario').split(' ')[0]) : (nameEl.textContent = (u.nombre || 'Usuario').split(' ')[0]);
        }
      },

      renderDashboardAlerts() {
        const container = document.getElementById('pcDashboardAlerts');
        if (!container) return;
        const alertas = Finanzas.evaluarAlertas();
        container.innerHTML = '';
        alertas.forEach((alerta) => {
          const card = document.createElement('div');
          card.className = `alert-notice-box ${security ? security.safeTemplate(alerta.tipo) : alerta.tipo}`;
          const icon = document.createElement('span');
          icon.style.fontSize = '1.25rem';
          icon.textContent = alerta.icono || '•';
          const content = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = alerta.titulo || '';
          const message = document.createElement('p');
          message.textContent = alerta.mensaje || '';
          content.appendChild(title); content.appendChild(message);
          card.appendChild(icon); card.appendChild(content);
          container.appendChild(card);
        });
      }
    };
  }

  window.DesktopModules = window.DesktopModules || {};
  window.DesktopModules.dashboard = createDashboardComponent;
})();
