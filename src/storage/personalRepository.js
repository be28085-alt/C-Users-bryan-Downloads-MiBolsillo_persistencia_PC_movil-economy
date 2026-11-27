/**
 * Unidad de trabajo personal: refresca, bloquea, confirma y publica un agregado.
 * Comparte el bloqueo y los indicadores inciertos con los escritores empresariales.
 * No aplica reglas financieras ni accede a elementos visuales.
 */
(function () {
  'use strict';
  class PersonalRepository {
    /**
     * @param {object} core Puerto de aplicación: estado, normalización y notificación.
     * @param {object} dependencies Adaptadores inyectables; nunca otra fuente financiera.
     * Las confirmaciones y las opciones keepPending conservan el contrato de fase 2.
     */
    constructor(core, { storage = window.FinanzasStorage || window.MiBolsilloStorage,
      transport = window.MiBolsilloSQLiteBackend, locks = window.navigator?.locks } = {}) {
      Object.assign(this, { core, storage, transport, locks });
    }

    /** Guarda y publica únicamente la representación confirmada por el almacenamiento. */
    async persistirEstado(next, { locked = false } = {}) {
      if (!locked && this.locks?.request) return this.locks.request('mibolsillo-invoicing-v1', { mode: 'exclusive' }, () => this.persistirEstado(next, { locked: true }));
      const storage = this.storage;
      if (!storage || storage.hasPendingChanges?.()) return false;
      next = this.core.normalizeState(next);
      if (!await storage.saveState(next, { keepPending: false })) return false;
      const confirmed = storage.getRawState?.();
      this.core.publicarEstadoConfirmado(confirmed ? this.core.normalizeState(JSON.parse(confirmed).data) : next,
        storage.getPersistenceStatus());
      return true;
    }

    /** Ejecuta una intención; conserva el resultado incierto para su reintento original. */
    async escribirPersonal(mutate) {
      const operationKey = this.core._personalOperationKey;
      const write = async () => {
        try {
          const storage = this.storage;
          if (this.core._unconfirmedBusiness || this.core._unconfirmedPersonal && (!operationKey || operationKey !== this.core._unconfirmedPersonal.key)) {
            return { error: 'Hay una operación anterior sin confirmar. Reintenta su formulario original o recarga para revisar lo guardado.' };
          }
          if (!await storage.refreshFromBackend({ recover: true })) return { error: storage.getPersistenceStatus().message || 'No se pudo comprobar el estado guardado.' };
          if (this.core._unconfirmedPersonal) {
            const previous = this.core._unconfirmedPersonal;
            if (this.transport?.getWriteStatus().confirmedOperation === previous.operationId) {
              this.core._unconfirmedPersonal = null;
              if (operationKey && operationKey === previous.key) return previous.result;
              return { error: 'La operación anterior se confirmó. Revisa el estado guardado antes de registrar otra.' };
            }
          }
          const next = this.core.normalizeState(this.core.state);
          const result = mutate(next);
          if (!await this.persistirEstado(next, { locked: true })) {
            const status = storage.getPersistenceStatus();
            if (status.ambiguous) this.core._unconfirmedPersonal = { key: operationKey, result, operationId: status.operationId };
            return { error: status.message || 'No se confirmó el guardado. Conserva el formulario y revisa el aviso de persistencia.' };
          }
          return result;
        } catch (error) { return { error: error.message || 'No se pudo completar la operación.' }; }
      };
      if (this.locks?.request) return this.locks.request('mibolsillo-invoicing-v1', { mode: 'exclusive' }, write);
      this.core._personalTail = (this.core._personalTail || Promise.resolve()).then(write, write);
      return this.core._personalTail;
    }
  }
  window.PersonalRepository = PersonalRepository;
})();
