(function () {
  window.DesktopModules = window.DesktopModules || {};

  window.DesktopModules.registry = {
    security: window.DesktopModules.security || {},
    lifecycle: window.DesktopModules.lifecycle || {},
    demoData: window.MiBolsilloDemoData || {
      enabled: true,
      modeLabel: 'Modo demostración activo'
    }
  };

  window.DesktopModules.getSecurity = function () {
    return window.DesktopModules.registry.security;
  };

  window.DesktopModules.getLifecycle = function () {
    return window.DesktopModules.registry.lifecycle;
  };
})();
