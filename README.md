# MiBolsillo — organización y correcciones de lógica

## Informes de Mi Negocio en PC y móvil (09-11-2026)

- Ambas versiones comparten el informe **Tu negocio, en perspectiva**: utilidad neta, ingresos, costos y gastos, ticket promedio, ventas y cartera actual, evolución de seis meses, distribución y desglose por rubro y estado de resultados.
- Filtros reales de mes actual, mes anterior, año actual e histórico, con comparación frente al período anterior. Los gráficos funcionan sin conexión a Chart.js. Se conserva una tabla accesible con los valores mensuales.
- Se calcula el resultado con costo histórico de ventas, gastos y nómina. Las compras de inventario y los abonos de cartera no duplican gastos o ingresos. Las facturas simuladas usan la base sin impuestos y los valores ajustados de la venta. La cartera se identifica como saldo actual de todos los períodos.
- Los importes del informe se acumulan en centavos enteros; no se altera ningún registro al consultar o exportar. Hay descarga CSV del filtro y una vista de impresión independiente para **Guardar como PDF**.
- Pruebas específicas: `node --test tests/business-reports.test.cjs`. Pruebas opcionales de navegador: `node tests/business-reports.browser.cjs`, con Playwright instalado o las variables `PLAYWRIGHT_MODULE` y `PLAYWRIGHT_CHROME`. Cubren PC de 1440/820 px y móvil de 390/360 px, filtros, igualdad de resultados, gráficos sin red, CSV, impresión y aislamiento de datos personales.

## Facturación simulada (09-11-2026)

Mi Negocio incluye **Facturación electrónica simulada**: en PC se abre desde Ventas; en móvil, desde el inicio empresarial. Incluye motor decimal `BigInt`, borradores, validación interna, PDF con aviso fiscal, XML experimental UBL 2.1, QR interno, notas, cobros, historial, snapshots y auditoría. Finanzas Personales conserva sus flujos.

Use localhost/HTTPS y un navegador con Web Locks/Web Crypto. La integración real está deshabilitada. Los roles y la persistencia son locales; no se garantiza concurrencia global con escritores heredados ni operación multiusuario. XML, CUFE/CUDE, firma y habilitación oficial requieren la fase de backend y pruebas DIAN.

Consulte [el análisis, fases, reglas, alcance y migración](docs/FACTURACION_SIMULADA.md). Ejecute `node --test tests/*.test.cjs`, `node test_shared.js` y `node test_dates.js`; la suite opcional de navegador es `node tests/invoicing.browser.cjs` y requiere Playwright.

## Mejoras de confiabilidad (08-11-2026)

- Ventas: validación de cantidades, precios, fechas e importes finitos; comprobación acumulada del stock cuando un producto aparece en varias líneas. El documento se valida completo antes de modificar inventario.
- Compras: validación completa antes de modificar existencias; un pago explícito de cero conserva la deuda pendiente.
- Cobranza: rechazo de abonos negativos, cero, no finitos, superiores al saldo o asociados a otro cliente/negocio.
- PC y móvil comparten el aviso de persistencia y el servicio de copias JSON. El aviso permanece mientras existan errores y permite reintentar sin volver a registrar operaciones. Las facturas inválidas mantienen el formulario abierto; los campos de artículos tienen nombres accesibles y admiten cantidades desde 0,01.
- Se añadió «Restaurar copia JSON» junto a la descarga de copias en el perfil. Se valida el archivo y se solicita confirmación antes de reemplazar datos; se descarga primero una copia del estado actual. Una restauración que no se puede guardar no reemplaza el estado visible.
- Las páginas activas cargan los mismos servicios de almacenamiento, exportación y aviso. Los archivos antiguos de la raíz se mantienen por compatibilidad y no deben recibir nuevas reglas financieras.

### Pruebas del núcleo activo

Requieren Node.js y no instalan dependencias:

```sh
node --test tests/active-core.test.cjs
node test_shared.js
node test_dates.js
```

También puede usarse `npm test` si npm está disponible. Las pruebas nuevas cargan los scripts locales en el orden declarado por cada HTML y comprueban ventas, compras, cartera, inventario, fallo/reintento de almacenamiento, sincronización, restauración y comportamiento del aviso. Las pruebas antiguas se conservan como cobertura de compatibilidad.

