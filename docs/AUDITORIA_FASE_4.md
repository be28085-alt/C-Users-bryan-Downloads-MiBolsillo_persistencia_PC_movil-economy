# Auditoría de arquitectura — fase 4

Fecha: 27 de noviembre de 2026. Referencia inicial Git: `89e9d67`, árbol limpio.

**Fase 4 implementada y verificada.** Se conservaron las funcionalidades de los flujos probados, el UX/UI, las reglas financieras, las medidas de seguridad y los datos del usuario. No se realizaron commit, push, despliegue, reescritura del historial, migraciones reales, revocaciones ni rotaciones. No se inició la fase 5. Los límites de verificación y de la transición se explican abajo.

## Referencia inicial

Se consultaron AGENTS.md y las auditorías de las fases 1, 2 y 3. Antes de modificar código se reprodujeron **146 pruebas aprobadas y cero fallidas**, más `node test_shared.js` y `node test_dates.js` aprobados. Evidencia en `tmp/architecture-phase4/baseline.log`.

Se inventariaron los archivos actuales de `database/` mediante existencia y SHA-256, sin imprimir sus contenidos ni abrir el servidor sobre ellos. Hay 15 archivos al comenzar esta fase; se conserva también la referencia a los 12 archivos del inventario anterior. Las pruebas utilizan exclusivamente bases y cuentas sintéticas.

## Diagnóstico confirmado

| Hallazgo | Evidencia inicial | Impacto y decisión |
|---|---|---|
| Controladores extensos y cálculo repetido | PC 1649 líneas, móvil 1398; filtrado, CSV y previsión presupuestaria repetidos. | Extraer reglas compartidas sin unificar las diferencias visuales ni los campos de búsqueda deliberadamente distintos. |
| Fachada con múltiples responsabilidades | `finanzasCore.js`: 986 líneas; normalización, comandos personales, consultas, persistencia y delegación empresarial. | Separar normalización de agregado, comandos sobre candidato explícito y unidad de trabajo; conservar los métodos públicos compatibles. |
| Raíz del servidor con repositorio y transporte | `serve-sqlite.cjs`: 377 líneas con DDL/vistas/CAS, lectura JSON, headers, rutas, seguridad y estáticos. | Extraer repositorio, transporte y controlador de almacenamiento; mantener guards y composición en el servidor. |
| Acoplamiento inverso del almacenamiento | `localStorage.js` accede directamente a `window.Finanzas` y al store opcional para publicar resultados/estado. | Sustituir el conocimiento del consumidor por un contrato de suscripción; la aplicación actualiza su proyección. |
| Dependencias web implícitas | 58 scripts locales por interfaz, orden compartido y controlador distinto. | Conservar distribución por scripts, documentar dependencias y comprobar límites/orden en pruebas. No cambiar de framework. |
| Organización empresarial ya útil | `businessService.js`: 39 líneas; `businessCommands.js`: 223; dominios y vistas compartidos existentes. | Conservar esta separación; no fragmentar por una cuota de líneas. |
| Documentación de estructura dispersa | Existe `docs/ESTRUCTURA.md`; faltan arquitectura y el nombre orientativo de mapa solicitado. | Crear una guía de arquitectura y un mapa canónico, con puente desde el documento anterior. |

El grafo inicial de los 15 scripts CJS contiene 22 dependencias relativas literales y **cero ciclos de importación confirmados**. Las referencias diferidas entre objetos/globales web y callbacks son acoplamiento de coordinación, no una prueba de ciclos de carga CJS. No se inventa una corrección de ciclos que no existen.

Los dominios activos no consultan DOM, HTTP ni WebStorage; los controladores no consultan SQLite ni hacen transporte directo. Ya existen fechas, formato, manejo de errores, formularios y recuperación compartidos. No se duplicarán esas responsabilidades.

## Alcance de implementación

La refactorización se realizó de forma progresiva y reversible: misma API, exportaciones compatibles, SQLite, reglas, estados, UX/UI, PC/móvil, seguridad y fuentes de verdad. Los módulos del servidor permanecen fuera del árbol público. No se ejecutaron migraciones reales, revocaciones, saneamiento del historial, commit, push, despliegue ni fase 5.

## Arquitectura anterior y final

Antes, `FinanzasCore` reunía normalización, mutaciones personales y unidad de trabajo; el almacenamiento actualizaba esa fachada por su nombre global. Los controladores repetían filtros, CSV y previsiones presupuestarias. El servidor mezclaba apertura/SQL de estado, transporte y controlador HTTP con su composición de seguridad.

Ahora:

