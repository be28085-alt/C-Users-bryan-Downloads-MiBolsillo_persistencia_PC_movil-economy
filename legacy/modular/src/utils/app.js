/**
 * ============================================================================
 * PROYECTO: MiBolsillo · Control de Finanzas Personales
 * SISTEMA: Arquitectura Modular basada en las 8 Pantallas del Diseño Móvil
 * ASIGNATURA: Fundamentos de Programación / Algoritmos - Semestre I
 * ============================================================================
 */

// CLAVE DE PERSISTENCIA LOCAL
const STORAGE_KEY = 'FINANZAS_ETAPA_DATA_V2';

// Categorías de Gastos e Ingresos con sus iconos oficiales del diseño
const CATEGORIAS_GASTO = [
  { id: 'Alimentación', nombre: 'Alimentación', icon: '🛒' },
  { id: 'Transporte', nombre: 'Transporte', icon: '🚌' },
  { id: 'Ocio', nombre: 'Ocio', icon: '☕' },
  { id: 'Vivienda', nombre: 'Vivienda', icon: '🏠' },
  { id: 'Sanidad', nombre: 'Sanidad', icon: '⚕️' },
  { id: 'Otros', nombre: 'Otros', icon: '···' }
];

const CATEGORIAS_INGRESO = [
  { id: 'Salario', nombre: 'Salario', icon: '💼' },
  { id: 'Ventas', nombre: 'Ventas', icon: '🏷️' },
  { id: 'Freelance', nombre: 'Freelance', icon: '💻' },
  { id: 'Inversiones', nombre: 'Inversión', icon: '📈' },
  { id: 'Mesada', nombre: 'Apoyo', icon: '🤝' },
  { id: 'Otros', nombre: 'Otros', icon: '✨' }
];

// DATOS INICIALES EXACTOS AL DISEÑO DE REFERENCIA
const INITIAL_STATE = {
  usuario: {
    nombre: 'Lucía Martín',
    email: 'lucia.martin@email.com',
    iniciales: 'LM',
    moneda: 'COP',
    alertasPresupuesto: true,
    recordatoriosDeudas: true
  },
  saldoOculto: false,
  mesActual: 'Octubre de 2026',
  presupuestoMensual: 1950000,
  
  // Lista de Movimientos detallados (Pantalla 1 y 3)
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
      tipo: 'INGRESO',
      concepto: 'Abono de transporte',
      categoria: 'Transporte',
      cuenta: 'Principal',
      valor: 135000,
      fecha: '2026-10-14',
      grupoFecha: 'AYER, 14 OCTUBRE'
    },
    {
      id: 'tx-4',
      tipo: 'INGRESO',
      concepto: 'Nómina de octubre',
      categoria: 'Salario',
      cuenta: 'Principal',
      valor: 2900000,
      fecha: '2026-10-01',
      grupoFecha: '1 OCTUBRE'
    },
    {
      id: 'tx-5',
      tipo: 'INGRESO',
      concepto: 'Trabajo consultoría adicional',
      categoria: 'Freelance',
      cuenta: 'Principal',
      valor: 2165000,
      fecha: '2026-10-01',
      grupoFecha: '1 OCTUBRE'
    },
    {
      id: 'tx-6',
      tipo: 'GASTO',
      concepto: 'Alquiler',
      categoria: 'Vivienda',
      cuenta: 'Principal',
      valor: 890000,
      fecha: '2026-10-01',
      grupoFecha: '1 OCTUBRE'
    },
    {
      id: 'tx-7',
      tipo: 'GASTO',
      concepto: 'Mercado grande quincena',
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
      concepto: 'Tarjeta de transporte masivo',
      categoria: 'Transporte',
      cuenta: 'Principal',
      valor: 125000,
      fecha: '2026-10-08',
      grupoFecha: '8 OCTUBRE'
    },
    {
      id: 'tx-10',
      tipo: 'GASTO',
      concepto: 'Salida a cenar y cine',
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
      valor: 85000,
      fecha: '2026-10-12',
      grupoFecha: '12 OCTUBRE'
    }
  ],

  // Metas de Ahorro (Pantalla 5)
  metas: [
    {
      id: 'meta-1',
      nombre: 'Fondo de tranquilidad',
      plazo: 'Para abril de 2027',
      objetivo: 3000000,
      ahorrado: 1800000
    },
    {
      id: 'meta-2',
      nombre: 'Escapada a Portugal',
      plazo: 'Para verano de 2027',
      objetivo: 1200000,
      ahorrado: 650000
    },
    {
      id: 'meta-3',
      nombre: 'Curso de fotografía',
      plazo: 'Para dic. de 2027',
      objetivo: 700000,
      ahorrado: 300000
    }
  ],

  // Deudas y Pasivos (Pantalla 6)
  deudas: [
    {
      id: 'deuda-1',
      nombre: 'Portátil',
      condiciones: 'Financiación sin intereses · 0% TIN',
      valorInicial: 1440000,
      saldoPendiente: 960000,
      proximoPago: '1 nov.',
      cuotaMensual: 80000
    },
    {
      id: 'deuda-2',
      nombre: 'Tratamiento dental',
      condiciones: 'Pago a plazos · 5% TIN',
      valorInicial: 600000,
      saldoPendiente: 300000,
      proximoPago: '20 oct.',
      cuotaMensual: 75000
    }
  ]
};

