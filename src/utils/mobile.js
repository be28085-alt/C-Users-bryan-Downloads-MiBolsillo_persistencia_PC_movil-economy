/**
 * ============================================================================
 * PROYECTO: MiBolsillo · Control de Finanzas Personales
 * ARCHIVO: mobile.js
 * ROL: Controlador Exclusivo para la Versión Móvil (Smartphone)
 * ============================================================================
 */

class MobileApp {
  constructor() {
    this.ui = window.MiBolsilloUiShared || null;
    this.currentTab = 'inicio';
    this.currentBusinessTab = 'negocio';
    this.currentModule = 'PERSONAL';
    this.currentPlanSubtab = 'presupuestos';
    this.filtroTipo = 'TODOS';
    this.modalType = 'GASTO';
    this.chartInstance = null;
    this.chartCategories = null;
    this.businessChart = null;
    this.initialized = false;
    this._savingMovement = false;
    this._lastMovementSignature = '';
    this._lastMovementAt = 0;
  }

  init() {
    if (this.initialized) return this;
    this.initialized = true;

    if (this.ui && typeof this.ui.subscribeToStore === 'function') {
      this.ui.subscribeToStore(() => this.renderAll());
    } else {
      Finanzas.subscribe(() => this.renderAll());
    }

    if (this.ui && typeof this.ui.bindDocumentAction === 'function') {
      this.ui.bindDocumentAction(document, '[data-mobile-action]', (event, button) => this.handleDynamicAction(event, button));
    } else {
      document.addEventListener('click', (event) => this.handleDynamicAction(event));
    }
    configurarEntradasMonetarias();

    // Configurar reloj de barra de estado
    this.actualizarReloj();
    setInterval(() => this.actualizarReloj(), 60000);

    // Configurar fecha de hoy en formularios
    const hoyStr = obtenerFechaHoyISO();
    if (this.ui && typeof this.ui.applyDateDefaults === 'function') {
      this.ui.applyDateDefaults(['mobInputFecha'], hoyStr);
    } else {
      const inpFecha = document.getElementById('mobInputFecha');
      if (inpFecha) inpFecha.value = hoyStr;
    }

    document.getElementById('mobInputMonto')?.addEventListener('input', () => this.updateLiveImpact());
    document.getElementById('mobSelectCategoria')?.addEventListener('change', () => this.updateLiveImpact());

    // Abre el módulo solicitado por el acceso directo; de forma predeterminada
    // inicia en "Mi dinero", independientemente del último módulo utilizado.
    const requestedModule = new URLSearchParams(window.location.search).get('modulo');
    const openBusiness = requestedModule && requestedModule.toUpperCase() === 'EMPRESARIAL';
    this.currentModule = openBusiness ? 'EMPRESARIAL' : 'PERSONAL';
    this.currentTab = openBusiness ? 'negocio' : 'inicio';
    this.actualizarModuloVisual(this.currentModule);
    this.renderNavigationState();
    this.switchTab(this.currentTab);

    // Renderizar estado inicial
    this.renderAll();
    this.updateLiveImpact();
  }

