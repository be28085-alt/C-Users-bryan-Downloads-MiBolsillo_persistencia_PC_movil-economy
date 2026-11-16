/**
 * ============================================================================
 * PROYECTO: MiBolsillo · Control de Finanzas Personales
 * ARCHIVO: mobile.js
 * ROL: Controlador Exclusivo para la Versión Móvil (Smartphone)
 * ============================================================================
 */

class MobileApp {
  constructor() {
    this.currentTab = 'inicio';
    this.currentPlanSubtab = 'presupuestos';
    this.filtroTipo = 'TODOS';
    this.modalType = 'GASTO';
    this.chartInstance = null;
    this.chartCategories = null;
    this._savingMovement = false;
    this.initialized = false;

    document.addEventListener('DOMContentLoaded', () => this.init());
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    // Suscribirse a cambios en el núcleo compartido de datos
    Finanzas.subscribe(() => this.renderAll());
    document.addEventListener('click', (event) => this.handleDynamicAction(event));
    configurarEntradasMonetarias();

    // Configurar reloj de barra de estado
    this.actualizarReloj();
    setInterval(() => this.actualizarReloj(), 60000);

    // Configurar fecha de hoy en formularios
    const hoyStr = obtenerFechaHoyISO();
    const inpFecha = document.getElementById('mobInputFecha');
    if (inpFecha) inpFecha.value = hoyStr;

    document.getElementById('mobInputMonto')?.addEventListener('input', () => this.updateLiveImpact());
    document.getElementById('mobSelectCategoria')?.addEventListener('change', () => this.updateLiveImpact());

    // Renderizar estado inicial
    this.renderAll();
    this.updateLiveImpact();
  }

  handleDynamicAction(event) {
    const button = event.target.closest('[data-mobile-action]');
    if (!button) return;

    const { mobileAction, recordId, recordName } = button.dataset;
    switch (mobileAction) {
      case 'delete-movement':
        this.eliminarMovimiento(recordId);
        break;
      case 'contribute-goal':
        this.openModalAportarMeta(recordId, recordName);
        break;
      case 'delete-goal':
        this.eliminarMeta(recordId);
        break;
      case 'pay-debt':
        this.openModalAbonarDeuda(recordId, recordName);
        break;
      case 'delete-debt':
        this.eliminarDeuda(recordId);
        break;
      default:
        break;
    }
  }

  actualizarReloj() {
    const timeEl = document.getElementById('mobileStatusTime');
    if (timeEl) {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      timeEl.textContent = `${h}:${m}`;
    }
  }

  // ==========================================================================
  // NAVEGACIÓN Y CAMBIO DE PESTAÑAS MÓVILES
  // ==========================================================================
  switchTab(tabId, subtab = null) {
    this.currentTab = tabId;

    document.querySelectorAll('.screen-view').forEach(view => {
      view.classList.remove('active');
    });

    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) targetView.classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    if (tabId === 'plan' && subtab) {
      this.switchPlanSubtab(subtab);
    }

    if (tabId === 'informes') {
      setTimeout(() => this.renderizarGraficoInformes(), 50);
    }

