/**
 * ============================================================================
 * PROYECTO: MiBolsillo · Tu dinero, a tu ritmo
 * ARCHIVO: shared.js
 * ROL: Núcleo de Datos Compartido, Fórmulas Matemáticas y Persistencia Común
 * ASIGNATURA: Fundamentos de Programación / Algoritmos - Semestre I
 * ============================================================================
 * Este archivo centraliza el estado de la aplicación, garantizando que tanto
 * la Versión PC (desktop.html) como la Versión Móvil (mobile.html) compartan
 * los mismos datos en tiempo real mediante localStorage y eventos sincronizados.
 *
 * FÓRMULAS CONTABLES:
 *   - Flujo del período   = Σ ingresos(período) − Σ gastos(período)
 *   - Saldo disponible    = saldoInicial + Σ ingresos(global) − Σ gastos(global)
 *   - Tasa de ahorro (%)  = (Ahorro acumulado en metas / Ingresos totales) × 100
 *     → Se muestra 0 % si no hay ingresos. Puede superar 100 % si las
 *       aportaciones a metas superan los ingresos registrados.
 *   - Avance de meta (%)  = min(ahorrado / objetivo, 100 %)  (solo visual)
 */

const STORAGE_KEY = 'FINANZAS_ETAPA_DATA_V2';
const STORAGE_VERSION = 3;
const SESSION_STORAGE_KEY = `${STORAGE_KEY}_SESSION_FALLBACK`;
const MEMORY_STORAGE_KEY = `${STORAGE_KEY}_MEMORY_FALLBACK`;
const MEMORY_STORE = Object.create(null);

function getStorageHandlers() {
  const handlers = {
    local: null,
    session: null,
    memory: { store: MEMORY_STORE }
  };

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      handlers.local = window.localStorage;
    }
  } catch (e) {
    handlers.local = null;
  }

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      handlers.session = window.sessionStorage;
    }
  } catch (e) {
    handlers.session = null;
  }

  return handlers;
}

function safePersistRaw(key, value) {
  const handlers = getStorageHandlers();
  const payload = JSON.stringify(value);
  let local = false;
  let session = false;

  try {
    if (handlers.local) {
      handlers.local.setItem(key, payload);
      local = true;
    }
  } catch (e) {
    console.warn('No fue posible guardar en localStorage:', e);
  }

  // sessionStorage solo es respaldo: no ofrece persistencia tras cerrar la sesión.
  if (!local) {
    try {
      if (handlers.session) {
        handlers.session.setItem(key, payload);
        session = true;
      }
    } catch (e) {
      console.warn('No fue posible guardar en sessionStorage:', e);
    }
  }

  handlers.memory.store[key] = payload;
  return { local, session, memory: true };
}

function safeReadRaw(key) {
  const handlers = getStorageHandlers();

  try {
    if (handlers.local && handlers.local.getItem(key) !== null) {
      return handlers.local.getItem(key);
    }
  } catch (e) {
    // no-op
  }

  try {
    if (handlers.session && handlers.session.getItem(key) !== null) {
      return handlers.session.getItem(key);
    }
  } catch (e) {
    // no-op
  }

  if (handlers.memory.store[key]) {
    return handlers.memory.store[key];
  }

  return null;
}

function cloneStateShape() {
  return JSON.parse(JSON.stringify(INITIAL_STATE));
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeString(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }
  return value.trim() || fallback;
}

function createEntityId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeMetaRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nombre = safeString(raw.nombre, 'Meta sin nombre');
  const objetivo = safeNumber(raw.objetivo, 0);
  if (!Number.isFinite(objetivo) || objetivo <= 0) return null;
  const ahorrado = Math.max(0, safeNumber(raw.ahorrado, 0));
  return {
    id: raw.id || createEntityId('meta'),
    nombre,
    plazo: safeString(raw.plazo, 'Sin fecha'),
    objetivo,
    ahorrado,
    categoria: safeString(raw.categoria, 'General')
  };
}

function normalizeDebtRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nombre = safeString(raw.nombre, 'Deuda sin nombre');
  const valorInicial = safeNumber(raw.valorInicial, 0);
  if (!Number.isFinite(valorInicial) || valorInicial <= 0) return null;
  const saldoPendiente = Math.max(0, Math.min(valorInicial, safeNumber(raw.saldoPendiente, valorInicial)));
  return {
    id: raw.id || createEntityId('deuda'),
    nombre,
    condiciones: safeString(raw.condiciones, 'Acuerdo de pago'),
    valorInicial,
    saldoPendiente,
    proximoPago: safeString(raw.proximoPago, 'Próximo mes'),
    cuotaMensual: Math.max(0, safeNumber(raw.cuotaMensual, 0))
  };
}

function normalizeAporteMetaRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const valor = safeNumber(raw.valor, 0);
  if (valor <= 0) return null;
  return {
    id: raw.id || createEntityId('ap'),
    metaId: safeString(raw.metaId, 'meta-general'),
    metaNombre: safeString(raw.metaNombre, 'Meta sin nombre'),
    valor,
    fecha: safeString(raw.fecha, obtenerFechaHoyISO())
  };
}

function normalizeAbonoDeudaRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const valor = safeNumber(raw.valor, 0);
  if (valor <= 0) return null;
  return {
    id: raw.id || createEntityId('ab'),
    deudaId: safeString(raw.deudaId, 'deuda-general'),
    deudaNombre: safeString(raw.deudaNombre, 'Deuda sin nombre'),
    valor,
    fecha: safeString(raw.fecha, obtenerFechaHoyISO())
  };
}

// Categorías de Gastos e Ingresos
const CATEGORIAS_GASTO = [
  { id: 'Alimentación', nombre: 'Alimentación', icon: '🛒', color: '#10b981' },
  { id: 'Transporte', nombre: 'Transporte', icon: '🚌', color: '#06b6d4' },
  { id: 'Ocio', nombre: 'Ocio', icon: '☕', color: '#f59e0b' },
  { id: 'Vivienda', nombre: 'Vivienda', icon: '🏠', color: '#6366f1' },
  { id: 'Sanidad', nombre: 'Sanidad', icon: '⚕️', color: '#ec4899' },
  { id: 'Otros', nombre: 'Otros', icon: '···', color: '#8b5cf6' }
];