1. Los dominios de metas/deudas normalizan sus entidades. `stateNormalizer.js` coordina el agregado sobre una copia, preservando reglas históricas y la migración empresarial ya existente.
2. `PersonalCommands` modifica un candidato explícito. `PersonalRepository` conserva la unidad de trabajo que antes estaba en la fachada: bloqueo, refresco, intención incierta, escritura y publicación confirmada. La fachada conserva los nombres, argumentos y resultados de los métodos usados por PC/móvil.
3. Los repositorios personal y empresarial, y la sincronización recibida, publican por `FinanzasCore.publicarEstadoConfirmado`. El adaptador ofrece eventos copiados y cancelables mediante `subscribe`; no modifica directamente la fachada concreta ni un store opcional.
4. Ambos controladores reutilizan filtro, proyección presupuestaria y construcción/descarga del CSV personal. Sus diferencias visuales, mensajes, campos de búsqueda y nombres de archivo continúan explícitas.
5. `serve-sqlite.cjs` compone guardas y rutas. El repositorio legado/conexión SQLite, transporte HTTP, formato de sobre y controlador de almacenamiento están separados bajo `scripts/backend/`, fuera del código público.

No se renombraron rutas ni respuestas, no se cambiaron exports del servidor ni contratos de los clientes, no se movieron datos y no se cambió el esquema SQLite. El repositorio actual por cuenta permanece en `auth-store.cjs`: no se afirma que todo el SQL del proyecto esté abstraído de seguridad.

La [arquitectura implementada](ARQUITECTURA.md) incluye diagramas Mermaid de arquitectura general, capas, operación financiera, autenticación y comunicación Personal/Negocio. El [árbol canónico](ESTRUCTURA_PROYECTO.md) reutiliza la guía anterior; `ESTRUCTURA.md` conserva un enlace compatible. No se crearon directorios vacíos ni se movieron pruebas/controladores por estética.

## Funciones y responsabilidades extraídas

| Origen | Destino y responsabilidad |
|---|---|
| `FinanzasCore.normalizeMeta`, `normalizeDeuda` | `PersonalGoalsDomain.normalizar` y `PersonalDebtsDomain.normalizar`; wrappers anteriores compatibles. |
| `FinanzasCore.normalizeState` | `FinanzasStateNormalizer.normalizeState`; normalización agregada sin DOM ni persistencia. |
| Clave de presupuesto | `PersonalBudgetDomain.clavePeriodo`; usada por comandos y normalización. |
| Validación monetaria personal | `PersonalCommands.importe`; misma política de redondeo, límites y errores. |
| Diez mutaciones personales | `PersonalCommands`: agregar movimiento, actualizar presupuesto/límite de categoría, agregar/aportar meta, agregar/pagar deuda y eliminar movimiento/meta/deuda. Las operaciones relacionadas conservan el mismo candidato transaccional. |
| `persistirEstado`, `escribirPersonal` | `PersonalRepository`; conserva nombre del Web Lock compartido, fallback de cola, captura de clave antes de encolar y recuperación de resultado incierto. |
| Publicación de ambos repositorios y sincronización | Puerto de aplicación `publicarEstadoConfirmado`; espejo opcional y notificación fuera del adaptador. |
| Filtrado PC/móvil | `PersonalMovementsDomain.filtrarMovimientos`; mantiene orden e identidad de los registros sin mutarlos. |
| Previsión del formulario | `PersonalBudgetDomain.proyectarMovimiento`; devuelve importes/indicadores, mientras cada cliente conserva sus avisos. |
| CSV personal | `FinanzasExportService`: una construcción y una descarga, con parámetros compatibles para PC/móvil. |
| `validEnvelope`, `openStore`, `send`, `readJSON` y bloque `/api/storage` | Cuatro módulos backend privados; `handleStorage` recibe repositorio seleccionado por sesión, sin importar SQLite ni elegir dueño por el cuerpo. |

Se eliminaron los bloques de implementación repetidos de filtros, previsión y CSV en los dos controladores; no se presenta ese inventario como porcentaje global de duplicación. Se retiró únicamente un método vacío de alertas de stock que ya estaba sobrescrito por la implementación posterior con el mismo nombre; la implementación operativa y su API permanecen.

El CSV personal mantiene bytes, cabecera, coma/LF, ausencia de BOM, importes con dos decimales, neutralización de fórmulas, nombres por período, sufijo `_movil` y revocación del objeto a 1000 ms. Las llamadas anteriores a `descargarCSV` mantienen su BOM y revocación inmediata por defecto. La búsqueda PC sigue incluyendo cuenta, concepto y categoría; la móvil conserva concepto/categoría. El aviso móvil conserva el límite de categoría adicional al mensual; no se igualó el diseño al de PC.

