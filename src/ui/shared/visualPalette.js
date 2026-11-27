/** Lee la paleta CSS para gráficos canvas sin modificar datos ni preferencias. */
(function () {
  'use strict';
  const defaults = { primary: '#24576b', surface: '#ffffff', border: '#dde8ee',
    'chart-sales': '#39788d', 'chart-income': '#267b70', 'chart-expense': '#b4494c' };
  const categories = ['#24576b', '#4c8498', '#82acbc', '#aecbd6', '#d5e4ea', '#647f8e'];
  function color(name, fallback = defaults[name] || defaults.primary) {
    const value = typeof window.getComputedStyle === 'function' && document.documentElement
      ? window.getComputedStyle(document.documentElement).getPropertyValue('--app-' + name).trim() : '';
    return value || fallback;
  }
  window.FinanzasVisualPalette = { color, category: index => color('chart-' + (index % categories.length + 1), categories[index % categories.length]) };
})();
