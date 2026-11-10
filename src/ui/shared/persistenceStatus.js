(function () {
  'use strict';

  function init() {
    const storage = window.FinanzasStorage;
    const exports = window.FinanzasExportService;
    if (!storage || !exports) return;
    const panel = document.createElement('aside');
    panel.setAttribute('aria-label', 'Estado de guardado');
    panel.style.cssText = 'position:fixed;bottom:16px;left:12px;right:12px;z-index:100000;padding:16px;background:#fff3cd;color:#332701;border:2px solid #856404;border-radius:12px;box-shadow:0 4px 20px #0003;max-height:45vh;overflow:auto;font:16px/1.5 system-ui';
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    const retry = document.createElement('button');
    retry.textContent = 'Reintentar guardado';
    retry.onclick = () => storage.retryPendingSave();
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
      panel.hidden = status.ok;
      retry.hidden = status.status === 'conflict' || status.status === 'read-error';
      message.textContent = status.status === 'conflict'
        ? 'Hay cambios de otra pestaña. Los cambios de esta ventana no se han guardado. Descarga una copia antes de recargar y revisar ambas versiones.'
        : status.status === 'read-error'
          ? 'No se pudieron leer los datos guardados. Se bloqueó la escritura para protegerlos. Descarga lo visible antes de revisar el almacenamiento o recargar.'
          : 'Los cambios están solo en memoria y se perderán al cerrar. Libera espacio o habilita el almacenamiento y pulsa Reintentar guardado. No vuelvas a registrar la operación.';
    }
    window.addEventListener('mibolsillo:persistence', render);
    render();

    const exportButton = document.querySelector('button[onclick*="exportarJSON"]');
    if (exportButton) {
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
          const restored = exports.restaurarCopiaSeguridadJSON(content);
          window.alert(restored.error || 'Copia restaurada y guardada.');
        } catch (error) { window.alert('No se pudo leer la copia seleccionada.'); }
      };
      exportButton.after(restore, file);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
