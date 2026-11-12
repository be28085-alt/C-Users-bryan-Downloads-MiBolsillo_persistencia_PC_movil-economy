(function () {
  'use strict';
  // Pure business mutators: change only the candidate passed by BusinessRepository.
  // No DOM access, notifications, persistence calls or network operations belong here.
  const M = window.InvoiceMoney;
  const clone = v => JSON.parse(JSON.stringify(v));
  const uuid = () => { if (!window.crypto?.randomUUID) throw new Error('Use localhost o HTTPS.'); return window.crypto.randomUUID(); };
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const text = (v, required = false, max = 200) => { const s = String(v ?? '').trim(); if ((required && !s) || s.length > max) throw new Error(`Texto obligatorio o demasiado largo (máximo ${max}).`); return s; };
  const date = v => { const s = String(v || today()); if (!window.FinanzasDates.esFechaISOValida(s)) throw new Error('Fecha inválida.'); return s; };
  const units = (v, scale = 2) => M.units(v ?? '0', scale);
  const decimal = M.decimal;
  const number = (v, scale = 2) => Number(decimal(v, scale));
  const quantity = (v, positive = false) => { const q = units(v, 4); if ((positive && !q) || q > 10000000000000n) throw new Error('Cantidad inválida: use hasta cuatro decimales y máximo mil millones de unidades.'); return q; };
  const money = (v, positive = false) => { const n = units(v); if ((positive && !n) || n > 100000000000000n) throw new Error('Importe fuera del límite permitido.'); return n; };
  const normalizeDoc = v => String(v || '').replace(/[.\s-]/g, '').toUpperCase();
  function business(state, write = true, allowEmpty = false) {
    if (state.moduloActivo !== 'EMPRESARIAL') throw new Error('Esta operación pertenece exclusivamente a Mi Negocio.');
    const b = state.negocios.find(b => b.id === state.negocioActivoId);
    const role = state.usuario?.facturacionRol || 'PROPIETARIO_LOCAL';
    if (!['PROPIETARIO_LOCAL', 'FACTURADOR', 'LECTOR'].includes(role)) throw new Error('Rol empresarial inválido.');
    if (write && role === 'LECTOR') throw new Error('Permiso de solo lectura.');
    if (!b && allowEmpty && state.negocios.length === 0 && role === 'PROPIETARIO_LOCAL' && !state.usuario?.facturacionNegocios) return { id: null };
    if (!b) throw new Error('Seleccione un negocio.');
    if (state.usuario?.facturacionNegocios && !state.usuario.facturacionNegocios.includes(b.id)) throw new Error('Sin permiso para este negocio.');
    return b;
  }
  function find(state, collection, id, allowArchived = false) {
    const r = state[collection].find(r => r.id === id && (collection === 'negocios' ? r.id === state.negocioActivoId : r.negocioId === state.negocioActivoId));
    if (!r || (!allowArchived && r.estado === 'ARCHIVADO')) throw new Error(`Registro no disponible en ${collection} del negocio activo.`);
    return r;
  }
  function revision(r, data) { if (data.revision !== undefined && data.revision !== (r.revision || 0)) throw new Error('El registro cambió en otra pestaña. Vuelva a abrirlo.'); }
  function result(collection, record, message = '') { return { collection, record, message }; }
  function record(state, data = {}) { return { id: uuid(), negocioId: state.negocioActivoId, businessVersion: 1, revision: 1, createdAt: new Date().toISOString(), ...data }; }
  function stock(state, p, delta, type, reason, referenceId, fecha = today()) {
    const before = quantity(p.stock), next = before + delta;
    if (next < 0n) throw new Error(`Stock insuficiente para ${p.nombre}.`);
    quantity(decimal(next, 4)); p.stock = number(next, 4); p.revision = (p.revision || 0) + 1;
    state.movimientosInventario.push(record(state, { productoId: p.id, productoNombre: p.nombre, tipo: type, cantidad: number(delta < 0n ? -delta : delta, 4), stockAnterior: number(before, 4), stockPosterior: p.stock, motivo: reason, referenciaId: referenceId, fecha }));
  }
  function recalcBalances(state) {
    for (const c of state.clientes.filter(c => c.negocioId === state.negocioActivoId)) c.saldoPendiente = number(state.ventas.filter(v => v.negocioId === c.negocioId && v.clienteId === c.id && v.estado !== 'ANULADA').reduce((s, v) => s + money(v.saldoPendiente), 0n));
    for (const p of state.proveedores.filter(p => p.negocioId === state.negocioActivoId)) p.saldoPendiente = number([...state.compras, ...state.gastosNegocio].filter(v => v.negocioId === p.negocioId && v.proveedorId === p.id && v.estado !== 'ANULADA').reduce((s, v) => s + money(v.saldoPendiente), 0n));
  }
  function contact(state, data, collection) {
    const existing = data.id ? find(state, collection, data.id, true) : null;
    if (existing) revision(existing, data);
    const nombre = text(data.nombre, true), cedula = text(data.cedula || data.documento), email = text(data.email), tipoDocumento = text(data.tipoDocumento || 'CC');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Correo inválido.');
    if (collection === 'clientes' && !/^[a-zA-Z0-9-]{3,20}$/.test(cedula)) throw new Error('Identificación del cliente inválida.');
    if (state[collection].some(c => c.negocioId === state.negocioActivoId && c.id !== existing?.id && ((cedula && normalizeDoc(c.cedula || c.documento) === normalizeDoc(cedula)) || (!cedula && c.nombre.toLowerCase() === nombre.toLowerCase())))) throw new Error('Ya existe este contacto en el negocio.');
    const values = { nombre, cedula, documento: cedula, tipoDocumento, email, telefono: text(data.telefono), direccion: text(data.direccion), estado: ['ACTIVO', 'ARCHIVADO'].includes(data.estado) ? data.estado : existing?.estado || 'ACTIVO' };
    if (existing) { Object.assign(existing, values, { revision: (existing.revision || 0) + 1 }); return result(collection, existing); }
    const c = record(state, { ...values, saldoPendiente: 0 }); state[collection].push(c); return result(collection, c);
  }
  function product(state, data) {
    const old = data.id ? find(state, 'productos', data.id, true) : null;
    if (old) revision(old, data);
    const nombre = text(data.nombre, true), sku = text(data.sku), proveedorId = data.proveedorId || null;
    if (proveedorId) find(state, 'proveedores', proveedorId);
    if (sku && state.productos.some(p => p.negocioId === state.negocioActivoId && p.id !== old?.id && p.sku?.toLowerCase() === sku.toLowerCase())) throw new Error('El código SKU ya existe.');
    if (old && data.stock !== undefined && quantity(data.stock) !== quantity(old.stock)) throw new Error('Use Movimiento de inventario para cambiar existencias.');
    const values = { nombre, sku, proveedorId, descripcion: text(data.descripcion), tipo: data.tipo === 'MATERIA_PRIMA' ? 'MATERIA_PRIMA' : 'PRODUCTO', unidadMedida: text(data.unidadMedida || 'UND', true), precioVenta: number(units(data.precioVenta, 4), 4), costoUnitario: number(units(data.costoUnitario ?? data.precioCompra, 4), 4), stockMinimo: number(quantity(data.stockMinimo), 4), estado: data.estado === 'ARCHIVADO' ? 'ARCHIVADO' : 'DISPONIBLE' };
    if (old) { Object.assign(old, values, { revision: (old.revision || 0) + 1 }); return result('productos', old); }
    const p = record(state, { ...values, precioCompra: values.costoUnitario, stock: 0 }); state.productos.push(p);
    if (quantity(data.stock)) stock(state, p, quantity(data.stock), 'ENTRADA', 'Existencia inicial', p.id);
    return result('productos', p);
  }
  function archive(state, data) {
    const allowed = ['productos', 'clientes', 'proveedores', 'empleados', 'formulas'];
    if (!allowed.includes(data.collection)) throw new Error('No se puede eliminar esta colección.');
    const r = find(state, data.collection, data.id, true); revision(r, data);
    const related = data.collection === 'productos' ? state.movimientosInventario.some(m => m.productoId === r.id) || [...state.ventas, ...state.compras].some(d => d.detalles?.some(l => l.productoId === r.id)) || state.formulas.some(f => f.productoId === r.id || f.ingredientes?.some(i => i.materiaPrimaId === r.id))
      : data.collection === 'clientes' ? state.ventas.some(v => v.clienteId === r.id)
      : data.collection === 'proveedores' ? [...state.compras, ...state.gastosNegocio].some(v => v.proveedorId === r.id) || state.productos.some(p => p.proveedorId === r.id)
      : data.collection === 'empleados' ? state.pagosEmpleado.some(p => p.empleadoId === r.id) : state.producciones.some(p => p.formulaId === r.id);
    // Archive catalog records with history; never break foreign keys or snapshots.
    if (related) { r.estado = 'ARCHIVADO'; r.revision = (r.revision || 0) + 1; return result(data.collection, r, 'Archivado. Se conserva su historial y relaciones.'); }
    state[data.collection] = state[data.collection].filter(x => x.id !== r.id); return result(data.collection, { id: r.id, deleted: true }, 'Registro eliminado.');
  }
  function calculateLines(state, data, purchase = false) {
    return M.calculate((data.detalles || []).map(l => {
      const p = find(state, 'productos', l.productoId);
      return { productId: p.id, description: p.nombre, sku: p.sku || '', unit: p.unidadMedida, quantity: l.cantidad, unitPrice: l.precioUnitario === undefined ? p.precioVenta : l.precioUnitario, unitCost: purchase ? '0' : String(p.costoUnitario || 0), discountPercent: l.descuentoPorcentaje || '0', taxKind: l.tipoImpuesto || 'IVA', taxRate: l.tarifaImpuesto || '0' };
    }));
  }
  function payment(state, collection, parent, value, method, notes = '', fecha = today()) {
    const amount = money(value, true), balance = money(parent.saldoPendiente);
    if (amount > balance) throw new Error('El pago no puede superar el saldo pendiente.');
    if (date(fecha) < parent.fecha) throw new Error('La fecha del pago no puede ser anterior al documento.');
    parent.saldoPendiente = number(balance - amount); parent.montoPagado = number(money(parent.montoPagado ?? (number(money(parent.total ?? parent.monto) - balance))) + amount);
    if (collection === 'pagosVenta') parent.estado = parent.saldoPendiente ? 'PENDIENTE' : 'PAGADA';
    const link = collection === 'pagosVenta' ? { ventaId: parent.id, clienteId: parent.clienteId, clienteNombre: parent.clienteNombre } : collection === 'pagosCompra' ? { compraId: parent.id, proveedorId: parent.proveedorId, proveedorNombre: parent.proveedorNombre } : { gastoId: parent.id, proveedorId: parent.proveedorId };
    const p = record(state, { ...link, monto: number(amount), fecha: date(fecha), metodoPago: text(method || 'Efectivo', true), notas: text(notes) }); state[collection].push(p); recalcBalances(state); return result(collection, p);
  }
  function purchase(state, data) {
    const provider = find(state, 'proveedores', data.proveedorId), totals = calculateLines(state, data, true), total = money(totals.total);
    const paid = money(data.montoPagado ?? totals.total); if (paid > total) throw new Error('El pago supera el total de compra.');
    const fecha = date(data.fecha), due = date(data.fechaVencimiento || fecha); if (due < fecha) throw new Error('El vencimiento es anterior a la compra.');
    const p = record(state, { proveedorId: provider.id, proveedorNombre: provider.nombre, proveedorSnapshot: clone(provider), fecha, fechaVencimiento: due, total: number(total), subtotal: Number(totals.base), impuestos: Number(totals.tax), montoPagado: 0, saldoPendiente: number(total), estado: 'CONFIRMADA', observaciones: text(data.observaciones), detalles: totals.lines.map(l => ({ productoId: l.productId, productoNombre: l.description, cantidad: Number(l.quantity), precioUnitario: Number(l.unitPrice), subtotal: Number(l.base), impuesto: Number(l.tax) })), calculo: totals });
    state.compras.unshift(p);
    p.inventorySnapshot = [...new Set(totals.lines.map(l => l.productId))].map(id => { const item = find(state, 'productos', id); return { productId: id, beforeStock: item.stock, beforeCost: item.costoUnitario || 0 }; });
    for (const l of totals.lines) {
      const item = find(state, 'productos', l.productId), q = quantity(l.quantity), old = quantity(item.stock), oldCost = units(item.costoUnitario, 4);
      item.costoUnitario = number(M.round(old * oldCost + money(l.base) * 1000000n, old + q), 4); item.precioCompra = Number(l.unitPrice);
      stock(state, item, q, 'ENTRADA', `Compra ${p.id}`, p.id, fecha);
    }
    for (const snapshot of p.inventorySnapshot) { const item = find(state, 'productos', snapshot.productId); snapshot.afterStock = item.stock; snapshot.afterCost = item.costoUnitario; }
    if (paid) payment(state, 'pagosCompra', p, decimal(paid), data.metodoPago, 'Pago inicial', fecha);
    recalcBalances(state); return result('compras', p);
  }
  function sale(state, data) {
    let client = data.clienteId ? find(state, 'clientes', data.clienteId) : state.clientes.find(c => c.negocioId === state.negocioActivoId && normalizeDoc(c.cedula) === normalizeDoc(data.clienteCedula));
    if (!client) client = contact(state, { nombre: data.clienteNombre, cedula: data.clienteCedula, email: data.clienteEmail, direccion: data.clienteDireccion, telefono: data.clienteTelefono }, 'clientes').record;
    if (client.estado === 'ARCHIVADO') throw new Error('El cliente está archivado. Reactívelo antes de vender.');
    const totals = calculateLines(state, data), required = new Map();
    for (const l of totals.lines) required.set(l.productId, (required.get(l.productId) || 0n) + quantity(l.quantity, true));
    for (const [id, q] of required) if (quantity(find(state, 'productos', id).stock) < q) throw new Error('Stock insuficiente para confirmar la venta.');
    const fecha = date(data.fecha), due = date(data.fechaVencimiento || fecha), total = money(totals.total), paid = money(data.montoPagado ?? (data.tipoPago === 'CREDITO' ? '0' : totals.total));
    if (paid > total || due < fecha) throw new Error('Pago o vencimiento inválidos.');
    const f = state.businessLedger, sequenceKey = `${state.negocioActivoId}:COMPROBANTE`;
    if ((f.sequences[sequenceKey] || 0) >= 999999999) throw new Error('Consecutivo interno agotado.');
    f.sequences[sequenceKey] = (f.sequences[sequenceKey] || 0) + 1;
    const v = record(state, { numeroFactura: `COMP-${String(f.sequences[sequenceKey]).padStart(6, '0')}`, tipoDocumento: 'COMPROBANTE_INTERNO', clienteId: client.id, clienteNombre: client.nombre, clienteCedula: client.cedula, clienteSnapshot: clone(client), fecha, fechaVencimiento: due, tipoPago: paid < total ? 'CREDITO' : 'CONTADO', metodoPago: text(data.metodoPago || 'Efectivo'), total: Number(totals.total), subtotal: Number(totals.base), impuestos: Number(totals.tax), costoTotalVenta: Number(totals.cost), saldoPendiente: Number(totals.total), montoPagado: 0, estado: 'PENDIENTE', notas: text(data.notas), calculo: totals, detalles: totals.lines.map(l => ({ productoId: l.productId, productoNombre: l.description, cantidad: Number(l.quantity), precioUnitario: Number(l.unitPrice), costoUnitario: Number(l.unitCost), subtotal: Number(l.base) })) });
    state.ventas.unshift(v);
    for (const [id, q] of required) stock(state, find(state, 'productos', id), -q, 'SALIDA', `Venta ${v.numeroFactura}`, v.id, fecha);
    if (paid) payment(state, 'pagosVenta', v, decimal(paid), data.metodoPago, 'Pago inicial', fecha);
    recalcBalances(state); return result('ventas', v);
  }
  function movement(state, data, collection) {
    const old = data.id ? find(state, collection, data.id) : null; if (old) revision(old, data);
    if (old?.estado === 'ANULADA') throw new Error('No puede editar un movimiento anulado.');
    const amount = money(data.monto, true), provider = data.proveedorId ? find(state, 'proveedores', data.proveedorId) : null;
    const values = { monto: number(amount), fecha: date(data.fecha), categoria: text(data.categoria || 'Otros'), descripcion: text(data.descripcion, true), proveedorId: provider?.id || null, proveedorNombre: provider?.nombre || '', metodoPago: text(data.metodoPago || 'Efectivo'), estado: 'CONFIRMADA' };
    if (old) {
      if (collection === 'gastosNegocio') { const paid = money(old.montoPagado ?? old.monto); if (amount < paid) throw new Error('El nuevo gasto no puede ser inferior a lo pagado. Anule el gasto para corregirlo.'); values.saldoPendiente = number(amount - paid); }
      Object.assign(old, values, { revision: (old.revision || 0) + 1 }); recalcBalances(state); return result(collection, old);
    }
    const r = record(state, values); state[collection].unshift(r);
    if (collection === 'gastosNegocio') {
      const paid = money(data.montoPagado ?? values.monto); if (paid > amount || (paid < amount && !provider)) throw new Error('Un gasto a crédito requiere proveedor y un pago válido.');
      r.fechaVencimiento = date(data.fechaVencimiento || r.fecha); if (r.fechaVencimiento < r.fecha) throw new Error('Vencimiento inválido.'); r.montoPagado = 0; r.saldoPendiente = number(amount);
      if (paid) payment(state, 'pagosGasto', r, decimal(paid), values.metodoPago, 'Pago inicial', r.fecha);
    }
    recalcBalances(state); return result(collection, r);
  }
  function cancel(state, data) {
    const collection = data.collection; if (!['ventas', 'compras', 'gastosNegocio', 'ingresosNegocio', 'pagosEmpleado'].includes(collection)) throw new Error('Anulación no permitida.');
    const r = find(state, collection, data.id); if (r.estado === 'ANULADA') return result(collection, r, 'El registro ya está anulado.');
    if (r.invoiceDocumentId) throw new Error('Use una nota crédito en Facturación simulada para corregir esta venta.');
    const reason = text(data.motivo, true), fecha = date(data.fecha);
    if (['ventas', 'compras'].includes(collection)) {
      const amounts = new Map(); for (const l of r.detalles) amounts.set(l.productoId, (amounts.get(l.productoId) || 0n) + quantity(l.cantidad));
      for (const [id, q] of amounts) {
        const item = find(state, 'productos', id, true);
        if (collection === 'ventas') {
          const current = quantity(item.stock), returnedValue = r.detalles.filter(l => l.productoId === id).reduce((sum, l) => sum + quantity(l.cantidad) * units(l.costoUnitario || 0, 4), 0n);
          item.costoUnitario = number(M.round(current * units(item.costoUnitario, 4) + returnedValue, current + q), 4);
        }
        if (collection === 'compras') {
          const current = quantity(item.stock), snapshot = r.inventorySnapshot?.find(s => s.productId === id);
          if (current < q) throw new Error('No hay inventario suficiente para devolver esta compra.');
          if (snapshot && current === quantity(snapshot.afterStock) && units(item.costoUnitario, 4) === units(snapshot.afterCost, 4)) item.costoUnitario = snapshot.beforeCost;
          else {
            const removedValue = r.detalles.filter(l => l.productoId === id).reduce((sum, l) => sum + money(l.subtotal), 0n) * 1000000n;
            const remainingValue = current * units(item.costoUnitario, 4) - removedValue;
            if (remainingValue < 0n) throw new Error('Los costos cambiaron; concilie el costo de inventario antes de anular la compra.');
            item.costoUnitario = current === q ? 0 : number(M.round(remainingValue, current - q), 4);
          }
        }
        stock(state, item, collection === 'ventas' ? q : -q, collection === 'ventas' ? 'ENTRADA' : 'SALIDA', `Anulación: ${reason}`, r.id, fecha);
      }
    }
    const paid = collection === 'ingresosNegocio' ? money(r.monto) : collection === 'pagosEmpleado' ? money(r.monto) : money(r.montoPagado ?? number(money(r.total ?? r.monto) - money(r.saldoPendiente)));
    if (paid) state.devolucionesNegocio.push(record(state, { origenId: r.id, origenTipo: collection, tipo: ['ventas', 'ingresosNegocio'].includes(collection) ? 'SALIDA' : 'ENTRADA', monto: number(paid), fecha, motivo: reason }));
    r.estado = 'ANULADA'; r.anulacion = { motivo: reason, fecha }; r.montoPagado = number(paid); if (r.saldoPendiente !== undefined) r.saldoPendiente = 0;
    recalcBalances(state); return result(collection, r, 'Anulado con movimiento de reversión e historial conservado.');
  }
  function employee(state, data) {
    const old = data.id ? find(state, 'empleados', data.id, true) : null; if (old) revision(old, data);
    const values = { nombre: text(data.nombre, true), cedula: text(data.cedula), cargo: text(data.cargo || 'Colaborador'), telefono: text(data.telefono), salario: number(money(data.salario)), fechaIngreso: date(data.fechaIngreso), estado: ['ACTIVO', 'INACTIVO', 'ARCHIVADO'].includes(data.estado) ? data.estado : 'ACTIVO' };
    if (values.cedula && state.empleados.some(e => e.negocioId === state.negocioActivoId && e.id !== old?.id && normalizeDoc(e.cedula) === normalizeDoc(values.cedula))) throw new Error('Empleado ya registrado.');
    if (old) { Object.assign(old, values, { revision: (old.revision || 0) + 1 }); return result('empleados', old); }
    const e = record(state, values); state.empleados.push(e); return result('empleados', e);
  }
  function formula(state, data) {
    const old = data.id ? find(state, 'formulas', data.id, true) : null; if (old) revision(old, data);
    const target = find(state, 'productos', data.productoId), cantidadBase = number(quantity(data.cantidadBase, true), 4);
    if (!Array.isArray(data.ingredientes) || !data.ingredientes.length) throw new Error('Incluya ingredientes.');
    const ingredients = data.ingredientes.map(i => { const p = find(state, 'productos', i.materiaPrimaId); if (p.id === target.id) throw new Error('Un producto no puede ser su propio insumo.'); return { materiaPrimaId: p.id, materiaPrimaNombre: p.nombre, cantidadRequerida: number(quantity(i.cantidadRequerida, true), 4), unidadMedida: p.unidadMedida }; });
    const values = { nombre: text(data.nombre, true), productoId: target.id, productoNombre: target.nombre, cantidadBase, ingredientes: ingredients, descripcion: text(data.descripcion), estado: 'ACTIVO' };
    if (old) { Object.assign(old, values, { revision: (old.revision || 0) + 1 }); return result('formulas', old); }
    const f = record(state, values); state.formulas.push(f); return result('formulas', f);
  }
  function production(state, data) {
    const f = find(state, 'formulas', data.formulaId), q = quantity(data.cantidad, true), base = quantity(f.cantidadBase, true), required = new Map();
    for (const i of f.ingredientes) required.set(i.materiaPrimaId, (required.get(i.materiaPrimaId) || 0n) + M.round(quantity(i.cantidadRequerida, true) * q, base));
    if ([...required.values()].some(q => !q)) throw new Error('La cantidad de producción es demasiado pequeña para la precisión de los insumos.');
    const target = find(state, 'productos', f.productoId); let total = 0n;
    for (const [id, qty] of required) { const p = find(state, 'productos', id); if (quantity(p.stock) < qty) throw new Error(`Insumo insuficiente: ${p.nombre}.`); total += M.round(qty * units(p.costoUnitario, 4), 1000000n); }
    const p = record(state, { formulaId: f.id, formulaNombre: f.nombre, productoId: target.id, productoNombre: target.nombre, cantidadProducida: number(q, 4), costoTotal: number(total), costoUnitario: number(M.round(total * 1000000n, q), 4), fecha: date(data.fecha), estado: 'COMPLETADA', notas: text(data.notas), formulaSnapshot: clone(f) });
    state.producciones.unshift(p);
    for (const [id, qty] of required) stock(state, find(state, 'productos', id), -qty, 'SALIDA', `Consumo ${f.nombre}`, p.id, p.fecha);
    const old = quantity(target.stock); target.costoUnitario = number(M.round(old * units(target.costoUnitario, 4) + total * 1000000n, old + q), 4);
    stock(state, target, q, 'PRODUCCION', f.nombre, p.id, p.fecha); return result('producciones', p);
  }
  const commands = {
    saveReportPreferences(s, d) { const b = business(s, false); b.reportPreferences = window.BusinessReportPreferences.validate(d); b.revision = (b.revision || 0) + 1; return result('negocios', b, 'Vista guardada y verificada para este negocio.'); },
    saveProduct: product, saveCustomer: (s, d) => contact(s, d, 'clientes'), saveSupplier: (s, d) => contact(s, d, 'proveedores'), archive,
    sale, purchase, saveExpense: (s, d) => movement(s, d, 'gastosNegocio'), saveIncome: (s, d) => movement(s, d, 'ingresosNegocio'), cancel, saveEmployee: employee, saveFormula: formula, production,
    adjustStock(s, d) { const p = find(s, 'productos', d.productoId), target = quantity(d.nuevoStock); stock(s, p, target - quantity(p.stock), 'AJUSTE', text(d.motivo, true), uuid(), date(d.fecha)); return result('productos', p); },
    inventoryMovement(s, d) { const p = find(s, 'productos', d.productoId); if (!['ENTRADA', 'SALIDA', 'AJUSTE'].includes(d.tipo)) throw new Error('Movimiento inválido.'); const q = quantity(d.cantidad, d.tipo !== 'AJUSTE'), delta = d.tipo === 'AJUSTE' ? q - quantity(p.stock) : d.tipo === 'SALIDA' ? -q : q; stock(s, p, delta, d.tipo, text(d.motivo, true), uuid(), date(d.fecha)); return result('productos', p); },
    paySale(s, d) { const v = find(s, 'ventas', d.ventaId); if (v.invoiceDocumentId) throw new Error('Registre este cobro en Facturación simulada.'); if (v.estado === 'ANULADA' || (d.clienteId && v.clienteId !== d.clienteId)) throw new Error('Venta o cliente inválidos.'); return payment(s, 'pagosVenta', v, d.monto, d.metodoPago, d.notas, d.fecha); },
    payPurchase(s, d) { const p = find(s, d.collection === 'gastosNegocio' ? 'gastosNegocio' : 'compras', d.id); if (p.estado === 'ANULADA') throw new Error('Obligación anulada.'); return payment(s, d.collection === 'gastosNegocio' ? 'pagosGasto' : 'pagosCompra', p, d.monto, d.metodoPago, d.notas, d.fecha); },
    payroll(s, d) { const e = find(s, 'empleados', d.empleadoId); if (e.estado !== 'ACTIVO') throw new Error('El empleado no está activo.'); const p = record(s, { empleadoId: e.id, empleadoNombre: e.nombre, empleadoSnapshot: clone(e), monto: number(money(d.monto, true)), concepto: text(d.concepto, true), periodo: text(d.periodo, true), metodoPago: text(d.metodoPago || 'Transferencia'), fecha: date(d.fecha), estado: 'CONFIRMADA' }); s.pagosEmpleado.push(p); return result('pagosEmpleado', p); },
    saveBusiness(s, d) { const old = d.id ? find(s, 'negocios', d.id) : null; if (old) revision(old, d); const v = { nombre: text(d.nombre, true), tipo: text(d.tipo), descripcion: text(d.descripcion), nit: text(d.nit), email: text(d.email), direccion: text(d.direccion), telefono: text(d.telefono), moneda: 'COP' }; if (old) { Object.assign(old, v, { revision: (old.revision || 0) + 1 }); return result('negocios', old); } const b = { id: uuid(), ...v, revision: 1 }; s.negocios.push(b); s.negocioActivoId = b.id; return result('negocios', b); },
    selectBusiness(s, d) { const b = s.negocios.find(n => n.id === d.id); if (!b || (s.usuario?.facturacionNegocios && !s.usuario.facturacionNegocios.includes(b.id))) throw new Error('Negocio no disponible.'); s.negocioActivoId = b.id; return result('negocios', b); },
    deleteBusiness(s, d) { const b = find(s, 'negocios', d.id); if (s.negocios.length <= 1 || window.BusinessSchema.collections.some(k => k !== 'negocios' && s[k].some(r => r.negocioId === b.id)) || s.facturacion?.documents.some(doc => doc.businessId === b.id)) throw new Error('Conserve el negocio: es el único o tiene historial.'); s.negocios = s.negocios.filter(n => n.id !== b.id); s.negocioActivoId = s.negocios[0].id; return result('negocios', { id: b.id, deleted: true }); }
  };
  window.BusinessCommands = { commands, business, clone, uuid };
  window.BusinessUtils = { today, uuid, money, quantity, decimal };
})();
