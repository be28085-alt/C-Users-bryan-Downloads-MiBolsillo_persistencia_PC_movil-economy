/**
 * ============================================================================
 * BUSINESS FILTERS
 * Responsabilidad: Filtros de pestañas (Tabs) y búsqueda para Ventas, Compras,
 * Inventario, Productos y Proveedores en Gestión Empresarial.
 * ============================================================================
 */
(function () {
  'use strict';

  const businessFilters = {
    tabs: {
      ventas: 'ALL',       // 'ALL' | 'CONTADO' | 'CREDITO'
      compras: 'ALL',      // 'ALL' | 'PAGADA' | 'PENDIENTE'
      inventario: 'ALL',   // 'ALL' | 'PRODUCTO' | 'MATERIA_PRIMA' | 'ALERTA'
      productos: 'ALL'     // 'ALL' | categorías
    },

    busquedas: {
      ventas: '',
      compras: '',
      inventario: '',
      productos: '',
      proveedores: ''
    },

    setTab(seccion, tab) {
      this.tabs[seccion] = tab;
    },

    setBusqueda(seccion, query) {
      this.busquedas[seccion] = (query || '').trim().toLowerCase();
    },

    filtrarVentas(ventas = []) {
      const tab = this.tabs.ventas;
      const q = this.busquedas.ventas;

      return (ventas || []).filter(v => {
        if (tab === 'CONTADO' && v.tipoPago !== 'CONTADO') return false;
        if (tab === 'CREDITO' && v.tipoPago !== 'CREDITO') return false;
        if (q) {
          const matchCliente = (v.clienteNombre || '').toLowerCase().includes(q);
          const matchId = (v.id || '').toLowerCase().includes(q);
          if (!matchCliente && !matchId) return false;
        }
        return true;
      });
    },

    filtrarCompras(compras = []) {
      const tab = this.tabs.compras;
      const q = this.busquedas.compras;

      return (compras || []).filter(c => {
        if (tab === 'PAGADA' && (c.saldoPendiente || 0) > 0) return false;
        if (tab === 'PENDIENTE' && (c.saldoPendiente || 0) === 0) return false;
        if (q) {
          const matchProv = (c.proveedorNombre || '').toLowerCase().includes(q);
          const matchId = (c.id || '').toLowerCase().includes(q);
          if (!matchProv && !matchId) return false;
        }
        return true;
      });
    },

    filtrarInventario(productos = []) {
      const tab = this.tabs.inventario;
      const q = this.busquedas.inventario;

      return (productos || []).filter(p => {
        if (tab === 'PRODUCTO' && p.tipo !== 'PRODUCTO') return false;
        if (tab === 'MATERIA_PRIMA' && p.tipo !== 'MATERIA_PRIMA') return false;
        if (tab === 'ALERTA' && Number(p.stock) > Number(p.stockMinimo)) return false;
        if (q) {
          const matchNom = (p.nombre || '').toLowerCase().includes(q);
          const matchDesc = (p.descripcion || '').toLowerCase().includes(q);
          if (!matchNom && !matchDesc) return false;
        }
        return true;
      });
    }
  };

  window.BusinessFilters = businessFilters;
})();
