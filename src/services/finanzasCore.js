/**
 * ============================================================================
 * FINANZAS CORE FAÇADE
 * Responsabilidad: Orquestador central del estado global y fachada unificada de
 * servicios para Finanzas Personales y Gestión Empresarial.
 * ============================================================================
 */
(function () {
  'use strict';

  class FinanzasCore {
    constructor() {
      this.subscribers = [];
      const defaultState = window.INITIAL_STATE || (window.FinanzasDemoData ? window.FinanzasDemoData : {});
      const store = window.MiBolsilloStore || window.MiBolsilloState;
      const storage = window.FinanzasStorage || window.MiBolsilloStorage;
      const rawState = store && typeof store.getState === 'function' && store.getState()
        ? store.getState()
        : (storage && typeof storage.loadState === 'function' ? storage.loadState(defaultState) : JSON.parse(JSON.stringify(defaultState)));
      this.state = this.normalizeState(rawState || defaultState);
      if (store && typeof store.setState === 'function') {
        store.setState(this.state);
      }
      this.state.moduloActivo = this.state.moduloActivo || 'PERSONAL';
    }

    normalizeMeta(meta = {}, index = 0) {
      if (!meta || typeof meta !== 'object') return {
        id: `meta-${Date.now()}-${index}`,
        nombre: 'Meta',
        objetivo: 0,
        ahorrado: 0,
        fechaLimite: '',
        color: '#10b981',
        icono: '🎯'
      };

      const objetivo = Number(meta.montoObjetivo ?? meta.objetivo ?? 0) || 0;
      const ahorrado = Number(meta.montoActual ?? meta.ahorrado ?? 0) || 0;
      return {
        ...meta,
        id: meta.id || `meta-${Date.now()}-${index}`,
        nombre: (meta.nombre || 'Meta').trim() || 'Meta',
        objetivo: Math.max(objetivo, 0),
        ahorrado: Math.max(ahorrado, 0),
        montoObjetivo: Math.max(objetivo, 0),
        montoActual: Math.max(ahorrado, 0),
        fechaLimite: meta.fechaLimite || '',
        color: meta.color || '#10b981',
        icono: meta.icono || '🎯'
      };
    }

    normalizeDeuda(deuda = {}, index = 0) {
      if (!deuda || typeof deuda !== 'object') return {
        id: `deuda-${Date.now()}-${index}`,
        nombre: 'Deuda',
        valorInicial: 0,
        saldoPendiente: 0,
        cuotaMensual: 0,
        proximoPago: '',
        concepto: 'Deuda'
      };

      const valorInicial = Number(deuda.valorInicial ?? deuda.montoInicial ?? 0) || 0;
      const saldoPendiente = Number(deuda.saldoPendiente ?? deuda.saldo ?? 0) || 0;
      const cuotaMensual = Number(deuda.cuotaMensual ?? 0) || 0;

      return {
        ...deuda,
        id: deuda.id || `deuda-${Date.now()}-${index}`,
        nombre: (deuda.nombre || deuda.concepto || deuda.acreedor || 'Deuda').trim() || 'Deuda',
        valorInicial: Math.max(valorInicial, 0),
        saldoPendiente: Math.max(saldoPendiente, 0),
        cuotaMensual: Math.max(cuotaMensual, 0),
        montoInicial: Math.max(valorInicial, 0),
        proximoPago: deuda.proximoPago || deuda.fechaVencimiento || '',
        concepto: deuda.concepto || deuda.nombre || 'Deuda',
        acreedor: deuda.acreedor || deuda.nombre || 'Entidad'
      };
    }

    normalizeState(rawState = {}) {
      const base = rawState && typeof rawState === 'object' ? rawState : {};
      const next = JSON.parse(JSON.stringify(base));

      if (!Array.isArray(next.movimientos)) next.movimientos = [];
      if (!Array.isArray(next.metas)) next.metas = [];
      if (!Array.isArray(next.deudas)) next.deudas = [];
      if (!Array.isArray(next.negocios)) next.negocios = [];
      if (!Array.isArray(next.productos)) next.productos = [];
      if (!Array.isArray(next.proveedores)) next.proveedores = [];
      if (!Array.isArray(next.cuentas)) next.cuentas = [];
      if (!Array.isArray(next.ingresosNegocio)) next.ingresosNegocio = [];

      next.movimientos = next.movimientos.map((item, index) => ({
        ...item,
        id: item.id || `tx-${Date.now()}-${index}`,
        tipo: item.tipo || 'GASTO',
        concepto: item.concepto || 'Movimiento',
        categoria: item.categoria || 'Otros',
        valor: Number(item.valor) || 0,
        fecha: item.fecha || new Date().toISOString().split('T')[0]
      }));

      next.metas = next.metas.map((meta, index) => this.normalizeMeta(meta, index));
      next.deudas = next.deudas.map((deuda, index) => this.normalizeDeuda(deuda, index));

      next.usuario = next.usuario || {};
      next.usuario.nombre = (next.usuario.nombre || 'Usuario').toString().trim() || 'Usuario';
      next.usuario.email = (next.usuario.email || '').toString();
      next.usuario.iniciales = (next.usuario.iniciales || 'US').toString().trim() || 'US';
      next.saldoOculto = Boolean(next.saldoOculto);
      next.moduloActivo = next.moduloActivo === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PERSONAL';
      next.negocioActivoId = next.negocioActivoId || (next.negocios[0] ? next.negocios[0].id : null);
      next.presupuestoMensual = Math.max(Number(next.presupuestoMensual) || 0, 0);

      window.BusinessSchema?.migrate(next);
      return next;
    }

    subscribe(callback) {
      if (typeof callback === 'function') {
        this.subscribers.push(callback);
      }
      return () => {
        this.subscribers = this.subscribers.filter(fn => fn !== callback);
      };
    }

    notify() {
      this.subscribers.forEach(fn => {
        try {
          fn(this.state);
        } catch (e) {
          console.error('Error en suscriptor FinanzasCore:', e);
        }
      });
    }

    guardarEstado() {
      const store = window.MiBolsilloStore || window.MiBolsilloState;
      const storage = window.FinanzasStorage || window.MiBolsilloStorage;
      const state = this.normalizeState(this.state || {});
      this.state = state;
      if (store && typeof store.setState === 'function') {
        store.setState(state);
      } else if (storage && typeof storage.saveState === 'function') {
        storage.saveState(state);
      }
      this.lastPersistence = storage && typeof storage.getPersistenceStatus === 'function'
        ? storage.getPersistenceStatus() : { ok: false, status: 'unavailable' };
      this.notify();
      return state;
    }

    reiniciarDatos() {
      const defaultState = window.INITIAL_STATE || window.FinanzasDemoData || {};
      const store = window.MiBolsilloStore || window.MiBolsilloState;
      const storage = window.FinanzasStorage || window.MiBolsilloStorage;
      const fresh = store && typeof store.reset === 'function'
        ? store.reset(defaultState)
        : (storage && typeof storage.resetState === 'function'
          ? storage.resetState(defaultState)
          : JSON.parse(JSON.stringify(defaultState)));
      this.state = this.normalizeState(fresh || defaultState);
      this.notify();
      return this.state;
    }

    // ========================================================================
    // FINANZAS PERSONALES
    // ========================================================================

    getMovimientos(anio = null, mes = null) {
      const domain = window.PersonalMovementsDomain;
      return domain ? domain.getMovimientos(this.state.movimientos, anio, mes) : this.state.movimientos;
    }

    getSaldoTotal() {
      const domain = window.PersonalMovementsDomain;
      return domain ? domain.calcularSaldoTotal(this.state.saldoInicial, this.state.movimientos) : 0;
    }

    getCuentas() {
      return this.state.cuentas || [];
    }

    getCategorias() {
      return {
        gasto: window.CATEGORIAS_GASTO || [],
        ingreso: window.CATEGORIAS_INGRESO || []
      };
    }

    saveState() {
      return this.guardarEstado();
    }

    resetState(defaultState = null) {
      const fallback = defaultState || window.INITIAL_STATE || window.FinanzasDemoData || {};
      return this.reiniciarDatos(fallback);
    }

    setSaldoInicial(monto) {
      this.state.saldoInicial = Number(monto) || 0;
      this.guardarEstado();
    }

    actualizarSaldoInicial(monto) {
      this.setSaldoInicial(monto);
      return this.state.saldoInicial;
    }

    getNombrePeriodo() {
      if (this.state && this.state.mesActual) return this.state.mesActual;
      const now = new Date();
      const label = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(now);
      return label.charAt(0).toUpperCase() + label.slice(1);
    }

    getMovimientosPeriodo(anio = null, mes = null) {
      const year = anio ?? this.state.periodoAnio ?? new Date().getFullYear();
      const month = mes ?? this.state.periodoMes ?? new Date().getMonth();
      return this.getMovimientos(year, month);
    }

    calcTotalIngresos() {
      return this.getMovimientos().filter(m => m.tipo === 'INGRESO').reduce((sum, curr) => sum + (Number(curr.valor) || 0), 0);
    }

    calcTotalGastos() {
      return this.getMovimientos().filter(m => m.tipo === 'GASTO').reduce((sum, curr) => sum + (Number(curr.valor) || 0), 0);
    }

    calcSaldoTotal() {
      const saldoInicial = Number(this.state.saldoInicial || 0);
      return this.getMovimientos().reduce((total, mov) => {
        const valor = Number(mov.valor) || 0;
        if (mov.tipo === 'INGRESO') return total + valor;
        if (mov.tipo === 'GASTO') return total - valor;
        return total;
      }, saldoInicial);
    }

    calcBalanceNeto() {
      return this.calcSaldoTotal();
    }

    calcTotalAhorradoMetas() {
      return (this.getMetas() || []).reduce((sum, meta) => sum + (Number(meta.ahorrado ?? meta.montoActual ?? 0) || 0), 0);
    }

    calcTotalObjetivoMetas() {
      return (this.getMetas() || []).reduce((sum, meta) => sum + (Number(meta.objetivo ?? meta.montoObjetivo ?? 0) || 0), 0);
    }

    calcTotalDeudasPendientes() {
      return (this.getDeudas().deudasEnriquecidas || this.getDeudas() || []).reduce((sum, deuda) => sum + (Number(deuda.saldoPendiente ?? deuda.saldo ?? 0) || 0), 0);
    }

    calcTotalDeudasPagado() {
      return (this.state.deudas || []).reduce((sum, deuda) => sum + (Math.max((Number(deuda.valorInicial ?? deuda.montoInicial ?? 0) || 0) - (Number(deuda.saldoPendiente ?? deuda.saldo ?? 0) || 0), 0)), 0);
    }

    calcGastosPorCategoria() {
      return this.getMovimientos().reduce((acc, mov) => {
        if (mov.tipo !== 'GASTO') return acc;
        const cat = mov.categoria || 'Otros';
        acc[cat] = (acc[cat] || 0) + (Number(mov.valor) || 0);
        return acc;
      }, {});
    }

    calcPresupuestoStatus() {
      const presupuesto = Number(this.state.presupuestoMensual || 0);
      const gastos = this.calcTotalGastos();
      const restante = Math.max(presupuesto - gastos, 0);
      const porcentaje = presupuesto > 0 ? (gastos / presupuesto) * 100 : 0;
      const porcentajeReal = Math.min(Math.round(porcentaje), 100);
      const estado = porcentajeReal >= 100 ? 'EXCEDIDO' : (porcentajeReal >= 80 ? 'ALERTA' : 'NORMAL');
      return {
        limite: presupuesto,
        gastado: gastos,
        restante,
        disponible: Math.max(presupuesto - gastos, 0),
        porcentaje,
        porcentajeReal,
        estado,
        exceso: Math.max(gastos - presupuesto, 0)
      };
    }

    calcTasaAhorro() {
      const ingresos = this.calcTotalIngresos();
      const ahorro = this.calcTotalAhorradoMetas();
      if (ingresos <= 0) return 0;
      return Number(((ahorro / ingresos) * 100).toFixed(1));
    }

    getPresupuestoPeriodo() {
      return this.calcPresupuestoStatus();
    }

    getAlertasStockBajo() {
      return [];
    }

    resetState(defaultState = null) {
      return this.reiniciarDatos(defaultState || window.INITIAL_STATE || window.FinanzasDemoData || {});
    }

    agregarMovimiento(datos) {
      const domain = window.PersonalMovementsDomain;
      const nuevo = domain ? domain.crearMovimiento(datos) : { id: `tx-${Date.now()}`, ...datos };
      if (!Array.isArray(this.state.movimientos)) this.state.movimientos = [];
      this.state.movimientos.unshift(nuevo);
      this.guardarEstado();
      return nuevo;
    }

    eliminarMovimiento(id) {
      if (!Array.isArray(this.state.movimientos)) return false;
      const prevLen = this.state.movimientos.length;
      this.state.movimientos = this.state.movimientos.filter(m => m.id !== id);
      if (this.state.movimientos.length !== prevLen) {
        this.guardarEstado();
        return true;
      }
      return false;
    }

    calcularMetricasMes(anio = null, mes = null) {
      const movs = this.getMovimientos(anio, mes);
      const domain = window.PersonalMovementsDomain;
      return domain ? domain.calcularResumenPeriodo(movs) : { ingresos: 0, gastos: 0, balance: 0 };
    }

    getPresupuesto(anio = null, mes = null) {
      const movs = this.getMovimientos(anio, mes);
      const domain = window.PersonalBudgetDomain;
      return domain ? domain.calcularEstadoPresupuestoGlobal(this.state.presupuestoMensual, movs) : { limite: 0, gastado: 0, restante: 0, porcentaje: 0, estado: 'NORMAL' };
    }

    getPresupuestoDesglose(anio = null, mes = null) {
      const movs = this.getMovimientos(anio, mes);
      const domain = window.PersonalBudgetDomain;
      return domain ? domain.calcularDesgloseCategorias(this.state.limitesCategorias, movs) : [];
    }

    evaluarAlertas() {
      const estado = this.getPresupuesto(this.state.periodoAnio, this.state.periodoMes);
      const desglose = this.getPresupuestoDesglose(this.state.periodoAnio, this.state.periodoMes);
      const domain = window.PersonalBudgetDomain;
      const alertasHabilitadas = this.state.usuario ? Boolean(this.state.usuario.alertasPresupuesto) : true;
      return domain ? domain.evaluarAlertas(estado, desglose, alertasHabilitadas) : [];
    }

    actualizarPresupuesto(monto) {
      this.state.presupuestoMensual = Math.max(Number(monto) || 0, 0);
      this.guardarEstado();
    }

    actualizarLimiteCategoria(categoria, monto) {
      if (!this.state.limitesCategorias) this.state.limitesCategorias = {};
      this.state.limitesCategorias[categoria] = Math.max(Number(monto) || 0, 0);
      this.guardarEstado();
    }

    // Metas de Ahorro
    getMetas() {
      const metas = Array.isArray(this.state.metas) ? this.state.metas.map(meta => this.normalizeMeta(meta)) : [];
      const domain = window.PersonalGoalsDomain;
      return domain ? domain.enriquecerMetas(metas) : metas;
    }

    agregarMeta(datos = {}) {
      const meta = {
        id: `meta-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        nombre: (datos.nombre || 'Meta').trim() || 'Meta',
        objetivo: Math.max(Number(datos.montoObjetivo ?? datos.objetivo ?? 0) || 0, 0),
        ahorrado: Math.max(Number(datos.montoActual ?? datos.ahorrado ?? 0) || 0, 0),
        montoObjetivo: Math.max(Number(datos.montoObjetivo ?? datos.objetivo ?? 0) || 0, 0),
        montoActual: Math.max(Number(datos.montoActual ?? datos.ahorrado ?? 0) || 0, 0),
        fechaLimite: datos.fechaLimite || '',
        color: datos.color || '#10b981',
        icono: datos.icono || '🎯',
        categoria: datos.categoria || 'Ahorro'
      };
      if (!Array.isArray(this.state.metas)) this.state.metas = [];
      this.state.metas.push(this.normalizeMeta(meta, this.state.metas.length));
      this.guardarEstado();
      return this.state.metas[this.state.metas.length - 1];
    }

    abonarAMeta(metaId, monto, nota = '') {
      const meta = (this.state.metas || []).find(m => m.id === metaId);
      if (!meta) return null;
      const baseMeta = this.normalizeMeta(meta);
      const valor = Math.abs(Number(monto) || 0);
      const nuevoActual = (Number(baseMeta.montoActual ?? baseMeta.ahorrado ?? 0) || 0) + valor;
      baseMeta.montoActual = nuevoActual;
      baseMeta.ahorrado = nuevoActual;
      baseMeta.objetivo = Number(baseMeta.montoObjetivo ?? baseMeta.objetivo ?? 0) || 0;
      Object.assign(meta, baseMeta);
      if (!Array.isArray(this.state.aportesMetas)) this.state.aportesMetas = [];
      const aporte = {
        id: `ap-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        metaId,
        monto: valor,
        fecha: window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0],
        nota: (nota || '').trim()
      };
      this.state.aportesMetas.push(aporte);
      this.guardarEstado();
      return aporte;
    }

    eliminarMeta(id) {
      if (!Array.isArray(this.state.metas)) return false;
      this.state.metas = this.state.metas.filter(m => m.id !== id);
      this.guardarEstado();
      return true;
    }

    // Deudas
    getDeudas() {
      const debts = Array.isArray(this.state.deudas) ? this.state.deudas.map(deuda => this.normalizeDeuda(deuda)) : [];
      const domain = window.PersonalDebtsDomain;
      return domain ? domain.calcularResumenDeudas(debts) : {
        totalDeuda: debts.reduce((sum, deuda) => sum + (Number(deuda.saldoPendiente ?? deuda.saldo ?? 0) || 0), 0),
        cuotaMensualTotal: debts.reduce((sum, deuda) => sum + (Number(deuda.cuotaMensual) || 0), 0),
        deudasEnriquecidas: debts
      };
    }

    agregarDeuda(datos = {}) {
      const montoInicial = Math.max(Number(datos.montoInicial ?? datos.valorInicial ?? 0) || 0, 0);
      const saldo = Math.max(Number(datos.saldoPendiente ?? datos.saldo ?? montoInicial) || 0, 0);
      const deuda = {
        id: `deuda-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        nombre: (datos.nombre || datos.concepto || datos.acreedor || 'Deuda').trim() || 'Deuda',
        acreedor: (datos.acreedor || datos.nombre || 'Entidad').trim() || 'Entidad',
        concepto: (datos.concepto || datos.nombre || 'Deuda').trim() || 'Deuda',
        montoInicial: Math.max(montoInicial || saldo, 0),
        valorInicial: Math.max(montoInicial || saldo, 0),
        saldoPendiente: saldo,
        cuotaMensual: Math.max(Number(datos.cuotaMensual) || 0, 0),
        tasaInteres: Number(datos.tasaInteres) || 0,
        fechaVencimiento: datos.fechaVencimiento || '',
        proximoPago: datos.proximoPago || datos.fechaVencimiento || '',
        categoria: datos.categoria || 'Otros',
        estado: saldo === 0 ? 'PAGADA' : 'AL_DIA'
      };
      if (!Array.isArray(this.state.deudas)) this.state.deudas = [];
      this.state.deudas.push(this.normalizeDeuda(deuda, this.state.deudas.length));
      this.guardarEstado();
      return this.state.deudas[this.state.deudas.length - 1];
    }

    pagarDeuda(deudaId, monto, metodo = 'Transferencia') {
      const deuda = (this.state.deudas || []).find(d => d.id === deudaId);
      if (!deuda) return null;
      const domain = window.PersonalDebtsDomain;
      if (domain) {
        const { deudaActualizada, abono } = domain.registrarPago(deuda, monto, metodo);
        Object.assign(deuda, deudaActualizada);
        if (!Array.isArray(this.state.abonosDeudas)) this.state.abonosDeudas = [];
        this.state.abonosDeudas.push(abono);
        this.guardarEstado();
        return abono;
      }
      return null;
    }

    eliminarDeuda(id) {
      if (!Array.isArray(this.state.deudas)) return false;
      this.state.deudas = this.state.deudas.filter(d => d.id !== id);
      this.guardarEstado();
      return true;
    }

    // Usuario y Ajustes
    getUsuario() {
      return this.state.usuario || {};
    }

    actualizarUsuario(datos) {
      const service = window.FinanzasUserService;
      this.state.usuario = service ? service.actualizarUsuario(this.state.usuario, datos) : { ...this.state.usuario, ...datos };
      this.guardarEstado();
      return this.state.usuario;
    }

    toggleSaldoOculto() {
      this.state.saldoOculto = !this.state.saldoOculto;
      this.guardarEstado();
      return this.state.saldoOculto;
    }

    // ========================================================================
    // GESTIÓN EMPRESARIAL
    // ========================================================================

    setModuloActivo(modulo) {
      this.state.moduloActivo = modulo === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PERSONAL';
      this.guardarEstado();
    }

    getModuloActivo() {
      return this.state.moduloActivo || 'PERSONAL';
    }

    getNegocios() {
      return this.state.negocios || [];
    }

    getBusinessService() {
      if (!this._businessService) this._businessService = new window.BusinessService(this);
      return this._businessService;
    }

    async businessWrite(action, data, operationKey) {
      try {
        const out = await this.getBusinessService().execute(action, data, operationKey);
        const r = out.record;
        return { ...r, ...out, ok: true, error: null, venta: out.collection === 'ventas' ? r : undefined, compra: out.collection === 'compras' ? r : undefined, ingreso: out.collection === 'ingresosNegocio' ? r : undefined, empleado: out.collection === 'empleados' ? r : undefined, formula: out.collection === 'formulas' ? r : undefined, produccion: out.collection === 'producciones' ? r : undefined, pago: out.collection.startsWith('pagos') ? r : undefined, pagoRegistro: out.collection === 'pagosVenta' ? r : undefined };
      } catch (error) { return { ok: false, error: error.message, persistence: { ok: false, status: 'rejected' } }; }
    }

    getNegocioActivo() {
      const domain = window.BusinessDomain;
      return domain ? domain.getNegocioActivo(this.state.negocios, this.state.negocioActivoId) : (this.state.negocios[0] || null);
    }

    setNegocioActivo(id, operationKey = undefined) {
      return this.businessWrite('selectBusiness', { id }, operationKey);
    }

    agregarNegocio(datos, operationKey = undefined) {
      return this.businessWrite('saveBusiness', datos, operationKey);
    }

    actualizarNegocio(id, datos, operationKey = undefined) {
      return this.businessWrite('saveBusiness', { ...datos, id }, operationKey);
    }

    eliminarNegocio(id, operationKey = undefined) {
      return this.businessWrite('deleteBusiness', { id }, operationKey);
    }

    // Productos y Materias Primas
    getProductos(negocioId = null, filtroTipo = 'ALL') {
      const nId = negocioId || this.state.negocioActivoId;
      const domain = window.BusinessProductsDomain;
      return domain ? domain.getProductos(this.state.productos, nId, filtroTipo) : [];
    }

    getProductoById(id) {
      return (this.state.productos || []).find(producto => producto.id === id && producto.negocioId === this.state.negocioActivoId) || null;
    }

    agregarProducto(datos, operationKey = undefined) {
      return this.businessWrite('saveProduct', datos, operationKey);
    }

    actualizarProducto(id, datos, operationKey = undefined) {
      return this.businessWrite('saveProduct', { ...datos, id }, operationKey);
    }

    eliminarProducto(id, operationKey = undefined) {
      return this.businessWrite('archive', { collection: 'productos', id }, operationKey);
    }

    // Proveedores
    getProveedores(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.proveedores || []).filter(p => p.negocioId === nId);
    }

    agregarProveedor(datos, operationKey = undefined) {
      return this.businessWrite('saveSupplier', datos, operationKey);
    }

    actualizarProveedor(id, datos, operationKey = undefined) {
      return this.businessWrite('saveSupplier', { ...datos, id }, operationKey);
    }

    eliminarProveedor(id, operationKey = undefined) {
      return this.businessWrite('archive', { collection: 'proveedores', id }, operationKey);
    }

    // Clientes
    getClientes(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.clientes || []).filter(c => c.negocioId === nId);
    }

    agregarCliente(datos, operationKey = undefined) {
      return this.businessWrite('saveCustomer', datos, operationKey);
    }

    actualizarCliente(id, datos, operationKey = undefined) {
      return this.businessWrite('saveCustomer', { ...datos, id }, operationKey);
    }

    eliminarCliente(id, operationKey = undefined) {
      return this.businessWrite('archive', { collection: 'clientes', id }, operationKey);
    }

    // Compras (Regla 1)
    getCompras(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.compras || []).filter(c => c.negocioId === nId);
    }

    registrarCompra(datos, operationKey = undefined) {
      return this.businessWrite('purchase', datos, operationKey);
    }

    // Ventas (Regla 2, 3, 4, 9)
    getVentas(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.ventas || []).filter(v => v.negocioId === nId);
    }

    getIngresosNegocio(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.ingresosNegocio || []).filter(i => i.negocioId === nId);
    }

    registrarIngresoNegocio(datos = {}, operationKey = undefined) {
      return this.businessWrite('saveIncome', datos, operationKey);
    }

    registrarVenta(datos, operationKey = undefined) {
      return this.businessWrite('sale', datos, operationKey);
    }

    getVentasCredito(negocioId = null) {
      return this.getVentas(negocioId).filter(v => v.tipoPago === 'CREDITO');
    }

    // Abonos de Crédito (Regla 5)
    registrarAbonoCliente(ventaId, clienteId, monto, metodoPago = 'Efectivo', notas = '', operationKey = undefined) {
      return this.businessWrite('paySale', { ventaId, clienteId, monto, metodoPago, notas }, operationKey);
    }

    getPagosVenta(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.pagosVenta || []).filter(p => p.negocioId === nId);
    }

    // Fórmulas y Producción (Regla 6)
    getFormulas(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.formulas || []).filter(f => f.negocioId === nId);
    }

    agregarFormula(datos, operationKey = undefined) {
      return this.businessWrite('saveFormula', datos, operationKey);
    }

    eliminarFormula(id, operationKey = undefined) {
      return this.businessWrite('archive', { collection: 'formulas', id }, operationKey);
    }

    getProducciones(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.producciones || []).filter(p => p.negocioId === nId);
    }

    registrarProduccion(formulaId, cantidad, notas = '', operationKey = undefined) {
      return this.businessWrite('production', { formulaId, cantidad, notas }, operationKey);
    }

    // Inventario y Kardex
    getInventario(negocioId = null) {
      const prods = this.getProductos(negocioId, 'ALL');
      const domain = window.BusinessInventoryDomain;
      return domain ? domain.calcularValorInventario(prods) : { valorTotal: 0, unidadesTotales: 0, enAlerta: 0 };
    }

    getAlertasStockBajo(negocioId = null) {
      const prods = this.getProductos(negocioId, 'ALL');
      const domain = window.BusinessInventoryDomain;
      return domain ? domain.getAlertasStockBajo(prods) : [];
    }

    getMovimientosInventario(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.movimientosInventario || []).filter(m => m.negocioId === nId);
    }

    ajustarStockProducto(productoId, nuevoStock, motivo = 'Ajuste manual', operationKey = undefined) {
      return this.businessWrite('adjustStock', { productoId, nuevoStock, motivo }, operationKey);
    }

    // Empleados y Nómina
    getEmpleados(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.empleados || []).filter(e => e.negocioId === nId);
    }

    agregarEmpleado(datos, operationKey = undefined) {
      return this.businessWrite('saveEmployee', datos, operationKey);
    }

    actualizarEmpleado(id, datos, operationKey = undefined) {
      return this.businessWrite('saveEmployee', { ...datos, id }, operationKey);
    }

    getPagosEmpleado(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.pagosEmpleado || []).filter(p => p.negocioId === nId);
    }

    registrarPagoNomina(empleadoId, monto, concepto, periodo, metodo = 'Transferencia', operationKey = undefined) {
      return this.businessWrite('payroll', { empleadoId, monto, concepto, periodo, metodoPago: metodo }, operationKey);
    }

    // Gastos Empresariales (Regla 7)
    getGastosNegocio(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.gastosNegocio || []).filter(g => g.negocioId === nId);
    }

    registrarGastoNegocio(datos, operationKey = undefined) {
      return this.businessWrite('saveExpense', datos, operationKey);
    }

    eliminarGastoNegocio(id, operationKey = undefined) {
      return this.businessWrite('cancel', { collection: 'gastosNegocio', id, motivo: 'Anulación solicitada' }, operationKey);
    }

    // Métricas P&L y Estado de Resultados (Regla 9)
    calcularMetricasEmpresariales(negocioId = null, filtroPeriodo = 'MES_ACTUAL') {
      const nId = negocioId || this.state.negocioActivoId;
      const domain = window.BusinessMetricsDomain;
      return domain
        ? domain.calcularMetricasEmpresariales(nId, this.state, filtroPeriodo)
        : { ventasTotales: 0, costoProductosVendidos: 0, utilidadBruta: 0, gastosOperativos: 0, utilidadNeta: 0, margenBrutoPct: 0, margenNetoPct: 0, cuentasPorCobrar: 0, valorInventario: 0, productosAlerta: 0, cantidadProductos: 0, cantidadVentas: 0 };
    }

    // Caja y Flujo
    getCajaYFlujo(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      const domain = window.BusinessCashFlowDomain;
      return domain
        ? domain.calcularCajaYFlujo(nId, this.state)
        : { saldoDisponible: 0, cuentas: [], totalEntradas: 0, totalSalidas: 0, flujoNeto: 0, movimientosCaja: [] };
    }
  }

  // Instanciar singleton global
  const Finanzas = new FinanzasCore();
  window.FinanzasCore = FinanzasCore;
  window.Finanzas = Finanzas;
})();
