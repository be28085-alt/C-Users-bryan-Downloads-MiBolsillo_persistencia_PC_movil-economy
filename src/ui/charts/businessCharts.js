/**
 * ============================================================================
 * BUSINESS CHARTS
 * Responsabilidad: Gráficos de Gestión Empresarial (Ventas vs COGS, Flujo de Caja y Gastos).
 * ============================================================================
 */
(function () {
  'use strict';

  const businessCharts = {
    /**
     * Gráfico Ventas vs Costo de Ventas (COGS) en Dashboard Empresarial.
     */
    renderVentasCostoChart() {
      const service = window.FinanzasChartService;
      if (!service || typeof Chart === 'undefined') return;

      const ctx = service.getContext('bizChartVentasCosto');
      if (!ctx) return;

      service.destroyChart('bizVentasCosto');

      const meses = ['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'];
      const ventas = [18200000, 20500000, 21800000, 23400000, 22900000, 24800000];
      const cogs = [9100000, 10200000, 10800000, 11400000, 11100000, 12000000];

      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: meses,
          datasets: [
            {
              label: 'Ventas Totales',
              data: ventas,
              backgroundColor: '#0f3b3e', // Dark teal corporativo
              borderRadius: 6,
              barPercentage: 0.6,
              categoryPercentage: 0.7
            },
            {
              label: 'Costo de Ventas (COGS)',
              data: cogs,
              backgroundColor: '#5eead4', // Mint pastel
              borderRadius: 6,
              barPercentage: 0.6,
              categoryPercentage: 0.7
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: { font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' } }
            },
            tooltip: {
              callbacks: {
                label: (c) => ` ${c.dataset.label}: $${Number(c.raw).toLocaleString('es-CO')} COP`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (val) => `$${(val / 1000000).toFixed(0)}M` },
              grid: { color: 'rgba(0,0,0,0.05)' }
            },
            x: { grid: { display: false } }
          }
        }
      });

      service.register('bizVentasCosto', chart);
    },

    /**
     * Gráfico de Entradas vs Salidas en Caja y Flujo de Efectivo.
     */
    renderCajaFlujoChart() {
      const service = window.FinanzasChartService;
      if (!service || typeof Chart === 'undefined') return;

      const ctx = service.getContext('bizChartCajaFlujo');
      if (!ctx) return;

      service.destroyChart('bizCajaFlujo');

      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
          datasets: [
            {
              label: 'Entradas de Caja',
              data: [5400000, 5800000, 4900000, 5500000],
              backgroundColor: '#059669',
              borderRadius: 4
            },
            {
              label: 'Salidas Operativas',
              data: [3600000, 3900000, 3200000, 3540000],
              backgroundColor: '#e11d48',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: (c) => ` ${c.dataset.label}: $${Number(c.raw).toLocaleString('es-CO')} COP`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (val) => `$${(val / 1000000).toFixed(1)}M` }
            }
          }
        }
      });

      service.register('bizCajaFlujo', chart);
    },

    /**
     * Dona de gastos del negocio clasificados por rubro.
     */
    renderGastosNegocioChart(gastos = []) {
      const service = window.FinanzasChartService;
      if (!service || typeof Chart === 'undefined') return;

      const ctx = service.getContext('bizChartGastosCat');
      if (!ctx) return;

      service.destroyChart('bizGastosCat');

      const sumCat = {};
      (gastos || []).forEach(g => {
        const cat = g.categoria || 'Otros';
        sumCat[cat] = (sumCat[cat] || 0) + (Number(g.monto) || 0);
      });

      const labels = Object.keys(sumCat).length > 0 ? Object.keys(sumCat) : ['Arriendo', 'Servicios públicos', 'Nómina'];
      const dataVals = Object.keys(sumCat).length > 0 ? Object.values(sumCat) : [500000, 240000, 1600000];
      const colors = ['#0f3b3e', '#14b8a6', '#f59e0b', '#6366f1', '#ec4899'];

      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: dataVals,
            backgroundColor: colors.slice(0, labels.length)
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (c) => ` ${c.label}: $${Number(c.raw).toLocaleString('es-CO')} COP`
              }
            }
          }
        }
      });

      service.register('bizGastosCat', chart);
    }
  };

  window.BusinessCharts = businessCharts;
})();
