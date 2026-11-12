(function () {
  'use strict';
  // Read-only projections. No secondary collection of report data is persisted.
  function build(state, businessId, range, today) {
    const D = window.BusinessReportsDomain, valid = date => window.FinanzasDates.esFechaISOValida(date);
    const within = date => valid(date) && (!range.from || date >= range.from) && (!range.to || date <= range.to);
    const items = key => (state[key] || []).filter(r => r.negocioId === businessId);
    const active = r => r.estado !== 'ANULADA';
    const dateOrder = (a, b) => String(b.date).localeCompare(String(a.date)) || a.reference.localeCompare(b.reference);
    let invalidCount = 0;
    const map = (records, convert) => records.flatMap(r => { try { return [convert(r)]; } catch (e) { invalidCount++; return []; } });
    function reference(r, prefix) { return String(r.numeroCompra || r.numeroFactura || r.referencia || (r.id ? r.id.length > 20 ? `${prefix}-${r.id.slice(0, 8).toUpperCase()}` : r.id : 'Sin referencia')); }
    function document(r, collection) {
      const total = D.cents(r.total ?? r.monto), balance = r.saldoPendiente !== undefined ? D.cents(r.saldoPendiente) : r.montoPagado !== undefined ? total - D.cents(r.montoPagado) : 0n;
      const paid = r.montoPagado !== undefined ? D.cents(r.montoPagado) : total - balance;
      if (balance > total || paid < 0n || paid + balance !== total) throw new Error('Saldo inconsistente.');
      const due = r.fechaVencimiento || (r.invoiceDocumentId ? state.facturacion?.documents?.find(d => d.id === r.invoiceDocumentId && d.businessId === businessId)?.dueDate : '') || '';
      const overdue = balance > 0n && valid(due) && due < today;
      return { id: r.id || '', collection, reference: reference(r, collection === 'ventas' ? 'VTA' : collection === 'compras' ? 'CMP' : 'GTO'), name: r.clienteNombre || r.clienteSnapshot?.nombre || r.proveedorNombre || r.proveedorSnapshot?.nombre || (state[collection === 'ventas' ? 'clientes' : 'proveedores'] || []).find(c => c.negocioId === businessId && c.id === (r.clienteId || r.proveedorId))?.nombre || 'Sin contacto registrado', date: r.fecha, due: valid(due) ? due : '', total: D.decimal(total), paid: D.decimal(paid), balance: D.decimal(balance), overdue, status: balance === 0n ? 'Pagada' : overdue ? 'Vencida' : paid ? 'Pago parcial' : 'Pendiente' };
    }
    const purchases = map(items('compras').filter(active).filter(r => within(r.fecha)), r => document(r, 'compras')).sort(dateOrder);
    const receivables = map(items('ventas').filter(active).filter(r => Number(r.saldoPendiente) > 0), r => document(r, 'ventas')).sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.due || '9999').localeCompare(b.due || '9999'));
    const payables = ['compras', 'gastosNegocio'].flatMap(key => map(items(key).filter(active).filter(r => Number(r.saldoPendiente) > 0), r => document(r, key))).sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.due || '9999').localeCompare(b.due || '9999'));
    const sum = (rows, field) => D.decimal(rows.reduce((total, r) => total + D.cents(r[field]), 0n));
    const employeePayments = items('pagosEmpleado').filter(active).filter(r => within(r.fecha));
    const employees = map(items('empleados'), e => { const payments = employeePayments.filter(p => p.empleadoId === e.id); return { id: e.id, collection: 'empleados', name: e.nombre, role: e.cargo || 'Colaborador', status: e.estado || 'ACTIVO', paymentsCount: payments.length, paid: D.decimal(payments.reduce((s, p) => s + D.cents(p.monto), 0n)) }; });
    const productions = map(items('producciones').filter(active).filter(r => within(r.fecha)), r => ({ id: r.id, collection: 'producciones', date: r.fecha, reference: reference(r, 'PRD'), name: r.productoNombre || 'Producto histórico', formula: r.formulaNombre || r.formulaSnapshot?.nombre || 'Receta histórica', quantity: String(r.cantidadProducida ?? 0), cost: D.decimal(D.cents(r.costoTotal ?? 0)) })).sort(dateOrder);
    const inventory = map(items('productos').filter(r => r.estado !== 'ARCHIVADO'), r => ({ id: r.id, collection: 'productos', name: r.nombre, sku: r.sku || '—', quantity: String(r.stock ?? 0), unit: r.unidadMedida || 'UND', unitCost: String(r.costoUnitario ?? r.precioCompra ?? 0), cost: D.decimal(D.product(r.stock ?? 0, r.costoUnitario ?? r.precioCompra ?? 0)), status: Number(r.stock ?? 0) <= Number(r.stockMinimo ?? 0) ? 'Inventario bajo' : 'Disponible' }));
    const cash = (window.BusinessCashFlowDomain?.calcularCajaYFlujo(businessId, state).movimientosCaja || []).filter(r => within(r.fecha)).map(r => ({ date: r.fecha, name: r.concepto, method: r.cuenta, direction: r.tipo === 'ENTRADA' ? 'Entrada' : 'Salida', amount: D.decimal(D.cents(r.monto)) }));
    return { purchases, receivables, payables, employees, productions, inventory, cash, invalidCount,
      purchaseTotals: { count: purchases.length, total: sum(purchases, 'total'), paid: sum(purchases, 'paid'), balance: sum(purchases, 'balance') },
      receivableTotal: sum(receivables, 'balance'), payableTotal: sum(payables, 'balance'), overdueReceivables: sum(receivables.filter(r => r.overdue), 'balance'), overduePayables: sum(payables.filter(r => r.overdue), 'balance'),
      activeEmployees: employees.filter(r => r.status === 'ACTIVO').length, productionCost: sum(productions, 'cost'), cancelledPurchases: items('compras').filter(r => !active(r) && within(r.fecha)).length };
  }
  window.BusinessReportOperationsDomain = { build };
})();