// ESTADO GLOBAL EN MEMORIA
let state = { ...INITIAL_STATE };
let chartInstance = null;
let currentModalType = 'GASTO';
let currentCategorySelected = 'Alimentación';
let currentMovementFilter = 'TODOS';
let exportFormatSelected = 'PDF';

// ============================================================================
// FÓRMULAS MATEMÁTICAS OBLIGATORIAS (Requisitos del Proyecto)
// ============================================================================

function calcularTotalIngresos() {
  return state.movimientos
    .filter(m => m.tipo === 'INGRESO')
    .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
}

function calcularTotalGastos() {
  return state.movimientos
    .filter(m => m.tipo === 'GASTO')
    .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
}

function calcularDineroDisponible() {
  return calcularTotalIngresos() - calcularTotalGastos();
}

function calcularTotalAhorroMetas() {
  return state.metas.reduce((acc, curr) => acc + (Number(curr.ahorrado) || 0), 0);
}

function calcularTotalDeudasPendientes() {
  return state.deudas.reduce((acc, curr) => acc + (Number(curr.saldoPendiente) || 0), 0);
}

function calcularPorcentajeAhorro() {
  const ingresos = calcularTotalIngresos();
  if (ingresos <= 0) return 0.0;
  const ahorro = calcularTotalAhorroMetas();
  return Number(((ahorro / ingresos) * 100).toFixed(1));
}

function calcularAvanceMeta(ahorrado, objetivo) {
  if (objetivo <= 0) return 0.0;
  let avance = (ahorrado / objetivo) * 100;
  return Number(Math.min(avance, 100).toFixed(1));
}

// FORMATEO MONEDAS EN PESOS COLOMBIANOS (COP)
function formatearCOP(monto) {
  const entero = Math.round(Number(monto) || 0);
  const formateado = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0
  }).format(entero);
  return `${formateado} COP`;
}

// ============================================================================
// CONTROLADOR PRINCIPAL DE LA APLICACIÓN
// ============================================================================

