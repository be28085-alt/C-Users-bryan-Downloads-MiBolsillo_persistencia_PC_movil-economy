(function () {
  'use strict';
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => window.BusinessNumbers.formatMoney(v ?? 0);
  const button = (label, action, attrs = '', primary = false) => `<button type="button" data-bm="${action}" ${attrs} class="${primary ? 'bm-primary' : ''}">${label}</button>`;
  const action = (label, name, collection, id, kind = '') => button(label, name, `data-collection="${E(collection)}" data-id="${E(id)}" data-kind="${E(kind)}"`);
  const field = (label, name, value = '', attrs = '') => `<label>${label}<input name="${name}" value="${E(value)}" ${attrs}></label>`;
  const select = (label, name, entries, value, attrs = '') => `<label>${label}<select name="${name}" ${attrs}>${entries.map(([v, text]) => `<option value="${E(v)}" ${String(v) === String(value) ? 'selected' : ''}>${E(text)}</option>`).join('')}</select></label>`;
  const moneyFields = new Set(['costoUnitario', 'precioVenta', 'precioUnitario', 'montoPagado', 'monto', 'salario']);
  const quantityFields = new Set(['stock', 'stockMinimo', 'cantidad', 'cantidadRequerida', 'cantidadBase', 'nuevoStock']);
  const amountField = (label, name, value = '', required = true) => {
    const defaultZero = value !== '' && Number(value) === 0 && !formContext?.r?.id && name !== 'precioUnitario';
    return field(label, name, defaultZero ? '' : moneyFields.has(name) && value !== '' ? window.BusinessNumbers.moneyInput(value) : value, `inputmode="decimal" data-bm-number="${moneyFields.has(name) ? 'money' : 'quantity'}" ${defaultZero ? 'data-default-number="0"' : ''} ${moneyFields.has(name) ? 'placeholder="0.000.00"' : ''} ${name === 'precioUnitario' ? 'readonly aria-label="Precio del producto"' : ''} ${required && !defaultZero ? 'required' : ''}`);
  };
  const isActive = r => !['ARCHIVADO', 'ANULADA', 'INACTIVO'].includes(r.estado);
  let dialog, dialogBody, feedback, formContext, busy = false, focusReturn, latestModel;
  const titles = window.BusinessWorkspaceScreens.titles;
  const pcViews = { dashboard: 'negocio-dashboard', inventory: 'negocio-inventario', movements: 'negocio-movimientos', sales: 'negocio-ventas', contacts: 'negocio-proveedores', management: 'negocio-gestion', purchases: 'negocio-compras', products: 'negocio-productos', cash: 'negocio-caja', expenses: 'negocio-gastos' };
  const mobileViews = { dashboard: 'negocio', inventory: 'inventario', movements: 'movimientos', sales: 'ventas', contacts: 'proveedores', management: 'gestion', purchases: 'compras', products: 'productos', cash: 'caja', expenses: 'gastos' };
  const kindCollection = { product: 'productos', customer: 'clientes', supplier: 'proveedores', employee: 'empleados', expense: 'gastosNegocio', income: 'ingresosNegocio', sale: 'ventas', purchase: 'compras', formula: 'formulas', production: 'producciones', business: 'negocios', deleteBusiness: 'negocios' };
  const col = (label, get, html = false) => ({ label, get, html });
  const status = r => `<span class="bm-badge ${['ANULADA', 'ARCHIVADO', 'INACTIVO'].includes(r.estado) ? 'bm-muted-badge' : ''}">${E(r.estado || 'ACTIVO')}</span>`;
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
    return `<div class="bm-toolbar"><div class="bm-actions">${createButtons}</div><div class="bm-search"><label>Buscar en esta sección<input type="search" data-bm-search value="${E(root.dataset.query || '')}" placeholder="Nombre, identificación, número…"></label><label>Mostrar<select data-bm-filter><option value="ALL" ${filter === 'ALL' ? 'selected' : ''}>Todos</option><option value="ACTIVE" ${filter === 'ACTIVE' ? 'selected' : ''}>Activos</option><option value="ARCHIVED" ${filter === 'ARCHIVED' ? 'selected' : ''}>Archivados / anulados</option></select></label></div></div>${tableHtml(filtered.slice((page - 1) * 10, page * 10), columns)}<footer class="bm-pagination"><span>${filtered.length} registros · página ${page} de ${pages}</span><div>${button('Anterior', 'page', `data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}`)}${button('Siguiente', 'page', `data-page="${page + 1}" ${page === pages ? 'disabled' : ''}`)}</div></footer>`;
  }
  function catalogActions(r, collection, kind, movement = false) { return `<div class="bm-row-actions ${movement ? 'bm-product-actions' : ''}" role="group" aria-label="Acciones de ${E(r.nombre)}">${action('Consultar', 'detail', collection, r.id)}${action('Editar', 'form', collection, r.id, kind)}${movement && r.estado !== 'ARCHIVADO' ? action('Movimiento', 'form', collection, r.id, 'stock') : ''}${r.estado !== 'ARCHIVADO' ? action('Eliminar / archivar', 'archive', collection, r.id) : ''}</div>`; }
  function commercialActions(r, collection) { return `<div class="bm-row-actions">${action('Consultar', 'detail', collection, r.id)}${Number(r.saldoPendiente) > 0 && r.estado !== 'ANULADA' ? action('Registrar pago', 'form', collection, r.id, 'payment') : ''}${r.estado !== 'ANULADA' ? action(r.invoiceDocumentId ? 'Notas de ajuste' : 'Anular', r.invoiceDocumentId ? 'invoice' : 'cancel', collection, r.invoiceDocumentId || r.id) : ''}${action('Comprobante', 'print', collection, r.id)}</div>`; }
  function management(root, m) {
    if (root.dataset.tab === 'purchases') root.dataset.tab = 'payables';
    const nav = tabs(root, [['receivables', 'Por cobrar'], ['payables', 'Por pagar'], ['employees', 'Empleados'], ['production', 'Producción'], ['business', 'Mi negocio']], 'payables') + `<div class="bm-report-shortcut">${button('Ver informe de esta sección', 'report')}</div>`;
    const tab = root.dataset.tab;
    if (tab === 'receivables' || tab === 'payables') {
      const receivable = tab === 'receivables', rows = receivable ? m.receivables : m.payables;
      const dueDate = r => r.fechaVencimiento || window.Finanzas.state.facturacion?.documents.find(d => d.id === r.invoiceDocumentId)?.dueDate || '';
      return nav + `<div class="bm-summary">Saldo pendiente actual: <strong>${E(money(receivable ? m.receivableTotal : m.payableTotal))}</strong></div>` + list(root, rows, [col(receivable ? 'Cliente' : 'Proveedor', r => receivable ? r.clienteNombre : r.proveedorNombre), col('Referencia', r => r.numeroFactura || r.numeroCompra || (r.id?.length > 20 ? `CMP-${r.id.slice(0, 8).toUpperCase()}` : r.id)), col('Vencimiento', r => dueDate(r) || 'Sin fecha registrada'), col('Situación', r => dueDate(r) && dueDate(r) < window.BusinessUtils.today() ? 'Vencida' : 'Pendiente'), col('Saldo', r => money(r.saldoPendiente)), col('Acciones', r => action('Registrar pago', 'form', receivable ? 'ventas' : r.collection, r.id, 'payment') + action('Historial', 'detail', receivable ? 'ventas' : r.collection, r.id), true)]);
    }
    if (tab === 'employees') {
      const payroll = window.Finanzas.state.pagosEmpleado.filter(p => p.negocioId === m.report.business.id).slice().reverse();
      return nav + `<p class="bm-note">Registro administrativo de colaboradores y pagos empresariales. No realiza liquidación de nómina legal.</p>` + list(root, m.employees, [col('Empleado', r => r.nombre), col('Cargo', r => r.cargo), col('Referencia de salario', r => money(r.salario)), col('Estado', status, true), col('Acciones', r => catalogActions(r, 'empleados', 'employee') + (r.estado === 'ACTIVO' ? action('Registrar pago', 'form', 'empleados', r.id, 'payroll') : ''), true)], button('+ Empleado', 'form', 'data-kind="employee"', true)) + `<section class="bm-card"><h2>Pagos a empleados</h2>${tableHtml(payroll, [col('Fecha', r => r.fecha), col('Empleado', r => r.empleadoNombre), col('Período', r => r.periodo), col('Monto', r => money(r.monto)), col('Estado', status, true), col('Acciones', r => action('Comprobante', 'print', 'pagosEmpleado', r.id) + (r.estado !== 'ANULADA' ? action('Anular', 'cancel', 'pagosEmpleado', r.id) : ''), true)])}</section>`;
    }
    if (tab === 'production') return nav + list(root, m.formulas, [col('Receta', r => r.nombre), col('Producto', r => r.productoNombre), col('Cantidad base', r => r.cantidadBase), col('Estado', status, true), col('Acciones', r => catalogActions(r, 'formulas', 'formula') + (isActive(r) ? action('Producir', 'form', 'formulas', r.id, 'production') : ''), true)], button('+ Receta', 'form', 'data-kind="formula"', true)) + `<section class="bm-card"><h2>Lotes fabricados</h2>${tableHtml(m.productions.slice().reverse(), [col('Fecha', r => r.fecha), col('Producto', r => r.productoNombre), col('Cantidad', r => r.cantidadProducida), col('Costo total', r => money(r.costoTotal)), col('Acciones', r => action('Consultar', 'detail', 'producciones', r.id), true)])}</section>`;
    const state = window.Finanzas.state, businessId = m.report.business.id;
    const canDelete = state.negocios.length > 1 && !window.BusinessSchema.collections.some(key => key !== 'negocios' && state[key].some(r => r.negocioId === businessId)) && !(state.facturacion?.documents || []).some(d => d.businessId === businessId);
    return nav + `<section class="bm-card"><h2>Información y negocios</h2><label class="bm-switch-business">Cambiar negocio<select data-bm-active aria-label="Cambiar negocio">${window.Finanzas.getNegocios().map(n => `<option value="${E(n.id)}" ${n.id === businessId ? 'selected' : ''}>${E(n.nombre)}</option>`).join('')}</select></label><div class="bm-actions">${button('Editar negocio activo', 'form', `data-kind="business" data-id="${E(m.report.business.id)}"`)}${button('+ Crear negocio', 'form', 'data-kind="business"')}${canDelete ? button('Eliminar negocio sin historial', 'form', `data-kind="deleteBusiness" data-id="${E(m.report.business.id)}"`) : ''}</div><p class="bm-note">Los negocios con movimientos o documentos no se eliminan. Las copias JSON del perfil incluyen todo el estado; cada negocio conserva sus relaciones.</p></section>`;
  }
  const screens = window.BusinessWorkspaceScreens.create({ E, money, button, action, col, status, list, tableHtml, catalogActions, commercialActions });
  function renderRoot(root, model) {
    const m = model || window.BusinessReadModel.build(window.Finanzas, window.Finanzas.state.negocioActivoId, root.dataset.period || 'MES_ACTUAL');
    latestModel = m;
    document.querySelectorAll('[data-business-profile]').forEach(b => { b.textContent = window.Finanzas.state.usuario?.iniciales || 'Yo'; });
    root.classList.add('business-manager');
    const section = root.dataset.businessSection;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', titles[section] || 'Mi Negocio');
    root.innerHTML = screens.header(root) + ({ ...screens, management }[section])(root, m);
    const nav = root.querySelector('.bm-mobile-sections'), selected = nav?.querySelector('[aria-current="page"]');
    if (selected) nav.scrollLeft = Math.max(0, selected.offsetLeft - nav.offsetLeft - (nav.clientWidth - selected.offsetWidth) / 2);
  }
  function renderAll() {
    const core = window.Finanzas, b = core?.getNegocioActivo();
    if (!b) { document.querySelectorAll('[data-business-section]').forEach(root => { root.classList.add('business-manager'); root.innerHTML = `<div class="bm-card"><h1>Configura tu negocio</h1><p>Registra tu primer negocio para empezar a guardar productos, contactos y operaciones.</p>${button('Crear mi negocio', 'form', 'data-kind="business"', true)}</div>`; }); return; }
    document.querySelectorAll('[data-business-section]').forEach(root => {
      try { renderRoot(root); } catch (e) { root.innerHTML = `<div class="bm-error" role="alert">No se pudo calcular esta sección: ${E(e.message)}</div>`; }
    });
  }
  function navigate(section, tab = '') {
    if (section === 'movements') { section = tab === 'cash' ? 'cash' : 'expenses'; if (tab === 'cash') tab = ''; }
    if (section === 'contacts' || section === 'reports') return window.BusinessReportsView.openSection(section === 'contacts' ? (tab === 'customers' ? 'sales' : 'purchases') : (tab || 'overview'));
    if (section === 'purchases') section = 'inventory';
    if (!Object.hasOwn(pcViews, section)) return;
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
    dialog.addEventListener('focusout', event => { if (event.target.matches('[data-bm-number="money"]') && event.target.value.trim()) { try { event.target.value = window.BusinessNumbers.moneyInput(window.BusinessNumbers.parseMoneyInput(event.target.value)); } catch (e) { /* Keep the original input so it can be corrected. */ } } });
    dialog.addEventListener('change', event => { if (event.target.name === 'clienteId') { const c = window.Finanzas.state.clientes.find(c => c.id === event.target.value); const target = dialogBody.querySelector('[data-sale-customer]'); if (target) target.textContent = c ? [c.tipoDocumento || 'CC', c.cedula, c.email, c.telefono, c.direccion].filter(Boolean).join(' · ') : 'Selecciona un cliente.'; } if (event.target.matches('[data-bm-product]')) { const p = window.Finanzas.getProductoById(event.target.value); const row = event.target.closest('.bm-line'); row.querySelector('[name="precioUnitario"]').value = window.BusinessNumbers.moneyInput(p?.[formContext.kind === 'purchase' ? 'costoUnitario' : 'precioVenta'] || 0); updateLineUnit(row); } if (event.target.name === 'unidadMedida') updateCustomUnit(); preview(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); else if (formContext?.returnTo) { event.preventDefault(); closeForm(); } });
    dialog.addEventListener('close', () => focusReturn?.focus());
  }
  const entities = collection => (window.Finanzas.state[collection] || []).filter(r => r.negocioId === window.Finanzas.state.negocioActivoId && isActive(r));
  const entityOptions = (collection, empty = 'Selecciona…') => [['', empty], ...entities(collection).map(r => [r.id, `${r.nombre}${r.cedula ? ' · ' + r.cedula : ''}`])];
  function productUnitFields(r) {
    const units = window.BusinessProductUnits, current = units.normalize(r.unidadMedida), known = units.catalog.some(unit => unit.code === current);
    return select('Unidad de medida', 'unidadMedida', [...units.options(), ['__CUSTOM__', 'Otra unidad…']], known ? current : '__CUSTOM__', 'required') + `<div data-bm-custom-unit ${known ? 'hidden' : ''}>${field('Nombre de la unidad', 'unidadPersonalizada', known ? '' : current, `maxlength="200" ${known ? 'disabled' : 'required'}`)}</div>`;
  }
  function updateCustomUnit() {
    const custom = dialogBody.querySelector('[data-bm-custom-unit]'); if (!custom) return;
    const enabled = dialogBody.querySelector('[name="unidadMedida"]').value === '__CUSTOM__', input = custom.querySelector('input');
    custom.hidden = !enabled; input.disabled = !enabled; input.required = enabled;
  }
  function updateLineUnit(row) {
    const product = window.Finanzas.getProductoById(row.querySelector('[data-bm-product]')?.value);
    const symbol = product ? window.BusinessProductUnits.get(product.unidadMedida).symbol : '';
    const quantity = row.querySelector('[data-bm-quantity-label]'), price = row.querySelector('[data-bm-price-label]');
    if (quantity) quantity.textContent = symbol ? `Cantidad (${symbol})` : 'Cantidad';
    if (price) price.textContent = symbol ? `Precio por ${symbol} sin impuestos COP` : 'Precio sin impuestos COP';
  }
  function lineHtml(line = {}, ingredient = false) {
    const products = entities('productos');
    return `<div class="bm-line">${select(ingredient ? 'Insumo' : 'Producto', ingredient ? 'materiaPrimaId' : 'productoId', [['', 'Selecciona un producto'], ...products.map(p => [p.id, `${p.nombre} · stock ${p.stock}`])], line.productoId || line.materiaPrimaId, ingredient ? 'required' : 'required data-bm-product')}${amountField('<span data-bm-quantity-label>Cantidad</span>', ingredient ? 'cantidadRequerida' : 'cantidad', line.cantidad || line.cantidadRequerida || '1')}${ingredient ? '' : amountField('<span data-bm-price-label>Precio sin impuestos COP</span>', 'precioUnitario', line.precioUnitario || '') + amountField('Descuento %', 'descuentoPorcentaje', line.descuentoPorcentaje || '0') + select('Impuesto', 'impuesto', [['IVA:0', 'Sin impuesto (0%)'], ['IVA:19', 'IVA 19%'], ['IVA:5', 'IVA 5%'], ['INC:8', 'INC 8%'], ['EXENTO:0', 'Exento'], ['EXCLUIDO:0', 'Excluido']], 'IVA:0')}${button('Eliminar artículo', 'remove-line')}</div>`;
  }
  function commercialForm(kind, r) {
    const purchase = kind === 'purchase';
    if (!purchase) return saleForm();
    return `<p class="bm-note">Registra productos o proveedores sin salir de este formulario y confirma la compra para ingresar las existencias.</p><div class="bm-form-grid">${select('Proveedor', 'proveedorId', entityOptions('proveedores'), '', 'required')}${field('Fecha', 'fecha', window.BusinessUtils.today(), 'type="date" required')}${select('Condición de pago', 'tipoPago', [['CONTADO', 'Contado'], ['CREDITO', 'Crédito']], 'CONTADO')}${field('Vencimiento', 'fechaVencimiento', window.BusinessUtils.today(), 'type="date" required')}${amountField('Pago inicial COP (vacío: según condición)', 'montoPagado', '', false)}${select('Medio de pago', 'metodoPago', ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].map(v => [v, v]), 'Efectivo')}</div><div class="bm-actions">${button('+ Registrar proveedor', 'form', 'data-kind="supplier"')}${button('+ Registrar producto', 'form', 'data-kind="product"')}</div><fieldset><legend>Artículos</legend><div class="bm-lines">${lineHtml()}</div>${button('+ Agregar artículo', 'add-line')}</fieldset><output class="bm-preview" aria-live="polite"></output>${field('Observaciones', 'observaciones', '', 'maxlength="200"')}<p class="bm-note">Al confirmar se incrementa el inventario y se registra el pago o la obligación del proveedor. Consulta el historial en Informes → Compras y proveedores.</p>`;
  }
  function saleForm() {
    const b = window.Finanzas.getNegocioActivo();
    return `<div class="bm-invoice-brand"><div><small>COMPROBANTE DE VENTA</small><h3>${E(b.nombre)}</h3><p>${E(b.nit || '')} · ${E(b.direccion || '')}</p></div><span>Venta nueva<br><small>Consecutivo al confirmar</small></span></div>
      <fieldset><legend>1. Cliente</legend>${select('Seleccionar cliente', 'clienteId', entityOptions('clientes'), '', 'required')}<div class="bm-sale-customer" data-sale-customer>Selecciona un cliente para consultar su identificación y contacto.</div><div class="bm-actions">${button('+ Registrar contacto', 'form', 'data-kind="customer"')}</div></fieldset>
      <fieldset><legend>2. Datos del documento</legend><div class="bm-form-grid">${field('Fecha de emisión', 'fecha', window.BusinessUtils.today(), 'type="date" required')}${field('Fecha de vencimiento', 'fechaVencimiento', window.BusinessUtils.today(), 'type="date" required')}</div></fieldset>
      <fieldset><legend>3. Artículos de la venta · COP</legend><p class="bm-note">Selecciona los productos e indica cantidades, descuentos e impuestos. El precio se toma del producto seleccionado.</p><div class="bm-lines">${lineHtml()}</div><div class="bm-actions">${button('+ Agregar artículo', 'add-line')}${button('+ Registrar producto', 'form', 'data-kind="product"')}</div></fieldset>
      <fieldset><legend>4. Condiciones de pago</legend><div class="bm-form-grid">${select('Condición de pago', 'tipoPago', [['CONTADO', 'Contado'], ['CREDITO', 'Crédito']], 'CONTADO')}${select('Medio de pago', 'metodoPago', ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].map(v => [v, v]), 'Efectivo')}${amountField('Pago inicial COP (vacío: según condición)', 'montoPagado', '', false)}</div></fieldset>
      <div class="bm-sale-bottom"><label>Observaciones<textarea name="notas" maxlength="200" rows="3" placeholder="Información adicional para el cliente"></textarea></label><output class="bm-preview bm-invoice-totals" aria-live="polite"></output></div><p class="bm-note">Comprobante interno sin validez fiscal. Al confirmar podrás imprimirlo o descargarlo en PDF.</p>`;
  }
  function saleComplete(record) {
    formContext = { kind: 'sale-complete', r: record, collection: 'ventas' };
    feedback.textContent = ''; dialog.querySelector('h2').textContent = 'Venta registrada';
    dialogBody.innerHTML = `<div class="bm-sale-success" role="status"><span class="bm-success-check">✓</span><h3>Tu venta se guardó correctamente</h3><p>${E(record.numeroFactura)} · ${E(record.clienteNombre)}</p><strong>${E(money(record.total))}</strong><p>¿Quieres imprimir o descargar el comprobante?</p></div><div class="bm-completion-actions">${action('Imprimir comprobante', 'print', 'ventas', record.id)}${action('Descargar PDF', 'download-sale', 'ventas', record.id)}${button('Finalizar', 'close')}</div>`;
    if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0;
  }
  function downloadSale(id) {
    const r = window.Finanzas.state.ventas.find(r => r.id === id && r.negocioId === window.Finanzas.state.negocioActivoId);
    if (!r) throw new Error('Venta no encontrada.');
    if (r.invoiceDocumentId) return window.InvoiceExports.download(new window.InvoiceService().get(r.invoiceDocumentId), 'pdf');
    const b = window.Finanzas.getNegocioActivo(), c = r.clienteSnapshot || {};
    const doc = { kind: 'INVOICE', number: r.numeroFactura, date: r.fecha, dueDate: r.fechaVencimiento, status: r.estado, supplier: { name: b.nombre, document: b.nit || '', address: b.direccion || '' }, customer: { name: r.clienteNombre, documentType: c.tipoDocumento || 'CC', document: c.cedula || r.clienteCedula || '', email: c.email || '', address: c.direccion || '', phone: c.telefono || '' }, totals: r.calculo, paymentTerms: r.tipoPago, paymentMethod: r.metodoPago, notes: r.notas, paid: r.montoPagado, balance: r.saldoPendiente };
    if (!doc.totals) throw new Error('Esta venta histórica se puede guardar como PDF desde Imprimir comprobante.');
    const url = URL.createObjectURL(new Blob([window.InvoiceExports.pdf(doc, { receipt: true })], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = `${r.numeroFactura}-comprobante.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function fields(kind, r, collection) {
    const required = 'required maxlength="200"';
    if (['sale', 'purchase'].includes(kind)) return commercialForm(kind, r);
    if (['customer', 'supplier'].includes(kind)) return `<div class="bm-form-grid">${field('Nombre / razón social', 'nombre', r.nombre, required)}${field(kind === 'customer' ? 'Identificación' : 'Identificación (opcional)', 'cedula', r.cedula || r.documento, kind === 'customer' ? 'required maxlength="20"' : 'maxlength="20"')}${select('Tipo de documento', 'tipoDocumento', ['CC', 'NIT', 'CE', 'PASAPORTE'].map(t => [t, t]), r.tipoDocumento || 'CC')}${field('Correo', 'email', r.email, 'type="email" maxlength="200"')}${field('Teléfono', 'telefono', r.telefono, 'type="tel"')}${field('Dirección', 'direccion', r.direccion)}${select('Estado', 'estado', [['ACTIVO', 'Activo'], ['ARCHIVADO', 'Archivado']], r.estado || 'ACTIVO')}</div>`;
    if (kind === 'product') return `<div class="bm-form-grid">${field('Nombre', 'nombre', r.nombre, required)}${field('SKU / código', 'sku', r.sku)}${select('Tipo', 'tipo', [['PRODUCTO', 'Producto'], ['MATERIA_PRIMA', 'Materia prima']], r.tipo || 'PRODUCTO')}${productUnitFields(r)}${amountField('Costo unitario COP', 'costoUnitario', r.costoUnitario || '0')}${amountField('Precio de venta COP', 'precioVenta', r.precioVenta || '0')}${!r.id ? amountField('Existencia inicial', 'stock', '0') : ''}${amountField('Existencia mínima', 'stockMinimo', r.stockMinimo || '0')}${select('Proveedor asociado', 'proveedorId', entityOptions('proveedores', 'Sin proveedor'), r.proveedorId)}${field('Descripción', 'descripcion', r.descripcion)}${select('Estado', 'estado', [['DISPONIBLE', 'Disponible'], ['ARCHIVADO', 'Archivado']], r.estado || 'DISPONIBLE')}</div><p class="bm-note">Define aquí el costo y el precio de venta del producto. Las cantidades se registran en la unidad elegida.</p>`;
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
    if (kind === 'sale') { dialog?.close(); return window.InvoiceUI.newInvoice(); }
    ensureDialog();
    if (busy) return;
    const source = collection || kindCollection[kind];
    const r = id ? (window.Finanzas.state[source] || []).find(r => r.id === id && (source === 'negocios' || r.negocioId === window.Finanzas.state.negocioActivoId)) : initial;
    if (!r) return notice('Registro no encontrado.');
    if (kind === 'payment' && r.invoiceDocumentId) { window.InvoiceUI.open(r.invoiceDocumentId); return; }
    const returnTo = dialog.open && formContext?.kind === 'purchase' && !id && ['product', 'supplier'].includes(kind)
      ? { context: formContext, form: dialogBody.querySelector('.bm-form'), title: dialog.querySelector('h2').textContent, focus: document.activeElement, focusReturn, scrollTop: dialog.scrollTop }
      : null;
    if (returnTo && kind === 'product' && !r.proveedorId) r.proveedorId = returnTo.form.querySelector('[name="proveedorId"]').value;
    focusReturn = document.activeElement;
    formContext = { kind, r: cloneRecord(r), collection: source, key: window.BusinessUtils.uuid(), businessId: window.Finanzas.state.negocioActivoId, returnTo };
    dialog.classList.toggle('bm-sale-dialog', kind === 'sale');
    feedback.textContent = ''; dialog.querySelector('h2').textContent = ({ product: 'Producto', customer: 'Cliente', supplier: 'Proveedor', employee: 'Empleado', sale: 'Registrar venta', purchase: 'Registrar productos', stock: 'Movimiento de inventario', expense: 'Gasto empresarial', income: 'Ingreso adicional', payment: 'Registrar pago', payroll: 'Pago a empleado', formula: 'Receta de producción', production: 'Fabricar lote', business: 'Datos del negocio', cancel: 'Anular operación', archive: 'Eliminar o archivar', deleteBusiness: 'Eliminar negocio' })[kind];
    dialogBody.innerHTML = `<form class="bm-form">${fields(kind, r, source)}<footer class="bm-form-actions">${button('Cancelar', 'close')}<button class="bm-primary" type="submit">${['cancel', 'archive', 'deleteBusiness'].includes(kind) ? 'Confirmar' : 'Guardar y confirmar'}</button></footer></form>`;
    if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0; preview();
  }
  const cloneRecord = r => JSON.parse(JSON.stringify(r || {}));
  function restorePurchase(ctx, record) {
    const saved = ctx.returnTo;
    formContext = saved.context;
    focusReturn = saved.focusReturn;
    dialogBody.replaceChildren(saved.form);
    dialog.querySelector('h2').textContent = saved.title;
    feedback.textContent = '';
    // Refresh catalogs without replacing the in-progress purchase or its operation key.
    const supplier = dialogBody.querySelector('[name="proveedorId"]'), previousSupplier = supplier.value;
    supplier.replaceChildren(...entityOptions('proveedores').map(([value, label]) => new Option(label, value)));
    supplier.value = ctx.kind === 'supplier' && record ? record.id : previousSupplier;
    const products = entities('productos');
    dialogBody.querySelectorAll('[data-bm-product]').forEach(input => {
      const previous = input.value;
      input.replaceChildren(new Option('Selecciona un producto', ''), ...products.map(p => new Option(`${p.nombre} · stock ${p.stock}`, p.id)));
      input.value = previous;
    });
    if (ctx.kind === 'product' && record) {
      let input = [...dialogBody.querySelectorAll('[data-bm-product]')].find(input => !input.value);
      if (!input) { dialogBody.querySelector('.bm-lines').insertAdjacentHTML('beforeend', lineHtml()); input = dialogBody.querySelector('.bm-line:last-child [data-bm-product]'); }
      input.value = record.id;
      const price = input.closest('.bm-line').querySelector('[name="precioUnitario"]');
      if (!price.value) price.value = window.BusinessNumbers.moneyInput(record.costoUnitario || 0);
    }
    dialogBody.querySelectorAll('.bm-line').forEach(updateLineUnit);
    preview();
    dialog.scrollTop = saved.scrollTop;
    saved.focus?.focus({ preventScroll: true });
  }
  function closeForm() {
    if (formContext?.returnTo) restorePurchase(formContext);
    else dialog?.close();
  }
  function lines(ingredient = false) {
    return [...dialogBody.querySelectorAll('.bm-line')].map(row => {
      const values = Object.fromEntries([...row.querySelectorAll('input,select')].map(e => [e.name, e.value]));
      const quantity = ingredient ? 'cantidadRequerida' : 'cantidad';
      values[quantity] = window.BusinessNumbers.parseQuantityInput(values[quantity]);
      if (!ingredient) {
        const product = window.Finanzas.getProductoById(values.productoId);
        values.precioUnitario = String(product?.[formContext.kind === 'purchase' ? 'costoUnitario' : 'precioVenta'] ?? 0);
        values.descuentoPorcentaje = window.BusinessNumbers.parseQuantityInput(values.descuentoPorcentaje || '0', { scale: 2 });
      }
      if (!ingredient) { [values.tipoImpuesto, values.tarifaImpuesto] = values.impuesto.split(':'); delete values.impuesto; }
      return values;
    });
  }
  function preview() {
    const out = dialogBody?.querySelector('.bm-preview'); if (!out) return;
    if ([...dialogBody.querySelectorAll('[data-bm-product]')].every(input => !input.value)) { out.textContent = 'Selecciona un producto e ingresa su cantidad y precio para ver el total.'; return; }
    try { const t = window.InvoiceMoney.calculate(lines().map(l => ({ quantity: l.cantidad, unitPrice: l.precioUnitario, discountPercent: l.descuentoPorcentaje, taxKind: l.tipoImpuesto, taxRate: l.tarifaImpuesto }))); if (formContext.kind === 'sale') out.innerHTML = [['Subtotal', t.gross], ['Descuentos', t.discount], ['Base gravable', t.base], ['Impuestos', t.tax], ['Total de la venta', t.total]].map(([label, value]) => `<span><span>${label}</span><strong>${E(money(value))}</strong></span>`).join(''); else out.textContent = `Base: ${money(t.base)} · Impuestos: ${money(t.tax)} · Total: ${money(t.total)}`; }
    catch (e) { out.textContent = e.message; }
  }
  async function submit(event) {
    event.preventDefault(); event.stopPropagation(); if (busy) return;
    const ctx = formContext, data = Object.fromEntries(new FormData(event.target));
    if (ctx.businessId !== window.Finanzas.state.negocioActivoId) { feedback.textContent = 'Cambió el negocio activo. Abra el formulario nuevamente.'; return; }
    try {
      for (const input of event.target.querySelectorAll('[data-bm-number]')) {
        if (input.closest('.bm-line')) continue;
        const value = input.value || input.dataset.defaultNumber || '';
        if (moneyFields.has(input.name)) data[input.name] = window.BusinessNumbers.parseMoneyInput(value, { scale: ['costoUnitario', 'precioVenta'].includes(input.name) ? 4 : 2, allowEmpty: !input.required });
        else if (quantityFields.has(input.name)) data[input.name] = window.BusinessNumbers.parseQuantityInput(value);
      }
      if (ctx.kind === 'product' && data.unidadMedida === '__CUSTOM__') {
        if (!data.unidadPersonalizada?.trim()) throw new Error('Escribe el nombre de la unidad de medida.');
        data.unidadMedida = window.BusinessProductUnits.normalize(data.unidadPersonalizada);
      }
      delete data.unidadPersonalizada;
      if (['sale', 'purchase'].includes(ctx.kind)) data.detalles = lines();
      if (ctx.kind === 'formula') data.ingredientes = lines(true);
    } catch (e) { feedback.textContent = e.message; feedback.focus(); return; }
    if (['sale', 'purchase'].includes(ctx.kind)) { if (!data.montoPagado) data.montoPagado = data.tipoPago === 'CREDITO' ? '0' : undefined; }
    if (ctx.kind === 'expense' && !ctx.r.id && !data.montoPagado) data.montoPagado = data.tipoPago === 'CREDITO' ? '0' : undefined;
    if (ctx.r.id && kindCollection[ctx.kind]) { data.id = ctx.r.id; data.revision = ctx.r.revision || 0; }
    if (ctx.kind === 'production') { delete data.id; delete data.revision; }
    if (['cancel', 'archive', 'deleteBusiness'].includes(ctx.kind)) Object.assign(data, { id: ctx.r.id, collection: ctx.collection, revision: ctx.r.revision || 0 });
    if (ctx.kind === 'payment') Object.assign(data, { id: ctx.r.id, ventaId: ctx.r.id, clienteId: ctx.r.clienteId, collection: ctx.collection });
    const command = { product: 'saveProduct', customer: 'saveCustomer', supplier: 'saveSupplier', employee: 'saveEmployee', expense: 'saveExpense', income: 'saveIncome', sale: 'sale', purchase: 'purchase', stock: 'inventoryMovement', payroll: 'payroll', formula: 'saveFormula', production: 'production', business: 'saveBusiness', cancel: 'cancel', archive: 'archive', deleteBusiness: 'deleteBusiness', payment: ctx.collection === 'ventas' ? 'paySale' : 'payPurchase' }[ctx.kind];
    busy = true; dialog.setAttribute('aria-busy', 'true'); feedback.textContent = 'Guardando…'; const buttons = [...dialog.querySelectorAll('button')]; buttons.forEach(b => { b.disabled = true; });
    try {
      const out = await window.Finanzas.getBusinessService().execute(command, data, ctx.key);
      if (ctx.returnTo) {
        restorePurchase(ctx, out.record);
        notice(out.message || 'Guardado y verificado en el almacenamiento local.');
        return;
      }
      dialog.close();
      const destinations = { product: ['inventory'], stock: ['inventory'], customer: ['contacts', 'customers'], supplier: ['contacts', 'suppliers'], employee: ['management', 'employees'], payroll: ['management', 'employees'], sale: ['sales'], purchase: ['inventory'], expense: ['expenses', 'expenses'], income: ['expenses', 'incomes'], formula: ['management', 'production'], production: ['management', 'production'], business: ['dashboard'], deleteBusiness: ['dashboard'] };
      if (destinations[ctx.kind]) navigate(...destinations[ctx.kind]); else renderAll();
      window.BusinessReportsView.render(window.Finanzas, window.Finanzas.getNegocioActivo());
      notice(out.message || 'Guardado y verificado en el almacenamiento local.');
      if (ctx.kind === 'sale') saleComplete(out.record);
    } catch (e) { feedback.textContent = e.message; feedback.focus(); }
    finally { busy = false; dialog.removeAttribute('aria-busy'); buttons.forEach(b => { b.disabled = false; }); }
  }
  function notice(message) { if (typeof pcApp !== 'undefined') pcApp.showToast(message); else window.mobileApp?.mostrarToast(message); }
  function detail(collection, id) {
    ensureDialog(); const r = window.Finanzas.state[collection]?.find(x => x.id === id && (collection === 'negocios' || x.negocioId === window.Finanzas.state.negocioActivoId)); if (!r) return notice('Registro no encontrado.');
    formContext = { kind: 'detail', r, collection }; focusReturn = document.activeElement; feedback.textContent = ''; dialog.querySelector('h2').textContent = r.nombre || r.numeroFactura || r.descripcion || 'Consultar registro';
    const labels = { nombre: 'Nombre', cedula: 'Identificación', direccion: 'Dirección', email: 'Correo', telefono: 'Teléfono', fecha: 'Fecha', fechaVencimiento: 'Vencimiento', tipoPago: 'Condición de pago', metodoPago: 'Medio de pago', unidadMedida: 'Unidad de medida', stock: 'Existencias', stockMinimo: 'Mínimo', precioVenta: 'Precio COP', costoUnitario: 'Costo unitario COP', total: 'Total histórico COP', monto: 'Monto COP', saldoPendiente: 'Saldo pendiente COP', montoPagado: 'Pagado COP', estado: 'Estado', categoria: 'Categoría', descripcion: 'Descripción', proveedorNombre: 'Proveedor histórico', clienteNombre: 'Cliente histórico', empleadoNombre: 'Empleado histórico', cargo: 'Cargo', periodo: 'Período', productoNombre: 'Producto', cantidadProducida: 'Cantidad fabricada', costoTotal: 'Costo del lote' };
    const detailValue = key => ['precioVenta', 'costoUnitario', 'total', 'monto', 'saldoPendiente', 'montoPagado', 'costoTotal'].includes(key) ? money(r[key]) : key === 'unidadMedida' ? window.BusinessProductUnits.get(r[key]).label : ['stock', 'stockMinimo'].includes(key) ? window.BusinessProductUnits.formatQuantity(r[key], r.unidadMedida) : r[key];
    const paymentRows = [...(window.Finanzas.state.pagosVenta || []), ...(window.Finanzas.state.pagosCompra || []), ...(window.Finanzas.state.pagosGasto || []), ...(window.Finanzas.state.pagosEmpleado || [])].filter(p => p.negocioId === window.Finanzas.state.negocioActivoId && (p.ventaId === id || p.compraId === id || p.gastoId === id || p.empleadoId === id));
    const linked = collection === 'clientes' ? window.Finanzas.state.ventas.filter(v => v.clienteId === id) : collection === 'proveedores' ? window.Finanzas.state.compras.filter(c => c.proveedorId === id) : [];
    dialogBody.innerHTML = `<dl class="bm-detail">${Object.entries(labels).filter(([k]) => r[k] !== undefined).map(([k, label]) => `<div><dt>${label}</dt><dd>${E(detailValue(k))}</dd></div>`).join('')}</dl>${r.detalles?.length ? `<h3>Detalle histórico</h3>${tableHtml(r.detalles, [col('Producto', l => l.productoNombre), col('Cantidad', l => l.cantidad), col('Precio', l => money(l.precioUnitario)), col('Subtotal', l => money(l.subtotal))])}` : ''}${r.ingredientes?.length ? `<h3>Ingredientes</h3>${tableHtml(r.ingredientes, [col('Insumo', i => i.materiaPrimaNombre), col('Cantidad', i => i.cantidadRequerida)])}` : ''}${linked.length ? `<h3>Operaciones asociadas</h3>${tableHtml(linked, [col('Fecha', v => v.fecha), col('Referencia', v => v.numeroFactura || v.id), col('Total', v => money(v.total)), col('Saldo', v => money(v.saldoPendiente))])}` : ''}${paymentRows.length ? `<h3>Historial de pagos</h3>${tableHtml(paymentRows, [col('Fecha', p => p.fecha), col('Monto', p => money(p.monto)), col('Medio', p => p.metodoPago)])}` : ''}${r.anulacion ? `<p class="bm-note">Anulación: ${E(r.anulacion.fecha)} · ${E(r.anulacion.motivo)}</p>` : ''}<details><summary>Auditoría de este registro</summary><ul>${(window.Finanzas.state.businessLedger?.audit || []).filter(a => a.recordId === id).map(a => `<li>${E(a.at)} · ${E(a.action)} · ${E(a.actor)}</li>`).join('') || '<li>Registro histórico anterior a la bitácora actual.</li>'}</ul></details><div class="bm-actions">${button('Cerrar', 'close')}${['ventas', 'compras', 'gastosNegocio', 'ingresosNegocio', 'pagosEmpleado'].includes(collection) ? action('Imprimir comprobante', 'print', collection, id) : ''}</div>`;
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
    document.querySelectorAll('#navEmpresarial [data-view]').forEach(b => { const icon = b.querySelector('.nav-icon'); if (icon && b.dataset.businessIcon) icon.innerHTML = window.BusinessWorkspaceScreens.icon(b.dataset.businessIcon); const label = b.textContent.trim().replace(/\s+/g, ' '); b.setAttribute('aria-label', label); b.title = label; });
    const mobileIcons = { negocio: 'dashboard', inventario: 'inventory', ventas: 'sales', informes: 'reports', gestion: 'products' };
    document.querySelectorAll('#mobileBusinessNav [data-business-tab]').forEach(b => { const icon = b.querySelector('span'); if (icon) icon.innerHTML = window.BusinessWorkspaceScreens.icon(mobileIcons[b.dataset.businessTab]); });
    document.addEventListener('click', event => {
      const b = event.target.closest('[data-bm]'); if (!b || busy) return;
      const root = b.closest('[data-business-section]'), { bm: command, kind, collection, id } = b.dataset;
      try {
        if (command === 'close') closeForm();
        else if (command === 'navigate') navigate(b.dataset.section, b.dataset.tab);
        else if (command === 'form') form(kind, id, collection);
        else if (command === 'detail') detail(collection, id);
        else if (command === 'archive' || command === 'cancel') form(command, id, collection);
        else if (command === 'invoice') window.InvoiceUI.open(id);
        else if (command === 'report') { const tab = root?.dataset.tab; window.BusinessReportsView.openSection(({ purchases: 'purchases', receivables: 'balances', payables: 'balances', employees: 'operations', production: 'operations' })[tab] || 'overview'); }
        else if (command === 'print') printRecord(collection, id);
        else if (command === 'download-sale') downloadSale(id);
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
    dialogBody.innerHTML = `<div class="bm-form-grid">${[['sale', 'Registrar venta'], ['purchase', 'Agregar productos al inventario'], ['expense', 'Registrar gasto'], ['income', 'Registrar ingreso'], ['stock', 'Movimiento de inventario'], ['customer', 'Registrar cliente'], ['employee', 'Registrar empleado']].map(([kind, label]) => button(label, 'form', `data-kind="${kind}"`)).join('')}${button('Alertas y vencimientos', 'alerts')}</div>`;
    if (!dialog.open) dialog.showModal();
  }
  function search(section, query) { if (section === 'movements') section = 'expenses'; navigate(section); const root = document.querySelector(`[data-business-section="${section}"]`); if (root) { root.dataset.query = query; renderRoot(root); } }
  function alerts() {
    ensureDialog(); if (busy) return;
    const model = window.BusinessReadModel.build(window.Finanzas), today = window.BusinessUtils.today();
    const overdue = [...model.receivables.map(r => ({ ...r, collection: 'ventas' })), ...model.payables].filter(r => (r.fechaVencimiento || window.Finanzas.state.facturacion?.documents.find(d => d.id === r.invoiceDocumentId)?.dueDate || '9999') < today);
    focusReturn = document.activeElement; feedback.textContent = ''; dialog.querySelector('h2').textContent = 'Alertas de Mi Negocio';
    dialogBody.innerHTML = `<h3>Inventario bajo · ${model.lowStock.length}</h3>${tableHtml(model.lowStock, [col('Producto', r => r.nombre), col('Existencias', r => r.stock), col('Mínimo', r => r.stockMinimo || 0), col('Acciones', r => action('Consultar', 'detail', 'productos', r.id), true)])}<h3>Obligaciones vencidas · ${overdue.length}</h3>${tableHtml(overdue, [col('Referencia', r => r.numeroFactura || r.numeroCompra || (r.id?.length > 20 ? `CMP-${r.id.slice(0, 8).toUpperCase()}` : r.id)), col('Cliente / proveedor', r => r.clienteNombre || r.proveedorNombre), col('Saldo', r => money(r.saldoPendiente)), col('Acciones', r => action('Consultar', 'detail', r.collection, r.id), true)])}<div class="bm-actions">${button('Cerrar', 'close')}</div>`;
    if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.BusinessUI = { renderAll, navigate, form, detail, selectBusiness, printRecord, actions, search, alerts };
})();
