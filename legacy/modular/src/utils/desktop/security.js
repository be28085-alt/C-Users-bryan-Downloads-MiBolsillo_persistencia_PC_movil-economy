(function () {
  const security = {
    escapeHtml(value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    sanitizeText(value) {
      return this.escapeHtml(value);
    },

    setText(node, value) {
      if (!node) return;
      node.textContent = value ?? '';
    },

    createTextCell(value) {
      const el = document.createElement('td');
      el.textContent = value ?? '';
      return el;
    },

    buildSafeOption(value, label) {
      const option = document.createElement('option');
      option.value = value ?? '';
      option.textContent = label ?? value ?? '';
      return option;
    },

    safeTemplate(value) {
      return this.escapeHtml(value ?? '');
    }
  };

  window.DesktopModules = window.DesktopModules || {};
  window.DesktopModules.security = Object.assign(window.DesktopModules.security || {}, security);
})();
