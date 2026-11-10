/**
 * ============================================================================
 * DEMO DATA MODULE
 * Responsabilidad: Datos personales de compatibilidad y negocio inicial vacío.
 * Los registros empresariales solo se crean por operaciones del usuario.
 * ============================================================================
 */
(function () {
  'use strict';

  const demoState = {
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
    saldoInicial: 0,
    periodoAnio: new Date().getFullYear(),
    periodoMes: new Date().getMonth(),
    presupuestoMensual: 2300000,

    limitesCategorias: {
      'Vivienda': 900000,
      'Alimentación': 500000,
      'Transporte': 250000,
      'Ocio': 200000,
      'Sanidad': 250000,
      'Otros': 200000
    },

    cuentas: [
      { id: 'cta-1', nombre: 'Cuenta Principal', tipo: 'BANCO', saldo: 2859500, entidad: 'Bancolombia' },
      { id: 'cta-2', nombre: 'Caja / Efectivo', tipo: 'EFECTIVO', saldo: 1000000, entidad: 'Billetera' }
    ],

    movimientos: [
      { id: 'tx-1', tipo: 'GASTO', concepto: 'Mercadona', categoria: 'Alimentación', cuenta: 'Principal', valor: 42800, fecha: '2026-10-15', grupoFecha: 'HOY, 15 OCTUBRE' },
      { id: 'tx-2', tipo: 'GASTO', concepto: 'Café de la esquina', categoria: 'Ocio', cuenta: 'Principal', valor: 4200, fecha: '2026-10-15', grupoFecha: 'HOY, 15 OCTUBRE' },
      { id: 'tx-3', tipo: 'GASTO', concepto: 'Abono tarjeta transporte', categoria: 'Transporte', cuenta: 'Principal', valor: 55000, fecha: '2026-10-14', grupoFecha: 'AYER, 14 OCTUBRE' },
      { id: 'tx-4', tipo: 'INGRESO', concepto: 'Nómina mensual', categoria: 'Salario', cuenta: 'Principal', valor: 2800000, fecha: '2026-10-01', grupoFecha: '1 OCTUBRE' },
      { id: 'tx-5', tipo: 'GASTO', concepto: 'Alquiler apartamento', categoria: 'Vivienda', cuenta: 'Principal', valor: 850000, fecha: '2026-10-02', grupoFecha: '2 OCTUBRE' },
      { id: 'tx-6', tipo: 'GASTO', concepto: 'Farmacia central', categoria: 'Sanidad', cuenta: 'Principal', valor: 35000, fecha: '2026-10-08', grupoFecha: '8 OCTUBRE' },
      { id: 'tx-7', tipo: 'INGRESO', concepto: 'Proyecto consultoría web', categoria: 'Freelance', cuenta: 'Principal', valor: 650000, fecha: '2026-10-10', grupoFecha: '10 OCTUBRE' },
      { id: 'tx-8', tipo: 'GASTO', concepto: 'Restaurante fin de semana', categoria: 'Ocio', cuenta: 'Principal', valor: 85000, fecha: '2026-10-12', grupoFecha: '12 OCTUBRE' },
      { id: 'tx-9', tipo: 'GASTO', concepto: 'Supermercado quincena', categoria: 'Alimentación', cuenta: 'Principal', valor: 145000, fecha: '2026-10-14', grupoFecha: '14 OCTUBRE' }
    ],

    metas: [
      { id: 'meta-1', nombre: 'Fondo de Emergencia (6 meses)', montoObjetivo: 12000000, montoActual: 4500000, fechaLimite: '2026-12-31', color: '#10b981', icono: '🛡️', categoria: 'Seguridad' },
      { id: 'meta-2', nombre: 'Vacaciones Japón 2027', montoObjetivo: 8500000, montoActual: 2100000, fechaLimite: '2027-04-15', color: '#06b6d4', icono: '✈️', categoria: 'Viajes' },
      { id: 'meta-3', nombre: 'Renovación Portátil Mac', montoObjetivo: 4500000, montoActual: 3800000, fechaLimite: '2026-11-30', color: '#8b5cf6', icono: '💻', categoria: 'Tecnología' }
    ],

    aportesMetas: [
      { id: 'ap-1', metaId: 'meta-1', monto: 500000, fecha: '2026-10-05', nota: 'Aporte mensual programado' },
      { id: 'ap-2', metaId: 'meta-2', monto: 300000, fecha: '2026-10-10', nota: 'Ahorro proyecto freelance' }
    ],

    deudas: [
      { id: 'deuda-1', acreedor: 'Banco Davivienda', concepto: 'Préstamo Coche', montoInicial: 18000000, saldoPendiente: 6200000, cuotaMensual: 450000, tasaInteres: 14.5, fechaVencimiento: '2027-11-15', categoria: 'Vehículo', estado: 'AL_DIA' },
      { id: 'deuda-2', acreedor: 'Bancolombia', concepto: 'Tarjeta Visa Gold', montoInicial: 3500000, saldoPendiente: 850000, cuotaMensual: 220000, tasaInteres: 24.8, fechaVencimiento: '2026-12-20', categoria: 'Tarjeta', estado: 'AL_DIA' },
      { id: 'deuda-3', acreedor: 'Icetex', concepto: 'Crédito Educativo Posgrado', montoInicial: 12000000, saldoPendiente: 4100000, cuotaMensual: 310000, tasaInteres: 9.2, fechaVencimiento: '2028-06-30', categoria: 'Educación', estado: 'AL_DIA' }
    ],

    abonosDeudas: [
      { id: 'ab-1', deudaId: 'deuda-1', monto: 450000, fecha: '2026-10-05', metodo: 'Transferencia' },
      { id: 'ab-2', deudaId: 'deuda-2', monto: 220000, fecha: '2026-10-12', metodo: 'Débito Automático' }
    ],

    // Fresh businesses start empty. Existing persisted data is never discarded.
    moduloActivo: 'PERSONAL',
    negocioActivoId: 'neg-1',
    negocios: [{ id: 'neg-1', nombre: 'Mi negocio', tipo: '', descripcion: '', telefono: '', email: '', direccion: '', moneda: 'COP', estado: 'ACTIVO' }],
    productos: [], proveedores: [], clientes: [], ventas: [], compras: [], empleados: [],
    gastosNegocio: [], ingresosNegocio: [], pagosEmpleado: [], pagosVenta: [], pagosCompra: [], pagosGasto: [],
    movimientosInventario: [], formulas: [], producciones: [], devolucionesNegocio: []
  };
  window.FinanzasDemoData = demoState;
  window.INITIAL_STATE = demoState;
})();
