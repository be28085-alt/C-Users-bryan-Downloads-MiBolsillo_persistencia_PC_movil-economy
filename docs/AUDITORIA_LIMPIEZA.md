# Auditoría de limpieza y organización · 14-11-2026

Se revisaron las entradas HTML, sus dependencias JavaScript y CSS, las referencias entre módulos, las pruebas, los programas de consola, el prototipo Qt y la documentación. Esta revisión busca distinguir código activo e histórico y preservar acciones; no certifica la ausencia de todos los posibles errores funcionales.

## Cambios

- Las páginas actuales cargan 45 rutas JavaScript distintas en conjunto: 43 compartidas y un controlador propio por interfaz. Se conservan sus archivos y el orden de carga.
- Se archivaron 52 módulos JavaScript de `src/` que ninguna entrada carga. No se encontraron importaciones ni cargadores dinámicos que los incorporaran. Sus implementaciones completas se conservan en `legacy/modular/src/`.
- Los cuatro JavaScript anteriores de raíz se trasladaron a `legacy/web/`. La prueba de compatibilidad ahora abre `legacy/web/shared.js`.
- Los dos puentes CSS de raíz se trasladaron a `legacy/web/` y se corrigieron sus importaciones. PC carga directamente `styles/desktop.css`; móvil ya cargaba `styles/mobile.css`.
- `styles/base.css` y `styles/layout.css`, sin carga desde las interfaces, se conservan en `legacy/modular/styles/`.
- Los programas independientes `main.cpp` y `mibolsillo.cpp` se conservan en `legacy/console/`.
- Los tres informes de raíz y el README anterior se conservan en `docs/historial/`. El README actual y `docs/ESTRUCTURA.md` explican las rutas vigentes.
- La configuración CMake de VS Code usa ahora `${workspaceFolder}/qt_app` en lugar de una ruta absoluta obsoleta.

Antes y después de cada uno de los 62 traslados de código y estilos se comparó SHA-256. El contenido era idéntico; después solo se ajustaron las dos importaciones CSS archivadas. Los archivos de datos, el SQL, las reglas financieras, las funciones públicas y las acciones de las interfaces se conservaron.

## Código activo eliminado por no tener lectores

Solo se retiraron siete asignaciones de estado de los constructores. La búsqueda de referencias no encontró lectores ni enlaces desde HTML para ellas:

| Controlador | Propiedades retiradas |
|---|---|
| `src/utils/desktop.js` | `filtroTipoProductos`, `filtroTipoVentas`, `filtroTipoInventario`, `textoFiltroProductos`, `textoFiltroMaterias`, `textoFiltroVentas` |
| `src/utils/mobile.js` | `businessChart` |

Se conservaron los métodos públicos de los controladores, incluso los que no tienen llamadas directas en otros archivos: pueden representar acciones invocables. También se conservan las ramas de compatibilidad y el proveedor DIAN deshabilitado, cuya restricción está cubierta por pruebas.

En la interfaz se retiró el estilo `.bm-version-button`, sin elementos ni generadores en el código activo, y un cierre `</a>` huérfano en la cabecera empresarial móvil. Los enlaces reales para cambiar de plataforma siguen en los avisos superiores de ambas páginas. La prueba de navegador se actualizó para comprobar esos enlaces vigentes.

## Inventario de módulos archivados

Cada ruta de esta tabla se trasladó a la misma ruta bajo `legacy/modular/`. Por ejemplo, `src/app/router.js` pasó a `legacy/modular/src/app/router.js`.

