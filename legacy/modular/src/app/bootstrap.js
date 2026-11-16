(function () {
  'use strict';

  const root = window.MiBolsilloApp = window.MiBolsilloApp || {};
  if (root.__bootstrapped) {
    return;
  }

  root.__bootstrapped = true;
  root.ready = false;
  root.initializedAt = null;
  root._bootSequence = 0;

  function ensureFinanzas() {
    if (!window.Finanzas && window.FinanzasCore) {
      window.Finanzas = new window.FinanzasCore();
    }
    return window.Finanzas || null;
  }

  function ensureAppInstances() {
    if (window.DesktopApp && !window.pcApp) {
      window.pcApp = new window.DesktopApp();
    }
    if (window.MobileApp && !window.mobileApp) {
      window.mobileApp = new window.MobileApp();
    }
    if (window.pcApp && !root.pcApp) {
      root.pcApp = window.pcApp;
    }
    if (window.mobileApp && !root.mobileApp) {
      root.mobileApp = window.mobileApp;
    }
    return root;
  }

  function shouldInitDesktop() {
    if (!document || !document.body) return false;
    const body = document.body;
    return body.id === 'desktop-app' || body.dataset.app === 'desktop' || /desktop\.html$/i.test(window.location.pathname);
  }

  function shouldInitMobile() {
    if (!document || !document.body) return false;
    const body = document.body;
    return body.dataset.app === 'mobile' || /mobile\.html$/i.test(window.location.pathname);
  }

  function init() {
    root._bootSequence += 1;
    const finanzas = ensureFinanzas();
    ensureAppInstances();

    if (window.pcApp && typeof window.pcApp.init === 'function' && shouldInitDesktop()) {
      if (!window.pcApp.initialized) {
        window.pcApp.init();
      }
    }

    if (window.mobileApp && typeof window.mobileApp.init === 'function' && shouldInitMobile()) {
      if (!window.mobileApp.initialized) {
        window.mobileApp.init();
      }
    }

    root.ready = true;
    root.initializedAt = new Date().toISOString();
    root.finanzas = finanzas;
    root.desktop = window.pcApp || null;
    root.mobile = window.mobileApp || null;
    return root;
  }

  root.ensureFinanzas = ensureFinanzas;
  root.ensureAppInstances = ensureAppInstances;
  root.init = init;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }
})();
