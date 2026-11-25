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
      for (const [key, collection, idKey, nameKey] of [
        ['aportesMetas', 'metas', 'metaId', 'metaNombre'],
        ['abonosDeudas', 'deudas', 'deudaId', 'deudaNombre']
      ]) {
        next[key] = (Array.isArray(next[key]) ? next[key] : []).map(record => ({
          ...record, valor: Number(record.valor ?? record.monto) || 0,
          monto: Number(record.monto ?? record.valor) || 0,
          [nameKey]: record[nameKey] || next[collection].find(item => item.id === record[idKey])?.nombre || 'Registro histórico'
        }));
      }
      const now = new Date();
      if (!Number.isInteger(next.periodoAnio)) next.periodoAnio = now.getFullYear();
      if (!Number.isInteger(next.periodoMes) || next.periodoMes < 0 || next.periodoMes > 11) next.periodoMes = now.getMonth();

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
      // One-time migration: only the explicitly stored period owns the legacy budget.
      if (next.presupuestosVersion !== 1) {
        next.presupuestosPorPeriodo = next.presupuestosPorPeriodo || {};
        next.presupuestosPorPeriodo[this.clavePeriodo(next.periodoAnio, next.periodoMes)] ||= {
          limite: next.presupuestoMensual, limitesCategorias: { ...(next.limitesCategorias || {}) }
        };
        next.presupuestosVersion = 1;
      }
      next.presupuestosPorPeriodo ||= {};
      const budget = next.presupuestosPorPeriodo[this.clavePeriodo(next.periodoAnio, next.periodoMes)];
      next.presupuestoMensual = Math.max(Number(budget?.limite) || 0, 0);
      next.limitesCategorias = { ...(budget?.limitesCategorias || {}) };
      next.recordatoriosDeudasVistos ||= {};
      if (!next.cuentas.length) next.cuentas.push({ id: 'cuenta-principal', nombre: 'Principal', tipo: 'EFECTIVO' });
      // Never infer historical cash exits from equal amounts/descriptions.
      next.abonosDeudas.forEach(payment => {
        const linked = payment.movimientoId && next.movimientos.find(m => m.id === payment.movimientoId && m.tipo === 'GASTO' && Number(m.valor) === Number(payment.valor) && m.deudaId === payment.deudaId);
        payment.estadoVinculacion = linked ? 'vinculado' : 'historico-sin-egreso';
      });

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

    async guardarEstado() {
      const store = window.MiBolsilloStore || window.MiBolsilloState;
      const storage = window.FinanzasStorage || window.MiBolsilloStorage;
      const state = this.normalizeState(this.state || {});
      this.state = state;
      if (store && typeof store.setState === 'function') {
        await store.setState(state);
      } else if (storage && typeof storage.saveState === 'function') {
        await storage.saveState(state);
      }
      this.lastPersistence = storage && typeof storage.getPersistenceStatus === 'function'
        ? storage.getPersistenceStatus() : { ok: false, status: 'unavailable' };
      this.notify();
      return state;
    }

    async reiniciarDatos(defaultState = window.INITIAL_STATE || window.FinanzasDemoData || {}) {
      await this.persistirEstado(defaultState);
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
      return (this.state.cuentas || []).map(cuenta => ({ ...cuenta, saldoCalculado: this.getSaldoCuenta(cuenta.id) }));
    }

    getSaldoCuenta(id) {
      const cuenta = this.state.cuentas.find(c => c.id === id);
      if (!cuenta) return 0;
      const base = cuenta.id === 'cuenta-principal' ? Number(this.state.saldoInicial) || 0 : Number(cuenta.saldoInicial ?? cuenta.saldo) || 0;
      const names = new Set([cuenta.id, cuenta.nombre]);
      if (cuenta.id === 'cuenta-principal' || /principal/i.test(cuenta.nombre)) names.add('Principal');
      return window.PersonalMovementsDomain.calcularSaldoTotal(base, this.state.movimientos.filter(m => m.cuentaId === id || names.has(m.cuenta)));
    }

    clavePeriodo(anio = this.state.periodoAnio, mes = this.state.periodoMes) {
      return String(anio) + '-' + String(mes + 1).padStart(2, '0');
    }

    getLimitesCategorias(anio = this.state.periodoAnio, mes = this.state.periodoMes) {
      return { ...(this.state.presupuestosPorPeriodo?.[this.clavePeriodo(anio, mes)]?.limitesCategorias || {}) };
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
      return this.actualizarSaldoInicial(monto);
    }

    actualizarSaldoInicial(monto) {
      return this.escribirPersonal(next => {
        next.saldoInicial = this.importePersonal(monto, true);
        return { ok: true, saldoInicial: next.saldoInicial };
      });
    }

    getNombrePeriodo() {
      const period = new Date(this.state.periodoAnio, this.state.periodoMes, 1);
      const label = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(period);
      return label.charAt(0).toUpperCase() + label.slice(1);
    }

    cambiarPeriodo(delta) {
      if (!Number.isInteger(delta)) return { error: 'El cambio de mes no es válido.' };
      return this.escribirPersonal(next => {
        const period = new Date(next.periodoAnio, next.periodoMes + delta, 1);
        if (!Number.isFinite(period.getTime()) || period.getFullYear() < 100 || period.getFullYear() > 9999) throw new Error('El período está fuera del rango permitido.');
        next.periodoAnio = period.getFullYear(); next.periodoMes = period.getMonth();
        return { ok: true };
      });
    }

    getMovimientosPeriodo(anio = null, mes = null) {
      const year = anio ?? this.state.periodoAnio ?? new Date().getFullYear();
      const month = mes ?? this.state.periodoMes ?? new Date().getMonth();
      return this.getMovimientos(year, month);
    }

    calcTotalIngresos() {
      return this.calcularMetricasMes().ingresos;
    }

    calcTotalGastos() {
      return this.calcularMetricasMes().gastos;
    }

    calcSaldoTotal() {
      return this.getSaldoTotal();
    }

    calcBalanceNeto() {
      return this.calcularMetricasMes().balance;
    }

    calcTotalAhorradoMetas() {
      return (this.getMetas() || []).reduce((sum, meta) => sum + (Number(meta.ahorrado ?? meta.montoActual ?? 0) || 0), 0);
    }

    calcTotalObjetivoMetas() {
      return (this.getMetas() || []).reduce((sum, meta) => sum + (Number(meta.objetivo ?? meta.montoObjetivo ?? 0) || 0), 0);
    }

    calcTotalRestanteMetas() {
      return this.getMetas().reduce((sum, meta) => sum + meta.restante, 0);
    }

    calcTotalDeudasPendientes() {
      return (this.getDeudas().deudasEnriquecidas || this.getDeudas() || []).reduce((sum, deuda) => sum + (Number(deuda.saldoPendiente ?? deuda.saldo ?? 0) || 0), 0);
    }

    calcTotalDeudasPagado() {
      return (this.state.deudas || []).reduce((sum, deuda) => sum + (Math.max((Number(deuda.valorInicial ?? deuda.montoInicial ?? 0) || 0) - (Number(deuda.saldoPendiente ?? deuda.saldo ?? 0) || 0), 0)), 0);
    }

    calcGastosPorCategoria() {
      return this.getMovimientosPeriodo().reduce((acc, mov) => {
        if (mov.tipo !== 'GASTO') return acc;
        const cat = mov.categoria || 'Otros';
        acc[cat] = Math.round(((acc[cat] || 0) + (Number(mov.valor) || 0) + Number.EPSILON) * 100) / 100;
        return acc;
      }, {});
    }

    calcPresupuestoStatus() {
      const presupuesto = this.getPresupuestoPeriodo();
      const gastos = this.calcTotalGastos();
      const restante = Math.max(presupuesto - gastos, 0);
      const porcentaje = presupuesto > 0 ? (gastos / presupuesto) * 100 : 0;
      const porcentajeReal = Math.round(porcentaje);
      const configurado = presupuesto > 0;
      const estado = !configurado ? 'SIN_CONFIGURAR' : gastos > presupuesto ? 'EXCEDIDO' : gastos === presupuesto ? 'AGOTADO' : (porcentaje >= 80 ? 'ALERTA' : 'NORMAL');
      return {
        configurado,
        limite: presupuesto,
        gastado: gastos,
        restante,
        disponible: Math.max(presupuesto - gastos, 0),
        porcentaje: Math.min(porcentaje, 100),
        porcentajeReal,
        estado,
        exceso: Math.max(gastos - presupuesto, 0)
      };
    }

    calcTasaAhorro() {
      const ingresos = this.calcTotalIngresos();
      const aportes = window.PersonalMovementsDomain.getMovimientos(this.state.aportesMetas, this.state.periodoAnio, this.state.periodoMes);
      const ahorro = aportes.reduce((sum, aporte) => sum + aporte.valor, 0);
      if (ingresos <= 0) return 0;
      return Number(((ahorro / ingresos) * 100).toFixed(1));
    }

    getPresupuestoPeriodo(anio = this.state.periodoAnio, mes = this.state.periodoMes) {
      return Number(this.state.presupuestosPorPeriodo?.[this.clavePeriodo(anio, mes)]?.limite) || 0;
    }

    getMensajePresupuesto(status = this.calcPresupuestoStatus()) {
      if (!status.configurado) return 'Configura tu presupuesto para este mes.';
      if (status.exceso > 0) return 'Has sobrepasado el límite por ' + window.formatCOP(status.exceso) + '.';
      if (status.disponible === 0) return 'Has alcanzado el límite de tu presupuesto.';
      return 'Te quedan ' + window.formatCOP(status.disponible) + ' disponibles para este mes.';
    }

    getAlertasStockBajo() {
      return [];
    }

    agregarMovimiento(datos) {
      return this.escribirPersonal(next => {
        const valor = this.importePersonal(datos.valor);
        const concepto = String(datos.concepto || '').trim();
        const fecha = datos.fecha || window.obtenerFechaHoyISO();
        if (!['INGRESO', 'GASTO'].includes(datos.tipo) || !concepto || concepto.length > 255 || !window.esFechaISOValida(fecha)) throw new Error('Revisa el tipo, el concepto y la fecha del movimiento.');
        const nuevo = window.PersonalMovementsDomain.crearMovimiento({ ...datos, valor, concepto, fecha });
        next.movimientos.unshift(nuevo);
        const period = window.parseFechaLocal(fecha);
        next.periodoAnio = period.getFullYear(); next.periodoMes = period.getMonth();
        return nuevo;
      });
    }

    importePersonal(value, permitirCero = false) {
      if (value === '' || value === null || value === undefined) throw new Error('Escribe un importe válido.');
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || (!permitirCero && number === 0) || number > 1000000000000) throw new Error('El importe debe ser positivo y estar dentro del límite permitido.');
      const rounded = Math.round((number + Number.EPSILON) * 100) / 100;
      if (!permitirCero && rounded === 0) throw new Error('El importe mínimo es 0,01 COP.');
      return rounded;
    }

    // Publish only a confirmed commit. On failure the caller keeps its form,
    // and retrying cannot duplicate an operation previously held in memory.
    async persistirEstado(next, { locked = false } = {}) {
      if (!locked && window.navigator?.locks?.request) return window.navigator.locks.request('mibolsillo-invoicing-v1', { mode: 'exclusive' }, () => this.persistirEstado(next, { locked: true }));
      const storage = window.FinanzasStorage || window.MiBolsilloStorage;
      if (!storage || storage.hasPendingChanges?.()) return false;
      next = this.normalizeState(next);
      if (!await storage.saveState(next, { keepPending: false })) return false;
      this.state = next;
      if (window.MiBolsilloStore) window.MiBolsilloStore.state = next;
      this.lastPersistence = storage.getPersistenceStatus();
      this.notify();
      return true;
    }

    async escribirPersonal(mutate) {
      const write = async () => {
        try {
          await window.FinanzasStorage?.refreshFromBackend?.();
          const next = this.normalizeState(this.state);
          const result = mutate(next);
          if (!await this.persistirEstado(next, { locked: true })) return { error: window.FinanzasStorage?.getPersistenceStatus().message || 'No se confirmó el guardado. Conserva el formulario y revisa el aviso de persistencia.' };
          return result;
        } catch (error) { return { error: error.message || 'No se pudo completar la operación.' }; }
      };
      if (window.navigator?.locks?.request) return window.navigator.locks.request('mibolsillo-invoicing-v1', { mode: 'exclusive' }, write);
      this._personalTail = (this._personalTail || Promise.resolve()).then(write, write);
      return this._personalTail;
    }

    eliminarMovimiento(id) {
      if (!Array.isArray(this.state.movimientos)) return false;
      if (!this.state.movimientos.some(m => m.id === id)) return false;
      return this.escribirPersonal(next => {
        if (next.movimientos.find(m => m.id === id)?.abonoDeudaId) throw new Error('Este egreso está vinculado a un pago de deuda y no se puede eliminar por separado.');
        next.movimientos = next.movimientos.filter(m => m.id !== id);
        return { ok: true };
      }).then(result => !result.error);
    }

    persistirMovimientos(movimientos) {
      return this.persistirEstado({ ...this.state, movimientos });
    }

    async actualizarMovimiento(id, datos) {
      const original = (this.state.movimientos || []).find(m => m.id === id);
      if (!original) return { error: 'El movimiento no pertenece a tus datos actuales.' };
      if (original.abonoDeudaId) return { error: 'Este egreso está vinculado a un pago de deuda y no se puede editar por separado.' };
      const valor = Number(datos.valor);
      const date = window.parseFechaLocal?.(datos.fecha);
      if (!Number.isFinite(valor) || valor <= 0 || valor > 1000000000000
        || !String(datos.concepto || '').trim() || !['INGRESO','GASTO'].includes(datos.tipo)
        || !date || !window.esFechaISOValida?.(datos.fecha)) return { error: 'Revisa el concepto, el importe positivo y la fecha válida.' };
      const editado = { ...original, ...datos, id: original.id, valor: Math.round((valor + Number.EPSILON) * 100) / 100,
        concepto: String(datos.concepto).trim(), grupoFecha: window.formatearGrupoFecha(datos.fecha) };
      return this.escribirPersonal(next => {
        const current = next.movimientos.find(m => m.id === id);
        if (!current || current.abonoDeudaId || JSON.stringify(current) !== JSON.stringify(original)) throw new Error('El movimiento cambió. Reabre el formulario antes de editarlo.');
        next.movimientos = next.movimientos.map(m => m.id === id ? editado : m);
        return { movimiento: editado, error: null };
      });
    }

    calcularMetricasMes(anio = null, mes = null) {
      const movs = this.getMovimientosPeriodo(anio, mes);
      const domain = window.PersonalMovementsDomain;
      return domain ? domain.calcularResumenPeriodo(movs) : { ingresos: 0, gastos: 0, balance: 0 };
    }

    getPresupuesto(anio = null, mes = null) {
      const movs = this.getMovimientosPeriodo(anio, mes);
      const domain = window.PersonalBudgetDomain;
      return domain ? domain.calcularEstadoPresupuestoGlobal(this.getPresupuestoPeriodo(anio ?? this.state.periodoAnio, mes ?? this.state.periodoMes), movs) : { limite: 0, gastado: 0, restante: 0, porcentaje: 0, estado: 'NORMAL' };
    }

    getPresupuestoDesglose(anio = null, mes = null) {
      const movs = this.getMovimientosPeriodo(anio, mes);
      const domain = window.PersonalBudgetDomain;
      return domain ? domain.calcularDesgloseCategorias(this.getLimitesCategorias(anio ?? this.state.periodoAnio, mes ?? this.state.periodoMes), movs) : [];
    }

    evaluarAlertas() {
      const estado = this.getPresupuesto(this.state.periodoAnio, this.state.periodoMes);
      const desglose = this.getPresupuestoDesglose(this.state.periodoAnio, this.state.periodoMes);
      const domain = window.PersonalBudgetDomain;
      const alertasHabilitadas = this.state.usuario?.alertasPresupuesto !== false;
      return domain ? domain.evaluarAlertas(estado, desglose, alertasHabilitadas) : [];
    }

    actualizarPresupuesto(monto) {
      return this.escribirPersonal(next => {
        const key = this.clavePeriodo(next.periodoAnio, next.periodoMes);
        next.presupuestosPorPeriodo[key] = { ...(next.presupuestosPorPeriodo[key] || { limitesCategorias: {} }), limite: this.importePersonal(monto, true) };
        return { ok: true };
      });
    }

    actualizarLimiteCategoria(categoria, monto) {
      return this.escribirPersonal(next => {
        const key = this.clavePeriodo(next.periodoAnio, next.periodoMes);
        const budget = next.presupuestosPorPeriodo[key] ||= { limite: 0, limitesCategorias: {} };
        budget.limitesCategorias[categoria] = this.importePersonal(monto, true);
        return { ok: true };
      });
    }

    // Metas de Ahorro
    getMetas() {
      const metas = Array.isArray(this.state.metas) ? this.state.metas.map(meta => this.normalizeMeta(meta)) : [];
      const domain = window.PersonalGoalsDomain;
      return domain ? domain.enriquecerMetas(metas) : metas;
    }

    agregarMeta(datos = {}) {
      return this.escribirPersonal(next => {
        const objetivo = this.importePersonal(datos.montoObjetivo ?? datos.objetivo);
        const ahorrado = this.importePersonal(datos.montoActual ?? datos.ahorrado ?? 0, true);
        const nombre = String(datos.nombre || '').trim();
        if (!nombre) throw new Error('Escribe el nombre de la meta.');
        const meta = {
          id: `meta-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          nombre, objetivo, ahorrado, montoObjetivo: objetivo, montoActual: ahorrado,
          plazo: String(datos.plazo || datos.fechaLimite || '').trim(),
          fechaLimite: datos.fechaLimite || '',
          color: datos.color || '#10b981',
          icono: datos.icono || '🎯',
          categoria: datos.categoria || 'Ahorro'
        };
        next.metas.push(meta);
        if (ahorrado) next.aportesMetas.push({ id: `ap-${meta.id}`, metaId: meta.id, metaNombre: nombre,
          monto: ahorrado, valor: ahorrado, fecha: window.obtenerFechaHoyISO(), nota: 'Ahorro inicial' });
        return meta;
      });
    }

    abonarAMeta(metaId, monto, nota = '') {
      return this.escribirPersonal(next => {
        const meta = next.metas.find(m => m.id === metaId);
        if (!meta) throw new Error('La meta no pertenece a tus datos actuales.');
        const baseMeta = this.normalizeMeta(meta);
        const valor = this.importePersonal(monto);
        const nuevoActual = this.importePersonal(baseMeta.montoActual + valor);
        baseMeta.montoActual = nuevoActual;
        baseMeta.ahorrado = nuevoActual;
        baseMeta.objetivo = Number(baseMeta.montoObjetivo ?? baseMeta.objetivo ?? 0) || 0;
        Object.assign(meta, baseMeta);
        const aporte = {
          id: `ap-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          metaId, metaNombre: meta.nombre,
          monto: valor, valor,
          fecha: window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0],
          nota: (nota || '').trim()
        };
        next.aportesMetas.push(aporte);
        return { ...aporte, mensaje: 'Aporte guardado correctamente.' };
      });
    }

    aportarMeta(metaId, monto, nota = '') { return this.abonarAMeta(metaId, monto, nota); }

    async eliminarMeta(id) {
      if (!this.state.metas.some(m => m.id === id)) return false;
      return !(await this.escribirPersonal(next => {
        next.metas = next.metas.filter(m => m.id !== id);
        next.aportesMetas = next.aportesMetas.filter(a => a.metaId !== id);
        return { ok: true };
      })).error;
    }

    // Deudas
    getDeudas() {
      const debts = Array.isArray(this.state.deudas) ? this.state.deudas.filter(deuda => !deuda.archivada).map(deuda => this.normalizeDeuda(deuda)) : [];
      const domain = window.PersonalDebtsDomain;
      return domain ? domain.calcularResumenDeudas(debts) : {
        totalDeuda: debts.reduce((sum, deuda) => sum + (Number(deuda.saldoPendiente ?? deuda.saldo ?? 0) || 0), 0),
        cuotaMensualTotal: debts.reduce((sum, deuda) => sum + (Number(deuda.cuotaMensual) || 0), 0),
        deudasEnriquecidas: debts
      };
    }

    agregarDeuda(datos = {}) {
      return this.escribirPersonal(next => {
        const montoInicial = this.importePersonal(datos.montoInicial ?? datos.valorInicial);
        const saldo = this.importePersonal(datos.saldoPendiente ?? datos.saldo ?? montoInicial, true);
        const cuota = this.importePersonal(datos.cuotaMensual ?? 0, true);
        const nombre = String(datos.nombre || datos.concepto || datos.acreedor || '').trim();
        if (!nombre || saldo > montoInicial) throw new Error('Revisa el nombre y el saldo pendiente de la deuda.');
        if ((datos.proximoPago && !window.esFechaISOValida(datos.proximoPago)) || (datos.fechaVencimiento && !window.esFechaISOValida(datos.fechaVencimiento))) throw new Error('Revisa la fecha de vencimiento de la deuda.');
        const deuda = {
          id: `deuda-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          nombre,
          acreedor: (datos.acreedor || datos.nombre || 'Entidad').trim() || 'Entidad',
          concepto: (datos.concepto || datos.nombre || 'Deuda').trim() || 'Deuda',
          montoInicial: Math.max(montoInicial || saldo, 0),
          valorInicial: Math.max(montoInicial || saldo, 0),
          saldoPendiente: saldo,
          cuotaMensual: cuota,
          condiciones: String(datos.condiciones || '').trim(),
          tasaInteres: Number(datos.tasaInteres) || 0,
          fechaVencimiento: datos.fechaVencimiento || '',
          proximoPago: datos.proximoPago || datos.fechaVencimiento || '',
          categoria: datos.categoria || 'Otros',
          estado: saldo === 0 ? 'PAGADA' : 'AL_DIA'
        };
        next.deudas.push(deuda);
        return deuda;
      });
    }

    pagarDeuda(deudaId, monto, metodo = 'Transferencia', options = {}) {
      const operationKey = options.operationKey || window.crypto?.randomUUID?.() || ('debt-' + Date.now() + '-' + Math.random());
      return this.escribirPersonal(next => {
        const valor = this.importePersonal(monto);
        const selected = options.cuenta || next.cuentas[0]?.id;
        const cuenta = next.cuentas.find(c => c.id === selected || c.nombre === selected);
        if (!cuenta) throw new Error('Selecciona una cuenta existente para el pago.');
        const previous = next.abonosDeudas.find(p => p.operationKey === operationKey);
        if (previous) {
          if (previous.deudaId !== deudaId || Number(previous.valor) !== valor || previous.cuentaId !== cuenta.id) throw new Error('La clave del pago ya se utilizó con otros datos.');
          return { ...previous, duplicate: true, mensaje: 'El pago ya estaba guardado; no se duplicó.' };
        }
        const deuda = next.deudas.find(d => d.id === deudaId);
        if (!deuda) throw new Error('La deuda no pertenece a tus datos actuales.');
        if (valor > deuda.saldoPendiente) throw new Error('El abono no puede superar el saldo pendiente.');
        const fecha = options.fecha || window.obtenerFechaHoyISO();
        if (!window.esFechaISOValida(fecha)) throw new Error('La fecha del pago no es válida.');
        const { deudaActualizada, abono } = window.PersonalDebtsDomain.registrarPago(deuda, valor, metodo);
        const movement = window.PersonalMovementsDomain.crearMovimiento({ tipo: 'GASTO', valor, concepto: 'Pago de deuda: ' + deuda.nombre, categoria: 'Deudas', cuenta: cuenta.nombre, fecha });
        Object.assign(movement, { cuentaId: cuenta.id, deudaId, abonoDeudaId: abono.id, operationKey });
        Object.assign(deuda, deudaActualizada);
        Object.assign(abono, { valor, monto: valor, fecha, deudaNombre: deuda.nombre, cuentaId: cuenta.id, cuenta: cuenta.nombre, movimientoId: movement.id, operationKey, estadoVinculacion: 'vinculado' });
        next.movimientos.unshift(movement);
        next.abonosDeudas.push(abono);
        if (valor >= Math.min(Number(deuda.cuotaMensual) || valor, Number(deuda.saldoPendiente) + valor) && deuda.proximoPago) next.recordatoriosDeudasVistos[deuda.id + ':' + deuda.proximoPago] = window.obtenerFechaHoyISO();
        return { ...abono, mensaje: 'Pago y salida de dinero guardados correctamente.' };
      });
    }

    abonarDeuda(deudaId, monto, metodo = 'Transferencia', options = {}) { return this.pagarDeuda(deudaId, monto, metodo, options); }

    getRecordatoriosDeudas(hoy = window.obtenerFechaHoyISO()) {
      if (this.state.usuario.recordatoriosDeudas === false) return [];
      const today = window.parseFechaLocal(hoy);
      return this.state.deudas.filter(d => !d.archivada && d.saldoPendiente > 0 && window.esFechaISOValida(d.proximoPago)).map(d => {
        const fecha = window.parseFechaLocal(d.proximoPago);
        return { id: d.id + ':' + d.proximoPago, deudaId: d.id, nombre: d.nombre, fecha: d.proximoPago, monto: Math.min(d.cuotaMensual || d.saldoPendiente, d.saldoPendiente), dias: Math.round((fecha - today) / 86400000) };
      }).filter(r => r.dias <= 7 && !this.state.recordatoriosDeudasVistos[r.id]);
    }

    descartarRecordatorio(id) {
      return this.escribirPersonal(next => {
        if (!this.getRecordatoriosDeudas().some(r => r.id === id)) throw new Error('El recordatorio ya no está vigente.');
        next.recordatoriosDeudasVistos[id] = window.obtenerFechaHoyISO();
        return { ok: true };
      });
    }

    async eliminarDeuda(id) {
      if (!this.state.deudas.some(d => d.id === id)) return false;
      return !(await this.escribirPersonal(next => {
        if (next.abonosDeudas.some(a => a.deudaId === id)) {
          const debt = next.deudas.find(d => d.id === id);
          debt.archivada = true; debt.estado = 'ARCHIVADA';
          return { ok: true, archivada: true };
        }
        next.deudas = next.deudas.filter(d => d.id !== id);
        next.abonosDeudas = next.abonosDeudas.filter(a => a.deudaId !== id);
        return { ok: true };
      })).error;
    }

    // Usuario y Ajustes
    getUsuario() {
      return this.state.usuario || {};
    }

    actualizarUsuario(datos) {
      return this.actualizarPerfil(datos);
    }

    actualizarPerfil(datos = {}) {
      return this.escribirPersonal(next => {
        const nombre = String(datos.nombre ?? next.usuario.nombre).trim();
        const email = String(datos.email ?? next.usuario.email).trim().toLowerCase();
        if (!nombre || nombre.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Revisa el nombre y el correo electrónico.');
        const service = window.FinanzasUserService;
        next.usuario = service ? service.actualizarUsuario(next.usuario, { ...datos, nombre, email }) : { ...next.usuario, ...datos, nombre, email };
        delete next.usuario.saldoInicial;
        if (datos.saldoInicial !== undefined && datos.saldoInicial !== null) next.saldoInicial = this.importePersonal(datos.saldoInicial, true);
        return { ...next.usuario, ok: true };
      });
    }

    toggleSaldoOculto() {
      return this.escribirPersonal(next => {
        next.saldoOculto = !next.saldoOculto;
        return { ok: true, saldoOculto: next.saldoOculto };
      });
    }

    actualizarPreferencia(key, value) {
      if (!['alertasPresupuesto', 'recordatoriosDeudas'].includes(key)) return { error: 'Preferencia desconocida.' };
      return this.escribirPersonal(next => { next.usuario[key] = Boolean(value); return { ok: true }; });
    }

    // ========================================================================
    // GESTIÓN EMPRESARIAL
    // ========================================================================

    setModuloActivo(modulo) {
      const target = modulo === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PERSONAL';
      if (this.state.moduloActivo === target) return Promise.resolve({ ok: true });
      return this.escribirPersonal(next => { next.moduloActivo = target; return { ok: true }; });
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