## Estado, dependencias y seguridad

SQLite por cuenta sigue siendo la autoridad del modo servidor. `Finanzas.state` es su proyección de trabajo, y las copias candidatas, revisión esperada y comprobante incierto son estados de una operación, no nuevos almacenes financieros. Los stores opcionales no tienen creador en los scripts activos; se conserva su compatibilidad sin introducir otro store.

La suscripción nueva entrega copias y devuelve cancelación. Fallar al aplicar una revisión recibida restaura la referencia anterior y hace fallar el refresco, bloqueando una escritura basada en estado viejo. El fallo de un observador de status no transforma un COMMIT confirmado en error. Se probaron cancelación, separación entre consumidores, fallo y recuperación; no se imprimen excepciones originales.

Se conserva el bloqueo común de operaciones personales/empresariales, los indicadores de intención incierta y la publicación después de confirmar. No se ejecutan mutaciones ajenas al reintento original, no se duplica un pago ante pérdida de respuesta y no se usa localStorage como fallback de SQLite. Los borradores de formularios permanecen solo en memoria durante 15 minutos y para la misma cuenta.

El acoplamiento inverso por nombre concreto de `localStorage.js` a la fachada desapareció. Los repositorios reciben un puerto de aplicación y conservan la coordinación diferida necesaria; no se anuncian como dependencias eliminadas todas las referencias de objetos/globales.

El grafo CommonJS de imports relativos literales tiene **cero ciclos antes y después**. No había un ciclo de imports confirmado que corregir. La cantidad pasa de 15 módulos/22 aristas a 19/32: más aristas no es una mejora por sí sola; expresan ahora los límites de transporte, controlador y repositorio. Los scripts clásicos de ambas interfaces conservan orden común y controles de carga.

La composición del servidor conserva origen/Host/proxy, sesión, cuenta activa y cuotas antes de elegir `accounts.scoped(session.user.id)`. El controlador conserva CSRF, JSON, límites, campos, revisión e idempotencia. El `return await` conserva la captura central de errores asíncronos. El repositorio por cuenta mantiene autorización y escritura en la misma transacción. Argon2id, expiración/inactividad, cookies, recibos, permisos privados, rutas canónicas, auditoría y restauración de fase 3 no se debilitaron.

## Archivos modificados

| Archivos | Cambio |
|---|---|
| `desktop.html`, `mobile.html` | Tres cargas compartidas nuevas antes de la fachada. Sin cambio de estructura visual, inline scripts ni estilos. |
| `src/services/finanzasCore.js` | Delegación de normalización, comandos y unidad de trabajo; consumidor de almacenamiento y publicación compatible. |
| `src/domains/personal/goalsDomain.js`, `debtsDomain.js` | Normalización de la entidad respectiva. |
| `src/domains/personal/movementsDomain.js`, `budgetDomain.js` | Filtro, clave de período y proyección reutilizables. |
| `src/utils/desktop.js`, `mobile.js` | Consumir reglas/exportaciones compartidas sin cambiar presentación. |
| `src/services/exportService.js` | CSV personal compartido con opciones que preservan el exportador anterior. |
| `src/storage/localStorage.js` | Puerto de observación, copias y gestión segura de fallos del consumidor. |
| `src/storage/businessRepository.js` | Publicar mediante el puerto común de la fachada después de confirmar. |
| `scripts/serve-sqlite.cjs` | Composición que delega en los módulos privados, con exports compatibles. |
| `README.md`, `AGENTS.md` | Contratos, ubicación de responsabilidades y reglas para extender módulos. |
| `docs/ESTRUCTURA.md` | Enlace compatible al mapa reutilizado y actualizado. |

Archivos creados:

- `src/domains/personal/personalCommands.js`.
- `src/services/stateNormalizer.js`.
- `src/storage/personalRepository.js`.
- `scripts/backend/state-envelope.cjs`.
- `scripts/backend/sqlite-state-repository.cjs`.
- `scripts/backend/http-transport.cjs`.
- `scripts/backend/storage-controller.cjs`.
- `tests/architecture.test.cjs` y `tests/phase4-presentation.test.cjs`.
- `docs/ARQUITECTURA.md`, `docs/ESTRUCTURA_PROYECTO.md` y este informe.