const app = {
  init() {
    this.cargarDatos();
    this.configurarFechaHoy();
    this.renderizarTodo();
    this.configurarResponsiveEvents();
  },

  cargarDatos() {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        state = JSON.parse(guardado);
      } else {
        state = JSON.parse(JSON.stringify(INITIAL_STATE));
        this.guardarDatos();
      }
    } catch (e) {
      console.warn('Error leyendo localStorage, usando datos por defecto', e);
      state = JSON.parse(JSON.stringify(INITIAL_STATE));
    }
  },

  guardarDatos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error guardando en localStorage', e);
    }
  },

  cargarDemoData() {
    state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.guardarDatos();
    this.renderizarTodo();
    this.mostrarToast('Datos de referencia restaurados con éxito');
  },

  restablecerDatos() {
    if (confirm('¿Restablecer todos los datos a cero?')) {
      state.movimientos = [];
      state.metas = [];
      state.deudas = [];
      state.presupuestoMensual = 0;
      this.guardarDatos();
      this.renderizarTodo();
      this.mostrarToast('Datos restablecidos a cero');
    }
  },

  configurarFechaHoy() {
    const inputFecha = document.getElementById('inputFecha');
    if (inputFecha) {
      const hoy = new Date().toISOString().split('T')[0];
      inputFecha.value = hoy;
    }
    const inputAporteFecha = document.getElementById('aporteMetaFecha');
    if (inputAporteFecha) {
      inputAporteFecha.value = new Date().toISOString().split('T')[0];
    }
    const inputAbonoFecha = document.getElementById('abonoDeudaFecha');
    if (inputAbonoFecha) {
      inputAbonoFecha.value = new Date().toISOString().split('T')[0];
    }
  },

  // ==========================================================================
  // NAVEGACIÓN Y CAMBIO DE PANTALLAS
  // ==========================================================================
  switchTab(tabId, subtab = null) {
    // 1. Desactivar vistas activas
    document.querySelectorAll('.screen-view').forEach(view => {
      view.classList.remove('active');
    });

    // 2. Activar la vista seleccionada
    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) {
      targetView.classList.add('active');
    }

    // 3. Actualizar barra de navegación inferior
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    // Si tiene subpestaña (como en "Mi plan")
    if (tabId === 'plan' && subtab) {
      this.switchPlanSubtab(subtab);
    }

    // Si va a informes, redibujar gráfico Chart.js
    if (tabId === 'informes') {
      setTimeout(() => this.renderizarGraficoInformes(), 50);
    }

    // Scroll arriba suave
    const container = document.getElementById('screensContainer');
    if (container) container.scrollTop = 0;
  },

  switchPlanSubtab(subtabId) {
    // Actualizar botones de subpestaña
    document.querySelectorAll('.segment-tab').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-subtab') === subtabId);
    });

    // Actualizar subpanes
    document.querySelectorAll('.plan-subpane').forEach(p => {
      p.classList.remove('active');
    });

    const targetSub = document.getElementById(`subpane-${subtabId}`);
    if (targetSub) {
      targetSub.classList.add('active');
    }

    // Actualizar subtítulo en la cabecera
    const subLabels = {
      presupuestos: 'QUÉ EN LUGAR DE ESTÁ PASO',
      metas: 'AHORRA PARA LO QUE IMPORTA',
      deudas: 'MÁS CLARIDAD, MENOS CARGAS'
    };
    const lbl = document.getElementById('lblPlanHeaderSub');
    if (lbl && subLabels[subtabId]) {
      lbl.textContent = subLabels[subtabId];
    }
  },

  cambiarMes(delta) {
    this.mostrarToast(`Visualizando periodo: Octubre de 2026`);
  },

  toggleBalanceVisibility() {
    state.saldoOculto = !state.saldoOculto;
    this.guardarDatos();
    this.renderizarDashboard();
  },

  // ==========================================================================
  // RENDERIZADO GLOBAL DE LA APLICACIÓN
  // ==========================================================================
  renderizarTodo() {
    this.renderizarUsuario();
    this.renderizarDashboard();
    this.renderizarMovimientos();
    this.renderizarPresupuestos();
    this.renderizarMetas();
    this.renderizarDeudas();
    this.renderizarInformes();
  },

  renderizarUsuario() {
    const user = state.usuario;
    document.getElementById('lblUserNombre').textContent = user.nombre.split(' ')[0] || 'Lucía';
    document.getElementById('lblAvatarInitials').textContent = user.iniciales || 'LM';
    document.getElementById('profileAvatarBig').textContent = user.iniciales || 'LM';
    document.getElementById('profileName').textContent = user.nombre;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('chkAlertasPresupuesto').checked = user.alertasPresupuesto;
    document.getElementById('chkRecordatoriosDeudas').checked = user.recordatoriosDeudas;
  },

  // RENDER PANTALLA 1: DASHBOARD
  renderizarDashboard() {
    const totalIngresos = calcularTotalIngresos();
    const totalGastos = calcularTotalGastos();
    const saldoTotal = calcularDineroDisponible();

    // Saldo Total con soporte para ocultar
    const lblBalance = document.getElementById('lblHeroBalance');
    if (state.saldoOculto) {
      lblBalance.textContent = '•••••••• COP';
    } else {
      lblBalance.textContent = formatearCOP(saldoTotal);
    }

    document.getElementById('lblHeroIngresos').textContent = `+${formatearCOP(totalIngresos)}`;
    document.getElementById('lblHeroGastos').textContent = `-${formatearCOP(totalGastos)}`;

    // Mini Card de Presupuesto
    const presupuesto = state.presupuestoMensual || 1950000;
    const porcentajeGastado = presupuesto > 0 ? Math.min(Math.round((totalGastos / presupuesto) * 100), 100) : 0;
    const dineroRestante = Math.max(presupuesto - totalGastos, 0);

    document.getElementById('lblBudgetCardPercent').textContent = `${porcentajeGastado} %`;
    document.getElementById('barBudgetCard').style.width = `${porcentajeGastado}%`;
    document.getElementById('lblBudgetCardRemaining').textContent = 
      `Te quedan ${formatearCOP(dineroRestante)} para este mes...`;

    // Alertas Lógicas Proposicionales (P: Gastos > Ingresos, Q: Gastos > Presupuesto)
    const alertBox = document.getElementById('dashboardAlertsArea');
    alertBox.innerHTML = '';

    if (totalGastos > totalIngresos && totalIngresos > 0) {
      const banner = document.createElement('div');
      banner.className = 'reminder-card-notice';
      banner.style.background = '#fef2f2';
      banner.style.borderColor = '#fecaca';
      banner.innerHTML = `
        <span class="reminder-icon">⚠️</span>
        <p style="color: #991b1b;">
          <strong>Alerta de Déficit:</strong> Tus gastos (${formatearCOP(totalGastos)}) superan tus ingresos registrados. Reduzca consumos no esenciales.
        </p>
      `;
      alertBox.appendChild(banner);
    } else if (presupuesto > 0 && totalGastos >= presupuesto) {
      const banner = document.createElement('div');
      banner.className = 'reminder-card-notice';
      banner.style.background = '#fffbeb';
      banner.style.borderColor = '#fde68a';
      banner.innerHTML = `
        <span class="reminder-icon">🔔</span>
        <p style="color: #92400e;">
          <strong>Límite Superado:</strong> Has alcanzado el 100% de tu presupuesto fijado para octubre.
        </p>
      `;
      alertBox.appendChild(banner);
    }

    // Últimos movimientos (primeros 3 o 4)
    const containerRecent = document.getElementById('listRecentTransactions');
    containerRecent.innerHTML = '';

    const ultimos = [...state.movimientos].slice(0, 3);
    if (ultimos.length === 0) {
      containerRecent.innerHTML = '<p style="color: #7b8e96; font-size: 0.8rem; text-align: center; padding: 1rem;">No hay movimientos recientes.</p>';
      return;
    }

    ultimos.forEach(tx => {
      const esIngreso = tx.tipo === 'INGRESO';
      const icon = this.obtenerIconoCategoria(tx.categoria, tx.tipo);
      
      const itemRow = document.createElement('div');
      itemRow.className = 'transaction-item-row';
      itemRow.innerHTML = `
        <div class="tx-left">
          <div class="tx-icon-box">${icon}</div>
          <div class="tx-info">
            <strong>${tx.concepto}</strong>
            <small>${tx.categoria} · ${tx.cuenta || 'Principal'}</small>
          </div>
        </div>
        <div class="tx-amount ${esIngreso ? 'text-income' : 'text-expense'}">
          ${esIngreso ? '+' : '-'}${formatearCOP(tx.valor)}
        </div>
      `;
      containerRecent.appendChild(itemRow);
    });
  },

  // RENDER PANTALLA 3: HISTORIAL DE MOVIMIENTOS
  renderizarMovimientos() {
    const totalIngresos = calcularTotalIngresos();
    const totalGastos = calcularTotalGastos();

    document.getElementById('lblMovTotalIngresos').textContent = `$ ${formatearCOP(totalIngresos)}`;
    document.getElementById('lblMovTotalGastos').textContent = `$ ${formatearCOP(totalGastos)}`;
    document.getElementById('lblMovCountIngresos').textContent = `${state.movimientos.length} movimientos este mes`;

    this.filtrarMovimientos();
  },

  setFiltroTipo(tipo) {
    currentMovementFilter = tipo;
    document.querySelectorAll('.chip-filter').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === tipo);
    });
    this.filtrarMovimientos();
  },

  filtrarMovimientos() {
    const busqueda = (document.getElementById('inputSearchMovement').value || '').toLowerCase();
    const container = document.getElementById('containerGroupedTransactions');
    container.innerHTML = '';

    // Filtrar por tipo y por texto
    const filtrados = state.movimientos.filter(m => {
      if (currentMovementFilter !== 'TODOS' && m.tipo !== currentMovementFilter) {
        return false;
      }
      if (busqueda) {
        const conc = (m.concepto || '').toLowerCase();
        const cat = (m.categoria || '').toLowerCase();
        if (!conc.includes(busqueda) && !cat.includes(busqueda)) {
          return false;
        }
      }
      return true;
    });

    if (filtrados.length === 0) {
      container.innerHTML = '<div class="section-card text-center" style="color: #7b8e96; font-size: 0.82rem; padding: 1.5rem;">No se encontraron movimientos.</div>';
      return;
    }

    // Agrupar por grupoFecha
    const grupos = {};
    filtrados.forEach(m => {
      const g = m.grupoFecha || 'OCTUBRE';
      if (!grupos[g]) grupos[g] = [];
      grupos[g].push(m);
    });

    for (const [fechaLabel, lista] of Object.entries(grupos)) {
      const groupBlock = document.createElement('div');
      groupBlock.className = 'group-date-block';

      const header = document.createElement('div');
      header.className = 'group-date-header';
      header.textContent = fechaLabel;
      groupBlock.appendChild(header);

      const cardBox = document.createElement('div');
      cardBox.className = 'group-card-box';

      lista.forEach(tx => {
        const esIngreso = tx.tipo === 'INGRESO';
        const icon = this.obtenerIconoCategoria(tx.categoria, tx.tipo);

        const row = document.createElement('div');
        row.className = 'transaction-item-row';
        row.innerHTML = `
          <div class="tx-left">
            <div class="tx-icon-box">${icon}</div>
            <div class="tx-info">
              <strong>${tx.concepto}</strong>
              <small>${tx.categoria} · ${tx.cuenta || 'Principal'}</small>
            </div>
          </div>
          <div style="display: flex; align-items: center;">
            <span class="tx-amount ${esIngreso ? 'text-income' : 'text-expense'}">
              ${esIngreso ? '+' : '-'}${formatearCOP(tx.valor)}
            </span>
            <button class="btn-del-tx" title="Eliminar movimiento" onclick="app.eliminarMovimiento('${tx.id}')">✕</button>
          </div>
        `;
        cardBox.appendChild(row);
      });

      groupBlock.appendChild(cardBox);
      container.appendChild(groupBlock);
    }
  },

  eliminarMovimiento(id) {
    if (confirm('¿Eliminar este movimiento?')) {
      state.movimientos = state.movimientos.filter(m => m.id !== id);
      this.guardarDatos();
      this.renderizarTodo();
      this.mostrarToast('Movimiento eliminado');
    }
  },

  // RENDER PANTALLA 4: PRESUPUESTOS
  renderizarPresupuestos() {
    const totalGastos = calcularTotalGastos();
    const presupuesto = state.presupuestoMensual || 1950000;
    const porcentaje = presupuesto > 0 ? Math.min(Math.round((totalGastos / presupuesto) * 100), 100) : 0;
    const disponible = Math.max(presupuesto - totalGastos, 0);

    document.getElementById('lblBudgetHeroCurrent').textContent = formatearCOP(totalGastos);
    document.getElementById('lblBudgetHeroLimit').textContent = `/ ${formatearCOP(presupuesto)}`;
    document.getElementById('barBudgetHero').style.width = `${porcentaje}%`;
    document.getElementById('lblBudgetHeroAvailable').textContent = 
      `${formatearCOP(disponible)} disponibles · 15 días por delante`;

    // Lista de categorías con presupuestos asignados
    const listContainer = document.getElementById('listCategoriesBudget');
    listContainer.innerHTML = '';

    const limitesPorCategoria = {
      'Vivienda': 1100000,
      'Alimentación': 500000,
      'Transporte': 150000,
      'Ocio': 200000,
      'Sanidad': 150000,
      'Otros': 100000
    };

    // Calcular gasto acumulado por categoría
    const gastosPorCat = {};
    state.movimientos.filter(m => m.tipo === 'GASTO').forEach(g => {
      gastosPorCat[g.categoria] = (gastosPorCat[g.categoria] || 0) + (Number(g.valor) || 0);
    });

    for (const [catName, limite] of Object.entries(limitesPorCategoria)) {
      const gastado = gastosPorCat[catName] || 0;
      const pct = Math.min(Math.round((gastado / limite) * 100), 100);

      const row = document.createElement('div');
      row.className = 'category-budget-row';
      row.innerHTML = `
        <div class="cat-row-top">
          <span class="cat-name">${catName}</span>
          <span class="cat-values">${formatearCOP(gastado)} / ${formatearCOP(limite)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar-fill" style="width: ${pct}%;"></div>
        </div>
      `;
      listContainer.appendChild(row);
    }
  },

  // RENDER PANTALLA 5: METAS DE AHORRO
  renderizarMetas() {
    const totalAhorrado = calcularTotalAhorroMetas();
    document.getElementById('lblMetasTotalAhorrado').textContent = formatearCOP(totalAhorrado);
    document.getElementById('lblMetasCount').textContent = `${state.metas.length} metas`;

    const stack = document.getElementById('listMetasCards');
    stack.innerHTML = '';

    if (state.metas.length === 0) {
      stack.innerHTML = '<p style="color: #7b8e96; font-size: 0.8rem; text-align: center; padding: 1rem;">No tienes metas de ahorro activas.</p>';
      return;
    }

    state.metas.forEach(meta => {
      const avance = calcularAvanceMeta(meta.ahorrado, meta.objetivo);

      const card = document.createElement('div');
      card.className = 'goal-card-item';
      card.innerHTML = `
        <div class="goal-header-top">
          <div class="goal-title-group">
            <h4>${meta.nombre}</h4>
            <small>${meta.plazo || 'Meta personal'}</small>
          </div>
          <button class="btn-del-tx" title="Eliminar meta" onclick="app.eliminarMeta('${meta.id}')">✕</button>
        </div>
        <div class="goal-amounts-row">
          <strong>${formatearCOP(meta.ahorrado)}</strong>
          <span>de ${formatearCOP(meta.objetivo)} (${avance}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar-fill" style="width: ${avance}%;"></div>
        </div>
        <button class="btn-action-aporte" onclick="app.openModalAporteMeta('${meta.id}', '${meta.nombre}')">
          + Aportar a esta meta
        </button>
      `;
      stack.appendChild(card);
    });
  },

  eliminarMeta(id) {
    if (confirm('¿Eliminar esta meta de ahorro?')) {
      state.metas = state.metas.filter(m => m.id !== id);
      this.guardarDatos();
      this.renderizarTodo();
      this.mostrarToast('Meta de ahorro eliminada');
    }
  },

  // RENDER PANTALLA 6: DEUDAS
  renderizarDeudas() {
    const totalDeudas = calcularTotalDeudasPendientes();
    document.getElementById('lblDeudasTotalPendiente').textContent = formatearCOP(totalDeudas);

    const stack = document.getElementById('listDeudasCards');
    stack.innerHTML = '';

    if (state.deudas.length === 0) {
      stack.innerHTML = '<p style="color: #7b8e96; font-size: 0.8rem; text-align: center; padding: 1rem;">No tienes deudas registradas.</p>';
      return;
    }

    state.deudas.forEach(deuda => {
      const saldo = deuda.saldoPendiente || 0;
      const inicial = deuda.valorInicial || saldo;
      const pagado = Math.max(inicial - saldo, 0);
      const porcentajePagado = inicial > 0 ? Math.min(Math.round((pagado / inicial) * 100), 100) : 0;

      const card = document.createElement('div');
      card.className = 'debt-card-row';
      card.innerHTML = `
        <div class="debt-header-top">
          <div class="debt-title-group">
            <h4>${deuda.nombre}</h4>
            <small>${deuda.condiciones || 'Obligación a plazos'}</small>
          </div>
          <button class="btn-del-tx" title="Eliminar deuda" onclick="app.eliminarDeuda('${deuda.id}')">✕</button>
        </div>
        <div class="debt-balance-row">
          <strong>${formatearCOP(saldo)}</strong>
          <small>de ${formatearCOP(inicial)} inicial</small>
        </div>
        <div class="progress-track">
          <div class="progress-bar-fill" style="width: ${porcentajePagado}%;"></div>
        </div>
        <div class="debt-footer-row">
          <span>Próximo pago: ${deuda.proximoPago || 'Mensual'}</span>
          <button class="btn-action-aporte" onclick="app.openModalAbonoDeuda('${deuda.id}', '${deuda.nombre}', ${saldo})">
            Abonar ${formatearCOP(deuda.cuotaMensual || 80000)}
          </button>
        </div>
      `;
      stack.appendChild(card);
    });
  },

  eliminarDeuda(id) {
    if (confirm('¿Eliminar esta deuda?')) {
      state.deudas = state.deudas.filter(d => d.id !== id);
      this.guardarDatos();
      this.renderizarTodo();
      this.mostrarToast('Deuda eliminada');
    }
  },

  // RENDER PANTALLA 7: INFORMES Y GRÁFICOS
  renderizarInformes() {
    const totalIngresos = calcularTotalIngresos();
    const totalGastos = calcularTotalGastos();
    const balance = totalIngresos - totalGastos;
    const tasaConservada = totalIngresos > 0 ? ((balance / totalIngresos) * 100).toFixed(1) : 0;

    const lblAmount = document.getElementById('lblReportBalanceAmount');
    lblAmount.textContent = `${balance >= 0 ? '+' : ''}${formatearCOP(balance)}`;
    lblAmount.className = `report-box-amount ${balance >= 0 ? 'text-income' : 'text-expense'}`;

    document.getElementById('lblReportSavingsRate').textContent = 
      `Conservas el ${tasaConservada} % de tus ingresos`;

    document.getElementById('lblReportTotalSpent').textContent = formatearCOP(totalGastos);

    // Calcular distribución de gastos
    const gastosPorCat = {};
    state.movimientos.filter(m => m.tipo === 'GASTO').forEach(g => {
      gastosPorCat[g.categoria] = (gastosPorCat[g.categoria] || 0) + (Number(g.valor) || 0);
    });

    // Barra segmentada multicolor
    const barSegmented = document.getElementById('barReportSegmented');
    barSegmented.innerHTML = '';

    const colors = ['#133842', '#2c6975', '#4f8591', '#7b9da5', '#a4bcc2', '#ccd8dc'];
    let idx = 0;

    const categoriesGrid = document.getElementById('gridReportCategories');
    categoriesGrid.innerHTML = '';

    for (const [catName, valor] of Object.entries(gastosPorCat)) {
      const pct = totalGastos > 0 ? (valor / totalGastos) * 100 : 0;
      const c = colors[idx % colors.length];
      idx++;

      // Segmento de barra
      const seg = document.createElement('div');
      seg.className = 'segment-item';
      seg.style.width = `${pct}%`;
      seg.style.backgroundColor = c;
      barSegmented.appendChild(seg);

      // Elemento en la cuadrícula
      const repItem = document.createElement('div');
      repItem.className = 'rep-cat-item';
      repItem.innerHTML = `
        <span>• ${catName}</span>
        <strong>${formatearCOP(valor)}</strong>
      `;
      categoriesGrid.appendChild(repItem);
    }
  },

  renderizarGraficoInformes() {
    const canvas = document.getElementById('canvasChartPerspective');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const totalIngresos = calcularTotalIngresos();
    const totalGastos = calcularTotalGastos();

    // Comparativa mensual simulada de 3 meses para contextualizar como en la imagen
    const labels = ['Ago', 'Sep', 'Oct'];
    const dataIngresos = [4800000, 5000000, totalIngresos];
    const dataGastos = [2100000, 1950000, totalGastos];

    chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Ingresos',
            data: dataIngresos,
            backgroundColor: '#133842',
            borderRadius: 6,
            barPercentage: 0.6
          },
          {
            label: 'Gastos',
            data: dataGastos,
            backgroundColor: '#a3bcc3',
            borderRadius: 6,
            barPercentage: 0.6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatearCOP(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => (val / 1000000).toFixed(1) + 'M'
            },
            grid: { color: '#eef2f5' }
          }
        }
      }
    });
  },

  // ==========================================================================
  // MODAL REGISTRAR MOVIMIENTO (PANTALLA 2)
  // ==========================================================================
  openModalRegistrar() {
    document.getElementById('modalRegistrar').classList.remove('hidden');
    this.setMovementType('GASTO');
    this.configurarFechaHoy();
    document.getElementById('inputMonto').value = '';
    document.getElementById('inputConcepto').value = '';
    this.recalcularImpactoSaldo();
  },

  closeModalRegistrar() {
    document.getElementById('modalRegistrar').classList.add('hidden');
  },

  setMovementType(type) {
    currentModalType = type;
    const btnGasto = document.getElementById('btnTypeGasto');
    const btnIngreso = document.getElementById('btnTypeIngreso');
    const btnSave = document.getElementById('btnSaveMovement');

    if (type === 'GASTO') {
      btnGasto.classList.add('active');
      btnIngreso.classList.remove('active');
      btnSave.textContent = '✔ Guardar gasto';
    } else {
      btnIngreso.classList.add('active');
      btnGasto.classList.remove('active');
      btnSave.textContent = '✔ Guardar ingreso';
    }

    this.renderizarTilesCategorias(type);
    this.recalcularImpactoSaldo();
  },

  renderizarTilesCategorias(type) {
    const grid = document.getElementById('categoryTilesGrid');
    grid.innerHTML = '';

    const list = type === 'GASTO' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;
    currentCategorySelected = list[0].id;

    list.forEach((cat, index) => {
      const tile = document.createElement('div');
      tile.className = `cat-tile ${index === 0 ? 'selected' : ''}`;
      tile.innerHTML = `
        <span class="cat-tile-icon">${cat.icon}</span>
        <span class="cat-tile-name">${cat.nombre}</span>
      `;
      tile.onclick = () => {
        document.querySelectorAll('.cat-tile').forEach(t => t.classList.remove('selected'));
        tile.classList.add('selected');
        currentCategorySelected = cat.id;
      };
      grid.appendChild(tile);
    });
  },

  recalcularImpactoSaldo() {
    const inputMonto = parseFloat(document.getElementById('inputMonto').value) || 0;
    const saldoActual = calcularDineroDisponible();
    let saldoResultante = saldoActual;

    if (currentModalType === 'GASTO') {
      saldoResultante = saldoActual - inputMonto;
    } else {
      saldoResultante = saldoActual + inputMonto;
    }

    const labelNotice = document.getElementById('lblBalanceImpact');
    labelNotice.innerHTML = `Tu saldo quedará en <strong>${formatearCOP(saldoResultante)}</strong>`;
  },

  handleGuardarMovimiento(e) {
    e.preventDefault();
    const monto = parseFloat(document.getElementById('inputMonto').value);
    const concepto = document.getElementById('inputConcepto').value.trim();
    const fecha = document.getElementById('inputFecha').value;
    const cuenta = document.getElementById('selectCuenta').value;

    if (isNaN(monto) || monto <= 0 || !concepto || !fecha) {
      this.mostrarToast('Por favor completa todos los campos requeridos');
      return;
    }

    const nuevo = {
      id: 'tx-' + Date.now(),
      tipo: currentModalType,
      concepto,
      categoria: currentCategorySelected,
      cuenta,
      valor: monto,
      fecha,
      grupoFecha: 'HOY, ' + new Date().getDate() + ' OCTUBRE'
    };

    state.movimientos.unshift(nuevo);
    this.guardarDatos();
    this.closeModalRegistrar();
    this.renderizarTodo();
    this.mostrarToast(`${currentModalType === 'GASTO' ? 'Gasto' : 'Ingreso'} de ${formatearCOP(monto)} guardado`);
  },

  obtenerIconoCategoria(nombreCat, tipo) {
    const lista = tipo === 'GASTO' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;
    const hallado = lista.find(c => c.id === nombreCat);
    if (hallado) return hallado.icon;
    return tipo === 'GASTO' ? '💸' : '💰';
  },

  // ==========================================================================
  // MODALES SECUNDARIOS: METAS, DEUDAS Y PRESUPUESTO
  // ==========================================================================
  openModalNuevaMeta() {
    document.getElementById('modalMeta').classList.remove('hidden');
  },
  closeModalMeta() {
    document.getElementById('modalMeta').classList.add('hidden');
  },
  handleGuardarMeta(e) {
    e.preventDefault();
    const nombre = document.getElementById('metaNombre').value.trim();
    const objetivo = parseFloat(document.getElementById('metaMontoObjetivo').value);
    const plazo = document.getElementById('metaFechaLimite').value.trim();
    const inicial = parseFloat(document.getElementById('metaAporteInicial').value) || 0;

    if (!nombre || isNaN(objetivo) || objetivo <= 0) return;

    state.metas.push({
      id: 'meta-' + Date.now(),
      nombre,
      plazo: plazo || 'Meta personal',
      objetivo,
      ahorrado: inicial
    });

    this.guardarDatos();
    this.closeModalMeta();
    this.renderizarMetas();
    this.renderizarDashboard();
    this.mostrarToast(`Meta "${nombre}" creada`);
  },

  openModalAporteMeta(metaId, metaNombre) {
    document.getElementById('aporteMetaId').value = metaId;
    document.getElementById('lblAporteMetaTitulo').textContent = `Aportar a "${metaNombre}"`;
    document.getElementById('modalAporteMeta').classList.remove('hidden');
  },
  closeModalAporteMeta() {
    document.getElementById('modalAporteMeta').classList.add('hidden');
  },
  handleGuardarAporteMeta(e) {
    e.preventDefault();
    const id = document.getElementById('aporteMetaId').value;
    const monto = parseFloat(document.getElementById('aporteMetaMonto').value);

    const meta = state.metas.find(m => m.id === id);
    if (meta && monto > 0) {
      meta.ahorrado += monto;
      this.guardarDatos();
      this.closeModalAporteMeta();
      this.renderizarMetas();
      this.renderizarDashboard();
      this.mostrarToast(`Aporte de ${formatearCOP(monto)} aplicado a la meta`);
    }
  },

  openModalNuevaDeuda() {
    document.getElementById('modalDeuda').classList.remove('hidden');
  },
  closeModalDeuda() {
    document.getElementById('modalDeuda').classList.add('hidden');
  },
  handleGuardarDeuda(e) {
    e.preventDefault();
    const nombre = document.getElementById('deudaNombre').value.trim();
    const inicial = parseFloat(document.getElementById('deudaValorInicial').value);
    const cuota = parseFloat(document.getElementById('deudaCuotaMensual').value) || 80000;
    const proximo = document.getElementById('deudaProximoPago').value.trim();
    const condiciones = document.getElementById('deudaCondiciones').value.trim();

    if (!nombre || isNaN(inicial) || inicial <= 0) return;

    state.deudas.push({
      id: 'deuda-' + Date.now(),
      nombre,
      condiciones: condiciones || 'Obligación',
      valorInicial: inicial,
      saldoPendiente: inicial,
      proximoPago: proximo || 'Mensual',
      cuotaMensual: cuota
    });

    this.guardarDatos();
    this.closeModalDeuda();
    this.renderizarDeudas();
    this.renderizarDashboard();
    this.mostrarToast(`Deuda "${nombre}" registrada`);
  },

  openModalAbonoDeuda(deudaId, deudaNombre, saldoActual) {
    document.getElementById('abonoDeudaId').value = deudaId;
    document.getElementById('lblAbonoDeudaTitulo').textContent = `Abonar a "${deudaNombre}"`;
    document.getElementById('lblAbonoDeudaSaldoActual').textContent = formatearCOP(saldoActual);
    document.getElementById('modalAbonoDeuda').classList.remove('hidden');
  },
  closeModalAbonoDeuda() {
    document.getElementById('modalAbonoDeuda').classList.add('hidden');
  },
  handleGuardarAbonoDeuda(e) {
    e.preventDefault();
    const id = document.getElementById('abonoDeudaId').value;
    const abono = parseFloat(document.getElementById('abonoDeudaMonto').value);

    const deuda = state.deudas.find(d => d.id === id);
    if (deuda && abono > 0) {
      deuda.saldoPendiente = Math.max(deuda.saldoPendiente - abono, 0);
      this.guardarDatos();
      this.closeModalAbonoDeuda();
      this.renderizarDeudas();
      this.renderizarDashboard();
      this.mostrarToast(`Abono de ${formatearCOP(abono)} registrado con éxito`);
    }
  },

  openModalConfigPresupuesto() {
    document.getElementById('presupuestoGeneralMonto').value = state.presupuestoMensual || 1950000;
    document.getElementById('modalConfigPresupuesto').classList.remove('hidden');
  },
  closeModalConfigPresupuesto() {
    document.getElementById('modalConfigPresupuesto').classList.add('hidden');
  },
  handleGuardarPresupuestoGeneral(e) {
    e.preventDefault();
    const val = parseFloat(document.getElementById('presupuestoGeneralMonto').value);
    if (val >= 0) {
      state.presupuestoMensual = val;
      this.guardarDatos();
      this.closeModalConfigPresupuesto();
      this.renderizarPresupuestos();
      this.renderizarDashboard();
      this.mostrarToast(`Presupuesto actualizado a ${formatearCOP(val)}`);
    }
  },

  openModalEditarPerfil() {
    document.getElementById('inputEditNombre').value = state.usuario.nombre;
    document.getElementById('inputEditEmail').value = state.usuario.email;
    document.getElementById('modalEditarPerfil').classList.remove('hidden');
  },
  closeModalEditarPerfil() {
    document.getElementById('modalEditarPerfil').classList.add('hidden');
  },
  handleGuardarPerfil(e) {
    e.preventDefault();
    const nombre = document.getElementById('inputEditNombre').value.trim();
    const email = document.getElementById('inputEditEmail').value.trim();
    if (nombre && email) {
      state.usuario.nombre = nombre;
      state.usuario.email = email;
      const partes = nombre.split(' ');
      state.usuario.iniciales = (partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
      this.guardarDatos();
      this.closeModalEditarPerfil();
      this.renderizarUsuario();
      this.mostrarToast('Perfil actualizado');
    }
  },

  openAcademicExplanation() {
    document.getElementById('modalAcademic').classList.remove('hidden');
  },
  closeAcademicExplanation() {
    document.getElementById('modalAcademic').classList.add('hidden');
  },

  guardarAjustes() {
    state.usuario.alertasPresupuesto = document.getElementById('chkAlertasPresupuesto').checked;
    state.usuario.recordatoriosDeudas = document.getElementById('chkRecordatoriosDeudas').checked;
    this.guardarDatos();
    this.mostrarToast('Ajustes guardados');
  },

  setExportFormat(fmt) {
    exportFormatSelected = fmt;
    document.getElementById('btnFormatPDF').classList.toggle('active', fmt === 'PDF');
    document.getElementById('btnFormatCSV').classList.toggle('active', fmt === 'CSV');
  },

  ejecutarExportacion() {
    if (exportFormatSelected === 'CSV') {
      this.exportarDatosCSV();
    } else {
      this.mostrarToast('Generando informe PDF con resumen financiero...');
      setTimeout(() => window.print(), 350);
    }
  },

  exportarDatosCSV() {
    let csv = 'ID,Tipo,Concepto,Categoria,Cuenta,Monto_COP,Fecha\n';
    state.movimientos.forEach(m => {
      csv += `"${m.id}","${m.tipo}","${m.concepto}","${m.categoria}","${m.cuenta || 'Principal'}",${m.valor},"${m.fecha}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mibolsillo_movimientos_octubre_2026.csv`;
    link.click();
    this.mostrarToast('Archivo CSV exportado exitosamente');
  },

  mostrarToast(mensaje) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span>✔</span><span>${mensaje}</span>`;
    container.appendChild(t);

    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s ease';
      setTimeout(() => t.remove(), 300);
    }, 2800);
  },

  configurarResponsiveEvents() {
    const btnMobile = document.getElementById('btnViewMobile');
    const btnDesktop = document.getElementById('btnViewDesktop');
    const wrapper = document.getElementById('viewportWrapper');

    if (btnMobile && btnDesktop && wrapper) {
      btnMobile.addEventListener('click', () => {
        btnMobile.classList.add('active');
        btnDesktop.classList.remove('active');
        wrapper.classList.remove('mode-desktop');
      });

      btnDesktop.addEventListener('click', () => {
        btnDesktop.classList.add('active');
        btnMobile.classList.remove('active');
        wrapper.classList.add('mode-desktop');
      });
    }

    const btnOpenAcademic = document.getElementById('btnOpenAcademicModal');
    if (btnOpenAcademic) {
      btnOpenAcademic.addEventListener('click', () => this.openAcademicExplanation());
    }

    const btnProfile = document.getElementById('btnOpenProfile');
    if (btnProfile) {
      btnProfile.addEventListener('click', () => this.switchTab('perfil'));
    }

    const btnEye = document.getElementById('btnToggleBalanceVisibility');
    if (btnEye) {
      btnEye.addEventListener('click', () => this.toggleBalanceVisibility());
    }

    // Actualizar reloj dinámico
    setInterval(() => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const el = document.getElementById('statusTime');
      if (el) el.textContent = `${h}:${m}`;
    }, 1000);
  }
};

// INICIALIZACIÓN AL CARGAR
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
