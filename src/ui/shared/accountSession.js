(function () {
  'use strict';
  const config = window.MiBolsilloSQLiteConfig;
  if (!config?.authenticated || !config.user?.id) return;
  let leaving = false;
  let sessionCheck = null;
  let protectedSnapshot = false;
  let channel;
  try { channel = new BroadcastChannel('mibolsillo-account-session-v1'); } catch (_) {}
  const target = document.getElementById('view-perfil');
  if (!target) return;
  const controls = document.createElement('section');
  controls.id = 'account-session-controls';
  controls.className = 'account-session-controls';
  controls.style.cssText = 'margin:16px 0;padding:20px;border:1px solid #cfe2dc;border-radius:16px;background:#fff;color:#0b3b3c;';
  const heading = document.createElement('h2');
  heading.textContent = 'Acceso a tu cuenta';
  heading.style.cssText = 'font:700 18px system-ui;margin:0 0 8px';
  const identity = document.createElement('p');
  identity.textContent = 'Sesión iniciada como ' + config.user.email;
  identity.style.cssText = 'overflow-wrap:anywhere;margin:0 0 14px';
  const button = document.createElement('button');
  button.type = 'button'; button.id = 'account-logout'; button.textContent = 'Cerrar sesión';
  button.style.cssText = 'min-height:48px;padding:12px 24px;background:#0b6358;color:white;border:0;border-radius:10px;font:600 15px system-ui;cursor:pointer';
  const notice = document.createElement('p');
  notice.id = 'account-logout-error'; notice.setAttribute('role', 'alert'); notice.hidden = true;
  notice.style.cssText = 'color:#a03b30;overflow-wrap:anywhere';
  controls.append(heading, identity, button, notice);
  target.append(controls);
  window.Finanzas?.subscribe(state => {
    config.user.nombre = state.usuario.nombre;
    config.user.email = state.usuario.email;
    identity.textContent = 'Sesión iniciada como ' + state.usuario.email;
  });
  function returnToAccess() {
    if (leaving) return;
    leaving = true;
    // Remove the private document and in-memory financial state in every tab.
    window.top.location.replace('/');
  }
  window.addEventListener('mibolsillo:session-expired', returnToAccess);
  function revealReadyDocument() {
    requestAnimationFrame(() => {
      if (!protectedSnapshot && !leaving) document.documentElement.classList.remove('account-loading');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', revealReadyDocument, { once: true });
  else revealReadyDocument();
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true; notice.hidden = true;
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-MiBolsillo-Token': config.token } });
      if (!response.ok && response.status !== 401) {
        let body; try { body = await response.json(); } catch (_) {}
        throw new Error(body?.error || 'No se pudo confirmar el cierre de sesión. Reintenta.');
      }
      try { channel?.postMessage({ type: 'signed-out' }); } catch (_) {}
      returnToAccess();
    } catch (error) {
      notice.textContent = error.message || 'No se pudo conectar. Tu sesión sigue abierta; reintenta.';
      notice.hidden = false; button.disabled = false;
    }
  });
  channel?.addEventListener('message', event => {
    if (event.data?.type === 'signed-out' || (event.data?.type === 'signed-in' && event.data.userId !== config.user.id)) returnToAccess();
  });
  async function validateSession(protect = false) {
    if (protect) {
      protectedSnapshot = true;
      document.documentElement.classList.add('account-loading');
    }
    if (leaving) return;
    if (!sessionCheck) sessionCheck = (async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (response.status === 401) return 'expired';
        if (!response.ok) return 'unavailable';
        return (await response.json()).user?.id === config.user.id ? 'valid' : 'expired';
      } catch (_) { return 'unavailable'; }
    })().finally(() => { sessionCheck = null; });
    const result = await sessionCheck;
    if (result === 'expired' || (result === 'unavailable' && protectedSnapshot)) returnToAccess();
    else if (result === 'valid') {
      protectedSnapshot = false;
      revealReadyDocument();
    }
    // A temporary network error on ordinary focus leaves unsaved recovery
    // options available. A restored private snapshot stays protected instead.
  }
  window.addEventListener('focus', () => validateSession());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') validateSession();
  });
  window.addEventListener('pagehide', event => {
    if (event.persisted) {
      protectedSnapshot = true;
      document.documentElement.classList.add('account-loading');
    }
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      leaving = false;
      validateSession(true);
    }
  });
})();
