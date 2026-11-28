/**
 * Presentación operativa del informe. Filtra y consulta contactos y documentos sin trasladar registros entre negocios ni duplicar una escritura.
 */
(function () {
  'use strict';
  const E = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const money = (value) => window.BusinessReportsView.money(value);
  function status(value) {
    return `<span class="br-status ${['Vencida', 'Inventario bajo'].includes(value) ? 'br-status-warning' : ['Pagada', 'Disponible', 'ACTIVO'].includes(value) ? 'br-status-good' : ''}">${E(value)}</span>`;
  }
  function actions(row, printing, payable = false, voucher = false) {
    if (printing || !row.id) return '';
    const button = (label, action) =>
      `<button type="button" data-report-record="${action}" data-id="${E(row.id)}" data-collection="${E(row.collection)}">${label}</button>`;
    return `<div class="br-record-actions">${button('Consultar', 'detail')}${payable && row.balance !== '0.00' ? button('Registrar pago', 'payment') : ''}${row.collection === 'compras' ? button('Anular', 'cancel') : ''}${voucher ? button('Comprobante', 'print') : ''}</div>`;
  }
  // The same rows feed on-screen tables, mobile cards, print and the CSV export.
  function table(type, title, note, rows, columns, printing, controls = '') {
    return `<section class="br-card br-ledger" data-report-detail="${type}"><div class="br-ledger-heading"><div><h2>${title} <span class="br-record-count">${rows.length}</span></h2><p>${note}</p></div></div>${controls}<div class="br-table-wrap"><table><thead><tr>${columns.map((c) => `<th scope="col">${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${['suppliers', 'customers'].includes(type) ? ` data-report-contact-id="${E(r.id)}"` : ''}>${columns.map(([label, field, format]) => `<td data-label="${E(label)}" class="${format === 'money' ? 'br-money-cell' : ''}">${format === 'money' ? E(money(r[field])) : typeof format === 'function' ? format(r, printing) : E(r[field] ?? '—')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${columns.length}">No hay registros para esta sección.</td></tr>`}</tbody></table></div></section>`;
  }
  function directory(type, model, printing) {
    const supplier = type === 'suppliers',
      name = supplier ? 'proveedores' : 'clientes',
      filters = model.contactFilters?.[type] || {};
    const query = String(filters.query || '').toLocaleLowerCase('es'),
      filter = filters.status || 'ALL';
    const rows = model.operations[type].filter(
      (r) =>
        printing ||
        ((!query ||
          [r.name, r.identification, r.contact]
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(query)) &&
          (filter === 'ALL' ||
            (filter === 'ACTIVE' ? r.status !== 'ARCHIVADO' : r.status === 'ARCHIVADO'))),
    );
    const controls = printing
      ? ''
      : `<div class="br-contact-controls"><label>Buscar ${name}<input type="search" data-report-contact-search="${type}" value="${E(filters.query || '')}" placeholder="Nombre, identificación o contacto"></label><label>Mostrar<select data-report-contact-filter="${type}"><option value="ALL" ${filter === 'ALL' ? 'selected' : ''}>Todos</option><option value="ACTIVE" ${filter === 'ACTIVE' ? 'selected' : ''}>Activos</option><option value="ARCHIVED" ${filter === 'ARCHIVED' ? 'selected' : ''}>Archivados</option></select></label>${supplier ? '<button type="button" data-bm="navigate" data-section="inventory">Registrar en inventario</button>' : '<button type="button" data-bm="form" data-kind="customer">+ Cliente</button>'}</div>`;
    const columns = [
      ['Nombre', 'name'],
      ['Identificación', 'identification'],
      ['Contacto', 'contact'],
      ...(supplier
        ? [
            ['Compras del período', 'purchaseTotal', 'money'],
            ['Última compra del período', 'lastPurchase'],
          ]
        : []),
      [supplier ? 'Por pagar actual' : 'Por cobrar actual', 'balance', 'money'],
      ['Estado', 'status', (r) => status(r.status)],
    ];
    if (!printing) {
      columns.push([
        'Acciones',
        '',
        (r) => {
          if (!r.id) return '';
          const button = (label, command) =>
            `<button type="button" data-bm="${command}" data-collection="${E(r.collection)}" data-id="${E(r.id)}" data-kind="${supplier ? 'supplier' : 'customer'}">${label}</button>`;
          return `<div class="br-record-actions br-contact-actions">${button('Consultar', 'detail')}${button('Editar', 'form')}${r.status !== 'ARCHIVADO' ? button('Eliminar / archivar', 'archive') : ''}</div>`;
        },
      ]);
    }
    return table(
      type,
      `Directorio de ${name}`,
      supplier
        ? 'Registra productos y proveedores desde Inventario. Aquí puedes consultar sus datos y compras, editar sus contactos y revisar saldos actuales de compras y gastos de todos los períodos.'
        : 'Consulta y administra tus clientes. Sus datos y saldos por cobrar son actuales, independientemente del período de ventas seleccionado.',
      rows,
      columns,
      printing,
      controls,
    );
  }
  function cards(entries) {
    return `<div class="br-summary-grid br-financial-summary">${entries.map(([label, value]) => `<article><span>${label}</span><strong>${E(value)}</strong></article>`).join('')}</div>`;
  }
  function markup(model, printing = false) {
    const o = model.operations,
      t = o.purchaseTotals;
    const accountColumns = [
      ['Referencia', 'reference'],
      ['Contacto', 'name'],
      ['Vencimiento', 'due'],
      ['Situación', 'status', (r) => status(r.status)],
      ['Pendiente', 'balance', 'money'],
    ];
    const recordColumns = (columns, payable = false, voucher = false) =>
      printing
        ? columns
        : [...columns, ['Acciones', '', (r, p) => actions(r, p, payable, voucher)]];
    return {
      customers: directory('customers', model, printing),
      purchases: `${cards([
        ['Compras del período', money(t.total)],
        ['Pagado a la fecha · esas compras', money(t.paid)],
        ['Pendiente actual · esas compras', money(t.balance)],
      ])}${directory('suppliers', model, printing)}<p class="br-context-note">${t.count} compras activas del período · ${o.cancelledPurchases} anuladas excluidas. El pago y el saldo son actuales; la fecha de cada desembolso se consulta en Cobros y pagos. Comprar inventario no reduce por segunda vez la ganancia.</p>${table(
        'purchases',
        'Compras y proveedores',
        'Consulta los documentos originales y su estado de pago. La referencia abreviada identifica el registro interno; el identificador completo se conserva en la consulta.',
        o.purchases,
        recordColumns(
          [
            ['Referencia', 'reference'],
            ['Proveedor', 'name'],
            ['Fecha', 'date'],
            ['Total', 'total', 'money'],
            ['Pagado', 'paid', 'money'],
            ['Pendiente', 'balance', 'money'],
            ['Estado de pago', 'status', (r) => status(r.status)],
          ],
          true,
          true,
        ),
        printing,
      )}`,
      balances: `${cards([
        ['Cartera vencida documentada', money(o.overdueReceivables)],
        ['Obligaciones vencidas', money(o.overduePayables)],
        ['Cuentas por pagar actuales', money(model.payables)],
      ])}<p class="br-context-note">Saldos actuales de todos los períodos. Se muestran primero los documentos vencidos. Los documentos pagados o anulados se excluyen.</p>${table('receivables', 'Cuentas por cobrar', 'Ventas con saldo pendiente y su vencimiento.', o.receivables, recordColumns(accountColumns, true), printing)}${table('payables', 'Cuentas por pagar', 'Compras y gastos pendientes de pago.', o.payables, recordColumns(accountColumns, true), printing)}${model.receivables !== o.receivableTotal ? `<p class="br-context-note br-warning">El saldo de clientes (${E(money(model.receivables))}) difiere del detalle documentado (${E(money(o.receivableTotal))}). Revisa los saldos históricos antes de conciliarlos.</p>` : ''}`,
      operations: `${cards([
        ['Personal activo actual', o.activeEmployees],
        ['Lotes producidos en el período', o.productions.length],
        ['Costo de producción del período', money(o.productionCost)],
      ])}<p class="br-context-note">El personal y las existencias corresponden al estado actual. Los pagos y los lotes respetan el período del informe. Los costos de fabricación se incorporan al inventario, sin duplicarlos como gasto.</p>${table(
        'employees',
        'Personal y pagos del período',
        'Control administrativo de colaboradores; conserva empleados inactivos o archivados y su historial.',
        o.employees,
        recordColumns([
          ['Empleado', 'name'],
          ['Cargo', 'role'],
          ['Estado', 'status', (r) => status(r.status)],
          ['Pagos registrados', 'paymentsCount'],
          ['Pagado en el período', 'paid', 'money'],
        ]),
        printing,
      )}${table(
        'production',
        'Producción del período',
        'Lotes y costos históricos de fabricación.',
        o.productions,
        recordColumns([
          ['Fecha', 'date'],
          ['Referencia', 'reference'],
          ['Producto', 'name'],
          ['Receta', 'formula'],
          ['Cantidad', 'quantity'],
          ['Costo total', 'cost', 'money'],
        ]),
        printing,
      )}${table(
        'inventory',
        'Inventario actual al costo',
        'Existencias actuales; los productos archivados se conservan en su historial.',
        o.inventory,
        recordColumns([
          ['Producto', 'name'],
          ['SKU', 'sku'],
          ['Existencias', 'quantity'],
          ['Unidad', 'unit'],
          ['Valor al costo', 'cost', 'money'],
          ['Situación', 'status', (r) => status(r.status)],
        ]),
        printing,
      )}`,
      cash: table(
        'cash',
        'Cobros y pagos del período',
        'Libro de movimientos registrados: cobros de ventas, pagos a proveedores, gastos, personal y reversiones. No duplica los ingresos del estado de resultados.',
        o.cash,
        [
          ['Fecha', 'date'],
          ['Concepto', 'name'],
          ['Medio', 'method'],
          ['Movimiento', 'direction', (r) => status(r.direction)],
          ['Valor', 'amount', 'money'],
        ],
        printing,
      ),
    };
  }
  function csvRows(model) {
    const o = model.operations,
      t = o.purchaseTotals;
    return [
      [],
      ['Compras del período', 'Total COP', 'Pagado a la fecha COP', 'Pendiente actual COP'],
      [t.count, t.total, t.paid, t.balance],
      ['Referencia', 'Proveedor', 'Fecha', 'Total COP', 'Pagado COP', 'Pendiente COP', 'Estado'],
      ...o.purchases.map((r) => [
        r.reference,
        r.name,
        r.date,
        r.total,
        r.paid,
        r.balance,
        r.status,
      ]),
      [],
      ['Directorio de proveedores y saldos actuales'],
      [
        'Proveedor',
        'Identificación',
        'Contacto',
        'Compras del período COP',
        'Última compra del período',
        'Por pagar actual COP',
        'Estado',
      ],
      ...o.suppliers.map((r) => [
        r.name,
        r.identification,
        r.contact,
        r.purchaseTotal,
        r.lastPurchase,
        r.balance,
        r.status,
      ]),
      [],
      ['Directorio de clientes y saldos actuales'],
      ['Cliente', 'Identificación', 'Contacto', 'Por cobrar actual COP', 'Estado'],
      ...o.customers.map((r) => [r.name, r.identification, r.contact, r.balance, r.status]),
      [],
      ['Cuentas por cobrar actuales'],
      ['Referencia', 'Cliente', 'Vencimiento', 'Estado', 'Saldo COP'],
      ...o.receivables.map((r) => [r.reference, r.name, r.due, r.status, r.balance]),
      [],
      ['Cuentas por pagar actuales'],
      ['Referencia', 'Proveedor', 'Vencimiento', 'Estado', 'Saldo COP'],
      ...o.payables.map((r) => [r.reference, r.name, r.due, r.status, r.balance]),
      [],
      ['Personal actual y pagos del período'],
      ['Empleado', 'Cargo', 'Estado', 'Pagos', 'Pagado COP'],
      ...o.employees.map((r) => [r.name, r.role, r.status, r.paymentsCount, r.paid]),
      [],
      ['Producción del período'],
      ['Fecha', 'Referencia', 'Producto', 'Receta', 'Cantidad', 'Costo COP'],
      ...o.productions.map((r) => [r.date, r.reference, r.name, r.formula, r.quantity, r.cost]),
      [],
      ['Inventario actual'],
      ['Producto', 'SKU', 'Cantidad', 'Unidad', 'Valor al costo COP', 'Estado'],
      ...o.inventory.map((r) => [r.name, r.sku, r.quantity, r.unit, r.cost, r.status]),
      [],
      ['Cobros y pagos del período'],
      ['Fecha', 'Concepto', 'Medio', 'Movimiento', 'Valor COP'],
      ...o.cash.map((r) => [r.date, r.name, r.method, r.direction, r.amount]),
    ];
  }
  window.BusinessReportOperationsView = { markup, csvRows };
})();
