(function () {
  const router = {
    currentView: 'inicio',
    navigate(viewName) {
      this.currentView = viewName;
      return this.currentView;
    }
  };

  window.MiBolsilloApp = window.MiBolsilloApp || {};
  window.MiBolsilloApp.router = router;
})();
