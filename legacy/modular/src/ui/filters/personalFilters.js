/**
 * ============================================================================
 * PERSONAL FILTERS
 * Responsabilidad: Filtros de la tabla de movimientos personales por texto, tipo,
 * categoría y rango de fechas.
 * ============================================================================
 */
(function () {
  'use strict';

  const personalFilters = {
    criterios: {
      texto: '',
      tipo: 'ALL',
      categoria: 'ALL',
      cuenta: 'ALL'
    },

    setFiltro(campo, valor) {
      this.criterios[campo] = valor;
    },

    aplicar(movimientos = []) {
      return (movimientos || []).filter(m => {
        if (this.criterios.tipo !== 'ALL' && m.tipo !== this.criterios.tipo) return false;
        if (this.criterios.categoria !== 'ALL' && m.categoria !== this.criterios.categoria) return false;
        if (this.criterios.cuenta !== 'ALL' && m.cuenta !== this.criterios.cuenta) return false;

        if (this.criterios.texto) {
          const q = this.criterios.texto.toLowerCase();
          const matchConcepto = (m.concepto || '').toLowerCase().includes(q);
          const matchCat = (m.categoria || '').toLowerCase().includes(q);
          if (!matchConcepto && !matchCat) return false;
        }

        return true;
      });
    }
  };

  window.PersonalFilters = personalFilters;
})();
