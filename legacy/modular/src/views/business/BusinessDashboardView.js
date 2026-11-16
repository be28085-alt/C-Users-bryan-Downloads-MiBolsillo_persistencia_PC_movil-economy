(function () {
  const BusinessDashboardView = {
    render(containerId, metrics) {
      const container = document.getElementById(containerId);
      if (!container) return;

      container.innerHTML = `
        <div class="biz-card-kpi featured-teal">
          <div class="kpi-label">Negocio</div>
          <div class="kpi-val">${metrics.negocioNombre || 'Sin negocio'}</div>
          <div class="kpi-sub"><span class="kpi-pill green">Activo</span></div>
        </div>
      `;
    }
  };

  window.MiBolsilloViews = window.MiBolsilloViews || {};
  window.MiBolsilloViews.businessDashboard = BusinessDashboardView;
})();