  handleDynamicAction(event, resolvedButton = null) {
    const quickAction = event && event.target ? event.target.closest('[data-quick-action]') : null;
    if (quickAction) {
      this.handleQuickAction(quickAction.dataset.quickAction);
      return;
    }

    const button = resolvedButton || (event && event.target ? event.target.closest('[data-mobile-action]') : null);
    if (!button) return;

    if (this.ui && typeof this.ui.dispatchCommonAction === 'function' && this.ui.dispatchCommonAction(this, button)) {
      return;
    }

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
  // NAVEGACIÓN Y CAMBIO DE MÓDULOS MÓVILES
  // ==========================================================================
  setModulo(modulo, targetView = null) {
    const nextModulo = modulo === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PERSONAL';
    this.currentModule = nextModulo;

    if (Finanzas && typeof Finanzas.setModuloActivo === 'function') {
      Finanzas.setModuloActivo(nextModulo);
    }

    this.actualizarModuloVisual(nextModulo);
    this.switchTab(targetView || (nextModulo === 'EMPRESARIAL' ? 'negocio' : 'inicio'));
  }

  actualizarModuloVisual(modulo) {
    const normalizedModulo = modulo === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PERSONAL';
    const isBusiness = normalizedModulo === 'EMPRESARIAL';
    document.querySelectorAll('.module-toggle-btn').forEach((button) => {
      const active = button.dataset.module === normalizedModulo;
      button.classList.toggle('active', active);
    });

    if (isBusiness) {
      const brandTitle = document.getElementById('lblMobileUserNombre');
      if (brandTitle) brandTitle.textContent = 'Negocio';
    } else {
      const brandTitle = document.getElementById('lblMobileUserNombre');
      if (brandTitle) brandTitle.textContent = (Finanzas?.state?.usuario?.nombre || 'Lucía').split(' ')[0] || 'Lucía';
    }
  }

  switchTab(tabId, subtab = null) {
    this.currentTab = tabId;

    document.querySelectorAll('.screen-view').forEach(view => {
      view.classList.remove('active');
    });

    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) targetView.classList.add('active');

    if (tabId === 'negocio') {
      this.currentModule = 'EMPRESARIAL';
      this.currentBusinessTab = this.currentBusinessTab === 'perfil' ? 'negocio' : (this.currentBusinessTab || 'negocio');
      this.actualizarModuloVisual('EMPRESARIAL');
      if (Finanzas && typeof Finanzas.setModuloActivo === 'function') {
        Finanzas.setModuloActivo('EMPRESARIAL');
      }
      document.querySelectorAll('.business-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.businessPanel === this.currentBusinessTab);
      });
    } else if (['inicio', 'movimientos', 'plan', 'informes'].includes(tabId)) {
      this.currentModule = 'PERSONAL';
      this.actualizarModuloVisual('PERSONAL');
      if (Finanzas && typeof Finanzas.setModuloActivo === 'function') {
        Finanzas.setModuloActivo('PERSONAL');
      }
    } else if (tabId === 'perfil') {
      if (this.currentModule === 'EMPRESARIAL') {
        this.currentBusinessTab = 'perfil';
      } else {
        this.currentModule = 'PERSONAL';
        this.actualizarModuloVisual('PERSONAL');
        if (Finanzas && typeof Finanzas.setModuloActivo === 'function') {
          Finanzas.setModuloActivo('PERSONAL');
        }
      }
    }

    this.renderNavigationState();

    if (tabId === 'plan' && subtab) {
      this.switchPlanSubtab(subtab);
    }

    if (tabId === 'informes') {
      setTimeout(() => this.renderizarGraficoInformes(), 50);
    }

