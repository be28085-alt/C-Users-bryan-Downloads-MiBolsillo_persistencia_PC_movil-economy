/**
 * Coordina el envío de formularios PC/móvil sin persistir sus borradores.
 * WeakMap conserva solo la firma y clave del formulario vivo; las contraseñas y archivos
 * no forman parte de la firma. El plazo de recuperación de sesión pertenece a accountSession.
 */
(function () {
  'use strict';
  const drafts = new WeakMap();
  let activeForm = null;
  let retainedForm = null;
  /**
   * Conserva la identidad del intento solo en memoria y mientras el formulario no cambie.
   * @param {object} owner Controlador propietario del envío.
   * @param {string} name Nombre estable del handler, no de un dato financiero.
   * @param {Function} handler Handler original; conserva su this y argumentos.
   * @param {Array<*>} args Argumentos recibidos por el controlador.
   * @returns {Promise<*>} Resultado del handler, sin convertirlo en éxito de guardado.
   * @throws {Error} Antes de crear la promesa si cambia una intención todavía incierta.
   * La clave se instala solo durante la llamada síncrona que captura la unidad de trabajo.
   */
  function invoke(owner, name, handler, args) {
    const form =
      args[0]?.currentTarget?.tagName === 'FORM'
        ? args[0].currentTarget
        : document.activeElement?.closest?.('form');
    const scope = form || document.getElementById?.('view-registrar') || owner;
    const signature = JSON.stringify([
      name,
      ...Array.from(scope.querySelectorAll?.('input,select,textarea') || [])
        .filter((input) => !['password', 'file'].includes(input.type))
        .map((input) => [input.id || input.name, input.value, input.checked]),
    ]);
    const previous = drafts.get(scope);
    if (
      previous &&
      window.Finanzas._unconfirmedPersonal?.key === previous.key &&
      previous.signature !== signature
    ) {
      throw new Error(
        'La operación anterior sigue sin confirmar. Conserva los valores originales para reintentar o recarga para revisar lo guardado.',
      );
    }
    const draft =
      previous?.signature === signature ? previous : { signature, key: crypto.randomUUID() };
    drafts.set(scope, draft);
    const core = window.Finanzas,
      before = core._personalOperationKey;
    core._personalOperationKey = draft.key;
    let task;
    try {
      task = handler.apply(owner, args);
    } finally {
      core._personalOperationKey = before;
    }
    return Promise.resolve(task).then((result) => {
      if (window.FinanzasStorage.getPersistenceStatus().ok) {
        drafts.delete(scope);
        const modal = form?.closest('[id^="modal"],dialog');
        if (
          modal &&
          (modal.classList.contains('hidden') || (modal.tagName === 'DIALOG' && !modal.open))
        ) {
          form.reset();
        }
      }
      return result;
    });
  }
  /**
   * Un único bloqueo de doble envío para ambos controladores.
   * @param {object} owner Controlador con _pendingForms y su método de avisos existente.
   * @param {string} name Handler protegido contra doble envío simultáneo.
   * @param {Function} handler Función original enlazada al controlador.
   * @returns {Function} Handler asíncrono que siempre rehabilita los controles en finally.
   */
  function wrap(owner, name, handler) {
    return async (...args) => {
      args[0]?.preventDefault?.();
      if (owner._pendingForms.has(name)) return;
      owner._pendingForms.add(name);
      const form = args[0]?.currentTarget?.tagName === 'FORM' ? args[0].currentTarget : null;
      const buttons = Array.from(form?.querySelectorAll('button[type="submit"]') || []);
      buttons.forEach((button) => {
        button.disabled = true;
      });
      activeForm = form;
      try {
        return await invoke(owner, name, handler, args);
      } catch (error) {
        (owner.showToast || owner.mostrarToast).call(
          owner,
          error.message || window.MiBolsilloErrors.messages.persistence,
        );
      } finally {
        retainedForm = form && !window.FinanzasStorage.getPersistenceStatus().ok ? form : null;
        activeForm = null;
        owner._pendingForms.delete(name);
        buttons.forEach((button) => {
          button.disabled = false;
        });
      }
    };
  }
  window.FinanzasForms = Object.freeze({
    wrap,
    invoke,
    getActiveForm: () =>
      activeForm ||
      (retainedForm?.isConnected && !retainedForm.closest('.hidden') ? retainedForm : null),
  });
  document.addEventListener(
    'click',
    (event) => {
      const button = event.target.closest?.('button[onclick*="closeModal"]');
      const form = button?.closest('[id^="modal"]')?.querySelector('form');
      if (form) {
        drafts.delete(form);
        form.reset();
        if (retainedForm === form) retainedForm = null;
      }
    },
    true,
  );
})();