| Ruta original |
|---|
| `src/app/bootstrap.js` |
| `src/app/router.js` |
| `src/core/actions.js` |
| `src/core/selectors.js` |
| `src/core/store.js` |
| `src/domains/business/businessService.js` |
| `src/domains/business/creditsDomain.js` |
| `src/domains/business/employeesDomain.js` |
| `src/domains/business/expensesDomain.js` |
| `src/domains/business/productionDomain.js` |
| `src/domains/business/purchasesDomain.js` |
| `src/domains/business/salesDomain.js` |
| `src/domains/finance/financeService.js` |
| `src/ui/charts/businessCharts.js` |
| `src/ui/charts/chartService.js` |
| `src/ui/charts/personalCharts.js` |
| `src/ui/desktop/desktopApp.js` |
| `src/ui/filters/businessFilters.js` |
| `src/ui/filters/personalFilters.js` |
| `src/ui/filters/searchFilter.js` |
| `src/ui/forms/businessForms.js` |
| `src/ui/forms/personalForms.js` |
| `src/ui/modals/businessModals.js` |
| `src/ui/modals/modalManager.js` |
| `src/ui/modals/personalModals.js` |
| `src/ui/shared/controllerBase.js` |
| `src/ui/views/business/businessDashboardView.js` |
| `src/ui/views/business/businessExpensesView.js` |
| `src/ui/views/business/businessProfileView.js` |
| `src/ui/views/business/cashFlowView.js` |
| `src/ui/views/business/creditsView.js` |
| `src/ui/views/business/employeesView.js` |
| `src/ui/views/business/inventoryView.js` |
| `src/ui/views/business/productsView.js` |
| `src/ui/views/business/purchasesView.js` |
| `src/ui/views/business/salesView.js` |
| `src/ui/views/business/suppliersView.js` |
| `src/ui/views/personal/dashboardView.js` |
| `src/ui/views/personal/debtsView.js` |
| `src/ui/views/personal/goalsView.js` |
| `src/ui/views/personal/movementsView.js` |
| `src/ui/views/personal/planView.js` |
| `src/ui/views/personal/profileView.js` |
| `src/ui/views/personal/reportsView.js` |
| `src/utils/app.js` |
| `src/utils/desktop/index.js` |
| `src/utils/desktop/lifecycle.js` |
| `src/utils/desktop/security.js` |
| `src/utils/desktop-components/dashboard.js` |
| `src/utils/money.js` |
| `src/views/business/BusinessDashboardView.js` |
| `src/views/personal/DashboardView.js` |

## Verificación

- Antes de la limpieza: 55 pruebas Node y los comandos `node test_shared.js` y `node test_dates.js` correctos.
- Después: 57 pruebas Node correctas, incluidas dos comprobaciones nuevas de recursos/enlaces locales y equivalencia del núcleo PC/móvil; ambas comprobaciones de compatibilidad correctas.
- Los dos programas C++ pasaron la comprobación sintáctica C++17 antes del traslado y se conservaron íntegros.
- Chrome: navegación personal y creación de ingreso, meta y deuda en PC de 1366 px y móvil de 390 px; valores exactos, persistencia tras recarga y aislamiento empresarial correctos. Sin errores JavaScript ni recursos locales faltantes.
- Facturación: suite completa en PC de 1440/820 px y móvil de 390 px, incluidos PDF, XML, QR, cobros, anulación y concurrencia real entre pestañas.
- Informes: suite completa en 14 combinaciones de PC/móvil, de 320 a 1920 px; filtros, gráficos, CSV, impresión e igualdad de resultados correctos.
- Espacio empresarial: 14 combinaciones de PC/móvil, de 320 a 1920 px, incluidos los flujos completos de operaciones en PC de 1366 px y móvil de 390 px. Se comprueba además el cambio real de plataforma conservando los movimientos personales.
- La suite empresarial tenía un fallo previo: buscaba `.bm-version-button`, un botón ausente en ambas interfaces. Se sustituyó el selector por los enlaces vigentes, manteniendo la comprobación del módulo empresarial y las comprobaciones de perfil; se añadió la navegación real entre plataformas.
- Una revisión independiente confirmó que todos los archivos trasladados tienen su destino y que no se eliminaron acciones ni datos. Los enlaces locales de la documentación y `git diff --check` también se verificaron.

## Limitaciones previas

El prototipo Qt está incompleto desde antes: sus manifiestos mencionan modelos y `PersonalFinanceService` ausentes; qmake también referencia `qml.qrc` ausente. Se conservaron sus archivos. No se verificó la compilación Qt.

Las salidas de navegador en `tmp/` siguen siendo archivos regenerables ignorados por Git. No se eliminaron copias de usuario ni se accedió al almacenamiento de su navegador habitual.
