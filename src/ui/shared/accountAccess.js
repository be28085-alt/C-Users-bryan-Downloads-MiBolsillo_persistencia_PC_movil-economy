(function () {
  'use strict';
  const host = document.getElementById('account-access');
  if (!host) return;
  const reauthentication = new URLSearchParams(location.search).get('reauth') === '1' && window.parent !== window;
  let mode = 'login';
  let busy = false;
  let activeUser = null;
  let channel;
  try { channel = new BroadcastChannel('mibolsillo-account-session-v1'); } catch (error) { channel = null; }
  host.innerHTML = `<section class="account-card" aria-labelledby="account-title">
    <div class="account-brand"><span aria-hidden="true">❖</span> MiBolsillo</div>
    <p class="account-tagline">Tus finanzas personales y tu negocio, en su lugar.</p>
    <h1 id="account-title">Iniciar sesión</h1>
    <form id="account-form">
      <label id="account-name-label" hidden>Nombre completo<input id="account-name" name="nombre" autocomplete="name" maxlength="100"></label>
      <label>Correo electrónico<input id="account-email" name="email" type="email" autocomplete="username" maxlength="254" required></label>
      <label>Contraseña<input id="account-password" name="password" type="password" autocomplete="current-password" maxlength="128" required></label>
      <label id="account-confirm-label" hidden>Confirmar contraseña<input id="account-confirm" name="confirm" type="password" autocomplete="new-password" maxlength="128"></label>
      <p class="account-error" id="account-error" role="alert" hidden></p>
      <button id="account-submit" class="account-primary" type="submit">Iniciar sesión</button>
    </form>
    <button id="account-toggle" class="account-link" type="button">Crear cuenta</button>
    <button id="account-retry" class="account-link" type="button" hidden>Reintentar conexión</button>
    <p class="account-note">Los datos se guardan en este dispositivo. No se sincronizan automáticamente entre equipos.</p>
  </section>`;
  const form = host.querySelector('#account-form');
  const field = name => host.querySelector('#account-' + name);
  const errorBox = field('error');
  const submit = field('submit');
  const toggle = field('toggle');
  const retry = field('retry');

  function message(text) {
    errorBox.textContent = text || '';
    errorBox.hidden = !text;
  }
  function pending(value) {
    busy = value;
    form.setAttribute('aria-busy', String(value));
    submit.disabled = toggle.disabled = retry.disabled = value;
    submit.textContent = value ? 'Espera un momento…' : mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión';
  }
  function showLogin(text) {
    activeUser = null;
    mode = 'login';
    field('title').textContent = 'Iniciar sesión';
    field('name-label').hidden = field('confirm-label').hidden = true;
    field('name').required = field('confirm').required = false;
    field('password').minLength = 1;
    field('password').autocomplete = 'current-password';
    toggle.textContent = 'Crear cuenta';
    window.MiBolsilloEntry?.close();
    const status = document.getElementById('entry-status');
    if (status) status.hidden = true;
    host.hidden = false;
    field('password').value = field('confirm').value = '';
    pending(false);
    message(text);
  }
  function openAccount(session) {
    if (reauthentication) {
      field('password').value = field('confirm').value = '';
      // El padre verifica la cuenta directamente con el servidor; no se envían tokens.
      window.parent.postMessage({ type: 'mibolsillo:reauthenticated' }, location.origin);
      return;
    }
    activeUser = session.user || null;
    field('password').value = field('confirm').value = '';
    host.hidden = true;
    message('');
    window.MiBolsilloEntry?.open(session);
  }
  async function responseJSON(response) {
    let body;
    try { body = await response.json(); } catch (_) { throw new Error('El servicio de cuentas no está disponible. Abre MiBolsillo desde su servidor local.'); }
    if (!response.ok) throw new Error(body.error || body.message || 'No se pudo completar la operación.');
    return body;
  }
  async function refreshSession() {
    if (busy) return;
    pending(true);
    retry.hidden = true;
    try {
      const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { showLogin(); return; }
      const session = await responseJSON(response);
      if (session.legacyMode === true || session.user?.id) openAccount(session);
      else throw new Error('El servicio no devolvió una sesión válida.');
    } catch (error) {
      showLogin(error.message || 'No se pudo conectar con el servidor.');
      retry.hidden = false;
    } finally { pending(false); }
  }
  toggle.addEventListener('click', () => {
    mode = mode === 'login' ? 'register' : 'login';
    const creating = mode === 'register';
    field('title').textContent = creating ? 'Crear cuenta' : 'Iniciar sesión';
    field('name-label').hidden = field('confirm-label').hidden = !creating;
    field('name').required = field('confirm').required = creating;
    field('password').minLength = creating ? 8 : 1;
    field('password').autocomplete = creating ? 'new-password' : 'current-password';
    field('password').value = field('confirm').value = '';
    toggle.textContent = creating ? 'Ya tengo cuenta: iniciar sesión' : 'Crear cuenta';
    pending(false);
    message('');
    (creating ? field('name') : field('email')).focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    if (mode === 'register' && field('password').value !== field('confirm').value) {
      message('Las contraseñas no coinciden.');
      field('confirm').focus();
      return;
    }
    const values = { email: field('email').value.trim(), password: field('password').value };
    if (mode === 'register') values.nombre = field('name').value.trim();
    pending(true);
    message('');
    try {
      const session = await responseJSON(await fetch('/api/auth/' + mode, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values)
      }));
      if (!session.user?.id) throw new Error('No se pudo confirmar la sesión.');
      if (!reauthentication) {
        try { channel?.postMessage({ type: 'signed-in', userId: session.user.id }); }
        catch (error) { message('La sesión se confirmó. Las otras pestañas se verificarán al volver a ellas.'); }
      }
      openAccount(session);
    } catch (error) { message(error.message || 'No se pudo acceder a la cuenta.'); }
    finally { pending(false); }
  });
  retry.addEventListener('click', refreshSession);
  channel?.addEventListener('message', event => {
    if (event.data?.type === 'signed-out' || (event.data?.type === 'signed-in' && activeUser && event.data.userId !== activeUser.id)) showLogin('La sesión cambió. Inicia sesión para continuar.');
  });
  window.MiBolsilloAccountAccess = Object.freeze({ showLogin, refreshSession });
  refreshSession();
})();
