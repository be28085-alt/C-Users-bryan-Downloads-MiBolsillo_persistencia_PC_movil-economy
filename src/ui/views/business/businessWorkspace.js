(function () {
  'use strict';
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => window.BusinessReportsView.money(Number(v || 0).toFixed(2));
  const button = (label, action, attrs = '', primary = false) => `<button type="button" data-bm="${action}" ${attrs} class="${primary ? 'bm-primary' : ''}">${label}</button>`;
  const action = (label, name, collection, id, kind = '') => button(label, name, `data-collection="${E(collection)}" data-id="${E(id)}" data-kind="${E(kind)}"`);
  const field = (label, name, value = '', attrs = '') => `<label>${label}<input name="${name}" value="${E(value)}" ${attrs}></label>`;
  const select = (label, name, entries, value, attrs = '') => `<label>${label}<select name="${name}" ${attrs}>${entries.map(([v, text]) => `<option value="${E(v)}" ${String(v) === String(value) ? 'selected' : ''}>${E(text)}</option>`).join('')}</select></label>`;
  const amountField = (label, name, value = '', required = true) => field(label, name, value, `inputmode="decimal" ${required ? 'required' : ''}`);
  const isActive = r => !['ARCHIVADO', 'ANULADA', 'INACTIVO'].includes(r.estado);
  let dialog, dialogBody, feedback, formContext, busy = false, focusReturn, latestModel;
  const titles = { dashboard: 'Resumen del negocio', inventory: 'Inventario y productos', movements: 'Movimientos del negocio', sales: 'Ventas y facturación', contacts: 'Clientes y proveedores', management: 'Gestión del negocio' };
  const pcViews = { dashboard: 'negocio-dashboard', inventory: 'negocio-inventario', movements: 'negocio-movimientos', sales: 'negocio-ventas', contacts: 'negocio-proveedores', management: 'negocio-gestion' };
  const mobileViews = { dashboard: 'negocio', inventory: 'inventario', movements: 'movimientos', sales: 'ventas', contacts: 'proveedores', management: 'gestion' };
  const kindCollection = { product: 'productos', customer: 'clientes', supplier: 'proveedores', employee: 'empleados', expense: 'gastosNegocio', income: 'ingresosNegocio', sale: 'ventas', purchase: 'compras', formula: 'formulas', production: 'producciones', business: 'negocios', deleteBusiness: 'negocios' };
  const col = (label, get, html = false) => ({ label, get, html });
  const status = r => `<span class="bm-badge ${['ANULADA', 'ARCHIVADO', 'INACTIVO'].includes(r.estado) ? 'bm-muted-badge' : ''}">${E(r.estado || 'ACTIVO')}</span>`;
  function header(root) {
    const business = window.Finanzas.getNegocioActivo();
    return `<header class="bm-header"><div><small>MI NEGOCIO</small><h1>${titles[root.dataset.businessSection]}</h1><p>${E(business?.nombre || 'Selecciona un negocio')} · datos guardados en este navegador</p></div><div class="bm-header-controls"><label>Negocio activo<select data-bm-active>${window.Finanzas.getNegocios().map(n => `<option value="${E(n.id)}" ${n.id === business?.id ? 'selected' : ''}>${E(n.nombre)}</option>`).join('')}</select></label>${button('Acciones', 'actions')}</div></header>`;
  }
  function tabs(root, values, fallback) {
    const selected = root.dataset.tab || fallback; root.dataset.tab = selected;
    return `<nav class="bm-tabs" aria-label="Secciones de ${titles[root.dataset.businessSection]}">${values.map(([key, label]) => `<button type="button" data-bm="tab" data-tab="${key}" aria-pressed="${key === selected}">${label}</button>`).join('')}</nav>`;
  }
  function tableHtml(rows, columns, compact = false) {
    return `<div class="bm-table-wrap ${compact ? 'bm-compact' : ''}"><table><thead><tr>${columns.map(c => `<th scope="col">${c.label}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr data-record-id="${E(r.id)}">${columns.map(c => `<td data-label="${E(c.label)}">${c.html ? c.get(r) : E(c.get(r))}</td>`).join('')}</tr>`).join('') || `<tr><td class="bm-empty-cell" colspan="${columns.length}">No hay registros para esta consulta.</td></tr>`}</tbody></table></div>`;
  }
  function list(root, rows, columns, createButtons = '') {
    const query = (root.dataset.query || '').toLocaleLowerCase('es');
    const filter = root.dataset.filter || 'ALL';
    const filtered = rows.filter(r => (!query || JSON.stringify(r).toLocaleLowerCase('es').includes(query)) && (filter === 'ALL' || (filter === 'ACTIVE' ? isActive(r) : !isActive(r))));
    const pages = Math.max(1, Math.ceil(filtered.length / 10)), page = Math.min(pages, Math.max(1, Number(root.dataset.page) || 1)); root.dataset.page = page;
    root._exportRows = filtered; root._exportColumns = columns.filter(c => !c.html);
    return `<div class="bm-toolbar"><div class="bm-actions">${createButtons}${button('Descargar CSV', 'export')}</div><div class="bm-search"><label>Buscar en esta sección<input type="search" data-bm-search value="${E(root.dataset.query || '')}" placeholder="Nombre, identificación, número…"></label><label>Mostrar<select data-bm-filter><option value="ALL" ${filter === 'ALL' ? 'selected' : ''}>Todos</option><option value="ACTIVE" ${filter === 'ACTIVE' ? 'selected' : ''}>Activos</option><option value="ARCHIVED" ${filter === 'ARCHIVED' ? 'selected' : ''}>Archivados / anulados</option></select></label></div></div>${tableHtml(filtered.slice((page - 1) * 10, page * 10), columns)}<footer class="bm-pagination"><span>${filtered.length} registros · página ${page} de ${pages}</span><div>${button('Anterior', 'page', `data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}`)}${button('Siguiente', 'page', `data-page="${page + 1}" ${page === pages ? 'disabled' : ''}`)}</div></footer>`;
  }
  function catalogActions(r, collection, kind) { return `<div class="bm-row-actions">${action('Consultar', 'detail', collection, r.id)}${action('Editar', 'form', collection, r.id, kind)}${r.estado !== 'ARCHIVADO' ? action('Eliminar / archivar', 'archive', collection, r.id) : ''}</div>`; }
  function commercialActions(r, collection) { return `<div class="bm-row-actions">${action('Consultar', 'detail', collection, r.id)}${Number(r.saldoPendiente) > 0 && r.estado !== 'ANULADA' ? action('Registrar pago', 'form', collection, r.id, 'payment') : ''}${r.estado !== 'ANULADA' ? action(r.invoiceDocumentId ? 'Notas de ajuste' : 'Anular', r.invoiceDocumentId ? 'invoice' : 'cancel', collection, r.invoiceDocumentId || r.id) : ''}${action('Comprobante', 'print', collection, r.id)}</div>`; }
  function dashboard(root, m) {
    const t = m.report.totals;
    const period = root.dataset.period || 'MES_ACTUAL';
    const controls = `<div class="bm-toolbar"><label>Período de resultados<select data-bm-period>${[['MES_ACTUAL', 'Mes actual'], ['MES_ANTERIOR', 'Mes anterior'], ['ANIO_ACTUAL', 'Año actual'], ['TODOS', 'Histórico']].map(([v, l]) => `<option value="${v}" ${period === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><div class="bm-actions">${button('+ Venta', 'form', 'data-kind="sale"', true)}${button('+ Compra', 'form', 'data-kind="purchase"')}${button('+ Gasto', 'form', 'data-kind="expense"')}${button('+ Ingreso', 'form', 'data-kind="income"')}</div></div>`;
    const cards = [
      ['Utilidad neta', money(t.netProfit), `Margen neto: ${t.margin}%`, 'bm-hero'], ['Ventas netas', money(t.sales), `${t.salesCount} ventas en ${m.report.range.label}`], ['Ingresos totales', money(t.income), 'Ventas netas + otros ingresos'], ['Costos y gastos', money(t.expenses), 'Costo de ventas + operación y pagos a empleados'], ['Por cobrar', money(m.receivableTotal), 'Saldo actual de clientes'], ['Por pagar', money(m.payableTotal), 'Compras y gastos pendientes'], ['Productos disponibles', m.products.filter(p => Number(p.stock) > 0).length, `${m.lowStock.length} con inventario bajo`], ['Clientes registrados', m.customers.filter(isActive).length, 'Contactos activos del negocio'], ['Facturas generadas', m.invoiceCount, `${m.draftCount} borradores de simulación`], ['Flujo neto registrado', money(m.cash.flujoNeto), 'Cobros menos pagos acumulados; no es saldo bancario']
    ];
    return `${controls}<div class="bm-kpis">${cards.map(([label, value, desc, extra]) => `<article class="${extra || ''}"><span>${label}</span><strong>${E(value)}</strong><small>${E(desc)}</small></article>`).join('')}</div><div class="bm-grid"><section class="bm-card business-reports"><h2>Ventas, ingresos y gastos</h2><p>Últimos seis meses · los cobros de cartera no duplican ingresos</p><div class="br-chart-key"><span><i class="br-dot" style="background:#278fa4"></i>Ventas netas</span><span><i class="br-dot" style="background:#0f8b65"></i>Ingresos totales</span><span><i class="br-dot" style="background:#d93858"></i>Costos y gastos</span></div>${window.BusinessReportsView.bars(m.report, true)}</section><section class="bm-card"><h2>Alertas de inventario</h2>${m.lowStock.map(p => `<div class="bm-alert-row"><span>${E(p.nombre)}<small>Mínimo ${E(p.stockMinimo || 0)} ${E(p.unidadMedida)}</small></span><strong>${E(p.stock)}</strong>${action('Revisar', 'detail', 'productos', p.id)}</div>`).join('') || '<p>Sin productos por debajo del inventario mínimo.</p>'}</section></div><section class="bm-card"><h2>Últimas ventas</h2>${tableHtml(m.sales.slice(0, 5), [col('Número', r => r.numeroFactura || r.id), col('Cliente', r => r.clienteNombre), col('Fecha', r => r.fecha), col('Total', r => money(r.total)), col('Estado', status, true), col('Acciones', r => commercialActions(r, 'ventas'), true)])}</section>`;
  }
  function inventory(root, m) {
    const nav = tabs(root, [['products', 'Productos'], ['history', 'Historial de inventario']], 'products');
    if (root.dataset.tab === 'history') return nav + list(root, m.stockHistory.slice().reverse(), [col('Fecha', r => r.fecha), col('Producto', r => r.productoNombre), col('Movimiento', r => r.tipo), col('Cantidad', r => r.cantidad), col('Antes', r => r.stockAnterior), col('Después', r => r.stockPosterior), col('Motivo', r => r.motivo)], button('Registrar entrada / salida / ajuste', 'form', 'data-kind="stock"', true));
    const all = window.Finanzas.state.productos.filter(p => p.negocioId === m.report.business.id);
    return nav + list(root, all, [col('Producto', r => r.nombre), col('SKU / tipo', r => `${r.sku || '—'} · ${r.tipo || 'PRODUCTO'}`), col('Existencias', r => `${r.stock} ${r.unidadMedida || 'UND'}`), col('Costo', r => money(r.costoUnitario)), col('Precio', r => money(r.precioVenta)), col('Alerta', r => r.estado === 'ARCHIVADO' ? 'Archivado' : Number(r.stock) <= Number(r.stockMinimo || 0) ? 'Inventario bajo' : 'Disponible'), col('Acciones', r => catalogActions(r, 'productos', 'product') + (r.estado !== 'ARCHIVADO' ? action('Movimiento', 'form', 'productos', r.id, 'stock') : ''), true)], button('+ Producto', 'form', 'data-kind="product"', true));
  }
  function sales(root, m) {
    return `<p class="bm-note">Las ventas confirmadas conservan su detalle. Las correcciones usan anulaciones o notas en la facturación simulada.</p>` + list(root, m.sales, [col('Número', r => r.numeroFactura || r.id), col('Cliente', r => r.clienteNombre), col('Fecha', r => r.fecha), col('Total', r => money(r.total)), col('Por cobrar', r => money(r.saldoPendiente)), col('Estado', status, true), col('Acciones', r => commercialActions(r, 'ventas'), true)], button('+ Confirmar venta', 'form', 'data-kind="sale"', true) + '<button type="button" data-invoice-open>Facturación electrónica simulada</button>');
  }
  function contacts(root, m) {
    const nav = tabs(root, [['customers', 'Clientes'], ['suppliers', 'Proveedores']], 'customers');
    const customer = root.dataset.tab === 'customers', collection = customer ? 'clientes' : 'proveedores', kind = customer ? 'customer' : 'supplier';
    return nav + list(root, customer ? m.customers : m.suppliers, [col('Nombre', r => r.nombre), col('Identificación', r => r.cedula || r.documento || '—'), col('Contacto', r => `${r.telefono || ''} ${r.email || ''}`), col(customer ? 'Por cobrar' : 'Por pagar', r => money(r.saldoPendiente)), col('Estado', status, true), col('Acciones', r => catalogActions(r, collection, kind), true)], button(customer ? '+ Cliente' : '+ Proveedor', 'form', `data-kind="${kind}"`, true));
  }
  function movements(root, m) {
    const nav = tabs(root, [['cash', 'Cobros y pagos'], ['expenses', 'Gastos'], ['incomes', 'Otros ingresos']], 'cash');
    const actions = button('+ Gasto', 'form', 'data-kind="expense"', true) + button('+ Ingreso', 'form', 'data-kind="income"');
    if (root.dataset.tab === 'cash') return nav + `<div class="bm-summary">Entradas: <strong>${E(money(m.cash.totalEntradas))}</strong> · Salidas: <strong>${E(money(m.cash.totalSalidas))}</strong> · Flujo neto: <strong>${E(money(m.cash.flujoNeto))}</strong></div>` + list(root, m.cash.movimientosCaja, [col('Fecha', r => r.fecha), col('Movimiento', r => r.tipo), col('Concepto', r => r.concepto), col('Medio', r => r.cuenta), col('Monto', r => money(r.monto))], actions);
    const expense = root.dataset.tab === 'expenses', collection = expense ? 'gastosNegocio' : 'ingresosNegocio', kind = expense ? 'expense' : 'income';
    return nav + list(root, expense ? m.expenses : m.incomes, [col('Fecha', r => r.fecha), col('Categoría', r => r.categoria), col('Descripción', r => r.descripcion), col('Monto', r => money(r.monto)), col('Estado', status, true), col('Acciones', r => `${action('Consultar', 'detail', collection, r.id)}${r.estado !== 'ANULADA' ? action('Editar', 'form', collection, r.id, kind) + action('Anular', 'cancel', collection, r.id) : ''}`, true)], actions);
  }
  function management(root, m) {
    const nav = tabs(root, [['purchases', 'Compras'], ['receivables', 'Por cobrar'], ['payables', 'Por pagar'], ['employees', 'Empleados'], ['production', 'Producción'], ['business', 'Mi negocio']], 'purchases');
    const tab = root.dataset.tab;
    if (tab === 'purchases') return nav + list(root, m.purchases, [col('Referencia', r => r.id), col('Proveedor', r => r.proveedorNombre), col('Fecha', r => r.fecha), col('Total', r => money(r.total)), col('Pagado', r => money(r.montoPagado)), col('Pendiente', r => money(r.saldoPendiente)), col('Estado', status, true), col('Acciones', r => commercialActions(r, 'compras'), true)], button('+ Compra', 'form', 'data-kind="purchase"', true));
    if (tab === 'receivables' || tab === 'payables') {
      const receivable = tab === 'receivables', rows = receivable ? m.receivables : m.payables;
      const dueDate = r => r.fechaVencimiento || window.Finanzas.state.facturacion?.documents.find(d => d.id === r.invoiceDocumentId)?.dueDate || '';
      return nav + `<div class="bm-summary">Saldo pendiente actual: <strong>${E(money(receivable ? m.receivableTotal : m.payableTotal))}</strong></div>` + list(root, rows, [col(receivable ? 'Cliente' : 'Proveedor', r => receivable ? r.clienteNombre : r.proveedorNombre), col('Referencia', r => r.numeroFactura || r.id), col('Vencimiento', r => dueDate(r) || 'Sin fecha registrada'), col('Situación', r => dueDate(r) && dueDate(r) < window.BusinessUtils.today() ? 'Vencida' : 'Pendiente'), col('Saldo', r => money(r.saldoPendiente)), col('Acciones', r => action('Registrar pago', 'form', receivable ? 'ventas' : r.collection, r.id, 'payment') + action('Historial', 'detail', receivable ? 'ventas' : r.collection, r.id), true)]);
    }
    if (tab === 'employees') {
      const payroll = window.Finanzas.state.pagosEmpleado.filter(p => p.negocioId === m.report.business.id).slice().reverse();
      return nav + `<p class="bm-note">Registro administrativo de colaboradores y pagos empresariales. No realiza liquidación de nómina legal.</p>` + list(root, m.employees, [col('Empleado', r => r.nombre), col('Cargo', r => r.cargo), col('Referencia de salario', r => money(r.salario)), col('Estado', status, true), col('Acciones', r => catalogActions(r, 'empleados', 'employee') + (r.estado === 'ACTIVO' ? action('Registrar pago', 'form', 'empleados', r.id, 'payroll') : ''), true)], button('+ Empleado', 'form', 'data-kind="employee"', true)) + `<section class="bm-card"><h2>Pagos a empleados</h2>${tableHtml(payroll, [col('Fecha', r => r.fecha), col('Empleado', r => r.empleadoNombre), col('Período', r => r.periodo), col('Monto', r => money(r.monto)), col('Estado', status, true), col('Acciones', r => action('Comprobante', 'print', 'pagosEmpleado', r.id) + (r.estado !== 'ANULADA' ? action('Anular', 'cancel', 'pagosEmpleado', r.id) : ''), true)])}</section>`;
    }
    if (tab === 'production') return nav + list(root, m.formulas, [col('Receta', r => r.nombre), col('Producto', r => r.productoNombre), col('Cantidad base', r => r.cantidadBase), col('Estado', status, true), col('Acciones', r => catalogActions(r, 'formulas', 'formula') + (isActive(r) ? action('Producir', 'form', 'formulas', r.id, 'production') : ''), true)], button('+ Receta', 'form', 'data-kind="formula"', true)) + `<section class="bm-card"><h2>Lotes fabricados</h2>${tableHtml(m.productions.slice().reverse(), [col('Fecha', r => r.fecha), col('Producto', r => r.productoNombre), col('Cantidad', r => r.cantidadProducida), col('Costo total', r => money(r.costoTotal)), col('Acciones', r => action('Consultar', 'detail', 'producciones', r.id), true)])}</section>`;
    return nav + `<section class="bm-card"><h2>Información y negocios</h2><p>${E(m.report.business.name)}</p><div class="bm-actions">${button('Editar negocio activo', 'form', `data-kind="business" data-id="${E(m.report.business.id)}"`)}${button('+ Crear negocio', 'form', 'data-kind="business"')}${button('Eliminar negocio sin historial', 'form', `data-kind="deleteBusiness" data-id="${E(m.report.business.id)}"`)}</div><p class="bm-note">Los negocios con movimientos o documentos no se eliminan. Las copias JSON del perfil incluyen todo el estado; cada negocio conserva sus relaciones.</p></section>`;
  }
  function renderRoot(root, model) {
    const m = model || window.BusinessReadModel.build(window.Finanzas, window.Finanzas.state.negocioActivoId, root.dataset.period || 'MES_ACTUAL');
    latestModel = m;
    root.classList.add('business-manager');
    const section = root.dataset.businessSection;
    root.innerHTML = header(root) + ({ dashboard, inventory, movements, sales, contacts, management }[section])(root, m);
  }
  function renderAll() {
    const core = window.Finanzas, b = core?.getNegocioActivo();
    if (!b) { document.querySelectorAll('[data-business-section]').forEach(root => { root.classList.add('business-manager'); root.innerHTML = `<div class="bm-card"><h1>Configura tu negocio</h1><p>Registra tu primer negocio para empezar a guardar productos, contactos y operaciones.</p>${button('Crear mi negocio', 'form', 'data-kind="business"', true)}</div>`; }); return; }
    document.querySelectorAll('[data-business-section]').forEach(root => {
      try { renderRoot(root); } catch (e) { root.innerHTML = `<div class="bm-error" role="alert">No se pudo calcular esta sección: ${E(e.message)}</div>`; }
    });
  }
  function navigate(section, tab = '') {
    if (typeof pcApp !== 'undefined') pcApp.switchView(pcViews[section]);
    else if (window.mobileApp) window.mobileApp.switchBusinessTab(mobileViews[section]);
    const root = document.querySelector(`[data-business-section="${section}"]`);
    if (root) { if (tab) root.dataset.tab = tab; root.dataset.query = ''; root.dataset.page = 1; root.dataset.filter = 'ALL'; renderRoot(root); }
  }
  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.className = 'bm-dialog'; dialog.setAttribute('aria-labelledby', 'bm-dialog-title');
    dialog.innerHTML = '<header><h2 id="bm-dialog-title"></h2><button type="button" data-bm="close" aria-label="Cerrar formulario">Cerrar ✕</button></header><p class="bm-form-feedback" role="alert" tabindex="-1"></p><div class="bm-dialog-body"></div>';
    document.body.appendChild(dialog); dialogBody = dialog.querySelector('.bm-dialog-body'); feedback = dialog.querySelector('.bm-form-feedback');
    dialog.addEventListener('submit', submit);
    dialog.addEventListener('input', event => { if (event.target.closest('.bm-lines')) preview(); });
    dialog.addEventListener('change', event => { if (event.target.matches('[data-bm-product]')) { const p = window.Finanzas.getProductoById(event.target.value); const row = event.target.closest('.bm-line'); row.querySelector('[name="precioUnitario"]').value = p?.[formContext.kind === 'purchase' ? 'costoUnitario' : 'precioVenta'] || '0'; } preview(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => focusReturn?.focus());
  }
  const entities = collection => (window.Finanzas.state[collection] || []).filter(r => r.negocioId === window.Finanzas.state.negocioActivoId && isActive(r));
  const entityOptions = (collection, empty = 'Selecciona…') => [['', empty], ...entities(collection).map(r => [r.id, `${r.nombre}${r.cedula ? ' · ' + r.cedula : ''}`])];
  function lineHtml(line = {}, ingredient = false) {
    const products = entities('productos');
    return `<div class="bm-line">${select(ingredient ? 'Insumo' : 'Producto', ingredient ? 'materiaPrimaId' : 'productoId', [['', 'Selecciona un producto'], ...products.map(p => [p.id, `${p.nombre} · stock ${p.stock}`])], line.productoId || line.materiaPrimaId, ingredient ? 'required' : 'required data-bm-product')}${amountField('Cantidad', ingredient ? 'cantidadRequerida' : 'cantidad', line.cantidad || line.cantidadRequerida || '1')}${ingredient ? '' : amountField('Precio sin impuestos COP', 'precioUnitario', line.precioUnitario || '') + amountField('Descuento %', 'descuentoPorcentaje', line.descuentoPorcentaje || '0') + select('Impuesto', 'impuesto', [['IVA:0', 'Sin impuesto (0%)'], ['IVA:19', 'IVA 19%'], ['IVA:5', 'IVA 5%'], ['INC:8', 'INC 8%'], ['EXENTO:0', 'Exento'], ['EXCLUIDO:0', 'Excluido']], 'IVA:0')}${button('Eliminar artículo', 'remove-line')}</div>`;
  }
  function commercialForm(kind, r) {
    const purchase = kind === 'purchase';
    return `<div class="bm-form-grid">${select(purchase ? 'Proveedor' : 'Cliente', purchase ? 'proveedorId' : 'clienteId', entityOptions(purchase ? 'proveedores' : 'clientes'), '', 'required')}${field('Fecha', 'fecha', window.BusinessUtils.today(), 'type="date" required')}${select('Condición de pago', 'tipoPago', [['CONTADO', 'Contado'], ['CREDITO', 'Crédito']], 'CONTADO')}${field('Vencimiento', 'fechaVencimiento', window.BusinessUtils.today(), 'type="date" required')}${amountField('Pago inicial COP (vacío: según condición)', 'montoPagado', '', false)}${select('Medio de pago', 'metodoPago', ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].map(v => [v, v]), 'Efectivo')}</div><div class="bm-actions">${button('+ Registrar contacto', 'form', `data-kind="${purchase ? 'supplier' : 'customer'}"`)}${button('+ Registrar producto', 'form', 'data-kind="product"')}</div><fieldset><legend>Artículos · use punto decimal sin separadores de miles</legend><div class="bm-lines">${lineHtml()}</div>${button('+ Agregar artículo', 'add-line')}</fieldset><output class="bm-preview" aria-live="polite"></output>${field('Observaciones', purchase ? 'observaciones' : 'notas', '', 'maxlength="200"')}<p class="bm-note">${purchase ? 'Al confirmar se incrementa el inventario y se registra el pago o la obligación del proveedor.' : 'Comprobante interno sin validez fiscal. La venta confirmada se corrige mediante anulación. Use Facturación simulada para documentos con borradores y notas.'}</p>`;
  }
  function fields(kind, r, collection) {
    const required = 'required maxlength="200"';
    if (['sale', 'purchase'].includes(kind)) return commercialForm(kind, r);
    if (['customer', 'supplier'].includes(kind)) return `<div class="bm-form-grid">${field('Nombre / razón social', 'nombre', r.nombre, required)}${field(kind === 'customer' ? 'Identificación' : 'Identificación (opcional)', 'cedula', r.cedula || r.documento, kind === 'customer' ? 'required maxlength="20"' : 'maxlength="20"')}${select('Tipo de documento', 'tipoDocumento', ['CC', 'NIT', 'CE', 'PASAPORTE'].map(t => [t, t]), r.tipoDocumento || 'CC')}${field('Correo', 'email', r.email, 'type="email" maxlength="200"')}${field('Teléfono', 'telefono', r.telefono, 'type="tel"')}${field('Dirección', 'direccion', r.direccion)}${select('Estado', 'estado', [['ACTIVO', 'Activo'], ['ARCHIVADO', 'Archivado']], r.estado || 'ACTIVO')}</div>`;
    if (kind === 'product') return `<div class="bm-form-grid">${field('Nombre', 'nombre', r.nombre, required)}${field('SKU / código', 'sku', r.sku)}${select('Tipo', 'tipo', [['PRODUCTO', 'Producto'], ['MATERIA_PRIMA', 'Materia prima']], r.tipo || 'PRODUCTO')}${field('Unidad de medida', 'unidadMedida', r.unidadMedida || 'UND', required)}${amountField('Costo unitario COP', 'costoUnitario', r.costoUnitario || '0')}${amountField('Precio de venta COP', 'precioVenta', r.precioVenta || '0')}${!r.id ? amountField('Existencia inicial', 'stock', '0') : ''}${amountField('Existencia mínima', 'stockMinimo', r.stockMinimo || '0')}${select('Proveedor asociado', 'proveedorId', entityOptions('proveedores', 'Sin proveedor'), r.proveedorId)}${field('Descripción', 'descripcion', r.descripcion)}${select('Estado', 'estado', [['DISPONIBLE', 'Disponible'], ['ARCHIVADO', 'Archivado']], r.estado || 'DISPONIBLE')}</div>`;
    if (kind === 'stock') return `<div class="bm-form-grid">${select('Producto', 'productoId', entityOptions('productos'), r.id, 'required')}${select('Movimiento', 'tipo', [['ENTRADA', 'Entrada'], ['SALIDA', 'Salida'], ['AJUSTE', 'Ajustar existencia final']], 'ENTRADA')}${amountField('Cantidad (en ajuste: existencia final)', 'cantidad', '')}${field('Fecha', 'fecha', window.BusinessUtils.today(), 'type="date" required')}${field('Motivo', 'motivo', '', required)}</div>`;
    if (['expense', 'income'].includes(kind)) return `<div class="bm-form-grid">${field('Descripción', 'descripcion', r.descripcion, required)}${field('Categoría', 'categoria', r.categoria || (kind === 'expense' ? 'Otros gastos operativos' : 'Otros ingresos'), required)}${amountField('Monto COP', 'monto', r.monto || '')}${field('Fecha', 'fecha', r.fecha || window.BusinessUtils.today(), 'type="date" required')}${select('Medio de pago', 'metodoPago', ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].map(v => [v, v]), r.metodoPago || 'Efectivo')}${kind === 'expense' ? select('Proveedor (obligatorio a crédito)', 'proveedorId', entityOptions('proveedores', 'Sin proveedor'), r.proveedorId) + (!r.id ? select('Condición de pago', 'tipoPago', [['CONTADO', 'Contado'], ['CREDITO', 'Crédito']], 'CONTADO') + amountField('Pago inicial COP (vacío: según condición)', 'montoPagado', '', false) : '') + field('Vencimiento', 'fechaVencimiento', r.fechaVencimiento || window.BusinessUtils.today(), 'type="date" required') : ''}</div>`;
    if (kind === 'employee') return `<div class="bm-form-grid">${field('Nombre', 'nombre', r.nombre, required)}${field('Identificación', 'cedula', r.cedula)}${field('Cargo', 'cargo', r.cargo || 'Colaborador', required)}${field('Teléfono', 'telefono', r.telefono)}${amountField('Referencia de salario COP', 'salario', r.salario || '0')}${field('Fecha de ingreso', 'fechaIngreso', r.fechaIngreso || window.BusinessUtils.today(), 'type="date" required')}${select('Estado de vinculación', 'estado', ['ACTIVO', 'INACTIVO', 'ARCHIVADO'].map(s => [s, s]), r.estado || 'ACTIVO')}</div>`;
    if (kind === 'payroll') return `<div class="bm-form-grid">${select('Empleado', 'empleadoId', entityOptions('empleados'), r.id, 'required')}${amountField('Monto del pago COP', 'monto', r.salario || '')}${field('Concepto', 'concepto', 'Pago empresarial a empleado', required)}${field('Período', 'periodo', window.BusinessUtils.today().slice(0, 7), 'type="month" required')}${field('Fecha de pago', 'fecha', window.BusinessUtils.today(), 'type="date" required')}${select('Medio de pago', 'metodoPago', ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].map(v => [v, v]), 'Transferencia')}</div><p class="bm-note">Comprobante administrativo. No calcula prestaciones, seguridad social ni obligaciones de nómina legal.</p>`;
    if (kind === 'payment') return `<p><strong>${E(r.numeroFactura || r.descripcion || r.id)}</strong> · Saldo pendiente: ${E(money(r.saldoPendiente))}</p><div class="bm-form-grid">${amountField('Valor del pago COP', 'monto', '')}${field('Fecha del pago', 'fecha', window.BusinessUtils.today(), 'type="date" required')}${select('Medio de pago', 'metodoPago', ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].map(v => [v, v]), 'Efectivo')}${field('Notas', 'notas', '')}</div>`;
    if (kind === 'formula') return `<div class="bm-form-grid">${field('Nombre de receta', 'nombre', r.nombre, required)}${select('Producto a fabricar', 'productoId', entityOptions('productos'), r.productoId, 'required')}${amountField('Cantidad base de producción', 'cantidadBase', r.cantidadBase || '1')}${field('Descripción', 'descripcion', r.descripcion)}</div><fieldset><legend>Ingredientes para la cantidad base</legend><div class="bm-lines">${(r.ingredientes?.length ? r.ingredientes : [{}]).map(i => lineHtml(i, true)).join('')}</div>${button('+ Agregar ingrediente', 'add-line')}</fieldset>`;
    if (kind === 'production') return `<div class="bm-form-grid">${select('Receta', 'formulaId', entityOptions('formulas'), r.id, 'required')}${amountField('Cantidad a fabricar', 'cantidad', r.cantidadBase || '')}${field('Fecha', 'fecha', window.BusinessUtils.today(), 'type="date" required')}${field('Notas', 'notas', '')}</div><p class="bm-note">Se comprueban todos los insumos antes de consumir existencias y se conserva la receta histórica del lote.</p>`;
    if (kind === 'business') return `<div class="bm-form-grid">${field('Nombre del negocio', 'nombre', r.nombre, required)}${field('Actividad / tipo', 'tipo', r.tipo)}${field('Identificación / NIT', 'nit', r.nit)}${field('Correo', 'email', r.email, 'type="email"')}${field('Teléfono', 'telefono', r.telefono)}${field('Dirección', 'direccion', r.direccion)}${field('Descripción', 'descripcion', r.descripcion)}</div>`;
    if (['cancel', 'archive', 'deleteBusiness'].includes(kind)) return `<p>${kind === 'archive' ? 'Si tiene operaciones asociadas se archivará, conservando su historial.' : kind === 'deleteBusiness' ? 'Solo se eliminan negocios sin historial y debe conservarse al menos uno.' : 'Se conservará el documento y se registrará la reversión de inventario, saldos y pagos que corresponda. Una compra consumida no puede anularse si deja existencias negativas.'}</p><strong>${E(r.nombre || r.numeroFactura || r.descripcion || r.id)}</strong>${kind === 'cancel' ? field('Motivo de anulación', 'motivo', '', required) + field('Fecha', 'fecha', window.BusinessUtils.today(), 'type="date" required') : ''}`;
    return '';
  }
  function form(kind, id = '', collection = '', initial = {}) {
    ensureDialog();
    if (busy) return;
    const source = collection || kindCollection[kind];
    const r = id ? (window.Finanzas.state[source] || []).find(r => r.id === id && (source === 'negocios' || r.negocioId === window.Finanzas.state.negocioActivoId)) : initial;
    if (!r) return notice('Registro no encontrado.');
    if (kind === 'payment' && r.invoiceDocumentId) { window.InvoiceUI.open(r.invoiceDocumentId); return; }
    focusReturn = document.activeElement;
    formContext = { kind, r: cloneRecord(r), collection: source, key: window.BusinessUtils.uuid(), businessId: window.Finanzas.state.negocioActivoId };
    feedback.textContent = ''; dialog.querySelector('h2').textContent = ({ product: 'Producto', customer: 'Cliente', supplier: 'Proveedor', employee: 'Empleado', sale: 'Confirmar venta', purchase: 'Registrar compra', stock: 'Movimiento de inventario', expense: 'Gasto empresarial', income: 'Ingreso adicional', payment: 'Registrar pago', payroll: 'Pago a empleado', formula: 'Receta de producción', production: 'Fabricar lote', business: 'Datos del negocio', cancel: 'Anular operación', archive: 'Eliminar o archivar', deleteBusiness: 'Eliminar negocio' })[kind];
    dialogBody.innerHTML = `<form class="bm-form">${fields(kind, r, source)}<footer class="bm-form-actions">${button('Cancelar', 'close')}<button class="bm-primary" type="submit">${['cancel', 'archive', 'deleteBusiness'].includes(kind) ? 'Confirmar' : 'Guardar y confirmar'}</button></footer></form>`;
    if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0; preview();
  }
  const cloneRecord = r => JSON.parse(JSON.stringify(r || {}));
  function lines(ingredient = false) {
    return [...dialogBody.querySelectorAll('.bm-line')].map(row => {
      const values = Object.fromEntries([...row.querySelectorAll('input,select')].map(e => [e.name, e.value]));
      if (!ingredient) { [values.tipoImpuesto, values.tarifaImpuesto] = values.impuesto.split(':'); delete values.impuesto; }
      return values;
    });
  }
  function preview() {
    const out = dialogBody?.querySelector('.bm-preview'); if (!out) return;
    try { const t = window.InvoiceMoney.calculate(lines().map(l => ({ quantity: l.cantidad, unitPrice: l.precioUnitario, discountPercent: l.descuentoPorcentaje, taxKind: l.tipoImpuesto, taxRate: l.tarifaImpuesto }))); out.textContent = `Base: ${money(t.base)} · Impuestos: ${money(t.tax)} · Total: ${money(t.total)}`; }
    catch (e) { out.textContent = e.message; }
  }
  async function submit(event) {
    event.preventDefault(); event.stopPropagation(); if (busy) return;
    const ctx = formContext, data = Object.fromEntries(new FormData(event.target));
    if (ctx.businessId !== window.Finanzas.state.negocioActivoId) { feedback.textContent = 'Cambió el negocio activo. Abra el formulario nuevamente.'; return; }
    if (['sale', 'purchase'].includes(ctx.kind)) { data.detalles = lines(); if (!data.montoPagado) data.montoPagado = data.tipoPago === 'CREDITO' ? '0' : undefined; }
    if (ctx.kind === 'expense' && !ctx.r.id && !data.montoPagado) data.montoPagado = data.tipoPago === 'CREDITO' ? '0' : undefined;
    if (ctx.kind === 'formula') data.ingredientes = lines(true);
    if (ctx.r.id && kindCollection[ctx.kind]) { data.id = ctx.r.id; data.revision = ctx.r.revision || 0; }
    if (ctx.kind === 'production') { delete data.id; delete data.revision; }
    if (['cancel', 'archive', 'deleteBusiness'].includes(ctx.kind)) Object.assign(data, { id: ctx.r.id, collection: ctx.collection, revision: ctx.r.revision || 0 });
    if (ctx.kind === 'payment') Object.assign(data, { id: ctx.r.id, ventaId: ctx.r.id, clienteId: ctx.r.clienteId, collection: ctx.collection });
    const command = { product: 'saveProduct', customer: 'saveCustomer', supplier: 'saveSupplier', employee: 'saveEmployee', expense: 'saveExpense', income: 'saveIncome', sale: 'sale', purchase: 'purchase', stock: 'inventoryMovement', payroll: 'payroll', formula: 'saveFormula', production: 'production', business: 'saveBusiness', cancel: 'cancel', archive: 'archive', deleteBusiness: 'deleteBusiness', payment: ctx.collection === 'ventas' ? 'paySale' : 'payPurchase' }[ctx.kind];
    busy = true; dialog.setAttribute('aria-busy', 'true'); feedback.textContent = 'Guardando…'; const buttons = [...dialog.querySelectorAll('button')]; buttons.forEach(b => { b.disabled = true; });
    try {
      const out = await window.Finanzas.getBusinessService().execute(command, data, ctx.key);
      dialog.close();
      const destinations = { product: ['inventory'], stock: ['inventory', 'history'], customer: ['contacts', 'customers'], supplier: ['contacts', 'suppliers'], employee: ['management', 'employees'], payroll: ['management', 'employees'], sale: ['sales'], purchase: ['management', 'purchases'], expense: ['movements', 'expenses'], income: ['movements', 'incomes'], formula: ['management', 'production'], production: ['management', 'production'], business: ['dashboard'], deleteBusiness: ['dashboard'] };
      if (destinations[ctx.kind]) navigate(...destinations[ctx.kind]); else renderAll();
      notice(out.message || 'Guardado y verificado en el almacenamiento local.');
    } catch (e) { feedback.textContent = e.message; feedback.focus(); }
    finally { busy = false; dialog.removeAttribute('aria-busy'); buttons.forEach(b => { b.disabled = false; }); }
  }
  function notice(message) { if (typeof pcApp !== 'undefined') pcApp.showToast(message); else window.mobileApp?.mostrarToast(message); }
  function detail(collection, id) {
    ensureDialog(); const r = window.Finanzas.state[collection]?.find(x => x.id === id && (collection === 'negocios' || x.negocioId === window.Finanzas.state.negocioActivoId)); if (!r) return notice('Registro no encontrado.');
    formContext = { kind: 'detail', r, collection }; focusReturn = document.activeElement; feedback.textContent = ''; dialog.querySelector('h2').textContent = r.nombre || r.numeroFactura || r.descripcion || 'Consultar registro';
    const labels = { nombre: 'Nombre', cedula: 'Identificación', direccion: 'Dirección', email: 'Correo', telefono: 'Teléfono', fecha: 'Fecha', fechaVencimiento: 'Vencimiento', tipoPago: 'Condición de pago', metodoPago: 'Medio de pago', stock: 'Existencias', stockMinimo: 'Mínimo', precioVenta: 'Precio COP', costoUnitario: 'Costo unitario COP', total: 'Total histórico COP', monto: 'Monto COP', saldoPendiente: 'Saldo pendiente COP', montoPagado: 'Pagado COP', estado: 'Estado', categoria: 'Categoría', descripcion: 'Descripción', proveedorNombre: 'Proveedor histórico', clienteNombre: 'Cliente histórico', empleadoNombre: 'Empleado histórico', cargo: 'Cargo', periodo: 'Período', productoNombre: 'Producto', cantidadProducida: 'Cantidad fabricada', costoTotal: 'Costo del lote' };
    const paymentRows = [...(window.Finanzas.state.pagosVenta || []), ...(window.Finanzas.state.pagosCompra || []), ...(window.Finanzas.state.pagosGasto || []), ...(window.Finanzas.state.pagosEmpleado || [])].filter(p => p.negocioId === window.Finanzas.state.negocioActivoId && (p.ventaId === id || p.compraId === id || p.gastoId === id || p.empleadoId === id));
    const linked = collection === 'clientes' ? window.Finanzas.state.ventas.filter(v => v.clienteId === id) : collection === 'proveedores' ? window.Finanzas.state.compras.filter(c => c.proveedorId === id) : [];
    dialogBody.innerHTML = `<dl class="bm-detail">${Object.entries(labels).filter(([k]) => r[k] !== undefined).map(([k, label]) => `<div><dt>${label}</dt><dd>${E(r[k])}</dd></div>`).join('')}</dl>${r.detalles?.length ? `<h3>Detalle histórico</h3>${tableHtml(r.detalles, [col('Producto', l => l.productoNombre), col('Cantidad', l => l.cantidad), col('Precio', l => money(l.precioUnitario)), col('Subtotal', l => money(l.subtotal))])}` : ''}${r.ingredientes?.length ? `<h3>Ingredientes</h3>${tableHtml(r.ingredientes, [col('Insumo', i => i.materiaPrimaNombre), col('Cantidad', i => i.cantidadRequerida)])}` : ''}${linked.length ? `<h3>Operaciones asociadas</h3>${tableHtml(linked, [col('Fecha', v => v.fecha), col('Referencia', v => v.numeroFactura || v.id), col('Total', v => money(v.total)), col('Saldo', v => money(v.saldoPendiente))])}` : ''}${paymentRows.length ? `<h3>Historial de pagos</h3>${tableHtml(paymentRows, [col('Fecha', p => p.fecha), col('Monto', p => money(p.monto)), col('Medio', p => p.metodoPago)])}` : ''}${r.anulacion ? `<p class="bm-note">Anulación: ${E(r.anulacion.fecha)} · ${E(r.anulacion.motivo)}</p>` : ''}<details><summary>Auditoría de este registro</summary><ul>${(window.Finanzas.state.businessLedger?.audit || []).filter(a => a.recordId === id).map(a => `<li>${E(a.at)} · ${E(a.action)} · ${E(a.actor)}</li>`).join('') || '<li>Registro histórico anterior a la bitácora actual.</li>'}</ul></details><div class="bm-actions">${button('Cerrar', 'close')}${['ventas', 'compras', 'gastosNegocio', 'ingresosNegocio', 'pagosEmpleado'].includes(collection) ? action('Imprimir comprobante', 'print', collection, id) : ''}</div>`;
    if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0;
  }
  function printRecord(collection, id) {
    const r = window.Finanzas.state[collection]?.find(r => r.id === id && r.negocioId === window.Finanzas.state.negocioActivoId); if (!r) throw new Error('Registro no encontrado.');
    if (r.invoiceDocumentId) { window.InvoiceExports.download(new window.InvoiceService().get(r.invoiceDocumentId), 'pdf'); return; }
    const popup = window.open('', '_blank'); if (!popup) throw new Error('Permite la ventana de impresión para guardar el comprobante.');
    const b = window.Finanzas.getNegocioActivo();
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante ${E(r.numeroFactura || r.id)}</title><style>body{font:14px/1.5 system-ui;color:#153a43;margin:35px}h1{border-bottom:3px solid #187e6b;padding-bottom:15px}table{border-collapse:collapse;width:100%}th,td{padding:12px;border-bottom:1px solid #dde6e9;text-align:left}.notice{background:#fff1d8;padding:12px}small{color:#617780}@page{size:A4;margin:15mm}</style></head><body><small>${E(b.nombre)}</small><h1>Comprobante interno</h1><p class="notice">SIN VALIDEZ FISCAL · No es una factura electrónica validada por la DIAN.</p><p>Referencia: ${E(r.numeroFactura || r.id)}<br>Fecha: ${E(r.fecha)}<br>Estado: ${E(r.estado)}<br>${E(r.clienteNombre || r.proveedorNombre || r.empleadoNombre || r.descripcion || '')}</p>${r.detalles ? tableHtml(r.detalles, [col('Producto', l => l.productoNombre), col('Cantidad', l => l.cantidad), col('Precio', l => money(l.precioUnitario)), col('Subtotal', l => money(l.subtotal))]) : ''}<p>Base: ${E(money(r.subtotal ?? r.monto))}<br>Descuentos: ${E(money(r.calculo?.discount))}<br>Impuestos: ${E(money(r.impuestos))}<br><strong>Total: ${E(money(r.total ?? r.monto))}</strong><br>Pagado: ${E(money(r.montoPagado))}<br>Saldo pendiente: ${E(money(r.saldoPendiente))}</p>${r.notas || r.observaciones ? `<p>${E(r.notas || r.observaciones)}</p>` : ''}</body></html>`;
    popup.document.open(); popup.document.write(html); popup.document.close(); popup.opener = null;
    const ready = () => { popup.focus(); popup.print(); }; if (popup.document.readyState === 'complete') popup.setTimeout(ready, 0); else popup.addEventListener('load', ready, { once: true });
  }
  function exportRows(root) {
    const escape = value => { let text = String(value ?? ''); if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = "'" + text; return `"${text.replace(/"/g, '""')}"`; };
    const columns = root._exportColumns || [], rows = root._exportRows || [];
    window.FinanzasExportService.descargarCSV(`negocio_${root.dataset.businessSection}_${window.BusinessUtils.today()}.csv`, [columns.map(c => escape(c.label)).join(';'), ...rows.map(r => columns.map(c => escape(c.get(r))).join(';'))].join('\r\n'));
  }
  function init() {
    document.querySelectorAll('#navEmpresarial [data-view]').forEach(b => { const label = b.textContent.trim().replace(/\s+/g, ' '); b.setAttribute('aria-label', label); b.title = label; });
    document.addEventListener('click', event => {
      const b = event.target.closest('[data-bm]'); if (!b || busy) return;
      const root = b.closest('[data-business-section]'), { bm: command, kind, collection, id } = b.dataset;
      try {
        if (command === 'close') dialog?.close();
        else if (command === 'form') form(kind, id, collection);
        else if (command === 'detail') detail(collection, id);
        else if (command === 'archive' || command === 'cancel') form(command, id, collection);
        else if (command === 'invoice') window.InvoiceUI.open(id);
        else if (command === 'print') printRecord(collection, id);
        else if (command === 'tab') { root.dataset.tab = b.dataset.tab; root.dataset.query = ''; root.dataset.page = 1; renderRoot(root); }
        else if (command === 'page') { root.dataset.page = b.dataset.page; renderRoot(root); }
        else if (command === 'export') exportRows(root);
        else if (command === 'alerts') alerts();
        else if (command === 'actions') actions();
        else if (command === 'add-line') { dialogBody.querySelector('.bm-lines').insertAdjacentHTML('beforeend', lineHtml({}, formContext.kind === 'formula')); preview(); }
        else if (command === 'remove-line') { b.closest('.bm-line').remove(); preview(); }
      } catch (e) { if (dialog?.open) { feedback.textContent = e.message; feedback.focus(); } else notice(e.message); }
    });
    document.addEventListener('input', event => {
      if (!event.target.matches('[data-bm-search]')) return;
      const root = event.target.closest('[data-business-section]'), value = event.target.value, caret = event.target.selectionStart;
      root.dataset.query = value; root.dataset.page = 1; renderRoot(root);
      const search = root.querySelector('[data-bm-search]'); search.focus(); search.setSelectionRange(caret, caret);
    });
    document.addEventListener('change', async event => {
      const root = event.target.closest('[data-business-section]'); if (!root) return;
      try {
        if (event.target.matches('[data-bm-filter]')) { root.dataset.filter = event.target.value; root.dataset.page = 1; renderRoot(root); }
        if (event.target.matches('[data-bm-period]')) { root.dataset.period = event.target.value; renderRoot(root); }
        if (event.target.matches('[data-bm-active]')) await selectBusiness(event.target.value);
      } catch (e) { notice(e.message); renderAll(); }
    });
    renderAll();
  }
  async function selectBusiness(id) { await window.Finanzas.getBusinessService().execute('selectBusiness', { id }); document.querySelectorAll('[data-business-section]').forEach(root => { root.dataset.query = ''; root.dataset.page = 1; root.dataset.filter = 'ALL'; }); renderAll(); window.BusinessReportsView.render(window.Finanzas, window.Finanzas.getNegocioActivo()); }
  function actions() {
    ensureDialog(); if (busy) return; focusReturn = document.activeElement; feedback.textContent = ''; dialog.querySelector('h2').textContent = 'Acciones de Mi Negocio';
    dialogBody.innerHTML = `<div class="bm-form-grid">${[['sale', 'Registrar venta'], ['purchase', 'Registrar compra'], ['product', 'Agregar producto'], ['expense', 'Registrar gasto'], ['income', 'Registrar ingreso'], ['stock', 'Movimiento de inventario'], ['customer', 'Registrar cliente'], ['supplier', 'Registrar proveedor'], ['employee', 'Registrar empleado']].map(([kind, label]) => button(label, 'form', `data-kind="${kind}"`)).join('')}${button('Alertas y vencimientos', 'alerts')}</div>`;
    if (!dialog.open) dialog.showModal();
  }
  function search(section, query) { navigate(section); const root = document.querySelector(`[data-business-section="${section}"]`); if (root) { root.dataset.query = query; renderRoot(root); } }
  function alerts() {
    ensureDialog(); if (busy) return;
    const model = window.BusinessReadModel.build(window.Finanzas), today = window.BusinessUtils.today();
    const overdue = [...model.receivables.map(r => ({ ...r, collection: 'ventas' })), ...model.payables].filter(r => (r.fechaVencimiento || window.Finanzas.state.facturacion?.documents.find(d => d.id === r.invoiceDocumentId)?.dueDate || '9999') < today);
    focusReturn = document.activeElement; feedback.textContent = ''; dialog.querySelector('h2').textContent = 'Alertas de Mi Negocio';
    dialogBody.innerHTML = `<h3>Inventario bajo · ${model.lowStock.length}</h3>${tableHtml(model.lowStock, [col('Producto', r => r.nombre), col('Existencias', r => r.stock), col('Mínimo', r => r.stockMinimo || 0), col('Acciones', r => action('Consultar', 'detail', 'productos', r.id), true)])}<h3>Obligaciones vencidas · ${overdue.length}</h3>${tableHtml(overdue, [col('Referencia', r => r.numeroFactura || r.id), col('Cliente / proveedor', r => r.clienteNombre || r.proveedorNombre), col('Saldo', r => money(r.saldoPendiente)), col('Acciones', r => action('Consultar', 'detail', r.collection, r.id), true)])}<div class="bm-actions">${button('Cerrar', 'close')}</div>`;
    if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.BusinessUI = { renderAll, navigate, form, detail, selectBusiness, printRecord, actions, search, alerts };
})();
