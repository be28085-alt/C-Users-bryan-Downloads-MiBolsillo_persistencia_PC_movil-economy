(function () {
  'use strict';
  if (typeof document.querySelectorAll !== 'function' || !window.Finanzas) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'personal-movement-editor';
  dialog.className = 'personal-movement-dialog';
  dialog.style.cssText =
    'max-width:520px;width:calc(100% - 32px);max-height:85dvh;overflow:auto;border:1px solid #cfe2dc;border-radius:16px;padding:24px;background:white;color:#0b3b3c';
  dialog.innerHTML =
    '<form><h2>Editar movimiento</h2><label>Concepto<input name="concepto" maxlength="255" required></label><label>Tipo<select name="tipo"><option value="INGRESO">Ingreso</option><option value="GASTO">Gasto</option></select></label><label>Importe (COP)<input name="valor" type="number" min="0.01" max="1000000000000" step="0.01" required></label><label>Fecha<input name="fecha" type="date" required></label><label>Categoría<input name="categoria" maxlength="80" required></label><label>Cuenta<input name="cuenta" maxlength="80" required></label><p role="alert" hidden></p><div style="display:flex;gap:12px;flex-wrap:wrap"><button type="submit">Guardar movimiento</button><button type="button" data-cancel>Cancelar</button></div></form>';
  for (const element of dialog.querySelectorAll('input,select,button')) {
    element.style.cssText =
      'min-height:44px;padding:10px;border:1px solid #a8c9c0;border-radius:8px;font:inherit;max-width:100%;box-sizing:border-box';
  }
  for (const label of dialog.querySelectorAll('label')) {
    label.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin:12px 0';
  }
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  let currentId;
  function decorate() {
    for (const button of document.querySelectorAll(
      '[data-pc-action="delete-movement"],[data-mobile-action="delete-movement"]',
    )) {
      if (button.parentElement.querySelector('[data-edit-movement]')) continue;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = button.className;
      edit.textContent = '✎';
      edit.title = 'Editar movimiento';
      edit.setAttribute('aria-label', 'Editar movimiento');
      edit.dataset.editMovement = button.dataset.recordId;
      edit.style.minHeight = '44px';
      edit.style.minWidth = '44px';
      button.before(edit);
    }
  }
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-movement]');
    if (!button) return;
    const movement = window.Finanzas.state.movimientos.find(
      (m) => m.id === button.dataset.editMovement,
    );
    if (!movement) return;
    currentId = movement.id;
    for (const name of ['concepto', 'tipo', 'valor', 'fecha', 'categoria', 'cuenta']) {
      form.elements[name].value = movement[name] || (name === 'cuenta' ? 'Principal' : 'Otros');
    }
    dialog.querySelector('[role=alert]').hidden = true;
    dialog.showModal();
  });
  dialog.querySelector('[data-cancel]').onclick = () => {
    form.reset();
    dialog.close();
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    let result;
    try {
      result = await window.Finanzas.actualizarMovimiento(
        currentId,
        Object.fromEntries(new FormData(form)),
      );
    } catch (failure) {
      result = { error: failure.message || 'No se pudo guardar. Conserva el formulario.' };
    } finally {
      submit.disabled = false;
    }
    const error = dialog.querySelector('[role=alert]');
    error.textContent = result.error || '';
    error.hidden = !result.error;
    if (!result.error) {
      form.reset();
      dialog.close();
    }
  });
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
  decorate();
})();
