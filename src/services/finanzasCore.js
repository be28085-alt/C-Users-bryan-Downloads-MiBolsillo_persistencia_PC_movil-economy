/**
 * ============================================================================
 * FACHADA DEL NÚCLEO FINANCIERO
 * Responsabilidad: Orquestador central del estado global y fachada unificada de
 * servicios para Finanzas Personales y Gestión Empresarial.
 * ============================================================================
 */
(function () {
  'use strict';

  /**
   * API compatible para ambas interfaces; delega reglas y escrituras a sus módulos.
   * El estado expuesto es la proyección que consultan las vistas, no otro almacén.
   */
  class FinanzasCore {
    /**
     * Normaliza el estado inicial y escucha las confirmaciones del almacenamiento.
     * La construcción no acredita que haya concluido una escritura persistente.
     */
    constructor() {
      this.subscribers = [];
      const defaultState =
        window.INITIAL_STATE || (window.FinanzasDemoData ? window.FinanzasDemoData : {});
      const store = window.MiBolsilloStore || window.MiBolsilloState;
      const storage = window.FinanzasStorage || window.MiBolsilloStorage;
      const rawState =
        store && typeof store.getState === 'function' && store.getState()
          ? store.getState()
          : storage && typeof storage.loadState === 'function'
            ? storage.loadState(defaultState)
            : JSON.parse(JSON.stringify(defaultState));
      this.state = this.normalizeState(rawState || defaultState);
      if (store && typeof store.setState === 'function') {
        store.setState(this.state);
      }
      this.state.moduloActivo = this.state.moduloActivo || 'PERSONAL';
      this.lastPersistence = storage?.getPersistenceStatus?.() || {
        ok: false,
        status: 'unavailable',
      };
      this._unsubscribeStorage = storage?.subscribe?.((event) => {
        if (event.type === 'persistence') this.lastPersistence = { ...event.result };
        else if (event.type === 'state') {
          this.publicarEstadoConfirmado(this.normalizeState(event.data), this.lastPersistence);
        }
      });
    }

    normalizeMeta(meta = {}, index = 0) {
      return window.PersonalGoalsDomain.normalizar(meta, index);
    }

    normalizeDeuda(deuda = {}, index = 0) {
      return window.PersonalDebtsDomain.normalizar(deuda, index);
    }

    normalizeState(rawState = {}) {
      return window.FinanzasStateNormalizer.normalizeState(rawState);
    }

    subscribe(callback) {
      if (typeof callback === 'function') {
        this.subscribers.push(callback);
      }
      return () => {
        this.subscribers = this.subscribers.filter((fn) => fn !== callback);
      };
    }

    notify() {
      this.subscribers.forEach((fn) => {
        try {
          fn(this.state);
        } catch {
          console.error('financial-view-refresh-failed: no se pudo actualizar una vista.');
        }
      });
    }

    /**
     * Publica una proyección confirmada por el repositorio o la sincronización.
     * @param {object} state Agregado confirmado, nunca un borrador de formulario.
     * @param {object} persistence Resultado de persistencia ya verificado.
     * Los stores opcionales son espejos compatibles y no nuevos propietarios.
     */
    publicarEstadoConfirmado(state, persistence) {
      this.state = state;
      if (window.MiBolsilloStore) window.MiBolsilloStore.state = state;
      this.lastPersistence = { ...persistence };
      this.notify();
    }

    /**
     * Conserva la operación histórica de normalizar y guardar el estado de la fachada.
     * @returns {Promise<object>} Estado normalizado; este retorno no prueba un guardado exitoso.
     * Consulte lastPersistence para conocer el resultado informado por el adaptador.
     * Los comandos nuevos usan escribirPersonal o businessWrite para publicar tras confirmar.
     */
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
      this.lastPersistence =
        storage && typeof storage.getPersistenceStatus === 'function'
          ? storage.getPersistenceStatus()
          : { ok: false, status: 'unavailable' };
      this.notify();
      return state;
    }

    /**
     * Restablece mediante la unidad de trabajo y conserva la clave al reintentar.
     * @param {object} defaultState Estado base que se normaliza dentro del candidato.
     * @returns {Promise<object>} Proyección del estado una vez confirmado el restablecimiento.
     * @throws {Error} Si el repositorio devuelve un error; conserva la proyección anterior.
     */
    async reiniciarDatos(defaultState = window.INITIAL_STATE || window.FinanzasDemoData || {}) {
      const signature = JSON.stringify(defaultState);
      if (this._resetAttempt?.signature !== signature) {
        this._resetAttempt = { signature, key: window.crypto.randomUUID() };
      }
      const previousKey = this._personalOperationKey;
      this._personalOperationKey = this._resetAttempt.key;
      let task;
      try {
        task = this.escribirPersonal((next) => {
          Object.keys(next).forEach((key) => {
            delete next[key];
          });
          Object.assign(next, this.normalizeState(defaultState));
          return { ok: true };
        });
      } finally {
        this._personalOperationKey = previousKey;
      }
      const result = await task;
      if (result.error) {
        throw new Error(
          'No se confirmó el restablecimiento. Los datos anteriores se conservaron en memoria. ' +
            result.error,
        );
      }
      this._resetAttempt = null;
      return this.state;
    }

    // ========================================================================
    // FINANZAS PERSONALES
    // ========================================================================

    getMovimientos(anio = null, mes = null) {
      const domain = window.PersonalMovementsDomain;
      return domain
        ? domain.getMovimientos(this.state.movimientos, anio, mes)
        : this.state.movimientos;
    }

    getSaldoTotal() {
      const domain = window.PersonalMovementsDomain;
      return domain
        ? domain.calcularSaldoTotal(this.state.saldoInicial, this.state.movimientos)
        : 0;
    }

    getCuentas() {
      return (this.state.cuentas || []).map((cuenta) => ({
        ...cuenta,
        saldoCalculado: this.getSaldoCuenta(cuenta.id),
      }));
    }

    getSaldoCuenta(id) {
      const cuenta = this.state.cuentas.find((c) => c.id === id);
      if (!cuenta) return 0;
      const base =
        cuenta.id === 'cuenta-principal'
          ? Number(this.state.saldoInicial) || 0
          : Number(cuenta.saldoInicial ?? cuenta.saldo) || 0;
      const names = new Set([cuenta.id, cuenta.nombre]);
      if (cuenta.id === 'cuenta-principal' || /principal/i.test(cuenta.nombre)) {
        names.add('Principal');
      }
      return window.PersonalMovementsDomain.calcularSaldoTotal(
        base,
        this.state.movimientos.filter((m) => m.cuentaId === id || names.has(m.cuenta)),
      );
    }

    clavePeriodo(anio = this.state.periodoAnio, mes = this.state.periodoMes) {
      return window.FinanzasStateNormalizer.clavePeriodo(anio, mes);
    }

    getLimitesCategorias(anio = this.state.periodoAnio, mes = this.state.periodoMes) {
      return {
        ...(this.state.presupuestosPorPeriodo?.[this.clavePeriodo(anio, mes)]?.limitesCategorias ||
          {}),
      };
    }

    getCategorias() {
      return {
        gasto: window.CATEGORIAS_GASTO || [],
        ingreso: window.CATEGORIAS_INGRESO || [],
      };
    }

    /** @returns {Promise<object>} Alias de guardarEstado, con su contrato de compatibilidad. */
    saveState() {
      return this.guardarEstado();
    }

    /**
     * @param {object|null} defaultState Estado base opcional; null utiliza los datos iniciales.
     * @returns {Promise<object>} Resultado confirmado de reiniciarDatos.
     */
    resetState(defaultState = null) {
      const fallback = defaultState || window.INITIAL_STATE || window.FinanzasDemoData || {};
      return this.reiniciarDatos(fallback);
    }

    setSaldoInicial(monto) {
      return this.actualizarSaldoInicial(monto);
    }

    actualizarSaldoInicial(monto) {
      return this.escribirPersonal((next) => {
        next.saldoInicial = this.importePersonal(monto, true);
        return { ok: true, saldoInicial: next.saldoInicial };
      });
    }

    getNombrePeriodo() {
      const period = new Date(this.state.periodoAnio, this.state.periodoMes, 1);
      const label = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(
        period,
      );
      return label.charAt(0).toUpperCase() + label.slice(1);
    }

    cambiarPeriodo(delta) {
      if (!Number.isInteger(delta)) return { error: 'El cambio de mes no es válido.' };
      return this.escribirPersonal((next) => {
        const period = new Date(next.periodoAnio, next.periodoMes + delta, 1);
        if (
          !Number.isFinite(period.getTime()) ||
          period.getFullYear() < 100 ||
          period.getFullYear() > 9999
        ) {
          throw new Error('El período está fuera del rango permitido.');
        }
        next.periodoAnio = period.getFullYear();
        next.periodoMes = period.getMonth();
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
      return (this.getMetas() || []).reduce(
        (sum, meta) => sum + (Number(meta.ahorrado ?? meta.montoActual ?? 0) || 0),
        0,
      );
    }

    calcTotalObjetivoMetas() {
      return (this.getMetas() || []).reduce(
        (sum, meta) => sum + (Number(meta.objetivo ?? meta.montoObjetivo ?? 0) || 0),
        0,
      );
    }

    calcTotalRestanteMetas() {
      return this.getMetas().reduce((sum, meta) => sum + meta.restante, 0);
    }

    calcTotalDeudasPendientes() {
      return (this.getDeudas().deudasEnriquecidas || this.getDeudas() || []).reduce(
        (sum, deuda) => sum + (Number(deuda.saldoPendiente ?? deuda.saldo ?? 0) || 0),
        0,
      );
    }

    calcTotalDeudasPagado() {
      return (this.state.deudas || []).reduce(
        (sum, deuda) =>
          sum +
          Math.max(
            (Number(deuda.valorInicial ?? deuda.montoInicial ?? 0) || 0) -
              (Number(deuda.saldoPendiente ?? deuda.saldo ?? 0) || 0),
            0,
          ),
        0,
      );
    }

    calcGastosPorCategoria() {
      return this.getMovimientosPeriodo().reduce((acc, mov) => {
        if (mov.tipo !== 'GASTO') return acc;
        const cat = mov.categoria || 'Otros';
        acc[cat] =
          Math.round(((acc[cat] || 0) + (Number(mov.valor) || 0) + Number.EPSILON) * 100) / 100;
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
      const estado = !configurado
        ? 'SIN_CONFIGURAR'
        : gastos > presupuesto
          ? 'EXCEDIDO'
          : gastos === presupuesto
            ? 'AGOTADO'
            : porcentaje >= 80
              ? 'ALERTA'
              : 'NORMAL';
      return {
        configurado,
        limite: presupuesto,
        gastado: gastos,
        restante,
        disponible: Math.max(presupuesto - gastos, 0),
        porcentaje: Math.min(porcentaje, 100),
        porcentajeReal,
        estado,
        exceso: Math.max(gastos - presupuesto, 0),
      };
    }

    calcTasaAhorro() {
      const ingresos = this.calcTotalIngresos();
      const aportes = window.PersonalMovementsDomain.getMovimientos(
        this.state.aportesMetas,
        this.state.periodoAnio,
        this.state.periodoMes,
      );
      const ahorro = aportes.reduce((sum, aporte) => sum + aporte.valor, 0);
      if (ingresos <= 0) return 0;
      return Number(((ahorro / ingresos) * 100).toFixed(1));
    }

    getPresupuestoPeriodo(anio = this.state.periodoAnio, mes = this.state.periodoMes) {
      return Number(this.state.presupuestosPorPeriodo?.[this.clavePeriodo(anio, mes)]?.limite) || 0;
    }

    getMensajePresupuesto(status = this.calcPresupuestoStatus()) {
      if (!status.configurado) return 'Configura tu presupuesto para este mes.';
      if (status.exceso > 0) {
        return 'Has sobrepasado el límite por ' + window.formatCOP(status.exceso) + '.';
      }
      if (status.disponible === 0) return 'Has alcanzado el límite de tu presupuesto.';
      return 'Te quedan ' + window.formatCOP(status.disponible) + ' disponibles para este mes.';
    }

    agregarMovimiento(datos) {
      return this.escribirPersonal((next) =>
        window.PersonalCommands.agregarMovimiento(next, datos),
      );
    }

    importePersonal(value, permitirCero = false) {
      return window.PersonalCommands.importe(value, permitirCero);
    }

    /**
     * Reutiliza la unidad de trabajo personal ligada a esta fachada.
     * @returns {object} Repositorio que coordina bloqueo, confirmación y publicación.
     */
    getPersonalRepository() {
      if (!this._personalRepository) this._personalRepository = new window.PersonalRepository(this);
      return this._personalRepository;
    }

    /**
     * Delega el guardado de un candidato; solo el repositorio publica lo confirmado.
     * @param {object} next Estado candidato separado de los formularios.
     * @param {{locked?: boolean}} options Indica que el llamador ya posee el bloqueo compartido.
     * @returns {Promise<boolean>} Confirmación del guardado; false conserva la proyección previa.
     */
    async persistirEstado(next, { locked = false } = {}) {
      return this.getPersonalRepository().persistirEstado(next, { locked });
    }

    /**
     * Aplica una intención personal sobre el candidato actualizado bajo el bloqueo compartido.
     * @template Result
     * @param {function(object): Result} mutate Mutación síncrona sin acceso a E/S.
     * @returns {Promise<Result|{error: string}>} Resultado confirmado o error público del repositorio.
     * El repositorio conserva las operaciones inciertas para su reintento original.
     */
    async escribirPersonal(mutate) {
      return this.getPersonalRepository().escribirPersonal(mutate);
    }

    eliminarMovimiento(id) {
      if (!Array.isArray(this.state.movimientos)) return false;
      if (!this.state.movimientos.some((m) => m.id === id)) return false;
      return this.escribirPersonal((next) =>
        window.PersonalCommands.eliminarMovimiento(next, id),
      ).then((result) => !result.error);
    }

    persistirMovimientos(movimientos) {
      return this.persistirEstado({ ...this.state, movimientos });
    }

    async actualizarMovimiento(id, datos) {
      const original = (this.state.movimientos || []).find((m) => m.id === id);
      if (!original) return { error: 'El movimiento no pertenece a tus datos actuales.' };
      if (original.abonoDeudaId) {
        return {
          error: 'Este egreso está vinculado a un pago de deuda y no se puede editar por separado.',
        };
      }
      const valor = Number(datos.valor);
      const date = window.parseFechaLocal?.(datos.fecha);
      if (
        !Number.isFinite(valor) ||
        valor <= 0 ||
        valor > 1000000000000 ||
        !String(datos.concepto || '').trim() ||
        !['INGRESO', 'GASTO'].includes(datos.tipo) ||
        !date ||
        !window.esFechaISOValida?.(datos.fecha)
      ) {
        return { error: 'Revisa el concepto, el importe positivo y la fecha válida.' };
      }
      const editado = {
        ...original,
        ...datos,
        id: original.id,
        valor: Math.round((valor + Number.EPSILON) * 100) / 100,
        concepto: String(datos.concepto).trim(),
        grupoFecha: window.formatearGrupoFecha(datos.fecha),
      };
      return this.escribirPersonal((next) => {
        const current = next.movimientos.find((m) => m.id === id);
        if (
          !current ||
          current.abonoDeudaId ||
          JSON.stringify(current) !== JSON.stringify(original)
        ) {
          throw new Error('El movimiento cambió. Reabre el formulario antes de editarlo.');
        }
        next.movimientos = next.movimientos.map((m) => (m.id === id ? editado : m));
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
      return domain
        ? domain.calcularEstadoPresupuestoGlobal(
            this.getPresupuestoPeriodo(
              anio ?? this.state.periodoAnio,
              mes ?? this.state.periodoMes,
            ),
            movs,
          )
        : { limite: 0, gastado: 0, restante: 0, porcentaje: 0, estado: 'NORMAL' };
    }

    getPresupuestoDesglose(anio = null, mes = null) {
      const movs = this.getMovimientosPeriodo(anio, mes);
      const domain = window.PersonalBudgetDomain;
      return domain
        ? domain.calcularDesgloseCategorias(
            this.getLimitesCategorias(anio ?? this.state.periodoAnio, mes ?? this.state.periodoMes),
            movs,
          )
        : [];
    }

    evaluarAlertas() {
      const estado = this.getPresupuesto(this.state.periodoAnio, this.state.periodoMes);
      const desglose = this.getPresupuestoDesglose(this.state.periodoAnio, this.state.periodoMes);
      const domain = window.PersonalBudgetDomain;
      const alertasHabilitadas = this.state.usuario?.alertasPresupuesto !== false;
      return domain ? domain.evaluarAlertas(estado, desglose, alertasHabilitadas) : [];
    }

    actualizarPresupuesto(monto) {
      return this.escribirPersonal((next) =>
        window.PersonalCommands.actualizarPresupuesto(next, monto),
      );
    }

    actualizarLimiteCategoria(categoria, monto) {
      return this.escribirPersonal((next) =>
        window.PersonalCommands.actualizarLimiteCategoria(next, categoria, monto),
      );
    }

    // Metas de Ahorro
    getMetas() {
      const metas = Array.isArray(this.state.metas)
        ? this.state.metas.map((meta) => this.normalizeMeta(meta))
        : [];
      const domain = window.PersonalGoalsDomain;
      return domain ? domain.enriquecerMetas(metas) : metas;
    }

    agregarMeta(datos = {}) {
      return this.escribirPersonal((next) => window.PersonalCommands.agregarMeta(next, datos));
    }

    /**
     * Delega el aporte y sus registros relacionados a un único candidato personal.
     * @param {string} metaId Identificador de la meta existente.
     * @param {number|string} monto Importe que valida el comando de metas.
     * @param {string} nota Nota opcional del aporte.
     * @returns {Promise<object>} Resultado confirmado del comando o un objeto con error.
     */
    abonarAMeta(metaId, monto, nota = '') {
      return this.escribirPersonal((next) =>
        window.PersonalCommands.abonarAMeta(next, metaId, monto, nota),
      );
    }

    aportarMeta(metaId, monto, nota = '') {
      return this.abonarAMeta(metaId, monto, nota);
    }

    async eliminarMeta(id) {
      if (!this.state.metas.some((item) => item.id === id)) return false;
      return !(
        await this.escribirPersonal((next) => window.PersonalCommands.eliminarMeta(next, id))
      ).error;
    }

    // Deudas
    getDeudas() {
      const debts = Array.isArray(this.state.deudas)
        ? this.state.deudas.map((deuda) => this.normalizeDeuda(deuda))
        : [];
      const domain = window.PersonalDebtsDomain;
      return domain
        ? domain.calcularResumenDeudas(debts)
        : {
            totalDeuda: debts.reduce(
              (sum, deuda) => sum + (Number(deuda.saldoPendiente ?? deuda.saldo ?? 0) || 0),
              0,
            ),
            cuotaMensualTotal: debts.reduce(
              (sum, deuda) => sum + (Number(deuda.cuotaMensual) || 0),
              0,
            ),
            deudasEnriquecidas: debts,
          };
    }

    agregarDeuda(datos = {}) {
      return this.escribirPersonal((next) => window.PersonalCommands.agregarDeuda(next, datos));
    }

    /**
     * Delega el pago y el egreso vinculado a la misma unidad de trabajo personal.
     * @param {string} deudaId Identificador de la deuda existente.
     * @param {number|string} monto Importe que valida el comando de deudas.
     * @param {string} metodo Método de pago registrado.
     * @param {object} options Datos opcionales del pago; operationKey identifica el reintento.
     * @returns {Promise<object>} Resultado confirmado del comando o un objeto con error.
     */
    pagarDeuda(deudaId, monto, metodo = 'Transferencia', options = {}) {
      const operationKey =
        options.operationKey ||
        window.crypto?.randomUUID?.() ||
        'debt-' + Date.now() + '-' + Math.random();
      return this.escribirPersonal((next) =>
        window.PersonalCommands.pagarDeuda(next, deudaId, monto, metodo, options, operationKey),
      );
    }

    abonarDeuda(deudaId, monto, metodo = 'Transferencia', options = {}) {
      return this.pagarDeuda(deudaId, monto, metodo, options);
    }

    getRecordatoriosDeudas(hoy = window.obtenerFechaHoyISO()) {
      if (this.state.usuario.recordatoriosDeudas === false) return [];
      const today = window.parseFechaLocal(hoy);
      return this.getDeudas()
        .activas.filter((d) => window.esFechaISOValida(d.proximoPago))
        .map((d) => {
          const fecha = window.parseFechaLocal(d.proximoPago);
          return {
            id: d.id + ':' + d.proximoPago,
            deudaId: d.id,
            nombre: d.nombre,
            fecha: d.proximoPago,
            monto: Math.min(d.cuotaMensual || d.saldoPendiente, d.saldoPendiente),
            dias: Math.round((fecha - today) / 86400000),
          };
        })
        .filter((r) => r.dias <= 7 && !this.state.recordatoriosDeudasVistos[r.id]);
    }

    descartarRecordatorio(id) {
      return this.escribirPersonal((next) => {
        if (!this.getRecordatoriosDeudas().some((r) => r.id === id)) {
          throw new Error('El recordatorio ya no está vigente.');
        }
        next.recordatoriosDeudasVistos[id] = window.obtenerFechaHoyISO();
        return { ok: true };
      });
    }

    async eliminarDeuda(id) {
      if (!this.state.deudas.some((item) => item.id === id)) return false;
      return !(
        await this.escribirPersonal((next) => window.PersonalCommands.eliminarDeuda(next, id))
      ).error;
    }

    // Usuario y Ajustes
    getUsuario() {
      return this.state.usuario || {};
    }

    actualizarUsuario(datos) {
      return this.actualizarPerfil(datos);
    }

    /**
     * Valida nombre y correo y guarda el perfil dentro del agregado personal.
     * @param {object} datos Campos del perfil; saldoInicial, si existe, pertenece al agregado.
     * @returns {Promise<object>} Perfil confirmado con ok o un objeto con error.
     * Modifica el perfil financiero local; no sustituye la autenticación de la cuenta.
     */
    actualizarPerfil(datos = {}) {
      return this.escribirPersonal((next) => {
        const nombre = String(datos.nombre ?? next.usuario.nombre).trim();
        const email = String(datos.email ?? next.usuario.email)
          .trim()
          .toLowerCase();
        if (
          !nombre ||
          nombre.length > 100 ||
          email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
          throw new Error('Revisa el nombre y el correo electrónico.');
        }
        const service = window.FinanzasUserService;
        next.usuario = service
          ? service.actualizarUsuario(next.usuario, { ...datos, nombre, email })
          : { ...next.usuario, ...datos, nombre, email };
        delete next.usuario.saldoInicial;
        if (datos.saldoInicial !== undefined && datos.saldoInicial !== null) {
          next.saldoInicial = this.importePersonal(datos.saldoInicial, true);
        }
        return { ...next.usuario, ok: true };
      });
    }

    toggleSaldoOculto() {
      return this.escribirPersonal((next) => {
        next.saldoOculto = !next.saldoOculto;
        return { ok: true, saldoOculto: next.saldoOculto };
      });
    }

    actualizarPreferencia(key, value) {
      if (!['alertasPresupuesto', 'recordatoriosDeudas'].includes(key)) {
        return { error: 'Preferencia desconocida.' };
      }
      return this.escribirPersonal((next) => {
        next.usuario[key] = Boolean(value);
        return { ok: true };
      });
    }

    // ========================================================================
    // GESTIÓN EMPRESARIAL
    // ========================================================================

    setModuloActivo(modulo) {
      const target = modulo === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PERSONAL';
      if (this.state.moduloActivo === target) return Promise.resolve({ ok: true });
      return this.escribirPersonal((next) => {
        next.moduloActivo = target;
        return { ok: true };
      });
    }

    getModuloActivo() {
      return this.state.moduloActivo || 'PERSONAL';
    }

    getNegocios() {
      return this.state.negocios || [];
    }

    /** @returns {object} Servicio empresarial reutilizado para esta fachada y su repositorio. */
    getBusinessService() {
      if (!this._businessService) this._businessService = new window.BusinessService(this);
      return this._businessService;
    }

    /**
     * Delega un comando empresarial y conserva los alias públicos de su resultado.
     * @param {string} action Nombre del comando admitido por BusinessService.
     * @param {object} data Datos del comando para el negocio activo.
     * @param {string|undefined} operationKey Clave opcional para reconocer el mismo reintento.
     * @returns {Promise<object>} Resultado confirmado o fallo con ok false, error y persistence.
     */
    async businessWrite(action, data, operationKey) {
      try {
        const out = await this.getBusinessService().execute(action, data, operationKey);
        const r = out.record;
        return {
          ...r,
          ...out,
          ok: true,
          error: null,
          venta: out.collection === 'ventas' ? r : undefined,
          compra: out.collection === 'compras' ? r : undefined,
          ingreso: out.collection === 'ingresosNegocio' ? r : undefined,
          empleado: out.collection === 'empleados' ? r : undefined,
          formula: out.collection === 'formulas' ? r : undefined,
          produccion: out.collection === 'producciones' ? r : undefined,
          pago: out.collection.startsWith('pagos') ? r : undefined,
          pagoRegistro: out.collection === 'pagosVenta' ? r : undefined,
        };
      } catch (error) {
        return { ok: false, error: error.message, persistence: { ok: false, status: 'rejected' } };
      }
    }

    getNegocioActivo() {
      const domain = window.BusinessDomain;
      return domain
        ? domain.getNegocioActivo(this.state.negocios, this.state.negocioActivoId)
        : this.state.negocios[0] || null;
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
      return (
        (this.state.productos || []).find(
          (producto) => producto.id === id && producto.negocioId === this.state.negocioActivoId,
        ) || null
      );
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
      return (this.state.proveedores || []).filter((p) => p.negocioId === nId);
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
      return (this.state.clientes || []).filter((c) => c.negocioId === nId);
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
      return (this.state.compras || []).filter((c) => c.negocioId === nId);
    }

    registrarCompra(datos, operationKey = undefined) {
      return this.businessWrite('purchase', datos, operationKey);
    }

    // Ventas (Regla 2, 3, 4, 9)
    getVentas(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.ventas || []).filter((v) => v.negocioId === nId);
    }

    getIngresosNegocio(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.ingresosNegocio || []).filter((i) => i.negocioId === nId);
    }

    registrarIngresoNegocio(datos = {}, operationKey = undefined) {
      return this.businessWrite('saveIncome', datos, operationKey);
    }

    registrarVenta(datos, operationKey = undefined) {
      return this.businessWrite('sale', datos, operationKey);
    }

    getVentasCredito(negocioId = null) {
      return this.getVentas(negocioId).filter((v) => v.tipoPago === 'CREDITO');
    }

    // Abonos de Crédito (Regla 5)
    /**
     * Registra el abono de una venta mediante el comando empresarial de cobro.
     * @param {string} ventaId Venta a crédito que recibe el abono.
     * @param {string} clienteId Cliente asociado al cobro.
     * @param {number|string} monto Importe que valida el comando empresarial.
     * @param {string} metodoPago Método de pago registrado.
     * @param {string} notas Notas opcionales del abono.
     * @param {string|undefined} operationKey Clave opcional del reintento.
     * @returns {Promise<object>} Resultado de businessWrite con el pago confirmado o el error.
     */
    registrarAbonoCliente(
      ventaId,
      clienteId,
      monto,
      metodoPago = 'Efectivo',
      notas = '',
      operationKey = undefined,
    ) {
      return this.businessWrite(
        'paySale',
        { ventaId, clienteId, monto, metodoPago, notas },
        operationKey,
      );
    }

    getPagosVenta(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.pagosVenta || []).filter((p) => p.negocioId === nId);
    }

    // Fórmulas y Producción (Regla 6)
    getFormulas(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.formulas || []).filter((f) => f.negocioId === nId);
    }

    agregarFormula(datos, operationKey = undefined) {
      return this.businessWrite('saveFormula', datos, operationKey);
    }

    eliminarFormula(id, operationKey = undefined) {
      return this.businessWrite('archive', { collection: 'formulas', id }, operationKey);
    }

    getProducciones(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.producciones || []).filter((p) => p.negocioId === nId);
    }

    registrarProduccion(formulaId, cantidad, notas = '', operationKey = undefined) {
      return this.businessWrite('production', { formulaId, cantidad, notas }, operationKey);
    }

    // Inventario y Kardex
    getInventario(negocioId = null) {
      const prods = this.getProductos(negocioId, 'ALL');
      const domain = window.BusinessInventoryDomain;
      return domain
        ? domain.calcularValorInventario(prods)
        : { valorTotal: 0, unidadesTotales: 0, enAlerta: 0 };
    }

    getAlertasStockBajo(negocioId = null) {
      const prods = this.getProductos(negocioId, 'ALL');
      const domain = window.BusinessInventoryDomain;
      return domain ? domain.getAlertasStockBajo(prods) : [];
    }

    getMovimientosInventario(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.movimientosInventario || []).filter((m) => m.negocioId === nId);
    }

    ajustarStockProducto(
      productoId,
      nuevoStock,
      motivo = 'Ajuste manual',
      operationKey = undefined,
    ) {
      return this.businessWrite('adjustStock', { productoId, nuevoStock, motivo }, operationKey);
    }

    // Empleados y Nómina
    getEmpleados(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.empleados || []).filter((e) => e.negocioId === nId);
    }

    agregarEmpleado(datos, operationKey = undefined) {
      return this.businessWrite('saveEmployee', datos, operationKey);
    }

    actualizarEmpleado(id, datos, operationKey = undefined) {
      return this.businessWrite('saveEmployee', { ...datos, id }, operationKey);
    }

    getPagosEmpleado(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.pagosEmpleado || []).filter((p) => p.negocioId === nId);
    }

    /**
     * Delega el pago de nómina y sus registros relacionados al comando empresarial.
     * @param {string} empleadoId Empleado que recibe el pago.
     * @param {number|string} monto Importe que valida el comando empresarial.
     * @param {string} concepto Concepto del pago.
     * @param {string} periodo Período registrado por el comando.
     * @param {string} metodo Método de pago registrado.
     * @param {string|undefined} operationKey Clave opcional del reintento.
     * @returns {Promise<object>} Resultado de businessWrite con el pago confirmado o el error.
     */
    registrarPagoNomina(
      empleadoId,
      monto,
      concepto,
      periodo,
      metodo = 'Transferencia',
      operationKey = undefined,
    ) {
      return this.businessWrite(
        'payroll',
        { empleadoId, monto, concepto, periodo, metodoPago: metodo },
        operationKey,
      );
    }

    // Gastos Empresariales (Regla 7)
    getGastosNegocio(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      return (this.state.gastosNegocio || []).filter((g) => g.negocioId === nId);
    }

    registrarGastoNegocio(datos, operationKey = undefined) {
      return this.businessWrite('saveExpense', datos, operationKey);
    }

    eliminarGastoNegocio(id, operationKey = undefined) {
      return this.businessWrite(
        'cancel',
        { collection: 'gastosNegocio', id, motivo: 'Anulación solicitada' },
        operationKey,
      );
    }

    // Métricas de pérdidas y ganancias y estado de resultados (Regla 9)
    calcularMetricasEmpresariales(negocioId = null, filtroPeriodo = 'MES_ACTUAL') {
      const nId = negocioId || this.state.negocioActivoId;
      const domain = window.BusinessMetricsDomain;
      return domain
        ? domain.calcularMetricasEmpresariales(nId, this.state, filtroPeriodo)
        : {
            ventasTotales: 0,
            costoProductosVendidos: 0,
            utilidadBruta: 0,
            gastosOperativos: 0,
            utilidadNeta: 0,
            margenBrutoPct: 0,
            margenNetoPct: 0,
            cuentasPorCobrar: 0,
            valorInventario: 0,
            productosAlerta: 0,
            cantidadProductos: 0,
            cantidadVentas: 0,
          };
    }

    // Caja y Flujo
    getCajaYFlujo(negocioId = null) {
      const nId = negocioId || this.state.negocioActivoId;
      const domain = window.BusinessCashFlowDomain;
      return domain
        ? domain.calcularCajaYFlujo(nId, this.state)
        : {
            saldoDisponible: 0,
            cuentas: [],
            totalEntradas: 0,
            totalSalidas: 0,
            flujoNeto: 0,
            movimientosCaja: [],
          };
    }
  }

  // Instanciar singleton global
  const Finanzas = new FinanzasCore();
  window.FinanzasCore = FinanzasCore;
  window.Finanzas = Finanzas;
})();
