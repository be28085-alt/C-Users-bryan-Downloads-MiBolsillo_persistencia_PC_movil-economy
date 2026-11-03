/**
 * ============================================================================
 * PROYECTO: MiBolsillo · Control de Finanzas Personales
 * ARCHIVO: desktop.js
 * ROL: Controlador Exclusivo para la Versión de Escritorio (PC)
 * ============================================================================
 */

class DesktopApp {
  constructor() {
    this.ui = window.MiBolsilloUiShared || null;
    this.currentView = 'inicio';
    this.currentMovFilter = 'TODOS';
    this.formType = 'GASTO';
    this.formCategory = 'Alimentación';
    this.modalQuickType = 'GASTO';

    // Estados y filtros del módulo empresarial
    this.filtroPeriodoReportes = 'MES_ACTUAL';
    this.filtroTipoProductos = 'ALL';
    this.filtroTipoVentas = 'ALL';
    this.filtroTipoInventario = 'ALL';
    this.textoFiltroProductos = '';
    this.textoFiltroMaterias = '';
    this.textoFiltroVentas = '';

    // Instancias de Chart.js
    this.chartDashboard = null;
    this.chartInformesBars = null;
    this.chartInformesDonut = null;

    // Inicializar al cargar el DOM
    document.addEventListener('DOMContentLoaded', () => this.init());
  }

  init() {
    if (this.ui && typeof this.ui.subscribeToStore === 'function') {
      this.ui.subscribeToStore(() => this.renderAll());
    } else {
      Finanzas.subscribe(() => this.renderAll());
    }

    if (this.ui && typeof this.ui.bindDocumentAction === 'function') {
      this.ui.bindDocumentAction(document, '[data-pc-action]', (event, button) => this.handleDynamicAction(event, button));
    } else {
      document.addEventListener('click', (event) => this.handleDynamicAction(event));
    }
    configurarEntradasMonetarias();

    // Configurar fechas por defecto en inputs
    const hoyStr = obtenerFechaHoyISO();
    if (this.ui && typeof this.ui.applyDateDefaults === 'function') {
      this.ui.applyDateDefaults(['regInputFecha', 'modalQuickFecha', 'modalCompraFecha', 'modalVentaFecha', 'modalProdFecha', 'modalAbonoFecha', 'modalEmpFecha', 'modalPagoNomFecha', 'modalGastoNegFecha'], hoyStr);
    } else {
      const inputFecha = document.getElementById('regInputFecha');
      if (inputFecha) inputFecha.value = hoyStr;
      const inputQuickFecha = document.getElementById('modalQuickFecha');
      if (inputQuickFecha) inputQuickFecha.value = hoyStr;

      ['modalCompraFecha', 'modalVentaFecha', 'modalProdFecha', 'modalAbonoFecha', 'modalEmpFecha', 'modalPagoNomFecha', 'modalGastoNegFecha'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = hoyStr;
      });
    }

    // Renderizar categorías del formulario de registro
    this.renderCategoryGrid();
    this.updateLiveImpact();

    // Sincronizar estado inicial de visualización de módulos
    this.actualizarModuloVisual(Finanzas.state.moduloActivo || 'PERSONAL');

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

