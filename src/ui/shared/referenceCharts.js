/**
 * Decoración accesible de gráficos existentes. Añadir etiquetas o controles visuales no crea una fuente financiera ni cambia las series calculadas.
 */
/* A shared presentation palette; original datasets and calculations are kept. */
(function () {
  'use strict';
  if (typeof Chart === 'undefined' || typeof Chart.register !== 'function') return;
  const personalCharts = new Set([
    'chartDashboardPerspective',
    'chartInformesBars',
    'chartInformesDonut',
    'mobileChartPerspective',
    'mobileChartCategories',
  ]);
  const palette = ['#24576b', '#6d98ad', '#a0becd', '#c6dbe5', '#477f98', '#dce9ef'];
  Chart.register({
    id: 'mibolsilloReferenceTheme',
    beforeInit(chart) {
      if (!personalCharts.has(chart.canvas.id)) return;
      chart.data.datasets.forEach((dataset, index) => {
        if (chart.config.type === 'bar') {
          dataset.backgroundColor = index === 0 ? palette[0] : '#a9c6d3';
          dataset.borderRadius = 4;
          dataset.maxBarThickness = 32;
        } else if (chart.config.type === 'doughnut') {
          dataset.backgroundColor =
            chart.data.labels?.[0] === 'Sin gastos en el período' ? ['#dce9ef'] : palette;
        }
      });
      const legend = chart.options.plugins?.legend;
      if (legend) {
        legend.labels = {
          ...legend.labels,
          color: '#657f8e',
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: 'rectRounded',
          padding: 18,
        };
      }
    },
  });
})();
