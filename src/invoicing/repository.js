(function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  // Repository contract: transact(syncMutator) commits the entire candidate snapshot or throws.
  // A future authenticated API implementation must enforce database transactions and unique keys server-side.
  class LocalInvoiceRepository {
    constructor(core = window.Finanzas) { this.core = core; }
    async transact(mutate) {
      if (!window.navigator?.locks?.request) throw new Error('Este navegador no permite bloquear escrituras. Use una versión moderna en localhost o HTTPS.');
      return window.navigator.locks.request('mibolsillo-invoicing-v1', { mode: 'exclusive' }, () => {
        const storage = window.FinanzasStorage;
        if (storage.hasPendingChanges() || storage.getPersistenceStatus().status === 'read-error') throw new Error('Resuelva el aviso de persistencia antes de facturar.');
        const raw = window.localStorage.getItem(storage.getStorageKey());
        if (raw) window.MiBolsilloSync.applyIncomingState(JSON.parse(raw));
        const state = clone(this.core.state);
        window.InvoiceSchema.validateState(state);
        const result = mutate(state);
        if (result?.then) throw new Error('La mutación transaccional debe ser síncrona.');
        window.InvoiceSchema.validateState(state);
        if (!storage.saveState(state, { keepPending: false })) throw new Error('No se pudo guardar. No se aplicó la operación; puede reintentar con la misma clave.');
        this.core.state = state;
        if (window.MiBolsilloStore) window.MiBolsilloStore.state = clone(state);
        this.core.notify();
        return clone(result);
      });
    }
  }
  window.LocalInvoiceRepository = LocalInvoiceRepository;
})();
