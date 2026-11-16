/**
 * ============================================================================
 * SEARCH FILTER
 * Responsabilidad: Atajo global de búsqueda (Ctrl + K) y filtrado de texto genérico.
 * ============================================================================
 */
(function () {
  'use strict';

  const searchFilter = {
    initGlobalShortcut() {
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          const searchInput = document.getElementById('pcGlobalSearch');
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }
      });
    },

    filtrarTexto(lista = [], query = '', extractor = (item) => '') {
      if (!query || !query.trim()) return lista;
      const q = query.trim().toLowerCase();
      return (lista || []).filter(item => {
        const text = extractor(item) || '';
        return text.toLowerCase().includes(q);
      });
    }
  };

  window.FinanzasSearchFilter = searchFilter;
})();
