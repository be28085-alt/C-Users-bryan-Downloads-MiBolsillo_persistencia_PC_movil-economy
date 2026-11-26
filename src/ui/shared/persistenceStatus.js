(function () {
  'use strict';

  function init() {
    const storage = window.FinanzasStorage;
    const exports = window.FinanzasExportService;
    if (!storage || !exports) return;
    const backend = storage.getBackendInfo();
    const panel = document.createElement('aside');
    panel.setAttribute('aria-label', 'Estado de guardado');
    const panelStyle = 'box-sizing:border-box;padding:16px;background:#fff3cd;color:#332701;border:2px solid #856404;border-radius:12px;overflow:auto;font:16px/1.5 system-ui;overflow-wrap:anywhere;';
    const floatingStyle = 'position:fixed;bottom:16px;left:12px;right:12px;z-index:100000;box-shadow:0 4px 20px #0003;max-height:45vh;';
    panel.style.cssText = panelStyle + floatingStyle;
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    const retry = document.createElement('button');
    retry.textContent = 'Reintentar guardado';
    retry.onclick = async () => { retry.disabled = true; try { await storage.retryPendingSave(); } finally { retry.disabled = false; } };
    const backup = document.createElement('button');
    backup.textContent = 'Descargar copia de lo visible';
    backup.onclick = () => exports.descargarCopiaSeguridadJSON(window.Finanzas.state);
    for (const button of [retry, backup]) {
      button.style.cssText = 'padding:10px;margin:4px;border:1px solid currentColor;border-radius:6px;background:white;color:#332701;cursor:pointer';
    }
    panel.append(message, retry, backup);
    document.body.appendChild(panel);
    function render() {
      const status = storage.getPersistenceStatus();
      panel.hidden = status.ok || status.status === 'saving';
      if (!status.ok && status.status !== 'saving') {
        const form = window.FinanzasForms?.getActiveForm() || document.activeElement?.closest?.('form');
        if (form && !storage.hasPendingChanges()) {
          // A fixed banner must never cover the modal's Save/Retry controls.
          form.insertBefore(panel, form.lastElementChild);
          panel.style.cssText = panelStyle + 'position:static;max-width:100%;margin:12px 0;';
        } else {
          document.body.appendChild(panel);
          panel.style.cssText = panelStyle + floatingStyle;
        }
      }
      retry.hidden = !storage.hasPendingChanges() || status.status === 'conflict' || status.status === 'read-error';
      message.textContent = status.message || (status.status === 'conflict'
        ? 'Hay cambios de otra pestaña. Los cambios de esta ventana no se han guardado. Descarga una copia antes de recargar y revisar ambas versiones.'
        : status.status === 'read-error'
          ? 'No se pudieron leer los datos guardados. Se bloqueó la escritura para protegerlos. Descarga lo visible antes de revisar el almacenamiento o recargar.'
        : !storage.hasPendingChanges()
            ? backend.mode === 'sqlite'
              ? 'No se confirmó el guardado en SQLite. Conserva el formulario, revisa el servidor y vuelve a pulsar Guardar cuando se restablezca la conexión.'
              : 'La operación no se guardó y no se aplicaron sus cambios. Libera espacio o habilita el almacenamiento y reintenta desde el formulario que quedó abierto.'
            : backend.mode === 'sqlite'
              ? 'No se confirmó el guardado en SQLite. Conserva una copia de lo visible y comprueba el servidor local. Los cambios pendientes pueden perderse al cerrar. No vuelvas a registrar la operación.'
              : 'Los cambios están solo en memoria y se perderán al cerrar. Libera espacio o habilita el almacenamiento y pulsa Reintentar guardado. No vuelvas a registrar la operación.');
    }
    window.addEventListener('mibolsillo:persistence', render);
    render();

    const exportButton = document.querySelector('button[onclick*="exportarJSON"]');
    if (exportButton) {
      const info = document.createElement('p');
      info.dataset.storageBackend = backend.mode;
      info.textContent = backend.mode === 'sqlite'
        ? 'Guardado en SQLite local · ' + backend.database
        : 'Guardado en este navegador · sin sincronización en la nube';
      info.style.cssText = 'font:14px/1.5 system-ui;overflow-wrap:anywhere;margin:12px 0';
      exportButton.before(info);
      const restore = document.createElement('button');
      restore.className = exportButton.className;
      restore.textContent = 'Restaurar copia JSON';
      restore.type = 'button';
      const file = document.createElement('input');
      file.type = 'file';
      file.accept = '.json,application/json';
      file.hidden = true;
      restore.onclick = () => file.click();
      file.onchange = async () => {
        const selected = file.files[0];
        file.value = '';
        if (!selected) return;
        if (selected.size > 10 * 1024 * 1024) { window.alert('La copia supera el límite de 10 MB.'); return; }
        try {
          const content = await selected.text();
          const result = exports.validarCopiaSeguridadJSON(content);
          if (result.error) { window.alert(result.error); return; }
          if (!window.confirm(`La copia contiene ${result.state.movimientos.length} movimientos y ${(result.state.ventas || []).length} ventas. Reemplazará los datos actuales. Se descargará antes una copia de los datos actuales. ¿Continuar?`)) return;
          exports.descargarCopiaSeguridadJSON(window.Finanzas.state);
          const restored = await exports.restaurarCopiaSeguridadJSON(content);
          window.alert(restored.error || 'Copia restaurada y guardada.');
        } catch (error) { window.alert('No se pudo leer la copia seleccionada.'); }
      };
      exportButton.after(restore, file);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