**Archivos de código trasladados o eliminados: ninguno.** Las funciones extraídas conservan wrappers donde forman parte de la API. Se reutilizó contenido de una guía en el mapa canónico, manteniendo su enlace anterior. No se cambiaron `package.json`, lockfile, dependencias, CSS, configuración de entorno, `.gitignore`, Android ni Qt. No se incluyeron datos privados ni secretos nuevos.

## Métricas reproducibles

Líneas medidas con `splitlines()`, incluidos comentarios. No representan por sí solas complejidad ni calidad.

| Medida | Inicial | Final |
|---|---:|---:|
| `finanzasCore.js` | 986 | 725 |
| `serve-sqlite.cjs` | 377 | 206 |
| `desktop.js` | 1649 | 1623 |
| `mobile.js` | 1398 | 1373 |
| `localStorage.js` | 309 | 326 |
| `auth-store.cjs` | 196 | 196 |
| `businessCommands.js` | 223 | 223 |
| Archivos JS frontend / CJS servidor | 60 / 15 | 63 / 19 |
| Scripts locales por entrada PC/móvil | 58 / 58 | 61 / 61 |
| Ciclos CJS relativos literales | 0 | 0 |
| Pruebas del runner de Node | 146 | 164 |

La fachada pierde 261 líneas y el servidor 171; los controladores pierden 51 conjuntamente. El almacenamiento crece al hacer explícito su contrato y el tratamiento de fallos. No se computó un porcentaje global de duplicación ni complejidad ciclomática, y no se afirma que se hayan eliminado todos los archivos grandes. El QR de proveedor no se fragmentó. Los tamaños y fuentes de la métrica están en `tmp/architecture-phase4/metrics-before.json` y `metrics-after.json`.

## Resultados de verificación

| Verificación | Resultado observado |
|---|---|
| Baseline antes de editar | 146/146, cero fallos. |
| Grupo tras extraer normalización | 28/28; volvió a pasar tras extraer comandos/repositorio. |
| Backend dirigido | 47/47: cuentas, seguridad, SQLite, archivos privados y respaldos. |
| Suite final `node --test tests/*.test.cjs` | **164/164**, cero fallos, omisiones ni cancelaciones. Incluye 18 pruebas nuevas: nueve de arquitectura/observadores y nueve de presentación/paridad/CSV. |
| `node test_shared.js`, `node test_dates.js` | OK, sin modificar esas pruebas. |
| Personal en navegador | PC, compacto y móvil aprobados: formularios reales, fallo, reintento, saldos mensuales, historial, perfil, recarga y reinicio. |
| Negocio en navegador | Las seis suites aprobadas: workspace, facturación, informes, inventario, medidas y gastos. Incluyen anchos de 320 a 1920 según la suite, operaciones relacionadas, exportaciones y SQLite donde corresponde. |
| Cuentas | Aprobada a 1366/390: registro/login, errores, edición/eliminación, reinicio, cambio de cuenta y aislamiento. |
| SQLite | Aprobada: PC/móvil, fallo de escritura, reinicio, conflictos entre contextos y protección de importación corrupta. |
| Respaldos | PC/móvil: crear, descargar, cancelar/confirmar restore y recargar, aprobado con datos sintéticos. |
| Entrada adaptable | Aprobada: mismo documento/núcleo/sesión y borrador al cambiar tamaño/rotar, navegación y guardado SQLite. |
| Recuperación fase 2 | PC/móvil: 400/401/403/500/503, conexión, timeout, respuesta perdida, misma clave, no duplicación, caducidad y A/B aprobados. |
| Seguridad | Pruebas CSRF/autorización/rate limits/sesiones e historial de pagos conservadas; nueva ejecución de navegador XSS PC/móvil aprobada. |
| Paquete web Android | Pruebas de empaquetado de la suite aprobadas: nuevos scripts incluidos desde HTML, sin backend ni datos privados. No se compiló APK ni se instaló en teléfono. |
| Dependencias | `pnpm audit --json`: 101 dependencias y cero avisos reportados. Sin actualizaciones. |
| UX/UI | Comparación de HTML retirando únicamente scripts externos: estructura e inline scripts idénticos; CSS sin cambios. Revisión de capturas sintéticas PC/móvil y verificaciones responsivas aprobadas. No es una comparación exhaustiva de todos los píxeles/navegadores. |
| Git/formato | `git diff --check` aprobado, sin privados rastreados y misma referencia `89e9d67`, sin staging/commit/push. |

No se borraron, deshabilitaron ni relajaron pruebas anteriores. Los grupos PASS de navegador no se suman al número de pruebas Node. Los nuevos límites de arquitectura cubren imports literales y accesos directos, no todas las dependencias dinámicas posibles.

### Datos privados y actividad del usuario

