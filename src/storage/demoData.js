/**
 * ============================================================================
 * DEMO DATA MODULE
 * Responsabilidad: Estado inicial completo con datos de demostración realistas
 * para Finanzas Personales y Gestión Empresarial ("Panadería del Sol").
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

    // MÓDULO EMPRESARIAL
    moduloActivo: 'PERSONAL',
    negocioActivoId: 'neg-1',

    negocios: [
      {
        id: 'neg-1',
        nombre: 'Panadería del Sol',
        tipo: 'Alimentos / Panadería Artesanal',
        descripcion: 'Elaboración y venta de productos de panadería fina, café y repostería artesanal.',
        telefono: '+57 310 987 6543',
        email: 'contacto@panaderiadelsol.co',
        direccion: 'Cra. 15 # 85-32, Bogotá',
        moneda: 'COP',
        estado: 'ACTIVO',
        fechaCreacion: '2026-01-15'
      }
    ],

    productos: [
      // Materias Primas
      { id: 'prod-mp-1', negocioId: 'neg-1', tipo: 'MATERIA_PRIMA', nombre: 'Harina de Trigo Especial', descripcion: 'Bulto de harina fortificada panadera', precioCompra: 85000, precioVenta: 0, costoUnitario: 1700, unidadMedida: 'kg', stock: 15, stockMinimo: 20, estado: 'DISPONIBLE' },
      { id: 'prod-mp-2', negocioId: 'neg-1', tipo: 'MATERIA_PRIMA', nombre: 'Levadura Fresca', descripcion: 'Levadura prensada para fermentación lenta', precioCompra: 12000, precioVenta: 0, costoUnitario: 12000, unidadMedida: 'kg', stock: 2, stockMinimo: 5, estado: 'DISPONIBLE' },
      { id: 'prod-mp-3', negocioId: 'neg-1', tipo: 'MATERIA_PRIMA', nombre: 'Café Espresso Grano', descripcion: 'Café arábica de origen Huila tostión media', precioCompra: 32000, precioVenta: 0, costoUnitario: 32000, unidadMedida: 'kg', stock: 3, stockMinimo: 10, estado: 'DISPONIBLE' },
      { id: 'prod-mp-4', negocioId: 'neg-1', tipo: 'MATERIA_PRIMA', nombre: 'Mantequilla Pura 82%', descripcion: 'Mantequilla sin sal para hojaldres', precioCompra: 24000, precioVenta: 0, costoUnitario: 24000, unidadMedida: 'kg', stock: 45, stockMinimo: 10, estado: 'DISPONIBLE' },
      { id: 'prod-mp-5', negocioId: 'neg-1', tipo: 'MATERIA_PRIMA', nombre: 'Azúcar Blanca Refinada', descripcion: 'Azúcar de caña fina', precioCompra: 4500, precioVenta: 0, costoUnitario: 4500, unidadMedida: 'kg', stock: 80, stockMinimo: 15, estado: 'DISPONIBLE' },
      { id: 'prod-mp-6', negocioId: 'neg-1', tipo: 'MATERIA_PRIMA', nombre: 'Chocolate Belga 70%', descripcion: 'Gotas de chocolate para chocolatinas y masa', precioCompra: 42000, precioVenta: 0, costoUnitario: 42000, unidadMedida: 'kg', stock: 25, stockMinimo: 8, estado: 'DISPONIBLE' },
      { id: 'prod-mp-7', negocioId: 'neg-1', tipo: 'MATERIA_PRIMA', nombre: 'Queso Crema San Martín', descripcion: 'Queso crema especial repostería', precioCompra: 28000, precioVenta: 0, costoUnitario: 28000, unidadMedida: 'kg', stock: 30, stockMinimo: 6, estado: 'DISPONIBLE' },

      // Productos Terminados
      { id: 'prod-pt-1', negocioId: 'neg-1', tipo: 'PRODUCTO', nombre: 'Croissant Francés de Mantequilla', descripcion: 'Croissant clásico hojaldrado 100% mantequilla', precioCompra: 0, precioVenta: 6500, costoUnitario: 2800, unidadMedida: 'unidades', stock: 65, stockMinimo: 15, estado: 'DISPONIBLE' },
      { id: 'prod-pt-2', negocioId: 'neg-1', tipo: 'PRODUCTO', nombre: 'Pan Baguette Tradicional', descripcion: 'Pan crujiente con masa madre natural', precioCompra: 0, precioVenta: 5000, costoUnitario: 1900, unidadMedida: 'unidades', stock: 48, stockMinimo: 10, estado: 'DISPONIBLE' },
      { id: 'prod-pt-3', negocioId: 'neg-1', tipo: 'PRODUCTO', nombre: 'Café Cappuccino 12oz', descripcion: 'Doble espresso con leche texturizada artesanal', precioCompra: 0, precioVenta: 7500, costoUnitario: 2200, unidadMedida: 'unidades', stock: 120, stockMinimo: 20, estado: 'DISPONIBLE' },
      { id: 'prod-pt-4', negocioId: 'neg-1', tipo: 'PRODUCTO', nombre: 'Tarta Vasca de Queso (Porción)', descripcion: 'Porción individual cremosa y dorada', precioCompra: 0, precioVenta: 12000, costoUnitario: 5100, unidadMedida: 'unidades', stock: 28, stockMinimo: 6, estado: 'DISPONIBLE' },
      { id: 'prod-pt-5', negocioId: 'neg-1', tipo: 'PRODUCTO', nombre: 'Café Especial Empacado 350g', descripcion: 'Café molido de especialidad origen Huila', precioCompra: 0, precioVenta: 28000, costoUnitario: 14000, unidadMedida: 'unidades', stock: 35, stockMinimo: 8, estado: 'DISPONIBLE' },
      { id: 'prod-pt-6', negocioId: 'neg-1', tipo: 'PRODUCTO', nombre: 'Pain au Chocolat', descripcion: 'Hojaldre relleno de chocolate belga', precioCompra: 0, precioVenta: 7500, costoUnitario: 3100, unidadMedida: 'unidades', stock: 40, stockMinimo: 10, estado: 'DISPONIBLE' }
    ],

    proveedores: [
      { id: 'prov-1', negocioId: 'neg-1', nombre: 'Molinos del Valle S.A.S.', telefono: '+57 312 456 7890', email: 'pedidos@molinosdelvalle.com', direccion: 'Zona Industrial Km 3, Bogotá', comprasAnio: 24500000, saldoPendiente: 1450000 },
      { id: 'prov-2', negocioId: 'neg-1', nombre: 'Lácteos & Derivados del Prado', telefono: '+57 315 789 1234', email: 'ventas@lacteosdelprado.co', direccion: 'Calle 13 # 68-40, Bogotá', comprasAnio: 14200000, saldoPendiente: 750000 },
      { id: 'prov-3', negocioId: 'neg-1', nombre: 'Café Hacienda El Retiro', telefono: '+57 318 654 9870', email: 'haciendaelretiro@cafe.co', direccion: 'Cra 7 # 116-50, Bogotá', comprasAnio: 8200000, saldoPendiente: 0 },
      { id: 'prov-4', negocioId: 'neg-1', nombre: 'Distribuidora La Cabaña (Azúcares)', telefono: '+57 311 888 4433', email: 'lacabana@distribuidora.co', direccion: 'Av. Américas # 45-12', comprasAnio: 6800000, saldoPendiente: 500000 },
      { id: 'prov-5', negocioId: 'neg-1', nombre: 'EcoPack Empaques Ecológicos', telefono: '+57 301 555 7766', email: 'ventas@ecopack.co', direccion: 'Calle 63 # 24-10', comprasAnio: 2400000, saldoPendiente: 0 },
      { id: 'prov-6', negocioId: 'neg-1', nombre: 'Levaduras & Fermentos Andinos', telefono: '+57 314 222 3311', email: 'contacto@fermentosandinos.co', direccion: 'Cra 50 # 18-05', comprasAnio: 2300000, saldoPendiente: 0 }
    ],

    clientes: [
      { id: 'cli-1', negocioId: 'neg-1', nombre: 'Cafetería del Parque', telefono: '+57 311 222 3344', email: 'admin@cafedelparque.com', direccion: 'Parque Central Local 4', saldoPendiente: 1200000 },
      { id: 'cli-2', negocioId: 'neg-1', nombre: 'Restaurante Bistro San Ángel', telefono: '+57 314 555 6677', email: 'bistro@sanangel.com', direccion: 'Cra 11 # 85-20', saldoPendiente: 1150000 },
      { id: 'cli-3', negocioId: 'neg-1', nombre: 'Hotel Boutique Virrey', telefono: '+57 317 444 8899', email: 'compras@hotelvirrey.com', direccion: 'Calle 87 # 14-22', saldoPendiente: 650000 },
      { id: 'cli-4', negocioId: 'neg-1', nombre: 'Catering & Eventos Gourmet', telefono: '+57 320 333 1122', email: 'eventos@gourmet.co', direccion: 'Av. Suba # 112-40', saldoPendiente: 200000 },
      { id: 'cli-5', negocioId: 'neg-1', nombre: 'David Ricardo Morales', telefono: '+57 301 999 8877', email: 'david.morales@correo.com', direccion: 'Calle 72 # 9-45', saldoPendiente: 0 },
      { id: 'cli-6', negocioId: 'neg-1', nombre: 'Carolina Restrepo', telefono: '+57 320 444 1122', email: 'carolina.restrepo@empresa.com', direccion: 'Av. 19 # 104-30', saldoPendiente: 0 }
    ],

    compras: [
      {
        id: 'comp-101',
        negocioId: 'neg-1',
        proveedorId: 'prov-1',
        proveedorNombre: 'Molinos del Valle S.A.S.',
        fecha: '2026-10-02',
        total: 2450000,
        montoPagado: 1000000,
        saldoPendiente: 1450000,
        estado: 'CONFIRMADA',
        observaciones: 'Bultos de harina fortificada panadera',
        detalles: [{ productoId: 'prod-mp-1', productoNombre: 'Harina de Trigo Especial', cantidad: 25, precioUnitario: 85000, subtotal: 2125000 }]
      },
      {
        id: 'comp-102',
        negocioId: 'neg-1',
        proveedorId: 'prov-2',
        proveedorNombre: 'Lácteos & Derivados del Prado',
        fecha: '2026-10-04',
        total: 1950000,
        montoPagado: 1200000,
        saldoPendiente: 750000,
        estado: 'CONFIRMADA',
        observaciones: 'Mantequilla pura 82% hojaldre',
        detalles: [{ productoId: 'prod-mp-4', productoNombre: 'Mantequilla Pura 82%', cantidad: 50, precioUnitario: 24000, subtotal: 1200000 }]
      },
      {
        id: 'comp-103',
        negocioId: 'neg-1',
        proveedorId: 'prov-3',
        proveedorNombre: 'Café Hacienda El Retiro',
        fecha: '2026-10-06',
        total: 1600000,
        montoPagado: 1600000,
        saldoPendiente: 0,
        estado: 'CONFIRMADA',
        observaciones: '50 kg café verde arábica en grano',
        detalles: [{ productoId: 'prod-mp-3', productoNombre: 'Café Espresso Grano', cantidad: 50, precioUnitario: 32000, subtotal: 1600000 }]
      },
      {
        id: 'comp-104',
        negocioId: 'neg-1',
        proveedorId: 'prov-4',
        proveedorNombre: 'Distribuidora La Cabaña (Azúcares)',
        fecha: '2026-10-08',
        total: 1200000,
        montoPagado: 700000,
        saldoPendiente: 500000,
        estado: 'CONFIRMADA',
        observaciones: 'Azúcar refinada y levadura prensada',
        detalles: [{ productoId: 'prod-mp-5', productoNombre: 'Azúcar Blanca Refinada', cantidad: 120, precioUnitario: 4500, subtotal: 540000 }]
      }
    ],

    ventas: [
      {
        id: 'vent-201',
        negocioId: 'neg-1',
        clienteId: 'cli-1',
        clienteNombre: 'Cafetería del Parque',
        fecha: '2026-10-14',
        tipoPago: 'CREDITO',
        metodoPago: 'Crédito 15 días',
        subtotal: 1200000,
        total: 1200000,
        saldoPendiente: 1200000,
        estado: 'PENDIENTE',
        notas: 'Entrega semanal mayorista de panadería',
        detalles: [
          { productoId: 'prod-pt-1', productoNombre: 'Croissant Francés de Mantequilla', cantidad: 100, precioUnitario: 6500, costoUnitario: 2800, subtotal: 650000 },
          { productoId: 'prod-pt-2', productoNombre: 'Pan Baguette Tradicional', cantidad: 110, precioUnitario: 5000, costoUnitario: 1900, subtotal: 550000 }
        ]
      },
      {
        id: 'vent-202',
        negocioId: 'neg-1',
        clienteId: 'cli-2',
        clienteNombre: 'Restaurante Bistro San Ángel',
        fecha: '2026-10-15',
        tipoPago: 'CREDITO',
        metodoPago: 'Crédito 30 días',
        subtotal: 1150000,
        total: 1150000,
        saldoPendiente: 1150000,
        estado: 'PENDIENTE',
        notas: 'Brunch y postres finos',
        detalles: [
          { productoId: 'prod-pt-4', productoNombre: 'Tarta Vasca de Queso (Porción)', cantidad: 50, precioUnitario: 12000, costoUnitario: 5100, subtotal: 600000 },
          { productoId: 'prod-pt-1', productoNombre: 'Croissant Francés de Mantequilla', cantidad: 80, precioUnitario: 6500, costoUnitario: 2800, subtotal: 520000 }
        ]
      },
      {
        id: 'vent-203',
        negocioId: 'neg-1',
        clienteId: 'cli-3',
        clienteNombre: 'Hotel Boutique Virrey',
        fecha: '2026-10-16',
        tipoPago: 'CREDITO',
        metodoPago: 'Crédito corporativo',
        subtotal: 650000,
        total: 650000,
        saldoPendiente: 650000,
        estado: 'PENDIENTE',
        notas: 'Desayunos ejecutivos buffet',
        detalles: [
          { productoId: 'prod-pt-1', productoNombre: 'Croissant Francés de Mantequilla', cantidad: 60, precioUnitario: 6500, costoUnitario: 2800, subtotal: 390000 },
          { productoId: 'prod-pt-3', productoNombre: 'Café Cappuccino 12oz', cantidad: 35, precioUnitario: 7500, costoUnitario: 2200, subtotal: 262500 }
        ]
      },
      {
        id: 'vent-204',
        negocioId: 'neg-1',
        clienteId: 'cli-4',
        clienteNombre: 'Catering & Eventos Gourmet',
        fecha: '2026-10-16',
        tipoPago: 'CREDITO',
        metodoPago: 'Crédito evento',
        subtotal: 200000,
        total: 200000,
        saldoPendiente: 200000,
        estado: 'PENDIENTE',
        notas: 'Mesa de café y panes dulces',
        detalles: [
          { productoId: 'prod-pt-6', productoNombre: 'Pain au Chocolat', cantidad: 20, precioUnitario: 7500, costoUnitario: 3100, subtotal: 150000 }
        ]
      },
      {
        id: 'vent-205',
        negocioId: 'neg-1',
        clienteId: 'cli-5',
        clienteNombre: 'David Ricardo Morales',
        fecha: '2026-10-17',
        tipoPago: 'CONTADO',
        metodoPago: 'Tarjeta Débito',
        subtotal: 48000,
        total: 48000,
        saldoPendiente: 0,
        estado: 'PAGADA',
        notas: 'Consumo presencial cafetería',
        detalles: [
          { productoId: 'prod-pt-3', productoNombre: 'Café Cappuccino 12oz', cantidad: 4, precioUnitario: 7500, costoUnitario: 2200, subtotal: 30000 },
          { productoId: 'prod-pt-1', productoNombre: 'Croissant Francés de Mantequilla', cantidad: 2, precioUnitario: 6500, costoUnitario: 2800, subtotal: 13000 }
        ]
      },
      {
        id: 'vent-206',
        negocioId: 'neg-1',
        clienteId: 'cli-6',
        clienteNombre: 'Carolina Restrepo',
        fecha: '2026-10-17',
        tipoPago: 'CONTADO',
        metodoPago: 'Efectivo',
        subtotal: 32000,
        total: 32000,
        saldoPendiente: 0,
        estado: 'PAGADA',
        notas: 'Mostrador',
        detalles: [
          { productoId: 'prod-pt-4', productoNombre: 'Tarta Vasca de Queso (Porción)', cantidad: 2, precioUnitario: 12000, costoUnitario: 5100, subtotal: 24000 }
        ]
      }
    ],

    pagosVenta: [
      { id: 'pago-v-1', negocioId: 'neg-1', ventaId: 'vent-201', clienteId: 'cli-1', clienteNombre: 'Cafetería del Parque', monto: 500000, fecha: '2026-10-18', metodoPago: 'Transferencia Bancolombia', notas: 'Abono anticipado factura mayorista' }
    ],

    gastosNegocio: [
      { id: 'gast-1', negocioId: 'neg-1', categoria: 'Arriendo', monto: 500000, fecha: '2026-10-05', descripcion: 'Arriendo local comercial Carrera 15' },
      { id: 'gast-2', negocioId: 'neg-1', categoria: 'Servicios públicos', monto: 240000, fecha: '2026-10-10', descripcion: 'Factura gas natural y energía trifásica horneado' },
      { id: 'gast-3', negocioId: 'neg-1', categoria: 'Mantenimiento', monto: 0, fecha: '2026-10-12', descripcion: 'Mantenimiento preventivo amortizado' }
    ],

    empleados: [
      { id: 'emp-1', negocioId: 'neg-1', nombre: 'Mateo Gómez Salazar', cargo: 'Maestro Panadero & Jefe de Producción', telefono: '+57 313 111 2233', salario: 950000, fechaIngreso: '2025-06-15', estado: 'ACTIVO' },
      { id: 'emp-2', negocioId: 'neg-1', nombre: 'Valentina Ruiz Peña', cargo: 'Barista & Atención al Cliente', telefono: '+57 316 444 5566', salario: 650000, fechaIngreso: '2025-09-01', estado: 'ACTIVO' }
    ],

    pagosEmpleado: [
      { id: 'pago-emp-1', negocioId: 'neg-1', empleadoId: 'emp-1', empleadoNombre: 'Mateo Gómez Salazar', monto: 950000, concepto: 'Nómina mensual panadería', periodo: '2026-10', fecha: '2026-10-15', metodoPago: 'Transferencia' },
      { id: 'pago-emp-2', negocioId: 'neg-1', empleadoId: 'emp-2', empleadoNombre: 'Valentina Ruiz Peña', monto: 650000, concepto: 'Nómina mensual cafetería', periodo: '2026-10', fecha: '2026-10-15', metodoPago: 'Transferencia' }
    ],

    movimientosInventario: [
      { id: 'mov-inv-1', negocioId: 'neg-1', productoId: 'prod-mp-1', productoNombre: 'Harina de Trigo Especial', tipo: 'ENTRADA', cantidad: 50, stockAnterior: 10, stockPosterior: 60, motivo: 'Recepción compra Molinos del Valle', fecha: '2026-10-02' },
      { id: 'mov-inv-2', negocioId: 'neg-1', productoId: 'prod-pt-1', productoNombre: 'Croissant Francés de Mantequilla', tipo: 'PRODUCCION', cantidad: 80, stockAnterior: 20, stockPosterior: 100, motivo: 'Lote matutino hojaldre francés', fecha: '2026-10-14' },
      { id: 'mov-inv-3', negocioId: 'neg-1', productoId: 'prod-pt-1', productoNombre: 'Croissant Francés de Mantequilla', tipo: 'SALIDA', cantidad: 35, stockAnterior: 100, stockPosterior: 65, motivo: 'Venta despachos y vitrina', fecha: '2026-10-15' }
    ],

    formulas: [
      {
        id: 'form-1',
        negocioId: 'neg-1',
        productoId: 'prod-pt-1',
        productoNombre: 'Croissant Francés de Mantequilla',
        nombre: 'Receta Croissant Tradicional x 20 uds',
        cantidadBase: 20,
        descripcion: 'Hojaldre 100% mantequilla pura fermentado 18h',
        ingredientes: [
          { materiaPrimaId: 'prod-mp-1', materiaPrimaNombre: 'Harina de Trigo Especial', cantidadRequerida: 1.2, unidadMedida: 'kg' },
          { materiaPrimaId: 'prod-mp-4', materiaPrimaNombre: 'Mantequilla Pura 82%', cantidadRequerida: 0.65, unidadMedida: 'kg' },
          { materiaPrimaId: 'prod-mp-2', materiaPrimaNombre: 'Levadura Fresca', cantidadRequerida: 0.05, unidadMedida: 'kg' },
          { materiaPrimaId: 'prod-mp-5', materiaPrimaNombre: 'Azúcar Blanca Refinada', cantidadRequerida: 0.15, unidadMedida: 'kg' }
        ]
      }
    ],

    producciones: [
      { id: 'prod-lot-1', negocioId: 'neg-1', formulaId: 'form-1', formulaNombre: 'Receta Croissant Tradicional x 20 uds', productoId: 'prod-pt-1', productoNombre: 'Croissant Francés de Mantequilla', cantidadProducida: 80, costoTotal: 224000, costoUnitario: 2800, fecha: '2026-10-14', estado: 'COMPLETADA', notas: 'Lote matutino crujiente y dorado' }
    ]
  };

  window.FinanzasDemoData = demoState;
  window.INITIAL_STATE = demoState;
})();
