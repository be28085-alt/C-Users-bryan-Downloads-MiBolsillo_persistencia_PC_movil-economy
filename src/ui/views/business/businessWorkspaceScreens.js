/**
 * Plantillas compartidas de las secciones empresariales. Reciben modelos confirmados; los
 * encabezados retirados no se recrean y las acciones permanecen dentro del contenido.
 */
(function () {
  'use strict';
  const sections = {
    dashboard: 'Inicio',
    inventory: 'Inventario',
    sales: 'Ventas',
    reports: 'Informes',
    products: 'Productos / utilidad',
    cash: 'Caja / flujo de efectivo',
    expenses: 'Gastos del negocio',
  };
  const titles = {
    ...sections,
    dashboard: 'Inicio',
    products: 'Productos y utilidad',
    management: 'Gestión',
    movements: 'Otros movimientos',
  };
  const paths = {
    dashboard: 'M3 10 12 3l9 7v10H3ZM9 20v-7h6v7',
    inventory: 'm3 7 9-4 9 4v11l-9 4-9-4ZM3 7l9 4 9-4M12 11v11',
    purchases: 'M3 3h2l3 12h11l2-9H6M9 20h.01M18 20h.01',
    contacts: 'M4 21V7l8-4 8 4v14M2 21h20M8 10h1m6 0h1m-8 4h1m6 0h1m-7 7v-4h6v4',
    sales: 'M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h3',
    reports: 'M4 3h16v18H4ZM8 16v-3m4 3V8m4 8v-5',
    products: 'M4 20h16M6 16v-4m6 4V8m6 8V4',
    cash: 'M3 6h18v14H3ZM3 10h18M15 15h3M6 3v3',
    expenses: 'M4 7h16v14H4ZM8 7V3h8v4M8 12h8M8 16h5',
  };
  function icon(key) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[key] || paths.products}"/></svg>`;
  }
  function create(api) {
    const {
      E,
      money,
      button,
      action,
      col,
      status,
      list,
      tableHtml,
      catalogActions,
      commercialActions,
    } = api;
    const link = (label, section, tab = '') =>
      button(label, 'navigate', `data-section="${section}" data-tab="${tab}"`);
    const kpis = (cards) =>
      `<div class="bm-kpis">${cards.map(([label, value, desc, key = 'products'], i) => `<article ${i === 0 ? 'class="bm-hero"' : ''}><div class="bm-kpi-label"><span>${label}</span>${icon(key)}</div><strong data-kpi="${E(label)}">${E(value)}</strong><small>${E(desc)}</small></article>`).join('')}</div>`;
    const card = (title, subtitle, content, extra = '') =>
      `<section class="bm-card ${extra}"><div class="bm-card-heading"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div></div>${content}</section>`;
    const note = (text, warning = false, extra = '') =>
      `<div class="bm-context-note ${warning ? 'bm-warning' : ''}"><span>${icon(warning ? 'inventory' : 'sales')}${text}</span>${extra}</div>`;
    const period = (root) =>
      `<div class="bm-period"><label>Período<select data-bm-period>${[
        ['MES_ACTUAL', 'Mes actual'],
        ['MES_ANTERIOR', 'Mes anterior'],
        ['ANIO_ACTUAL', 'Año actual'],
        ['TODOS', 'Histórico'],
      ]
        .map(
          ([v, label]) =>
            `<option value="${v}" ${(root.dataset.period || 'MES_ACTUAL') === v ? 'selected' : ''}>${label}</option>`,
        )
        .join('')}</select></label></div>`;
    const ledger = (title, description, root, rows, columns, actions = '') =>
      card(
        `${title} <span class="bm-count">${rows.length}</span>`,
        description,
        list(root, rows, columns, actions),
        'bm-ledger',
      );
    // Conserva la navegación móvil sin repetir títulos, rutas ni controles de negocio.
    function header(root) {
      const section = root.dataset.businessSection;
      return `<nav class="bm-mobile-sections" aria-label="Secciones de Mi Negocio">${Object.entries(
        sections,
      )
        .map(
          ([key, label]) =>
            `<button type="button" data-bm="navigate" data-section="${key}" aria-current="${key === section ? 'page' : 'false'}">${icon(key)}${label}</button>`,
        )
        .join('')}</nav>`;
    }
    function chart(model, cash = false) {
      const rows = cash
        ? window.BusinessWorkspaceMetrics.build(model).monthlyCash
        : model.report.monthly;
      const bars = window.BusinessReportsView.bars({
        monthly: rows.map((r) => ({ ...r, income: cash ? r.income : r.sales })),
      })
        .replaceAll(
          'Ingresos frente a costos y gastos',
          cash ? 'Entradas frente a salidas' : 'Ventas netas frente a costos y gastos',
        )
        .replaceAll('ingresos ', cash ? 'entradas ' : 'ventas netas ')
        .replaceAll('costos y gastos ', cash ? 'salidas ' : 'costos y gastos ');
      return `<div class="bm-chart-key"><span><i></i>${cash ? 'Entradas' : 'Ventas netas'}</span><span><i></i>${cash ? 'Salidas' : 'Costos y gastos'}</span></div>${bars}<p class="bm-chart-caption">Últimos seis meses</p><details class="bm-chart-data"><summary>Ver datos mensuales</summary>${tableHtml(rows, [col('Mes', (r) => r.label), col(cash ? 'Entradas' : 'Ventas netas', (r) => money(cash ? r.income : r.sales)), col(cash ? 'Salidas' : 'Costos y gastos', (r) => money(r.expenses))])}</details>`;
    }
    function dashboard(root, m) {
      const t = m.report.totals;
      const shortcuts = [
        ['inventory', 'Ver inventario'],
        ['sales', 'Consultar ventas'],
        ['reports', 'Compras y proveedores', 'purchases'],
        ['products', 'Revisar utilidad'],
        ['cash', 'Ver flujo de efectivo'],
        ['expenses', 'Controlar gastos'],
      ];
      const alerts = m.lowStock
        .slice(0, 4)
        .map(
          (p) =>
            `<div class="bm-alert-row"><span class="bm-alert-icon">${icon('inventory')}</span><span>${E(p.nombre)}<small>${E(window.BusinessProductUnits.formatQuantity(p.stock, p.unidadMedida))} disponibles · mínimo ${E(p.stockMinimo || 0)}</small></span>${action('Revisar', 'detail', 'productos', p.id)}</div>`,
        )
        .join('');
      return (
        period(root) +
        kpis([
          [
            'Ventas netas',
            money(t.sales),
            `${t.salesCount} ventas en ${m.report.range.label}`,
            'sales',
          ],
          ['Utilidad neta', money(t.netProfit), `Margen neto: ${t.margin}%`, 'products'],
          ['Cuentas por cobrar', money(m.receivableTotal), 'Saldo actual de tus clientes', 'cash'],
          ['Cuentas por pagar', money(m.payableTotal), 'Compras y gastos pendientes', 'purchases'],
        ]) +
        `<div class="bm-grid">${card('Ventas y costos del negocio', 'Una mirada a la evolución de tus resultados.', chart(m), 'bm-chart-card')}${card('Pendientes y recordatorios', 'Lo que requiere tu atención.', alerts || '<div class="bm-empty-state">Tu inventario está al día.<small>No hay productos por debajo del mínimo.</small></div>')}${card(
          'Últimas ventas',
          'Los movimientos más recientes de tu negocio.',
          tableHtml(
            m.sales
              .slice()
              .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
              .slice(0, 5),
            [
              col('Referencia', (r) => r.numeroFactura || r.id),
              col('Cliente', (r) => r.clienteNombre),
              col('Fecha', (r) => r.fecha),
              col('Total', (r) => money(r.total)),
              col('Estado', status, true),
            ],
          ) +
            `<div class="bm-card-footer">${button('+ Registrar venta', 'form', 'data-kind="sale"', true)}${link('Ver todas las ventas →', 'sales')}</div>`,
        )}${card('Accesos rápidos', 'Tu operación, a un clic.', `<div class="bm-shortcuts">${shortcuts.map(([key, label, tab = '']) => `<button type="button" data-bm="navigate" data-section="${key}" data-tab="${tab}">${icon(key)}<span>${label}</span><span aria-hidden="true">›</span></button>`).join('')}</div>`)}</div>`
      );
    }
    function inventory(root, m) {
      const x = window.BusinessWorkspaceMetrics.build(m);
      const quantities = new Map();
      for (const product of m.products) {
        const unit = window.BusinessProductUnits.normalize(product.unidadMedida);
        quantities.set(
          unit,
          (quantities.get(unit) || 0n) + window.InvoiceMoney.units(product.stock ?? 0, 4),
        );
      }
      const stockSummary =
        [...quantities]
          .map(([unit, quantity]) =>
            window.BusinessProductUnits.formatQuantity(
              window.InvoiceMoney.decimal(quantity, 4),
              unit,
            ),
          )
          .join(' · ') || '0 und';
      return (
        kpis([
          [
            'Valor del inventario',
            money(x.inventoryCost),
            'Existencias actuales al costo',
            'inventory',
          ],
          ['Productos activos', m.products.length, 'Referencias en tu catálogo', 'products'],
          ['Existencias por unidad', stockSummary, 'Cantidades agrupadas por medida', 'inventory'],
          [
            'Inventario bajo',
            `${m.lowStock.length} productos`,
            'En el mínimo o por debajo',
            'inventory',
          ],
        ]) +
        (m.lowStock.length
          ? note(
              `<strong>${m.lowStock.length} productos necesitan reposición.</strong> Revisa sus existencias para planear tu próxima compra.`,
              true,
              button('Ver alertas →', 'alerts'),
            )
          : '') +
        ledger(
          'Existencias',
          'Registra productos, proveedores y compras desde aquí. Consulta el historial en Informes.',
          root,
          window.Finanzas.state.productos.filter((p) => p.negocioId === m.report.business.id),
          [
            col('Producto', (r) => r.nombre),
            col('SKU / tipo', (r) => `${r.sku || '—'} · ${r.tipo || 'PRODUCTO'}`),
            col('Existencias', (r) =>
              window.BusinessProductUnits.formatQuantity(r.stock, r.unidadMedida),
            ),
            col('Costo unitario', (r) => money(r.costoUnitario)),
            col('Precio de venta', (r) => money(r.precioVenta)),
            col(
              'Estado',
              (r) =>
                `<span class="bm-badge ${r.estado === 'ARCHIVADO' ? 'bm-muted-badge' : Number(r.stock) <= Number(r.stockMinimo || 0) ? 'bm-warning-badge' : ''}">${r.estado === 'ARCHIVADO' ? 'Archivado' : Number(r.stock) <= Number(r.stockMinimo || 0) ? 'Inventario bajo' : 'Disponible'}</span>`,
              true,
            ),
            col('Acciones', (r) => catalogActions(r, 'productos', 'product', true), true),
          ],
          button('+ Producto', 'form', 'data-kind="purchase"', true) +
            link('Compras y proveedores →', 'reports', 'purchases'),
        )
      );
    }
    function purchases(root, m) {
      const t = m.report.operations.purchaseTotals;
      return (
        period(root) +
        kpis([
          ['Compras del período', money(t.total), `${t.count} compras registradas`, 'purchases'],
          ['Pagado en compras', money(t.paid), 'Abonos a las compras del período', 'cash'],
          [
            'Pendiente del período',
            money(t.balance),
            'Saldo de las compras seleccionadas',
            'purchases',
          ],
          [
            'Proveedores activos',
            m.suppliers.filter((r) => r.estado !== 'ARCHIVADO').length,
            'Contactos de tu negocio',
            'contacts',
          ],
        ]) +
        note('Cada compra confirmada actualiza tus existencias y el saldo del proveedor.') +
        ledger(
          'Registro de compras',
          'Detalle de tus compras en el período seleccionado.',
          root,
          m.purchases.filter(
            (r) =>
              (!m.report.range.from || r.fecha >= m.report.range.from) &&
              (!m.report.range.to || r.fecha <= m.report.range.to),
          ),
          [
            col(
              'Referencia',
              (r) =>
                r.numeroCompra ||
                (r.id?.length > 20 ? `CMP-${r.id.slice(0, 8).toUpperCase()}` : r.id),
            ),
            col('Proveedor', (r) => r.proveedorNombre),
            col('Fecha', (r) => r.fecha),
            col('Total', (r) => money(r.total)),
            col('Pagado', (r) => money(r.montoPagado)),
            col('Pendiente', (r) => money(r.saldoPendiente)),
            col('Estado', status, true),
            col('Acciones', (r) => commercialActions(r, 'compras'), true),
          ],
          button('+ Compra', 'form', 'data-kind="purchase"', true),
        )
      );
    }
    function sales(root, m) {
      const t = m.report.totals,
        x = window.BusinessWorkspaceMetrics.build(m);
      return (
        period(root) +
        kpis([
          ['Ventas netas', money(t.sales), `${t.salesCount} ventas confirmadas`, 'sales'],
          ['Total facturado', money(t.billedTotal), 'Ventas del período con impuestos', 'sales'],
          ['Por cobrar', money(m.receivableTotal), 'Saldo actual de todos los períodos', 'cash'],
          ['Utilidad bruta', money(t.grossProfit), 'Ventas netas menos costo vendido', 'products'],
        ]) +
        note(
          'Las ventas confirmadas conservan su detalle. Registra sus cobros para actualizar tu cartera.',
          false,
          '<button type="button" data-invoice-open>Facturación simulada →</button>',
        ) +
        ledger(
          'Registro de ventas',
          'Consulta las ventas del período y registra sus pagos.',
          root,
          [
            ...x.periodSales,
            ...m.sales.filter(
              (r) =>
                r.estado === 'ANULADA' &&
                (!m.report.range.from || r.fecha >= m.report.range.from) &&
                (!m.report.range.to || r.fecha <= m.report.range.to),
            ),
          ],
          [
            col('Número', (r) => r.numeroFactura || r.id),
            col('Cliente', (r) => r.clienteNombre),
            col('Fecha', (r) => r.fecha),
            col('Total', (r) => money(r.total)),
            col('Por cobrar', (r) => money(r.saldoPendiente)),
            col('Estado', status, true),
            col('Acciones', (r) => commercialActions(r, 'ventas'), true),
          ],
          button('+ Confirmar venta', 'form', 'data-kind="sale"', true),
        )
      );
    }
    function contacts(root, m) {
      const x = window.BusinessWorkspaceMetrics.build(m),
        customer = root.dataset.tab === 'customers';
      const collection = customer ? 'clientes' : 'proveedores',
        kind = customer ? 'customer' : 'supplier';
      const nav = `<nav class="bm-tabs" aria-label="Directorio de contactos">${[
        ['suppliers', 'Proveedores'],
        ['customers', 'Clientes'],
      ]
        .map(([key, label]) =>
          button(
            label,
            'tab',
            `data-tab="${key}" aria-pressed="${customer === (key === 'customers')}"`,
          ),
        )
        .join('')}</nav>`;
      return (
        period(root) +
        kpis([
          ['Cuentas por pagar', money(m.payableTotal), 'Compras y gastos pendientes', 'purchases'],
          [
            'Proveedores activos',
            m.suppliers.filter((r) => r.estado !== 'ARCHIVADO').length,
            'Aliados de tu negocio',
            'contacts',
          ],
          [
            'Compras del período',
            money(m.report.operations.purchaseTotals.total),
            m.report.range.label,
            'purchases',
          ],
          [
            'Cuentas vencidas',
            money(m.report.operations.overduePayables),
            'Saldo pendiente fuera de plazo',
            'cash',
          ],
        ]) +
        nav +
        ledger(
          customer ? 'Directorio de clientes' : 'Directorio de proveedores',
          'Información de contacto y estado de tus cuentas.',
          root,
          customer ? m.customers : x.suppliers,
          [
            col('Nombre', (r) => r.nombre),
            col('Identificación', (r) => r.cedula || r.documento || '—'),
            col('Contacto', (r) => `${r.telefono || ''} ${r.email || ''}`),
            ...(!customer
              ? [
                  col('Compras del período', (r) => money(r.purchaseTotal)),
                  col('Última compra', (r) => r.lastPurchase || 'Sin compras'),
                ]
              : []),
            col(customer ? 'Por cobrar' : 'Por pagar', (r) =>
              money(customer ? r.saldoPendiente : r.pendingTotal),
            ),
            col('Estado', status, true),
            col('Acciones', (r) => catalogActions(r, collection, kind), true),
          ],
          button(customer ? '+ Cliente' : '+ Proveedor', 'form', `data-kind="${kind}"`, true),
        ) +
        (!customer
          ? card(
              'Mantén tus cuentas al día',
              'Consulta los vencimientos y el detalle de cada obligación.',
              `<div class="bm-actions">${link('Ver cuentas por pagar →', 'management', 'payables')}${link('Registrar una compra →', 'purchases')}</div>`,
            )
          : '')
      );
    }
    function products(root, m) {
      const x = window.BusinessWorkspaceMetrics.build(m),
        t = m.report.totals;
      const margin =
        Number(t.sales) > 0 ? ((Number(t.grossProfit) * 100) / Number(t.sales)).toFixed(1) : '0.0';
      return (
        period(root) +
        kpis([
          [
            'Utilidad bruta',
            money(t.grossProfit),
            'Ventas netas menos costo de ventas',
            'products',
          ],
          ['Costo de ventas', money(t.cogs), 'Costo histórico de lo vendido', 'purchases'],
          ['Margen bruto', `${margin} %`, 'Utilidad bruta / ventas netas', 'products'],
          [
            'Valor potencial de venta',
            money(x.inventorySaleValue),
            'Existencias al precio de venta actual',
            'inventory',
          ],
        ]) +
        note(
          'La utilidad por unidad usa tus precios actuales. La utilidad bruta del período conserva el costo histórico de las ventas.',
        ) +
        ledger(
          'Rentabilidad por producto',
          'Compara costos, precios y márgenes de tu catálogo actual.',
          root,
          x.products,
          [
            col('Producto', (r) => r.nombre),
            col('SKU', (r) => r.sku || '—'),
            col('Costo unitario', (r) => money(r.costoUnitario)),
            col('Precio de venta', (r) => money(r.precioVenta)),
            col('Utilidad por unidad', (r) => money(r.unitProfit)),
            col('Margen', (r) => `${r.margin} %`),
            col('Existencias', (r) =>
              window.BusinessProductUnits.formatQuantity(r.stock, r.unidadMedida),
            ),
            col('Acciones', (r) => catalogActions(r, 'productos', 'product'), true),
          ],
          button('+ Nuevo producto', 'form', 'data-kind="product"', true),
        )
      );
    }
    function cash(root, m) {
      const x = window.BusinessWorkspaceMetrics.build(m),
        t = m.report.cash;
      const methods = m.cash.cuentas
        .map(
          (c) =>
            `<div class="bm-account-row">${icon('cash')}<span>${E(c.nombre)}<small>Flujo neto acumulado</small></span><strong>${E(money(c.saldo))}</strong></div>`,
        )
        .join('');
      return (
        period(root) +
        kpis([
          ['Flujo neto del período', money(t.net), 'Entradas menos salidas registradas', 'cash'],
          ['Entradas del período', money(t.incoming), 'Cobros de ventas y otros ingresos', 'sales'],
          ['Salidas del período', money(t.outgoing), 'Pagos de compras y operación', 'expenses'],
          ['Por cobrar', money(m.receivableTotal), 'Saldo actual de tus clientes', 'contacts'],
        ]) +
        `<div class="bm-grid">${card('Entradas y salidas', 'El movimiento real del dinero de tu negocio.', chart(m, true), 'bm-chart-card')}${card('Movimiento por medio de pago', 'Flujo acumulado de todos los períodos.', methods || '<p>Aún no hay cobros ni pagos registrados.</p>')}</div>` +
        ledger(
          'Movimientos de caja',
          'Cobros y pagos del período seleccionado.',
          root,
          x.periodCash,
          [
            col('Fecha', (r) => r.fecha),
            col('Concepto', (r) => r.concepto),
            col('Medio de pago', (r) => r.cuenta),
            col(
              'Tipo',
              (r) =>
                `<span class="bm-badge ${r.tipo === 'SALIDA' ? 'bm-warning-badge' : ''}">${r.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'}</span>`,
              true,
            ),
            col('Monto', (r) => money(r.monto)),
          ],
          button('+ Ingreso', 'form', 'data-kind="income"', true) +
            button('+ Gasto', 'form', 'data-kind="expense"'),
        ) +
        note(
          'El flujo registrado no incluye un saldo inicial bancario. Consulta tus cuentas para conocer el dinero disponible.',
        )
      );
    }
    function expenses(root, m) {
      const x = window.BusinessWorkspaceMetrics.build(m),
        t = m.report.totals;
      const within = (r) =>
        (!m.report.range.from || r.fecha >= m.report.range.from) &&
        (!m.report.range.to || r.fecha <= m.report.range.to);
      const tab = ['all', 'expenses', 'incomes'].includes(root.dataset.tab)
        ? root.dataset.tab
        : 'all';
      root.dataset.tab = tab;
      const rows = [
        ...m.expenses.map((r) => ({
          ...r,
          collection: 'gastosNegocio',
          kind: 'expense',
          movementType: 'Gasto',
        })),
        ...m.incomes.map((r) => ({
          ...r,
          collection: 'ingresosNegocio',
          kind: 'income',
          movementType: 'Ingreso',
        })),
      ]
        .filter(
          (r) =>
            within(r) && (tab === 'all' || r.kind === (tab === 'expenses' ? 'expense' : 'income')),
        )
        .sort(
          (a, b) =>
            String(b.fecha).localeCompare(String(a.fecha)) ||
            String(b.id).localeCompare(String(a.id)),
        );
      const nav = `<nav class="bm-tabs" aria-label="Gastos e ingresos">${[
        ['all', 'Todos'],
        ['expenses', 'Gastos'],
        ['incomes', 'Ingresos'],
      ]
        .map(([key, label]) =>
          button(label, 'tab', `data-tab="${key}" aria-pressed="${key === tab}"`),
        )
        .join('')}</nav>`;
      const records = ledger(
        'Gastos e ingresos del negocio',
        'Registra y consulta gastos e ingresos adicionales a las ventas en un mismo lugar.',
        root,
        rows,
        [
          col(
            'Tipo',
            (r) =>
              `<span class="bm-badge ${r.kind === 'expense' ? 'bm-warning-badge' : ''}">${r.movementType}</span>`,
            true,
          ),
          col('Descripción', (r) => r.descripcion),
          col('Categoría', (r) => r.categoria),
          col('Fecha', (r) => r.fecha),
          col('Medio de pago', (r) => r.metodoPago || '—'),
          col('Monto', (r) => money(r.monto)),
          col('Estado', status, true),
          col(
            'Acciones',
            (r) =>
              `<div class="bm-row-actions">${action('Consultar', 'detail', r.collection, r.id)}${r.estado !== 'ANULADA' ? action('Editar', 'form', r.collection, r.id, r.kind) + action('Anular', 'cancel', r.collection, r.id) : ''}</div>`,
            true,
          ),
        ],
        button('+ Gasto', 'form', 'data-kind="expense"', true) +
          button('+ Ingreso', 'form', 'data-kind="income"', true),
      );
      const colors = ['#24576b', '#4c8498', '#82acbc', '#aecbd6', '#d5e4ea'].map(
        (fallback, i) => `var(--app-chart-${i + 1}, ${fallback})`,
      );
      const categories =
        x.expenseCategories.length > 5
          ? [
              ...x.expenseCategories.slice(0, 4),
              {
                name: 'Otros gastos',
                amount: window.BusinessReportsDomain.decimal(
                  x.expenseCategories
                    .slice(4)
                    .reduce((n, c) => n + window.BusinessReportsDomain.cents(c.amount), 0n),
                ),
              },
            ]
          : x.expenseCategories;
      let start = 0;
      const stops = categories.map((c, i) => {
        const end = start + (Number(c.amount) * 100) / Number(t.businessExpenses);
        const value = `${colors[i]} ${start}% ${end}%`;
        start = end;
        return value;
      });
      const distribution = `<div class="bm-distribution"><div class="bm-donut" role="img" aria-label="Gastos por categoría; valores en el desglose adjunto" style="background:conic-gradient(${stops.join(',') || '#e7eef2 0% 100%'})"><div><small>Total de gastos</small><strong>${E(money(t.businessExpenses))}</strong></div></div><div class="bm-category-list">${categories.map((c, i) => `<div><span><i style="background:${colors[i]}"></i>${E(c.name)}</span><strong>${E(money(c.amount))}</strong><progress value="${E(c.amount)}" max="${E(t.businessExpenses)}" aria-label="${E(c.name)}"></progress></div>`).join('') || '<p>Registra tu primer gasto para ver el desglose.</p>'}</div></div>`;
      return (
        period(root) +
        kpis([
          [
            'Gastos del período',
            money(t.businessExpenses),
            `${x.periodExpenses.length} gastos registrados`,
            'expenses',
          ],
          [
            'Otros ingresos del período',
            money(t.otherIncome),
            'Ingresos adicionales a las ventas',
            'cash',
          ],
          [
            'Ingresos adicionales menos gastos',
            money(
              window.BusinessReportsDomain.decimal(
                window.BusinessReportsDomain.cents(t.otherIncome) -
                  window.BusinessReportsDomain.cents(t.businessExpenses),
              ),
            ),
            'Balance de estos registros del período',
            'products',
          ],
          [
            'Gastos por pagar',
            money(x.expensePending),
            'Saldo actual de todos los períodos',
            'cash',
          ],
        ]) +
        `<div class="bm-grid">${card('Gastos por categoría', 'Así se distribuyen los gastos de tu negocio.', distribution)}${card('Tu operación en números', 'Resultados del período seleccionado.', `<div class="bm-financial-lines"><div><span>Ventas netas</span><strong>${E(money(t.sales))}</strong></div><div><span>Otros ingresos</span><strong>${E(money(t.otherIncome))}</strong></div><div><span>Costo de ventas</span><strong>${E(money(t.cogs))}</strong></div><div><span>Pagos al personal</span><strong>${E(money(t.employeePayments))}</strong></div><div class="bm-financial-total"><span>Utilidad neta</span><strong>${E(money(t.netProfit))}</strong></div></div>`)}</div>` +
        nav +
        records
      );
    }
    return { header, dashboard, inventory, purchases, sales, contacts, products, cash, expenses };
  }
  window.BusinessWorkspaceScreens = { create, icon, sections, titles };
})();
