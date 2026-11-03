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
      const encabezados = ['ID Factura', 'Fecha', 'Cliente', 'Tipo Pago', 'Método', 'Total COP', 'Saldo Pendiente COP', 'Estado'].map(escape).join(';');
      const filas = (ventas || []).map(v => [
        escape(v.id),
        escape(v.fecha),
        escape(v.clienteNombre),
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