const CATEGORIAS_INGRESO = [
  { id: 'Salario', nombre: 'Salario', icon: '💼', color: '#10b981' },
  { id: 'Ventas', nombre: 'Ventas', icon: '🏷️', color: '#06b6d4' },
  { id: 'Freelance', nombre: 'Freelance', icon: '💻', color: '#3b82f6' },
  { id: 'Inversiones', nombre: 'Inversión', icon: '📈', color: '#8b5cf6' },
  { id: 'Mesada', nombre: 'Apoyo', icon: '🤝', color: '#f59e0b' },
  { id: 'Otros', nombre: 'Otros', icon: '✨', color: '#14b8a6' }
];

// Estado Inicial de Referencia (Pesos Colombianos - COP)
const INITIAL_STATE = {
  usuario: {
    nombre: 'Lucía Martín',
    email: 'lucia.martin@email.com',
    iniciales: 'LM',
    moneda: 'COP',
    alertasPresupuesto: true,
    recordatoriosDeudas: true,
    notificacionesEmail: true,
    temaOscuro: false
  },
  saldoOculto: false,

  // Saldo inicial explícito: capital de partida antes de cualquier movimiento.
  // Configurable por el usuario. Si no se define, se asume 0.
  saldoInicial: 0,

  // Período seleccionado (año y mes, base 0-11)
  periodoAnio: new Date().getFullYear(),
  periodoMes: new Date().getMonth(),

  presupuestoMensual: 2300000,

  // Presupuesto por Categoría
  limitesCategorias: {
    'Vivienda': 900000,
    'Alimentación': 500000,
    'Transporte': 250000,
    'Ocio': 200000,
    'Sanidad': 250000,
    'Otros': 200000
  },

  // Colección de Movimientos (Ingresos y Gastos)
  movimientos: [
    {
      id: 'tx-1',
      tipo: 'GASTO',
      concepto: 'Mercadona',
      categoria: 'Alimentación',
      cuenta: 'Principal',
      valor: 42800,
      fecha: '2026-10-15',
      grupoFecha: 'HOY, 15 OCTUBRE'
    },
    {
      id: 'tx-2',
      tipo: 'GASTO',
      concepto: 'Café de la esquina',
      categoria: 'Ocio',
      cuenta: 'Principal',
      valor: 4200,
      fecha: '2026-10-15',
      grupoFecha: 'HOY, 15 OCTUBRE'
    },
    {
      id: 'tx-3',
      tipo: 'GASTO',
      concepto: 'Abono tarjeta transporte',
      categoria: 'Transporte',
      cuenta: 'Principal',
      valor: 55000,
      fecha: '2026-10-14',
      grupoFecha: 'AYER, 14 OCTUBRE'
    },
    {
      id: 'tx-4',
      tipo: 'INGRESO',
      concepto: 'Nómina mensual',
      categoria: 'Salario',
      cuenta: 'Principal',
      valor: 2800000,
      fecha: '2026-10-01',
      grupoFecha: '1 OCTUBRE'
    },
    {
      id: 'tx-5',
      tipo: 'INGRESO',
      concepto: 'Consultoría externa freelance',
      categoria: 'Freelance',
      cuenta: 'Principal',
      valor: 400000,
      fecha: '2026-10-02',
      grupoFecha: '2 OCTUBRE'
    },
    {
      id: 'tx-6',
      tipo: 'GASTO',
      concepto: 'Alquiler apartamento',
      categoria: 'Vivienda',
      cuenta: 'Principal',
      valor: 890000,
      fecha: '2026-10-01',
      grupoFecha: '1 OCTUBRE'
    },
    {
      id: 'tx-7',
      tipo: 'GASTO',
      concepto: 'Mercado quincenal',
      categoria: 'Alimentación',
      cuenta: 'Principal',
      valor: 377700,
      fecha: '2026-10-04',
      grupoFecha: '4 OCTUBRE'
    },
    {
      id: 'tx-8',
      tipo: 'GASTO',
      concepto: 'Servicios de Internet y Luz',
      categoria: 'Vivienda',
      cuenta: 'Principal',
      valor: 140000,
      fecha: '2026-10-06',
      grupoFecha: '6 OCTUBRE'
    },
    {
      id: 'tx-9',
      tipo: 'GASTO',
      concepto: 'Transporte masivo',
      categoria: 'Transporte',
      cuenta: 'Principal',
      valor: 125000,
      fecha: '2026-10-08',
      grupoFecha: '8 OCTUBRE'
    },
    {
      id: 'tx-10',
      tipo: 'GASTO',
      concepto: 'Cena y cine',
      categoria: 'Ocio',
      cuenta: 'Principal',
      valor: 95800,
      fecha: '2026-10-10',
      grupoFecha: '10 OCTUBRE'
    },
    {
      id: 'tx-11',
      tipo: 'GASTO',
      concepto: 'Farmacia y vitaminas',
      categoria: 'Sanidad',
      cuenta: 'Principal',
      valor: 80000,
      fecha: '2026-10-11',
      grupoFecha: '11 OCTUBRE'
    },
    {
      id: 'tx-12',
      tipo: 'GASTO',
      concepto: 'Suscripción nube y varios',
      categoria: 'Otros',
      cuenta: 'Principal',
      valor: 30000,
      fecha: '2026-10-12',
      grupoFecha: '12 OCTUBRE'
    }
  ],

  // Metas de Ahorro
  metas: [
    {
      id: 'meta-1',
      nombre: 'Fondo de tranquilidad',
      plazo: 'Para abril de 2027',
      objetivo: 2500000,
      ahorrado: 1800000,
      categoria: 'Seguridad'
    },
    {
      id: 'meta-2',
      nombre: 'Escapada a Portugal',
      plazo: 'Para verano de 2027',
      objetivo: 1200000,
      ahorrado: 650000,
      categoria: 'Viajes'
    },
    {
      id: 'meta-3',
      nombre: 'Curso de fotografía',
      plazo: 'Para dic. de 2027',
      objetivo: 1000000,
      ahorrado: 300000,
      categoria: 'Educación'
    }
  ],

  // Historial de Aportes a Metas
  aportesMetas: [
    { id: 'ap-1', metaId: 'meta-1', metaNombre: 'Fondo de tranquilidad', valor: 300000, fecha: '2026-10-12' },
    { id: 'ap-2', metaId: 'meta-2', metaNombre: 'Escapada a Portugal', valor: 200000, fecha: '2026-10-05' },
    { id: 'ap-3', metaId: 'meta-3', metaNombre: 'Curso de fotografía', valor: 100000, fecha: '2026-10-02' },
    { id: 'ap-4', metaId: 'meta-1', metaNombre: 'Fondo de tranquilidad', valor: 1500000, fecha: '2026-09-12' },
    { id: 'ap-5', metaId: 'meta-2', metaNombre: 'Escapada a Portugal', valor: 450000, fecha: '2026-09-05' },
    { id: 'ap-6', metaId: 'meta-3', metaNombre: 'Curso de fotografía', valor: 200000, fecha: '2026-09-02' }
  ],

  // Deudas y Pasivos
  deudas: [
    {
      id: 'deuda-1',
      nombre: 'Portátil',
      condiciones: 'Financiación sin intereses · 0% TIN',
      valorInicial: 1440000,
      saldoPendiente: 960000,
      proximoPago: '1 nov 2026',
      cuotaMensual: 80000
    },
    {
      id: 'deuda-2',
      nombre: 'Tratamiento dental',
      condiciones: 'Pago a plazos · 5% TIN',
      valorInicial: 600000,
      saldoPendiente: 300000,
      proximoPago: '20 oct 2026',
      cuotaMensual: 75000
    }
  ],

  // Historial de Abonos a Deudas
  abonosDeudas: [
    { id: 'ab-1', deudaId: 'deuda-1', deudaNombre: 'Portátil', valor: 80000, fecha: '2026-10-01' },
    { id: 'ab-2', deudaId: 'deuda-2', deudaNombre: 'Tratamiento dental', valor: 75000, fecha: '2026-09-20' },
    { id: 'ab-3', deudaId: 'deuda-1', deudaNombre: 'Portátil', valor: 40000, fecha: '2026-09-01' },
    { id: 'ab-4', deudaId: 'deuda-1', deudaNombre: 'Portátil', valor: 360000, fecha: '2026-08-01' },
    { id: 'ab-5', deudaId: 'deuda-2', deudaNombre: 'Tratamiento dental', valor: 225000, fecha: '2026-08-20' }
  ]
};

