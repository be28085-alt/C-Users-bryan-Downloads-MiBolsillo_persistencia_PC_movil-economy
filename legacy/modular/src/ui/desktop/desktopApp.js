/**
 * ============================================================================
 * DESKTOP APPLICATION ORCHESTRATOR
 * Responsabilidad: Controlador principal de la versión de escritorio, enrutamiento
 * de vistas, eventos del ciclo de vida y delegación a submódulos especializados.
 * ============================================================================
 */
(function () {
  'use strict';

  class DesktopApp {
    constructor() {
      this.currentView = 'inicio';
      this.toastTimeout = null;
      this.initialized = false;
    }

    init() {
      if (this.initialized) return this;
      this.initialized = true;

      // 1. Inicializar atajos y teclado
      if (window.FinanzasSearchFilter) {
        window.FinanzasSearchFilter.initGlobalShortcut();
      }
      if (window.FinanzasModalManager) {
        window.FinanzasModalManager.initKeyboardTrap();
      }

      // 2. Establecer fechas por defecto en modales
      const hoy = window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0];
      ['modalQuickFecha', 'bizVentaFecha', 'bizCompraFecha', 'bizGastoFecha', 'bizInputEmpFecha'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = hoy;
      });

      // 3. Renderizar toda la interfaz
      this.renderAll();

      // 4. Iniciar en la vista correspondiente
      const modo = window.Finanzas ? window.Finanzas.getModuloActivo() : 'PERSONAL';
      this.setModulo(modo, modo === 'EMPRESARIAL' ? 'negocio-dashboard' : 'inicio');
    }

    // ========================================================================
    // ENRUTAMIENTO Y CONMUTACIÓN DE MODOS
    // ========================================================================

    setModulo(modulo, targetView = null) {
      if (window.Finanzas) {
        window.Finanzas.setModuloActivo(modulo);
      }
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
      const brandTitle = document.getElementById('sidebarBrandTitle');
      const brandSub = document.getElementById('sidebarBrandSubtitle');
      const brandIcon = document.getElementById('sidebarBrandIcon');

      if (navPersonal && navEmpresarial) {
        navPersonal.style.display = isEmpresarial ? 'none' : 'block';
        navEmpresarial.style.display = isEmpresarial ? 'block' : 'none';
      }

      if (brandTitle && brandSub && brandIcon) {
        if (isEmpresarial) {
          brandTitle.textContent = 'finanzas';
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
        'plan': 'Mi plan · Control presupuestal',
        'metas': 'Metas de ahorro',
        'deudas': 'Deudas y obligaciones',
        'informes': 'Informes y analítica',
        'perfil': 'Tu espacio · Perfil y ajustes',
        'negocio-dashboard': 'Tu negocio, de un vistazo',
        'negocio-inventario': 'Inventario y existencias',
        'negocio-compras': 'Compras a proveedores',
        'negocio-proveedores': 'Proveedores',
        'negocio-ventas': 'Ventas',
        'negocio-caja': 'Caja y flujo de efectivo',
        'negocio-gastos': 'Gastos del negocio',
        'negocio-creditos': 'Créditos y cuentas por cobrar',
        'negocio-empleados': 'Empleados y nómina',
        'negocio-reportes': 'Ganancias y reportes',
        'negocio-productos': 'Productos y rentabilidad',
        'negocio-perfil': 'Mi Negocio'
      };
      const titleEl = document.getElementById('lblBreadcrumbTitle');
      if (titleEl) titleEl.textContent = breadcrumbMap[viewId] || 'Gestor Financiero';

      // Gráficos y vistas dinámicas
      if (viewId === 'inicio' && window.PersonalCharts) {
        setTimeout(() => window.PersonalCharts.renderDashboardChart(), 50);
      } else if (viewId === 'informes' && window.PersonalCharts && window.Finanzas) {
        setTimeout(() => window.PersonalCharts.renderInformesCharts(window.Finanzas.getMovimientos()), 50);
      } else if (esEmpresarial) {
        this.renderBusinessModule();
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ========================================================================
    // RENDERIZADO GLOBAL
    // ========================================================================

    renderAll() {
      const f = window.Finanzas;
      if (!f) return;

      this.renderUserMeta();

      // Vistas personales
      if (window.PersonalDashboardView) {
        window.PersonalDashboardView.renderKPIs(f);
        window.PersonalDashboardView.renderDashboardAlerts(f);
        window.PersonalDashboardView.renderDashboardMovements(f);
        window.PersonalDashboardView.renderDashboardMetas(f);
      }
      if (window.PersonalMovementsView) window.PersonalMovementsView.render(f);
      if (window.PersonalPlanView) window.PersonalPlanView.render(f);
      if (window.PersonalGoalsView) window.PersonalGoalsView.render(f);
      if (window.PersonalDebtsView) window.PersonalDebtsView.render(f);
      if (window.PersonalReportsView) window.PersonalReportsView.render(f);
      if (window.PersonalProfileView) window.PersonalProfileView.render(f);

      // Módulo empresarial
      this.renderBusinessModule();
    }

    renderUserMeta() {
      const u = window.Finanzas ? window.Finanzas.getUsuario() : {};
      const nameEl = document.getElementById('lblDashboardUser');
      if (nameEl) nameEl.textContent = (u.nombre || 'Usuario').split(' ')[0];
      const sideName = document.getElementById('sidebarUserName');
      if (sideName) sideName.textContent = u.nombre || 'Usuario';
      const sideAvatar = document.getElementById('sidebarAvatar');
      if (sideAvatar) sideAvatar.textContent = u.iniciales || 'US';
      const profileNameBig = document.getElementById('profileNameBig');
      if (profileNameBig) profileNameBig.textContent = u.nombre || 'Usuario';
      const profileEmailBig = document.getElementById('profileEmailBig');
      if (profileEmailBig) profileEmailBig.textContent = u.email || '';
      const profileAvatarBig = document.getElementById('profileAvatarBig');
      if (profileAvatarBig) profileAvatarBig.textContent = u.iniciales || 'US';
    }

    renderBusinessModule() {
      const f = window.Finanzas;
      if (!f) return;
      const negActivo = f.getNegocioActivo();
      if (!negActivo) return;

      const metricas = f.calcularMetricasEmpresariales(negActivo.id, 'MES_ACTUAL');

      if (window.BusinessDashboardView) window.BusinessDashboardView.render(f, negActivo, metricas);
      if (window.BusinessProductsView) window.BusinessProductsView.render(f, negActivo);
      if (window.BusinessInventoryView) window.BusinessInventoryView.render(f, negActivo);
      if (window.BusinessPurchasesView) window.BusinessPurchasesView.render(f, negActivo);
      if (window.BusinessSalesView) window.BusinessSalesView.render(f, negActivo);
      if (window.BusinessSuppliersView) window.BusinessSuppliersView.render(f, negActivo);
      if (window.BusinessCreditsView) window.BusinessCreditsView.render(f, negActivo);
      if (window.BusinessEmployeesView) window.BusinessEmployeesView.render(f, negActivo);
      if (window.BusinessExpensesView) window.BusinessExpensesView.render(f, negActivo);
      if (window.BusinessReportsView) window.BusinessReportsView.render(f, negActivo);
      if (window.BusinessCashFlowView) window.BusinessCashFlowView.render(f, negActivo);
      if (window.BusinessProfileView) window.BusinessProfileView.render(f, negActivo);
    }

    cambiarNegocioActivo(id) {
      if (window.Finanzas) {
        window.Finanzas.setNegocioActivo(id);
        this.renderBusinessModule();
        const neg = window.Finanzas.getNegocioActivo();
        this.showToast(`🏢 Negocio activo: ${neg.nombre}`);
      }
    }

    eliminarNegocio(id) {
      if (!window.Finanzas) return;
      if (confirm('¿Está seguro de eliminar este negocio? Esta acción no se puede deshacer.')) {
        window.Finanzas.eliminarNegocio(id);
        this.renderBusinessModule();
        this.showToast('Negocio eliminado.');
      }
    }

    // ========================================================================
    // DELEGACIÓN DE MODALES
    // ========================================================================

    openModalNuevoMovimiento() { if (window.PersonalModals) window.PersonalModals.openModalNuevoMovimiento(); }
    closeModalNuevoMovimiento() { if (window.PersonalModals) window.PersonalModals.closeModalNuevoMovimiento(); }
    setModalQuickType(tipo) { if (window.PersonalModals) window.PersonalModals.setModalQuickType(tipo); }

    openModalPresupuesto() { if (window.PersonalModals) window.PersonalModals.openModalPresupuesto(); }
    closeModalPresupuesto() { if (window.PersonalModals) window.PersonalModals.closeModalPresupuesto(); }

    openModalNuevaMeta() { if (window.PersonalModals) window.PersonalModals.openModalNuevaMeta(); }
    closeModalNuevaMeta() { if (window.PersonalModals) window.PersonalModals.closeModalNuevaMeta(); }
    openModalAbonarMeta(id) { if (window.PersonalModals) window.PersonalModals.openModalAbonarMeta(id); }
    closeModalAbonarMeta() { if (window.PersonalModals) window.PersonalModals.closeModalAbonarMeta(); }

    openModalNuevaDeuda() { if (window.PersonalModals) window.PersonalModals.openModalNuevaDeuda(); }
    closeModalNuevaDeuda() { if (window.PersonalModals) window.PersonalModals.closeModalNuevaDeuda(); }
    openModalPagarDeuda(id) { if (window.PersonalModals) window.PersonalModals.openModalPagarDeuda(id); }
    closeModalPagarDeuda() { if (window.PersonalModals) window.PersonalModals.closeModalPagarDeuda(); }

    openAcademicModal() { if (window.PersonalModals) window.PersonalModals.openAcademicModal(); }
    closeAcademicModal() { if (window.PersonalModals) window.PersonalModals.closeAcademicModal(); }

    // Modales empresariales
    openModalNuevaVenta() { if (window.BusinessModals) window.BusinessModals.openModalNuevaVenta(); }
    closeModalNuevaVenta() { if (window.BusinessModals) window.BusinessModals.closeModalNuevaVenta(); }
    agregarLineaVenta() { if (window.BusinessModals) window.BusinessModals.agregarLineaVenta(); }
    actualizarCalculoVenta() { if (window.BusinessForms) window.BusinessForms.actualizarCalculoVenta(); }

    openModalNuevaCompra() { if (window.BusinessModals) window.BusinessModals.openModalNuevaCompra(); }
    closeModalNuevaCompra() { if (window.BusinessModals) window.BusinessModals.closeModalNuevaCompra(); }
    agregarLineaCompra() { if (window.BusinessModals) window.BusinessModals.agregarLineaCompra(); }
    actualizarCalculoCompra() { if (window.BusinessForms) window.BusinessForms.actualizarCalculoCompra(); }

    openModalNuevoProducto(tipo) { if (window.BusinessModals) window.BusinessModals.openModalNuevoProducto(tipo); }
    closeModalNuevoProducto() { if (window.BusinessModals) window.BusinessModals.closeModalNuevoProducto(); }

    openModalNuevoProveedor() { if (window.BusinessModals) window.BusinessModals.openModalNuevoProveedor(); }
    closeModalNuevoProveedor() { if (window.BusinessModals) window.BusinessModals.closeModalNuevoProveedor(); }

    openModalNuevoCliente() { if (window.BusinessModals) window.BusinessModals.openModalNuevoCliente(); }
    closeModalNuevoCliente() { if (window.BusinessModals) window.BusinessModals.closeModalNuevoCliente(); }

    openModalAbonoCliente(vId, cId) { if (window.BusinessModals) window.BusinessModals.openModalAbonoCliente(vId, cId); }
    closeModalAbonoCliente() { if (window.BusinessModals) window.BusinessModals.closeModalAbonoCliente(); }

    openModalRegistrarProduccion() { if (window.BusinessModals) window.BusinessModals.openModalRegistrarProduccion(); }
    closeModalRegistrarProduccion() { if (window.BusinessModals) window.BusinessModals.closeModalRegistrarProduccion(); }

    openModalNuevoEmpleado() { if (window.BusinessModals) window.BusinessModals.openModalNuevoEmpleado(); }
    closeModalNuevoEmpleado() { if (window.BusinessModals) window.BusinessModals.closeModalNuevoEmpleado(); }
    openModalPagoNomina(empId) { if (window.BusinessModals) window.BusinessModals.openModalPagoNomina(empId); }
    closeModalPagoNomina() { if (window.BusinessModals) window.BusinessModals.closeModalPagoNomina(); }

    openModalNuevoGasto() { if (window.BusinessModals) window.BusinessModals.openModalNuevoGasto(); }
    closeModalNuevoGasto() { if (window.BusinessModals) window.BusinessModals.closeModalNuevoGasto(); }

    openModalNuevoNegocio() { if (window.BusinessModals) window.BusinessModals.openModalNuevoNegocio(); }
    closeModalNuevoNegocio() { if (window.BusinessModals) window.BusinessModals.closeModalNuevoNegocio(); }

    // ========================================================================
    // DELEGACIÓN DE SUBMIT DE FORMULARIOS
    // ========================================================================

    handleQuickMovementSubmit(e) { if (window.PersonalForms) window.PersonalForms.handleQuickMovementSubmit(e); }
    handlePresupuestoSubmit(e) { if (window.PersonalForms) window.PersonalForms.handlePresupuestoSubmit(e); }
    handleNuevaMetaSubmit(e) { if (window.PersonalForms) window.PersonalForms.handleNuevaMetaSubmit(e); }
    handleAporteMetaSubmit(e) { if (window.PersonalForms) window.PersonalForms.handleAporteMetaSubmit(e); }
    handleNuevaDeudaSubmit(e) { if (window.PersonalForms) window.PersonalForms.handleNuevaDeudaSubmit(e); }
    handlePagoDeudaSubmit(e) { if (window.PersonalForms) window.PersonalForms.handlePagoDeudaSubmit(e); }
    handlePerfilSubmit(e) { if (window.PersonalForms) window.PersonalForms.handlePerfilSubmit(e); }

    handleNuevaVentaSubmit(e) { if (window.BusinessForms) window.BusinessForms.handleNuevaVentaSubmit(e); }
    handleNuevaCompraSubmit(e) { if (window.BusinessForms) window.BusinessForms.handleNuevaCompraSubmit(e); }
    handleNuevoProductoSubmit(e) { if (window.BusinessForms) window.BusinessForms.handleNuevoProductoSubmit(e); }
    handleNuevoProveedorSubmit(e) { if (window.BusinessForms) window.BusinessForms.handleNuevoProveedorSubmit(e); }
    handleNuevoClienteSubmit(e) { if (window.BusinessForms) window.BusinessForms.handleNuevoClienteSubmit(e); }
    handleAbonoClienteSubmit(e) { if (window.BusinessForms) window.BusinessForms.handleAbonoClienteSubmit(e); }
    handleRegistrarProduccionSubmit(e) { if (window.BusinessForms) window.BusinessForms.handleRegistrarProduccionSubmit(e); }
    handleNuevoEmpleadoSubmit(e) { if (window.BusinessForms) window.BusinessForms.handleNuevoEmpleadoSubmit(e); }
    handlePagoNominaSubmit(e) { if (window.BusinessForms) window.BusinessForms.handlePagoNominaSubmit(e); }
    handleNuevoGastoSubmit(e) { if (window.BusinessForms) window.BusinessForms.handleNuevoGastoSubmit(e); }
    handleNuevoNegocioSubmit(e) { if (window.BusinessForms) window.BusinessForms.handleNuevoNegocioSubmit(e); }
    handleGuardarNegocioActivo(e) { if (window.BusinessForms) window.BusinessForms.handleGuardarNegocioActivo(e); }

    // ========================================================================
    // FILTROS Y ACCIONES DIRECTAS
    // ========================================================================

    filtrarMovimientosTexto(txt) {
      if (window.PersonalFilters) window.PersonalFilters.setFiltro('texto', txt);
      if (window.PersonalMovementsView) window.PersonalMovementsView.render(window.Finanzas);
    }

    filtrarMovimientosTipo(tipo) {
      if (window.PersonalFilters) window.PersonalFilters.setFiltro('tipo', tipo);
      if (window.PersonalMovementsView) window.PersonalMovementsView.render(window.Finanzas);
    }

    filtrarVentasTipo(tipo) {
      if (window.BusinessFilters) window.BusinessFilters.setTab('ventas', tipo);
      if (window.BusinessSalesView) window.BusinessSalesView.render(window.Finanzas, window.Finanzas.getNegocioActivo());
    }

    filtrarTablaVentas(query) {
      if (window.BusinessFilters) window.BusinessFilters.setBusqueda('ventas', query);
      if (window.BusinessSalesView) window.BusinessSalesView.render(window.Finanzas, window.Finanzas.getNegocioActivo());
    }

    filtrarInventarioTipo(tipo) {
      if (window.BusinessFilters) window.BusinessFilters.setTab('inventario', tipo);
      if (window.BusinessInventoryView) window.BusinessInventoryView.render(window.Finanzas, window.Finanzas.getNegocioActivo());
    }

    filtrarTablaProductos(query) {
      if (window.BusinessFilters) window.BusinessFilters.setBusqueda('inventario', query);
      if (window.BusinessInventoryView) window.BusinessInventoryView.render(window.Finanzas, window.Finanzas.getNegocioActivo());
    }

    cambiarMes(delta) {
      if (!window.Finanzas) return;
      let mes = window.Finanzas.state.periodoMes + delta;
      let anio = window.Finanzas.state.periodoAnio;
      if (mes < 0) { mes = 11; anio--; }
      else if (mes > 11) { mes = 0; anio++; }
      window.Finanzas.state.periodoMes = mes;
      window.Finanzas.state.periodoAnio = anio;
      this.renderAll();
    }

    toggleOcultarSaldo() {
      if (window.Finanzas) {
        window.Finanzas.toggleSaldoOculto();
        this.renderAll();
      }
    }

    eliminarMovimiento(id) {
      if (confirm('¿Desea eliminar este movimiento?')) {
        window.Finanzas.eliminarMovimiento(id);
        this.renderAll();
        this.showToast('Movimiento eliminado.');
      }
    }

    eliminarProducto(id) {
      if (confirm('¿Desea eliminar este producto?')) {
        window.Finanzas.eliminarProducto(id);
        this.renderBusinessModule();
        this.showToast('Producto eliminado.');
      }
    }

    eliminarProveedor(id) {
      if (confirm('¿Desea eliminar este proveedor?')) {
        window.Finanzas.eliminarProveedor(id);
        this.renderBusinessModule();
        this.showToast('Proveedor eliminado.');
      }
    }

    eliminarGastoNegocio(id) {
      if (confirm('¿Desea eliminar este gasto operativo?')) {
        window.Finanzas.eliminarGastoNegocio(id);
        this.renderBusinessModule();
        this.showToast('Gasto eliminado.');
      }
    }

    eliminarMeta(id) {
      if (confirm('¿Desea eliminar esta meta de ahorro?')) {
        window.Finanzas.eliminarMeta(id);
        this.renderAll();
        this.showToast('Meta eliminada.');
      }
    }

    eliminarDeuda(id) {
      if (confirm('¿Desea eliminar este registro de deuda?')) {
        window.Finanzas.eliminarDeuda(id);
        this.renderAll();
        this.showToast('Deuda eliminada.');
      }
    }

    // Exportaciones
    exportarMovimientosCSV() {
      if (window.FinanzasExportService && window.Finanzas) {
        window.FinanzasExportService.exportarMovimientosCSV(window.Finanzas.getMovimientos());
        this.showToast('✓ Descarga de movimientos en CSV iniciada.');
      }
    }

    exportarVentasCSV() {
      if (window.FinanzasExportService && window.Finanzas) {
        window.FinanzasExportService.exportarVentasCSV(window.Finanzas.getVentas());
        this.showToast('✓ Descarga de ventas en CSV iniciada.');
      }
    }

    descargarCopiaSeguridadJSON() {
      if (window.FinanzasExportService && window.Finanzas) {
        window.FinanzasExportService.descargarCopiaSeguridadJSON(window.Finanzas.state);
        this.showToast('✓ Copia de seguridad JSON generada.');
      }
    }

    // Toast de notificación UI
    showToast(mensaje, tipo = 'success') {
      let toast = document.getElementById('pcToastNotification');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'pcToastNotification';
        toast.className = 'pc-toast-pill';
        document.body.appendChild(toast);
      }
      toast.textContent = mensaje;
      toast.className = `pc-toast-pill show ${tipo}`;

      if (this.toastTimeout) clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
      }, 3500);
    }
  }

  window.DesktopApp = DesktopApp;
})();
