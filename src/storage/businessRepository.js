/**
 * Unidad de trabajo empresarial compartida con la facturación simulada.
 * El candidato reúne inventario, venta, pagos y auditoría para confirmar una sola vez.
 * El servidor conserva su validación y autorización aunque el cliente ya haya validado.
 */
(function () {
  'use strict';
  const clone = (value) => JSON.parse(JSON.stringify(value));
  // Debe coincidir con PersonalRepository: las dos áreas comparten exclusión y pendientes.
  const WRITE_LOCK_NAME = 'mibolsillo-invoicing-v1';

  class BusinessRepository {
    /** @param {object} core Puerto de aplicación; no es otro almacén financiero. */
    constructor(core = window.Finanzas) {
      this.core = core;
    }

    /**
     * @template Result
     * @param {function(object): Result} mutate Mutación síncrona, ejecutada tras refrescar y validar.
     * @param {{operationKey?: string}} options Identidad original de la intención.
     * @returns {Promise<Result>} Copia del resultado, solo tras confirmar o reconciliar esa intención.
     * @throws {Error} Si hay otra intención pendiente, validación fallida o rechazo de persistencia.
     * El candidato se publica después de confirmar. Una excepción posterior no implica ROLLBACK.
     * La ambigüedad conserva el resultado para recuperarlo sin duplicar la intención.
     */
    async transact(mutate, { operationKey } = {}) {
      if (!window.navigator?.locks?.request) {
        throw new Error(
          'Este navegador no permite bloquear escrituras. Use localhost o HTTPS con Web Locks.',
        );
      }
      return window.navigator.locks.request(WRITE_LOCK_NAME, { mode: 'exclusive' }, async () => {
        const storage = window.FinanzasStorage;
        const pending = this.core._unconfirmedBusiness;
        const hasDifferentBusinessOperation =
          pending && (!operationKey || operationKey !== pending.key);
        if (this.core._unconfirmedPersonal || hasDifferentBusinessOperation) {
          throw new Error(
            'Hay una operación anterior sin confirmar. Reintenta su formulario original o recarga para revisar lo guardado.',
          );
        }
        if (storage.hasPendingChanges() || storage.getPersistenceStatus().status === 'read-error') {
          throw new Error('Resuelva el aviso de persistencia antes de guardar.');
        }
        if (!(await storage.refreshFromBackend({ recover: true }))) {
          throw new Error('No se pudo actualizar SQLite. Conserva el formulario y reintenta.');
        }
        if (
          pending &&
          window.MiBolsilloSQLiteBackend?.getWriteStatus().confirmedOperation ===
            pending.operationId
        ) {
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
        if (!(await storage.saveState(state, { keepPending: false }))) {
          const status = storage.getPersistenceStatus();
          if (status.ambiguous) {
            this.core._unconfirmedBusiness = {
              key: operationKey,
              result: clone(result),
              operationId: status.operationId,
            };
          }
          throw new Error(
            (status.ambiguous
              ? 'No se confirmó la operación.'
              : 'No se pudo guardar la operación.') +
              ' Conserva el formulario y reintenta. ' +
              (status.message || ''),
          );
        }
        this.core.publicarEstadoConfirmado(state, { ok: true, status: 'saved' });
        return clone(result);
      });
    }
  }
  window.BusinessRepository = BusinessRepository;
})();
