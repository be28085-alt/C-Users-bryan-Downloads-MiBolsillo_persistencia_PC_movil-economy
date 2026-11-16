/**
 * ============================================================================
 * MODAL MANAGER
 * Responsabilidad: Control genérico de apertura, cierre, backdrop y teclado para modales.
 * ============================================================================
 */
(function () {
  'use strict';

  const modalManager = {
    initKeyboardTrap() {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeAll();
        }
      });
    },

    openModal(modalId) {
      const el = document.getElementById(modalId);
      if (!el) return;
      el.classList.remove('hidden');
      el.style.display = 'flex';
      const firstInput = el.querySelector('input:not([type="hidden"]), select, textarea');
      if (firstInput) setTimeout(() => firstInput.focus(), 50);
    },

    closeModal(modalId) {
      const el = document.getElementById(modalId);
      if (!el) return;
      el.classList.add('hidden');
      el.style.display = 'none';
    },

    closeAll() {
      document.querySelectorAll('.pc-modal-backdrop, .modal-backdrop').forEach(modal => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      });
    }
  };

  window.FinanzasModalManager = modalManager;
})();
