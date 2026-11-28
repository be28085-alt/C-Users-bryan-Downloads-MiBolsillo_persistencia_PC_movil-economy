/**
 * Ciclo de sesión del documento privado y recuperación efímera del formulario.
 * El servidor vuelve a verificar la cuenta; el iframe nunca entrega tokens al padre.
 * Cerrar o recargar el documento descarta la recuperación mantenida solo en memoria.
 */
(function () {
  'use strict';
  const sessionConfig = window.MiBolsilloSQLiteConfig;
  if (!sessionConfig?.authenticated || !sessionConfig.user?.id) return;
  let leaving = false;
  let sessionCheck = null;
  let protectedSnapshot = false;
  let recoveryFrame = null;
  let recoveryTimer = null;
  let recoveryExpiresAt = 0;
  const SESSION_RECOVERY_TTL_MS = 15 * 60 * 1000;
  const SESSION_CHECK_TIMEOUT_MS = 8_000;
  let channel;
  try {
    channel = new BroadcastChannel('mibolsillo-account-session-v1');
  } catch {
    // El acceso sigue comprobándose con el servidor aunque el navegador no admita el canal.
    channel = null;
  }
  /**
   * Reutiliza solo el transporte: recuperación y validación interpretan cada estado
   * por separado. Un fallo temporal no equivale a una sesión de otra cuenta.
   * @returns {Promise<Response>} Respuesta sin consumir ni registrar credenciales.
   */
  function requestSession() {
    return fetch('/api/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(SESSION_CHECK_TIMEOUT_MS),
    });
  }

  function broadcastSession(event) {
    try {
      channel?.postMessage(event);
    } catch {
      console.warn(
        'No se pudo avisar a otras pestañas; se verificará la sesión al recuperar el foco.',
      );
    }
  }
  const target = document.getElementById('view-perfil');
  if (!target) return;
  const controls = document.createElement('section');
  controls.id = 'account-session-controls';
  controls.className = 'account-session-controls';
  controls.style.cssText =
    'margin:16px 0;padding:20px;border:1px solid #cfe2dc;border-radius:16px;background:#fff;color:#0b3b3c;';
  const heading = document.createElement('h2');
  heading.textContent = 'Acceso a tu cuenta';
  heading.style.cssText = 'font:700 18px system-ui;margin:0 0 8px';
  const identity = document.createElement('p');
  identity.textContent = 'Sesión iniciada como ' + sessionConfig.user.email;
  identity.style.cssText = 'overflow-wrap:anywhere;margin:0 0 14px';
  const logoutButton = document.createElement('button');
  logoutButton.type = 'button';
  logoutButton.id = 'account-logout';
  logoutButton.textContent = 'Cerrar sesión';
  logoutButton.style.cssText =
    'min-height:48px;padding:12px 24px;background:#0b6358;color:white;border:0;border-radius:10px;font:600 15px system-ui;cursor:pointer';
  const logoutNotice = document.createElement('p');
  logoutNotice.id = 'account-logout-error';
  logoutNotice.setAttribute('role', 'alert');
  logoutNotice.hidden = true;
  logoutNotice.style.cssText = 'color:#a03b30;overflow-wrap:anywhere';
  controls.append(heading, identity, logoutButton, logoutNotice);
  target.append(controls);
  window.Finanzas?.subscribe((state) => {
    sessionConfig.user.nombre = state.usuario.nombre;
    sessionConfig.user.email = state.usuario.email;
    identity.textContent = 'Sesión iniciada como ' + state.usuario.email;
  });
  function returnToAccess() {
    if (leaving) return;
    leaving = true;
    clearTimeout(recoveryTimer);
    // La navegación descarta el documento privado y su borrador en memoria.
    window.top.location.replace('/');
  }
  /**
   * Protege el documento privado y abre la pantalla existente de acceso.
   * @returns {void}
   * Solo conserva el borrador en RAM durante 15 minutos; no lo serializa a Web Storage.
   */
  function recoverSession() {
    if (leaving || recoveryFrame) return;
    if (protectedSnapshot) return returnToAccess();
    recoveryExpiresAt = Date.now() + SESSION_RECOVERY_TTL_MS;
    document.documentElement.classList.add('account-loading');
    document.body.inert = true;
    document.querySelectorAll('input[type="password"]').forEach((input) => {
      input.value = '';
    });
    recoveryFrame = document.createElement('iframe');
    recoveryFrame.id = 'account-reauthentication';
    recoveryFrame.title = 'Recuperar sesión';
    recoveryFrame.src = '/?reauth=1';
    recoveryFrame.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483647;background:white;';
    // Fuera del body protegido: se reutiliza íntegra la pantalla de acceso existente.
    document.documentElement.append(recoveryFrame);
    recoveryTimer = setTimeout(returnToAccess, SESSION_RECOVERY_TTL_MS);
  }
  /**
   * @returns {Promise<void>} Reanuda únicamente la misma cuenta comprobada por API.
   * Un error conserva el iframe y el plazo original; no extiende la vida del borrador.
   */
  async function resumeSession() {
    if (!recoveryFrame || leaving) return;
    if (Date.now() >= recoveryExpiresAt) return returnToAccess();
    try {
      const response = await requestSession();
      if (!response.ok) return;
      const session = await response.json();
      if (session.user?.id !== sessionConfig.user.id) {
        broadcastSession({ type: 'signed-in', userId: session.user?.id });
        return returnToAccess();
      }
      if (!session.csrfToken) return;
      sessionConfig.token = session.csrfToken;
      sessionConfig.user = session.user;
      clearTimeout(recoveryTimer);
      recoveryFrame.remove();
      recoveryFrame = null;
      recoveryExpiresAt = 0;
      document.body.inert = false;
      revealReadyDocument();
      window.dispatchEvent(new CustomEvent('mibolsillo:session-restored'));
    } catch {
      logoutNotice.textContent =
        'No se pudo verificar la sesión. Conserva esta pestaña y reintenta el acceso.';
      logoutNotice.hidden = false;
    }
  }
  window.addEventListener('message', (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== recoveryFrame?.contentWindow ||
      event.data?.type !== 'mibolsillo:reauthenticated'
    ) {
      return;
    }
    resumeSession();
  });
  window.addEventListener('mibolsillo:session-expired', recoverSession);
  window.MiBolsilloSessionRecovery = Object.freeze({
    discard: returnToAccess,
    inspect: () => ({ active: Boolean(recoveryFrame), expiresAt: recoveryExpiresAt }),
  });
  function revealReadyDocument() {
    requestAnimationFrame(() => {
      if (!protectedSnapshot && !leaving && !recoveryFrame) {
        document.documentElement.classList.remove('account-loading');
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', revealReadyDocument, { once: true });
  } else revealReadyDocument();
  logoutButton.addEventListener('click', async () => {
    if (logoutButton.disabled) return;
    logoutButton.disabled = true;
    logoutNotice.hidden = true;
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-MiBolsillo-Token': sessionConfig.token },
      });
      if (!response.ok && response.status !== 401) {
        throw window.MiBolsilloErrors.create('persistence', {
          message: 'No se pudo confirmar el cierre de sesión. Reintenta.',
        });
      }
      broadcastSession({ type: 'signed-out' });
      returnToAccess();
    } catch (error) {
      logoutNotice.textContent =
        error.message || 'No se pudo conectar. Tu sesión sigue abierta; reintenta.';
      logoutNotice.hidden = false;
      logoutButton.disabled = false;
    }
  });
  channel?.addEventListener('message', (event) => {
    if (
      event.data?.type === 'signed-out' ||
      (event.data?.type === 'signed-in' && event.data.userId !== sessionConfig.user.id)
    ) {
      returnToAccess();
    }
  });
  /**
   * @param {boolean} protectRestoredSnapshot Oculta una página restaurada de la caché.
   * @returns {Promise<void>} Verifica o conserva las opciones de recuperación existentes.
   * La página restaurada no se revela si la comprobación de sesión no es concluyente.
   */
  async function validateSession(protectRestoredSnapshot = false) {
    if (protectRestoredSnapshot) {
      protectedSnapshot = true;
      document.documentElement.classList.add('account-loading');
    }
    if (leaving) return;
    if (recoveryFrame) return resumeSession();
    if (!sessionCheck) {
      sessionCheck = (async () => {
        try {
          const response = await requestSession();
          if (response.status === 401) return 'expired';
          if (!response.ok) return 'unavailable';
          return (await response.json()).user?.id === sessionConfig.user.id ? 'valid' : 'expired';
        } catch {
          return 'unavailable';
        }
      })().finally(() => {
        sessionCheck = null;
      });
    }
    const result = await sessionCheck;
    if (result === 'expired') recoverSession();
    else if (result === 'unavailable' && protectedSnapshot) returnToAccess();
    else if (result === 'valid') {
      protectedSnapshot = false;
      revealReadyDocument();
    }
    // Un fallo temporal al recuperar foco conserva las opciones del formulario.
    // Una página privada restaurada permanece protegida hasta verificar su sesión.
  }
  window.addEventListener('focus', () => validateSession());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') validateSession();
  });
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) {
      protectedSnapshot = true;
      document.documentElement.classList.add('account-loading');
    }
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      leaving = false;
      validateSession(true);
    }
  });
})();
