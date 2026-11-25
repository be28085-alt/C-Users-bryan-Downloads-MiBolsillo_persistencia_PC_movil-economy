/* Runs before the financial scripts. Private pages require a server session. */
(function () {
  'use strict';
  // Domain-only tests do not have a browser transport or parser.
  if (typeof window.XMLHttpRequest !== 'function') return;
  function stop(message, redirect) {
    if (redirect) window.location.replace('/');
    window.stop();
    document.open();
    document.write('<!doctype html><html lang="es"><meta charset="utf-8"><title>MiBolsillo</title><body style="font:18px system-ui;padding:32px;color:#0b3b3c"><h1>MiBolsillo</h1><p>' + message + '</p><a href="/">Volver al acceso</a></body></html>');
    document.close();
  }
  try {
    const bootstrap = window.MiBolsilloSQLiteConfig;
    if (bootstrap?.authRequired === false) return;
    let session;
    if (bootstrap?.authenticated && bootstrap.user?.id) session = { user: bootstrap.user, csrfToken: bootstrap.token };
    else {
      // Compatibility for old static development fixtures. The SQLite-backed
      // application receives its verified session and cache in the HTML.
      const request = new window.XMLHttpRequest();
      request.open('GET', '/api/auth/session', false);
      request.send();
      if (request.status === 401) return stop('Inicia sesión para continuar.', true);
      if (request.status !== 200) return stop('Inicia MiBolsillo desde Qt o con npm start para utilizar el acceso y la base de datos.', false);
      session = JSON.parse(request.responseText);
    }
    if (session.legacyMode === true) return;
    if (!session.user?.id || !session.csrfToken) return stop('No se pudo validar la sesión.', true);
    window.MiBolsilloAccount = session.user;
    document.documentElement.classList.add('account-loading');
    const privacy = document.createElement('style');
    privacy.textContent = '.account-loading body{visibility:hidden!important}';
    document.head.append(privacy);
    window.MiBolsilloSQLiteRequired = true;
    window.MiBolsilloSQLiteConfig = { ...window.MiBolsilloSQLiteConfig,
      backend: 'sqlite', token: session.csrfToken, user: session.user,
      authenticated: true, authRequired: true, allowLegacyImport: false };
    // Complete blank fallback: a failed DB read can never display demo finances.
    const empty = { usuario: { ...session.user, nombre: session.user.nombre, moneda: 'COP' },
      saldoInicial: 0, presupuestoMensual: 0, limitesCategorias: {}, moduloActivo: 'PERSONAL',
      periodoAnio: new Date().getFullYear(), periodoMes: new Date().getMonth() };
    for (const key of ['movimientos','cuentas','metas','deudas','aportesMetas','abonosDeudas','negocios','productos','proveedores','clientes','ventas','compras','empleados','gastos','gastosNegocio','ingresosNegocio','pagosEmpleado','pagosVenta','pagosCompra','pagosGasto','movimientosInventario','formulas','producciones','devolucionesNegocio']) empty[key] = [];
    window.INITIAL_STATE = empty;
  } catch (error) { stop('No se pudo conectar con el acceso seguro. Conserva tus datos e inicia el servidor local.', false); }
})();
