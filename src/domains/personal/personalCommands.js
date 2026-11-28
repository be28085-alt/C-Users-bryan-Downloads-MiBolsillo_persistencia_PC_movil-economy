/**
 * Comandos personales sobre un candidato explícito; no conocen UI ni persistencia.
 * El caso de uso debe ejecutarlos dentro de la unidad de trabajo PersonalRepository.
 * Abonos de deuda y sus egresos cambian el mismo candidato para confirmar juntos.
 * Fechas, identificadores, redondeo e historial conservan los contratos anteriores.
 */
(function () {
  'use strict';
  function importe(value, permitirCero = false) {
    if (value === '' || value === null || value === undefined) {
      throw new Error('Escribe un importe válido.');
    }
    const number = Number(value);
    if (
      !Number.isFinite(number) ||
      number < 0 ||
      (!permitirCero && number === 0) ||
      number > 1000000000000
    ) {
      throw new Error('El importe debe ser positivo y estar dentro del límite permitido.');
    }
    const rounded = Math.round((number + Number.EPSILON) * 100) / 100;
    if (!permitirCero && rounded === 0) throw new Error('El importe mínimo es 0,01 COP.');
    return rounded;
  }

  const commands = {
    importe,
    agregarMovimiento(next, datos) {
      const valor = importe(datos.valor);
      const concepto = String(datos.concepto || '').trim();
      const fecha = datos.fecha || window.obtenerFechaHoyISO();
      if (
        !['INGRESO', 'GASTO'].includes(datos.tipo) ||
        !concepto ||
        concepto.length > 255 ||
        !window.esFechaISOValida(fecha)
      ) {
        throw new Error('Revisa el tipo, el concepto y la fecha del movimiento.');
      }
      const nuevo = window.PersonalMovementsDomain.crearMovimiento({
        ...datos,
        valor,
        concepto,
        fecha,
      });
      next.movimientos.unshift(nuevo);
      const period = window.parseFechaLocal(fecha);
      next.periodoAnio = period.getFullYear();
      next.periodoMes = period.getMonth();
      return nuevo;
    },

    actualizarPresupuesto(next, monto) {
      const key = window.PersonalBudgetDomain.clavePeriodo(next.periodoAnio, next.periodoMes);
      next.presupuestosPorPeriodo[key] = {
        ...(next.presupuestosPorPeriodo[key] || { limitesCategorias: {} }),
        limite: importe(monto, true),
      };
      return { ok: true };
    },

    actualizarLimiteCategoria(next, categoria, monto) {
      const key = window.PersonalBudgetDomain.clavePeriodo(next.periodoAnio, next.periodoMes);
      const budget = (next.presupuestosPorPeriodo[key] ||= { limite: 0, limitesCategorias: {} });
      budget.limitesCategorias[categoria] = importe(monto, true);
      return { ok: true };
    },

    agregarMeta(next, datos = {}) {
      const objetivo = importe(datos.montoObjetivo ?? datos.objetivo);
      const ahorrado = importe(datos.montoActual ?? datos.ahorrado ?? 0, true);
      const nombre = String(datos.nombre || '').trim();
      if (!nombre) throw new Error('Escribe el nombre de la meta.');
      const meta = {
        id: `meta-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        nombre,
        objetivo,
        ahorrado,
        montoObjetivo: objetivo,
        montoActual: ahorrado,
        plazo: String(datos.plazo || datos.fechaLimite || '').trim(),
        fechaLimite: datos.fechaLimite || '',
        color: datos.color || '#10b981',
        icono: datos.icono || '🎯',
        categoria: datos.categoria || 'Ahorro',
      };
      next.metas.push(meta);
      if (ahorrado) {
        next.aportesMetas.push({
          id: `ap-${meta.id}`,
          metaId: meta.id,
          metaNombre: nombre,
          monto: ahorrado,
          valor: ahorrado,
          fecha: window.obtenerFechaHoyISO(),
          nota: 'Ahorro inicial',
        });
      }
      return meta;
    },

    abonarAMeta(next, metaId, monto, nota = '') {
      const meta = next.metas.find((m) => m.id === metaId);
      if (!meta) throw new Error('La meta no pertenece a tus datos actuales.');
      const baseMeta = window.PersonalGoalsDomain.normalizar(meta);
      const valor = importe(monto);
      const nuevoActual = importe(baseMeta.montoActual + valor);
      baseMeta.montoActual = nuevoActual;
      baseMeta.ahorrado = nuevoActual;
      baseMeta.objetivo = Number(baseMeta.montoObjetivo ?? baseMeta.objetivo ?? 0) || 0;
      Object.assign(meta, baseMeta);
      const aporte = {
        id: `ap-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        metaId,
        metaNombre: meta.nombre,
        monto: valor,
        valor,
        fecha: window.obtenerFechaHoyISO
          ? window.obtenerFechaHoyISO()
          : new Date().toISOString().split('T')[0],
        nota: (nota || '').trim(),
      };
      next.aportesMetas.push(aporte);
      return { ...aporte, mensaje: 'Aporte guardado correctamente.' };
    },

    agregarDeuda(next, datos = {}) {
      const montoInicial = importe(datos.montoInicial ?? datos.valorInicial);
      const saldo = importe(datos.saldoPendiente ?? datos.saldo ?? montoInicial, true);
      const cuota = importe(datos.cuotaMensual ?? 0, true);
      const nombre = String(datos.nombre || datos.concepto || datos.acreedor || '').trim();
      if (!nombre || saldo > montoInicial) {
        throw new Error('Revisa el nombre y el saldo pendiente de la deuda.');
      }
      if (
        (datos.proximoPago && !window.esFechaISOValida(datos.proximoPago)) ||
        (datos.fechaVencimiento && !window.esFechaISOValida(datos.fechaVencimiento))
      ) {
        throw new Error('Revisa la fecha de vencimiento de la deuda.');
      }
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
        estado: saldo === 0 ? 'PAGADA' : 'AL_DIA',
      };
      next.deudas.push(deuda);
      return deuda;
    },

    /**
     * Compone abono, saldo y egreso sobre el mismo candidato para confirmar juntos.
     * @param {object} next Copia exclusiva de la unidad de trabajo.
     * @param {string} deudaId Deuda visible de ese candidato.
     * @param {number|string} monto Importe validado con el contrato monetario existente.
     * @param {string} metodo Etiqueta del medio de pago.
     * @param {object} options Cuenta, fecha y opciones del caso de uso.
     * @param {string} operationKey Clave capturada antes de encolar la intención.
     * @returns {object} Abono compuesto; no representa aún una escritura confirmada.
     * @throws {Error} Referencia inválida, sobrepago o reutilización incompatible de clave.
     */
    pagarDeuda(next, deudaId, monto, metodo = 'Transferencia', options = {}, operationKey) {
      const valor = importe(monto);
      const selected = options.cuenta || next.cuentas[0]?.id;
      const cuenta = next.cuentas.find((c) => c.id === selected || c.nombre === selected);
      if (!cuenta) throw new Error('Selecciona una cuenta existente para el pago.');
      const previous = next.abonosDeudas.find((p) => p.operationKey === operationKey);
      if (previous) {
        if (
          previous.deudaId !== deudaId ||
          Number(previous.valor) !== valor ||
          previous.cuentaId !== cuenta.id
        ) {
          throw new Error('La clave del pago ya se utilizó con otros datos.');
        }
        return {
          ...previous,
          duplicate: true,
          mensaje: 'El pago ya estaba guardado; no se duplicó.',
        };
      }
      const deuda = window.PersonalDebtsDomain.clasificar(next.deudas).visibles.find(
        (d) => d.id === deudaId,
      );
      if (!deuda) throw new Error('La deuda no pertenece a tus datos actuales.');
      if (valor > deuda.saldoPendiente) {
        throw new Error('El abono no puede superar el saldo pendiente.');
      }
      const fecha = options.fecha || window.obtenerFechaHoyISO();
      if (!window.esFechaISOValida(fecha)) throw new Error('La fecha del pago no es válida.');
      const { deudaActualizada, abono } = window.PersonalDebtsDomain.registrarPago(
        deuda,
        valor,
        metodo,
      );
      const movement = window.PersonalMovementsDomain.crearMovimiento({
        tipo: 'GASTO',
        valor,
        concepto: 'Pago de deuda: ' + deuda.nombre,
        categoria: 'Deudas',
        cuenta: cuenta.nombre,
        fecha,
      });
      Object.assign(movement, {
        cuentaId: cuenta.id,
        deudaId,
        abonoDeudaId: abono.id,
        operationKey,
      });
      Object.assign(deuda, deudaActualizada);
      Object.assign(abono, {
        valor,
        monto: valor,
        fecha,
        deudaNombre: deuda.nombre,
        cuentaId: cuenta.id,
        cuenta: cuenta.nombre,
        movimientoId: movement.id,
        operationKey,
        estadoVinculacion: 'vinculado',
      });
      next.movimientos.unshift(movement);
      next.abonosDeudas.push(abono);
      if (
        valor >=
          Math.min(Number(deuda.cuotaMensual) || valor, Number(deuda.saldoPendiente) + valor) &&
        deuda.proximoPago
      ) {
        next.recordatoriosDeudasVistos[deuda.id + ':' + deuda.proximoPago] =
          window.obtenerFechaHoyISO();
      }
      return { ...abono, mensaje: 'Pago y salida de dinero guardados correctamente.' };
    },

    eliminarMovimiento(next, id) {
      if (next.movimientos.find((m) => m.id === id)?.abonoDeudaId) {
        throw new Error(
          'Este egreso está vinculado a un pago de deuda y no se puede eliminar por separado.',
        );
      }
      next.movimientos = next.movimientos.filter((m) => m.id !== id);
      return { ok: true };
    },

    eliminarMeta(next, id) {
      next.metas = next.metas.filter((m) => m.id !== id);
      next.aportesMetas = next.aportesMetas.filter((a) => a.metaId !== id);
      return { ok: true };
    },

    eliminarDeuda(next, id) {
      if (next.abonosDeudas.some((a) => a.deudaId === id)) {
        const debt = next.deudas.find((d) => d.id === id);
        debt.archivada = true;
        debt.estado = 'ARCHIVADA';
        return { ok: true, archivada: true };
      }
      next.deudas = next.deudas.filter((d) => d.id !== id);
      next.abonosDeudas = next.abonosDeudas.filter((a) => a.deudaId !== id);
      return { ok: true };
    },
  };
  window.PersonalCommands = commands;
})();
