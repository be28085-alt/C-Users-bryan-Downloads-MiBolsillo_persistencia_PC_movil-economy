/**
 * ============================================================================
 * USER DOMAIN
 * Responsabilidad: Perfil de usuario, preferencias de interfaz y privacidad.
 * ============================================================================
 */
(function () {
  'use strict';

  const userService = {
    actualizarUsuario(usuarioActual = {}, nuevosDatos = {}) {
      return {
        ...usuarioActual,
        ...nuevosDatos,
        nombre: (nuevosDatos.nombre || usuarioActual.nombre || 'Usuario').trim(),
        email: (nuevosDatos.email || usuarioActual.email || '').trim(),
        iniciales: window.obtenerIniciales ? window.obtenerIniciales(nuevosDatos.nombre || usuarioActual.nombre) : 'LM'
      };
    },

    toggleSaldoOculto(estadoActual = false) {
      return !estadoActual;
    }
  };

  window.FinanzasUserService = userService;
})();