    const container = document.getElementById('mobileScreensContainer');
    if (container) container.scrollTop = 0;
  }

  switchPlanSubtab(subtabId) {
    this.currentPlanSubtab = subtabId;

    document.querySelectorAll('.segment-tab[data-subtab]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-subtab') === subtabId);
    });

    document.querySelectorAll('.plan-subpane').forEach(p => {
      p.classList.remove('active');
    });

    const targetSub = document.getElementById(`subpane-${subtabId}`);
    if (targetSub) targetSub.classList.add('active');

    const subLabels = {
      presupuestos: 'QUÉ EN LUGAR DE ESTÁ PASO',
      metas: 'AHORRA PARA LO QUE IMPORTA',
      deudas: 'MÁS CLARIDAD, MENOS CARGAS'
    };
    const lblSub = document.getElementById('lblMobilePlanHeaderSub');
    if (lblSub) lblSub.textContent = subLabels[subtabId] || 'MI PLAN';
  }

  // ==========================================================================
  // RENDERIZADO GLOBAL
  // ==========================================================================
  renderAll() {
    this.renderUserMeta();
    this.renderInicio();
    this.renderizarMovimientos();
    this.renderPlan();
    this.renderInformes();
    this.renderPerfil();
    this.updateLiveImpact();
    if (this.currentTab === 'informes') {
      this.renderizarGraficoInformes();
    }
  }

  renderUserMeta() {
    const u = Finanzas.state.usuario;
    const nameEl = document.getElementById('lblMobileUserNombre');
    if (nameEl) nameEl.textContent = u.nombre.split(' ')[0] || 'Lucía';
    const initialsEl = document.getElementById('lblMobileAvatarInitials');
    if (initialsEl) initialsEl.textContent = u.iniciales;
  }

  // PANTALLA INICIO (DASHBOARD MÓVIL)
  renderInicio() {
    const isHidden = Finanzas.state.saldoOculto;

    // Saldo Total: Global
    const saldoTotal = Finanzas.calcSaldoTotal();

    // Métricas del período seleccionado
    const ingresos = Finanzas.calcTotalIngresos();
    const gastos = Finanzas.calcTotalGastos();
    const budgetStatus = Finanzas.calcPresupuestoStatus();

    // Actualizar selector de mes
    const elMonth = document.getElementById('lblMobileCurrentMonth');
    if (elMonth) elMonth.textContent = Finanzas.getNombrePeriodo();
    const elMonthMov = document.getElementById('lblMobileMovCurrentMonth');
    if (elMonthMov) elMonthMov.textContent = Finanzas.getNombrePeriodo();

    const elHero = document.getElementById('lblMobileHeroBalance');
    if (elHero) elHero.textContent = isHidden ? '•••••••• COP' : formatCOP(saldoTotal);

    const elIng = document.getElementById('lblMobileHeroIngresos');
    if (elIng) elIng.textContent = isHidden ? '•••••••• COP' : `+${formatCOP(ingresos)}`;

    const elGas = document.getElementById('lblMobileHeroGastos');
    if (elGas) elGas.textContent = isHidden ? '•••••••• COP' : `-${formatCOP(gastos)}`;

    const elPct = document.getElementById('lblMobileBudgetPercent');
    if (elPct) elPct.textContent = `${budgetStatus.porcentajeReal} %`;

    const barBud = document.getElementById('barMobileBudget');
    if (barBud) barBud.style.width = `${budgetStatus.porcentaje}%`;

    const elAvail = document.getElementById('lblMobileBudgetAvailable');
    if (elAvail) {
      if (budgetStatus.disponible > 0) {
        elAvail.textContent = `Te quedan ${formatCOP(budgetStatus.disponible)} para este mes...`;
      } else {
        elAvail.textContent = `Has sobrepasado el límite por ${formatCOP(budgetStatus.exceso)}!`;
      }
    }

    // Alertas proposicionales
    const alertsCont = document.getElementById('mobileDashboardAlerts');
    if (alertsCont) {
      const alerts = Finanzas.evaluarAlertas();
      let aHtml = '';
      alerts.forEach(a => {
        aHtml += `
          <div class="section-card" style="border-left: 4px solid ${a.tipo === 'critica' ? 'var(--color-expense)' : 'var(--color-primary)'}; padding: 0.85rem; margin-bottom: 0.85rem;">
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.2rem;">
              <span>${escapeHTML(a.icono)}</span>
              <strong style="font-size: 0.85rem;">${escapeHTML(a.titulo)}</strong>
            </div>
            <p style="font-size: 0.76rem; color: var(--text-body);">${escapeHTML(a.mensaje)}</p>
          </div>
        `;
      });
      alertsCont.innerHTML = aHtml;
    }

    // Lista reciente de movimientos
    const listRecents = document.getElementById('mobileRecentTransactionsList');
    if (listRecents) {
      const recents = Finanzas.getMovimientosPeriodo()
        .slice()
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 5);
      if (recents.length === 0) {
        listRecents.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted); font-size: 0.8rem;">No hay movimientos recientes.</div>';
      } else {
        let html = '';
        recents.forEach(m => {
          const isInc = m.tipo === 'INGRESO';
          const cat = (isInc ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO).find(c => c.id === m.categoria) || { icon: '🏷️' };
          html += `
            <div class="transaction-row-item">
              <div class="tx-left-col">
                <div class="tx-icon-bubble">${cat.icon}</div>
                <div class="tx-details">
                  <span class="tx-concept">${escapeHTML(m.concepto)}</span>
                  <span class="tx-subtext">${escapeHTML(m.categoria)} · ${escapeHTML(m.fecha)}</span>
                </div>
              </div>
              <span class="tx-amount ${isInc ? 'income' : 'expense'}">${isInc ? '+' : '-'}${formatCOP(m.valor)}</span>
            </div>
          `;
        });
        listRecents.innerHTML = html;
      }
    }

    const dashboardGoals = document.getElementById('mobileDashboardGoals');
    if (dashboardGoals) {
      const goals = Finanzas.state.metas.slice(0, 3);
      dashboardGoals.innerHTML = goals.length
        ? goals.map(goal => {
          const percent = goal.objetivo > 0 ? Math.min(100, Math.round(goal.ahorrado / goal.objetivo * 100)) : 0;
          return `
            <div style="padding:0.65rem 0; border-bottom:1px solid var(--border-card);">
              <div style="display:flex; justify-content:space-between; gap:0.75rem; font-size:0.82rem; font-weight:700;">
                <span>${escapeHTML(goal.nombre)}</span><span>${percent}%</span>
              </div>
              <div class="progress-track" style="margin:0.35rem 0;">
                <div class="progress-bar-fill" style="width:${percent}%;"></div>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-muted);">
                <span>${formatCOP(goal.ahorrado)}</span><span>Meta: ${formatCOP(goal.objetivo)}</span>
              </div>
            </div>`;
        }).join('')
        : '<p style="font-size:0.82rem; color:var(--text-muted);">Aún no tienes metas de ahorro.</p>';
    }
  }

  // PANTALLA MOVIMIENTOS
  setFiltroTipo(tipo) {
    this.filtroTipo = tipo;
    ['mobChipTodos', 'mobChipIngresos', 'mobChipGastos'].forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });

    if (tipo === 'TODOS') document.getElementById('mobChipTodos')?.classList.add('active');
    if (tipo === 'INGRESO') document.getElementById('mobChipIngresos')?.classList.add('active');
    if (tipo === 'GASTO') document.getElementById('mobChipGastos')?.classList.add('active');

    this.renderizarMovimientos();
  }

  renderizarMovimientos() {
    const container = document.getElementById('mobileGroupedTransactionsList');
    if (!container) return;

    // Actualizar mes de movimientos
    const elMonthMov = document.getElementById('lblMobileMovCurrentMonth');
    if (elMonthMov) elMonthMov.textContent = Finanzas.getNombrePeriodo();

    // KPIs del período seleccionado
    const ingEl = document.getElementById('lblMobileMovIngresos');
    if (ingEl) ingEl.textContent = `+${formatCOP(Finanzas.calcTotalIngresos())}`;
    const gasEl = document.getElementById('lblMobileMovGastos');
    if (gasEl) gasEl.textContent = `-${formatCOP(Finanzas.calcTotalGastos())}`;
    const balanceEl = document.getElementById('lblMobileMovBalance');
    if (balanceEl) balanceEl.textContent = formatCOP(Finanzas.calcBalanceNeto(), true);

    const filterType = this.filtroTipo;
    const query = (document.getElementById('mobileInputSearch')?.value || '').toLowerCase().trim();

    // Filtra por el período seleccionado
    let items = Finanzas.getMovimientosPeriodo();
    if (filterType !== 'TODOS') {
      items = items.filter(m => m.tipo === filterType);
    }
    if (query) {
      items = items.filter(m => 
        (m.concepto || '').toLowerCase().includes(query) || 
        (m.categoria || '').toLowerCase().includes(query)
      );
    }
    const category = document.getElementById('mobileSelectCategory')?.value || 'TODAS';
    if (category !== 'TODAS') {
      items = items.filter(m => m.categoria === category);
    }

    if (items.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">No hay movimientos registrados en ${Finanzas.getNombrePeriodo()}.</div>`;
      return;
    }

    // Agrupar por grupoFecha
    const grupos = {};
    items.forEach(m => {
      const g = m.grupoFecha || 'OCTUBRE';
      if (!grupos[g]) grupos[g] = [];
      grupos[g].push(m);
    });

    let html = '';
    for (const [grupo, movs] of Object.entries(grupos)) {
      html += `
        <div style="margin-bottom: 1.25rem;">
          <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px; display: block; margin-bottom: 0.5rem;">${escapeHTML(grupo)}</span>
          <div class="section-card" style="padding: 0.5rem 1rem;">
      `;
      movs.forEach(m => {
        const isInc = m.tipo === 'INGRESO';
        const cat = (isInc ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO).find(c => c.id === m.categoria) || { icon: '🏷️' };
        html += `
          <div class="transaction-row-item">
            <div class="tx-left-col">
              <div class="tx-icon-bubble">${cat.icon}</div>
              <div class="tx-details">
                <span class="tx-concept">${escapeHTML(m.concepto)}</span>
                <span class="tx-subtext">${escapeHTML(m.categoria)} · ${escapeHTML(m.cuenta || 'Principal')}</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="tx-amount ${isInc ? 'income' : 'expense'}">${isInc ? '+' : '-'}${formatCOP(m.valor)}</span>
              <button class="link-btn" style="color: var(--color-expense);" data-mobile-action="delete-movement" data-record-id="${escapeHTMLAttribute(m.id)}">✕</button>
            </div>
          </div>
        `;
      });
      html += `</div></div>`;
    }
    container.innerHTML = html;
  }

  // PANTALLA PLAN (PRESUPUESTO, METAS Y DEUDAS)
  renderPlan() {
    const budgetStatus = Finanzas.calcPresupuestoStatus();

    const curEl = document.getElementById('lblMobileBudgetHeroCurrent');
    if (curEl) curEl.textContent = formatCOP(budgetStatus.gastado);
    const limEl = document.getElementById('lblMobileBudgetHeroLimit');
    if (limEl) limEl.textContent = `de ${formatCOP(budgetStatus.limite)}`;
    const barHero = document.getElementById('barMobileBudgetHero');
    if (barHero) barHero.style.width = `${budgetStatus.porcentaje}%`;
    const availEl = document.getElementById('lblMobileBudgetHeroAvailable');
    if (availEl) {
      availEl.textContent = budgetStatus.disponible > 0 
        ? `${formatCOP(budgetStatus.disponible)} disponibles para este mes`
        : `Límite excedido por ${formatCOP(budgetStatus.exceso)}`;
    }
    const budgetPercentEl = document.getElementById('lblMobileBudgetPercentPlan');
    if (budgetPercentEl) budgetPercentEl.textContent = `${budgetStatus.porcentajeReal}% consumido`;
    const planAlerts = document.getElementById('mobilePlanAlerts');
    if (planAlerts) {
      const alerts = Finanzas.evaluarAlertas();
      planAlerts.innerHTML = alerts.length
        ? alerts.map(a => `
          <div style="padding:0.65rem 0; border-bottom:1px solid var(--border-card);">
            <strong style="font-size:0.82rem;">${escapeHTML(a.icono)} ${escapeHTML(a.titulo)}</strong>
            <p style="font-size:0.76rem; color:var(--text-muted); margin-top:0.25rem;">${escapeHTML(a.mensaje)}</p>
          </div>`).join('')
        : '<p style="font-size:0.82rem; color:var(--text-muted);">No hay alertas para este período.</p>';
    }

    // Lista de categorías
    const catList = document.getElementById('mobileListCategoriesBudget');
    if (catList) {
      const gastosCat = Finanzas.calcGastosPorCategoria();
      let html = '';
      CATEGORIAS_GASTO.forEach(c => {
        const gastado = gastosCat[c.id] || 0;
        const limite = Finanzas.state.limitesCategorias[c.id] || 300000;
        const pct = limite > 0 ? Math.min(100, Math.round((gastado / limite) * 100)) : 0;

        html += `
          <div style="margin-bottom: 0.85rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: var(--color-primary);">
              <span>${c.icon} ${escapeHTML(c.nombre)}</span>
              <span>${pct}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-muted);">
              <span>${formatCOP(gastado)}</span>
              <span>Límite: ${formatCOP(limite)}</span>
            </div>
          </div>
        `;
      });
      catList.innerHTML = html;
    }

    // Metas
    const totMetas = document.getElementById('lblMobileMetasTotal');
    if (totMetas) totMetas.textContent = formatCOP(Finanzas.calcTotalAhorradoMetas());
    const countMetas = document.getElementById('lblMobileMetasCount');
    if (countMetas) countMetas.textContent = `${Finanzas.state.metas.length} metas`;
    const totalMetaObjetivo = Finanzas.calcTotalObjetivoMetas();
    const totalMetaAhorrado = Finanzas.calcTotalAhorradoMetas();
    const metaObjetivoEl = document.getElementById('lblMobileMetasObjetivo');
    if (metaObjetivoEl) metaObjetivoEl.textContent = formatCOP(totalMetaObjetivo);
    const metaRestanteEl = document.getElementById('lblMobileMetasRestante');
    if (metaRestanteEl) metaRestanteEl.textContent = formatCOP(Math.max(0, totalMetaObjetivo - totalMetaAhorrado));

    const listMetas = document.getElementById('mobileListMetasCards');
    if (listMetas) {
      let mHtml = '';
      Finanzas.state.metas.forEach(m => {
        const pct = m.objetivo > 0 ? Math.min(100, Math.round((m.ahorrado / m.objetivo) * 100)) : 0;
        mHtml += `
          <div style="background: var(--bg-subtle); padding: 0.85rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.9rem;">
              <span>${escapeHTML(m.nombre)}</span>
              <span style="color: var(--color-income);">${pct}%</span>
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${escapeHTML(m.plazo)}</span>
            <div class="progress-track big-track" style="margin: 0.6rem 0;">
              <div class="progress-bar-fill" style="width: ${pct}%; background: var(--color-income);"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.78rem;">
              <strong>${formatCOP(m.ahorrado)}</strong>
              <span style="color: var(--text-muted);">Meta: ${formatCOP(m.objetivo)}</span>
            </div>
            <button class="btn-action-primary" style="margin-top: 0.75rem; padding: 0.5rem; font-size: 0.8rem; margin-bottom: 0;" data-mobile-action="contribute-goal" data-record-id="${escapeHTMLAttribute(m.id)}" data-record-name="${escapeHTMLAttribute(m.nombre)}">
              + Aportar
            </button>
            <button class="link-btn" style="color:var(--color-expense); margin-top:0.6rem;" data-mobile-action="delete-goal" data-record-id="${escapeHTMLAttribute(m.id)}">
              🗑️ Eliminar meta
            </button>
          </div>
        `;
      });
      listMetas.innerHTML = mHtml;
    }
    const goalHistory = document.getElementById('mobileListAportesMetas');
    if (goalHistory) {
      const contributions = Finanzas.state.aportesMetas || [];
      goalHistory.innerHTML = contributions.length
        ? contributions.map(ap => `
          <div style="display:flex; justify-content:space-between; gap:0.75rem; padding:0.55rem 0; border-bottom:1px solid var(--border-card); font-size:0.8rem;">
            <span>${escapeHTML(ap.fecha)} · ${escapeHTML(ap.metaNombre)}</span>
            <strong style="color:var(--color-income);">+${formatCOP(ap.valor)}</strong>
          </div>`).join('')
        : '<p style="font-size:0.82rem; color:var(--text-muted);">Sin aportes registrados aún.</p>';
    }

    // Deudas
    const totDeudas = document.getElementById('lblMobileDeudasTotal');
    if (totDeudas) totDeudas.textContent = formatCOP(Finanzas.calcTotalDeudasPendientes());
    const totalDebtPaid = document.getElementById('lblMobileDeudasPagado');
    if (totalDebtPaid) totalDebtPaid.textContent = formatCOP(Finanzas.calcTotalDeudasPagado());
    const totalMonthlyDebtPayments = Finanzas.state.deudas.reduce((sum, debt) => sum + (Number(debt.cuotaMensual) || 0), 0);
    const monthlyDebtPayments = document.getElementById('lblMobileDeudasCuotas');
    if (monthlyDebtPayments) monthlyDebtPayments.textContent = `${formatCOP(totalMonthlyDebtPayments)}/mes`;

    const listDeudas = document.getElementById('mobileListDeudasCards');
    if (listDeudas) {
      let dHtml = '';
      Finanzas.state.deudas.forEach(d => {
        const pagado = Math.max(0, d.valorInicial - d.saldoPendiente);
        const pct = d.valorInicial > 0 ? Math.min(100, Math.round((pagado / d.valorInicial) * 100)) : 0;
        dHtml += `
          <div style="background: var(--bg-subtle); padding: 0.85rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.9rem;">
              <span>${escapeHTML(d.nombre)}</span>
              <span style="color: var(--color-expense);">${formatCOP(d.saldoPendiente)}</span>
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${escapeHTML(d.condiciones || 'Obligación')}</span>
            <div class="progress-track" style="margin: 0.5rem 0;">
              <div class="progress-bar-fill" style="width: ${pct}%; background: var(--color-primary);"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-top: 0.5rem;">
              <span>Cuota: ${formatCOP(d.cuotaMensual)}</span>
              <span>Vence: ${escapeHTML(d.proximoPago)}</span>
            </div>
            <button class="btn-action-primary" style="margin-top: 0.75rem; padding: 0.5rem; font-size: 0.8rem; margin-bottom: 0;" data-mobile-action="pay-debt" data-record-id="${escapeHTMLAttribute(d.id)}" data-record-name="${escapeHTMLAttribute(d.nombre)}">
              + Registrar abono
            </button>
            <button class="link-btn" style="color:var(--color-expense); margin-top:0.6rem;" data-mobile-action="delete-debt" data-record-id="${escapeHTMLAttribute(d.id)}">
              🗑️ Eliminar deuda
            </button>
          </div>
        `;
      });
      listDeudas.innerHTML = dHtml;
    }
    const debtHistory = document.getElementById('mobileListAbonosDeudas');
    if (debtHistory) {
      const payments = Finanzas.state.abonosDeudas || [];
      debtHistory.innerHTML = payments.length
        ? payments.map(ab => `
          <div style="display:flex; justify-content:space-between; gap:0.75rem; padding:0.55rem 0; border-bottom:1px solid var(--border-card); font-size:0.8rem;">
            <span>${escapeHTML(ab.fecha)} · ${escapeHTML(ab.deudaNombre)}</span>
            <strong style="color:var(--color-expense);">-${formatCOP(ab.valor)}</strong>
          </div>`).join('')
        : '<p style="font-size:0.82rem; color:var(--text-muted);">Sin abonos registrados aún.</p>';
    }
  }

  // PANTALLA INFORMES
  renderInformes() {
    const balEl = document.getElementById('lblMobileReportBalance');
    if (balEl) balEl.textContent = formatCOP(Finanzas.calcBalanceNeto(), true);
    const incomeEl = document.getElementById('lblMobileReportIncome');
    if (incomeEl) incomeEl.textContent = `+${formatCOP(Finanzas.calcTotalIngresos())}`;
    const expenseEl = document.getElementById('lblMobileReportExpense');
    if (expenseEl) expenseEl.textContent = `-${formatCOP(Finanzas.calcTotalGastos())}`;
    const tasaEl = document.getElementById('lblMobileReportTasa');
    if (tasaEl) tasaEl.textContent = `🌱 Tasa de ahorro en metas: ${Finanzas.calcTasaAhorro()} %`;
    const totSpentEl = document.getElementById('lblMobileReportTotalSpent');
    if (totSpentEl) totSpentEl.textContent = formatCOP(Finanzas.calcTotalGastos());

    // Grid de categorías
    const gridEl = document.getElementById('mobileGridReportCategories');
    if (gridEl) {
      const gastosCat = Finanzas.calcGastosPorCategoria();
      const totalGastos = Finanzas.calcTotalGastos();
      let html = '';
      CATEGORIAS_GASTO.forEach(c => {
        const gastado = gastosCat[c.id] || 0;
        const limite = Finanzas.state.limitesCategorias[c.id] || 300000;
        const pctTotal = totalGastos > 0 ? (gastado / totalGastos * 100).toFixed(1) : '0.0';
        const pctLimit = limite > 0 ? Math.round(gastado / limite * 100) : 0;
        const status = gastado >= limite ? 'Límite alcanzado' : 'En rango';
        html += `
          <div style="padding:0.45rem 0; border-bottom:1px solid var(--border-card);">
            <div style="display:flex; justify-content:space-between; gap:0.75rem; font-size:0.82rem;">
              <span>${c.icon} ${escapeHTML(c.nombre)}</span><strong>${formatCOP(gastado)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; gap:0.75rem; margin-top:0.2rem; font-size:0.72rem; color:var(--text-muted);">
              <span>${pctTotal}% del gasto total</span><span>${pctLimit}% del límite (${formatCOP(limite)})</span>
            </div>
            <div style="font-size:0.72rem; color:${gastado >= limite ? 'var(--color-expense)' : 'var(--color-income)'}; margin-top:0.15rem;">${status}</div>
          </div>
        `;
      });
      gridEl.innerHTML = html;
    }
  }

  renderizarGraficoInformes() {
    const canvas = document.getElementById('mobileChartPerspective');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
      [canvas, document.getElementById('mobileChartCategories')].forEach(chartCanvas => {
        const parent = chartCanvas?.parentElement;
        if (!chartCanvas || !parent || parent.querySelector('.chart-fallback-notice')) return;
        chartCanvas.style.display = 'none';
        const notice = document.createElement('div');
        notice.className = 'chart-fallback-notice';
        notice.style.padding = '1rem';
        notice.style.textAlign = 'center';
        notice.style.color = 'var(--text-muted)';
        notice.style.fontSize = '0.8rem';
        notice.textContent = 'Gráficos desactivados (Chart.js no disponible sin conexión a internet).';
        parent.appendChild(notice);
      });
      return;
    }

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const realData = obtenerHistorialMensualReal(Finanzas.state.movimientos);
    let labels = realData.labels;
    let ingresosData = realData.ingresos;
    let gastosData = realData.gastos;

    if (!realData.tieneDatos) {
      labels = [Finanzas.getNombrePeriodo()];
      ingresosData = [Finanzas.calcTotalIngresos()];
      gastosData = [Finanzas.calcTotalGastos()];
    }

    this.chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Ingresos', data: ingresosData, backgroundColor: '#0f8b65', borderRadius: 4 },
          { label: 'Gastos', data: gastosData, backgroundColor: '#d9383a', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } }
      }
    });
    this.renderCategoryChart();
  }

  renderCategoryChart() {
    const canvas = document.getElementById('mobileChartCategories');
    if (!canvas || typeof Chart === 'undefined') return;
    if (this.chartCategories) this.chartCategories.destroy();

    const totals = Finanzas.calcGastosPorCategoria();
    const categories = CATEGORIAS_GASTO.filter(category => totals[category.id] > 0);
    this.chartCategories = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: categories.length ? categories.map(category => category.nombre) : ['Sin gastos en el período'],
        datasets: [{
          data: categories.length ? categories.map(category => totals[category.id]) : [1],
          backgroundColor: categories.length ? categories.map(category => category.color) : ['#cbd5e1'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        cutout: '60%'
      }
    });
  }

  // PANTALLA PERFIL
  renderPerfil() {
    const u = Finanzas.state.usuario;
    const nameEl = document.getElementById('mobileProfileName');
    if (nameEl) nameEl.textContent = u.nombre;
    const emailEl = document.getElementById('mobileProfileEmail');
    if (emailEl) emailEl.textContent = u.email;
    const avatarEl = document.getElementById('mobileProfileAvatar');
    if (avatarEl) avatarEl.textContent = u.iniciales;

    // Checkboxes en perfil móvil si existen
    const chkPres = document.getElementById('mobChkAlertasPresupuesto');
    if (chkPres) chkPres.checked = u.alertasPresupuesto !== false;
    const chkDeudas = document.getElementById('mobChkRecordatoriosDeudas');
    if (chkDeudas) chkDeudas.checked = u.recordatoriosDeudas !== false;

    // Saldo inicial
    const lblSaldoIni = document.getElementById('mobLblSaldoInicial');
    if (lblSaldoIni) lblSaldoIni.textContent = formatCOP(Finanzas.state.saldoInicial || 0);
    const chkSaldoOculto = document.getElementById('mobChkOcultarSaldo');
    if (chkSaldoOculto) chkSaldoOculto.checked = !!Finanzas.state.saldoOculto;
  }

  // ==========================================================================
  // MODALES BOTTOM-SHEET MÓVILES
  // ==========================================================================
  openModalRegistrar() {
    document.getElementById('modalMobileRegistrar')?.classList.remove('hidden');
    this.updateLiveImpact();
  }
  closeModalRegistrar() {
    document.getElementById('modalMobileRegistrar')?.classList.add('hidden');
  }

  setModalType(tipo) {
    this.modalType = tipo;
    const btnGasto = document.getElementById('mobRegGasto');
    const btnIngreso = document.getElementById('mobRegIngreso');
    const select = document.getElementById('mobSelectCategoria');

    if (tipo === 'GASTO') {
      btnGasto?.classList.add('active');
      btnIngreso?.classList.remove('active');
      if (select) {
        select.innerHTML = `
          <option value="Alimentación">🛒 Alimentación</option>
          <option value="Transporte">🚌 Transporte</option>
          <option value="Ocio">☕ Ocio</option>
          <option value="Vivienda">🏠 Vivienda</option>
          <option value="Sanidad">⚕️ Sanidad</option>
          <option value="Otros">··· Otros</option>
        `;
      }
    } else {
      btnIngreso?.classList.add('active');
      btnGasto?.classList.remove('active');
      if (select) {
        select.innerHTML = `
          <option value="Salario">💼 Salario</option>
          <option value="Freelance">💻 Freelance</option>
          <option value="Ventas">🏷️ Ventas</option>
          <option value="Inversiones">📈 Inversiones</option>
          <option value="Mesada">🤝 Apoyo</option>
          <option value="Otros">✨ Otros</option>
        `;
      }
    }
    this.updateLiveImpact();
  }

  handleGuardarMovimiento(e) {
    e.preventDefault();
    if (this._savingMovement) return;
    this._savingMovement = true;
    const valor = Number(document.getElementById('mobInputMonto')?.value);
    const concepto = document.getElementById('mobInputConcepto')?.value ? document.getElementById('mobInputConcepto').value.trim() : '';
    const categoria = document.getElementById('mobSelectCategoria')?.value || 'Alimentación';
    const fecha = document.getElementById('mobInputFecha')?.value || obtenerFechaHoyISO();

    if (!isFinite(valor) || valor <= 0) {
      this.mostrarToast('El monto debe ser un número positivo.');
      this._savingMovement = false;
      return;
    }
    if (!concepto) {
      this.mostrarToast('La descripción es obligatoria.');
      this._savingMovement = false;
      return;
    }

    const fechaLocal = new Date(`${fecha}T12:00:00`);
    if (!Number.isNaN(fechaLocal.getTime())) {
      Finanzas.state.periodoAnio = fechaLocal.getFullYear();
      Finanzas.state.periodoMes = fechaLocal.getMonth();
    }

    const res = Finanzas.agregarMovimiento({
      tipo: this.modalType,
      concepto,
      categoria,
      cuenta: document.getElementById('mobSelectCuenta')?.value || 'Principal',
      valor,
      fecha
    });

    if (res.error) {
      this.mostrarToast(res.error);
      this._savingMovement = false;
      return;
    }

    this._savingMovement = false;
    const amountInput = document.getElementById('mobInputMonto');
    const conceptInput = document.getElementById('mobInputConcepto');
    if (amountInput) amountInput.value = '';
    if (conceptInput) conceptInput.value = '';
    this.updateLiveImpact();
    this.closeModalRegistrar();
    this.mostrarToast('✔ Movimiento registrado');
  }

  updateLiveImpact() {
    const rawAmount = Number(document.getElementById('mobInputMonto')?.value || 0);
    const amount = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0;
    const isIncome = this.modalType === 'INGRESO';
    const currentBalance = Finanzas.calcSaldoTotal();
    const projectedBalance = currentBalance + (isIncome ? amount : -amount);
    const category = document.getElementById('mobSelectCategoria')?.value || 'Alimentación';
    const currentEl = document.getElementById('mobLblSaldoActual');
    const projectedEl = document.getElementById('mobLblSaldoProyectado');
    const categoryEl = document.getElementById('mobLblRegCategory');
    const impactEl = document.getElementById('mobLblBudgetImpact');
    if (currentEl) currentEl.textContent = formatCOP(currentBalance);
    if (projectedEl) projectedEl.textContent = formatCOP(projectedBalance);
    if (categoryEl) categoryEl.textContent = category;

    const alertEl = document.getElementById('mobRegImpactAlert');
    if (alertEl) {
      const status = Finanzas.calcPresupuestoStatus();
      if (impactEl) {
        impactEl.textContent = isIncome
          ? 'Aporte a liquidez'
          : `+${(status.limite > 0 ? amount / status.limite * 100 : 0).toFixed(1)}% del presupuesto`;
      }
      const categorySpent = Finanzas.calcGastosPorCategoria()[category] || 0;
      const categoryLimit = Finanzas.state.limitesCategorias[category] || 300000;
      alertEl.textContent = !isIncome && (
        (status.limite > 0 && status.gastado + amount > status.limite) ||
        categorySpent + amount > categoryLimit
      ) ? '⚠️ Este gasto puede superar el presupuesto mensual o el límite de su categoría.' : '';
    }
  }

  // Modal Metas
  openModalNuevaMeta() {
    document.getElementById('modalMobileNuevaMeta')?.classList.remove('hidden');
  }
  closeModalNuevaMeta() {
    document.getElementById('modalMobileNuevaMeta')?.classList.add('hidden');
  }
  handleNuevaMeta(e) {
    e.preventDefault();
    const nombre = document.getElementById('mobMetaNombre')?.value || '';
    const objetivo = Number(document.getElementById('mobMetaObjetivo')?.value);
    const ahorrado = Number(document.getElementById('mobMetaAhorrado')?.value || 0);
    const plazo = document.getElementById('mobMetaPlazo')?.value || '';

    if (!isFinite(objetivo) || objetivo <= 0) {
      this.mostrarToast('El objetivo debe ser mayor a cero.');
      return;
    }

    const res = Finanzas.agregarMeta({ nombre, objetivo, ahorrado, plazo });
    if (res.error) {
      this.mostrarToast(res.error);
      return;
    }

    this.closeModalNuevaMeta();
    this.mostrarToast('✔ Meta creada con éxito');
  }

  openModalAportarMeta(metaId, metaNombre) {
    document.getElementById('mobAporteMetaId').value = metaId;
    document.getElementById('mobLblAporteMetaTitle').textContent = `Aportar a ${metaNombre}`;
    document.getElementById('modalMobileAportarMeta')?.classList.remove('hidden');
  }
  closeModalAportarMeta() {
    document.getElementById('modalMobileAportarMeta')?.classList.add('hidden');
  }
  handleAporteMeta(e) {
    e.preventDefault();
    const metaId = document.getElementById('mobAporteMetaId')?.value;
    const monto = Number(document.getElementById('mobAporteMetaValor')?.value);

    if (!isFinite(monto) || monto <= 0) {
      this.mostrarToast('Ingrese un monto positivo para aportar.');
      return;
    }

    const res = Finanzas.aportarMeta(metaId, monto);
    if (res.error) {
      this.mostrarToast(res.error);
      return;
    }

    this.closeModalAportarMeta();
    this.mostrarToast('✔ ' + res.mensaje);
  }

  // Modal Deudas (SOLUCIÓN PROBLEMA 1: OMITIR CONDICIONES DESDE MÓVIL)
  openModalNuevaDeuda() {
    document.getElementById('modalMobileNuevaDeuda')?.classList.remove('hidden');
  }
  closeModalNuevaDeuda() {
    document.getElementById('modalMobileNuevaDeuda')?.classList.add('hidden');
  }
  handleNuevaDeuda(e) {
    e.preventDefault();
    const nombre = document.getElementById('mobDeudaNombre')?.value ? document.getElementById('mobDeudaNombre').value.trim() : '';
    const valorInicial = Number(document.getElementById('mobDeudaValorInicial')?.value);
    const saldoPendienteRaw = document.getElementById('mobDeudaSaldoPendiente')?.value;
    const saldoPendiente = saldoPendienteRaw ? Number(saldoPendienteRaw) : valorInicial;
    const cuotaMensual = Number(document.getElementById('mobDeudaCuota')?.value || 0);

    if (!nombre) {
      this.mostrarToast('El nombre de la deuda es requerido.');
      return;
    }
    if (!isFinite(valorInicial) || valorInicial <= 0) {
      this.mostrarToast('El valor inicial debe ser un número positivo.');
      return;
    }
    if (saldoPendiente > valorInicial) {
      this.mostrarToast('El saldo pendiente no puede superar el valor inicial.');
      return;
    }

    // Nota: El formulario móvil no envía "condiciones". Finanzas.agregarDeuda maneja condiciones opcionales correctamente.
    const condiciones = document.getElementById('mobDeudaCondiciones')?.value?.trim() || '';
    const res = Finanzas.agregarDeuda({ nombre, valorInicial, saldoPendiente, cuotaMensual, condiciones });
    if (res.error) {
      this.mostrarToast(res.error);
      return;
    }

    this.closeModalNuevaDeuda();
    this.mostrarToast('✔ Deuda registrada');
  }

  openModalAbonarDeuda(deudaId, deudaNombre) {
    document.getElementById('mobAbonoDeudaId').value = deudaId;
    document.getElementById('mobLblAbonoDeudaTitle').textContent = `Abonar a ${deudaNombre}`;
    document.getElementById('modalMobileAbonarDeuda')?.classList.remove('hidden');
  }
  closeModalAbonarDeuda() {
    document.getElementById('modalMobileAbonarDeuda')?.classList.add('hidden');
  }
  handleAbonoDeuda(e) {
    e.preventDefault();
    const deudaId = document.getElementById('mobAbonoDeudaId')?.value;
    const monto = Number(document.getElementById('mobAbonoDeudaValor')?.value);

    if (!isFinite(monto) || monto <= 0) {
      this.mostrarToast('Ingrese un monto positivo para abonar.');
      return;
    }

    const res = Finanzas.abonarDeuda(deudaId, monto);
    if (res.error) {
      this.mostrarToast(res.error);
      return;
    }

    this.closeModalAbonarDeuda();
    this.mostrarToast('✔ ' + res.mensaje);
  }

  // Presupuesto
  openModalConfigPresupuesto() {
    const inp = document.getElementById('mobInputPresupuestoMonto');
    if (inp) inp.value = Finanzas.getPresupuestoPeriodo();
    document.getElementById('modalMobilePresupuesto')?.classList.remove('hidden');
  }
  closeModalConfigPresupuesto() {
    document.getElementById('modalMobilePresupuesto')?.classList.add('hidden');
  }
  handlePresupuesto(e) {
    e.preventDefault();
    const monto = Number(document.getElementById('mobInputPresupuestoMonto')?.value);
    if (isFinite(monto) && monto >= 0) {
      Finanzas.actualizarPresupuesto(monto);
      this.closeModalConfigPresupuesto();
      this.mostrarToast(`✔ Presupuesto de ${Finanzas.getNombrePeriodo()} actualizado`);
    } else {
      this.mostrarToast('Ingrese un monto válido.');
    }
  }

  // Perfil
  openModalEditarPerfil() {
    const u = Finanzas.state.usuario;
    const inpNom = document.getElementById('mobInputPerfilNombre');
    if (inpNom) inpNom.value = u.nombre;
    const inpMail = document.getElementById('mobInputPerfilEmail');
    if (inpMail) inpMail.value = u.email;
    const inpSaldo = document.getElementById('mobInputPerfilSaldoInicial');
    if (inpSaldo) inpSaldo.value = (Finanzas.state.saldoInicial || 0).toFixed(2);
    document.getElementById('modalMobileEditarPerfil')?.classList.remove('hidden');
  }
  closeModalEditarPerfil() {
    document.getElementById('modalMobileEditarPerfil')?.classList.add('hidden');
  }
  handlePerfil(e) {
    e.preventDefault();
    const nombre = document.getElementById('mobInputPerfilNombre')?.value ? document.getElementById('mobInputPerfilNombre').value.trim() : '';
    const email = document.getElementById('mobInputPerfilEmail')?.value ? document.getElementById('mobInputPerfilEmail').value.trim() : '';
    const saldoInicialInput = document.getElementById('mobInputPerfilSaldoInicial');
    const saldoInicial = saldoInicialInput && saldoInicialInput.value.trim() !== ''
      ? Number(saldoInicialInput.value)
      : null;

    Finanzas.actualizarPerfil({ nombre, email });
    if (saldoInicial !== null && Number.isFinite(saldoInicial)) {
      Finanzas.actualizarSaldoInicial(saldoInicial);
    }
    this.closeModalEditarPerfil();
    this.mostrarToast('✔ Perfil guardado');
  }

  // Académico
  openModalAcademic() {
    document.getElementById('modalMobileAcademic')?.classList.remove('hidden');
  }
  closeModalAcademic() {
    document.getElementById('modalMobileAcademic')?.classList.add('hidden');
  }

  // Acciones generales
  eliminarMovimiento(id) {
    if (confirm('¿Eliminar movimiento?')) {
      Finanzas.eliminarMovimiento(id);
      this.mostrarToast('Movimiento eliminado');
    }
  }

  eliminarMeta(id) {
    if (confirm('¿Eliminar esta meta de ahorro?')) {
      Finanzas.eliminarMeta(id);
      this.mostrarToast('Meta eliminada');
    }
  }

  eliminarDeuda(id) {
    if (confirm('¿Eliminar esta deuda?')) {
      Finanzas.eliminarDeuda(id);
      this.mostrarToast('Deuda eliminada');
    }
  }

  toggleOcultarSaldo() {
    Finanzas.toggleSaldoOculto();
    this.renderAll();
    this.mostrarToast('Visibilidad de saldo conmutada');
  }

  cambiarMes(delta) {
    Finanzas.cambiarPeriodo(delta);
    this.renderAll();
    this.mostrarToast(`Visualizando: ${Finanzas.getNombrePeriodo()}`);
  }

  toggleAlertaPresupuesto(checked) {
    Finanzas.state.usuario.alertasPresupuesto = checked;
    Finanzas.saveState();
    this.mostrarToast(checked ? 'Alertas activadas' : 'Alertas pausadas');
  }

  toggleRecordatoriosDeudas(checked) {
    Finanzas.state.usuario.recordatoriosDeudas = checked;
    Finanzas.saveState();
    this.mostrarToast(checked ? 'Recordatorios activados' : 'Recordatorios pausados');
  }

  exportarCSV() {
    let csv = 'ID,Tipo,Concepto,Categoria,Cuenta,Monto_COP,Fecha\n';
    Finanzas.getMovimientosPeriodo().forEach(m => {
      csv += `${escaparCSV(m.id)},${escaparCSV(m.tipo)},${escaparCSV(m.concepto)},${escaparCSV(m.categoria)},${escaparCSV(m.cuenta || 'Principal')},${(Number(m.valor) || 0).toFixed(2)},${escaparCSV(m.fecha)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodoLabel = `${Finanzas.state.periodoAnio}_${String(Finanzas.state.periodoMes + 1).padStart(2, '0')}`;
    a.download = `mibolsillo_movimientos_${periodoLabel}_movil.csv`;
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    this.mostrarToast('📥 CSV descargado');
  }

  imprimirPDF() {
    this.switchTab('informes');
    this.mostrarToast('Abriendo diálogo para imprimir o guardar como PDF...');
    setTimeout(() => window.print(), 350);
  }

  exportarJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(Finanzas.state, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    const periodoLabel = `${Finanzas.state.periodoAnio}_${String(Finanzas.state.periodoMes + 1).padStart(2, '0')}`;
    a.download = `mibolsillo_backup_${periodoLabel}_movil.json`;
    a.click();
    this.mostrarToast('💾 Copia JSON guardada');
  }

  restablecerDatos() {
    if (confirm('¿Restablecer datos a la configuración inicial?')) {
      Finanzas.resetState();
      this.mostrarToast('🔄 Datos iniciales restaurados');
    }
  }

  mostrarToast(mensaje) {
    const container = document.getElementById('mobileToastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'mobile-toast';
    toast.textContent = mensaje;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }
}

// Inicializar versión móvil
const mobileApp = new MobileApp();
