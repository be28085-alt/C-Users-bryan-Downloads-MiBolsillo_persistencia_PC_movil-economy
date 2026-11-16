(function () {
  'use strict';

  function fallbackBootApp() {
    if (typeof window === 'undefined') return null;
    if (typeof document === 'undefined') return null;

    if (window.FinanzasCore && !window.Finanzas) {
      window.Finanzas = new window.FinanzasCore();
    }

    if (window.DesktopApp && !window.pcApp) {
      window.pcApp = new window.DesktopApp();
    }

    if (window.MobileApp && !window.mobileApp) {
      window.mobileApp = new window.MobileApp();
    }

    if (window.pcApp && typeof window.pcApp.init === 'function' && document.body &&
        (document.body.id === 'desktop-app' || document.body.dataset.app === 'desktop' || /desktop\.html$/i.test(window.location.pathname))) {
      if (!window.pcApp.initialized) {
        window.pcApp.init();
      }
    }

    if (window.mobileApp && typeof window.mobileApp.init === 'function' && document.body &&
        (document.body.dataset.app === 'mobile' || /mobile\.html$/i.test(window.location.pathname))) {
      if (!window.mobileApp.initialized) {
        window.mobileApp.init();
      }
    }

    return {
      finanzas: window.Finanzas,
      desktop: window.pcApp,
      mobile: window.mobileApp
    };
  }

  if (window.MiBolsilloApp && typeof window.MiBolsilloApp.init === 'function') {
    window.MiBolsilloApp.init();
    return;
  }

  if (window.__MiBolsilloAppBootstrapped) return;
  window.__MiBolsilloAppBootstrapped = true;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fallbackBootApp, { once: true });
    } else {
      fallbackBootApp();
    }
  }
})();
