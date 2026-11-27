/**
 * Normaliza el agregado de la aplicación y coordina las migraciones compatibles.
 * Recibe un candidato y devuelve una copia; no consulta DOM, transporte ni disco.
 * Las entidades personales y el esquema empresarial conservan sus reglas propias.
 */
(function () {
  'use strict';
  const clavePeriodo = (anio, mes) => window.PersonalBudgetDomain.clavePeriodo(anio, mes);
  const normalizer = {
    clavePeriodo,
    /**
     * @param {object} rawState Estado leído o candidato explícito.
     * @returns {object} Copia normalizada compatible con los escritores actuales.
     * @throws {Error} Si el candidato no admite la serialización JSON existente.
     */
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

      next.metas = next.metas.map((meta, index) => window.PersonalGoalsDomain.normalizar(meta, index));
      next.deudas = next.deudas.map((deuda, index) => window.PersonalDebtsDomain.normalizar(deuda, index));

      next.usuario = next.usuario || {};
      next.usuario.nombre = (next.usuario.nombre || 'Usuario').toString().trim() || 'Usuario';
      next.usuario.email = (next.usuario.email || '').toString();
      next.usuario.iniciales = (next.usuario.iniciales || 'US').toString().trim() || 'US';
      next.saldoOculto = Boolean(next.saldoOculto);
      next.moduloActivo = next.moduloActivo === 'EMPRESARIAL' ? 'EMPRESARIAL' : 'PERSONAL';
      next.negocioActivoId = next.negocioActivoId || (next.negocios[0] ? next.negocios[0].id : null);
      next.presupuestoMensual = Math.max(Number(next.presupuestoMensual) || 0, 0);
      // La migración existente asigna el presupuesto antiguo solo al período guardado.
      if (next.presupuestosVersion !== 1) {
        next.presupuestosPorPeriodo = next.presupuestosPorPeriodo || {};
        next.presupuestosPorPeriodo[clavePeriodo(next.periodoAnio, next.periodoMes)] ||= {
          limite: next.presupuestoMensual, limitesCategorias: { ...(next.limitesCategorias || {}) }
        };
        next.presupuestosVersion = 1;
      }
      next.presupuestosPorPeriodo ||= {};
      const budget = next.presupuestosPorPeriodo[clavePeriodo(next.periodoAnio, next.periodoMes)];
      next.presupuestoMensual = Math.max(Number(budget?.limite) || 0, 0);
      next.limitesCategorias = { ...(budget?.limitesCategorias || {}) };
      next.recordatoriosDeudasVistos ||= {};
      if (!next.cuentas.length) next.cuentas.push({ id: 'cuenta-principal', nombre: 'Principal', tipo: 'EFECTIVO' });
      // No inferir egresos históricos por coincidencias de importe o descripción.
      next.abonosDeudas.forEach(payment => {
        const linked = payment.movimientoId && next.movimientos.find(m => m.id === payment.movimientoId && m.tipo === 'GASTO' && Number(m.valor) === Number(payment.valor) && m.deudaId === payment.deudaId);
        payment.estadoVinculacion = linked ? 'vinculado' : 'historico-sin-egreso';
      });

      window.BusinessSchema?.migrate(next);
      return next;
    }
  };
  window.FinanzasStateNormalizer = normalizer;
})();
