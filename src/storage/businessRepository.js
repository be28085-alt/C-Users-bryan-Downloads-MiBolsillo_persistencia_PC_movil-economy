(function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  // Shared unit of work for ALL business writers, including simulated invoicing.
  // SQLite compare-and-swap commits the whole unit atomically. A future remote
  // multiuser repository must also validate domain commands server-side.
  class BusinessRepository {
    constructor(core = window.Finanzas) { this.core = core; }
    async transact(mutate, { operationKey } = {}) {
      if (!window.navigator?.locks?.request) throw new Error('Este navegador no permite bloquear escrituras. Use localhost o HTTPS con Web Locks.');
      return window.navigator.locks.request('mibolsillo-invoicing-v1', { mode: 'exclusive' }, async () => {
        const storage = window.FinanzasStorage;
        const pending = this.core._unconfirmedBusiness;
        if (this.core._unconfirmedPersonal || pending && (!operationKey || operationKey !== pending.key)) throw new Error('Hay una operación anterior sin confirmar. Reintenta su formulario original o recarga para revisar lo guardado.');
        if (storage.hasPendingChanges() || storage.getPersistenceStatus().status === 'read-error') throw new Error('Resuelva el aviso de persistencia antes de guardar.');
        if (!await storage.refreshFromBackend({ recover: true })) throw new Error('No se pudo actualizar SQLite. Conserva el formulario y reintenta.');
        if (pending && window.MiBolsilloSQLiteBackend?.getWriteStatus().confirmedOperation === pending.operationId) {
          this.core._unconfirmedBusiness = null;
          return clone(pending.result);
        }
        const raw = storage.getRawState();
        if (raw) window.MiBolsilloSync.applyIncomingState(JSON.parse(raw));
        const state = clone(this.core.state);
        window.BusinessSchema?.migrate(state);
        window.BusinessSchema?.validate(state);
        window.InvoiceSchema?.validateState(state);
        const result = mutate(state);
        if (result?.then) throw new Error('La mutación del repositorio debe ser síncrona.');
        window.InvoiceSchema?.validateState(state);
        window.BusinessSchema?.validate(state);
        if (!await storage.saveState(state, { keepPending: false })) {
          const status = storage.getPersistenceStatus();
          if (status.ambiguous) this.core._unconfirmedBusiness = { key: operationKey, result: clone(result), operationId: status.operationId };
          throw new Error((status.ambiguous ? 'No se confirmó la operación.' : 'No se pudo guardar la operación.') + ' Conserva el formulario y reintenta. ' + (status.message || ''));
        }
        this.core.state = state;
        if (window.MiBolsilloStore) window.MiBolsilloStore.state = state;
        this.core.lastPersistence = { ok: true, status: 'saved' };
        this.core.notify();
        return clone(result);
      });
    }
  }
  window.BusinessRepository = BusinessRepository;
})();
