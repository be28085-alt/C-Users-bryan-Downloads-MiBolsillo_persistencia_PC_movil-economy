(function () {
  'use strict';
  const M = window.InvoiceMoney;
  const clone = value => JSON.parse(JSON.stringify(value));
  const uuid = () => { if (!window.crypto?.randomUUID) throw new Error('Use localhost o HTTPS con crypto.randomUUID.'); return window.crypto.randomUUID(); };
  const today = () => window.obtenerFechaHoyISO ? window.obtenerFechaHoyISO() : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const amount = v => M.units(v ?? '0');
  const legacy = v => Number(M.decimal(v)); // Compatibility projection ONLY, never used for invoice arithmetic.
  const text = (v, max = 200) => String(v ?? '').trim().slice(0, max);
  function init(state) {
    state.facturacion ||= { version: 1, documents: [], sequences: {}, operations: [], audit: [], refunds: [] };
    ['ventas', 'clientes', 'productos', 'movimientosInventario', 'pagosVenta'].forEach(k => { state[k] ||= []; });
    return state.facturacion;
  }
  function access(state, write = false) {
    if (state.moduloActivo !== 'EMPRESARIAL') throw new Error('La facturación está disponible exclusivamente en Mi Negocio.');
    const business = state.negocios?.find(n => n.id === state.negocioActivoId);
    if (!business) throw new Error('Seleccione un negocio.');
    const role = state.usuario?.facturacionRol || 'PROPIETARIO_LOCAL';
    if (!['PROPIETARIO_LOCAL', 'FACTURADOR', 'LECTOR'].includes(role) || (write && role === 'LECTOR')) throw new Error('No tiene permiso para esta operación.');
    if (state.usuario?.facturacionNegocios && !state.usuario.facturacionNegocios.includes(business.id)) throw new Error('Sin acceso a este negocio.');
    return business;
  }
  function audit(f, doc, action, state, detail = '') {
    f.audit.push({ id: uuid(), documentId: doc.id, businessId: doc.businessId, action, detail, at: new Date().toISOString(), actor: text(state.usuario?.email || state.usuario?.nombre || 'Propietario local'), role: state.usuario?.facturacionRol || 'PROPIETARIO_LOCAL' });
  }
  function find(state, id) {
    const business = access(state); const doc = init(state).documents.find(d => d.id === id && d.businessId === business.id);
    if (!doc) throw new Error('Documento no encontrado en este negocio.');
    return doc;
  }
  function validateDate(date) { if (!window.FinanzasDates.esFechaISOValida(date)) throw new Error('Fecha inválida.'); return date; }
  function customer(input = {}) {
    const c = { id: text(input.id), name: text(input.name), documentType: text(input.documentType || 'CC'), document: text(input.document, 20), email: text(input.email), address: text(input.address), phone: text(input.phone, 40) };
    if (!c.name || !['CC', 'NIT', 'CE', 'PASAPORTE'].includes(c.documentType) || !/^[a-zA-Z0-9-]{3,20}$/.test(c.document)) throw new Error('Revise nombre, tipo y número de identificación del cliente.');
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) throw new Error('Correo del cliente inválido.');
    return c;
  }
  class InvoiceService {
    constructor(core = window.Finanzas, provider = new window.MockDianProvider(), repository = new window.LocalInvoiceRepository(core)) { this.core = core; this.provider = provider; this.repository = repository; }
    async transaction(key, payload, mutate) {
      if (!key || String(key).length > 150) throw new Error('Se requiere clave de idempotencia válida.');
      const businessId = access(this.core.state, true).id;
      if (!window.crypto?.subtle) throw new Error('Se requiere un contexto seguro HTTPS o localhost.');
      const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
      const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      return this.repository.transact(state => {
        if (access(state, true).id !== businessId) throw new Error('Cambió el negocio activo; vuelva a abrir el documento.');
        const f = init(state);
        const previous = f.operations.find(o => o.key === key && o.businessId === businessId);
        if (previous) {
          if (previous.fingerprint !== fingerprint) throw new Error('La clave ya fue usada con otros datos.');
          if (previous.resultType === 'document') return clone(f.documents.find(d => d.id === previous.resultId));
          if (previous.resultType === 'payment') return clone(state.pagosVenta.find(p => p.id === previous.resultId));
          return clone(previous.result); // Compatibility with the initial local schema.
        }
        const result = mutate(state, f);
        if (result?.then) throw new Error('La mutación transaccional debe ser síncrona.');
        state.facturacion.operations.push({ key, businessId, fingerprint, resultType: result.simulationId ? 'document' : 'payment', resultId: result.id, at: new Date().toISOString() });
        return result;
      });
    }
    list(filters = {}) {
      const business = access(this.core.state);
      if (filters.from) validateDate(filters.from);
      if (filters.to) validateDate(filters.to);
      const min = filters.min ? amount(filters.min) : null, max = filters.max ? amount(filters.max) : null;
      if ((filters.from && filters.to && filters.from > filters.to) || (min !== null && max !== null && min > max)) throw new Error('El límite inicial del filtro no puede superar el final.');
      return clone((this.core.state.facturacion?.documents || []).filter(d => d.businessId === business.id &&
        (!filters.customer || `${d.customer.name} ${d.customer.document}`.toLowerCase().includes(filters.customer.toLowerCase())) &&
        (!filters.number || `${d.number || ''} ${d.simulationId}`.toLowerCase().includes(filters.number.toLowerCase())) &&
        (!filters.status || d.status === filters.status) && (!filters.from || d.date >= filters.from) && (!filters.to || d.date <= filters.to) &&
        (min === null || amount(d.totals.total) >= min) && (max === null || amount(d.totals.total) <= max)));
    }
    get(id) { return clone(find(this.core.state, id)); }
    auditTrail(id) { this.get(id); return clone((this.core.state.facturacion?.audit || []).filter(a => a.documentId === id)); }
    async saveDraft(input, key) {
      return this.transaction(key, { action: 'draft', input }, (state, f) => {
        const business = access(state, true);
        let doc = input.id ? find(state, input.id) : null;
        if (doc && !['BORRADOR', 'RECHAZADA_INTERNA'].includes(doc.status)) throw new Error('El documento emitido es inmutable; use una nota.');
        if (doc && input.revision !== doc.revision) throw new Error('El borrador cambió en otra pestaña. Vuelva a cargarlo.');
        const kind = input.kind || 'INVOICE';
        if (!['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(kind)) throw new Error('Tipo de documento inválido.');
        if (doc && kind !== doc.kind) throw new Error('No se puede cambiar el tipo de documento.');
        const original = kind !== 'INVOICE' ? find(state, input.originalId) : null;
        if (original && (original.kind !== 'INVOICE' || original.status !== 'VALIDADA_INTERNA')) throw new Error('La referencia debe ser una factura validada internamente y activa.');
        if (original && !text(input.reason)) throw new Error('Indique el motivo del ajuste.');
        if (original && validateDate(input.date) < original.date) throw new Error('La nota no puede ser anterior a la factura.');
        const cancellation = Boolean(input.cancellation);
        if (cancellation && kind !== 'CREDIT_NOTE') throw new Error('La anulación requiere una nota crédito.');
        if (cancellation && f.documents.some(d => d.originalId === original.id && d.status === 'VALIDADA_INTERNA')) throw new Error('La anulación total automática requiere una factura sin notas previas. Use ajustes parciales para conciliar.');
        const lines = cancellation ? clone(original.totals.lines) : (input.lines || []).map(l => {
          const product = l.productId ? state.productos.find(p => p.id === l.productId && p.negocioId === business.id) : null;
          if (l.productId && !product) throw new Error('El producto no pertenece al negocio.');
          if (kind === 'INVOICE' && !product) throw new Error('Seleccione productos del catálogo del negocio.');
          const description = text(l.description || product?.nombre);
          if (!description) throw new Error('Descripción obligatoria.');
          return { productId: product?.id || null, description, sku: text(product?.sku || product?.codigo), unit: text(product?.unidadMedida || 'UND'), quantity: l.quantity, unitPrice: l.unitPrice, unitCost: original ? '0' : String(product?.costoUnitario ?? '0'), discountPercent: l.discountPercent ?? '0', taxKind: l.taxKind || 'IVA', taxRate: l.taxRate ?? '19' };
        });
        const totals = M.calculate(lines);
        const date = validateDate(input.date);
        const paymentTerms = original ? original.paymentTerms : input.paymentTerms;
        if (!['CONTADO', 'CREDITO'].includes(paymentTerms)) throw new Error('Condición de pago inválida.');
        const paymentMethod = text(input.paymentMethod || original?.paymentMethod);
        if (!['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].includes(paymentMethod)) throw new Error('Medio de pago inválido.');
        const dueDate = paymentTerms === 'CREDITO' ? validateDate(input.dueDate || original?.dueDate || date) : date;
        if (dueDate < date && !original) throw new Error('El vencimiento no puede ser anterior a la emisión.');
        const id = doc?.id || uuid();
        const next = { id, simulationId: doc?.simulationId || `SIM-${id}`, businessId: business.id, number: doc?.number || null, kind, originalId: original?.id || null, originalNumber: original?.number || null, cancellation, reason: text(input.reason, 1000), date, dueDate, customer: original ? clone(original.customer) : customer(input.customer), supplier: doc?.supplier || { name: text(business.nombre), document: text(business.nit || business.documento), address: text(business.direccion), email: text(business.email) }, totals, paymentTerms, paymentMethod, notes: text(input.notes, 1000), status: 'BORRADOR', revision: (doc?.revision || 0) + 1, createdAt: doc?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), compliance: { classification: 'EXPERIMENTAL', ublVersion: '2.1', dianAnnexReference: '1.9', schemaValidated: false, dianRulesValidated: false, signed: false, fiscalValidity: false, officialCufe: null, officialCude: null, authorization: null } };
        if (doc) Object.assign(doc, next); else { doc = next; f.documents.unshift(doc); }
        audit(f, doc, 'BORRADOR_GUARDADO', state);
        return doc;
      });
    }
    async submit(id, key) {
      const staged = await this.transaction(`${key}:stage`, { action: 'stage', id }, (state, f) => {
        const doc = find(state, id);
        if (doc.status === 'VALIDADA_INTERNA' || doc.status === 'ANULADA') return doc;
        if (doc.status === 'EN_VALIDACION_SIMULADA') return doc;
        if (!['BORRADOR', 'RECHAZADA_INTERNA'].includes(doc.status)) throw new Error('Estado inválido.');
        if (!doc.number) {
          const sequenceKey = `${doc.businessId}:${doc.kind}`;
          const current = f.sequences[sequenceKey] || 0;
          if (!Number.isSafeInteger(current) || current < 0 || current >= 999999999) throw new Error('Consecutivo interno agotado o inválido.');
          f.sequences[sequenceKey] = current + 1;
          doc.number = `${{ INVOICE: 'SIM-FV', CREDIT_NOTE: 'SIM-NC', DEBIT_NOTE: 'SIM-ND' }[doc.kind]}-${String(f.sequences[sequenceKey]).padStart(6, '0')}`;
        }
        doc.status = 'EN_VALIDACION_SIMULADA'; doc.attempt = uuid(); doc.validation = null;
        audit(f, doc, 'VALIDACION_SIMULADA_INICIADA', state);
        return doc;
      });
      if (['VALIDADA_INTERNA', 'ANULADA'].includes(staged.status)) return staged;
      let validation;
      try {
        validation = await Promise.race([this.provider.validate(clone(staged)), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Tiempo de espera agotado; reintente la validación.')), 15000); timer.unref?.(); })]);
        if (validation?.source !== 'INTERNAL_SIMULATION' || typeof validation.accepted !== 'boolean' || !Array.isArray(validation.errors)) throw new Error('Respuesta de proveedor no compatible con simulación.');
      } catch (error) {
        validation = { accepted: false, source: 'INTERNAL_SIMULATION', errors: [text(error.message, 500)], retryable: true };
      }
      return this.transaction(`${key}:result:${staged.attempt}`, { action: 'result', id, attempt: staged.attempt }, (state, f) => {
        const doc = find(state, id);
        if (doc.status !== 'EN_VALIDACION_SIMULADA' || doc.attempt !== staged.attempt) return doc;
        doc.validation = validation;
        if (validation.accepted) {
          // Domain errors become a persisted internal rejection; posting never partially mutates state.
          const candidate = clone(state);
          try {
            this.post(candidate, find(candidate, id));
            Object.assign(state, candidate);
          } catch (error) { doc.validation = { accepted: false, source: 'INTERNAL_SIMULATION', errors: [text(error.message, 500)] }; }
        }
        const saved = find(state, id);
        saved.status = saved.validation.accepted ? 'VALIDADA_INTERNA' : 'RECHAZADA_INTERNA';
        saved.updatedAt = new Date().toISOString();
        audit(state.facturacion, saved, saved.status, state, saved.validation.errors.join('; '));
        return saved;
      });
    }
    post(state, doc) {
      if (state.ventas.some(v => v.invoiceDocumentId === doc.id)) return;
      if (doc.kind !== 'INVOICE') { this.postAdjustment(state, doc); return; }
      const stock = new Map();
      for (const line of doc.totals.lines) stock.set(line.productId, (stock.get(line.productId) || 0n) + M.units(line.quantity, 4));
      for (const [id, qty] of stock) {
        const product = state.productos.find(p => p.id === id && p.negocioId === doc.businessId);
        if (!product || M.units(product.stock, 4) < qty) throw new Error('Stock insuficiente o producto eliminado; no se registró la venta.');
        const before = M.units(product.stock, 4); product.stock = Number(M.decimal(before - qty, 4));
        state.movimientosInventario.push({ id: `inv-${doc.id}-${id}`, negocioId: doc.businessId, invoiceDocumentId: doc.id, productoId: id, productoNombre: product.nombre, tipo: 'SALIDA', cantidad: Number(M.decimal(qty, 4)), stockAnterior: Number(M.decimal(before, 4)), stockPosterior: product.stock, motivo: doc.number, fecha: doc.date });
      }
      const c = doc.customer;
      let client = state.clientes.find(v => v.negocioId === doc.businessId && String(v.cedula).replace(/[.\s-]/g, '').toUpperCase() === c.document.replace(/-/g, '').toUpperCase() && (v.tipoDocumento || 'CC') === c.documentType);
      if (!client) { client = { id: uuid(), negocioId: doc.businessId, nombre: c.name, cedula: c.document, tipoDocumento: c.documentType, email: c.email, direccion: c.address, telefono: c.phone, saldoPendiente: 0 }; state.clientes.push(client); }
      const balance = doc.paymentTerms === 'CREDITO' ? amount(doc.totals.total) : 0n;
      client.saldoPendiente = legacy(amount(client.saldoPendiente) + balance);
      const sale = { id: `sale-${doc.id}`, invoiceDocumentId: doc.id, numeroFactura: doc.number, tipoDocumento: 'FACTURA_SIMULADA', negocioId: doc.businessId, clienteId: client.id, clienteNombre: c.name, clienteCedula: c.document, clienteEmail: c.email, clienteDireccion: c.address, clienteTelefono: c.phone, fecha: doc.date, tipoPago: doc.paymentTerms, metodoPago: doc.paymentMethod, subtotal: Number(doc.totals.base), total: Number(doc.totals.total), impuestos: Number(doc.totals.tax), saldoPendiente: legacy(balance), invoicePaid: M.decimal(amount(doc.totals.total) - balance), costoTotalVenta: Number(doc.totals.cost), estado: balance ? 'PENDIENTE' : 'PAGADA', notas: doc.notes, detalles: doc.totals.lines.map(l => ({ productoId: l.productId, productoNombre: l.description, cantidad: Number(l.quantity), precioUnitario: Number(l.unitPrice), costoUnitario: Number(l.unitCost), subtotal: Number(l.base) })) };
      state.ventas.unshift(sale);
      if (!balance) state.pagosVenta.push({ id: `pay-${doc.id}`, negocioId: doc.businessId, ventaId: sale.id, invoiceDocumentId: doc.id, clienteId: client.id, clienteNombre: c.name, monto: sale.total, fecha: doc.date, metodoPago: doc.paymentMethod, notas: 'Pago inicial de simulación' });
    }
    postAdjustment(state, doc) {
      const original = find(state, doc.originalId);
      if (original.status !== 'VALIDADA_INTERNA') throw new Error('La factura original ya no está activa.');
      const prior = state.facturacion.documents.filter(d => d.originalId === original.id && d.status === 'VALIDADA_INTERNA');
      if (doc.cancellation && prior.length) throw new Error('La factura tiene ajustes previos; concilie mediante notas parciales.');
      const sale = state.ventas.find(v => v.invoiceDocumentId === original.id);
      if (!sale) throw new Error('Venta original no encontrada.');
      const sign = doc.kind === 'CREDIT_NOTE' ? -1n : 1n;
      const total = amount(sale.total) + sign * amount(doc.totals.total);
      const base = amount(sale.subtotal) + sign * amount(doc.totals.base);
      const tax = amount(sale.impuestos) + sign * amount(doc.totals.tax);
      if (total < 0n || base < 0n || tax < 0n || total > 100000000000000n) throw new Error('El ajuste excede el saldo ajustable de total, base o impuestos.');
      const client = state.clientes.find(c => c.id === sale.clienteId && c.negocioId === doc.businessId);
      if (!client) throw new Error('Cliente original no encontrado.');
      const paid = amount(sale.invoicePaid), remainingPaid = paid > total ? total : paid;
      const refund = paid - remainingPaid, balance = total - remainingPaid;
      client.saldoPendiente = legacy(amount(client.saldoPendiente) - amount(sale.saldoPendiente) + balance);
      if (refund) state.facturacion.refunds.push({ id: `refund-${doc.id}`, documentId: doc.id, businessId: doc.businessId, saleId: sale.id, amount: M.decimal(refund), date: doc.date, method: doc.paymentMethod, reason: doc.reason });
      Object.assign(sale, { total: legacy(total), subtotal: legacy(base), impuestos: legacy(tax), saldoPendiente: legacy(balance), invoicePaid: M.decimal(remainingPaid), tipoPago: balance ? 'CREDITO' : sale.tipoPago, estado: balance ? 'PENDIENTE' : 'PAGADA' });
      if (doc.cancellation) {
        for (const line of original.totals.lines) {
          const product = state.productos.find(p => p.id === line.productId && p.negocioId === doc.businessId);
          if (!product) throw new Error('No se puede devolver inventario: producto eliminado.');
          const before = M.units(product.stock, 4), qty = M.units(line.quantity, 4);
          product.stock = Number(M.decimal(before + qty, 4));
          state.movimientosInventario.push({ id: `return-${doc.id}-${state.movimientosInventario.length}`, negocioId: doc.businessId, invoiceDocumentId: doc.id, productoId: product.id, productoNombre: product.nombre, tipo: 'ENTRADA', cantidad: Number(line.quantity), stockAnterior: Number(M.decimal(before, 4)), stockPosterior: product.stock, motivo: `Anulación simulada ${original.number}`, fecha: doc.date });
        }
        sale.detalles = []; sale.costoTotalVenta = 0; sale.estado = 'ANULADA';
        original.status = 'ANULADA'; original.cancelledBy = doc.id;
        audit(state.facturacion, original, 'ANULADA_POR_NOTA_CREDITO', state, doc.number);
      }
      // Partial notes adjust value/tax only. Stock returns require the explicit full cancellation flow.
      sale.adjustmentDocumentIds ||= []; sale.adjustmentDocumentIds.push(doc.id);
    }
    async pay(id, value, method, key) {
      return this.transaction(key, { action: 'payment', id, value, method }, (state, f) => {
        const doc = find(state, id);
        if (doc.kind !== 'INVOICE' || doc.status !== 'VALIDADA_INTERNA') throw new Error('Solo puede cobrar facturas validadas internamente.');
        if (!['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].includes(method)) throw new Error('Medio de pago inválido.');
        const sale = state.ventas.find(v => v.invoiceDocumentId === id);
        const v = amount(value); if (!v || v > amount(sale.saldoPendiente)) throw new Error('El pago debe ser positivo y no superar el saldo.');
        const client = state.clientes.find(c => c.id === sale.clienteId && c.negocioId === doc.businessId);
        if (!client) throw new Error('Cliente no encontrado.');
        sale.saldoPendiente = legacy(amount(sale.saldoPendiente) - v); sale.invoicePaid = M.decimal(amount(sale.invoicePaid) + v); sale.estado = sale.saldoPendiente ? 'PENDIENTE' : 'PAGADA';
        client.saldoPendiente = legacy(amount(client.saldoPendiente) - v);
        const payment = { id: uuid(), negocioId: doc.businessId, ventaId: sale.id, invoiceDocumentId: id, clienteId: sale.clienteId, clienteNombre: doc.customer.name, monto: legacy(v), fecha: today(), metodoPago: method, notas: 'Cobro de factura simulada' };
        state.pagosVenta.push(payment); audit(f, doc, 'PAGO_REGISTRADO', state, M.decimal(v)); return payment;
      });
    }
  }
  window.InvoiceService = InvoiceService;
  window.InvoiceUtils = { uuid, today };
})();
