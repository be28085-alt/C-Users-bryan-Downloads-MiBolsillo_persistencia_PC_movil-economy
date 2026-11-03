/**
 * ============================================================================
 * DATES MODULE
 * Responsabilidad: Parseo, formateo y cálculo de fechas locales, períodos y meses.
 * ============================================================================
 */
(function () {
  'use strict';

  const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const MESES_LARGOS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dates = {
    /**
     * Parsea una fecha en formato YYYY-MM-DD sin desajustes por zona horaria.
     * @param {string} fechaStr - Fecha ISO (YYYY-MM-DD).
     * @returns {Date|null} Objeto Date a medianoche local o null si es inválido.
     */
    parseFechaLocal(fechaStr) {
      if (!fechaStr || typeof fechaStr !== 'string') return null;
      const partes = fechaStr.trim().split('-');
      if (partes.length !== 3) return null;
      const anio = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1;
      const dia = parseInt(partes[2], 10);
      if (isNaN(anio) || isNaN(mes) || isNaN(dia)) return null;
      return new Date(anio, mes, dia, 0, 0, 0, 0);
    },

    /**
     * Extrae el año y mes en formato 'YYYY-MM' de un string de fecha.
     * @param {string} fechaStr - Fecha ISO.
     * @returns {string} 'YYYY-MM' o cadena vacía.
     */
    obtenerAnioMesDeFecha(fechaStr) {
      if (!fechaStr || typeof fechaStr !== 'string') return '';
      return fechaStr.substring(0, 7);
    },

    /**
     * Valida si un string corresponde a una fecha ISO válida (YYYY-MM-DD).
     * @param {string} fecha - Fecha a evaluar.
     * @returns {boolean} True si es válida.
     */
    esFechaISOValida(fecha) {
      if (!fecha || typeof fecha !== 'string') return false;
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(fecha)) return false;
      const d = this.parseFechaLocal(fecha);
      if (!d || isNaN(d.getTime())) return false;
      const [y, m, dia] = fecha.split('-').map(Number);
      return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === dia;
    },

    /**
     * Formatea una fecha para agrupaciones en listas (ej: "Hoy", "Ayer" o "15 Octubre").
     * @param {string} fechaStr - Fecha ISO.
     * @returns {string} Etiqueta amigable.
     */
    formatearGrupoFecha(fechaStr) {
      const fecha = this.parseFechaLocal(fechaStr);
      if (!fecha) return fechaStr || 'Sin fecha';

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);

      if (fecha.getTime() === hoy.getTime()) return 'Hoy';
      if (fecha.getTime() === ayer.getTime()) return 'Ayer';

      const dia = fecha.getDate();
      const mes = MESES_LARGOS[fecha.getMonth()];
      const anio = fecha.getFullYear();
      const anioActual = hoy.getFullYear();

      if (anio === anioActual) {
        return `${dia} de ${mes}`;
      }
      return `${dia} de ${mes} de ${anio}`;
    },

    /**
     * Obtiene el nombre corto de un mes por índice (0-11).
     * @param {number} mesIdx - Índice del mes (0 = Ene, 11 = Dic).
     * @returns {string} Nombre corto del mes.
     */
    obtenerMesCorto(mesIdx) {
      return MESES_CORTOS[mesIdx] || '';
    },

    /**
     * Obtiene el nombre completo de un mes por índice (0-11).
     * @param {number} mesIdx - Índice del mes.
     * @returns {string} Nombre largo del mes.
     */
    obtenerMesLargo(mesIdx) {
      return MESES_LARGOS[mesIdx] || '';
    },

    /**
     * Retorna la fecha actual del sistema en formato ISO (YYYY-MM-DD).
     * @returns {string} Fecha de hoy.
     */
    obtenerFechaHoyISO() {
      const hoy = new Date();
      const y = hoy.getFullYear();
      const m = String(hoy.getMonth() + 1).padStart(2, '0');
      const d = String(hoy.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  };

  // Exportar en namespaces compatibles y globales
  window.FinanzasDates = dates;
  window.parseFechaLocal = dates.parseFechaLocal.bind(dates);
  window.obtenerAnioMesDeFecha = dates.obtenerAnioMesDeFecha.bind(dates);
  window.esFechaISOValida = dates.esFechaISOValida.bind(dates);
  window.formatearGrupoFecha = dates.formatearGrupoFecha.bind(dates);
  window.obtenerMesCorto = dates.obtenerMesCorto.bind(dates);
  window.obtenerFechaHoyISO = dates.obtenerFechaHoyISO.bind(dates);

  /**
   * Construye series mensuales reales para los gráficos de PC y móvil.
   * Se expone globalmente porque los controladores clásicos no usan módulos ES.
   */
  window.obtenerHistorialMensualReal = function (movimientos) {
    const mesesMap = Object.create(null);
    (Array.isArray(movimientos) ? movimientos : []).forEach((movimiento) => {
      if (!movimiento || !movimiento.fecha) return;
      // obtenerAnioMesDeFecha devuelve YYYY-MM en este módulo; aceptar
      // también el objeto { anio, mes } usado por la versión clásica.
      const info = window.obtenerAnioMesDeFecha(movimiento.fecha);
      let anio;
      let mes;
      if (typeof info === 'string' && /^\d{4}-\d{2}$/.test(info)) {
        anio = Number(info.slice(0, 4));
        mes = Number(info.slice(5, 7)) - 1;
      } else if (info && typeof info === 'object') {
        anio = Number(info.anio);
        mes = Number(info.mes);
      }
      if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 0 || mes > 11) return;
      const clave = `${anio}-${String(mes + 1).padStart(2, '0')}`;
      if (!mesesMap[clave]) {
        mesesMap[clave] = { anio, mes, ingresos: 0, gastos: 0 };
      }
      const valor = Number(movimiento.valor);
      if (!Number.isFinite(valor) || valor < 0) return;
      if (movimiento.tipo === 'INGRESO') mesesMap[clave].ingresos += valor;
      else if (movimiento.tipo === 'GASTO') mesesMap[clave].gastos += valor;
    });

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const filas = Object.keys(mesesMap).sort().map((clave) => mesesMap[clave]);
    return {
      labels: filas.map((fila) => `${meses[fila.mes]} ${fila.anio}`),
      ingresos: filas.map((fila) => fila.ingresos),
      gastos: filas.map((fila) => fila.gastos),
      tieneDatos: filas.length > 0
    };
  };

})();
