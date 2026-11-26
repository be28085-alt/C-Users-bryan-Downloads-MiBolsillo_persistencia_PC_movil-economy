/* Clasificación común: los mensajes públicos no incluyen trazas ni SQL. */
(function () {
  'use strict';
  const messages = {
    connection: 'No se confirmó el guardado. Comprueba la conexión y conserva el formulario.',
    timeout: 'Se agotó el tiempo de espera. Conserva el formulario y reintenta.',
    session: 'Tu sesión venció. Inicia sesión con la misma cuenta para recuperar el formulario.',
    authorization: 'No tienes autorización para guardar. Conserva el formulario e inicia sesión de nuevo si es necesario.',
    conflict: 'Los datos cambiaron en otra operación. Revisa el estado confirmado antes de reintentar.',
    validation: 'Los datos fueron rechazados. Revisa los campos del formulario.',
    persistence: 'No se confirmó el guardado. Conserva el formulario y reintenta.',
    pending: 'La operación está pendiente de confirmación. Reintenta desde el mismo formulario.'
  };
  function create(code, { status, message, ambiguous = false } = {}) {
    const safe = typeof message === 'string' && message.length < 240 && !/[<>]|(?:SQLITE_|constraint|Error:|\bat \w+\.|[A-Z]:\\)/i.test(message);
    return Object.assign(new Error(safe ? message : messages[code] || messages.persistence), { code, status, ambiguous });
  }
  window.MiBolsilloErrors = Object.freeze({ create, messages });
})();
