(function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  // Shared unit of work for ALL business writers, including simulated invoicing.
  // A future MySQL repository must execute commands server-side inside a DB transaction.
  class BusinessRepository {
    constructor(core = window.Finanzas) { this.core = core; }
    async transact(mutate) {
      if (!window.navigator?.locks?.request) throw new Error('Este navegador no permite bloquear escrituras. Use localhost o HTTPS con Web Locks.');
      return window.navigator.locks.request('mibolsillo-invoicing-v1', { mode: 'exclusive' }, () => {
        const storage = window.FinanzasStorage;
        if (storage.hasPendingChanges() || storage.getPersistenceStatus().status === 'read-error') throw new Error('Resuelva el aviso de persistencia antes de guardar.');
        const raw = window.localStorage.getItem(storage.getStorageKey());
        if (raw) window.MiBolsilloSync.applyIncomingState(JSON.parse(raw));
        const state = clone(this.core.state);
        window.BusinessSchema?.migrate(state);
        window.BusinessSchema?.validate(state);
        window.InvoiceSchema?.validateState(state);
        const result = mutate(state);
        if (result?.then) throw new Error('La mutación del repositorio debe ser síncrona.');
        window.InvoiceSchema?.validateState(state);
        window.BusinessSchema?.validate(state);
        if (!storage.saveState(state, { keepPending: false })) throw new Error('No se pudo guardar la operación. No se modificaron los datos; puede reintentar.');
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
