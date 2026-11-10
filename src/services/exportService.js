/**
 * ============================================================================
 * EXPORT SERVICE
 * Responsabilidad: Exportación de datos a formato CSV (con sanitización de fórmulas)
 * y generación/restauración de copias de seguridad en JSON.
 * ============================================================================
 */
(function () {
  'use strict';

  const exportService = {
    validarCopiaSeguridadJSON(contenido) {
      try {
        const parsed = JSON.parse(contenido);
        const state = parsed && parsed.data ? parsed.data : parsed;
        if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Formato de copia inválido.');
        const required = ['movimientos', 'metas', 'deudas', 'negocios', 'productos'];
        if (required.some(key => !Array.isArray(state[key]))) throw new Error('La copia no contiene las colecciones principales.');
        if (state.usuario && (typeof state.usuario !== 'object' || Array.isArray(state.usuario))) throw new Error('Perfil inválido.');
        const numeric = new Set(['valor', 'total', 'stock', 'precioVenta', 'costoUnitario', 'saldoPendiente', 'objetivo', 'ahorrado', 'montoObjetivo', 'montoActual', 'valorInicial', 'montoInicial', 'cuotaMensual']);
        function inspect(value, depth = 0) {
          if (depth > 30) throw new Error('La copia contiene demasiados niveles.');
          if (!value || typeof value !== 'object') return;
          for (const [key, item] of Object.entries(value)) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('La copia contiene campos no permitidos.');
            if (numeric.has(key) && (item === null || item === '' || !Number.isFinite(Number(item)) || Number(item) < 0)) throw new Error(`Importe inválido: ${key}.`);
            inspect(item, depth + 1);
          }
        }
        inspect(state);
        const collections = [...required, 'clientes', 'ventas', 'compras', 'pagosVenta', 'movimientosInventario', 'aportesMetas', 'abonosDeudas', 'gastosNegocio', 'ingresosNegocio', 'proveedores', 'empleados', 'cuentas'];
        for (const key of collections) {
          if (state[key] === undefined) continue;
          if (!Array.isArray(state[key])) throw new Error(`Colección inválida: ${key}.`);
          const ids = new Set();
          for (const item of state[key]) {
            if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error(`Registro o ID inválido en ${key}.`);
            ids.add(item.id);
          }
        }
        window.InvoiceSchema?.validateState(state);
        window.BusinessSchema?.validate(state);
        return { state, error: null };
      } catch (error) { return { state: null, error: error.message }; }
    },

    restaurarCopiaSeguridadJSON(contenido) {
      const result = this.validarCopiaSeguridadJSON(contenido);
      if (result.error) return result;
      const core = window.Finanzas;
      const storage = window.FinanzasStorage;
      let normalized;
      try { normalized = core.normalizeState(result.state); }
      catch (error) { return { error: 'Los datos de la copia no se pueden normalizar.' }; }
      if (!storage.saveState(normalized, { keepPending: false })) return { error: 'No se pudo guardar la restauración. Conserva la copia y resuelve el aviso de almacenamiento.' };
      core.state = normalized;
      core.notify();
      if (window.MiBolsilloStore) {
        window.MiBolsilloStore.state = normalized;
        window.MiBolsilloStore.notifyListeners();
      }
      return { state: normalized, error: null };
    },
    /**
     * Genera y descarga un archivo CSV en el navegador del usuario.
     * @param {string} nombreArchivo - Nombre sugerido del archivo.
     * @param {string} contenidoCSV - Contenido CSV ya codificado.
     */
    descargarCSV(nombreArchivo, contenidoCSV) {
      const blob = new Blob(['\uFEFF' + contenidoCSV], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);
    },

    /**
     * Exporta los movimientos personales a CSV con protección contra inyección.
     * @param {Array} movimientos - Lista de transacciones.
     */
    exportarMovimientosCSV(movimientos = []) {
      const escape = window.escaparCSV || (v => `"${String(v || '').replace(/"/g, '""')}"`);
      const encabezados = ['ID', 'Fecha', 'Tipo', 'Concepto', 'Categoría', 'Cuenta', 'Valor COP'].map(escape).join(';');
      const filas = (movimientos || []).map(m => [
        escape(m.id),
        escape(m.fecha),
        escape(m.tipo),
        escape(m.concepto),
        escape(m.categoria),
        escape(m.cuenta || 'Principal'),
        escape(m.valor)
      ].join(';'));

      const csv = [encabezados, ...filas].join('\r\n');
      const fechaHoy = window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : 'movimientos';
      this.descargarCSV(`movimientos_gestor_financiero_${fechaHoy}.csv`, csv);
    },

    /**
     * Exporta las ventas comerciales a CSV.
     * @param {Array} ventas - Lista de facturas de venta.
     */
    exportarVentasCSV(ventas = []) {
      const escape = window.escaparCSV || (v => `"${String(v || '').replace(/"/g, '""')}"`);
      const encabezados = ['No. Factura', 'Fecha', 'Cliente', 'Cédula', 'Tipo Pago', 'Método', 'Total COP', 'Saldo Pendiente COP', 'Estado'].map(escape).join(';');
      const filas = (ventas || []).map(v => [
        escape(v.numeroFactura || v.id),
        escape(v.fecha),
        escape(v.clienteNombre),
        escape(v.clienteCedula),
        escape(v.tipoPago),
        escape(v.metodoPago),
        escape(v.total),
        escape(v.saldoPendiente || 0),
        escape(v.estado)
      ].join(';'));

      const csv = [encabezados, ...filas].join('\r\n');
      const fechaHoy = window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : 'ventas';
      this.descargarCSV(`ventas_negocio_${fechaHoy}.csv`, csv);
    },

    /**
     * Exporta el estado completo en formato JSON para copia de seguridad.
     * @param {Object} state - Estado completo.
     */
    descargarCopiaSeguridadJSON(state) {
      const jsonStr = JSON.stringify(state, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_gestor_financiero_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  window.FinanzasExportService = exportService;
})();