    const container = document.getElementById('mobileScreensContainer');
    if (container) container.scrollTop = 0;
  }

  renderNavigationState() {
    const module = (this.currentModule || 'PERSONAL');
    const isBusiness = module === 'EMPRESARIAL';
    const personalNav = document.getElementById('mobilePersonalNav');
    const businessNav = document.getElementById('mobileBusinessNav');

    if (personalNav) personalNav.style.display = isBusiness ? 'none' : 'flex';
    if (businessNav) businessNav.style.display = isBusiness ? 'flex' : 'none';

    document.querySelectorAll('.nav-btn').forEach(btn => {
      const key = btn.getAttribute('data-tab');
      const businessKey = btn.getAttribute('data-business-tab');
      const isActive = isBusiness
        ? (businessKey && businessKey === this.currentBusinessTab)
        : (key && key === this.currentTab);
      btn.classList.toggle('active', !!isActive);
    });
  }

  switchBusinessTab(tabId) {
    if (tabId === 'perfil') {
      this.currentModule = 'EMPRESARIAL';
      this.currentBusinessTab = 'perfil';
      this.currentTab = 'perfil';
      if (Finanzas && typeof Finanzas.setModuloActivo === 'function') {
        Finanzas.setModuloActivo('EMPRESARIAL');
      }
      this.actualizarModuloVisual('EMPRESARIAL');
      document.querySelectorAll('.screen-view').forEach(view => view.classList.remove('active'));
      document.getElementById('view-perfil')?.classList.add('active');
      this.renderNavigationState();
      this.renderPerfil();
      const container = document.getElementById('mobileScreensContainer');
      if (container) container.scrollTop = 0;
      return;
    }

    this.currentBusinessTab = tabId;
    this.currentModule = 'EMPRESARIAL';
    this.currentTab = 'negocio';
    if (Finanzas && typeof Finanzas.setModuloActivo === 'function') {
      Finanzas.setModuloActivo('EMPRESARIAL');
    }
    this.actualizarModuloVisual('EMPRESARIAL');
    this.renderNavigationState();

    document.querySelectorAll('.business-panel').forEach(panel => {
      const isActive = panel.dataset.businessPanel === tabId;
      panel.classList.toggle('active', isActive);
    });

    this.mostrarToast(`Vista de negocio: ${tabId === 'negocio' ? 'Inicio' : tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    const targetView = document.getElementById('view-negocio');
    if (targetView) {
      document.querySelectorAll('.screen-view').forEach(view => view.classList.remove('active'));
      targetView.classList.add('active');
    }
    this.renderNegocio();
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
    this.renderNegocio();
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
    if (nameEl) {
      nameEl.textContent = this.currentModule === 'EMPRESARIAL' ? 'Negocio' : (u.nombre.split(' ')[0] || 'Lucía');
    }
    const initialsEl = document.getElementById('lblMobileAvatarInitials');
    if (initialsEl) initialsEl.textContent = this.currentModule === 'EMPRESARIAL' ? 'NG' : u.iniciales;
  }

  renderNegocio() {
    const negocio = Finanzas.getNegocioActivo();
    if (!negocio) return;
    const ventas = Finanzas.getVentas(negocio.id);
    const ingresosNegocio = Finanzas.getIngresosNegocio(negocio.id);
    const compras = Finanzas.getCompras(negocio.id);
    const gastosNegocio = Finanzas.getGastosNegocio(negocio.id);
    const pagosEmpleado = Finanzas.getPagosEmpleado(negocio.id);
    const productos = Finanzas.getProductos(negocio.id, 'ALL');
    const proveedores = Finanzas.getProveedores(negocio.id);

    const ventasTotal = ventas.reduce((sum, item) => sum + Number(item.total || 0), 0)
      + ingresosNegocio.reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const comprasTotal = compras.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const gastosTotal = gastosNegocio.reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const nominaTotal = pagosEmpleado.reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const utilidad = ventasTotal - comprasTotal - gastosTotal - nominaTotal;
    const balance = ventasTotal - (comprasTotal + gastosTotal + nominaTotal);
    const stockBajo = productos.filter(item => Number(item.stock || 0) <= Number(item.stockMinimo || 0)).length;

    const ids = {
      ingresos: document.getElementById('lblMobileBusinessIngresos'),
      balance: document.getElementById('lblMobileBusinessBalance'),
      gastos: document.getElementById('lblMobileBusinessGastos'),
      ventas: document.getElementById('lblMobileBusinessVentas'),
      compras: document.getElementById('lblMobileBusinessCompras'),
      utilidad: document.getElementById('lblMobileBusinessUtilidad'),
      stock: document.getElementById('lblMobileBusinessStockBajo')
    };

    if (ids.ingresos) ids.ingresos.textContent = formatCOP(ventasTotal);
    if (ids.balance) ids.balance.textContent = formatCOP(balance);
    if (ids.gastos) ids.gastos.textContent = `-${formatCOP(comprasTotal + gastosTotal + nominaTotal)}`;
    if (ids.ventas) ids.ventas.textContent = formatCOP(ventasTotal);
    if (ids.compras) ids.compras.textContent = formatCOP(comprasTotal + gastosTotal + nominaTotal);
    if (ids.utilidad) ids.utilidad.textContent = formatCOP(utilidad);
    if (ids.stock) ids.stock.textContent = String(stockBajo);

    const inventoryContainer = document.getElementById('mobileBusinessInventoryList');
    if (inventoryContainer) {
      const lowStockItems = productos.slice(0, 4).map(item => {
        const isLow = Number(item.stock || 0) <= Number(item.stockMinimo || 0);
        return `
          <div class="business-list-item">
            <div>
              <strong>${escapeHTML(item.nombre || 'Producto')}</strong>
              <small>${escapeHTML(item.unidadMedida || 'und')} · ${escapeHTML(String(item.stock || 0))} en stock</small>
            </div>
            <span class="value ${isLow ? 'negative' : 'positive'}">${isLow ? 'Bajo' : 'OK'}</span>
          </div>
        `;
      }).join('');
      inventoryContainer.innerHTML = lowStockItems || '<div class="business-list-item"><div><strong>Sin inventario</strong></div></div>';
    }

    const inventoryPanelContainer = document.getElementById('mobileBusinessInventoryPanelList');
    if (inventoryPanelContainer) {
      inventoryPanelContainer.innerHTML = productos.length
        ? productos.map(item => {
            const isLow = Number(item.stock || 0) <= Number(item.stockMinimo || 0);
            return `
              <div class="business-list-item">
                <div>
                  <strong>${escapeHTML(item.nombre || 'Producto')}</strong>
                  <small>${escapeHTML(item.unidadMedida || 'und')} · ${escapeHTML(String(item.stock || 0))} en stock · min ${escapeHTML(String(item.stockMinimo || 0))}</small>
                </div>
                <span class="value ${isLow ? 'negative' : 'positive'}">${isLow ? 'Bajo' : 'OK'}</span>
              </div>
            `;
          }).join('')
        : '<div class="business-list-item"><div><strong>Sin inventario</strong></div></div>';
    }

    const movementContainer = document.getElementById('mobileBusinessMovementList');
    if (movementContainer) {
      const activity = [
        ...ventas.map(item => ({ ...item, actividadTipo: 'VENTA' })),
        ...ingresosNegocio.map(item => ({ ...item, actividadTipo: 'INGRESO' })),
        ...compras.map(item => ({ ...item, actividadTipo: 'COMPRA' }))
      ].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
        .slice(0, 6);
      movementContainer.innerHTML = activity.map(item => {
        const isIncome = item.actividadTipo === 'VENTA' || item.actividadTipo === 'INGRESO';
        const label = item.clienteNombre || item.proveedorNombre || item.descripcion || (isIncome ? 'Ingreso' : 'Compra');
        return `
          <div class="business-list-item">
            <div>
              <strong>${escapeHTML(label)}</strong>
              <small>${escapeHTML(item.fecha || 'Sin fecha')}</small>
            </div>
            <span class="value ${isIncome ? 'positive' : 'negative'}">${isIncome ? '+' : '-'}${formatCOP(Number(item.total || item.monto || 0))}</span>
          </div>
        `;
      }).join('') || '<div class="business-list-item"><div><strong>Sin actividad</strong></div></div>';
    }

    const activityContainer = document.getElementById('mobileBusinessActivityList');
    if (activityContainer) {
      const activity = [
        ...ventas.slice(-2).map(item => ({ ...item, actividadTipo: 'VENTA' })),
        ...ingresosNegocio.slice(-2).map(item => ({ ...item, actividadTipo: 'INGRESO' })),
        ...compras.slice(-2).map(item => ({ ...item, actividadTipo: 'COMPRA' }))
      ].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
        .slice(0, 4);
      activityContainer.innerHTML = activity.map(item => {
        const isIncome = item.actividadTipo === 'VENTA' || item.actividadTipo === 'INGRESO';
        const label = item.clienteNombre || item.proveedorNombre || item.descripcion || (isIncome ? 'Ingreso' : 'Compra');
        return `
          <div class="business-list-item">
            <div>
              <strong>${escapeHTML(label)}</strong>
              <small>${escapeHTML(item.fecha || 'Sin fecha')}</small>
            </div>
            <span class="value ${isIncome ? 'positive' : 'negative'}">${isIncome ? '+' : '-'}${formatCOP(Number(item.total || item.monto || 0))}</span>
          </div>
        `;
      }).join('') || '<div class="business-list-item"><div><strong>Sin actividad</strong></div></div>';
    }

    const salesContainer = document.getElementById('mobileBusinessSalesList');
    if (salesContainer) {
      salesContainer.innerHTML = ventas.slice(0, 5).map(venta => `
        <div class="business-list-item">
          <div>
            <strong>${escapeHTML(venta.numeroFactura || `#${String(venta.id).replace(/^vent-/, '')}`)}</strong>
            <small>${escapeHTML(venta.clienteNombre || 'Cliente')} · CC: ${escapeHTML(venta.clienteCedula || '-')}</small>
            <small>${escapeHTML(venta.fecha || 'Sin fecha')} · ${escapeHTML(venta.tipoPago || 'CONTADO')}</small>
          </div>
          <span class="value positive">${formatCOP(Number(venta.total || 0))}</span>
        </div>
      `).join('') || '<div class="business-list-item"><div><strong>Aún no hay facturas registradas</strong></div></div>';
    }

    const supplierContainer = document.getElementById('mobileBusinessSupplierList');
    if (supplierContainer) {
      supplierContainer.innerHTML = proveedores.map(proveedor => `
        <div class="business-list-item">
          <div>
            <strong>${escapeHTML(proveedor.nombre || 'Proveedor')}</strong>
            <small>${escapeHTML(proveedor.telefono || proveedor.email || 'Sin contacto')}</small>
            <small>${escapeHTML(proveedor.direccion || '')}</small>
          </div>
        </div>
      `).join('') || '<div class="business-list-item"><div><strong>No hay proveedores registrados</strong></div></div>';
    }

    const reportContainer = document.getElementById('mobileBusinessReportList');
    if (reportContainer) {
      const margen = ventasTotal > 0 ? ((utilidad / ventasTotal) * 100) : 0;
      const reportItems = [
        { label: 'Ingresos', value: formatCOP(ventasTotal), type: 'positive' },
        { label: 'Gastos totales', value: `-${formatCOP(comprasTotal + gastosTotal + nominaTotal)}`, type: 'negative' },
        { label: 'Utilidad neta', value: formatCOP(utilidad), type: utilidad >= 0 ? 'positive' : 'negative' },
        { label: 'Margen', value: `${margen.toFixed(1)}%`, type: margen >= 0 ? 'positive' : 'negative' }
      ];
      reportContainer.innerHTML = reportItems.map(item => `
        <div class="business-list-item">
          <div>
            <strong>${escapeHTML(item.label)}</strong>
          </div>
          <span class="value ${item.type}">${escapeHTML(item.value)}</span>
        </div>
      `).join('');
    }

    this.renderBusinessChart();
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

  renderBusinessChart() {
    const chartConfigs = [
      { id: 'mobileBusinessChart', instanceKey: 'businessChart' },
      { id: 'mobileBusinessChartReports', instanceKey: 'businessChartReports' }
    ];

    if (typeof Chart === 'undefined') return;

    chartConfigs.forEach(({ id, instanceKey }) => {
      const canvas = document.getElementById(id);
      if (!canvas) return;
      if (this[instanceKey]) this[instanceKey].destroy();

      const negocio = Finanzas.getNegocioActivo();
      const ventas = negocio ? Finanzas.getVentas(negocio.id) : [];
      const ingresos = negocio ? Finanzas.getIngresosNegocio(negocio.id) : [];
      const compras = negocio ? Finanzas.getCompras(negocio.id) : [];
      const labels = [];
      const ventasSeries = [];
      const comprasSeries = [];
      const today = new Date();

      for (let index = 3; index >= 0; index -= 1) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - index, 1);
        const label = monthDate.toLocaleDateString('es-CO', { month: 'short' });
        labels.push(label.charAt(0).toUpperCase() + label.slice(1));
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        ventasSeries.push([...ventas, ...ingresos].reduce((sum, item) => {
          const fecha = item?.fecha ? new Date(item.fecha) : null;
          const entryKey = fecha && !Number.isNaN(fecha.getTime())
            ? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
            : null;
          return sum + (entryKey === monthKey ? Number(item.total || item.monto || 0) : 0);
        }, 0));
        comprasSeries.push(compras.reduce((sum, item) => {
          const fecha = item?.fecha ? new Date(item.fecha) : null;
          const entryKey = fecha && !Number.isNaN(fecha.getTime())
            ? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
            : null;
          return sum + (entryKey === monthKey ? Number(item.total || 0) : 0);
        }, 0));
      }

      this[instanceKey] = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Ingresos',
              data: ventasSeries,
              borderColor: '#0f8b65',
              backgroundColor: 'rgba(15, 139, 101, 0.12)',
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              pointBackgroundColor: '#0f8b65'
            },
            {
              label: 'Compras',
              data: comprasSeries,
              borderColor: '#d9383a',
              backgroundColor: 'rgba(217, 56, 58, 0.12)',
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              pointBackgroundColor: '#d9383a'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
          scales: {
            y: {
              ticks: { callback: (value) => formatCOP(value, true) }
            }
          }
        }
      });
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

    document.querySelectorAll('.module-toggle-btn').forEach((button) => {
      const active = button.dataset.module === (Finanzas.state.moduloActivo || this.currentModule || 'PERSONAL');
      button.classList.toggle('active', active);
    });

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
    const businessReturn = document.getElementById('mobileProfileBusinessReturn');
    if (businessReturn) businessReturn.classList.toggle('hidden', this.currentModule !== 'EMPRESARIAL');
  }

  // ==========================================================================
  // MODALES BOTTOM-SHEET MÓVILES
  // ==========================================================================
  openQuickActionMenu(modulo = null) {
    const mode = modulo || (this.currentModule || 'PERSONAL');
    const root = document.getElementById('mobileQuickActions');
    const list = document.getElementById('mobileQuickActionsList');
    if (!root || !list) return;

    const actions = mode === 'EMPRESARIAL'
      ? [
          { label: 'Registrar venta', action: 'business-sale' },
          { label: 'Registrar compra', action: 'business-purchase' },
          { label: 'Agregar producto', action: 'business-product' },
          { label: 'Registrar gasto', action: 'business-expense' },
          { label: 'Registrar ingreso', action: 'business-income' },
          { label: 'Movimiento de inventario', action: 'business-inventory' }
        ]
      : [
          { label: 'Registrar ingreso personal', action: 'personal-income' },
          { label: 'Registrar gasto personal', action: 'personal-expense' },
          { label: 'Registrar ahorro', action: 'personal-saving' },
          { label: 'Registrar deuda', action: 'personal-debt' }
        ];

    list.innerHTML = actions.map(item => `
      <button type="button" class="quick-action-item" data-quick-action="${item.action}">
        <span>${item.label}</span>
        <span aria-hidden="true">→</span>
      </button>
    `).join('');

    root.classList.remove('hidden');
  }

  closeQuickActionMenu() {
    document.getElementById('mobileQuickActions')?.classList.add('hidden');
  }

  handleQuickAction(action) {
    this.closeQuickActionMenu();
    const module = this.currentModule || 'PERSONAL';

    if (module === 'EMPRESARIAL') {
      if (action === 'business-sale') {
        this.openModalBusinessSale();
        return;
      }
      const messages = {
        'business-purchase': 'Compra registrada en el entorno empresarial.',
        'business-product': 'Producto agregado al inventario empresarial.',
        'business-expense': 'Gasto empresarial registrado.',
        'business-income': 'Ingreso empresarial registrado.',
        'business-inventory': 'Movimiento de inventario procesado.'
      };
      this.mostrarToast(messages[action] || 'Acción empresarial registrada.');
      return;
    }

    const messages = {
      'personal-income': 'Ingreso personal registrado.',
      'personal-expense': 'Gasto personal registrado.',
      'personal-saving': 'Ahorro personal registrado.',
      'personal-debt': 'Deuda personal registrada.'
    };
    this.mostrarToast(messages[action] || 'Acción personal registrada.');
  }

  openModalBusinessSale() {
    const form = document.querySelector('#modalMobileBusinessSale form');
    if (form) form.reset();
    const dateInput = document.getElementById('mobSaleDate');
    if (dateInput) dateInput.value = obtenerFechaHoyISO();
    const lines = document.getElementById('mobileBusinessSaleLines');
    if (lines) {
      lines.innerHTML = '';
      this.addBusinessSaleLine();
    }
    this.updateBusinessSaleTotal();
    document.getElementById('modalMobileBusinessSale')?.classList.remove('hidden');
  }

  closeModalBusinessSale() {
    document.getElementById('modalMobileBusinessSale')?.classList.add('hidden');
  }

  addBusinessSaleLine() {
    const negocio = Finanzas.getNegocioActivo();
    const container = document.getElementById('mobileBusinessSaleLines');
    if (!negocio || !container) return;

    const productos = Finanzas.getProductos(negocio.id, 'PRODUCTO');
    const row = document.createElement('div');
    row.className = 'business-list-item';
    row.innerHTML = `
      <div style="width:100%; display:grid; gap:.5rem;">
        <div class="form-row-custom">
          <label>Artículo</label>
          <select class="sel-mobile-sale-product" required onchange="mobileApp.updateBusinessSalePrice(this)">
            <option value="">Seleccione artículo...</option>
            ${productos.map(producto => `<option value="${escapeHTML(producto.id)}" data-price="${Number(producto.precioVenta) || 0}">${escapeHTML(producto.nombre)} (Disp: ${escapeHTML(String(producto.stock || 0))})</option>`).join('')}
          </select>
        </div>
        <div class="form-row-custom">
          <label>Cantidad</label>
          <input aria-label="Cantidad" class="inp-mobile-sale-quantity" type="number" min="1" step="0.01" value="1" required oninput="mobileApp.updateBusinessSaleTotal()">
        </div>
        <div class="form-row-custom">
          <label>Precio unitario</label>
          <input aria-label="Precio unitario" class="inp-mobile-sale-price" type="number" min="0" step="0.01" value="0" required oninput="mobileApp.updateBusinessSaleTotal()">
        </div>
        <button class="link-btn" type="button" onclick="this.closest('.business-list-item').remove(); mobileApp.updateBusinessSaleTotal()">Quitar artículo</button>
      </div>
    `;
    container.appendChild(row);
  }

  updateBusinessSalePrice(select) {
    const row = select.closest('.business-list-item');
    const priceInput = row?.querySelector('.inp-mobile-sale-price');
    if (priceInput) priceInput.value = select.selectedOptions[0]?.dataset.price || '0';
    this.updateBusinessSaleTotal();
  }

  updateBusinessSaleTotal() {
    const total = Array.from(document.querySelectorAll('#mobileBusinessSaleLines .business-list-item'))
      .reduce((sum, row) => {
        const quantity = Number(row.querySelector('.inp-mobile-sale-quantity')?.value) || 0;
        const price = Number(row.querySelector('.inp-mobile-sale-price')?.value) || 0;
        return sum + quantity * price;
      }, 0);
    const totalElement = document.getElementById('mobileBusinessSaleTotal');
    if (totalElement) totalElement.textContent = formatCOP(total);
  }

  handleBusinessSaleSubmit(event) {
    event.preventDefault();
    const negocio = Finanzas.getNegocioActivo();
    if (!negocio) return;

    const detalles = Array.from(document.querySelectorAll('#mobileBusinessSaleLines .business-list-item'))
      .map(row => ({
        productoId: row.querySelector('.sel-mobile-sale-product')?.value,
        cantidad: Number(row.querySelector('.inp-mobile-sale-quantity')?.value) || 0,
        precioUnitario: Number(row.querySelector('.inp-mobile-sale-price')?.value) || 0
      }))
      .filter(detalle => detalle.productoId && detalle.cantidad > 0);

    if (detalles.length === 0) {
      this.mostrarToast('Agrega al menos un artículo a la factura.');
      return;
    }

    const result = Finanzas.registrarVenta({
      negocioId: negocio.id,
      clienteNombre: document.getElementById('mobSaleCustomerName').value.trim(),
      clienteCedula: document.getElementById('mobSaleCustomerCedula').value.trim(),
      clienteTelefono: document.getElementById('mobSaleCustomerPhone').value.trim(),
      clienteEmail: document.getElementById('mobSaleCustomerEmail').value.trim(),
      clienteDireccion: document.getElementById('mobSaleCustomerAddress').value.trim(),
      fecha: document.getElementById('mobSaleDate').value,
      tipoPago: document.getElementById('mobSalePaymentType').value,
      metodoPago: document.getElementById('mobSalePaymentMethod').value,
      notas: document.getElementById('mobSaleNotes').value.trim(),
      detalles
    });

    if (result.error) {
      this.mostrarToast(`No se pudo guardar la factura: ${result.error}`);
      return;
    }

    event.target.reset();
    this.closeModalBusinessSale();
    this.renderNegocio();
    this.mostrarToast(`Factura ${result.venta.numeroFactura} guardada por ${formatCOP(result.venta.total)}.`);
  }

  openModalRegistrar() {
    const mode = this.currentModule || 'PERSONAL';
    if (mode === 'EMPRESARIAL') {
      this.openQuickActionMenu('EMPRESARIAL');
      return;
    }
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
    const signature = [this.modalType, valor, concepto.toLocaleLowerCase(), categoria, fecha].join('|');
    const now = Date.now();
    if (signature === this._lastMovementSignature && now - this._lastMovementAt < 1200) {
      this._savingMovement = false;
      return;
    }
    this._lastMovementSignature = signature;
    this._lastMovementAt = now;

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

    setTimeout(() => { this._savingMovement = false; }, 600);
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

window.MobileApp = MobileApp;
window.mobileApp = window.mobileApp || new MobileApp();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.mobileApp.init(), { once: true });
} else {
  window.mobileApp.init();
}
