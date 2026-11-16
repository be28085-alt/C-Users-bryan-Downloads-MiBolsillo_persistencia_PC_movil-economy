/**
 * ============================================================================
 * PRODUCTION & RECIPES DOMAIN
 * Responsabilidad: Fabricación de lotes, descuento de materias primas e incremento
 * de productos terminados (Regla 6), y cálculo de costos de producción.
 * ============================================================================
 */
(function () {
  'use strict';

  const productionDomain = {
    /**
     * Procesa la fabricación de un lote a partir de una fórmula predefinida.
     * @param {string} negocioId - Negocio activo.
     * @param {Object} formula - Receta con lista de ingredientes.
     * @param {number} cantidadAFabricar - Unidades terminadas a producir.
     * @param {Array} productosActuales - Lista de productos para mutación in-memory.
     * @param {string} notas - Comentarios.
     * @returns {{produccion: Object, kardexEntries: Array, error: string|null}}
     */
    fabricarLote(negocioId, formula, cantidadAFabricar, productosActuales = [], notas = '') {
      const cantidad = Number(cantidadAFabricar) || 0;
      if (cantidad <= 0) {
        return { produccion: null, kardexEntries: [], error: 'La cantidad a producir debe ser mayor a cero.' };
      }

      const ratio = cantidad / (Number(formula.cantidadBase) || 1);
      const ingredientes = Array.isArray(formula.ingredientes) ? formula.ingredientes : [];
      const kardexEntries = [];

      // Validar existencias de todas las materias primas primero
      for (const ing of ingredientes) {
        const mp = (productosActuales || []).find(p => p.id === ing.materiaPrimaId && p.negocioId === negocioId);
        const requerida = (Number(ing.cantidadRequerida) || 0) * ratio;
        if (!mp) {
          return { produccion: null, kardexEntries: [], error: `Materia prima "${ing.materiaPrimaNombre}" no encontrada.` };
        }
        if (mp.stock < requerida) {
          return {
            produccion: null,
            kardexEntries: [],
            error: `Insumo insuficiente para fabricar: "${mp.nombre}". Se requieren ${requerida.toFixed(2)} ${mp.unidadMedida}, stock disponible: ${mp.stock}.`
          };
        }
      }

      let costoTotalProduccion = 0;

      // Descontar materias primas
      ingredientes.forEach(ing => {
        const mp = (productosActuales || []).find(p => p.id === ing.materiaPrimaId && p.negocioId === negocioId);
        const consumo = (Number(ing.cantidadRequerida) || 0) * ratio;
        const costoInsumo = consumo * (Number(mp.costoUnitario) || Number(mp.precioCompra) || 0);
        costoTotalProduccion += costoInsumo;

        const anterior = Number(mp.stock) || 0;
        mp.stock = Math.max(anterior - consumo, 0);

        kardexEntries.push({
          id: `mov-inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          negocioId,
          productoId: mp.id,
          productoNombre: mp.nombre,
          tipo: 'SALIDA',
          cantidad: consumo,
          stockAnterior: anterior,
          stockPosterior: mp.stock,
          motivo: `Consumo producción lote formula "${formula.nombre}"`,
          fecha: window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0]
        });
      });

      // Aumentar producto terminado
      const prodTerminado = (productosActuales || []).find(p => p.id === formula.productoId && p.negocioId === negocioId);
      const costoUnitarioCalculado = cantidad > 0 ? (costoTotalProduccion / cantidad) : 0;

      if (prodTerminado) {
        const anteriorPT = Number(prodTerminado.stock) || 0;
        prodTerminado.stock = anteriorPT + cantidad;
        prodTerminado.costoUnitario = Math.round(costoUnitarioCalculado);

        kardexEntries.push({
          id: `mov-inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          negocioId,
          productoId: prodTerminado.id,
          productoNombre: prodTerminado.nombre,
          tipo: 'PRODUCCION',
          cantidad,
          stockAnterior: anteriorPT,
          stockPosterior: prodTerminado.stock,
          motivo: `Ingreso lote fabricado (${cantidad} uds)`,
          fecha: window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0]
        });
      }

      const produccion = {
        id: `prod-lot-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        negocioId,
        formulaId: formula.id,
        formulaNombre: formula.nombre,
        productoId: formula.productoId,
        productoNombre: prodTerminado ? prodTerminado.nombre : formula.productoNombre,
        cantidadProducida: cantidad,
        costoTotal: costoTotalProduccion,
        costoUnitario: Math.round(costoUnitarioCalculado),
        fecha: window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Date().toISOString().split('T')[0],
        estado: 'COMPLETADA',
        notas: (notas || '').trim()
      };

      return {
        produccion,
        kardexEntries,
        error: null
      };
    }
  };

  window.BusinessProductionDomain = productionDomain;
})();
