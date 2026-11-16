/**
 * ============================================================================
 * PERSONAL MODALS
 * Responsabilidad: Apertura, población de datos y cierre de modales de Finanzas Personales.
 * ============================================================================
 */
(function () {
  'use strict';

  const personalModals = {
    modalQuickType: 'GASTO',

    setModalQuickType(tipo) {
      this.modalQuickType = tipo;
      const btnG = document.getElementById('modalQuickTypeGasto');
      const btnI = document.getElementById('modalQuickTypeIngreso');
      if (btnG && btnI) {
        if (tipo === 'GASTO') {
          btnG.classList.add('active');
          btnI.classList.remove('active');
        } else {
          btnI.classList.add('active');
          btnG.classList.remove('active');
        }
      }
      this.poblarCategoriasModalQuick();
    },

    poblarCategoriasModalQuick() {
      const sel = document.getElementById('modalQuickCategoria');
      if (!sel) return;
      const cats = this.modalQuickType === 'GASTO' ? window.CATEGORIAS_GASTO : window.CATEGORIAS_INGRESO;
      sel.innerHTML = (cats || []).map(c => `<option value="${c.id}">${c.icon} ${c.nombre}</option>`).join('');
    },

    openModalNuevoMovimiento() {
      this.setModalQuickType('GASTO');
      const dateInput = document.getElementById('modalQuickFecha');
      if (dateInput && !dateInput.value) {
        dateInput.value = window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0];
      }
      window.FinanzasModalManager.openModal('modalPcNuevoMovimiento');
    },

    closeModalNuevoMovimiento() {
      window.FinanzasModalManager.closeModal('modalPcNuevoMovimiento');
    },

    openModalPresupuesto() {
      const p = window.Finanzas ? window.Finanzas.state.presupuestoMensual : 2300000;
      const input = document.getElementById('inputEditPresupuestoTotal');
      if (input) input.value = p;
      window.FinanzasModalManager.openModal('modalPcPresupuesto');
    },

    closeModalPresupuesto() {
      window.FinanzasModalManager.closeModal('modalPcPresupuesto');
    },

    openModalNuevaMeta() {
      window.FinanzasModalManager.openModal('modalPcNuevaMeta');
    },

    closeModalNuevaMeta() {
      window.FinanzasModalManager.closeModal('modalPcNuevaMeta');
    },

    openModalAbonarMeta(metaId) {
      const inputId = document.getElementById('modalAporteMetaId');
      const lblNombre = document.getElementById('modalAporteMetaNombre');
      if (inputId) inputId.value = metaId;
      if (lblNombre && window.Finanzas) {
        const meta = (window.Finanzas.state.metas || []).find(m => m.id === metaId);
        if (meta) lblNombre.textContent = meta.nombre;
      }
      window.FinanzasModalManager.openModal('modalPcAbonarMeta');
    },

    closeModalAbonarMeta() {
      window.FinanzasModalManager.closeModal('modalPcAbonarMeta');
    },

    openModalNuevaDeuda() {
      window.FinanzasModalManager.openModal('modalPcNuevaDeuda');
    },

    closeModalNuevaDeuda() {
      window.FinanzasModalManager.closeModal('modalPcNuevaDeuda');
    },

    openModalPagarDeuda(deudaId) {
      const inputId = document.getElementById('modalPagoDeudaId');
      const lblNombre = document.getElementById('modalPagoDeudaNombre');
      if (inputId) inputId.value = deudaId;
      if (lblNombre && window.Finanzas) {
        const d = (window.Finanzas.state.deudas || []).find(item => item.id === deudaId);
        if (d) lblNombre.textContent = `${d.concepto} (${d.acreedor})`;
      }
      window.FinanzasModalManager.openModal('modalPcPagarDeuda');
    },

    closeModalPagarDeuda() {
      window.FinanzasModalManager.closeModal('modalPcPagarDeuda');
    },

    openAcademicModal() {
      window.FinanzasModalManager.openModal('modalPcAcademic');
    },

    closeAcademicModal() {
      window.FinanzasModalManager.closeModal('modalPcAcademic');
    }
  };

  window.PersonalModals = personalModals;
})();