El inventario al comenzar contiene 15 archivos de `database/`, no los 12 del informe anterior: la aplicación había seguido usándose entre fases. Durante el trabajo cambiaron dos huellas (`mibolsillo.sqlite` y el registro de seguridad). El usuario confirmó expresamente que estaba usando la aplicación y guardando. No se restauraron esas versiones anteriores ni se sobrescribieron sus cambios.

Las 13 huellas restantes coincidieron con el inventario inicial. Se tomó un segundo punto de comparación después de la actividad confirmada y **los 15 archivos coinciden con ese punto al finalizar**, sin que las pruebas ni la refactorización abrieran la base real. La configuración privada Qt no se modificó. No se afirma falsamente que las 15 huellas iniciales fueran estáticas mientras el usuario utilizaba MiBolsillo. WAL/SHM son parte del ciclo SQLite; no se recrearon ni borraron manualmente para aparentar coincidencia con un inventario antiguo.

Todas las pruebas utilizaron memoria o carpetas temporales únicas. No se asignaron datos reales a cuentas, no se ejecutaron migraciones ni se realizaron revocaciones. No hay bases o respaldos pendientes en Git. Los manifiestos de integridad permanecen privados bajo `tmp/architecture-phase4/`.

## Evidencia y reproducción

Los logs de `tmp/architecture-phase4/` registran `baseline.log`, `normalization.log`, `personal-extractions.log`, `backend-extraction.log`, `unit-progress.log`, `unit-final.log`, `business-browser.log`, `personal-browser.log`, `accounts-browser.log`, `sqlite-browser.log`, `backups-browser.log`, `adaptive-browser.log`, `recovery-browser.log`, `security-browser.log` y `dependency-audit.json`. La ejecución intermedia contiene menos tests nuevos porque se terminaron después; el resultado final es 164. Los artefactos de navegador son sintéticos y quedan ignorados.

```powershell
node --test tests/*.test.cjs
node test_shared.js
node test_dates.js
npm run test:browser
npm run test:personal:browser
npm run test:accounts:browser
npm run test:sqlite:browser
node tests/backup-controls.browser.cjs
npm run test:adaptive:browser
node tests/phase2-regression.browser.cjs
node tests/security.browser.cjs
pnpm audit --json
git diff --check
git ls-files -- database/backups
git diff --stat
```

Playwright/Chromium existentes bajo `tmp/phase2-tools/` se reutilizaron mediante `PLAYWRIGHT_MODULE` y `PLAYWRIGHT_BROWSERS_PATH`, sin añadir dependencias. No iniciar `npm start` con datos reales para ejecutar esta matriz. Los scripts de navegador crean sus bases aisladas.

## Riesgos pendientes, límites y fase siguiente

- Siguen abiertos los pendientes operativos de fase 3: historial expuesto, revocación/rotación autorizable, credencial MySQL histórica si fue real, HTTPS/proxy en hosting, CSP con inline, enumeración del registro y cifrado/custodia. Reorganizar código no los resuelve ni autoriza acciones reales.
- `FinanzasCore` y las vistas siguen siendo archivos amplios, pero ahora tienen menos reglas/mecanismos mezclados. No se fragmentaron servicios empresariales ya pequeños, autenticación/backup con transacciones relacionadas ni código de proveedor.
- `guardarEstado()` y la restauración JSON heredada conservan rutas de publicación previas. El servicio de exportación conserva su adaptador DOM de descarga. No se presenta la transición como una arquitectura totalmente desacoplada ni como limpieza exhaustiva.
- Los scripts clásicos mantienen namespaces y orden explícito; las pruebas no detectan todas las posibles relaciones dinámicas. Los repositorios siguen usando un puerto de fachada compatible. No se introdujeron ESM, un framework o un contenedor de dependencias.
- SQLite no se sustituyó ni se optimizó en profundidad; el repositorio por cuenta continúa en autenticación. Una futura base remota necesitará contrato transaccional, autorización e idempotencia equivalentes, no un cambio de driver improvisado.
- No se recompilaron Qt/APK ni se probaron dispositivos físicos, todos los motores de navegador o carga distribuida. Android independiente sigue sin presentarse como SQLite autenticado nativo.

Para una eventual fase 5 se recomienda documentar/limpiar convenciones restantes, revisar comentarios históricos y evaluar por separado las rutas de compatibilidad anteriores; usar los tests como contratos. Son recomendaciones, **no trabajo iniciado**. La fase 4 termina aquí con los cambios locales revisables y las funcionalidades, UX/UI, seguridad y datos conservados dentro del alcance y las verificaciones descritas.
