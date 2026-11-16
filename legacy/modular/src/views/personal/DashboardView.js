(function () {
  'use strict';

  const DashboardView = window.PersonalDashboardView || {
    render() {
      if (window.PersonalDashboardView && typeof window.PersonalDashboardView.renderKPIs === 'function') {
        return window.PersonalDashboardView;
      }
    }
  };

  window.MiBolsilloViews = window.MiBolsilloViews || {};
  window.MiBolsilloViews.personalDashboard = DashboardView;
})();