  handleDynamicAction(event, resolvedButton = null) {
    const button = resolvedButton || (event && event.target ? event.target.closest('[data-pc-action]') : null);
    if (!button) return;

    if (this.ui && typeof this.ui.dispatchCommonAction === 'function' && this.ui.dispatchCommonAction(this, button)) {
      return;
    }

    const { pcAction, recordId, recordName, categoryId } = button.dataset;
    switch (pcAction) {
      case 'delete-movement':
        this.eliminarMovimiento(recordId);
        break;
      case 'select-category':
        this.selectCategory(categoryId);
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
  // ==========================================================================
  // NAVEGACIÓN Y CONMUTACIÓN DE MÓDULOS
  // ==========================================================================

  setModulo(modulo, targetView = null) {
    Finanzas.setModuloActivo(modulo);
    this.actualizarModuloVisual(modulo);
    if (targetView) {
      this.switchView(targetView);
    } else {
      this.switchView(modulo === 'EMPRESARIAL' ? 'negocio-dashboard' : 'inicio');
    }
  }

  actualizarModuloVisual(modulo) {
    const isEmpresarial = modulo === 'EMPRESARIAL';
    const navPersonal = document.getElementById('navPersonal');
    const navEmpresarial = document.getElementById('navEmpresarial');
    const pillPersonal = document.getElementById('pillModoPersonal');
    const pillEmpresarial = document.getElementById('pillModoEmpresarial');
    const brandTitle = document.getElementById('sidebarBrandTitle');
    const brandSub = document.getElementById('sidebarBrandSubtitle');
    const brandIcon = document.getElementById('sidebarBrandIcon');

    if (navPersonal && navEmpresarial) {
      navPersonal.style.display = isEmpresarial ? 'none' : 'block';
      navEmpresarial.style.display = isEmpresarial ? 'block' : 'none';
    }

    if (pillPersonal && pillEmpresarial) {
      if (isEmpresarial) {
        pillPersonal.classList.remove('active');
        pillEmpresarial.classList.add('active');
      } else {
        pillPersonal.classList.add('active');
        pillEmpresarial.classList.remove('active');
      }
    }

    if (brandTitle && brandSub && brandIcon) {
      if (isEmpresarial) {
        brandTitle.textContent = 'Mi Bolsillo Negocios';
        brandSub.textContent = 'Gestión empresarial';
        brandIcon.textContent = '🏢';
      } else {
        brandTitle.textContent = 'mi dinero';
        brandSub.textContent = 'Finanzas personales';
        brandIcon.textContent = '❖';
      }
    }
  }

  switchView(viewId) {
    this.currentView = viewId;

    const esEmpresarial = viewId.startsWith('negocio-');
    this.actualizarModuloVisual(esEmpresarial ? 'EMPRESARIAL' : 'PERSONAL');

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
      'perfil': 'Tu espacio · Perfil y ajustes',
      'negocio-dashboard': 'Dashboard Empresarial',
      'negocio-inventario': 'Inventario del negocio',
      'negocio-compras': 'Compras & Abastecimiento',
      'negocio-proveedores': 'Directorio de Proveedores',
      'negocio-ventas': 'Ventas & Facturación'
    };
    const titleEl = document.getElementById('lblBreadcrumbTitle');
    if (titleEl) titleEl.textContent = breadcrumbMap[viewId] || 'Gestor Financiero';

    // Si entra a inicio o informes, actualizar gráficos correspondientes
    if (viewId === 'inicio') {
      setTimeout(() => this.renderDashboardChart(), 50);
    } else if (viewId === 'informes') {
      setTimeout(() => this.renderInformesCharts(), 50);
    } else if (viewId === 'registrar') {
      this.updateLiveImpact();
    } else if (esEmpresarial) {
      this.renderBusinessModule();
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

    // Renderizar módulo empresarial (siempre actualizado)
    this.renderBusinessModule();

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
      return;
    }
    if (!concepto) {
      alert('Por favor ingrese una descripción para el movimiento.');
      return;
    }

    const res = Finanzas.agregarMovimiento({
      tipo: this.formType,
      concepto,
      categoria: this.formCategory,
      cuenta,
      valor,
      fecha
    });

    if (res.error) {
      alert(res.error);
      return;
    }

    this.showToast('✔ Movimiento registrado con éxito.');
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
    const valor = Number(document.getElementById('modalQuickValor')?.value);
    const concepto = document.getElementById('modalQuickConcepto')?.value ? document.getElementById('modalQuickConcepto').value.trim() : '';
    const categoria = document.getElementById('modalQuickCategoria')?.value || 'Alimentación';
    const fecha = document.getElementById('modalQuickFecha')?.value || obtenerFechaHoyISO();

    if (!isFinite(valor) || valor <= 0) {
      alert('Por favor ingrese un valor mayor a cero.');
      return;
    }
    if (!concepto) {
      alert('Por favor ingrese una descripción.');
      return;
    }

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
      return;
    }

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

  // ==========================================================================
  // MÓDULO DE GESTIÓN EMPRESARIAL: RENDERIZADO Y CONTROLADORES
  // ==========================================================================

  openModalBiz(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('hidden');
  }

  closeModalBiz(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('hidden');
  }

  cambiarNegocioActivo(id) {
    Finanzas.setNegocioActivo(id);
    this.renderBusinessModule();
    this.showToast(`🏢 Negocio activo: ${Finanzas.getNegocioActivo().nombre}`);
  }

  renderBusinessModule() {
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    // Actualizar selector global de negocios
    this.renderBusinessSelectors();

    // Actualizar métricas del hero en "Mi Perfil"
    const metricas = Finanzas.calcularMetricasEmpresariales(negActivo.id, 'MES_ACTUAL');
    const lblProfileNombre = document.getElementById('lblProfileBizNombre');
    const lblProfileVentas = document.getElementById('lblProfileBizVentas');
    const lblProfileUtilidad = document.getElementById('lblProfileBizUtilidad');
    const lblProfileCobrar = document.getElementById('lblProfileBizCobrar');

    if (lblProfileNombre) lblProfileNombre.textContent = negActivo.nombre;
    if (lblProfileVentas) lblProfileVentas.textContent = formatCOP(metricas.ventasTotales);
    if (lblProfileUtilidad) lblProfileUtilidad.textContent = formatCOP(metricas.utilidadNeta);
    if (lblProfileCobrar) lblProfileCobrar.textContent = formatCOP(metricas.cuentasPorCobrar);

    // Renderizar submódulos
    this.renderBusinessDashboard(negActivo, metricas);
    this.renderBusinessInventario(negActivo);
    this.renderBusinessCompras(negActivo);
    this.renderBusinessProveedores(negActivo);
    this.renderBusinessVentas(negActivo);
  }

  renderBusinessSelectors() {
    const negocios = Finanzas.getNegocios();
    const activo = Finanzas.getNegocioActivo();
    document.querySelectorAll('.sel-biz-global').forEach(sel => {
      sel.innerHTML = negocios.map(n => 
        `<option value="${n.id}" ${activo && activo.id === n.id ? 'selected' : ''}>${escapeHTML(n.nombre)} (${escapeHTML(n.tipo)})</option>`
      ).join('');
    });
  }

  // 1. DASHBOARD EMPRESARIAL
  renderBusinessDashboard(negActivo, metricas) {
    const elVentas = document.getElementById('bizKpiVentas');
    const elVentasCount = document.getElementById('bizKpiVentasCount');
    const elCosto = document.getElementById('bizKpiCostoVentas');
    const elGastos = document.getElementById('bizKpiGastosOperativos');
    const elUtilidad = document.getElementById('bizKpiUtilidadNeta');
    const elMargen = document.getElementById('bizKpiMargenNeto');
    const elCobrar = document.getElementById('bizKpiCuentasCobrar');
    const elInventario = document.getElementById('bizKpiValorInventario');
    const elAlertasStock = document.getElementById('bizKpiAlertasStock');

    if (elVentas) elVentas.textContent = formatCOP(metricas.ventasTotales);
    if (elVentasCount) elVentasCount.textContent = `${metricas.cantidadVentas} facturas emitidas este mes`;
    if (elCosto) elCosto.textContent = formatCOP(metricas.costoProductosVendidos);
    if (elGastos) elGastos.textContent = formatCOP(metricas.gastosOperativos);
    if (elUtilidad) elUtilidad.textContent = formatCOP(metricas.utilidadNeta);
    if (elMargen) elMargen.textContent = `Margen Neto: ${metricas.margenNetoPct.toFixed(1)}% | Bruto: ${metricas.margenBrutoPct.toFixed(1)}%`;
    if (elCobrar) elCobrar.textContent = formatCOP(metricas.cuentasPorCobrar);
    if (elInventario) elInventario.textContent = formatCOP(metricas.valorInventario);
    if (elAlertasStock) elAlertasStock.textContent = `${metricas.productosAlerta} alertas de stock bajo`;

    // Tabla de últimas ventas en Dashboard
    const tbodyVentas = document.getElementById('bizTbodyDashboardVentas');
    if (tbodyVentas) {
      const ventas = Finanzas.getVentas(negActivo.id).slice(0, 5);
      if (ventas.length === 0) {
        tbodyVentas.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--pc-text-muted); padding: 1.5rem;">No se han registrado ventas aún.</td></tr>`;
      } else {
        tbodyVentas.innerHTML = ventas.map(v => `
          <tr>
            <td><strong>#${v.id.substring(v.id.length - 6)}</strong></td>
            <td>${escapeHTML(v.clienteNombre)}</td>
            <td>${v.fecha}</td>
            <td><span class="badge-stock ${v.tipoPago === 'CREDITO' ? 'badge-stock-low' : 'badge-stock-ok'}">${v.tipoPago}</span></td>
            <td><strong>${formatCOP(v.total)}</strong></td>
            <td><span class="badge-stock ${v.estado === 'PAGADA' ? 'badge-stock-ok' : 'badge-stock-out'}">${v.estado}</span></td>
          </tr>
        `).join('');
      }
    }

    // Alertas de stock bajo en Dashboard
    const containerAlertas = document.getElementById('bizContainerAlertasStock');
    if (containerAlertas) {
      const bajas = Finanzas.getAlertasStockBajo(negActivo.id);
      if (bajas.length === 0) {
        containerAlertas.innerHTML = `
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: var(--radius-sm); padding: 0.75rem 1rem; color: #065f46; font-size: 0.85rem;">
            ✓ Todo el inventario se encuentra por encima del stock mínimo de seguridad.
          </div>
        `;
      } else {
        containerAlertas.innerHTML = bajas.map(b => `
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-sm); padding: 0.6rem 0.85rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;">
            <div>
              <strong>⚠️ ${escapeHTML(b.nombre)}</strong>
              <span style="color: var(--pc-text-muted); margin-left: 6px;">(${b.tipo === 'MATERIA_PRIMA' ? 'Materia Prima' : 'Producto'})</span>
            </div>
            <div>
              <span class="badge-stock badge-stock-low">Stock: ${b.stock} / Mín: ${b.stockMinimo} ${b.unidadMedida}</span>
            </div>
          </div>
        `).join('');
      }
    }

    // Kardex reciente en Dashboard
    const tbodyKardex = document.getElementById('bizTbodyDashboardKardex');
    if (tbodyKardex) {
      const movs = Finanzas.getMovimientosInventario(negActivo.id).slice(-5).reverse();
      if (movs.length === 0) {
        tbodyKardex.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--pc-text-muted);">Sin movimientos de bodega.</td></tr>`;
      } else {
        tbodyKardex.innerHTML = movs.map(m => `
          <tr>
            <td><span class="badge-stock ${m.tipo === 'ENTRADA' || m.tipo === 'PRODUCCION' ? 'badge-stock-ok' : 'badge-stock-out'}">${m.tipo}</span></td>
            <td>${escapeHTML(m.productoNombre)}</td>
            <td><strong>${m.cantidad}</strong></td>
            <td>${escapeHTML(m.motivo)}</td>
          </tr>
        `).join('');
      }
    }
  }

  // 2. MI NEGOCIO (PERFIL & LISTA)
  renderBusinessPerfil(negActivo) {
    const elNom = document.getElementById('inputBizNombre');
    const elTipo = document.getElementById('inputBizTipo');
    const elDesc = document.getElementById('inputBizDescripcion');
    const elTel = document.getElementById('inputBizTelefono');
    const elMail = document.getElementById('inputBizEmail');
    const elDir = document.getElementById('inputBizDireccion');

    if (elNom) elNom.value = negActivo.nombre || '';
    if (elTipo) elTipo.value = negActivo.tipo || '';
    if (elDesc) elDesc.value = negActivo.descripcion || '';
    if (elTel) elTel.value = negActivo.telefono || '';
    if (elMail) elMail.value = negActivo.email || '';
    if (elDir) elDir.value = negActivo.direccion || '';

    // Lista de negocios
    const container = document.getElementById('bizContainerListaNegocios');
    if (container) {
      const list = Finanzas.getNegocios();
      container.innerHTML = list.map(n => `
        <div style="border: 2px solid ${n.id === negActivo.id ? 'var(--pc-teal-primary)' : 'var(--pc-border)'}; background: ${n.id === negActivo.id ? 'var(--pc-teal-subtle)' : '#ffffff'}; border-radius: var(--radius-md); padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <strong style="font-size: 1.05rem;">${escapeHTML(n.nombre)}</strong>
              ${n.id === negActivo.id ? '<span class="badge-stock badge-stock-ok">ACTIVO AHORA</span>' : ''}
            </div>
            <p style="font-size: 0.82rem; color: var(--pc-text-muted); margin-top: 2px;">${escapeHTML(n.tipo)} · ${escapeHTML(n.direccion || 'Sin dirección')}</p>
          </div>
          <div>
            ${n.id !== negActivo.id ? `<button class="btn-pc-secondary" style="font-size: 0.78rem;" onclick="pcApp.cambiarNegocioActivo('${n.id}')">Seleccionar</button>` : ''}
            ${list.length > 1 ? `<button class="btn-pc-secondary" style="font-size: 0.78rem; color: var(--pc-red); border-color: #fecdd3; margin-left: 4px;" onclick="pcApp.eliminarNegocio('${n.id}')">🗑️</button>` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  handleGuardarNegocioActivo(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    Finanzas.actualizarNegocio(negActivo.id, {
      nombre: document.getElementById('inputBizNombre').value,
      tipo: document.getElementById('inputBizTipo').value,
      descripcion: document.getElementById('inputBizDescripcion').value,
      telefono: document.getElementById('inputBizTelefono').value,
      email: document.getElementById('inputBizEmail').value,
      direccion: document.getElementById('inputBizDireccion').value
    });

    this.showToast('✓ Datos del negocio actualizados con éxito.');
  }

  openModalNuevoNegocio() {
    this.openModalBiz('modalBizNuevoNegocio');
  }

  handleCrearNegocioSubmit(e) {
    e.preventDefault();
    const res = Finanzas.agregarNegocio({
      nombre: document.getElementById('modalBizNombre').value,
      tipo: document.getElementById('modalBizTipo').value,
      descripcion: document.getElementById('modalBizDesc').value,
      telefono: document.getElementById('modalBizTel').value,
      email: document.getElementById('modalBizMail').value,
      direccion: document.getElementById('modalBizDir').value
    });

    if (res.ok) {
      this.closeModalBiz('modalBizNuevoNegocio');
      e.target.reset();
      this.showToast(`🏢 ¡Negocio "${res.negocio.nombre}" creado exitosamente!`);
    } else {
      alert(res.error);
    }
  }

  eliminarNegocio(id) {
    if (confirm('¿Estás seguro de eliminar este negocio? Esta acción no se puede deshacer.')) {
      const res = Finanzas.eliminarNegocio(id);
      if (res.ok) {
        this.showToast('Negocio eliminado.');
      } else {
        alert(res.error);
      }
    }
  }

  // 3. PRODUCTOS TERMINADOS
  renderBusinessProductos(negActivo) {
    let prods = Finanzas.getProductos(negActivo.id, 'PRODUCTO');
    const badgeCount = document.getElementById('bizCountProductos');
    if (badgeCount) badgeCount.textContent = `${prods.length} productos`;

    if (this.textoFiltroProductos) {
      const q = this.textoFiltroProductos.toLowerCase();
      prods = prods.filter(p => p.nombre.toLowerCase().includes(q) || (p.descripcion && p.descripcion.toLowerCase().includes(q)));
    }

    const tbody = document.getElementById('bizTbodyProductos');
    if (tbody) {
      if (prods.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay productos terminados registrados. Haz clic en "+ Nuevo Producto".</td></tr>`;
      } else {
        tbody.innerHTML = prods.map(p => {
          const margenPct = p.precioVenta > 0 ? (((p.precioVenta - p.costoUnitario) / p.precioVenta) * 100).toFixed(1) : '0.0';
          const badgeStockClass = p.stock <= 0 ? 'badge-stock-out' : (p.stock <= p.stockMinimo ? 'badge-stock-low' : 'badge-stock-ok');
          return `
            <tr>
              <td>
                <strong>${escapeHTML(p.nombre)}</strong>
                <p style="font-size: 0.75rem; color: var(--pc-text-muted); margin: 0;">${escapeHTML(p.descripcion || '')}</p>
              </td>
              <td>${escapeHTML(p.unidadMedida)}</td>
              <td><strong>${formatCOP(p.precioVenta)}</strong></td>
              <td style="color: var(--pc-text-muted);">${formatCOP(p.costoUnitario)}</td>
              <td><span style="font-weight: 700; color: #059669;">${margenPct}%</span></td>
              <td><span class="badge-stock ${badgeStockClass}">${p.stock} ${p.unidadMedida}</span></td>
              <td><span class="badge-stock ${badgeStockClass}">${p.estado}</span></td>
              <td>
                <button class="btn-pc-secondary" style="font-size: 0.75rem; color: var(--pc-red); border-color: #fecdd3;" onclick="pcApp.eliminarProducto('${p.id}')">🗑️</button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  filtrarTablaProductos(texto) {
    this.textoFiltroProductos = texto;
    const negActivo = Finanzas.getNegocioActivo();
    if (negActivo) this.renderBusinessProductos(negActivo);
  }

  // 4. MATERIAS PRIMAS
  renderBusinessMaterias(negActivo) {
    let materias = Finanzas.getProductos(negActivo.id, 'MATERIA_PRIMA');
    const badgeCount = document.getElementById('bizCountMaterias');
    if (badgeCount) badgeCount.textContent = `${materias.length} insumos`;

    if (this.textoFiltroMaterias) {
      const q = this.textoFiltroMaterias.toLowerCase();
      materias = materias.filter(m => m.nombre.toLowerCase().includes(q));
    }

    const tbody = document.getElementById('bizTbodyMaterias');
    if (tbody) {
      if (materias.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay materias primas registradas. Haz clic en "+ Nueva Materia Prima".</td></tr>`;
      } else {
        tbody.innerHTML = materias.map(m => {
          const badgeStockClass = m.stock <= 0 ? 'badge-stock-out' : (m.stock <= m.stockMinimo ? 'badge-stock-low' : 'badge-stock-ok');
          return `
            <tr>
              <td>
                <strong>${escapeHTML(m.nombre)}</strong>
                <p style="font-size: 0.75rem; color: var(--pc-text-muted); margin: 0;">${escapeHTML(m.descripcion || '')}</p>
              </td>
              <td>${escapeHTML(m.unidadMedida)}</td>
              <td><strong>${formatCOP(m.costoUnitario || m.precioCompra)}</strong></td>
              <td><span class="badge-stock ${badgeStockClass}">${m.stock} ${m.unidadMedida}</span></td>
              <td>${m.stockMinimo} ${m.unidadMedida}</td>
              <td><span class="badge-stock ${badgeStockClass}">${m.estado}</span></td>
              <td>
                <button class="btn-pc-secondary" style="font-size: 0.75rem; color: var(--pc-red); border-color: #fecdd3;" onclick="pcApp.eliminarProducto('${m.id}')">🗑️</button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  filtrarTablaMaterias(texto) {
    this.textoFiltroMaterias = texto;
    const negActivo = Finanzas.getNegocioActivo();
    if (negActivo) this.renderBusinessMaterias(negActivo);
  }

  openModalNuevoProducto(tipo) {
    const titulo = document.getElementById('modalBizProdTitulo');
    const inputTipo = document.getElementById('modalBizProdTipo');
    const grpVenta = document.getElementById('grpModalBizPrecioVenta');

    if (inputTipo) inputTipo.value = tipo;
    if (titulo) titulo.textContent = tipo === 'MATERIA_PRIMA' ? 'Registrar Nueva Materia Prima / Insumo' : 'Registrar Nuevo Producto Terminado';
    if (grpVenta) grpVenta.style.display = tipo === 'MATERIA_PRIMA' ? 'none' : 'block';

    this.openModalBiz('modalBizNuevoProducto');
  }

  handleCrearProductoSubmit(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const tipo = document.getElementById('modalBizProdTipo').value;
    const res = Finanzas.agregarProducto({
      negocioId: negActivo.id,
      tipo,
      nombre: document.getElementById('modalBizProdNombre').value,
      descripcion: document.getElementById('modalBizProdDesc').value,
      unidadMedida: document.getElementById('modalBizProdUnidad').value,
      precioCompra: document.getElementById('modalBizProdPrecioCompra').value,
      precioVenta: document.getElementById('modalBizProdPrecioVenta').value,
      stock: document.getElementById('modalBizProdStockInit').value,
      stockMinimo: document.getElementById('modalBizProdStockMin').value
    });

    if (res.ok) {
      this.closeModalBiz('modalBizNuevoProducto');
      e.target.reset();
      this.showToast(`✓ Artículo "${res.producto.nombre}" guardado.`);
    } else {
      alert(res.error);
    }
  }

  eliminarProducto(id) {
    if (confirm('¿Eliminar este artículo del catálogo?')) {
      Finanzas.eliminarProducto(id);
      this.showToast('Artículo eliminado.');
    }
  }

  // 5. INVENTARIO & KARDEX
  renderBusinessInventario(negActivo) {
    const bajas = Finanzas.getAlertasStockBajo(negActivo.id);
    const boxAlerta = document.getElementById('bizInventarioAlertasBox');
    if (boxAlerta) {
      if (bajas.length > 0) {
        boxAlerta.innerHTML = `
          <div style="background: #fff1f2; border: 2px solid #fecdd3; border-radius: var(--radius-md); padding: 1rem 1.25rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <span style="font-size: 1.25rem;">🚨</span>
              <strong style="color: #9f1239; font-size: 1rem;">Alerta: ${bajas.length} artículo(s) con existencias iguales o inferiores al stock mínimo</strong>
            </div>
            <p style="font-size: 0.85rem; color: #881337; margin: 0;">
              Se recomienda abastecer inmediatamente mediante el módulo de Compras o Fabricación para evitar desabastecimiento.
            </p>
          </div>
        `;
      } else {
        boxAlerta.innerHTML = '';
      }
    }

    let items = Finanzas.getProductos(negActivo.id, this.filtroTipoInventario || 'ALL');
    const tbodyStock = document.getElementById('bizTbodyInventarioStock');
    if (tbodyStock) {
      tbodyStock.innerHTML = items.map(p => {
        const badgeStockClass = p.stock <= 0 ? 'badge-stock-out' : (p.stock <= p.stockMinimo ? 'badge-stock-low' : 'badge-stock-ok');
        const valorTotal = (Number(p.stock) || 0) * (Number(p.costoUnitario) || Number(p.precioCompra) || 0);
        return `
          <tr>
            <td><span class="badge-stock ${p.tipo === 'MATERIA_PRIMA' ? 'badge-mp' : 'badge-pt'}">${p.tipo === 'MATERIA_PRIMA' ? 'Insumo' : 'Producto'}</span></td>
            <td><strong>${escapeHTML(p.nombre)}</strong></td>
            <td>${formatCOP(p.costoUnitario || p.precioCompra)}</td>
            <td><span class="badge-stock ${badgeStockClass}" style="font-size: 0.85rem;"><strong>${p.stock}</strong> ${p.unidadMedida}</span></td>
            <td>${p.stockMinimo} ${p.unidadMedida}</td>
            <td><strong>${formatCOP(valorTotal)}</strong></td>
            <td><span class="badge-stock ${badgeStockClass}">${p.estado}</span></td>
          </tr>
        `;
      }).join('');
    }

    // Kardex
    const tbodyKardex = document.getElementById('bizTbodyKardex');
    if (tbodyKardex) {
      const movs = Finanzas.getMovimientosInventario(negActivo.id).slice().reverse();
      tbodyKardex.innerHTML = movs.map(m => `
        <tr>
          <td>${m.fecha}</td>
          <td><span class="badge-stock ${m.tipo === 'ENTRADA' || m.tipo === 'PRODUCCION' ? 'badge-stock-ok' : 'badge-stock-out'}">${m.tipo}</span></td>
          <td><strong>${escapeHTML(m.productoNombre)}</strong></td>
          <td><strong>${m.cantidad}</strong></td>
          <td style="color: var(--pc-text-muted);">${m.stockAnterior}</td>
          <td><strong>${m.stockPosterior}</strong></td>
          <td>${escapeHTML(m.motivo)}</td>
        </tr>
      `).join('');
    }
  }

  filtrarInventarioTipo(tipo) {
    this.filtroTipoInventario = tipo;
    const negActivo = Finanzas.getNegocioActivo();
    if (negActivo) this.renderBusinessInventario(negActivo);
  }

  openModalAjusteInventario() {
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const sel = document.getElementById('modalAjusteProducto');
    const prods = Finanzas.getProductos(negActivo.id, 'ALL');
    if (sel) {
      sel.innerHTML = prods.map(p => `<option value="${p.id}">${escapeHTML(p.nombre)} (Stock actual: ${p.stock} ${p.unidadMedida})</option>`).join('');
      if (prods[0]) this.actualizarStockActualAjuste(prods[0].id);
    }

    this.openModalBiz('modalBizAjustarInventario');
  }

  actualizarStockActualAjuste(prodId) {
    const prod = Finanzas.getProductoById(prodId);
    const el = document.getElementById('modalAjusteStockActual');
    if (prod && el) el.textContent = `${prod.stock} ${prod.unidadMedida}`;
  }

  handleAjusteInventarioSubmit(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const res = Finanzas.ajustarStockInventario({
      negocioId: negActivo.id,
      productoId: document.getElementById('modalAjusteProducto').value,
      nuevoStock: document.getElementById('modalAjusteNuevoStock').value,
      motivo: document.getElementById('modalAjusteMotivo').value,
      fecha: obtenerFechaHoyISO()
    });

    if (res.ok) {
      this.closeModalBiz('modalBizAjustarInventario');
      this.showToast(`✓ Stock de "${res.producto.nombre}" ajustado a ${res.producto.stock}.`);
    } else {
      alert(res.error);
    }
  }

  // 6. COMPRAS (Regla 1: Incrementa inventario)
  renderBusinessCompras(negActivo) {
    const compras = Finanzas.getCompras(negActivo.id);
    const tbody = document.getElementById('bizTbodyCompras');
    if (tbody) {
      if (compras.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay compras registradas. Haz clic en "+ Registrar Nueva Compra".</td></tr>`;
      } else {
        tbody.innerHTML = compras.map(c => `
          <tr>
            <td><strong>#${c.id.substring(c.id.length - 6)}</strong></td>
            <td><strong>${escapeHTML(c.proveedorNombre)}</strong></td>
            <td>${c.fecha}</td>
            <td><strong style="color: var(--pc-teal-dark);">${formatCOP(c.total)}</strong></td>
            <td>${(c.detalles || []).length} artículo(s)</td>
            <td><span class="badge-stock badge-stock-ok">${c.estado}</span></td>
            <td>${escapeHTML(c.observaciones || '-')}</td>
          </tr>
        `).join('');
      }
    }
  }

  openModalNuevaCompra() {
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const provs = Finanzas.getProveedores(negActivo.id);
    const selProv = document.getElementById('modalCompraProveedor');
    if (selProv) {
      if (provs.length === 0) {
        selProv.innerHTML = '<option value="">-- No hay proveedores registrados (Regístrelos primero) --</option>';
      } else {
        selProv.innerHTML = provs.map(p => `<option value="${p.id}">${escapeHTML(p.nombre)}</option>`).join('');
      }
    }

    const container = document.getElementById('bizContainerItemsCompra');
    if (container) {
      container.innerHTML = '';
      this.agregarFilaItemCompra();
    }

    this.recalcularTotalCompraModal();
    this.openModalBiz('modalBizNuevaCompra');
  }

  agregarFilaItemCompra() {
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const container = document.getElementById('bizContainerItemsCompra');
    if (!container) return;

    const prods = Finanzas.getProductos(negActivo.id, 'ALL');
    const row = document.createElement('div');
    row.className = 'biz-item-row';
    row.innerHTML = `
      <select class="pc-select sel-compra-prod" onchange="pcApp.recalcularTotalCompraModal()" style="font-size: 0.82rem;">
        ${prods.map(p => `<option value="${p.id}" data-precio="${p.precioCompra || p.costoUnitario || 0}">${escapeHTML(p.nombre)} (${p.unidadMedida})</option>`).join('')}
      </select>
      <input type="number" class="pc-input inp-compra-cant" value="1" min="0.01" step="0.01" placeholder="Cant" oninput="pcApp.recalcularTotalCompraModal()">
      <input type="number" class="pc-input inp-compra-precio" value="${prods[0] ? (prods[0].precioCompra || 0) : 0}" step="0.01" placeholder="Precio unit" oninput="pcApp.recalcularTotalCompraModal()">
      <div class="lbl-compra-subtotal" style="font-weight: 700; font-size: 0.85rem; text-align: right;">$ 0</div>
      <button type="button" class="btn-pc-secondary" style="padding: 4px; color: var(--pc-red); border-color: #fecdd3;" onclick="pcApp.eliminarFilaItemCompra(this)">✕</button>
    `;
    container.appendChild(row);
    this.recalcularTotalCompraModal();
  }

  eliminarFilaItemCompra(btn) {
    const row = btn.closest('.biz-item-row');
    if (row) row.remove();
    this.recalcularTotalCompraModal();
  }

  recalcularTotalCompraModal() {
    let total = 0;
    document.querySelectorAll('#bizContainerItemsCompra .biz-item-row').forEach(row => {
      const cant = Number(row.querySelector('.inp-compra-cant').value) || 0;
      const precio = Number(row.querySelector('.inp-compra-precio').value) || 0;
      const sub = cant * precio;
      total += sub;
      const lbl = row.querySelector('.lbl-compra-subtotal');
      if (lbl) lbl.textContent = formatCOP(sub);
    });

    const lblTotal = document.getElementById('lblModalCompraTotal');
    if (lblTotal) lblTotal.textContent = formatCOP(total);
  }

  handleCompraSubmit(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const proveedorId = document.getElementById('modalCompraProveedor').value;
    if (!proveedorId) {
      alert('Por favor selecciona o registra un proveedor.');
      return;
    }

    const detalles = [];
    document.querySelectorAll('#bizContainerItemsCompra .biz-item-row').forEach(row => {
      const prodId = row.querySelector('.sel-compra-prod').value;
      const cant = Number(row.querySelector('.inp-compra-cant').value) || 0;
      const precio = Number(row.querySelector('.inp-compra-precio').value) || 0;
      if (prodId && cant > 0) {
        detalles.push({ productoId: prodId, cantidad: cant, precioUnitario: precio });
      }
    });

    if (detalles.length === 0) {
      alert('Debes agregar al menos un artículo válido a la compra.');
      return;
    }

    const res = Finanzas.registrarCompra({
      negocioId: negActivo.id,
      proveedorId,
      fecha: document.getElementById('modalCompraFecha').value,
      observaciones: document.getElementById('modalCompraObservaciones').value,
      detalles
    });

    if (res.ok) {
      this.closeModalBiz('modalBizNuevaCompra');
      this.showToast(`✓ Compra por ${formatCOP(res.compra.total)} confirmada e inventario actualizado.`);
    } else {
      alert(res.error);
    }
  }

  // 7. PRODUCCIÓN Y FÓRMULAS (Regla 6)
  renderBusinessProduccion(negActivo) {
    const formulas = Finanzas.getFormulas(negActivo.id);
    const container = document.getElementById('bizContainerFormulas');
    if (container) {
      if (formulas.length === 0) {
        container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--pc-text-muted); padding: 1.5rem;">No hay recetas de producción definidas. Haz clic en "+ Nueva Receta".</div>`;
      } else {
        container.innerHTML = formulas.map(f => `
          <div style="background: var(--pc-bg); border: 1px solid var(--pc-border); border-radius: var(--radius-md); padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
              <div>
                <strong style="font-size: 1.05rem;">${escapeHTML(f.nombre)}</strong>
                <p style="font-size: 0.8rem; color: var(--pc-text-muted); margin: 0;">Produce: <strong>${f.cantidadBase} uds</strong> de ${escapeHTML(f.productoNombre)}</p>
              </div>
              <button class="btn-pc-secondary" style="font-size: 0.72rem; color: var(--pc-red); border-color: #fecdd3;" onclick="pcApp.eliminarFormula('${f.id}')">Eliminar</button>
            </div>
            <div style="margin-top: 0.75rem; border-top: 1px dashed var(--pc-border); padding-top: 0.5rem;">
              <strong style="font-size: 0.75rem; text-transform: uppercase; color: var(--pc-text-muted);">Insumos requeridos:</strong>
              <ul style="font-size: 0.82rem; margin-top: 0.25rem; padding-left: 1.2rem; color: var(--pc-text-body);">
                ${f.ingredientes.map(i => `<li>${i.cantidadRequerida} ${i.unidadMedida} de <strong>${escapeHTML(i.materiaPrimaNombre)}</strong></li>`).join('')}
              </ul>
            </div>
          </div>
        `).join('');
      }
    }

    // Historial de lotes fabricados
    const producciones = Finanzas.getProducciones(negActivo.id);
    const tbody = document.getElementById('bizTbodyProducciones');
    if (tbody) {
      if (producciones.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No se han fabricado lotes aún.</td></tr>`;
      } else {
        tbody.innerHTML = producciones.map(p => `
          <tr>
            <td><strong>#${p.id.substring(p.id.length - 6)}</strong></td>
            <td>${escapeHTML(p.formulaNombre)}</td>
            <td><strong>${escapeHTML(p.productoNombre)}</strong></td>
            <td><span class="badge-stock badge-stock-ok">+ ${p.cantidadProducida} uds</span></td>
            <td><strong>${formatCOP(p.costoTotal)}</strong></td>
            <td style="color: var(--pc-teal-dark); font-weight: 700;">${formatCOP(p.costoUnitario)}</td>
            <td>${p.fecha}</td>
            <td><span class="badge-stock badge-stock-ok">${p.estado}</span></td>
          </tr>
        `).join('');
      }
    }
  }

  openModalRegistrarProduccion() {
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const formulas = Finanzas.getFormulas(negActivo.id);
    const sel = document.getElementById('modalProdFormula');
    if (sel) {
      if (formulas.length === 0) {
        sel.innerHTML = '<option value="">-- No hay fórmulas registradas (Crea una primero) --</option>';
      } else {
        sel.innerHTML = formulas.map(f => `<option value="${f.id}">${escapeHTML(f.nombre)} (Base: ${f.cantidadBase} uds)</option>`).join('');
        this.actualizarVistaPreviaFormula(formulas[0].id);
      }
    }

    const inputCant = document.getElementById('modalProdCantidad');
    if (inputCant && formulas[0]) inputCant.value = formulas[0].cantidadBase;

    this.openModalBiz('modalBizRegistrarProduccion');
  }

  actualizarVistaPreviaFormula(formulaId) {
    const formula = Finanzas.getFormulas().find(f => f.id === formulaId);
    const preview = document.getElementById('modalProdFormulaPreview');
    if (!formula || !preview) return;

    preview.innerHTML = `
      <strong>Insumos que se descontarán del inventario (por cada ${formula.cantidadBase} uds):</strong>
      <ul style="margin-top: 4px; padding-left: 1.2rem;">
        ${formula.ingredientes.map(i => {
          const mp = Finanzas.getProductoById(i.materiaPrimaId);
          const stockActual = mp ? mp.stock : 0;
          const alcanza = stockActual >= i.cantidadRequerida;
          return `
            <li style="color: ${alcanza ? 'inherit' : 'var(--pc-red)'}; font-weight: ${alcanza ? 'normal' : '700'};">
              ${i.cantidadRequerida} ${i.unidadMedida} de ${escapeHTML(i.materiaPrimaNombre)} (Stock actual: ${stockActual} ${i.unidadMedida}) ${alcanza ? '✓' : '⚠️ INSUFICIENTE'}
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }

  handleProduccionSubmit(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const formulaId = document.getElementById('modalProdFormula').value;
    const cantidadProducida = Number(document.getElementById('modalProdCantidad').value);

    const res = Finanzas.registrarProduccion({
      negocioId: negActivo.id,
      formulaId,
      cantidadProducida,
      fecha: document.getElementById('modalProdFecha').value,
      notas: document.getElementById('modalProdNotas').value
    });

    if (res.ok) {
      this.closeModalBiz('modalBizRegistrarProduccion');
      this.showToast(`🏭 ¡Lote de ${res.produccion.cantidadProducida} uds fabricado! Costo unitario real: ${formatCOP(res.produccion.costoUnitario)}.`);
    } else {
      alert(res.error);
    }
  }

  openModalNuevaFormula() {
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const selProd = document.getElementById('modalFormProducto');
    const prods = Finanzas.getProductos(negActivo.id, 'PRODUCTO');
    if (selProd) {
      selProd.innerHTML = prods.map(p => `<option value="${p.id}">${escapeHTML(p.nombre)}</option>`).join('');
    }

    const container = document.getElementById('bizContainerIngredientesFormula');
    if (container) {
      container.innerHTML = '';
      this.agregarFilaIngredienteFormula();
    }

    this.openModalBiz('modalBizNuevaFormula');
  }

  agregarFilaIngredienteFormula() {
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const container = document.getElementById('bizContainerIngredientesFormula');
    if (!container) return;

    const materias = Finanzas.getProductos(negActivo.id, 'MATERIA_PRIMA');
    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '2fr 1fr 40px';
    row.style.gap = '0.5rem';
    row.style.alignItems = 'center';
    row.style.marginBottom = '0.5rem';
    row.className = 'biz-ingrediente-row';

    row.innerHTML = `
      <select class="pc-select sel-ingrediente-mp" style="font-size: 0.82rem;">
        ${materias.map(m => `<option value="${m.id}">${escapeHTML(m.nombre)} (${m.unidadMedida})</option>`).join('')}
      </select>
      <input type="number" class="pc-input inp-ingrediente-cant" value="1" min="0.001" step="0.001" placeholder="Cantidad">
      <button type="button" class="btn-pc-secondary" style="padding: 4px; color: var(--pc-red); border-color: #fecdd3;" onclick="pcApp.eliminarFilaIngredienteFormula(this)">✕</button>
    `;
    container.appendChild(row);
  }

  eliminarFilaIngredienteFormula(btn) {
    const row = btn.closest('.biz-ingrediente-row');
    if (row) row.remove();
  }

  handleCrearFormulaSubmit(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const ingredientes = [];
    document.querySelectorAll('#bizContainerIngredientesFormula .biz-ingrediente-row').forEach(row => {
      const mpId = row.querySelector('.sel-ingrediente-mp').value;
      const cant = Number(row.querySelector('.inp-ingrediente-cant').value) || 0;
      if (mpId && cant > 0) {
        ingredientes.push({ materiaPrimaId: mpId, cantidadRequerida: cant });
      }
    });

    if (ingredientes.length === 0) {
      alert('Debes agregar al menos una materia prima a la receta.');
      return;
    }

    const res = Finanzas.agregarFormula({
      negocioId: negActivo.id,
      nombre: document.getElementById('modalFormNombre').value,
      productoId: document.getElementById('modalFormProducto').value,
      cantidadBase: document.getElementById('modalFormCantBase').value,
      descripcion: document.getElementById('modalFormDesc').value,
      ingredientes
    });

    if (res.ok) {
      this.closeModalBiz('modalBizNuevaFormula');
      this.showToast(`✓ Fórmula "${res.formula.nombre}" creada.`);
    } else {
      alert(res.error);
    }
  }

  eliminarFormula(id) {
    if (confirm('¿Eliminar esta fórmula de producción?')) {
      Finanzas.eliminarFormula(id);
      this.showToast('Fórmula eliminada.');
    }
  }

  // 8. PROVEEDORES
  renderBusinessProveedores(negActivo) {
    const provs = Finanzas.getProveedores(negActivo.id);
    const tbody = document.getElementById('bizTbodyProveedores');
    if (tbody) {
      if (provs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay proveedores registrados.</td></tr>`;
      } else {
        tbody.innerHTML = provs.map(p => `
          <tr>
            <td><strong>${escapeHTML(p.nombre)}</strong></td>
            <td>${escapeHTML(p.telefono || '-')}</td>
            <td>${escapeHTML(p.email || '-')}</td>
            <td>${escapeHTML(p.direccion || '-')}</td>
            <td>
              <button class="btn-pc-secondary" style="font-size: 0.75rem; color: var(--pc-red); border-color: #fecdd3;" onclick="pcApp.eliminarProveedor('${p.id}')">🗑️</button>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  openModalNuevoProveedor() {
    this.openModalBiz('modalBizNuevoProveedor');
  }

  handleCrearProveedorSubmit(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const res = Finanzas.agregarProveedor({
      negocioId: negActivo.id,
      nombre: document.getElementById('modalProvNombre').value,
      telefono: document.getElementById('modalProvTel').value,
      email: document.getElementById('modalProvMail').value,
      direccion: document.getElementById('modalProvDir').value
    });

    if (res.ok) {
      this.closeModalBiz('modalBizNuevoProveedor');
      e.target.reset();
      this.showToast(`✓ Proveedor "${res.proveedor.nombre}" registrado.`);
    } else {
      alert(res.error);
    }
  }

  eliminarProveedor(id) {
    if (confirm('¿Eliminar este proveedor?')) {
      Finanzas.eliminarProveedor(id);
      this.showToast('Proveedor eliminado.');
    }
  }

  // 9. VENTAS Y FACTURACIÓN (Reglas 2, 3, 4)
  renderBusinessVentas(negActivo) {
    let ventas = Finanzas.getVentas(negActivo.id);

    if (this.filtroTipoVentas && this.filtroTipoVentas !== 'ALL') {
      ventas = ventas.filter(v => v.tipoPago === this.filtroTipoVentas);
    }

    if (this.textoFiltroVentas) {
      const q = this.textoFiltroVentas.toLowerCase();
      ventas = ventas.filter(v => v.clienteNombre.toLowerCase().includes(q) || v.id.toLowerCase().includes(q));
    }

    const tbody = document.getElementById('bizTbodyVentas');
    if (tbody) {
      if (ventas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay ventas registradas con el filtro actual.</td></tr>`;
      } else {
        tbody.innerHTML = ventas.map(v => `
          <tr>
            <td><strong>#${v.id.substring(v.id.length - 6)}</strong></td>
            <td><strong>${escapeHTML(v.clienteNombre)}</strong></td>
            <td>${v.fecha}</td>
            <td><span class="badge-stock ${v.tipoPago === 'CREDITO' ? 'badge-stock-low' : 'badge-stock-ok'}">${v.tipoPago}</span></td>
            <td><strong>${formatCOP(v.total)}</strong></td>
            <td style="color: ${v.saldoPendiente > 0 ? '#d97706' : 'var(--pc-text-muted)'}; font-weight: 700;">${formatCOP(v.saldoPendiente)}</td>
            <td><span class="badge-stock ${v.estado === 'PAGADA' ? 'badge-stock-ok' : 'badge-stock-out'}">${v.estado}</span></td>
            <td>
              ${v.tipoPago === 'CREDITO' && v.saldoPendiente > 0 ? `
                <button class="btn-pc-secondary" style="font-size: 0.75rem;" onclick="pcApp.openModalAbonoCredito('${v.id}')">💳 Abonar</button>
              ` : '<span style="font-size: 0.75rem; color: #059669;">✓ Cancelada</span>'}
            </td>
          </tr>
        `).join('');
      }
    }
  }

  filtrarTablaVentas(texto) {
    this.textoFiltroVentas = texto;
    const negActivo = Finanzas.getNegocioActivo();
    if (negActivo) this.renderBusinessVentas(negActivo);
  }

  filtrarVentasTipo(tipo) {
    this.filtroTipoVentas = tipo;
    const negActivo = Finanzas.getNegocioActivo();
    if (negActivo) this.renderBusinessVentas(negActivo);
  }

  openModalNuevaVenta() {
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const clis = Finanzas.getClientes(negActivo.id);
    const selCli = document.getElementById('modalVentaCliente');
    if (selCli) {
      if (clis.length === 0) {
        selCli.innerHTML = '<option value="">-- No hay clientes registrados (Regístrelos primero) --</option>';
      } else {
        selCli.innerHTML = clis.map(c => `<option value="${c.id}">${escapeHTML(c.nombre)} (Saldo deudor: ${formatCOP(c.saldoPendiente)})</option>`).join('');
      }
    }

    const container = document.getElementById('bizContainerItemsVenta');
    if (container) {
      container.innerHTML = '';
      this.agregarFilaItemVenta();
    }

    this.recalcularTotalVentaModal();
    this.openModalBiz('modalBizNuevaVenta');
  }

  toggleModalVentaTipoPago(tipo) {
    const grpMetodo = document.getElementById('grpModalVentaMetodo');
    if (grpMetodo) grpMetodo.style.display = tipo === 'CREDITO' ? 'none' : 'block';
  }

  agregarFilaItemVenta() {
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const container = document.getElementById('bizContainerItemsVenta');
    if (!container) return;

    const prods = Finanzas.getProductos(negActivo.id, 'PRODUCTO');
    const row = document.createElement('div');
    row.className = 'biz-item-row';
    row.innerHTML = `
      <select class="pc-select sel-venta-prod" onchange="pcApp.actualizarPrecioFilaVenta(this)" style="font-size: 0.82rem;">
        ${prods.map(p => `<option value="${p.id}" data-precio="${p.precioVenta}" data-stock="${p.stock}" data-unidad="${p.unidadMedida}">${escapeHTML(p.nombre)} (Disp: ${p.stock} ${p.unidadMedida})</option>`).join('')}
      </select>
      <input type="number" class="pc-input inp-venta-cant" value="1" min="1" step="0.01" placeholder="Cant" oninput="pcApp.recalcularTotalVentaModal()">
      <input type="number" class="pc-input inp-venta-precio" value="${prods[0] ? prods[0].precioVenta : 0}" step="0.01" placeholder="Precio" oninput="pcApp.recalcularTotalVentaModal()">
      <div class="lbl-venta-subtotal" style="font-weight: 700; font-size: 0.85rem; text-align: right; color: #059669;">$ 0</div>
      <button type="button" class="btn-pc-secondary" style="padding: 4px; color: var(--pc-red); border-color: #fecdd3;" onclick="pcApp.eliminarFilaItemVenta(this)">✕</button>
    `;
    container.appendChild(row);
    this.recalcularTotalVentaModal();
  }

  actualizarPrecioFilaVenta(sel) {
    const opt = sel.options[sel.selectedIndex];
    const precio = opt ? opt.getAttribute('data-precio') : 0;
    const row = sel.closest('.biz-item-row');
    if (row) {
      const inpPrecio = row.querySelector('.inp-venta-precio');
      if (inpPrecio) inpPrecio.value = precio;
    }
    this.recalcularTotalVentaModal();
  }

  eliminarFilaItemVenta(btn) {
    const row = btn.closest('.biz-item-row');
    if (row) row.remove();
    this.recalcularTotalVentaModal();
  }

  recalcularTotalVentaModal() {
    let total = 0;
    document.querySelectorAll('#bizContainerItemsVenta .biz-item-row').forEach(row => {
      const cant = Number(row.querySelector('.inp-venta-cant').value) || 0;
      const precio = Number(row.querySelector('.inp-venta-precio').value) || 0;
      const sub = cant * precio;
      total += sub;
      const lbl = row.querySelector('.lbl-venta-subtotal');
      if (lbl) lbl.textContent = formatCOP(sub);
    });

    const lblTotal = document.getElementById('lblModalVentaTotal');
    if (lblTotal) lblTotal.textContent = formatCOP(total);
  }

  handleVentaSubmit(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const clienteId = document.getElementById('modalVentaCliente').value;
    if (!clienteId) {
      alert('Por favor selecciona o registra un cliente.');
      return;
    }

    const detalles = [];
    document.querySelectorAll('#bizContainerItemsVenta .biz-item-row').forEach(row => {
      const prodId = row.querySelector('.sel-venta-prod').value;
      const cant = Number(row.querySelector('.inp-venta-cant').value) || 0;
      const precio = Number(row.querySelector('.inp-venta-precio').value) || 0;
      if (prodId && cant > 0) {
        detalles.push({ productoId: prodId, cantidad: cant, precioUnitario: precio });
      }
    });

    if (detalles.length === 0) {
      alert('Debes agregar al menos un producto a la factura.');
      return;
    }

    const tipoPago = document.getElementById('modalVentaTipoPago').value;
    const metodoPago = document.getElementById('modalVentaMetodo').value;

    const res = Finanzas.registrarVenta({
      negocioId: negActivo.id,
      clienteId,
      fecha: document.getElementById('modalVentaFecha').value,
      tipoPago,
      metodoPago,
      notas: document.getElementById('modalVentaNotas').value,
      detalles
    });

    if (res.ok) {
      this.closeModalBiz('modalBizNuevaVenta');
      this.showToast(`✓ Venta por ${formatCOP(res.venta.total)} confirmada.`);
    } else {
      alert(res.error);
    }
  }

  // 10. CLIENTES
  renderBusinessClientes(negActivo) {
    const clis = Finanzas.getClientes(negActivo.id);
    const tbody = document.getElementById('bizTbodyClientes');
    if (tbody) {
      if (clis.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay clientes registrados.</td></tr>`;
      } else {
        tbody.innerHTML = clis.map(c => `
          <tr>
            <td><strong>${escapeHTML(c.nombre)}</strong></td>
            <td>${escapeHTML(c.telefono || '-')}</td>
            <td>${escapeHTML(c.email || '-')}</td>
            <td>${escapeHTML(c.direccion || '-')}</td>
            <td>
              <strong style="color: ${c.saldoPendiente > 0 ? '#d97706' : '#059669'}; font-size: 0.95rem;">${formatCOP(c.saldoPendiente)}</strong>
              ${c.saldoPendiente > 0 ? '<span class="badge-stock badge-stock-low" style="margin-left: 6px;">Con Deuda</span>' : '<span class="badge-stock badge-stock-ok" style="margin-left: 6px;">Al Día</span>'}
            </td>
            <td>
              <button class="btn-pc-secondary" style="font-size: 0.75rem; color: var(--pc-red); border-color: #fecdd3;" onclick="pcApp.eliminarCliente('${c.id}')">🗑️</button>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  openModalNuevoCliente() {
    this.openModalBiz('modalBizNuevoCliente');
  }

  handleCrearClienteSubmit(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const res = Finanzas.agregarCliente({
      negocioId: negActivo.id,
      nombre: document.getElementById('modalCliNombre').value,
      telefono: document.getElementById('modalCliTel').value,
      email: document.getElementById('modalCliMail').value,
      direccion: document.getElementById('modalCliDir').value
    });

    if (res.ok) {
      this.closeModalBiz('modalBizNuevoCliente');
      e.target.reset();
      this.showToast(`✓ Cliente "${res.cliente.nombre}" registrado.`);
    } else {
      alert(res.error);
    }
  }

  eliminarCliente(id) {
    if (confirm('¿Eliminar este cliente?')) {
      Finanzas.eliminarCliente(id);
      this.showToast('Cliente eliminado.');
    }
  }

  // 11. CRÉDITOS Y COBRANZAS (Regla 5)
  renderBusinessCreditos(negActivo) {
    const ventasCredito = Finanzas.getVentasCredito(negActivo.id);
    const clientes = Finanzas.getClientes(negActivo.id);
    const pagos = (Finanzas.state.pagosVenta || []).filter(p => p.negocioId === negActivo.id);

    let saldoTotal = 0;
    clientes.forEach(c => saldoTotal += Number(c.saldoPendiente) || 0);

    const clientesConDeuda = clientes.filter(c => c.saldoPendiente > 0).length;

    let totalRecaudado = 0;
    pagos.forEach(p => totalRecaudado += Number(p.monto) || 0);

    const elSaldo = document.getElementById('bizKpiCreditosTotalPendiente');
    const elCount = document.getElementById('bizKpiCreditosClientesCount');
    const elAbonos = document.getElementById('bizKpiCreditosAbonosRecaudados');

    if (elSaldo) elSaldo.textContent = formatCOP(saldoTotal);
    if (elCount) elCount.textContent = `${clientesConDeuda} clientes`;
    if (elAbonos) elAbonos.textContent = formatCOP(totalRecaudado);

    // Tabla de ventas a crédito pendientes
    const pendientes = ventasCredito.filter(v => v.saldoPendiente > 0);
    const tbodyCreditos = document.getElementById('bizTbodyCreditosPendientes');
    if (tbodyCreditos) {
      if (pendientes.length === 0) {
        tbodyCreditos.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #059669; padding: 2rem;">✓ No hay saldos pendientes por cobrar en este momento.</td></tr>`;
      } else {
        tbodyCreditos.innerHTML = pendientes.map(v => `
          <tr>
            <td><strong>#${v.id.substring(v.id.length - 6)}</strong></td>
            <td><strong>${escapeHTML(v.clienteNombre)}</strong></td>
            <td>${v.fecha}</td>
            <td>${formatCOP(v.total)}</td>
            <td><strong style="color: #d97706; font-size: 0.95rem;">${formatCOP(v.saldoPendiente)}</strong></td>
            <td><span class="badge-stock badge-stock-low">PENDIENTE</span></td>
            <td>
              <button class="btn-pc-primary" style="font-size: 0.78rem;" onclick="pcApp.openModalAbonoCredito('${v.id}')">💳 Registrar Abono</button>
            </td>
          </tr>
        `).join('');
      }
    }

    // Historial de abonos
    const tbodyAbonos = document.getElementById('bizTbodyAbonosHistorial');
    if (tbodyAbonos) {
      if (pagos.length === 0) {
        tbodyAbonos.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--pc-text-muted); padding: 1.5rem;">No se han registrado abonos todavía.</td></tr>`;
      } else {
        tbodyAbonos.innerHTML = pagos.map(p => `
          <tr>
            <td>${p.fecha}</td>
            <td><strong>#${p.ventaId ? p.ventaId.substring(p.ventaId.length - 6) : '-'}</strong></td>
            <td><strong>${escapeHTML(p.clienteNombre || '-')}</strong></td>
            <td><strong style="color: #059669;">+ ${formatCOP(p.monto)}</strong></td>
            <td>${escapeHTML(p.metodoPago)}</td>
            <td>${escapeHTML(p.notas || '-')}</td>
          </tr>
        `).join('');
      }
    }
  }

  openModalAbonoCredito(ventaId) {
    const venta = Finanzas.getVentas().find(v => v.id === ventaId);
    if (!venta) return;

    const elId = document.getElementById('modalAbonoVentaId');
    const elCli = document.getElementById('modalAbonoClienteNombre');
    const elFact = document.getElementById('modalAbonoVentaNumero');
    const elSaldo = document.getElementById('modalAbonoSaldoActual');
    const elMonto = document.getElementById('modalAbonoMonto');

    if (elId) elId.value = venta.id;
    if (elCli) elCli.textContent = venta.clienteNombre;
    if (elFact) elFact.textContent = `#${venta.id.substring(venta.id.length - 6)}`;
    if (elSaldo) elSaldo.textContent = formatCOP(venta.saldoPendiente);
    if (elMonto) elMonto.value = venta.saldoPendiente;

    this.openModalBiz('modalBizAbonoCredito');
  }

  handleAbonoCreditoSubmit(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const res = Finanzas.registrarAbonoVenta({
      negocioId: negActivo.id,
      ventaId: document.getElementById('modalAbonoVentaId').value,
      monto: document.getElementById('modalAbonoMonto').value,
      fecha: document.getElementById('modalAbonoFecha').value,
      metodoPago: document.getElementById('modalAbonoMetodo').value,
      notas: document.getElementById('modalAbonoNotas').value
    });

    if (res.ok) {
      this.closeModalBiz('modalBizAbonoCredito');
      this.showToast(`✓ Abono de ${formatCOP(res.pago.monto)} registrado correctamente.`);
    } else {
      alert(res.error);
    }
  }

  // 12. EMPLEADOS Y NÓMINA
  renderBusinessEmpleados(negActivo) {
    const emps = Finanzas.getEmpleados(negActivo.id);
    const tbody = document.getElementById('bizTbodyEmpleados');
    if (tbody) {
      if (emps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay colaboradores registrados.</td></tr>`;
      } else {
        tbody.innerHTML = emps.map(e => `
          <tr>
            <td><strong>${escapeHTML(e.nombre)}</strong></td>
            <td>${escapeHTML(e.cargo)}</td>
            <td>${escapeHTML(e.telefono || '-')}</td>
            <td><strong>${formatCOP(e.salario)}</strong></td>
            <td>${e.fechaIngreso}</td>
            <td><span class="badge-stock ${e.estado === 'ACTIVO' ? 'badge-stock-ok' : 'badge-stock-out'}">${e.estado}</span></td>
            <td>
              <button class="btn-pc-secondary" style="font-size: 0.75rem; color: var(--pc-red); border-color: #fecdd3;" onclick="pcApp.eliminarEmpleado('${e.id}')">🗑️</button>
            </td>
          </tr>
        `).join('');
      }
    }

    // Historial de pagos nómina
    const pagos = Finanzas.getPagosEmpleado(negActivo.id);
    const tbodyPagos = document.getElementById('bizTbodyPagosNomina');
    if (tbodyPagos) {
      if (pagos.length === 0) {
        tbodyPagos.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--pc-text-muted); padding: 1.5rem;">No se han emitido pagos de nómina aún.</td></tr>`;
      } else {
        tbodyPagos.innerHTML = pagos.map(p => `
          <tr>
            <td>${p.fecha}</td>
            <td><strong>${escapeHTML(p.empleadoNombre)}</strong></td>
            <td>${escapeHTML(p.concepto)}</td>
            <td>${escapeHTML(p.periodo)}</td>
            <td><strong style="color: var(--pc-red);">${formatCOP(p.monto)}</strong></td>
            <td>${escapeHTML(p.metodoPago)}</td>
          </tr>
        `).join('');
      }
    }
  }

  openModalNuevoEmpleado() {
    this.openModalBiz('modalBizNuevoEmpleado');
  }

  handleCrearEmpleadoSubmit(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const res = Finanzas.agregarEmpleado({
      negocioId: negActivo.id,
      nombre: document.getElementById('modalEmpNombre').value,
      cargo: document.getElementById('modalEmpCargo').value,
      telefono: document.getElementById('modalEmpTel').value,
      salario: document.getElementById('modalEmpSalario').value,
      fechaIngreso: document.getElementById('modalEmpFecha').value
    });

    if (res.ok) {
      this.closeModalBiz('modalBizNuevoEmpleado');
      e.target.reset();
      this.showToast(`✓ Colaborador "${res.empleado.nombre}" registrado.`);
    } else {
      alert(res.error);
    }
  }

  eliminarEmpleado(id) {
    if (confirm('¿Eliminar este empleado de la plantilla?')) {
      Finanzas.eliminarEmpleado(id);
      this.showToast('Empleado eliminado.');
    }
  }

  openModalPagoNomina() {
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const emps = Finanzas.getEmpleados(negActivo.id);
    const sel = document.getElementById('modalPagoNomEmpleado');
    if (sel) {
      if (emps.length === 0) {
        sel.innerHTML = '<option value="">-- No hay empleados registrados --</option>';
      } else {
        sel.innerHTML = emps.map(e => `<option value="${e.id}" data-salario="${e.salario}">${escapeHTML(e.nombre)} (${escapeHTML(e.cargo)} - Sueldo: ${formatCOP(e.salario)})</option>`).join('');
        this.actualizarMontoSugeridoNomina(emps[0].id);
      }
    }

    this.openModalBiz('modalBizPagoNomina');
  }

  actualizarMontoSugeridoNomina(empId) {
    const emp = Finanzas.getEmpleados().find(e => e.id === empId);
    const inpMonto = document.getElementById('modalPagoNomMonto');
    if (emp && inpMonto) {
      // Sugerir quincena
      inpMonto.value = (emp.salario / 2).toFixed(2);
    }
  }

  handlePagoNominaSubmit(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const res = Finanzas.registrarPagoEmpleado({
      negocioId: negActivo.id,
      empleadoId: document.getElementById('modalPagoNomEmpleado').value,
      monto: document.getElementById('modalPagoNomMonto').value,
      concepto: document.getElementById('modalPagoNomConcepto').value,
      periodo: document.getElementById('modalPagoNomPeriodo').value,
      fecha: document.getElementById('modalPagoNomFecha').value,
      metodoPago: document.getElementById('modalPagoNomMetodo').value
    });

    if (res.ok) {
      this.closeModalBiz('modalBizPagoNomina');
      this.showToast(`✓ Pago de nómina a "${res.pago.empleadoNombre}" registrado por ${formatCOP(res.pago.monto)}.`);
    } else {
      alert(res.error);
    }
  }

  // 13. GASTOS EMPRESARIALES (Regla 7)
  renderBusinessGastos(negActivo) {
    const gastos = Finanzas.getGastosNegocio(negActivo.id);
    const tbody = document.getElementById('bizTbodyGastos');
    if (tbody) {
      if (gastos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--pc-text-muted); padding: 2rem;">No hay gastos operativos registrados. Haz clic en "+ Registrar Gasto Negocio".</td></tr>`;
      } else {
        tbody.innerHTML = gastos.map(g => `
          <tr>
            <td>${g.fecha}</td>
            <td><span class="badge-stock badge-stock-low">${escapeHTML(g.categoria)}</span></td>
            <td><strong>${escapeHTML(g.descripcion)}</strong></td>
            <td><strong style="color: var(--pc-red);">${formatCOP(g.monto)}</strong></td>
            <td>
              <button class="btn-pc-secondary" style="font-size: 0.75rem; color: var(--pc-red); border-color: #fecdd3;" onclick="pcApp.eliminarGastoNegocio('${g.id}')">🗑️</button>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  openModalNuevoGasto() {
    this.openModalBiz('modalBizNuevoGasto');
  }

  handleGastoNegocioSubmit(e) {
    e.preventDefault();
    const negActivo = Finanzas.getNegocioActivo();
    if (!negActivo) return;

    const res = Finanzas.registrarGastoNegocio({
      negocioId: negActivo.id,
      categoria: document.getElementById('modalGastoNegCategoria').value,
      monto: document.getElementById('modalGastoNegMonto').value,
      fecha: document.getElementById('modalGastoNegFecha').value,
      descripcion: document.getElementById('modalGastoNegDesc').value
    });

    if (res.ok) {
      this.closeModalBiz('modalBizNuevoGasto');
      e.target.reset();
      this.showToast(`✓ Gasto de ${formatCOP(res.gasto.monto)} registrado.`);
    } else {
      alert(res.error);
    }
  }

  eliminarGastoNegocio(id) {
    if (confirm('¿Eliminar este registro de gasto?')) {
      Finanzas.eliminarGastoNegocio(id);
      this.showToast('Gasto eliminado.');
    }
  }

  // 14. GANANCIAS Y REPORTES FINANCIEROS (Regla 9)
  cambiarFiltroReportesPeriodo(periodo) {
    this.filtroPeriodoReportes = periodo;
    const negActivo = Finanzas.getNegocioActivo();
    if (negActivo) this.renderBusinessReportes(negActivo);
  }

  renderBusinessReportes(negActivo) {
    const periodo = this.filtroPeriodoReportes || 'MES_ACTUAL';
    const metricas = Finanzas.calcularMetricasEmpresariales(negActivo.id, periodo);

    const periodosLabelMap = {
      'MES_ACTUAL': 'Mes en Curso',
      'ANIO_ACTUAL': 'Año Fiscal en Curso',
      'TODOS': 'Histórico Consolidado'
    };

    const elPeriodo = document.getElementById('bizReportePeriodoTitulo');
    if (elPeriodo) elPeriodo.textContent = `Período: ${periodosLabelMap[periodo] || periodo} · ${negActivo.nombre}`;

    const elVentas = document.getElementById('repVentasTotales');
    const elCosto = document.getElementById('repCostoVentas');
    const elBruta = document.getElementById('repUtilidadBruta');
    const elGastos = document.getElementById('repGastosOperativos');
    const elNeta = document.getElementById('repUtilidadNeta');
    const elMargenBruto = document.getElementById('repMargenBruto');
    const elMargenNeto = document.getElementById('repMargenNeto');

    if (elVentas) elVentas.textContent = formatCOP(metricas.ventasTotales);
    if (elCosto) elCosto.textContent = `- ${formatCOP(metricas.costoProductosVendidos)}`;
    if (elBruta) elBruta.textContent = formatCOP(metricas.utilidadBruta);
    if (elGastos) elGastos.textContent = `- ${formatCOP(metricas.gastosOperativos)}`;
    if (elNeta) elNeta.textContent = formatCOP(metricas.utilidadNeta);
    if (elMargenBruto) elMargenBruto.textContent = `${metricas.margenBrutoPct.toFixed(1)}%`;
    if (elMargenNeto) elMargenNeto.textContent = `${metricas.margenNetoPct.toFixed(1)}%`;
  }
}

// Inicialización global de la aplicación de escritorio
const pcApp = new DesktopApp();