### Uso y límites

- Ante «solo en memoria», conserva la pestaña abierta y usa «Reintentar guardado» o descarga una copia. Registrar otra vez la operación puede duplicarla.
- Si otra pestaña tiene cambios que esta no ha recibido, se bloquea la escritura para evitar sobrescribirlos. Descarga ambas versiones y revísalas antes de restaurar una. No existe fusión automática de registros.
- Si el JSON almacenado no se puede leer, se bloquean las escrituras para proteger el original; los datos iniciales visibles no significan que se haya recuperado el archivo dañado.
- La detección de conflictos es preventiva: `localStorage` no ofrece transacciones entre pestañas. Para escrituras simultáneas garantizadas se requiere una solución transaccional.
- La validación automatizada usa un entorno de navegador simulado; la comprobación visual de esta entrega quedó pendiente por un fallo de la herramienta de navegador.
- La sincronización entre equipos, autenticación y copias remotas siguen como fase opcional: requieren definir backend y alojamiento. Qt permanece como implementación independiente.

## Archivos

- `desktop.html` y `mobile.html`: interfaces activas de escritorio y móvil; ambas usan el núcleo modular de `src/`.
- `src/utils/desktop.js` y `src/utils/mobile.js`: controladores activos de cada interfaz.
- `src/services/finanzasCore.js` y `src/storage/`: lógica financiera/empresarial y persistencia compartidas.
- `shared.js`, `desktop.js` y `mobile.js` de la raíz: implementaciones anteriores conservadas por compatibilidad; no son las entradas activas de esas páginas.
- `mibolsillo.cpp`: versión de consola C++ original; es un programa independiente y no comparte datos con la aplicación web.
- `test_shared.js`: prueba automatizada básica del núcleo web en Node.js.

## Arquitectura web activa

- `desktop.html` carga las utilidades, dominios y persistencia de `src/`, y termina con `src/utils/desktop.js`.
- `mobile.html` carga el mismo núcleo y termina con `src/utils/mobile.js`.
- El selector «Mi dinero / Negocio» conserva la plataforma: PC muestra su módulo empresarial y móvil mantiene su interfaz móvil. Ambas comparten los datos locales del mismo origen.
- El módulo PC replica las secciones móviles Inicio, Inventario, Movimientos, Ventas, Clientes, Informes y Tu espacio; incluye acciones para registrar ventas, compras, productos, gastos, ingresos y ajustes de inventario.
- Las acciones empresariales guardan datos mediante `FinanzasCore`; ingresos adicionales del negocio se persisten y se incorporan a las métricas de ingresos, reportes y actividad móvil.
- Los controladores activos son específicos de su HTML; no se deben cargar juntos en una misma página.

## Correcciones realizadas en el núcleo

1. La reserva de memoria de respaldo ahora es compartida entre llamadas; antes se recreaba cada vez que se consultaba el almacenamiento.
2. El guardado informa si se logró escribir en `localStorage`, si solo pudo usar `sessionStorage` o si quedó únicamente en memoria.
3. `sessionStorage` se trata como respaldo temporal, no como persistencia permanente.
4. Se incrementó la versión del esquema de almacenamiento a 3, manteniendo la lectura y normalización de datos anteriores.
5. Se usan identificadores menos propensos a colisiones para metas, deudas, aportes y abonos.
6. Al crear una meta con un monto inicial ahorrado, se registra también ese monto en el historial de aportes.
7. Al eliminar una meta o deuda, se eliminan sus aportes/abonos asociados para no dejar registros huérfanos.
8. Se agregaron validaciones defensivas al recibir datos para crear metas, deudas y actualizar el perfil.

## Pruebas ejecutadas

- `node --check shared.js`
- `node --check desktop.js`
- `node --check mobile.js`
- Prueba de creación de movimiento, cálculo, creación de meta con aporte inicial, eliminación en cascada, abono/eliminación de deuda y escritura en `localStorage` (`node test_shared.js`).
- Compilación sintáctica C++17 (`g++ -std=c++17 -fsyntax-only mibolsillo.cpp`).

## Límites

