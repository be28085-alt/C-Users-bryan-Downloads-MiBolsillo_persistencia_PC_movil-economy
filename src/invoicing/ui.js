(function () {
  'use strict';
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const labels = { BORRADOR: 'Borrador', EN_VALIDACION_SIMULADA: 'En validación simulada', VALIDADA_INTERNA: 'Validada internamente', RECHAZADA_INTERNA: 'Rechazada internamente', ANULADA: 'Anulada mediante nota crédito' };
  const money = v => `${String(v ?? '0.00').replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/\.(\d{2})$/, ',$1')} COP`;
  const field = (label, name, value = '', extra = '') => `<label>${E(label)}<input name="${name}" value="${E(value)}" ${extra}></label>`;
  const option = (value, label, selected) => `<option value="${E(value)}" ${value === selected ? 'selected' : ''}>${E(label)}</option>`;
  let dialog, body, message, service, selectedId, draft, formKey, busy = false, returnFocus, filters = {};
  const key = () => window.InvoiceUtils.uuid();
  function error(e) { message.textContent = e.message || String(e); message.focus(); }
  function buttons() { return `<div class="inv-actions"><button type="button" data-inv="home">Historial</button><button type="button" class="inv-primary" data-inv="new">+ Nueva factura</button></div>`; }
  function ensure() {
    if (dialog) return;
    service = new window.InvoiceService();
    dialog = document.createElement('dialog'); dialog.className = 'invoice-dialog'; dialog.setAttribute('aria-labelledby', 'invoice-title');
    dialog.innerHTML = `<header class="inv-top"><div><small>MI NEGOCIO · ENTORNO LOCAL</small><h1 id="invoice-title">Facturación simulada</h1></div><button type="button" data-inv="close" aria-label="Cerrar facturación">Cerrar ✕</button></header><p class="inv-warning">SIMULACIÓN SIN VALIDEZ FISCAL · Sin envío ni validación oficial de la DIAN.</p><p class="inv-message" role="alert" tabindex="-1"></p><main class="inv-body"></main>`;
    document.body.appendChild(dialog); body = dialog.querySelector('.inv-body'); message = dialog.querySelector('.inv-message');
    dialog.addEventListener('click', event => { const button = event.target.closest('[data-inv]'); if (button) handle(button.dataset.inv, button.dataset.id, button); });
    dialog.addEventListener('submit', event => {
      event.preventDefault();
      try {
        if (event.target.id === 'inv-editor') save(event.submitter?.value === 'submit');
        else if (event.target.id === 'inv-filters') { filters = Object.fromEntries(new FormData(event.target)); history(); message.textContent = ''; }
        else if (event.target.id === 'inv-payment') pay(event.target);
      } catch (e) { error(e); }
    });
    dialog.addEventListener('input', event => { if (event.target.closest('#inv-editor')) preview(); });
    dialog.addEventListener('change', event => {
      if (event.target.name === 'productId') { const p = service.core.state.productos.find(p => p.id === event.target.value); const row = event.target.closest('.inv-line'); row.querySelector('[name="unitPrice"]').value = String(p?.precioVenta || '0'); preview(); }
      if (event.target.name === 'customerId') fillCustomer(event.target.value);
    });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => returnFocus?.focus());
  }
  function open(id = null) {
    try {
      ensure(); service.list(); returnFocus = document.activeElement; message.textContent = ''; history();
      if (id) details(id);
      if (!dialog.open) dialog.showModal();
    } catch (e) { if (dialog?.open) error(e); else window.alert(e.message); }
  }
  function history() {
    dialog.scrollTop = 0;
    selectedId = null;
    const all = service.list(), M = window.InvoiceMoney; let revenue = 0n;
    for (const d of all.filter(d => ['VALIDADA_INTERNA', 'ANULADA'].includes(d.status))) revenue += (d.kind === 'CREDIT_NOTE' ? -1n : 1n) * M.units(d.totals.base);
    const balances = service.core.getVentas().filter(v => v.invoiceDocumentId).reduce((s, v) => s + M.units(v.saldoPendiente), 0n);
    const documents = service.list(filters);
    body.innerHTML = `${buttons()}<div class="inv-kpis">${[['Ventas netas sin impuestos', money(M.decimal(revenue))], ['Facturas confirmadas', all.filter(d => d.kind === 'INVOICE' && ['VALIDADA_INTERNA', 'ANULADA'].includes(d.status)).length], ['Pendientes de validar', all.filter(d => ['BORRADOR', 'EN_VALIDACION_SIMULADA', 'RECHAZADA_INTERNA'].includes(d.status)).length], ['Clientes facturados', new Set(all.filter(d => d.kind === 'INVOICE' && ['VALIDADA_INTERNA', 'ANULADA'].includes(d.status)).map(d => `${d.customer.documentType}:${d.customer.document}`)).size], ['Cuentas por cobrar', money(M.decimal(balances))]].map(([label, value]) => `<article><span>${label}</span><strong>${E(value)}</strong></article>`).join('')}</div>
      <form id="inv-filters" class="inv-filters">${field('Cliente / identificación', 'customer', filters.customer)}${field('Número / ID interno', 'number', filters.number)}<label>Estado<select name="status">${option('', 'Todos', filters.status)}${Object.entries(labels).map(([v, l]) => option(v, l, filters.status)).join('')}</select></label>${field('Desde', 'from', filters.from, 'type="date"')}${field('Hasta', 'to', filters.to, 'type="date"')}${field('Valor mínimo', 'min', filters.min, 'inputmode="decimal"')}${field('Valor máximo', 'max', filters.max, 'inputmode="decimal"')}<button>Filtrar</button><button type="button" data-inv="clear">Limpiar filtros</button></form>
      <div class="inv-table-wrap"><table><caption>Documentos internos · ${documents.length} resultados</caption><thead><tr><th>Documento</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th>Total original</th><th>Acción</th></tr></thead><tbody>${documents.map(d => `<tr><td><strong>${E(d.number || 'Borrador')}</strong><small>${E(window.InvoiceExports.kindLabel[d.kind])}</small></td><td>${E(d.customer.name)}<small>${E(d.customer.document)}</small></td><td>${E(d.date)}</td><td><span class="inv-status ${d.status}">${E(labels[d.status])}</span></td><td>${E(money(d.totals.total))}</td><td><button type="button" data-inv="detail" data-id="${E(d.id)}">Consultar</button></td></tr>`).join('') || '<tr><td colspan="6">No hay documentos con estos filtros. Cree una factura para comenzar.</td></tr>'}</tbody></table></div><p class="inv-muted">Los importes del historial son históricos. Las notas se reflejan en ventas y cartera. Los ajustes parciales son monetarios; la anulación total devuelve inventario. Acceso por roles locales, sin autenticación de servidor.</p>`;
  }
  function fillCustomer(id) {
    const c = service.core.getClientes().find(c => c.id === id); if (!c) return;
    const form = body.querySelector('#inv-editor');
    for (const [name, value] of Object.entries({ name: c.nombre, document: c.cedula, documentType: c.tipoDocumento || 'CC', email: c.email, address: c.direccion, phone: c.telefono })) form.elements[name].value = value || '';
  }
  function lineHtml(l = {}, adjustment = false) {
    const products = service.core.getProductos(); const first = products.find(p => Number(p.precioVenta) > 0) || products[0];
    const productId = l.productId || first?.id;
    const taxValue = `${l.taxKind || 'IVA'}:${l.taxRate ? Number(l.taxRate) : 19}`;
    return `<div class="inv-line">${adjustment ? field('Descripción del ajuste', 'description', l.description || 'Ajuste comercial', 'required maxlength="200"') : `<label>Producto<select name="productId" required>${products.map(p => option(p.id, `${p.nombre} · stock ${p.stock}`, productId)).join('')}</select></label>`}${field('Cantidad', 'quantity', l.quantity || '1', 'required inputmode="decimal"')}${field('Precio antes de impuestos', 'unitPrice', l.unitPrice || String(first?.precioVenta || '0'), 'required inputmode="decimal"')}${field('Descuento %', 'discountPercent', l.discountPercent || '0', 'required inputmode="decimal"')}<label>Impuesto<select name="tax">${[['IVA:19', 'IVA 19%'], ['IVA:5', 'IVA 5%'], ['IVA:0', 'IVA 0%'], ['EXENTO:0', 'Exento'], ['EXCLUIDO:0', 'Excluido'], ['INC:8', 'INC 8%']].map(([v, label]) => option(v, label, taxValue)).join('')}</select></label><button type="button" data-inv="remove-line" aria-label="Eliminar artículo">Eliminar</button></div>`;
  }
  function edit(document = null, original = null, kind = 'INVOICE', cancellation = false) {
    dialog.scrollTop = 0;
    draft = document || { kind, originalId: original?.id || null, cancellation, customer: original?.customer || {}, date: window.InvoiceUtils.today(), dueDate: window.InvoiceUtils.today(), paymentTerms: original?.paymentTerms || 'CONTADO', paymentMethod: original?.paymentMethod || 'Efectivo', totals: { lines: cancellation ? original.totals.lines : [] }, notes: '', reason: '' };
    formKey = key(); selectedId = null;
    const c = draft.customer, adjustment = draft.kind !== 'INVOICE';
    body.innerHTML = `${buttons()}<h2>${E(window.InvoiceExports.kindLabel[draft.kind])}${draft.cancellation ? ' · Anulación total' : ''}</h2>${adjustment ? `<p class="inv-warning">Referencia: ${E(original?.number || draft.originalNumber)}. ${draft.cancellation ? 'Al confirmar se revierte el inventario y se registra la devolución de pagos que corresponda.' : 'Ajuste monetario de base e impuestos; conserva las cantidades del inventario.'}</p>` : ''}
      <form id="inv-editor"><fieldset><legend>Documento y pago</legend><div class="inv-grid">${field('Fecha de emisión', 'date', draft.date, 'type="date" required')}${field('Fecha de vencimiento', 'dueDate', draft.dueDate, 'type="date" required')}<label>Condición de pago<select name="paymentTerms">${option('CONTADO', 'Contado', draft.paymentTerms)}${option('CREDITO', 'Crédito', draft.paymentTerms)}</select></label><label>Medio de pago<select name="paymentMethod">${['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].map(m => option(m, m, draft.paymentMethod)).join('')}</select></label></div></fieldset>
      <fieldset ${adjustment ? 'disabled' : ''}><legend>Cliente · copia histórica por documento</legend>${!adjustment ? `<label>Usar cliente existente<select name="customerId">${option('', 'Nuevo cliente', '')}${service.core.getClientes().filter(c => c.estado !== 'ARCHIVADO').map(c => option(c.id, `${c.nombre} · ${c.cedula}`, '')).join('')}</select></label>` : ''}<div class="inv-grid">${field('Nombre / razón social', 'name', c.name, 'required maxlength="200"')}<label>Tipo de identificación<select name="documentType">${['CC', 'NIT', 'CE', 'PASAPORTE'].map(t => option(t, t, c.documentType || 'CC')).join('')}</select></label>${field('Número de identificación', 'document', c.document, 'required maxlength="20"')}${field('Correo electrónico', 'email', c.email, 'type="email" maxlength="200"')}${field('Dirección', 'address', c.address, 'maxlength="200"')}${field('Teléfono', 'phone', c.phone, 'type="tel" maxlength="40"')}</div></fieldset>
      ${draft.cancellation ? '<p>La nota utilizará exactamente los artículos e importes históricos de la factura original.</p>' : `<fieldset><legend>Artículos · COP · use punto decimal sin separadores de miles</legend><div id="inv-lines">${(draft.totals.lines.length ? draft.totals.lines : [{}]).map(l => lineHtml(l, adjustment)).join('')}</div><button type="button" data-inv="add-line">+ Agregar artículo</button></fieldset>`}
      <div class="inv-grid">${adjustment ? field('Motivo del ajuste', 'reason', draft.reason, 'required maxlength="1000"') : ''}<label>Observaciones<textarea name="notes" maxlength="1000">${E(draft.notes)}</textarea></label></div>
      <output id="inv-preview" aria-live="polite"></output><p class="inv-muted">HALF_UP: bruto, descuento e impuesto se redondean por artículo a 2 decimales. Cantidades y precios admiten 4 decimales. Revise el tratamiento tributario de cada artículo.</p><div class="inv-actions"><button type="submit" value="draft">Guardar borrador</button><button class="inv-primary" type="submit" value="submit">Guardar y validar internamente</button></div></form>`;
    preview();
  }
  function readLines() {
    return [...body.querySelectorAll('.inv-line')].map(row => {
      const value = name => row.querySelector(`[name="${name}"]`)?.value;
      const [taxKind, taxRate] = value('tax').split(':');
      return { productId: value('productId') || null, description: value('description'), quantity: value('quantity'), unitPrice: value('unitPrice'), discountPercent: value('discountPercent'), taxKind, taxRate };
    });
  }
  function preview() {
    const output = body.querySelector('#inv-preview'); if (!output) return;
    try { const t = draft.cancellation ? draft.totals : window.InvoiceMoney.calculate(readLines()); output.textContent = `Base ${money(t.base)} · Descuentos ${money(t.discount)} · Impuestos ${money(t.tax)} · Total ${money(t.total)}`; } catch (e) { output.textContent = e.message; }
  }
  async function run(operation) {
    if (busy) return;
    busy = true; message.textContent = 'Procesando…'; dialog.setAttribute('aria-busy', 'true');
    const controls = [...dialog.querySelectorAll('button')]; controls.forEach(b => { b.dataset.wasDisabled = String(b.disabled); b.disabled = true; });
    try { await operation(); message.textContent = ''; } catch (e) { error(e); }
    finally { busy = false; dialog.removeAttribute('aria-busy'); controls.forEach(b => { b.disabled = b.dataset.wasDisabled === 'true'; }); }
  }
  function save(submit) {
    run(async () => {
      const f = new FormData(body.querySelector('#inv-editor'));
      const input = { id: draft.id, revision: draft.revision, kind: draft.kind, originalId: draft.originalId, cancellation: draft.cancellation, customer: Object.fromEntries(['name', 'documentType', 'document', 'email', 'address', 'phone'].map(k => [k, f.get(k)])), date: f.get('date'), dueDate: f.get('dueDate'), paymentTerms: f.get('paymentTerms'), paymentMethod: f.get('paymentMethod'), lines: readLines(), notes: f.get('notes'), reason: f.get('reason') };
      const saved = await service.saveDraft(input, formKey);
      // A successful draft survives reload and a later provider/storage error; never create a second document.
      draft = saved; formKey = key();
      if (submit) {
        try { await service.submit(saved.id, key()); }
        catch (e) { details(saved.id); throw e; }
      }
      details(saved.id);
    });
  }
  function details(id) {
    dialog.scrollTop = 0;
    const d = service.get(id); selectedId = id;
    const sale = service.core.getVentas().find(v => v.invoiceDocumentId === id);
    const audit = service.auditTrail(id);
    const refunds = (service.core.state.facturacion.refunds || []).filter(r => r.saleId === sale?.id);
    body.innerHTML = `${buttons()}<div class="inv-document-head"><div><p>${E(window.InvoiceExports.kindLabel[d.kind])}</p><h2>${E(d.number || 'Borrador')}</h2><span class="inv-status ${d.status}">${E(labels[d.status])}</span><p>${E(d.customer.name)} · ${E(d.customer.documentType)} ${E(d.customer.document)}</p><p>${E(d.customer.address)} · ${E(d.customer.email)}</p><p>${E(d.date)} · Total histórico: <strong>${E(money(d.totals.total))}</strong></p>${d.originalId ? `<button type="button" data-inv="detail" data-id="${E(d.originalId)}">Consultar factura original ${E(d.originalNumber)}</button><p>${E(d.reason)}</p>` : ''}${sale ? `<p>Valor ajustado: ${E(money(Number(sale.total).toFixed(2)))} · Por cobrar: ${E(money(Number(sale.saldoPendiente).toFixed(2)))}</p>` : ''}${refunds.length ? `<p>Devoluciones registradas: ${E(money(window.InvoiceMoney.decimal(refunds.reduce((s, r) => s + window.InvoiceMoney.units(r.amount), 0n))))}</p>` : ''}</div><div class="inv-qr">${window.InvoiceExports.qr(d).createSvgTag({ cellSize: 3, margin: 12, scalable: true })}<a href="${E(window.InvoiceExports.consultationUrl(d))}">Consulta interna</a><small>Requiere acceso y datos en este navegador.</small></div></div>
      ${d.validation?.errors?.length ? `<p class="inv-warning">${d.validation.errors.map(E).join('<br>')}</p>` : ''}<div class="inv-actions">${['BORRADOR', 'RECHAZADA_INTERNA'].includes(d.status) ? '<button type="button" data-inv="edit">Editar borrador</button>' : ''}${['BORRADOR', 'RECHAZADA_INTERNA', 'EN_VALIDACION_SIMULADA'].includes(d.status) ? '<button type="button" class="inv-primary" data-inv="validate">Validar / reintentar simulación</button>' : ''}<button type="button" data-inv="pdf">Descargar PDF</button><button type="button" data-inv="xml">XML experimental UBL 2.1</button>${d.kind === 'INVOICE' && d.status === 'VALIDADA_INTERNA' ? '<button type="button" data-inv="credit">Nota crédito</button><button type="button" data-inv="debit">Nota débito</button><button type="button" data-inv="cancel-invoice">Anular mediante nota crédito total</button>' : ''}</div>
      <div class="inv-table-wrap"><table><caption>Detalle histórico</caption><thead><tr><th>Artículo</th><th>Cantidad</th><th>Precio</th><th>Descuento</th><th>Impuesto</th><th>Total</th></tr></thead><tbody>${d.totals.lines.map(l => `<tr><td>${E(l.description)}</td><td>${E(l.quantity)}</td><td>${E(l.unitPrice)}</td><td>${E(l.discount)}</td><td>${E(l.taxKind)} ${E(l.taxRate)}% · ${E(l.tax)}</td><td>${E(l.total)}</td></tr>`).join('')}</tbody></table></div>
      ${sale?.saldoPendiente > 0 && d.status === 'VALIDADA_INTERNA' ? `<form id="inv-payment"><fieldset><legend>Registrar cobro</legend><div class="inv-grid">${field('Valor del abono COP', 'amount', '', 'required inputmode="decimal"')}<label>Medio<select name="method">${['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].map(m => option(m, m, d.paymentMethod)).join('')}</select></label><button class="inv-primary">Registrar pago</button></div></fieldset></form>` : ''}
      <details><summary>Auditoría · ${audit.length} eventos</summary><ol>${audit.map(a => `<li>${E(a.at)} · ${E(a.action)} · ${E(a.actor)} ${E(a.detail)}</li>`).join('')}</ol></details><p class="inv-muted">ID interno: ${E(d.simulationId)}<br>XML experimental, sin comprobación XSD ni conformidad DIAN. No incluye CUFE/CUDE, firma o autorización oficial.</p>`;
    const payment = body.querySelector('#inv-payment'); if (payment) payment.dataset.operationKey = key();
  }
  function pay(form) { const f = new FormData(form), id = selectedId, operationKey = form.dataset.operationKey; run(async () => { await service.pay(id, f.get('amount'), f.get('method'), operationKey); details(id); }); }
  async function handle(action, id, button) {
    if (busy) return;
    try {
      if (action === 'close') dialog.close();
      else if (action === 'home') history();
      else if (action === 'clear') { filters = {}; history(); }
      else if (action === 'new') edit();
      else if (action === 'detail') details(id);
      else if (action === 'edit') edit(service.get(selectedId));
      else if (action === 'add-line') { body.querySelector('#inv-lines').insertAdjacentHTML('beforeend', lineHtml({}, draft.kind !== 'INVOICE')); preview(); }
      else if (action === 'remove-line') { button.closest('.inv-line').remove(); preview(); }
      else if (action === 'pdf' || action === 'xml') window.InvoiceExports.download(service.get(selectedId), action);
      else if (action === 'validate') { const current = selectedId; run(async () => { await service.submit(current, key()); details(current); }); }
      else if (['credit', 'debit', 'cancel-invoice'].includes(action)) edit(null, service.get(selectedId), action === 'debit' ? 'DEBIT_NOTE' : 'CREDIT_NOTE', action === 'cancel-invoice');
    } catch (e) { error(e); }
  }
  function init() {
    document.addEventListener('click', event => { if (event.target.closest('[data-invoice-open]')) open(); });
    const id = new URLSearchParams(window.location.search).get('facturaSimulada');
    if (id) {
      // The ordinary controllers initialize business navigation first. Never switch business identity from a QR.
      setTimeout(() => {
        if (window.mobileApp) window.mobileApp.setModulo('EMPRESARIAL', 'negocio');
        open(id);
      }, 0);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.InvoiceUI = { open };
})();