// ============================================================================
// UTILIDAD: Escape seguro para HTML (prevención de inyección XSS)
// ============================================================================
function escapeHTML(str) {
  if (typeof str !== 'string') return String(str ?? '');
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeHTMLAttribute(value) {
  return escapeHTML(String(value ?? ''))
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// UTILIDAD: Parsear fecha sin problemas de zona horaria
// ============================================================================
function parseFechaLocal(fechaStr) {
  if (!esFechaISOValida(fechaStr)) return null;
  // Formato esperado: YYYY-MM-DD. Creamos la fecha como mediodía local
  // para evitar desfase de zona horaria.
  const parts = fechaStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const fecha = new Date(y, m, d, 12, 0, 0);
  if (y >= 0 && y < 100) fecha.setFullYear(y);
  return fecha;
}

// ============================================================================
// UTILIDAD: Obtener año y mes de una fecha string YYYY-MM-DD
// ============================================================================
function obtenerAnioMesDeFecha(fechaStr) {
  const f = parseFechaLocal(fechaStr);
  if (!f) return null;
  return { anio: f.getFullYear(), mes: f.getMonth() };
}

function obtenerCategoriasPorTipo(tipo) {
  const normalizado = tipo === 'INGRESO' ? 'INGRESO' : 'GASTO';
  return normalizado === 'INGRESO'
    ? CATEGORIAS_INGRESO.map(c => c.id)
    : CATEGORIAS_GASTO.map(c => c.id);
}

function normalizarCategoriaParaTipo(tipo, categoria) {
  const categorias = obtenerCategoriasPorTipo(tipo);
  if (typeof categoria !== 'string') return categorias[0] || 'Otros';

  const texto = categoria.trim();
  if (!texto) return categorias[0] || 'Otros';

  const match = categorias.find(cat => cat.toLowerCase() === texto.toLowerCase());
  return match || categorias[0] || 'Otros';
}

function normalizarMovimientoParaGuardar(raw, fallbackId = null) {
  if (!raw || typeof raw !== 'object') return null;

  const tipoRaw = typeof raw.tipo === 'string' ? raw.tipo.trim().toUpperCase() : '';
  const tipo = tipoRaw === 'INGRESO' ? 'INGRESO' : 'GASTO';
  const valor = Number(raw.valor);
  const concepto = (
    typeof raw.concepto === 'string' ? raw.concepto :
    typeof raw.descripcion === 'string' ? raw.descripcion :
    typeof raw.nombre === 'string' ? raw.nombre :
    ''
  ).trim();
  const fecha = typeof raw.fecha === 'string' && esFechaISOValida(raw.fecha)
    ? raw.fecha
    : obtenerFechaHoyISO();

  if (!concepto) return null;
  if (!Number.isFinite(valor) || valor <= 0) return null;

  return {
    id: raw.id || fallbackId || createEntityId('tx'),
    tipo,
    concepto,
    categoria: normalizarCategoriaParaTipo(tipo, raw.categoria),
    cuenta: (typeof raw.cuenta === 'string' && raw.cuenta.trim()) ? raw.cuenta.trim() : 'Principal',
    valor,
    fecha,
    grupoFecha: formatearGrupoFecha(fecha)
  };
}

function normalizarMovimientoEntrada(raw) {
  return normalizarMovimientoParaGuardar(raw);
}

// ============================================================================
// UTILIDAD: Validar un valor numérico finito y positivo
// ============================================================================
function esMontoValido(valor) {
  const n = Number(valor);
  return isFinite(n) && n > 0;
}

// ============================================================================
// CLASE DEL NÚCLEO DE DATOS (DataCore)
// ============================================================================
class FinanzasCore {
  constructor() {
    this.state = this.loadState();
    this.listeners = [];
    this.lastPersistence = { local: false, session: false, memory: true };

    // Sincronizar cambios entre pestañas/ventanas abiertas
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.state = this.loadState();
          this.notifyListeners();
        }
      });
    }
  }

  loadState() {
    try {
      const rawValue = safeReadRaw(STORAGE_KEY) || safeReadRaw(SESSION_STORAGE_KEY);
      if (!rawValue) {
        return cloneStateShape();
      }

      let parsed;
      try {
        parsed = JSON.parse(rawValue);
      } catch (jsonErr) {
        console.warn('JSON corrupto en almacenamiento persistente, cargando datos base:', jsonErr);
        return cloneStateShape();
      }

      const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.data && typeof parsed.data === 'object'
        ? parsed.data
        : parsed;

      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        console.warn('Datos guardados no son un objeto válido, cargando datos base.');
        return cloneStateShape();
      }

      const base = cloneStateShape();
      const migratedState = {
        ...base,
        ...source,
        usuario: { ...base.usuario, ...(source.usuario && typeof source.usuario === 'object' ? source.usuario : {}) },
        limitesCategorias: { ...base.limitesCategorias, ...(source.limitesCategorias && typeof source.limitesCategorias === 'object' ? source.limitesCategorias : {}) },
        movimientos: this._validarArray(source.movimientos, base.movimientos)
          .map(m => normalizarMovimientoEntrada(m))
          .filter(Boolean),
        metas: this._validarArray(source.metas, base.metas)
          .map(m => normalizeMetaRecord(m))
          .filter(Boolean),
        aportesMetas: this._validarArray(source.aportesMetas, base.aportesMetas)
          .map(m => normalizeAporteMetaRecord(m))
          .filter(Boolean),
        deudas: this._validarArray(source.deudas, base.deudas)
          .map(d => normalizeDebtRecord(d))
          .filter(Boolean),
        abonosDeudas: this._validarArray(source.abonosDeudas, base.abonosDeudas)
          .map(a => normalizeAbonoDeudaRecord(a))
          .filter(Boolean),
        presupuestosPorPeriodo: source.presupuestosPorPeriodo && typeof source.presupuestosPorPeriodo === 'object' && !Array.isArray(source.presupuestosPorPeriodo)
          ? source.presupuestosPorPeriodo
          : {}
      };

      migratedState.saldoInicial = safeNumber(migratedState.saldoInicial, 0);
      migratedState.periodoAnio = Number.isInteger(migratedState.periodoAnio) ? migratedState.periodoAnio : new Date().getFullYear();
      migratedState.periodoMes = Number.isInteger(migratedState.periodoMes) && migratedState.periodoMes >= 0 && migratedState.periodoMes <= 11
        ? migratedState.periodoMes
        : new Date().getMonth();
      migratedState.presupuestoMensual = safeNumber(migratedState.presupuestoMensual, base.presupuestoMensual);
      migratedState.saldoOculto = Boolean(migratedState.saldoOculto);

      return migratedState;
    } catch (e) {
      console.warn('Error leyendo localStorage, cargando datos base:', e);
    }
    return cloneStateShape();
  }

  /** Valida que un valor sea un array; devuelve el fallback si no. */
  _validarArray(valor, fallback) {
    if (Array.isArray(valor)) return valor;
    return Array.isArray(fallback)
      ? JSON.parse(JSON.stringify(fallback))
      : [];
  }

  ensureStateIntegrity() {
    if (!this.state || typeof this.state !== 'object' || Array.isArray(this.state)) {
      this.state = cloneStateShape();
      return;
    }

    const base = cloneStateShape();
    this.state.usuario = { ...base.usuario, ...(this.state.usuario || {}) };
    this.state.limitesCategorias = { ...base.limitesCategorias, ...(this.state.limitesCategorias || {}) };
    this.state.movimientos = Array.isArray(this.state.movimientos)
      ? this.state.movimientos.map(m => normalizarMovimientoParaGuardar(m)).filter(Boolean)
      : [];
    this.state.metas = Array.isArray(this.state.metas)
      ? this.state.metas.map(m => normalizeMetaRecord(m)).filter(Boolean)
      : [];
    this.state.aportesMetas = Array.isArray(this.state.aportesMetas)
      ? this.state.aportesMetas.map(m => normalizeAporteMetaRecord(m)).filter(Boolean)
      : [];
    this.state.deudas = Array.isArray(this.state.deudas)
      ? this.state.deudas.map(d => normalizeDebtRecord(d)).filter(Boolean)
      : [];
    this.state.abonosDeudas = Array.isArray(this.state.abonosDeudas)
      ? this.state.abonosDeudas.map(a => normalizeAbonoDeudaRecord(a)).filter(Boolean)
      : [];
    this.state.presupuestosPorPeriodo = this.state.presupuestosPorPeriodo && typeof this.state.presupuestosPorPeriodo === 'object' && !Array.isArray(this.state.presupuestosPorPeriodo)
      ? this.state.presupuestosPorPeriodo
      : {};
    this.state.saldoInicial = safeNumber(this.state.saldoInicial, 0);
    this.state.periodoAnio = Number.isInteger(this.state.periodoAnio) ? this.state.periodoAnio : new Date().getFullYear();
    this.state.periodoMes = Number.isInteger(this.state.periodoMes) && this.state.periodoMes >= 0 && this.state.periodoMes <= 11
      ? this.state.periodoMes
      : new Date().getMonth();
    this.state.presupuestoMensual = safeNumber(this.state.presupuestoMensual, base.presupuestoMensual);
    this.state.saldoOculto = Boolean(this.state.saldoOculto);
  }

  saveState() {
    try {
      this.ensureStateIntegrity();
      const payload = {
        version: STORAGE_VERSION,
        updatedAt: new Date().toISOString(),
        data: this.state
      };
      this.lastPersistence = safePersistRaw(STORAGE_KEY, payload);
      // Mantener una copia secundaria compatible con versiones anteriores.
      if (this.lastPersistence.local) {
        try {
          const handlers = getStorageHandlers();
          if (handlers.session) handlers.session.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {
          console.warn('No fue posible crear el respaldo de sesión:', e);
        }
      }
      this.notifyListeners();
      return {
        ok: this.lastPersistence.local || this.lastPersistence.session,
        persistent: this.lastPersistence.local,
        message: this.lastPersistence.local
          ? 'Datos guardados en este navegador.'
          : this.lastPersistence.session
            ? 'Datos guardados temporalmente; exporta una copia antes de cerrar el navegador.'
            : 'No hay almacenamiento disponible; los datos solo permanecerán en memoria.'
      };
    } catch (e) {
      console.error('Error guardando datos persistentes:', e);
      return { ok: false, persistent: false, message: 'No fue posible guardar los datos.' };
    }
  }

  resetState() {
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    const handlers = getStorageHandlers();
    try { if (handlers.local) handlers.local.removeItem(STORAGE_KEY); } catch (e) {}
    try { if (handlers.session) handlers.session.removeItem(STORAGE_KEY); } catch (e) {}
    try { if (handlers.session) handlers.session.removeItem(SESSION_STORAGE_KEY); } catch (e) {}
    try { if (handlers.local) handlers.local.removeItem(SESSION_STORAGE_KEY); } catch (e) {}
    this.saveState();
  }

  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach(fn => {
      try { fn(this.state); } catch (err) { console.error('Error en listener:', err); }
    });
  }

  // ==========================================================================
  // PERÍODO SELECCIONADO
  // ==========================================================================

  /** Devuelve el nombre del mes/año del período seleccionado */
  getNombrePeriodo() {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const m = this.state.periodoMes;
    const a = this.state.periodoAnio;
    return `${meses[m] || 'Mes'} de ${a}`;
  }

  /** Cambia el período actual: delta = -1 (anterior), +1 (siguiente) */
  cambiarPeriodo(delta) {
    let m = this.state.periodoMes + delta;
    let a = this.state.periodoAnio;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    this.state.periodoMes = m;
    this.state.periodoAnio = a;
    this.saveState();
  }

  /** Filtra movimientos por el período seleccionado */
  getMovimientosPeriodo() {
    const mes = this.state.periodoMes;
    const anio = this.state.periodoAnio;

    return this.state.movimientos
      .filter(m => {
        const info = obtenerAnioMesDeFecha(m.fecha);
        return info && info.anio === anio && info.mes === mes;
      })
      .sort((a, b) => {
        const fechaA = parseFechaLocal(a.fecha)?.getTime?.() ?? 0;
        const fechaB = parseFechaLocal(b.fecha)?.getTime?.() ?? 0;
        return fechaB - fechaA;
      });
  }

  // ==========================================================================
  // FÓRMULAS MATEMÁTICAS CONTABLES Y DE DIAGNÓSTICO
  // ==========================================================================

  // --- Funciones GLOBALES (todos los movimientos) ---

  /** Ingresos totales GLOBALES: sumatoria de todos los ingresos registrados */
  calcTotalIngresosGlobal() {
    return this.state.movimientos
      .filter(m => m.tipo === 'INGRESO')
      .reduce((sum, m) => sum + (Number(m.valor) || 0), 0);
  }

  /** Gastos totales GLOBALES */
  calcTotalGastosGlobal() {
    return this.state.movimientos
      .filter(m => m.tipo === 'GASTO')
      .reduce((sum, m) => sum + (Number(m.valor) || 0), 0);
  }

  // --- Funciones DEL PERÍODO SELECCIONADO ---

  /** Ingresos del período seleccionado */
  calcTotalIngresos() {
    return this.getMovimientosPeriodo()
      .filter(m => m.tipo === 'INGRESO')
      .reduce((sum, m) => sum + (Number(m.valor) || 0), 0);
  }

  /** Gastos del período seleccionado */
  calcTotalGastos() {
    return this.getMovimientosPeriodo()
      .filter(m => m.tipo === 'GASTO')
      .reduce((sum, m) => sum + (Number(m.valor) || 0), 0);
  }

  /** Flujo del período = Ingresos(período) - Gastos(período) */
  calcBalanceNeto() {
    return this.calcTotalIngresos() - this.calcTotalGastos();
  }

  /**
   * Saldo disponible (global):
   *   saldoInicial + Σ ingresos(global) − Σ gastos(global)
   *
   * El saldoInicial es un dato explícito y configurable (por defecto 0).
   * No se suma ningún capital oculto.
   */
  calcSaldoTotal() {
    const si = Number(this.state.saldoInicial) || 0;
    return si + this.calcTotalIngresosGlobal() - this.calcTotalGastosGlobal();
  }

  // 5. Total Ahorrado en Metas
  calcTotalAhorradoMetas() {
    return this.state.metas.reduce((sum, m) => sum + (Number(m.ahorrado) || 0), 0);
  }

  // Meta Acumulada Total
  calcTotalObjetivoMetas() {
    return this.state.metas.reduce((sum, m) => sum + (Number(m.objetivo) || 0), 0);
  }

  // 6. Total Pasivos / Deudas Pendientes
  calcTotalDeudasPendientes() {
    return this.state.deudas.reduce((sum, d) => sum + (Number(d.saldoPendiente) || 0), 0);
  }

  calcTotalDeudasInicial() {
    return this.state.deudas.reduce((sum, d) => sum + (Number(d.valorInicial) || 0), 0);
  }

  calcTotalDeudasPagado() {
    return this.calcTotalDeudasInicial() - this.calcTotalDeudasPendientes();
  }

  /**
   * Tasa de Ahorro: (Ahorro acumulado en metas / Ingresos totales globales) × 100
   *
   * Definición unificada (coincide con C++ y documentación):
   *   Mide qué fracción de los ingresos totales se ha destinado a metas de ahorro.
   *   - Si no hay ingresos: 0 %.
   *   - Puede superar 100 % si las aportaciones superan los ingresos
   *     (p. ej. aportes provenientes de herencias o capital previo).
   *   - No se muestra como negativo porque las aportaciones son siempre ≥ 0.
   */
  calcTasaAhorro() {
    const ingresos = this.calcTotalIngresosGlobal();
    if (ingresos <= 0) return 0;
    const ahorro = this.calcTotalAhorradoMetas();
    const tasa = (ahorro / ingresos) * 100;
    return Number(tasa.toFixed(1));
  }

  getPresupuestoPeriodo() {
    const key = `${this.state.periodoAnio}-${this.state.periodoMes}`;
    if (this.state.presupuestosPorPeriodo && this.state.presupuestosPorPeriodo[key] !== undefined) {
      return Number(this.state.presupuestosPorPeriodo[key]) || 0;
    }
    return Number(this.state.presupuestoMensual) || 0;
  }

  /** Control Presupuestal (basado en el período seleccionado) */
  calcPresupuestoStatus() {
    const totalGastos = this.calcTotalGastos();
    const presupuesto = this.getPresupuestoPeriodo();
    const porcentaje = presupuesto > 0 ? (totalGastos / presupuesto) * 100 : 0;
    const disponible = presupuesto - totalGastos;
    return {
      gastado: totalGastos,
      limite: presupuesto,
      disponible: Math.max(0, disponible),
      exceso: disponible < 0 ? Math.abs(disponible) : 0,
      porcentaje: Math.min(100, Math.round(porcentaje)),
      porcentajeReal: Math.round(porcentaje)
    };
  }

  /** Gastos agrupados por Categoría (del período seleccionado) */
  calcGastosPorCategoria() {
    const totales = {};
    CATEGORIAS_GASTO.forEach(cat => { totales[cat.id] = 0; });

    this.getMovimientosPeriodo()
      .filter(m => m.tipo === 'GASTO')
      .forEach(m => {
        if (totales[m.categoria] !== undefined) {
          totales[m.categoria] += Number(m.valor) || 0;
        } else {
          totales['Otros'] = (totales['Otros'] || 0) + (Number(m.valor) || 0);
        }
      });
    return totales;
  }

  /** Motor de Lógica Proposicional para Diagnóstico (del período seleccionado) */
  evaluarAlertas() {
    const alertas = [];
    const ingresos = this.calcTotalIngresos();
    const gastos = this.calcTotalGastos();
    const statusPresupuesto = this.calcPresupuestoStatus();
    const usuario = this.state.usuario || {};

    // Respetar preferencias de alertas
    const alertasPresupuestoActivas = usuario.alertasPresupuesto !== false;
    const recordatoriosDeudasActivos = usuario.recordatoriosDeudas !== false;

    // Regla 1: Déficit operacional (Gastos > Ingresos)
    if (gastos > ingresos && ingresos > 0) {
      alertas.push({
        tipo: 'critica',
        icono: '🚨',
        titulo: 'Déficit Financiero Detectado',
        mensaje: `Tus egresos (${formatCOP(gastos)}) superan tus ingresos (${formatCOP(ingresos)}). Se recomienda pausar gastos prescindibles.`
      });
    }

    // Regla 2: Exceso de Presupuesto Global
    if (alertasPresupuestoActivas && statusPresupuesto.porcentajeReal > 100) {
      alertas.push({
        tipo: 'critica',
        icono: '⚠️',
        titulo: 'Presupuesto Mensual Excedido',
        mensaje: `Has sobrepasado el límite mensual por ${formatCOP(statusPresupuesto.exceso)}. Ajusta tus consumos de inmediato.`
      });
    } else if (alertasPresupuestoActivas && statusPresupuesto.porcentajeReal >= 85) {
      alertas.push({
        tipo: 'advertencia',
        icono: '⚡',
        titulo: 'Presupuesto en Zona de Riesgo (85%+)',
        mensaje: `Has consumido el ${statusPresupuesto.porcentajeReal}% de tu presupuesto. Quedan ${formatCOP(statusPresupuesto.disponible)} para el resto del mes.`
      });
    }

    // Regla 3: Alerta en categorías individuales
    if (alertasPresupuestoActivas) {
      const gastosCat = this.calcGastosPorCategoria();
      for (const [cat, gastado] of Object.entries(gastosCat)) {
        const limite = this.state.limitesCategorias[cat] || 300000;
        if (gastado >= limite) {
          alertas.push({
            tipo: 'advertencia',
            icono: '🏷️',
            titulo: `Límite alcanzado en ${cat}`,
            mensaje: `Se ha completado el 100% presupuestado para ${cat} (${formatCOP(gastado)} de ${formatCOP(limite)}).`
          });
          break; // no saturar
        }
      }
    }

    // Regla 4: Superávit saludable
    if (ingresos > 0 && gastos <= ingresos && statusPresupuesto.porcentajeReal < 85) {
      alertas.push({
        tipo: 'positiva',
        icono: '✨',
        titulo: 'Finanzas en Equilibrio Óptimo',
        mensaje: `Mantienes un superávit mensual de ${formatCOP(this.calcBalanceNeto())} con una tasa de ahorro del ${this.calcTasaAhorro()}%.`
      });
    }

    return alertas;
  }

  // ==========================================================================
  // OPERACIONES CRUD CON VALIDACIÓN EN EL NÚCLEO
  // ==========================================================================

  agregarMovimiento(mov) {
    const movimientoBase = mov && typeof mov === 'object' ? mov : {};
    const concepto = typeof movimientoBase.concepto === 'string' ? movimientoBase.concepto.trim() : '';
    const valor = Number(movimientoBase.valor);

    if (!concepto) {
      return { error: 'El concepto del movimiento es obligatorio.' };
    }
    if (!isFinite(valor) || valor <= 0) {
      return { error: 'El valor debe ser un número positivo.' };
    }

    const nuevo = normalizarMovimientoParaGuardar(mov, `tx-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
    if (!nuevo) {
      return { error: 'No se pudo guardar el movimiento. Revisa los datos ingresados.' };
    }

    if (!Array.isArray(this.state.movimientos)) {
      this.state.movimientos = [];
    }

    this.state.movimientos.unshift(nuevo);
    this.saveState();
    return nuevo;
  }

  eliminarMovimiento(id) {
    this.state.movimientos = this.state.movimientos.filter(m => m.id !== id);
    this.saveState();
  }

  agregarMeta(meta) {
    meta = meta && typeof meta === 'object' ? meta : {};
    const nombre = (typeof meta.nombre === 'string') ? meta.nombre.trim() : '';
    if (!nombre) {
      return { error: 'El nombre de la meta es obligatorio.' };
    }
    const objetivo = Number(meta.objetivo);
    if (!isFinite(objetivo) || objetivo <= 0) {
      return { error: 'El objetivo debe ser un número positivo.' };
    }
    const ahorradoRaw = Number(meta.ahorrado || 0);
    const ahorrado = (isFinite(ahorradoRaw) && ahorradoRaw >= 0) ? ahorradoRaw : 0;

    const nueva = {
      id: createEntityId('meta'),
      nombre: nombre,
      plazo: (typeof meta.plazo === 'string' ? meta.plazo.trim() : '') || 'Sin fecha',
      objetivo: objetivo,
      ahorrado: ahorrado,
      categoria: meta.categoria || 'General'
    };
    this.state.metas.push(nueva);
    if (ahorrado > 0) {
      this.state.aportesMetas.unshift({
        id: createEntityId('ap'),
        metaId: nueva.id,
        metaNombre: nueva.nombre,
        valor: ahorrado,
        fecha: obtenerFechaHoyISO()
      });
    }
    this.saveState();
    return nueva;
  }

  /**
   * Aporta a una meta de ahorro.
   * Registra el importe efectivamente solicitado en el historial.
   * El avance visual se limita al 100%, pero el ahorrado real puede superar el objetivo.
   * Retorna { ok, montoAplicado, ajustado, mensaje }.
   */
  aportarMeta(metaId, monto) {
    const meta = this.state.metas.find(m => m.id === metaId);
    if (!meta) return { error: 'Meta no encontrada.' };

    const aporte = Number(monto);
    if (!isFinite(aporte) || aporte <= 0) {
      return { error: 'El monto del aporte debe ser un número positivo.' };
    }

    // Se registra el importe solicitado sin alterarlo.
    // El ahorrado puede superar el objetivo; solo la barra visual se limita a 100%.
    meta.ahorrado = (meta.ahorrado || 0) + aporte;

    this.state.aportesMetas.unshift({
      id: createEntityId('ap'),
      metaId: meta.id,
      metaNombre: meta.nombre,
      valor: aporte,
      fecha: obtenerFechaHoyISO()
    });

    this.saveState();

    const superaObjetivo = meta.ahorrado > meta.objetivo;
    return {
      ok: true,
      montoAplicado: aporte,
      ajustado: false,
      mensaje: superaObjetivo
        ? `Aporte de ${formatCOP(aporte)} acreditado. Has superado el objetivo de la meta.`
        : `Aporte de ${formatCOP(aporte)} acreditado.`
    };
  }

  eliminarMeta(metaId) {
    const existe = this.state.metas.some(m => m.id === metaId);
    if (!existe) return { error: 'Meta no encontrada.' };
    this.state.metas = this.state.metas.filter(m => m.id !== metaId);
    // El historial no debe conservar aportes huérfanos.
    this.state.aportesMetas = this.state.aportesMetas.filter(a => a.metaId !== metaId);
    this.saveState();
    return { ok: true };
  }

  /**
   * Registra una nueva deuda.
   * Acepta condiciones como campo opcional (puede ser undefined, null o cadena vacía).
   */
  agregarDeuda(deuda) {
    deuda = deuda && typeof deuda === 'object' ? deuda : {};
    const nombre = (typeof deuda.nombre === 'string') ? deuda.nombre.trim() : '';
    if (!nombre) {
      return { error: 'El nombre de la deuda es obligatorio.' };
    }
    const valorInicial = Number(deuda.valorInicial);
    if (!isFinite(valorInicial) || valorInicial <= 0) {
      return { error: 'El valor inicial debe ser un número positivo.' };
    }

    // Condiciones: campo opcional, se acepta undefined/null/vacío
    const condiciones = (typeof deuda.condiciones === 'string' && deuda.condiciones.trim())
      ? deuda.condiciones.trim()
      : 'Acuerdo de pago';

    const saldoRaw = Number(deuda.saldoPendiente);
    let saldoPendiente = (isFinite(saldoRaw) && saldoRaw >= 0) ? saldoRaw : valorInicial;

    // Validar que el saldo pendiente no supere el valor original
    if (saldoPendiente > valorInicial) {
      saldoPendiente = valorInicial;
    }

    const cuotaRaw = Number(deuda.cuotaMensual || 0);
    const cuotaMensual = (isFinite(cuotaRaw) && cuotaRaw >= 0) ? cuotaRaw : 0;

    const nueva = {
      id: createEntityId('deuda'),
      nombre: nombre,
      condiciones: condiciones,
      valorInicial: valorInicial,
      saldoPendiente: saldoPendiente,
      proximoPago: deuda.proximoPago || 'Próximo mes',
      cuotaMensual: cuotaMensual
    };
    this.state.deudas.push(nueva);
    this.saveState();
    return nueva;
  }

  /**
   * Abona a una deuda.
   * Si el monto supera el saldo pendiente, se ajusta al saldo y se informa.
   * Retorna { ok, montoAplicado, ajustado, mensaje }.
   */
  abonarDeuda(deudaId, monto) {
    const deuda = this.state.deudas.find(d => d.id === deudaId);
    if (!deuda) return { error: 'Deuda no encontrada.' };

    const abonoSolicitado = Number(monto);
    if (!isFinite(abonoSolicitado) || abonoSolicitado <= 0) {
      return { error: 'El monto del abono debe ser un número positivo.' };
    }

    if (deuda.saldoPendiente <= 0) {
      return { error: 'Esta deuda ya está completamente pagada.' };
    }

    // Limitar al saldo pendiente para no dejar saldo negativo
    const abonoEfectivo = Math.min(abonoSolicitado, deuda.saldoPendiente);
    const fueAjustado = abonoEfectivo < abonoSolicitado;

    deuda.saldoPendiente = Math.max(0, deuda.saldoPendiente - abonoEfectivo);

    this.state.abonosDeudas.unshift({
      id: createEntityId('ab'),
      deudaId: deuda.id,
      deudaNombre: deuda.nombre,
      valor: abonoEfectivo,
      fecha: obtenerFechaHoyISO()
    });

    this.saveState();
    return {
      ok: true,
      montoAplicado: abonoEfectivo,
      ajustado: fueAjustado,
      mensaje: fueAjustado
        ? `El abono se ajustó de ${formatCOP(abonoSolicitado)} a ${formatCOP(abonoEfectivo)} (saldo pendiente).`
        : `Abono de ${formatCOP(abonoEfectivo)} registrado.`
    };
  }

  eliminarDeuda(deudaId) {
    const existe = this.state.deudas.some(d => d.id === deudaId);
    if (!existe) return { error: 'Deuda no encontrada.' };
    this.state.deudas = this.state.deudas.filter(d => d.id !== deudaId);
    // El historial no debe conservar abonos asociados a una deuda inexistente.
    this.state.abonosDeudas = this.state.abonosDeudas.filter(a => a.deudaId !== deudaId);
    this.saveState();
    return { ok: true };
  }

  actualizarPresupuesto(monto) {
    const val = Number(monto);
    if (!isFinite(val) || val < 0) return { error: 'El presupuesto debe ser un número mayor o igual a cero.' };
    if (!this.state.presupuestosPorPeriodo || typeof this.state.presupuestosPorPeriodo !== 'object') {
      this.state.presupuestosPorPeriodo = {};
    }
    const key = `${this.state.periodoAnio}-${this.state.periodoMes}`;
    this.state.presupuestosPorPeriodo[key] = val;
    this.saveState();
    return { ok: true, presupuesto: val };
  }

  actualizarLimiteCategoria(cat, limite) {
    const val = Number(limite);
    if (!isFinite(val) || val < 0) return;
    this.state.limitesCategorias[cat] = val;
    this.saveState();
  }

  actualizarPerfil(usuario) {
    usuario = usuario && typeof usuario === 'object' ? usuario : {};
    const nombreSeguro = typeof usuario.nombre === 'string' && usuario.nombre.trim()
      ? usuario.nombre.trim()
      : this.state.usuario.nombre;
    this.state.usuario = {
      ...this.state.usuario,
      ...usuario,
      nombre: nombreSeguro,
      iniciales: obtenerIniciales(nombreSeguro)
    };
    this.saveState();
  }

  /** Actualiza el saldo inicial configurable */
  actualizarSaldoInicial(monto) {
    const val = Number(monto);
    if (!isFinite(val)) return;
    this.state.saldoInicial = val;
    this.saveState();
  }

  toggleSaldoOculto() {
    this.state.saldoOculto = !this.state.saldoOculto;
    this.saveState();
    return this.state.saldoOculto;
  }
}

// ============================================================================
// FUNCIONES AUXILIARES GLOBALES
// ============================================================================

function formatCOP(valor, incluirSigno = false) {
  const parsed = Number(valor);
  const num = Number.isFinite(parsed) ? parsed : 0;
  const formatted = num.toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (incluirSigno && num > 0) return `+${formatted} COP`;
  if (incluirSigno && num < 0) return `${formatted} COP`;
  return `${formatted} COP`;
}

function configurarEntradasMonetarias(root = document) {
  root.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('blur', () => {
      if (input.value.trim() === '') return;
      const monto = Number(input.value);
      if (Number.isFinite(monto)) {
        input.value = monto.toFixed(2);
      }
    });
  });
}

function obtenerIniciales(nombre) {
  if (!nombre) return 'LM';
  const partes = nombre.trim().split(/\s+/);
  if (partes.length >= 2) {
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }

  return partes[0].substring(0, 2).toUpperCase();
}

function esFechaISOValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaUTC = new Date(0);
  fechaUTC.setUTCHours(0, 0, 0, 0);
  fechaUTC.setUTCFullYear(anio, mes - 1, dia);
  return fechaUTC.getUTCFullYear() === anio &&
    fechaUTC.getUTCMonth() === mes - 1 &&
    fechaUTC.getUTCDate() === dia;
}

function formatearGrupoFecha(fechaStr) {
  if (!fechaStr) return 'RECIENTE';
  try {
    const fecha = parseFechaLocal(fechaStr);
    if (!fecha) return fechaStr;
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    if (fecha.toDateString() === hoy.toDateString()) {
      return `HOY, ${fecha.getDate()} ${obtenerMesCorto(fecha.getMonth())}`.toUpperCase();
    }
    if (fecha.toDateString() === ayer.toDateString()) {
      return `AYER, ${fecha.getDate()} ${obtenerMesCorto(fecha.getMonth())}`.toUpperCase();
    }
    return `${fecha.getDate()} ${obtenerMesCorto(fecha.getMonth())}`.toUpperCase();
  } catch (e) {
    return fechaStr;
  }
}

function obtenerMesCorto(mesIdx) {
  const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return meses[mesIdx] || '';
}

function obtenerFechaHoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Escape seguro para CSV: envuelve en comillas, escapa comillas internas,
 * y agrega prefijo de tabulador a valores que comienzan con =, +, -, @
 * para evitar inyección de fórmulas en hojas de cálculo.
 */
function escaparCSV(valor) {
  let s = String(valor ?? '');
  // Prevenir inyección de fórmulas en hojas de cálculo
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  // Escapar comillas y envolver
  return '"' + s.replace(/"/g, '""') + '"';
}

/**
 * Agrupa movimientos reales por mes y año para gráficos, ordenados cronológicamente.
 */
function obtenerHistorialMensualReal(movimientos) {
  const mesesMap = {};
  (movimientos || []).forEach(m => {
    const info = obtenerAnioMesDeFecha(m.fecha);
    if (!info) return;
    const key = `${info.anio}-${String(info.mes + 1).padStart(2, '0')}`;
    if (!mesesMap[key]) {
      mesesMap[key] = { anio: info.anio, mes: info.mes, ingresos: 0, gastos: 0 };
    }
    if (m.tipo === 'INGRESO') mesesMap[key].ingresos += Number(m.valor) || 0;
    if (m.tipo === 'GASTO') mesesMap[key].gastos += Number(m.valor) || 0;
  });

  const keys = Object.keys(mesesMap).sort();
  const nombresMesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const labels = [];
  const ingresos = [];
  const gastos = [];

  keys.forEach(k => {
    const item = mesesMap[k];
    labels.push(`${nombresMesesCortos[item.mes]} ${item.anio}`);
    ingresos.push(item.ingresos);
    gastos.push(item.gastos);
  });

  return { labels, ingresos, gastos, tieneDatos: labels.length > 0 };
}

// Instancia global compartida
const Finanzas = new FinanzasCore();
