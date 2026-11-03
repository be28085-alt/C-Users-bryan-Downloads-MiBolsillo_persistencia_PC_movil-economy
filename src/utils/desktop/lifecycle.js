(function () {
  function createLifecycleController(owner) {
    const listeners = [];

    return {
      addListener(target, type, handler, options = false) {
        if (!target || typeof target.addEventListener !== 'function') return () => {};
        const bound = handler;
        target.addEventListener(type, bound, options);
        const unregister = () => target.removeEventListener(type, bound, options);
        listeners.push(unregister);
        return unregister;
      },

      registerClick(selector, handler) {
        const root = owner && owner.root ? owner.root : document;
        const listener = (event) => {
          const target = event.target && typeof event.target.closest === 'function'
            ? event.target.closest(selector)
            : null;
          if (!target) return;
          handler(event, target);
        };
        root.addEventListener('click', listener);
        listeners.push(() => root.removeEventListener('click', listener));
        return () => root.removeEventListener('click', listener);
      },

      destroy() {
        while (listeners.length) {
          const cleanup = listeners.pop();
          try {
            cleanup();
          } catch (error) {
            console.warn('Error al limpiar listeners del módulo desktop:', error);
          }
        }
      }
    };
  }

  window.DesktopModules = window.DesktopModules || {};
  window.DesktopModules.lifecycle = {
    createLifecycleController,
    createAppGuard(appName) {
      const guard = { initialized: false, instanceName: appName || 'desktop' };
      return {
        ensureInitialized() {
          if (guard.initialized) return true;
          guard.initialized = true;
          return false;
        },
        reset() {
          guard.initialized = false;
        }
      };
    }
  };
})();
