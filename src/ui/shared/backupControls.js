/* Local account backups. The server owns validation, snapshots and COMMIT. */
(function () {
  'use strict';
  function init() {
    const config = window.MiBolsilloSQLiteConfig;
    const host = document.getElementById?.('view-perfil');
    if (!config?.authenticated || !config.user?.id || !host || host.querySelector('#backup-controls')) return;
    const card = document.createElement('section');
    card.id = 'backup-controls'; card.className = 'backup-controls';
    card.setAttribute('aria-labelledby', 'backup-title');
    card.innerHTML = `<h2 id="backup-title">Respaldos</h2>
      <p class="backup-description">Copias locales de tus datos confirmados. Respaldo automático cada 24 horas mientras el servidor esté abierto.</p>
      <div class="backup-actions"><button type="button" data-backup="create">Crear respaldo</button><button type="button" data-backup="refresh">Actualizar lista</button></div>
      <label class="backup-label" for="backup-select">Tus copias guardadas</label>
      <select id="backup-select" aria-label="Seleccionar respaldo"></select>
      <div class="backup-actions"><button type="button" data-backup="download">Descargar copia</button><button type="button" data-backup="restore">Restaurar copia</button><button type="button" data-backup="file">Restaurar archivo JSON</button></div>
      <input type="file" id="backup-file" accept=".json,application/json" hidden>
      <p class="backup-notice" role="status" aria-live="polite"></p>
      <p class="backup-description">Descarga una copia y guárdala en otro disco o memoria USB para protegerte de la pérdida del equipo. No se envían datos a servicios externos.</p>`;
    host.appendChild(card);
    const select = card.querySelector('select'), file = card.querySelector('input'), notice = card.querySelector('.backup-notice');
    const buttons = [...card.querySelectorAll('button')];
    let busy = false, rows = [];
    const reason = { periodic: 'Automático', manual: 'Manual', 'before-restore': 'Antes de restaurar' };
    const date = value => new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
    function message(value, error = false) { notice.textContent = value; notice.classList.toggle('backup-error', error); }
    function pending(value) { busy = value; card.setAttribute('aria-busy', String(value)); buttons.forEach(button => { button.disabled = value; }); select.disabled = value || !rows.length; }
    async function request(url, options = {}) {
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options,
        headers: { 'Content-Type': 'application/json', 'X-MiBolsillo-Token': config.token, ...options.headers } });
      let body;
      try { body = await response.json(); } catch (_) { throw new Error('No se pudo leer la respuesta del servidor. Conserva tu copia y vuelve a intentarlo.'); }
      if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
      return body;
    }
    function assertReady() {
      const storage = window.FinanzasStorage;
      if (storage?.hasPendingChanges() || storage?.getPersistenceStatus().status === 'saving') throw new Error('Primero termina o recupera los cambios pendientes antes de usar los respaldos.');
    }
    async function refresh() {
      const data = await request('/api/backups');
      rows = data.backups || [];
      select.replaceChildren();
      for (const row of rows) {
        const option = document.createElement('option'); option.value = row.id;
        option.textContent = `${date(row.createdAt)} · ${reason[row.reason] || 'Respaldo'}`;
        select.appendChild(option);
      }
      if (!rows.length) { const option = document.createElement('option'); option.textContent = 'Todavía no hay copias de tu cuenta'; select.appendChild(option); }
      select.disabled = !rows.length;
      if (data.automaticError) message(data.automaticError, true);
    }
    async function restore(backup, selected) {
      assertReady();
      const current = await request('/api/storage');
      const label = backup ? 'el archivo seleccionado' : `la copia del ${date(selected.createdAt)}`;
      if (!window.confirm(`¿Restaurar ${label}? Reemplazará tus datos financieros actuales. Se creará antes una copia de seguridad para poder volver atrás. Tu cuenta y contraseña se conservarán.`)) return false;
      await request('/api/backups/restore', { method: 'POST', body: JSON.stringify({ ...(backup ? { backup } : { id: selected.id }), expectedRevision: current.revision, confirm: true }) });
      message('Restauración confirmada. Abriendo tus datos restaurados…');
      // Never publish a success or replace the current document before COMMIT.
      window.location.reload();
      return true;
    }
    card.addEventListener('click', async event => {
      const button = event.target.closest('[data-backup]');
      if (!button || busy) return;
      if (button.dataset.backup === 'file') { file.click(); return; }
      pending(true); message('');
      try {
        const action = button.dataset.backup;
        if (action === 'create') { assertReady(); await request('/api/backups', { method: 'POST' }); await refresh(); message('Respaldo local creado.'); }
        else if (action === 'refresh') await refresh();
        else {
          const selected = rows.find(row => row.id === select.value);
          if (!selected) throw new Error('Primero crea o selecciona un respaldo.');
          if (action === 'restore') await restore(null, selected);
          if (action === 'download') {
            const backup = await request('/api/backups/' + encodeURIComponent(selected.id));
            const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
            const url = URL.createObjectURL(blob), link = document.createElement('a');
            link.href = url; link.download = 'mibolsillo-respaldo-' + selected.id + '.json'; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            message('Copia descargada. Guarda el archivo en un lugar seguro.');
          }
        }
      } catch (error) { message(error.message || 'No se pudo completar el respaldo. Tus datos actuales se conservan.', true); }
      finally { pending(false); }
    });
    file.addEventListener('change', async () => {
      const selected = file.files?.[0]; file.value = '';
      if (!selected || busy) return;
      pending(true); message('');
      try {
        if (selected.size > 15 * 1024 * 1024) throw new Error('El archivo supera el límite de 15 MB. Conserva el archivo y consulta la restauración local documentada.');
        let backup; try { backup = JSON.parse(await selected.text()); } catch (_) { throw new Error('El archivo no contiene JSON válido.'); }
        await restore(backup);
      } catch (error) { message(error.message || 'No se pudo restaurar la copia. Tus datos actuales se conservan.', true); }
      finally { pending(false); }
    });
    pending(true);
    refresh().catch(error => message(error.message, true)).finally(() => pending(false));
  }
  if (typeof document.getElementById !== 'function') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
