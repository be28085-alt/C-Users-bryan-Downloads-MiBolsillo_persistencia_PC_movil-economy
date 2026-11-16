(function () {
  const controllerBase = {
    bindDocumentAction(root, selector, callback) {
      if (!root || typeof root.addEventListener !== 'function') {
        return () => {};
      }

      const registryKey = `__miBolsilloActionRegistry_${selector}`;
      if (root[registryKey]) {
        return root[registryKey];
      }

      const listener = (event) => {
        const target = event.target && typeof event.target.closest === 'function'
          ? event.target.closest(selector)
          : null;

        if (!target) {
          return;
        }

        callback(event, target);
      };

      root.addEventListener('click', listener);
      root[registryKey] = () => {
        root.removeEventListener('click', listener);
        delete root[registryKey];
      };
      return root[registryKey];
    },

    subscribeToStore(callback) {
      if (typeof callback !== 'function') {
        return () => {};
      }

      if (window.Finanzas && typeof window.Finanzas.subscribe === 'function') {
        return window.Finanzas.subscribe(callback);
      }

      if (window.MiBolsilloStore && typeof window.MiBolsilloStore.subscribe === 'function') {
        return window.MiBolsilloStore.subscribe(callback);
      }

      return () => {};
    },

    setText(id, value) {
      const element = id && typeof id === 'string' ? document.getElementById(id) : id;
      if (!element) return;
      element.textContent = value ?? '';
    },

    applyDateDefaults(ids, fallbackDate) {
      const resolvedDate = fallbackDate || new Date().toISOString().split('T')[0];
      const list = Array.isArray(ids) ? ids : [ids];
      list.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = resolvedDate;
      });
    },

    commonActionMap: {
      'delete-movement': (context, button) => {
        if (context && typeof context.eliminarMovimiento === 'function') {
          context.eliminarMovimiento(button.dataset.recordId);
        }
      },
      'contribute-goal': (context, button) => {
        if (context && typeof context.openModalAportarMeta === 'function') {
          context.openModalAportarMeta(button.dataset.recordId, button.dataset.recordName);
        }
      },
      'delete-goal': (context, button) => {
        if (context && typeof context.eliminarMeta === 'function') {
          context.eliminarMeta(button.dataset.recordId);
        }
      },
      'pay-debt': (context, button) => {
        if (context && typeof context.openModalAbonarDeuda === 'function') {
          context.openModalAbonarDeuda(button.dataset.recordId, button.dataset.recordName);
        }
      },
      'delete-debt': (context, button) => {
        if (context && typeof context.eliminarDeuda === 'function') {
          context.eliminarDeuda(button.dataset.recordId);
        }
      },
      'select-category': (context, button) => {
        if (context && typeof context.selectCategory === 'function') {
          context.selectCategory(button.dataset.categoryId);
        }
      }
    },

    dispatchCommonAction(context, button) {
      if (!button || !button.dataset) return false;
      const actionName = button.dataset.pcAction || button.dataset.mobileAction;
      const action = this.commonActionMap[actionName];
      if (typeof action === 'function') {
        action(context, button);
        return true;
      }
      return false;
    }
  };

  window.MiBolsilloUiShared = controllerBase;
})();
