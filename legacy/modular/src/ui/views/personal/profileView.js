/**
 * ============================================================================
 * PERSONAL PROFILE VIEW
 * Responsabilidad: Renderizado del perfil de usuario, ajustes y acceso directo
 * al Módulo Empresarial desde "Mi Perfil".
 * ============================================================================
 */
(function () {
  'use strict';

  const profileView = {
    render(finanzas) {
      if (!finanzas) return;
      const u = finanzas.getUsuario();

      const elNombre = document.getElementById('inputPerfilNombre');
      const elEmail = document.getElementById('inputPerfilEmail');
      const checkPres = document.getElementById('checkAlertaPresupuesto');
      const checkDeudas = document.getElementById('checkAlertaDeudas');
      const saldoInit = document.getElementById('inputPerfilSaldoInicial');
      const bigName = document.getElementById('profileNameBig');
      const bigEmail = document.getElementById('profileEmailBig');
      const bigAvatar = document.getElementById('profileAvatarBig');

      if (elNombre) elNombre.value = u.nombre || '';
      if (elEmail) elEmail.value = u.email || '';
      if (checkPres) checkPres.checked = Boolean(u.alertasPresupuesto);
      if (checkDeudas) checkDeudas.checked = Boolean(u.recordatoriosDeudas);
      if (saldoInit) saldoInit.value = finanzas.state.saldoInicial || 0;
      if (bigName) bigName.textContent = u.nombre || 'Usuario';
      if (bigEmail) bigEmail.textContent = u.email || '';
      if (bigAvatar) bigAvatar.textContent = u.iniciales || 'US';

      const negActivo = finanzas.getNegocioActivo();
      if (negActivo) {
        const metricas = finanzas.calcularMetricasEmpresariales(negActivo.id, 'MES_ACTUAL');
        const lblNom = document.getElementById('lblProfileBizNombre');
        const lblVentas = document.getElementById('lblProfileBizVentas');
        const lblUtil = document.getElementById('lblProfileBizUtilidad');
        const lblCobrar = document.getElementById('lblProfileBizCobrar');

        if (lblNom) lblNom.textContent = negActivo.nombre;
        if (lblVentas) lblVentas.textContent = window.formatCOP(metricas.ventasTotales);
        if (lblUtil) lblUtil.textContent = window.formatCOP(metricas.utilidadNeta);
        if (lblCobrar) lblCobrar.textContent = window.formatCOP(metricas.cuentasPorCobrar);
      }
    }
  };

  window.PersonalProfileView = profileView;
})();
