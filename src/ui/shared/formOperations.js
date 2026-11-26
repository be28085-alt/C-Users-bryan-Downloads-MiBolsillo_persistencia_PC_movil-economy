(function () {
  'use strict';
  const drafts = new WeakMap();
  let activeForm = null;
  let retainedForm = null;
  /** Conserva la identidad del intento solo en memoria y mientras el formulario no cambie. */
  function invoke(owner, name, handler, args) {
    const form = args[0]?.currentTarget?.tagName === 'FORM' ? args[0].currentTarget : document.activeElement?.closest?.('form');
    const scope = form || document.getElementById?.('view-registrar') || owner;
    const signature = JSON.stringify([name, ...Array.from(scope.querySelectorAll?.('input,select,textarea') || [])
      .filter(input => !['password','file'].includes(input.type)).map(input => [input.id || input.name, input.value, input.checked])]);
    const previous = drafts.get(scope);
    if (previous && window.Finanzas._unconfirmedPersonal?.key === previous.key && previous.signature !== signature) {
      throw new Error('La operación anterior sigue sin confirmar. Conserva los valores originales para reintentar o recarga para revisar lo guardado.');
    }
    const draft = previous?.signature === signature ? previous : { signature, key: crypto.randomUUID() };
    drafts.set(scope, draft);
    const core = window.Finanzas, before = core._personalOperationKey;
    core._personalOperationKey = draft.key;
    let task;
    try { task = handler.apply(owner, args); }
    finally { core._personalOperationKey = before; }
    return Promise.resolve(task).then(result => {
      if (window.FinanzasStorage.getPersistenceStatus().ok) {
        drafts.delete(scope);
        const modal = form?.closest('[id^="modal"],dialog');
        if (modal && (modal.classList.contains('hidden') || modal.tagName === 'DIALOG' && !modal.open)) form.reset();
      }
      return result;
    });
  }
  /** Un único bloqueo de doble envío para ambos controladores. */
  function wrap(owner, name, handler) {
    return async (...args) => {
      args[0]?.preventDefault?.();
      if (owner._pendingForms.has(name)) return;
      owner._pendingForms.add(name);
      const form = args[0]?.currentTarget?.tagName === 'FORM' ? args[0].currentTarget : null;
      const buttons = Array.from(form?.querySelectorAll('button[type="submit"]') || []);
      buttons.forEach(button => { button.disabled = true; });
      activeForm = form;
      try { return await invoke(owner, name, handler, args); }
      catch (error) { (owner.showToast || owner.mostrarToast).call(owner, error.message || window.MiBolsilloErrors.messages.persistence); }
      finally {
        retainedForm = form && !window.FinanzasStorage.getPersistenceStatus().ok ? form : null;
        activeForm = null; owner._pendingForms.delete(name); buttons.forEach(button => { button.disabled = false; });
      }
    };
  }
  window.FinanzasForms = Object.freeze({ wrap, invoke, getActiveForm: () => activeForm
    || (retainedForm?.isConnected && !retainedForm.closest('.hidden') ? retainedForm : null) });
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button[onclick*="closeModal"]');
    const form = button?.closest('[id^="modal"]')?.querySelector('form');
    if (form) { drafts.delete(form); form.reset(); if (retainedForm === form) retainedForm = null; }
  }, true);
})();
