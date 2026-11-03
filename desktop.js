/**
 * ============================================================================
 * PROYECTO: MiBolsillo · Control de Finanzas Personales
 * ARCHIVO: desktop.js
 * ROL: Controlador Exclusivo para la Versión de Escritorio (PC)
 * ============================================================================
 */

class DesktopApp {
  constructor() {
    this.currentView = 'inicio';
    this.currentMovFilter = 'TODOS';
    this.formType = 'GASTO';
    this.formCategory = 'Alimentación';
    this.modalQuickType = 'GASTO';

    // Instancias de Chart.js
    this.chartDashboard = null;
    this.chartInformesBars = null;
    this.chartInformesDonut = null;

    // Inicializar tanto si el script se carga antes como después del DOM.
    this.initialized = false;
    this._savingMovement = false;
    this._savingQuickMovement = false;
    this._lastMovementSignature = '';
    this._lastMovementAt = 0;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init(), { once: true });
    } else {
      this.init();
    }
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Suscribirse a cambios en el núcleo compartido.
    Finanzas.subscribe(() => this.renderAll());
    document.addEventListener('click', (event) => this.handleDynamicAction(event));

    // Los formularios ya tienen un único onsubmit en el HTML.
    // No registrar otro listener global: provocaba dos llamadas por envío.

    configurarEntradasMonetarias();

    // Configurar fechas por defecto en inputs
    const hoyStr = obtenerFechaHoyISO();
    const inputFecha = document.getElementById('regInputFecha');
    if (inputFecha) inputFecha.value = hoyStr;
    const inputQuickFecha = document.getElementById('modalQuickFecha');
    if (inputQuickFecha) inputQuickFecha.value = hoyStr;

    // Renderizar categorías del formulario de registro
    this.renderCategoryGrid();
    this.updateLiveImpact();

    // Renderizar toda la interfaz
    this.renderAll();

    // Atajo de teclado: Ctrl + K para enfocar búsqueda
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('pcGlobalSearch');
        if (searchInput) searchInput.focus();
      }
    });
  }

  handleDynamicAction(event) {
    const button = event.target.closest('[data-pc-action]');
    if (!button) return;

    const { pcAction, recordId, recordName, categoryId } = button.dataset;
    switch (pcAction) {
      case 'delete-movement':
        this.eliminarMovimiento(recordId);
        break;
      case 'select-category':
        this.selectCategory(categoryId);
        break;
      case 'save-movement':
      case 'guardar-movimiento':
      case 'registrar-movimiento':
        event.preventDefault();
        this.handleGuardarMovimientoForm();
        break;
      case 'save-quick-movement':
      case 'guardar-movimiento-rapido':
        event.preventDefault();
        this.handleQuickMovementSubmit(event);
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

  // ==========================================================================
  // NAVEGACIÓN Y CAMBIO DE PANTALLA
  // ==========================================================================
  switchView(viewId) {
    this.currentView = viewId;

    // Actualizar botones de navegación en sidebar
    document.querySelectorAll('.nav-item-btn').forEach(btn => {
      if (btn.getAttribute('data-view') === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Actualizar secciones de vista
    document.querySelectorAll('.pc-view').forEach(view => {
      view.classList.remove('active');
    });

    const target = document.getElementById(`view-${viewId}`);
    if (target) {
      target.classList.add('active');
    }

    // Actualizar breadcrumb superior
    const breadcrumbMap = {
      'inicio': 'Balance general',
      'movimientos': 'Historial de movimientos',
      'registrar': 'Registrar nuevo movimiento',
      'plan': 'Mi plan · Control presupuestal',
      'metas': 'Metas de ahorro',
      'deudas': 'Deudas y obligaciones',
      'informes': 'Informes y analítica',
      'perfil': 'Tu espacio · Perfil y ajustes'
    };
    const titleEl = document.getElementById('lblBreadcrumbTitle');
    if (titleEl) titleEl.textContent = breadcrumbMap[viewId] || 'Finanzas personales';

    // Si entra a inicio o informes, actualizar gráficos correspondientes
    if (viewId === 'inicio') {
      setTimeout(() => this.renderDashboardChart(), 50);
    } else if (viewId === 'informes') {
      setTimeout(() => this.renderInformesCharts(), 50);
    } else if (viewId === 'registrar') {
      this.updateLiveImpact();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================================================
  // RENDERIZADO GLOBAL
  // ==========================================================================
  renderAll() {
    this.renderUserMeta();
    this.renderKPIs();
    this.renderDashboardAlerts();
    this.renderDashboardMovements();
    this.renderDashboardMetas();
    this.renderDashboardBudgetBreakdown();
    this.renderMovimientos();
    this.renderPlanView();
    this.renderMetasView();
    this.renderDeudasView();
    this.renderInformesView();
    this.renderPerfilView();

    // Actualizar gráficos si están visibles
    if (this.currentView === 'inicio') {
      this.renderDashboardChart();
    } else if (this.currentView === 'informes') {
      this.renderInformesCharts();
    }
  }

  // Metadatos de usuario
  renderUserMeta() {
    const u = Finanzas.state.usuario;
    const nameEl = document.getElementById('lblDashboardUser');
    if (nameEl) nameEl.textContent = u.nombre.split(' ')[0] || 'Usuario';
    const sideName = document.getElementById('sidebarUserName');
    if (sideName) sideName.textContent = u.nombre;
    const sideAvatar = document.getElementById('sidebarAvatar');
    if (sideAvatar) sideAvatar.textContent = u.iniciales;
  }

  // ==========================================================================
  // TARJETAS KPI SUPERIORES (DISTINCIÓN MENSUAL VS GLOBAL)
  // ==========================================================================
  renderKPIs() {
    const isHidden = Finanzas.state.saldoOculto;

    // Saldo Total Disponible: GLOBAL (saldoInicial + Σ ingresos - Σ gastos)
    const saldoTotal = Finanzas.calcSaldoTotal();

    // Ingresos y Gastos: DEL PERÍODO SELECCIONADO
    const ingresos = Finanzas.calcTotalIngresos();
    const gastos = Finanzas.calcTotalGastos();
    const balance = Finanzas.calcBalanceNeto();
    const budgetStatus = Finanzas.calcPresupuestoStatus();

    // Etiqueta del período actual en Inicio
    const elMonth = document.getElementById('lblDashboardMonth');
    if (elMonth) {
      elMonth.textContent = Finanzas.getNombrePeriodo();
    }

    // Saldo Total (Global)
    const elSaldo = document.getElementById('kpiSaldoTotal');
    if (elSaldo) {
      elSaldo.textContent = isHidden ? '•••••••• COP' : formatCOP(saldoTotal);
    }

    // Ingresos (Período)
    const elIngresos = document.getElementById('kpiIngresos');
    if (elIngresos) {
      elIngresos.textContent = isHidden ? '•••••••• COP' : `+${formatCOP(ingresos)}`;
    }

    // Gastos (Período)
    const elGastos = document.getElementById('kpiGastos');
    if (elGastos) {
      elGastos.textContent = isHidden ? '•••••••• COP' : `-${formatCOP(gastos)}`;
    }

    // Badge porcentaje de presupuesto en Inicio
    const elPresBadge = document.getElementById('kpiPorcentajePresupuestoBadge');
    if (elPresBadge) {
      elPresBadge.textContent = `${budgetStatus.porcentajeReal}% del presupuesto`;
    }

    // Badge balance neto en tarjeta de gráfico
    const elBadgeBal = document.getElementById('badgeBalanceNeto');
    if (elBadgeBal) {
      elBadgeBal.textContent = `Balance del período: ${formatCOP(balance, true)}`;
      elBadgeBal.className = balance >= 0 ? 'kpi-sub-badge green' : 'kpi-sub-badge red';
    }

    // Presupuesto card en Inicio
    const lblSub = document.getElementById('lblBudgetSubtitle');
    if (lblSub) lblSub.textContent = `${formatCOP(gastos)} / ${formatCOP(budgetStatus.limite)}`;
    const lblPercent = document.getElementById('lblBudgetPercentLarge');
    if (lblPercent) lblPercent.textContent = `${budgetStatus.porcentajeReal} %`;
    const barLarge = document.getElementById('barBudgetLarge');
    if (barLarge) {
      barLarge.style.width = `${budgetStatus.porcentaje}%`;
      barLarge.className = 'progress-fill ' + (budgetStatus.porcentajeReal > 90 ? 'red' : (budgetStatus.porcentajeReal > 75 ? 'yellow' : 'green'));
    }
    const lblAvail = document.getElementById('lblBudgetAvailableText');
    if (lblAvail) {
      if (budgetStatus.disponible > 0) {
        lblAvail.textContent = `Te quedan ${formatCOP(budgetStatus.disponible)} disponibles para este mes.`;
      } else {
        lblAvail.textContent = `Has sobrepasado el límite por ${formatCOP(budgetStatus.exceso)}.`;
      }
    }
  }

  // ==========================================================================
  // ALERTAS DE LÓGICA PROPOSICIONAL
  // ==========================================================================
  renderDashboardAlerts() {
    const container = document.getElementById('pcDashboardAlerts');
    if (!container) return;

    const alertas = Finanzas.evaluarAlertas();
    if (alertas.length === 0) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    alertas.forEach(a => {
      html += `
        <div class="alert-notice-box ${escapeHTML(a.tipo)}">
          <span style="font-size: 1.25rem;">${escapeHTML(a.icono)}</span>
          <div>
            <strong>${escapeHTML(a.titulo)}</strong>
            <p>${escapeHTML(a.mensaje)}</p>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // ==========================================================================
  // ÚLTIMOS MOVIMIENTOS EN INICIO (DASHBOARD)
  // ==========================================================================
  renderDashboardMovements() {
    const tbody = document.getElementById('tableRecentMovements');
    if (!tbody) return;

    const recents = Finanzas.getMovimientosPeriodo()
      .slice()
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 5);
    if (recents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--pc-text-muted);">No hay movimientos registrados.</td></tr>';
      return;
    }

    let html = '';
    recents.forEach(m => {
      const isIncome = m.tipo === 'INGRESO';
      const sign = isIncome ? '+' : '-';
      const colorClass = isIncome ? 'income' : 'expense';
      const cat = (isIncome ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO).find(c => c.id === m.categoria) || { icon: '🏷️' };

      html += `
        <tr>
          <td>
            <strong>${escapeHTML(m.concepto)}</strong>
          </td>
          <td>
            <span class="table-category-badge">
              <span>${cat.icon}</span> ${escapeHTML(m.categoria)}
            </span>
          </td>
          <td>${escapeHTML(m.fecha)}</td>
          <td><span style="font-size: 0.8rem; color: var(--pc-text-muted);">${escapeHTML(m.cuenta || 'Principal')}</span></td>
          <td class="table-amount-cell ${colorClass}">${sign}${formatCOP(m.valor)}</td>
          <td>
            <button class="btn-table-action" data-pc-action="delete-movement" data-record-id="${escapeHTMLAttribute(m.id)}" title="Eliminar">🗑️</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  // ==========================================================================
  // METAS EN DASHBOARD
  // ==========================================================================
  renderDashboardMetas() {
    const container = document.getElementById('dashboardMetasList');
    if (!container) return;

    const metas = Finanzas.state.metas.slice(0, 3);
    let html = '';
    metas.forEach(m => {
      const pct = m.objetivo > 0 ? Math.min(100, Math.round((m.ahorrado / m.objetivo) * 100)) : 0;
      html += `
        <div style="background: var(--pc-bg); padding: 0.75rem 1rem; border-radius: var(--radius-md);">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.25rem;">
            <span>${escapeHTML(m.nombre)}</span>
            <span>${pct}%</span>
          </div>
          <div class="progress-container">
            <div class="progress-fill green" style="width: ${pct}%;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--pc-text-muted);">
            <span>${formatCOP(m.ahorrado)}</span>
            <span>Meta: ${formatCOP(m.objetivo)}</span>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    const totalMetasHeader = document.getElementById('lblTotalMetasHeader');
    if (totalMetasHeader) {
      totalMetasHeader.textContent = `${formatCOP(Finanzas.calcTotalAhorradoMetas())} ahorrados`;
    }
  }

  // ==========================================================================
  // CATEGORÍAS EN PRESUPUESTO DE DASHBOARD
  // ==========================================================================
  renderDashboardBudgetBreakdown() {
    const container = document.getElementById('dashboardCategoryBudgetsList');
    if (!container) return;

    const gastosCat = Finanzas.calcGastosPorCategoria();
    let html = '';
    const topCats = ['Vivienda', 'Alimentación', 'Transporte', 'Ocio'];

    topCats.forEach(catId => {
      const gastado = gastosCat[catId] || 0;
      const limite = Finanzas.state.limitesCategorias[catId] || 300000;
      const pct = limite > 0 ? Math.min(100, Math.round((gastado / limite) * 100)) : 0;
      const colorClass = pct > 90 ? 'red' : (pct > 75 ? 'yellow' : 'green');

      html += `
        <div class="category-budget-item">
          <div class="category-item-meta">
            <span>${escapeHTML(catId)}</span>
            <span>${pct}%</span>
          </div>
          <div class="progress-container">
            <div class="progress-fill ${colorClass}" style="width: ${pct}%;"></div>
          </div>
          <div class="category-item-values">
            <span>${formatCOP(gastado)} de ${formatCOP(limite)}</span>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // ==========================================================================
  // PANTALLA 2: HISTORIAL DE MOVIMIENTOS CON FILTROS (DEL PERÍODO SELECCIONADO)
  // ==========================================================================
  setMovFilter(filter) {
    this.currentMovFilter = filter;
    ['btnFilterTodos', 'btnFilterIngresos', 'btnFilterGastos'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.remove('active');
    });

    if (filter === 'TODOS') document.getElementById('btnFilterTodos')?.classList.add('active');
    if (filter === 'INGRESO') document.getElementById('btnFilterIngresos')?.classList.add('active');
    if (filter === 'GASTO') document.getElementById('btnFilterGastos')?.classList.add('active');

    this.renderMovimientos();
  }

  renderMovimientos() {
    const tbody = document.getElementById('tableFullMovements');
    if (!tbody) return;

    // Actualizar KPIs de Movimientos (del período seleccionado)
    const kpiIng = document.getElementById('movKpiIngresos');
    if (kpiIng) kpiIng.textContent = `+${formatCOP(Finanzas.calcTotalIngresos())}`;
    const kpiGas = document.getElementById('movKpiGastos');
    if (kpiGas) kpiGas.textContent = `-${formatCOP(Finanzas.calcTotalGastos())}`;
    const kpiBal = document.getElementById('movKpiBalance');
    if (kpiBal) kpiBal.textContent = formatCOP(Finanzas.calcBalanceNeto(), true);

    const filterType = this.currentMovFilter;
    const catSelect = document.getElementById('selectMovCategory')?.value || 'TODAS';
    const textSearch = (document.getElementById('inputMovSearchTable')?.value || '').toLowerCase().trim();

    // Filtra por el período seleccionado
    let items = Finanzas.getMovimientosPeriodo();

    if (filterType !== 'TODOS') {
      items = items.filter(m => m.tipo === filterType);
    }
    if (catSelect !== 'TODAS') {
      items = items.filter(m => m.categoria === catSelect);
    }
    if (textSearch) {
      items = items.filter(m => 
        (m.concepto || '').toLowerCase().includes(textSearch) || 
        (m.categoria || '').toLowerCase().includes(textSearch) ||
        (m.cuenta || '').toLowerCase().includes(textSearch)
      );
    }

    const countLabel = document.getElementById('lblTableTotalCount');
    if (countLabel) {
      countLabel.textContent = `Mostrando ${items.length} movimientos de ${Finanzas.getNombrePeriodo()} (${Finanzas.state.movimientos.length} históricos)`;
    }

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--pc-text-muted);">No hay movimientos registrados en ${Finanzas.getNombrePeriodo()} con los filtros aplicados.</td></tr>`;
      return;
    }

    let html = '';
    items.forEach(m => {
      const isIncome = m.tipo === 'INGRESO';
      const sign = isIncome ? '+' : '-';
      const colorClass = isIncome ? 'income' : 'expense';
      const icon = isIncome ? '↙' : '↗';
      const catObj = (isIncome ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO).find(c => c.id === m.categoria) || { icon: '🏷️' };

      html += `
        <tr>
          <td><span style="font-weight: 700; color: ${isIncome ? 'var(--pc-green)' : 'var(--pc-red)'}">${icon} ${escapeHTML(m.tipo)}</span></td>
          <td><strong>${escapeHTML(m.concepto)}</strong></td>
          <td><span class="table-category-badge">${catObj.icon} ${escapeHTML(m.categoria)}</span></td>
          <td>${escapeHTML(m.fecha)}</td>
          <td><span style="font-size: 0.8rem; color: var(--pc-text-muted);">${escapeHTML(m.cuenta || 'Principal')}</span></td>
          <td class="table-amount-cell ${colorClass}">${sign}${formatCOP(m.valor)}</td>
          <td>
            <button class="btn-table-action" data-pc-action="delete-movement" data-record-id="${escapeHTMLAttribute(m.id)}" title="Eliminar registro">🗑️</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  // ==========================================================================
  // PANTALLA 3: FORMULARIO DEDICADO DE REGISTRAR MOVIMIENTO
  // ==========================================================================
  setFormType(tipo) {
    this.formType = tipo;
    const btnGasto = document.getElementById('regTypeGasto');
    const btnIngreso = document.getElementById('regTypeIngreso');

    if (tipo === 'GASTO') {
      btnGasto?.classList.add('active', 'expense');
      btnIngreso?.classList.remove('active', 'income');
      this.formCategory = 'Alimentación';
    } else {
      btnIngreso?.classList.add('active', 'income');
      btnGasto?.classList.remove('active', 'expense');
      this.formCategory = 'Salario';
    }

    this.renderCategoryGrid();
    this.updateLiveImpact();
  }

  renderCategoryGrid() {
    const grid = document.getElementById('regCategoryGrid');
    if (!grid) return;

    const cats = this.formType === 'GASTO' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;
    let html = '';
    cats.forEach(c => {
      const isSelected = c.id === this.formCategory;
      html += `
        <button type="button" class="btn-category-card ${isSelected ? 'selected' : ''}" data-pc-action="select-category" data-category-id="${escapeHTMLAttribute(c.id)}">
          <span class="cat-icon">${c.icon}</span>
          <span class="cat-name">${escapeHTML(c.nombre)}</span>
        </button>
      `;
    });
    grid.innerHTML = html;
  }

  selectCategory(catId) {
    this.formCategory = catId;
    this.renderCategoryGrid();
    this.updateLiveImpact();
  }

  updateLiveImpact() {
    const inputVal = document.getElementById('regInputMonto');
    const rawVal = Number(inputVal?.value || 0);
    const valor = (isFinite(rawVal) && rawVal > 0) ? rawVal : 0;
    const isIncome = this.formType === 'INGRESO';

    const lblAmount = document.getElementById('lblLiveImpactAmount');
    if (lblAmount) {
      lblAmount.textContent = isIncome ? `+${formatCOP(valor)}` : `-${formatCOP(valor)}`;
      lblAmount.className = 'impact-amount-preview ' + (isIncome ? 'income' : 'expense');
    }

    const lblCat = document.getElementById('lblLiveImpactCategory');
    if (lblCat) lblCat.textContent = this.formCategory;

    const saldoActual = Finanzas.calcSaldoTotal();
    const lblCurBal = document.getElementById('lblLiveCurrentBalance');
    if (lblCurBal) lblCurBal.textContent = formatCOP(saldoActual);

    const saldoProyectado = isIncome ? saldoActual + valor : saldoActual - valor;
    const lblProjBal = document.getElementById('lblLiveProjectedBalance');
    if (lblProjBal) lblProjBal.textContent = formatCOP(saldoProyectado);

    const presStatus = Finanzas.calcPresupuestoStatus();
    const impactPct = presStatus.limite > 0 ? ((valor / presStatus.limite) * 100).toFixed(1) : '0.0';
    const lblImp = document.getElementById('lblLiveBudgetImpact');
    if (lblImp) lblImp.textContent = isIncome ? 'Aporte a liquidez' : `+${impactPct}% del presupuesto`;

    // Notificación lógica si excede
    const logicNotice = document.getElementById('liveLogicNoticeArea');
    if (logicNotice) {
      if (!isIncome && presStatus.limite > 0 && (presStatus.gastado + valor > presStatus.limite)) {
        logicNotice.innerHTML = `
          <div class="alert-notice-box advertencia" style="padding: 0.6rem; margin: 0;">
            <span style="font-size: 1rem;">⚠️</span>
            <p style="font-size: 0.78rem;">Este desembolso superará el presupuesto mensual disponible.</p>
          </div>
        `;
      } else {
        logicNotice.innerHTML = '';
      }
    }
  }

  handleGuardarMovimientoForm() {
    if (this._savingMovement) return;
    this._savingMovement = true;
    if (typeof Finanzas === 'undefined' || !Finanzas || typeof Finanzas.agregarMovimiento !== 'function') {
      alert('No se pudo iniciar el módulo financiero. Comprueba que shared.js se cargue antes de desktop.js.');
      console.error('MiBolsillo: Finanzas no está disponible.');
      this._savingMovement = false;
      return;
    }

    const inputMonto = document.getElementById('regInputMonto');
    const inputConcepto = document.getElementById('regInputConcepto');
    const inputFecha = document.getElementById('regInputFecha');
    const selectCuenta = document.getElementById('regSelectCuenta');

    const valor = Number(inputMonto?.value);
    const concepto = inputConcepto?.value ? inputConcepto.value.trim() : '';
    const fecha = inputFecha?.value || obtenerFechaHoyISO();
    const cuenta = selectCuenta?.value || 'Principal';

    if (!isFinite(valor) || valor <= 0) {
      alert('Por favor ingrese un valor numérico válido mayor a cero.');
      this._savingMovement = false;
      return;
    }
    if (!concepto) {
      alert('Por favor ingrese una descripción para el movimiento.');
      this._savingMovement = false;
      return;
    }

    const fechaLocal = new Date(`${fecha}T12:00:00`);
    if (!Number.isNaN(fechaLocal.getTime())) {
      Finanzas.state.periodoAnio = fechaLocal.getFullYear();
      Finanzas.state.periodoMes = fechaLocal.getMonth();
    }

    const signature = [this.formType, valor, concepto.toLocaleLowerCase(), this.formCategory, fecha].join('|');
    const now = Date.now();
    if (signature === this._lastMovementSignature && now - this._lastMovementAt < 1200) {
      this._savingMovement = false;
      return;
    }
    this._lastMovementSignature = signature;
    this._lastMovementAt = now;

    let res;
    try {
      res = Finanzas.agregarMovimiento({
        tipo: this.formType,
        concepto,
        categoria: this.formCategory,
        cuenta,
        valor,
        fecha
      });
    } catch (error) {
      console.error('Error al registrar el movimiento:', error);
      alert('Ocurrió un error al registrar el movimiento. Revisa la consola del navegador (F12).');
      this._savingMovement = false;
      return;
    }

    if (!res || res.error) {
      alert(res?.error || 'No fue posible registrar el movimiento.');
      this._savingMovement = false;
      return;
    }

    const guardado = Array.isArray(Finanzas.state?.movimientos) && Finanzas.state.movimientos.some(m => m.id === res.id);
    if (!guardado) {
      alert('El sistema no confirmó el registro del movimiento. No se cerró el formulario.');
      this._savingMovement = false;
      return;
    }

    // La operación debe reflejarse en el historial aunque el almacenamiento
    // persistente del navegador esté bloqueado; en ese caso avisamos claramente.
    const persistencia = Finanzas.lastPersistence;
    if (persistencia && persistencia.persistent === false) {
      this.showToast('Movimiento agregado, pero el navegador no confirmó el guardado permanente.');
    } else {
      this.showToast('✔ Movimiento registrado con éxito.');
    }
    setTimeout(() => { this._savingMovement = false; }, 600);
    this.switchView('movimientos');
  }

  // ==========================================================================
  // PANTALLA 4: MI PLAN (PRESUPUESTO DETALLADO)
  // ==========================================================================
  renderPlanView() {
    const presStatus = Finanzas.calcPresupuestoStatus();
    const planKpiLim = document.getElementById('planKpiLimite');
    if (planKpiLim) planKpiLim.textContent = formatCOP(presStatus.limite);
    const planKpiGas = document.getElementById('planKpiGastado');
    if (planKpiGas) planKpiGas.textContent = formatCOP(presStatus.gastado);
    const planKpiPct = document.getElementById('planKpiPorcentaje');
    if (planKpiPct) planKpiPct.textContent = `${presStatus.porcentajeReal}% consumido`;
    const planKpiDisp = document.getElementById('planKpiDisponible');
    if (planKpiDisp) planKpiDisp.textContent = formatCOP(presStatus.disponible);

    const gaugePct = document.getElementById('lblPlanGaugePercent');
    if (gaugePct) gaugePct.textContent = `${presStatus.porcentajeReal}%`;

    // Sincronizar checkbox de alerta en view-plan
    const chkPlanPres = document.getElementById('chkAlertasPresupuestoPlan');
    if (chkPlanPres) chkPlanPres.checked = Finanzas.state.usuario.alertasPresupuesto !== false;
    const chkPlanRec = document.getElementById('chkRecordatoriosPlan');
    if (chkPlanRec) chkPlanRec.checked = Finanzas.state.usuario.recordatoriosDeudas !== false;

    // Renderizar categorías detalladas
    const container = document.getElementById('planDetailedCategoriesList');
    if (!container) return;

    const gastosCat = Finanzas.calcGastosPorCategoria();
    let html = '';

    CATEGORIAS_GASTO.forEach(c => {
      const gastado = gastosCat[c.id] || 0;
      const limite = Finanzas.state.limitesCategorias[c.id] || 300000;
      const pct = limite > 0 ? Math.min(100, Math.round((gastado / limite) * 100)) : 0;
      const colorClass = pct > 90 ? 'red' : (pct > 75 ? 'yellow' : 'green');

      html += `
        <div style="background: var(--pc-bg); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; color: var(--pc-text-title);">
              <span style="font-size: 1.25rem;">${c.icon}</span>
              <span>${escapeHTML(c.nombre)}</span>
            </div>
            <strong style="color: ${pct > 90 ? 'var(--pc-red)' : 'var(--pc-teal-dark)'};">${pct}%</strong>
          </div>
          <div class="progress-container big">
            <div class="progress-fill ${colorClass}" style="width: ${pct}%;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--pc-text-muted); margin-top: 0.25rem;">
            <span>Gastado: ${formatCOP(gastado)}</span>
            <span>Límite: ${formatCOP(limite)}</span>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    // Alertas en el plan
    const alertsCont = document.getElementById('planAlertsContainer');
    if (alertsCont) {
      const alerts = Finanzas.evaluarAlertas();
      let aHtml = '';
      alerts.forEach(a => {
        aHtml += `
          <div class="alert-notice-box ${escapeHTML(a.tipo)}" style="margin-bottom: 0.75rem; padding: 0.75rem;">
            <span style="font-size: 1.1rem;">${escapeHTML(a.icono)}</span>
            <div>
              <strong style="font-size: 0.82rem;">${escapeHTML(a.titulo)}</strong>
              <p style="font-size: 0.76rem;">${escapeHTML(a.mensaje)}</p>
            </div>
          </div>
        `;
      });
      alertsCont.innerHTML = aHtml;
    }
  }

  // ==========================================================================
  // PANTALLA 5: METAS DE AHORRO
  // ==========================================================================
  renderMetasView() {
    const totAhorrado = Finanzas.calcTotalAhorradoMetas();
    const totObjetivo = Finanzas.calcTotalObjetivoMetas();
    const restante = Math.max(0, totObjetivo - totAhorrado);

    const kpiTot = document.getElementById('metasKpiTotalAhorrado');
    if (kpiTot) kpiTot.textContent = formatCOP(totAhorrado);
    const kpiObj = document.getElementById('metasKpiObjetivoTotal');
    if (kpiObj) kpiObj.textContent = formatCOP(totObjetivo);
    const kpiRes = document.getElementById('metasKpiRestante');
    if (kpiRes) kpiRes.textContent = formatCOP(restante);

    // Grid de Metas
    const grid = document.getElementById('metasCardsGrid');
    if (!grid) return;

    let html = '';
    Finanzas.state.metas.forEach(m => {
      // El porcentaje de avance visual se limita al 100%, pero el monto real ahorrado se conserva íntegro
      const pct = m.objetivo > 0 ? Math.min(100, Math.round((m.ahorrado / m.objetivo) * 100)) : 0;
      html += `
        <div class="goal-card">
          <div>
            <div class="goal-card-header">
              <div>
                <h4 class="goal-card-title">${escapeHTML(m.nombre)}</h4>
                <span class="goal-card-deadline">${escapeHTML(m.plazo)}</span>
              </div>
              <span class="top-notice-badge">${pct}%</span>
            </div>

            <div class="goal-card-amounts">
              <span class="goal-current-amount">${formatCOP(m.ahorrado)}</span>
              <span class="goal-target-amount">de ${formatCOP(m.objetivo)}</span>
            </div>

            <div class="progress-container big" style="margin: 0.75rem 0;">
              <div class="progress-fill green" style="width: ${pct}%;"></div>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-card-action" data-pc-action="contribute-goal" data-record-id="${escapeHTMLAttribute(m.id)}" data-record-name="${escapeHTMLAttribute(m.nombre)}">
              + Aportar
            </button>
            <button class="btn-table-action" style="margin-top: 1rem; border: 1px solid var(--pc-border);" data-pc-action="delete-goal" data-record-id="${escapeHTMLAttribute(m.id)}" title="Eliminar meta">
              🗑️
            </button>
          </div>
        </div>
      `;
    });
    grid.innerHTML = html;

    // Tabla de Aportes
    const tbody = document.getElementById('tableAportesMetas');
    if (tbody) {
      if (Finanzas.state.aportesMetas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--pc-text-muted);">Sin aportes registrados aún.</td></tr>';
      } else {
        let tHtml = '';
        Finanzas.state.aportesMetas.forEach(ap => {
          tHtml += `
            <tr>
              <td>${escapeHTML(ap.fecha)}</td>
              <td><strong>${escapeHTML(ap.metaNombre)}</strong></td>
              <td class="table-amount-cell income">+${formatCOP(ap.valor)}</td>
              <td><span class="kpi-sub-badge green">Acreditado</span></td>
            </tr>
          `;
        });
        tbody.innerHTML = tHtml;
      }
    }
  }

  // ==========================================================================
  // PANTALLA 6: DEUDAS Y OBLIGACIONES
  // ==========================================================================
  renderDeudasView() {
    const totPendiente = Finanzas.calcTotalDeudasPendientes();
    const totPagado = Finanzas.calcTotalDeudasPagado();

    const kpiPend = document.getElementById('deudasKpiPendiente');
    if (kpiPend) kpiPend.textContent = formatCOP(totPendiente);
    const kpiPag = document.getElementById('deudasKpiPagado');
    if (kpiPag) kpiPag.textContent = formatCOP(totPagado);

    const grid = document.getElementById('deudasCardsGrid');
    if (!grid) return;

    let html = '';
    Finanzas.state.deudas.forEach(d => {
      const pagado = Math.max(0, d.valorInicial - d.saldoPendiente);
      const pct = d.valorInicial > 0 ? Math.min(100, Math.round((pagado / d.valorInicial) * 100)) : 0;

      html += `
        <div class="debt-card">
          <div>
            <div class="debt-card-header">
              <div>
                <h4 class="debt-card-title">${escapeHTML(d.nombre)}</h4>
                <span class="debt-card-sub">${escapeHTML(d.condiciones)}</span>
              </div>
              <span class="kpi-sub-badge red">Vence: ${escapeHTML(d.proximoPago)}</span>
            </div>

            <div class="debt-card-amounts">
              <div>
                <span style="font-size: 0.78rem; color: var(--pc-text-muted);">Saldo pendiente:</span>
                <div class="debt-pending-amount">${formatCOP(d.saldoPendiente)}</div>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 0.78rem; color: var(--pc-text-muted);">Cuota mensual:</span>
                <strong style="display: block; font-size: 1rem;">${formatCOP(d.cuotaMensual)}</strong>
              </div>
            </div>

            <div class="progress-container big" style="margin: 0.75rem 0;">
              <div class="progress-fill yellow" style="width: ${pct}%;"></div>
            </div>
            <div style="font-size: 0.75rem; color: var(--pc-text-muted); display: flex; justify-content: space-between;">
              <span>Amortizado: ${pct}%</span>
              <span>Inicial: ${formatCOP(d.valorInicial)}</span>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-card-action" data-pc-action="pay-debt" data-record-id="${escapeHTMLAttribute(d.id)}" data-record-name="${escapeHTMLAttribute(d.nombre)}">
              + Registrar abono
            </button>
            <button class="btn-table-action" style="margin-top: 1rem; border: 1px solid var(--pc-border);" data-pc-action="delete-debt" data-record-id="${escapeHTMLAttribute(d.id)}" title="Eliminar deuda">
              🗑️
            </button>
          </div>
        </div>
      `;
    });
    grid.innerHTML = html;

    // Tabla de abonos
    const tbody = document.getElementById('tableAbonosDeudas');
    if (tbody) {
      if (Finanzas.state.abonosDeudas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--pc-text-muted);">Sin abonos registrados aún.</td></tr>';
      } else {
        let tHtml = '';
        Finanzas.state.abonosDeudas.forEach(ab => {
          tHtml += `
            <tr>
              <td>${escapeHTML(ab.fecha)}</td>
              <td><strong>${escapeHTML(ab.deudaNombre)}</strong></td>
              <td class="table-amount-cell expense">-${formatCOP(ab.valor)}</td>
              <td><span class="kpi-sub-badge green">Pagado</span></td>
            </tr>
          `;
        });
        tbody.innerHTML = tHtml;
      }
    }
  }

  // ==========================================================================
  // PANTALLA 7: INFORMES Y ANALÍTICA
  // ==========================================================================
  renderInformesView() {
    const balNeto = Finanzas.calcBalanceNeto();
    const tasaAhorro = Finanzas.calcTasaAhorro();
    const ing = Finanzas.calcTotalIngresos();
    const gas = Finanzas.calcTotalGastos();

    const elBal = document.getElementById('infKpiBalanceNeto');
    if (elBal) elBal.textContent = formatCOP(balNeto, true);
    const elTasa = document.getElementById('infKpiTasaAhorro');
    if (elTasa) elTasa.textContent = `Tasa de ahorro (metas): ${tasaAhorro} %`;
    const elIng = document.getElementById('infKpiIngresos');
    if (elIng) elIng.textContent = `+${formatCOP(ing)}`;
    const elGas = document.getElementById('infKpiGastos');
    if (elGas) elGas.textContent = `-${formatCOP(gas)}`;

    // Tabla de desglose por categoría
    const tbody = document.getElementById('tableCategoryBreakdown');
    if (tbody) {
      const gastosCat = Finanzas.calcGastosPorCategoria();
      let html = '';
      CATEGORIAS_GASTO.forEach(c => {
        const gastado = gastosCat[c.id] || 0;
        const pctDelTotal = gas > 0 ? ((gastado / gas) * 100).toFixed(1) : '0.0';
        const limite = Finanzas.state.limitesCategorias[c.id] || 300000;
        const estadoBadge = gastado >= limite ? '<span class="kpi-sub-badge red">Límite alcanzado</span>' : '<span class="kpi-sub-badge green">En rango</span>';

        html += `
          <tr>
            <td><strong>${c.icon} ${escapeHTML(c.nombre)}</strong></td>
            <td class="table-amount-cell expense">${formatCOP(gastado)}</td>
            <td><strong>${pctDelTotal}%</strong></td>
            <td>${formatCOP(limite)}</td>
            <td>${estadoBadge}</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    }
  }

  // ==========================================================================
  // PANTALLA 8: PERFIL Y AJUSTES
  // ==========================================================================
  renderPerfilView() {
    const u = Finanzas.state.usuario;
    const nameBig = document.getElementById('profileNameBig');
    if (nameBig) nameBig.textContent = u.nombre;
    const emailBig = document.getElementById('profileEmailBig');
    if (emailBig) emailBig.textContent = u.email;
    const avatarBig = document.getElementById('profileAvatarBig');
    if (avatarBig) avatarBig.textContent = u.iniciales;
    const chkOculto = document.getElementById('chkOcultarSaldo');
    if (chkOculto) chkOculto.checked = !!Finanzas.state.saldoOculto;

    // Checkboxes de alertas en Perfil
    const chkPres = document.getElementById('chkAlertasPresupuestoPerfil');
    if (chkPres) chkPres.checked = u.alertasPresupuesto !== false;
    const chkDeudas = document.getElementById('chkRecordatoriosDeudasPerfil');
    if (chkDeudas) chkDeudas.checked = u.recordatoriosDeudas !== false;

    // Saldo inicial configurable
    const inpSaldoIni = document.getElementById('inputPerfilSaldoInicial');
    if (inpSaldoIni) inpSaldoIni.value = Finanzas.state.saldoInicial || 0;
  }

  // ==========================================================================
  // GRÁFICOS CHART.JS PARA ESCRITORIO CON DEGRADACIÓN ELEGANTE
  // ==========================================================================
  renderDashboardChart() {
    const canvas = document.getElementById('chartDashboardPerspective');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
      const parent = canvas.parentElement;
      if (parent && !parent.querySelector('.chart-fallback-notice')) {
        canvas.style.display = 'none';
        const notice = document.createElement('div');
        notice.className = 'chart-fallback-notice';
        notice.style.padding = '2rem';
        notice.style.textAlign = 'center';
        notice.style.color = 'var(--pc-text-muted)';
        notice.textContent = 'Gráficos desactivados (librería Chart.js no disponible sin conexión a CDN).';
        parent.appendChild(notice);
      }
      return;
    }

    if (this.chartDashboard) {
      this.chartDashboard.destroy();
    }

    // Datos reales agrupados por mes
    const realData = obtenerHistorialMensualReal(Finanzas.state.movimientos);

    let labels = realData.labels;
    let ingresosData = realData.ingresos;
    let gastosData = realData.gastos;

    if (!realData.tieneDatos) {
      // Período actual con valores reales (0)
      labels = [Finanzas.getNombrePeriodo()];
      ingresosData = [Finanzas.calcTotalIngresos()];
      gastosData = [Finanzas.calcTotalGastos()];
    }

    this.chartDashboard = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Ingresos (COP)',
            data: ingresosData,
            backgroundColor: '#0b3b3c',
            borderRadius: 6
          },
          {
            label: 'Gastos (COP)',
            data: gastosData,
            backgroundColor: '#d97706',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', align: 'end' }
        },
        scales: {
          y: {
            ticks: {
              callback: (val) => '$' + (val / 1000000).toFixed(1) + 'M'
            },
            grid: { color: '#f1f5f9' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  renderInformesCharts() {
    if (typeof Chart === 'undefined') return;

    // 1. Gráfico de Barras Comparativo
    const canvasBars = document.getElementById('chartInformesBars');
    if (canvasBars) {
      if (this.chartInformesBars) this.chartInformesBars.destroy();

      const realData = obtenerHistorialMensualReal(Finanzas.state.movimientos);
      let labels = realData.labels;
      let dataIng = realData.ingresos;
      let dataGas = realData.gastos;

      if (!realData.tieneDatos) {
        labels = [Finanzas.getNombrePeriodo()];
        dataIng = [Finanzas.calcTotalIngresos()];
        dataGas = [Finanzas.calcTotalGastos()];
      }

      this.chartInformesBars = new Chart(canvasBars, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Ingresos',
              data: dataIng,
              backgroundColor: '#059669',
              borderRadius: 6
            },
            {
              label: 'Gastos',
              data: dataGas,
              backgroundColor: '#e11d48',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } }
        }
      });
    }

    // 2. Gráfico Donut de Categorías
    const canvasDonut = document.getElementById('chartInformesDonut');
    if (canvasDonut) {
      if (this.chartInformesDonut) this.chartInformesDonut.destroy();

      const gastosCat = Finanzas.calcGastosPorCategoria();
      const labels = [];
      const data = [];
      const colors = [];

      CATEGORIAS_GASTO.forEach(c => {
        const val = gastosCat[c.id] || 0;
        if (val > 0) {
          labels.push(c.nombre);
          data.push(val);
          colors.push(c.color);
        }
      });

      // Si no hay gastos en el período, mostrar marcador vacío
      if (data.length === 0) {
        labels.push('Sin gastos en el período');
        data.push(1);
        colors.push('#cbd5e1');
      }

      this.chartInformesDonut = new Chart(canvasDonut, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right' }
          },
          cutout: '65%'
        }
      });
    }
  }

  // ==========================================================================
  // GESTIÓN DE MODALES
  // ==========================================================================
  openModalNuevoMovimiento() {
    document.getElementById('modalPcNuevoMovimiento')?.classList.remove('hidden');
  }
  closeModalNuevoMovimiento() {
    document.getElementById('modalPcNuevoMovimiento')?.classList.add('hidden');
  }

  setModalQuickType(tipo) {
    this.modalQuickType = tipo;
    const btnGasto = document.getElementById('modalQuickTypeGasto');
    const btnIngreso = document.getElementById('modalQuickTypeIngreso');
    const selectCat = document.getElementById('modalQuickCategoria');

    if (tipo === 'GASTO') {
      btnGasto?.classList.add('active', 'expense');
      btnIngreso?.classList.remove('active', 'income');
      if (selectCat) {
        selectCat.innerHTML = `
          <option value="Alimentación">🛒 Alimentación</option>
          <option value="Transporte">🚌 Transporte</option>
          <option value="Ocio">☕ Ocio</option>
          <option value="Vivienda">🏠 Vivienda</option>
          <option value="Sanidad">⚕️ Sanidad</option>
          <option value="Otros">··· Otros</option>
        `;
      }
    } else {
      btnIngreso?.classList.add('active', 'income');
      btnGasto?.classList.remove('active', 'expense');
      if (selectCat) {
        selectCat.innerHTML = `
          <option value="Salario">💼 Salario</option>
          <option value="Freelance">💻 Freelance</option>
          <option value="Ventas">🏷️ Ventas</option>
          <option value="Inversiones">📈 Inversiones</option>
          <option value="Mesada">🤝 Apoyo</option>
          <option value="Otros">✨ Otros</option>
        `;
      }
    }
  }

  handleQuickMovementSubmit(e) {
    e.preventDefault();
    if (this._savingQuickMovement) return;
    this._savingQuickMovement = true;
    const valor = Number(document.getElementById('modalQuickValor')?.value);
    const concepto = document.getElementById('modalQuickConcepto')?.value ? document.getElementById('modalQuickConcepto').value.trim() : '';
    const categoria = document.getElementById('modalQuickCategoria')?.value || 'Alimentación';
    const fecha = document.getElementById('modalQuickFecha')?.value || obtenerFechaHoyISO();

    if (!isFinite(valor) || valor <= 0) {
      alert('Por favor ingrese un valor mayor a cero.');
      this._savingQuickMovement = false;
      return;
    }
    if (!concepto) {
      alert('Por favor ingrese una descripción.');
      this._savingQuickMovement = false;
      return;
    }

    const fechaLocal = new Date(`${fecha}T12:00:00`);
    if (!Number.isNaN(fechaLocal.getTime())) {
      Finanzas.state.periodoAnio = fechaLocal.getFullYear();
      Finanzas.state.periodoMes = fechaLocal.getMonth();
    }

    const signature = [this.modalQuickType, valor, concepto.toLocaleLowerCase(), categoria, fecha].join('|');
    const now = Date.now();
    if (signature === this._lastMovementSignature && now - this._lastMovementAt < 1200) {
      this._savingQuickMovement = false;
      return;
    }
    this._lastMovementSignature = signature;
    this._lastMovementAt = now;

    const res = Finanzas.agregarMovimiento({
      tipo: this.modalQuickType,
      concepto,
      categoria,
      cuenta: 'Principal',
      valor,
      fecha
    });

    if (res.error) {
      alert(res.error);
      this._savingQuickMovement = false;
      return;
    }

    setTimeout(() => { this._savingQuickMovement = false; }, 600);
    this.closeModalNuevoMovimiento();
    this.showToast('✔ Movimiento registrado.');
  }

  // Modal Metas
  openModalNuevaMeta() {
    document.getElementById('modalPcNuevaMeta')?.classList.remove('hidden');
  }
  closeModalNuevaMeta() {
    document.getElementById('modalPcNuevaMeta')?.classList.add('hidden');
  }
  handleNuevaMetaSubmit(e) {
    e.preventDefault();
    const nombre = document.getElementById('inputMetaNombre')?.value || '';
    const objetivo = Number(document.getElementById('inputMetaObjetivo')?.value);
    const ahorrado = Number(document.getElementById('inputMetaAhorrado')?.value || 0);
    const plazo = document.getElementById('inputMetaPlazo')?.value || '';

    if (!isFinite(objetivo) || objetivo <= 0) {
      alert('El valor objetivo debe ser mayor a cero.');
      return;
    }

    const res = Finanzas.agregarMeta({ nombre, objetivo, ahorrado, plazo });
    if (res.error) {
      alert(res.error);
      return;
    }

    this.closeModalNuevaMeta();
    this.showToast('✔ Meta creada correctamente.');
  }

  openModalAportarMeta(metaId, metaNombre) {
    document.getElementById('aporteMetaId').value = metaId;
    document.getElementById('lblAporteMetaTitle').textContent = `Aportar a: ${metaNombre}`;
    document.getElementById('modalPcAportarMeta')?.classList.remove('hidden');
  }
  closeModalAportarMeta() {
    document.getElementById('modalPcAportarMeta')?.classList.add('hidden');
  }
  handleAporteMetaSubmit(e) {
    e.preventDefault();
    const metaId = document.getElementById('aporteMetaId')?.value;
    const monto = Number(document.getElementById('inputAporteMetaValor')?.value);

    if (!isFinite(monto) || monto <= 0) {
      alert('Por favor ingrese un monto positivo para aportar.');
      return;
    }

    const res = Finanzas.aportarMeta(metaId, monto);
    if (res.error) {
      alert(res.error);
      return;
    }

    this.closeModalAportarMeta();
    this.showToast('✔ ' + res.mensaje);
  }

  // Modal Deudas
  openModalNuevaDeuda() {
    document.getElementById('modalPcNuevaDeuda')?.classList.remove('hidden');
  }
  closeModalNuevaDeuda() {
    document.getElementById('modalPcNuevaDeuda')?.classList.add('hidden');
  }
  handleNuevaDeudaSubmit(e) {
    e.preventDefault();
    const nombre = document.getElementById('inputDeudaNombre')?.value || '';
    const valorInicial = Number(document.getElementById('inputDeudaMontoInicial')?.value);
    const saldoPendienteRaw = document.getElementById('inputDeudaSaldoPendiente')?.value;
    const saldoPendiente = saldoPendienteRaw ? Number(saldoPendienteRaw) : valorInicial;
    const cuotaMensual = Number(document.getElementById('inputDeudaCuota')?.value || 0);
    const condiciones = document.getElementById('inputDeudaCondiciones')?.value || '';

    if (!isFinite(valorInicial) || valorInicial <= 0) {
      alert('El valor inicial debe ser un número positivo.');
      return;
    }
    if (saldoPendiente > valorInicial) {
      alert('El saldo pendiente no puede superar el valor inicial de la deuda.');
      return;
    }

    const res = Finanzas.agregarDeuda({ nombre, valorInicial, saldoPendiente, cuotaMensual, condiciones });
    if (res.error) {
      alert(res.error);
      return;
    }

    this.closeModalNuevaDeuda();
    this.showToast('✔ Deuda registrada.');
  }

  openModalAbonarDeuda(deudaId, deudaNombre) {
    document.getElementById('abonoDeudaId').value = deudaId;
    document.getElementById('lblAbonoDeudaTitle').textContent = `Abonar a: ${deudaNombre}`;
    document.getElementById('modalPcAbonarDeuda')?.classList.remove('hidden');
  }
  closeModalAbonarDeuda() {
    document.getElementById('modalPcAbonarDeuda')?.classList.add('hidden');
  }
  handleAbonoDeudaSubmit(e) {
    e.preventDefault();
    const deudaId = document.getElementById('abonoDeudaId')?.value;
    const monto = Number(document.getElementById('inputAbonoDeudaValor')?.value);

    if (!isFinite(monto) || monto <= 0) {
      alert('Por favor ingrese un monto positivo para abonar.');
      return;
    }

    const res = Finanzas.abonarDeuda(deudaId, monto);
    if (res.error) {
      alert(res.error);
      return;
    }

    this.closeModalAbonarDeuda();
    this.showToast('✔ ' + res.mensaje);
  }

  // Modal Presupuesto
  openModalAjustarPresupuesto() {
    const input = document.getElementById('inputPresupuestoGlobal');
    if (input) input.value = Finanzas.getPresupuestoPeriodo();
    document.getElementById('modalPcAjustarPresupuesto')?.classList.remove('hidden');
  }
  closeModalAjustarPresupuesto() {
    document.getElementById('modalPcAjustarPresupuesto')?.classList.add('hidden');
  }
  handlePresupuestoSubmit(e) {
    e.preventDefault();
    const monto = Number(document.getElementById('inputPresupuestoGlobal')?.value);
    if (isFinite(monto) && monto >= 0) {
      Finanzas.actualizarPresupuesto(monto);
      this.closeModalAjustarPresupuesto();
      this.showToast(`✔ Presupuesto de ${Finanzas.getNombrePeriodo()} actualizado.`);
    } else {
      alert('Por favor ingrese un monto válido para el presupuesto.');
    }
  }

  // Modal Perfil
  openModalEditarPerfil() {
    const u = Finanzas.state.usuario;
    const inpNom = document.getElementById('inputPerfilNombre');
    if (inpNom) inpNom.value = u.nombre;
    const inpMail = document.getElementById('inputPerfilEmail');
    if (inpMail) inpMail.value = u.email;
    const inpSaldo = document.getElementById('inputPerfilSaldoInicial');
    if (inpSaldo) inpSaldo.value = (Finanzas.state.saldoInicial || 0).toFixed(2);
    document.getElementById('modalPcEditarPerfil')?.classList.remove('hidden');
  }
  closeModalEditarPerfil() {
    document.getElementById('modalPcEditarPerfil')?.classList.add('hidden');
  }
  handlePerfilSubmit(e) {
    e.preventDefault();
    const nombre = document.getElementById('inputPerfilNombre')?.value || '';
    const email = document.getElementById('inputPerfilEmail')?.value || '';
    const saldoInicialInput = document.getElementById('inputPerfilSaldoInicial');
    const saldoInicial = saldoInicialInput && saldoInicialInput.value.trim() !== ''
      ? Number(saldoInicialInput.value)
      : null;

    Finanzas.actualizarPerfil({ nombre, email });
    if (saldoInicial !== null && Number.isFinite(saldoInicial)) {
      Finanzas.actualizarSaldoInicial(saldoInicial);
    }
    this.closeModalEditarPerfil();
    this.showToast('✔ Perfil y capital inicial actualizados.');
  }

  // Modal Académico
  openAcademicModal() {
    document.getElementById('modalPcAcademic')?.classList.remove('hidden');
  }
  closeAcademicModal() {
    document.getElementById('modalPcAcademic')?.classList.add('hidden');
  }

  // ==========================================================================
  // OPERACIONES GENERALES
  // ==========================================================================
  eliminarMovimiento(id) {
    if (confirm('¿Desea eliminar este movimiento del registro?')) {
      Finanzas.eliminarMovimiento(id);
      this.showToast('Movimiento eliminado.');
    }
  }

  eliminarMeta(id) {
    if (confirm('¿Desea eliminar esta meta de ahorro?')) {
      Finanzas.eliminarMeta(id);
      this.showToast('Meta eliminada.');
    }
  }

  eliminarDeuda(id) {
    if (confirm('¿Desea eliminar este pasivo?')) {
      Finanzas.eliminarDeuda(id);
      this.showToast('Deuda eliminada.');
    }
  }

  toggleOcultarSaldo() {
    Finanzas.toggleSaldoOculto();
    this.renderKPIs();
    this.renderPerfilView();
  }

  cambiarMes(delta) {
    Finanzas.cambiarPeriodo(delta);
    this.renderAll();
    this.showToast(`Visualizando período: ${Finanzas.getNombrePeriodo()}`);
  }

  toggleAlertaPresupuesto(checked) {
    Finanzas.state.usuario.alertasPresupuesto = checked;
    Finanzas.saveState();
    this.showToast(checked ? 'Alertas de presupuesto activadas.' : 'Alertas de presupuesto pausadas.');
  }

  toggleRecordatoriosDeudas(checked) {
    Finanzas.state.usuario.recordatoriosDeudas = checked;
    Finanzas.saveState();
    this.showToast(checked ? 'Recordatorios de deudas activados.' : 'Recordatorios de deudas pausados.');
  }

  toggleAlerta(chk) {
    this.toggleAlertaPresupuesto(chk.checked);
  }

  toggleAlertsSummary() {
    this.switchView('plan');
  }

  handleGlobalSearch() {
    const q = (document.getElementById('pcGlobalSearch')?.value || '').toLowerCase();
    if (q.length > 1) {
      this.switchView('movimientos');
      const tableInput = document.getElementById('inputMovSearchTable');
      if (tableInput) {
        tableInput.value = q;
        this.renderMovimientos();
      }
    }
  }

  // ==========================================================================
  // EXPORTACIONES Y COPIAS
  // ==========================================================================
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
    a.download = `mibolsillo_movimientos_${periodoLabel}.csv`;
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    this.showToast('📥 Archivo CSV descargado con éxito.');
  }

  exportarJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(Finanzas.state, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    const periodoLabel = `${Finanzas.state.periodoAnio}_${String(Finanzas.state.periodoMes + 1).padStart(2, '0')}`;
    a.download = `mibolsillo_backup_${periodoLabel}.json`;
    a.click();
    this.showToast('💾 Copia de seguridad JSON descargada.');
  }

  imprimirPDF() {
    this.showToast('Abriendo diálogo para imprimir o guardar como PDF...');
    setTimeout(() => window.print(), 350);
  }

  restablecerDatos() {
    if (confirm('¿Restablecer todos los datos a la configuración inicial del proyecto?')) {
      Finanzas.resetState();
      this.showToast('🔄 Datos iniciales restablecidos.');
    }
  }

  showToast(mensaje) {
    const existing = document.querySelector('.toast-notice');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notice';
    toast.textContent = mensaje;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Inicialización global de la aplicación de escritorio.
// Se expone en window para que los manejadores inline del HTML puedan accederla.
window.pcApp = new DesktopApp();