- La navegación de los espacios personal y empresarial de PC/móvil se verificó en navegador. No se ejecutó la suite de Node.js porque Node no está disponible en este entorno.
- `localStorage` conserva datos en el mismo navegador y origen; no sincroniza equipos distintos. Para ello hace falta un backend con autenticación y base de datos remota.
- La aplicación C++ es independiente y no comparte persistencia con la aplicación web.


## Integración HTML de escritorio (actualización)
- `desktop.html` incluye las vistas personales y empresariales de PC, conectadas a `src/utils/desktop.js`.
- `desktop.css` conserva el puente a `styles/desktop.css`; ambas referencias se versionan para evitar contenido antiguo en caché.


## Auditoría de registro único (03-11-2026)

- Se eliminó el segundo listener global `document.addEventListener('submit', ...)` del controlador de escritorio. Los formularios PC ya ejecutan su manejador mediante `onsubmit` en el HTML; mantener ambos caminos ejecutaba dos veces `Finanzas.agregarMovimiento()` por un mismo envío.
- Se añadió protección de envío en curso y una ventana corta de idempotencia basada en tipo, importe, concepto, categoría y fecha para descartar una repetición inmediata del mismo envío. No se eliminan registros históricos ni se modifican transacciones existentes.
- Se aplicó la misma protección al modal rápido de PC y al controlador móvil que realmente carga `mobile.html` (`src/utils/mobile.js`).
- Se agregó el cambio de período antes de guardar para que las pantallas de movimientos/presupuestos consulten el mes del registro.
- Se versionaron las referencias locales de JavaScript en ambos HTML para evitar servir scripts viejos desde caché.
- Se conservan las funciones y archivos originales; no se hizo una reescritura destructiva de los módulos empresariales, metas, deudas, exportación o reportes.

### Arquitectura activa observada
- PC (`desktop.html`): núcleo modular bajo `src/` más `src/utils/desktop.js`; incluye Inicio, Inventario, Movimientos, Ventas, Clientes, Informes y acceso al mismo perfil/ajustes, junto con formularios para las acciones empresariales rápidas.
- Móvil (`mobile.html`): núcleo modular bajo `src/` más `src/utils/mobile.js`; el menú empresarial mantiene su navegación móvil y «Tu espacio» conserva las opciones comunes.
- Las implementaciones de la raíz (`shared.js`, `desktop.js` y `mobile.js`) se mantienen por compatibilidad histórica, pero no son cargadas por las páginas activas.

### Verificación
- En navegador: PC abre el panel empresarial de escritorio; funcionan las seis secciones y se verificó el registro de ventas/ingresos con actualización de inventario y métricas.
- En navegador: móvil conserva el módulo empresarial móvil y su acceso a «Tu espacio».
- `git diff --check`: correcto. No se conectó a una base de datos remota; los datos dependen del almacenamiento local.

## Persistencia compartida entre PC y móvil

Las versiones `desktop.html` y `mobile.html` usan la misma clave persistente (`FINANZAS_ETAPA_DATA_V2`) y el mismo formato de sobre JSON (`version`, `updatedAt`, `updatedBy`, `data`). La capa móvil también reconoce los datos antiguos guardados directamente, por lo que la primera lectura los migra sin descartar sus campos.

- **En el mismo navegador y origen** (por ejemplo, ambas rutas servidas desde el mismo Live Server): los datos son comunes. Los cambios guardados se notifican a otras pestañas mediante `storage` y `BroadcastChannel` cuando el navegador lo soporta.
- **Entre equipos o navegadores distintos**: `localStorage` no se comparte. Para sincronización automática real se necesita desplegar un backend/API con autenticación y una base de datos remota. Este proyecto no incluye URL, credenciales ni servidor remoto configurado; no se simula una nube inexistente.
- No uses `file://` ni cambies de puerto entre las dos versiones. Abre ambas desde el mismo servidor/origen, por ejemplo `http://127.0.0.1:5500/desktop.html` y `http://127.0.0.1:5500/mobile.html`.

### Organización de responsabilidades

- `src/storage/`: lectura, escritura, compatibilidad y migraciones de datos.
- `src/core/`: estado central, acciones y selectores.
- `src/domains/`: reglas de negocio por área (personal y empresarial).
- `src/services/`: coordinación de servicios y fachada `FinanzasCore`.
- `src/app/`: arranque y enrutamiento de la aplicación.
- `src/utils/`: utilidades de presentación y compatibilidad con código existente.
