/**
 * Unidad de trabajo personal: refresca, bloquea, confirma y publica un agregado.
 * Comparte el bloqueo y los indicadores inciertos con los escritores empresariales.
 * No aplica reglas financieras ni accede a elementos visuales.
 */
(function () {
  'use strict';
  // Protocolo compartido con BusinessRepository: otro nombre rompería la exclusión mutua.
  const WRITE_LOCK_NAME = 'mibolsillo-invoicing-v1';

  /**
   * @typedef {object} PersonalWriteFailure
   * @property {string} error Mensaje público; no supone que una escritura incierta se revirtió.
   */

  class PersonalRepository {
    /**
     * @param {object} core Puerto de aplicación: estado, normalización y notificación.
     * @param {object} dependencies Adaptadores inyectables; nunca otra fuente financiera.
     * Las confirmaciones y las opciones keepPending conservan el contrato de fase 2.
     */
    constructor(
      core,
      {
        storage = window.FinanzasStorage || window.MiBolsilloStorage,
        transport = window.MiBolsilloSQLiteBackend,
        locks = window.navigator?.locks,
      } = {},
    ) {
      Object.assign(this, { core, storage, transport, locks });
    }

    /**
     * Guarda y publica únicamente la representación confirmada por el almacenamiento.
     * @param {object} next Candidato aislado de la proyección que consultan las vistas.
     * @param {{locked?: boolean}} options Indica que la unidad de trabajo ya tiene el bloqueo.
     * @returns {Promise<boolean>} False no publica el candidato y permite al llamador conservarlo.
     * @throws {Error} Si falla la normalización, serialización o un adaptador rechaza.
     */
    async persistirEstado(next, { locked = false } = {}) {
      if (!locked && this.locks?.request) {
        return this.locks.request(WRITE_LOCK_NAME, { mode: 'exclusive' }, () =>
          this.persistirEstado(next, { locked: true }),
        );
      }
      const storage = this.storage;
      if (!storage || storage.hasPendingChanges?.()) return false;
      next = this.core.normalizeState(next);
      if (!(await storage.saveState(next, { keepPending: false }))) return false;
      const confirmed = storage.getRawState?.();
      this.core.publicarEstadoConfirmado(
        confirmed ? this.core.normalizeState(JSON.parse(confirmed).data) : next,
        storage.getPersistenceStatus(),
      );
      return true;
    }

    /**
     * Ejecuta una intención; conserva el resultado incierto para su reintento original.
     * @template Result
     * @param {function(object): Result} mutate Mutación síncrona del candidato, sin E/S.
     * @returns {Promise<Result|PersonalWriteFailure>} Resultado confirmado o rechazo público.
     * La clave se captura antes de encolar: otro formulario no puede recuperar esta intención.
     * Los rechazos dentro de la unidad se convierten en error; el puerto de locks aún puede rechazar.
     */
    async escribirPersonal(mutate) {
      const operationKey = this.core._personalOperationKey;
      const write = async () => {
        try {
          const storage = this.storage;
          const pendingPersonal = this.core._unconfirmedPersonal;
          const hasDifferentPersonalOperation =
            pendingPersonal && (!operationKey || operationKey !== pendingPersonal.key);
          if (this.core._unconfirmedBusiness || hasDifferentPersonalOperation) {
            return {
              error:
                'Hay una operación anterior sin confirmar. Reintenta su formulario original o recarga para revisar lo guardado.',
            };
          }
          if (!(await storage.refreshFromBackend({ recover: true }))) {
            return {
              error:
                storage.getPersistenceStatus().message ||
                'No se pudo comprobar el estado guardado.',
            };
          }
          if (this.core._unconfirmedPersonal) {
            const previous = this.core._unconfirmedPersonal;
            if (this.transport?.getWriteStatus().confirmedOperation === previous.operationId) {
              this.core._unconfirmedPersonal = null;
              if (operationKey && operationKey === previous.key) return previous.result;
              return {
                error:
                  'La operación anterior se confirmó. Revisa el estado guardado antes de registrar otra.',
              };
            }
          }
          const next = this.core.normalizeState(this.core.state);
          const result = mutate(next);
          if (!(await this.persistirEstado(next, { locked: true }))) {
            const status = storage.getPersistenceStatus();
            if (status.ambiguous) {
              this.core._unconfirmedPersonal = {
                key: operationKey,
                result,
                operationId: status.operationId,
              };
            }
            return {
              error:
                status.message ||
                'No se confirmó el guardado. Conserva el formulario y revisa el aviso de persistencia.',
            };
          }
          return result;
        } catch (error) {
          return { error: error.message || 'No se pudo completar la operación.' };
        }
      };
      if (this.locks?.request) {
        return this.locks.request(WRITE_LOCK_NAME, { mode: 'exclusive' }, write);
      }
      this.core._personalTail = (this.core._personalTail || Promise.resolve()).then(write, write);
      return this.core._personalTail;
    }
  }
  window.PersonalRepository = PersonalRepository;
})();
