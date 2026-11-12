(function () {
  'use strict';
  const { commands, business, clone, uuid } = window.BusinessCommands;
  class BusinessService {
    constructor(core = window.Finanzas, repository = new window.BusinessRepository(core)) { this.core = core; this.repository = repository; }
    async execute(action, data = {}, key = uuid()) {
      if (!Object.prototype.hasOwnProperty.call(commands, action)) throw new Error('Comando empresarial desconocido.');
      function inspect(value) {
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('No se permiten valores numéricos no finitos.');
        if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Campo no permitido.'); inspect(child); }
      }
      inspect(data);
      const allowEmpty = action === 'saveBusiness' && !data.id;
      const write = action !== 'saveReportPreferences';
      const businessId = business(this.core.state, write, allowEmpty).id, payload = clone(data);
      if (payload.negocioId && payload.negocioId !== businessId) throw new Error('La operación no pertenece al negocio activo.');
      if (typeof key !== 'string' || !key || key.length > 150) throw new Error('Clave de operación inválida.');
      if (!window.crypto?.subtle) throw new Error('Use localhost o HTTPS para guardar de forma verificable.');
      const hash = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ action, data: payload })));
      const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
      return this.repository.transact(state => {
        if (business(state, write, allowEmpty).id !== businessId) throw new Error('Cambió el negocio activo. Abra el formulario nuevamente.');
        const previous = state.businessLedger.operations.find(o => o.key === key && o.businessId === businessId);
        if (previous) {
          if (previous.fingerprint !== fingerprint) throw new Error('La clave de operación ya se usó con otros datos.');
          return { ...previous.result, record: state[previous.result.collection]?.find(r => r.id === previous.result.record.id) || previous.result.record, persistence: { ok: true, status: 'saved' }, duplicate: true };
        }
        const auditCollection = payload.collection || { saveProduct: 'productos', saveCustomer: 'clientes', saveSupplier: 'proveedores', saveEmployee: 'empleados', saveFormula: 'formulas', saveExpense: 'gastosNegocio', saveIncome: 'ingresosNegocio', saveBusiness: 'negocios' }[action];
        const existing = action === 'saveReportPreferences' ? state.negocios.find(r => r.id === businessId) : payload.id && auditCollection ? state[auditCollection]?.find(r => r.id === payload.id) : null;
        const before = existing ? clone(existing) : null;
        const out = commands[action](state, payload);
        state.businessLedger.operations.push({ key, businessId: businessId || out.record.id, fingerprint, result: { collection: out.collection, record: { id: out.record.id, deleted: out.record.deleted }, message: out.message }, at: new Date().toISOString() });
        state.businessLedger.audit.push({ id: uuid(), businessId: businessId || out.record.id, action, recordId: out.record.id, collection: out.collection, at: new Date().toISOString(), actor: state.usuario?.email || state.usuario?.nombre || 'Propietario local', previous: before ? clone(before) : null, operationKey: key });
        return { ...out, persistence: { ok: true, status: 'saved' } };
      });
    }
  }
  window.BusinessService = BusinessService;
})();
