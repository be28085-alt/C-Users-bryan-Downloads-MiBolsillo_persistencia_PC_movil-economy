/**
 * ============================================================================
 * PERSONAL CHARTS
 * Responsabilidad: Gráficos de Finanzas Personales (Dashboard, Informes P&L e Historial).
 * ============================================================================
 */
(function () {
  'use strict';

  const monthFormatter = new Intl.DateTimeFormat('es-CO', { month: 'short' });

  function parseDate(value) {
    const date = window.parseFechaLocal ? window.parseFechaLocal(value) : new Date(value);
    return date && !isNaN(date.getTime()) ? date : null;
  }

  function buildMonthlyTrend(movimientos = [], months = 6) {
    const allMovements = Array.isArray(movimientos) ? movimientos : [];
    const totalMonths = Math.max(months, 1);
    const today = new Date();
    const monthSeries = Array.from({ length: totalMonths }, (_, index) => {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - (totalMonths - 1 - index), 1);
      return {
        label: monthFormatter.format(monthDate),
        year: monthDate.getFullYear(),
        month: monthDate.getMonth(),
        ingresos: 0,
        gastos: 0
      };
    });

    allMovements.forEach((movimiento) => {
      const fecha = parseDate(movimiento && movimiento.fecha);
      if (!fecha) return;

      const item = monthSeries.find((entry) => entry.year === fecha.getFullYear() && entry.month === fecha.getMonth());
      if (!item) return;

      const valor = Number(movimiento.valor) || 0;
      if (movimiento.tipo === 'INGRESO') item.ingresos += valor;
      else if (movimiento.tipo === 'GASTO') item.gastos += valor;
    });

    return {
      labels: monthSeries.map((entry) => entry.label),
      ingresos: monthSeries.map((entry) => entry.ingresos),
      gastos: monthSeries.map((entry) => entry.gastos)
    };
  }

  function buildCategoryTotals(movimientos = []) {
    const totals = {};
    (movimientos || []).forEach((movimiento) => {
      if (movimiento && movimiento.tipo === 'GASTO') {
        const categoria = movimiento.categoria || 'Otros';
        totals[categoria] = (totals[categoria] || 0) + (Number(movimiento.valor) || 0);
      }
    });

    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      return {
        labels: ['Vivienda', 'Alimentación', 'Transporte', 'Ocio'],
        data: [850000, 187800, 55000, 89200]
      };
    }

    return {
      labels: entries.map(([categoria]) => categoria),
      data: entries.map(([, total]) => total)
    };
  }

  const personalCharts = {
    /**
     * Gráfico de barras del Dashboard general: Ingresos vs Gastos últimos 6 meses.
     */
    renderDashboardChart() {
      const service = window.FinanzasChartService;
      if (!service || typeof Chart === 'undefined') return;

      const ctx = service.getContext('chartInicioDashboard');
      if (!ctx) return;

      service.destroyChart('dashboardInicio');

      const movimientos = window.Finanzas ? window.Finanzas.getMovimientos() : [];
      const trend = buildMonthlyTrend(movimientos, 6);

      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: trend.labels,
          datasets: [
            {
              label: 'Ingresos',
              data: trend.ingresos,
              backgroundColor: '#10b981',
              borderRadius: 6,
              barPercentage: 0.6,
              categoryPercentage: 0.7
            },
            {
              label: 'Gastos',
              data: trend.gastos,
              backgroundColor: '#e11d48',
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
              ticks: {
                callback: (val) => `$${(val / 1000000).toFixed(1)}M`
              },
              grid: { color: 'rgba(0,0,0,0.05)' }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });

      service.register('dashboardInicio', chart);
    },

    /**
     * Gráficos de la vista de Informes: Historial mensual y Dona de categorías.
     */
    renderInformesCharts(movimientosMes = []) {
      const service = window.FinanzasChartService;
      if (!service || typeof Chart === 'undefined') return;

      const sourceMovements = Array.isArray(movimientosMes) && movimientosMes.length
        ? movimientosMes
        : (window.Finanzas ? window.Finanzas.getMovimientos() : []);

      const trend = buildMonthlyTrend(sourceMovements, 12);

      const ctxBarras = service.getContext('chartInformesBarras');
      if (ctxBarras) {
        service.destroyChart('informesBarras');
        const chartBarras = new Chart(ctxBarras, {
          type: 'bar',
          data: {
            labels: trend.labels,
            datasets: [
              {
                label: 'Ingresos',
                data: trend.ingresos,
                backgroundColor: '#0f766e',
                borderRadius: 4
              },
              {
                label: 'Gastos',
                data: trend.gastos,
                backgroundColor: '#f43f5e',
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
        service.register('informesBarras', chartBarras);
      }

      const ctxDona = service.getContext('chartInformesDona');
      if (ctxDona) {
        service.destroyChart('informesDona');
        const categoriaTotals = buildCategoryTotals(sourceMovements);
        const colors = ['#6366f1', '#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6'];

        const chartDona = new Chart(ctxDona, {
          type: 'doughnut',
          data: {
            labels: categoriaTotals.labels,
            datasets: [{
              data: categoriaTotals.data,
              backgroundColor: colors.slice(0, categoriaTotals.labels.length)
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
        service.register('informesDona', chartDona);
      }
    }
  };

  window.PersonalCharts = personalCharts;
})();
