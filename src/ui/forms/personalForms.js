/**
 * ============================================================================
 * PERSONAL FORMS
 * Responsabilidad: Manejadores de eventos submit y validaciones para formularios
 * de Finanzas Personales.
 * ============================================================================
 */
(function () {
  'use strict';

  const personalForms = {
    handleQuickMovementSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const valor = document.getElementById('modalQuickValor').value;
      const concepto = document.getElementById('modalQuickConcepto').value;
      const categoria = document.getElementById('modalQuickCategoria').value;
      const cuenta = document.getElementById('modalQuickCuenta') ? document.getElementById('modalQuickCuenta').value : 'Principal';
      const fecha = document.getElementById('modalQuickFecha') ? document.getElementById('modalQuickFecha').value : '';
      const tipo = window.PersonalModals ? window.PersonalModals.modalQuickType : 'GASTO';

      if (!window.esMontoValido(valor)) {
        if (window.pcApp) window.pcApp.showToast('El importe debe ser un número mayor a cero.', 'danger');
        return;
      }

      window.Finanzas.agregarMovimiento({
        tipo,
        concepto,
        categoria,
        cuenta,
        valor: Number(valor),
        fecha
      });

      e.target.reset();
      window.PersonalModals.closeModalNuevoMovimiento();
      if (window.pcApp) {
        window.pcApp.renderAll();
        window.pcApp.showToast(`✓ Movimiento registrado: ${tipo === 'INGRESO' ? '+' : '-'}$${Number(valor).toLocaleString('es-CO')}`);
      }
    },

    handlePresupuestoSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const total = document.getElementById('inputEditPresupuestoTotal').value;
      if (total !== '' && !window.esMontoValido(total)) {
        if (window.pcApp) window.pcApp.showToast('El presupuesto debe ser un monto positivo.', 'danger');
        return;
      }

      window.Finanzas.actualizarPresupuesto(Number(total) || 0);
      window.PersonalModals.closeModalPresupuesto();
      if (window.pcApp) {
        window.pcApp.renderAll();
        window.pcApp.showToast('✓ Presupuesto mensual actualizado.');
      }
    },

    handleNuevaMetaSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const nombre = document.getElementById('inputMetaNombre').value;
      const objetivo = document.getElementById('inputMetaObjetivo').value;
      const actual = document.getElementById('inputMetaInicial').value;
      const limite = document.getElementById('inputMetaFecha').value;
      const color = document.getElementById('inputMetaColor') ? document.getElementById('inputMetaColor').value : '#10b981';
      const icono = document.getElementById('inputMetaIcono') ? document.getElementById('inputMetaIcono').value : '🎯';

      if (!window.esMontoValido(objetivo)) {
        if (window.pcApp) window.pcApp.showToast('El objetivo debe ser mayor a cero.', 'danger');
        return;
      }

      window.Finanzas.agregarMeta({
        nombre,
        montoObjetivo: Number(objetivo),
        montoActual: Number(actual) || 0,
        fechaLimite: limite,
        color,
        icono
      });

      e.target.reset();
      window.PersonalModals.closeModalNuevaMeta();
      if (window.pcApp) {
        window.pcApp.renderAll();
        window.pcApp.showToast('✓ Meta de ahorro creada.');
      }
    },

    handleAporteMetaSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const metaId = document.getElementById('modalAporteMetaId').value;
      const monto = document.getElementById('modalAporteMonto').value;
      const nota = document.getElementById('modalAporteNota').value;

      if (!window.esMontoValido(monto)) {
        if (window.pcApp) window.pcApp.showToast('El valor del aporte debe ser mayor a cero.', 'danger');
        return;
      }

      window.Finanzas.abonarAMeta(metaId, Number(monto), nota);
      e.target.reset();
      window.PersonalModals.closeModalAbonarMeta();
      if (window.pcApp) {
        window.pcApp.renderAll();
        window.pcApp.showToast('✓ Aporte registrado exitosamente.');
      }
    },

    handleNuevaDeudaSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const acreedor = document.getElementById('inputDeudaAcreedor').value;
      const concepto = document.getElementById('inputDeudaConcepto').value;
      const montoInicial = document.getElementById('inputDeudaMontoInicial').value;
      const saldo = document.getElementById('inputDeudaSaldo').value;
      const cuota = document.getElementById('inputDeudaCuota').value;
      const tasa = document.getElementById('inputDeudaTasa').value;
      const venc = document.getElementById('inputDeudaFechaVenc').value;
      const categoria = document.getElementById('inputDeudaCategoria').value;

      if (!window.esMontoValido(saldo || montoInicial)) {
        if (window.pcApp) window.pcApp.showToast('El saldo pendiente debe ser mayor a cero.', 'danger');
        return;
      }

      window.Finanzas.agregarDeuda({
        acreedor,
        concepto,
        montoInicial: Number(montoInicial) || Number(saldo),
        saldoPendiente: Number(saldo) || Number(montoInicial),
        cuotaMensual: Number(cuota) || 0,
        tasaInteres: Number(tasa) || 0,
        fechaVencimiento: venc,
        categoria
      });

      e.target.reset();
      window.PersonalModals.closeModalNuevaDeuda();
      if (window.pcApp) {
        window.pcApp.renderAll();
        window.pcApp.showToast('✓ Deuda registrada en el sistema.');
      }
    },

    handlePagoDeudaSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const deudaId = document.getElementById('modalPagoDeudaId').value;
      const monto = document.getElementById('modalPagoDeudaMonto').value;
      const metodo = document.getElementById('modalPagoDeudaMetodo').value;

      if (!window.esMontoValido(monto)) {
        if (window.pcApp) window.pcApp.showToast('El monto del pago debe ser mayor a cero.', 'danger');
        return;
      }

      window.Finanzas.pagarDeuda(deudaId, Number(monto), metodo);
      e.target.reset();
      window.PersonalModals.closeModalPagarDeuda();
      if (window.pcApp) {
        window.pcApp.renderAll();
        window.pcApp.showToast('✓ Pago de deuda abonado.');
      }
    },

    handlePerfilSubmit(e) {
      e.preventDefault();
      if (!window.Finanzas) return;

      const nombre = document.getElementById('inputPerfilNombre').value;
      const email = document.getElementById('inputPerfilEmail').value;
      const alertas = document.getElementById('checkAlertaPresupuesto') ? document.getElementById('checkAlertaPresupuesto').checked : true;
      const deudas = document.getElementById('checkAlertaDeudas') ? document.getElementById('checkAlertaDeudas').checked : true;

      window.Finanzas.actualizarUsuario({
        nombre,
        email,
        alertasPresupuesto: alertas,
        recordatoriosDeudas: deudas
      });

      if (window.pcApp) {
        window.pcApp.renderAll();
        window.pcApp.showToast('✓ Perfil de usuario actualizado.');
      }
    }
  };

  window.PersonalForms = personalForms;
})();
