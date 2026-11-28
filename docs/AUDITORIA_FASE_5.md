# Auditoría de calidad — fase 5

Fecha de cierre: 28 de noviembre de 2026. Referencia inicial: `82b8c75`, árbol limpio.

**Fase 5 implementada y verificada.** Se conservaron funcionalidades, diseño visual, arquitectura, reglas financieras, SQLite y medidas de seguridad en los flujos comprobados. Los 16 archivos privados del inventario actual permanecen disponibles e idénticos. No se realizaron commit, push, despliegue, reescritura de historial, migraciones reales, revocaciones ni rotaciones. No se inició la fase 6.

## 1. Estado inicial y revisión de fases anteriores

Se consultaron `AGENTS.md`, `README.md`, las auditorías de [fase 1](AUDITORIA_SEGURIDAD_FASE_1.md), [fase 2](AUDITORIA_FASE_2.md), [fase 3](AUDITORIA_SEGURIDAD_FASE_3.md) y [fase 4](AUDITORIA_FASE_4.md), la [arquitectura](ARQUITECTURA.md), el [mapa canónico](ESTRUCTURA_PROYECTO.md) y la [política de datos privados](SEGURIDAD_DATOS_PRIVADOS.md).

Fase 3 terminó con 146 pruebas y fase 4 con 164. Antes de editar código se reprodujeron **164/164 pruebas aprobadas**, sin fallos, omisiones ni cancelaciones; `test_shared.js`, `test_dates.js` y la matriz completa de navegador también aprobaron. Evidencia: `tmp/quality-phase5/baseline-*.log`. Los grupos PASS del navegador no se suman al contador de Node.

La limpieza visual autorizada después de fase 4 ya pertenece a esta referencia: encabezados empresariales retirados, acciones disponibles dentro de las secciones y paleta común. La fase 5 conserva ese resultado.

El inventario de esta ejecución comprende 16 archivos privados o de configuración local, frente a los 12 de fases anteriores. Se comparó existencia y SHA-256 sin abrir SQLite real ni usar sus datos como fixtures. No se borraron ni recrearon WAL/SHM para hacer coincidir inventarios históricos.

Pendiente heredado: `guardarEstado()/saveState()` conserva un contrato de compatibilidad que devuelve la proyección y no garantiza por sí solo confirmación de escritura. No se encontraron guardados directos de formularios activos mediante ese contrato. Su JSDoc ahora explica la limitación; las operaciones de usuario siguen usando unidades de trabajo y comprobando persistencia. La restauración JSON sí comprueba la escritura y tiene consumidores reales: se conservó.

## 2. Hallazgos de calidad y prioridad

La prioridad siguiente corresponde a mantenibilidad, salvo cuando se indica un efecto sobre recuperación; no representa una nueva clasificación de vulnerabilidades explotables.

| Prioridad | Hallazgo confirmado | Tratamiento / resultado |
|---|---|---|
| Alta | Validadores, servidor y vistas comprimidos; complejidad máxima 117 y 40 funciones sobre 20. | Formato por grupos, contratos y nombres privados. Permanecen 39 funciones sobre 20; no se reescribieron reglas sensibles solo por bajar una cifra. |
| Media | No había lint, formato reproducible ni EditorConfig. | Herramientas de desarrollo fijadas, ámbitos y exclusiones explícitos; controles automatizados aprobados. |
| Media | Difusión duplicada mediante BroadcastChannel, catches vacíos y callback asíncrono sin manejo completo del fallo de proyección. | Helpers oportunistas, diagnóstico saneado y tres regresiones nuevas; un fallo de aviso no falsea un COMMIT confirmado. |
| Media | Transporte de consulta de sesión repetido y límites técnicos sin nombre. | Transporte compartido dentro del módulo; interpretación de validación/recuperación separada, mismos tiempos y plazo de 15 minutos en memoria. |
| Media | Contratos de escritura, idempotencia, sesión y cálculos monetarios poco documentados. | Comentarios en español, JSDoc y typedefs ajustados al comportamiento real. |
| Baja | Variables/parámetros abandonados, escapes innecesarios y estilos de encabezados sin consumidores. | Retirada de elementos demostrados; preservación de exportaciones dinámicas, reglas CSS mixtas y cabecera PDF. |

El análisis de las fuentes originales con la configuración final y el entorno correcto produjo 109 diagnósticos de lint: 52 `no-unused-vars`, 38 `curly`, 7 `prefer-const`, 4 `preserve-caught-error`, 3 `no-empty`, 3 `no-useless-escape` y 2 `no-control-regex`. Son diagnósticos, no 109 fallos funcionales ni 52 importaciones inútiles: incluyen parámetros, bindings de catch y la instancia pública `pcApp` consumida desde HTML. Esta última se documentó con `/* exported pcApp */` y se conservó.

No se encontraron IDs ni atributos duplicados en los tres HTML revisados. Se revisaron selectores dinámicos y las reglas `!important` destinadas a `[hidden]`, adaptación y movimiento reducido; no se eliminaron por cantidad. Los logs operativos y de seguridad tienen consumidores reales y se conservaron. No se identificaron dependencias de producción que pudieran retirarse con seguridad dentro de este alcance.

## 3. Buenas prácticas aplicadas

Se mantuvo la responsabilidad de los dominios, servicios, repositorios, transporte y vistas de fase 4. Los helpers nuevos resuelven duplicación existente dentro de su módulo, sin otra fachada financiera, almacén, framework o contenedor de dependencias. Se conservaron reglas personales y empresariales distintas aunque compartan estructura.

Se aplicaron responsabilidad única, DRY, separación de responsabilidades, retornos tempranos existentes y soluciones simples. No se introdujeron jerarquías para aparentar SOLID: no había una necesidad nueva de herencia o sustitución. Las interfaces públicas y dependencias por puertos de fase 4 se mantuvieron. Cada grupo de formato/limpieza tuvo comprobaciones dirigidas antes de la verificación integral.

## 4. Convenciones establecidas

[Estándares de código](ESTANDARES_CODIGO.md) define nombres, español en comentarios nuevos, JSDoc, efectos, errores y formato. [Convenciones de desarrollo](CONVENCIONES_DESARROLLO.md) define preparación, selección de responsabilidad, datos ficticios, pruebas y revisión. `README.md` enlaza ambos y explica los scripts; `AGENTS.md` incorpora obligaciones para futuros agentes.

Se conserva el idioma del contrato existente: nombres personales históricos en español y empresariales en inglés. Variables y funciones usan camelCase; clases, PascalCase; límites y protocolos inmutables, UPPER_SNAKE_CASE acotado al módulo. No se renombraron endpoints, eventos, claves persistidas, columnas ni métodos públicos por estética.

## 5. Archivos modificados

El anexo enumera todos los archivos versionados modificados. La mayor parte de `src/`, `scripts/` y `tests/` recibió formato mecánico, llaves en cuerpos multilínea y bindings más precisos. Los cambios con intención adicional se concentran en:

- `src/storage/localStorage.js`, `sqliteBackend.js`, `personalRepository.js`, `businessRepository.js`: contratos de persistencia, constantes locales, nombres privados y manejo de difusión.
- `src/ui/shared/accountSession.js`, `formOperations.js`: transporte compartido de sesión, plazo en memoria, contratos de intención y fallos saneados.
- `src/services/finanzasCore.js`, `businessService.js`, `src/invoicing/money.js`: documentación de contratos públicos, confirmación y precisión monetaria.
- `scripts/storage-patch.cjs`, validación, autorización, cuentas, respaldos y transporte: nombres privados, constantes y documentación, preservando validaciones y SQL.
- Vistas empresariales: variables y parámetros sin uso comprobado; sin cambiar sus plantillas ni acciones.
- Tres CSS empresariales: retirada exclusiva de selectores de encabezados antiguos sin consumidores.
- `package.json`, `pnpm-lock.yaml`, `README.md`, `AGENTS.md`: herramientas y documentación.

## 6. Archivos creados

- `.editorconfig`, `.prettierignore`, `.prettierrc.json`, `eslint.config.cjs`.
- `scripts/quality/metrics.cjs`.
- `tests/quality-runtime.test.cjs`, `tests/quality-tools.test.cjs`.
- `docs/ESTANDARES_CODIGO.md`, `docs/CONVENCIONES_DESARROLLO.md`, `docs/AUDITORIA_FASE_5.md`.

Las evidencias, capturas y manifiestos permanecen en `tmp/`, ignorado por Git; no se publican huellas ni contenidos privados en este informe.

## 7. Archivos eliminados

**Ningún archivo versionado fue eliminado.** No se retiraron versiones archivadas ni bases o respaldos locales. La eliminación de reglas CSS y declaraciones sin uso se detalla a continuación.

## 8. Funciones aclaradas o simplificadas

| Función / flujo | Cambio y contrato preservado |
|---|---|
| Difusión después de `saveState/commitSQLite` | `broadcastStateUpdate` concentra el postMessage oportunista; mantiene la revisión sola para SQLite y el sobre histórico en modo navegador. |
| Recuperación y comprobación de sesión | `requestSession` reutiliza únicamente fetch, credenciales, no-store y timeout de 8 segundos. `resumeSession` y `validateSession` conservan sus decisiones diferentes. |
| Difusión de sesión | `broadcastSession` concentra el aviso sin impedir salir ni recuperar sesión si falla el canal. |
| Callback de BroadcastChannel | Atiende errores del refresco/proyección; conserva la revisión anterior para impedir escrituras obsoletas. |
| `applyOperations` | Expande validaciones y ramas comprimidas, con nombres `operation`, `pathParts`, `nextState`, `targetArray`, etc. Mantiene orden, límites, errores y operaciones. |
| Renderizado y formulario comercial | Retira parámetros `collection` y `r` sin consumidores y sus argumentos correspondientes; salida y acciones conservadas. |

No se dividieron artificialmente fábricas de objetos o plantillas largas. El tamaño físico de una función puede aumentar al expandir código comprimido sin aumentar sus responsabilidades.

## 9. Duplicación eliminada

Se eliminaron dos duplicaciones concretas del cliente: las dos peticiones idénticas de sesión ahora pasan por `requestSession`, y las notificaciones repetidas de persistencia/sesión pasan por sus helpers locales. No se trasladaron cálculos ni validaciones entre dominios diferentes.

No se incorporó un detector general de clones ni se afirma un porcentaje de duplicación antes/después. La comparación se limita a extracciones verificadas y consumidores revisados.

## 10. Código obsoleto retirado

Se retiraron `latestModel`, el objeto `descriptions` de encabezados ya retirados, la variable `top` sin uso en informes, parámetros privados sin consumidores y bindings de catch no utilizados. Se conservaron operaciones que podían tener efectos secundarios, las exportaciones dinámicas y la restauración JSON existente.

Se retiraron **53 alternativas de selectores** de `.bm-header`, `.bm-header-controls`, `.bm-business-picker` y `.bm-location` en tres CSS (30, 19 y 4). Se comprobaron referencias en HTML y clases construidas por JavaScript. Las hojas de reglas que permanecen conservan selectores, declaraciones, orden y contexto; la regla mixta mantiene `.bm-toolbar` y `.bm-search`. `.br-header` de impresión/PDF permanece intacto.

No se retiraron logs de auditoría ni comandos CLI, ni se modificó vendor, Qt, Android nativo o código archivado.

## 11. Nomenclatura y constantes

Los nombres privados describen candidatos, revisión, respuesta, operación, propietario y límites. Se nombraron límites que ya existían: transporte SQLite de 30 segundos, comprobación de sesión de 8 segundos, recuperación de 15 minutos, bloqueo compartido y límites de parches/validación/lectura. Los valores, unidades y ámbito se conservaron; no se creó un archivo global de constantes.

Se conserva la API de `FinanzasCore`, los comandos con candidato explícito, la identidad de reintentos inciertos y los repositorios bajo el mismo bloqueo.

## 12. Comentarios incorporados o corregidos

Los comentarios explican responsabilidades, autorización antes de escritura, propietario tomado de sesión, comparación de revisión, publicación posterior al COMMIT, fallos oportunistas, recuperación en memoria y motivos de validaciones complejas. Se tradujeron encabezados de módulos activos y se aclararon catches de compatibilidad sin publicar detalles técnicos.

Los mensajes de diagnóstico nuevos son fijos y no incluyen correos, sobres financieros, tokens ni excepciones privadas. No se comentó cada instrucción ni se alteraron textos, atributos o estilos visibles para introducir documentación.

## 13. Documentación JSDoc

Se documentaron métodos importantes de fachada, servicios, repositorios, transporte, sesiones, transacciones y dinero. Se añadieron estructuras como `PersistenceResult` y `StorageOperation`; los retornos, efectos y errores describen el código real. La documentación de `guardarEstado` advierte su contrato de compatibilidad en vez de prometer confirmación inexistente.

`InvoiceMoney` documenta escalas BigInt de cuatro decimales para cálculos y dos para presentación, junto con el redondeo HALF_UP existente. No se modificó el algoritmo. JSDoc facilita revisión y editor; no se presenta como una comprobación completa de tipos. Introducir checkJs global sobre scripts clásicos y contratos dinámicos requeriría una adaptación separada; no se simuló una migración a TypeScript.

## 14. Herramientas de calidad

Se incorporaron como dependencias **solo de desarrollo**: ESLint `10.15.0`, `@eslint/js` `10.0.1`, `globals` `17.14.0` y Prettier `3.10.1`, con versiones exactas y lockfile. ESLint analiza errores y usos; globals declara entornos legítimos; Prettier hace reproducible el formato. Node existente es compatible; las dependencias de producción y tecnologías actuales no cambiaron.

| Comando | Alcance |
|---|---|
| `npm run lint` | JavaScript propio, scripts y pruebas; entornos Node, navegador y callbacks Playwright explícitos; cero avisos tolerados. |
| `npm run lint:fix` | Correcciones automáticas revisables del mismo alcance. |
| `npm run format` / `format:check` | JS/CJS propios, pruebas y JSON de configuración seleccionados. Excluye HTML, CSS, docs, vendor, privados, generados y archivados. |
| `npm run quality` | Lint y comprobación de formato; no sustituye tests. |
| `npm run quality:metrics -- --ref <commit>` | Métricas AST de la revisión indicada; sin ref mide el árbol actual. No ejecuta fuentes ni abre bases. |

Formato: dos espacios, comillas simples, punto y coma, ancho objetivo 100 y LF. Se desactiva formato de lenguajes incrustados para preservar plantillas. EditorConfig no recorta automáticamente espacios finales de SQL/templates/Markdown. No se formatearon masivamente HTML/CSS ni salidas generadas.

Las reglas recomendadas de ESLint se mantienen con `no-unused-vars`, `no-empty`, `eqeqeq`, `curly: multi-line`, `no-var` y `prefer-const`. Hay **dos excepciones locales documentadas de `no-control-regex`**: rechazar controles en unidades y limpiar caracteres prohibidos por XML. Los regex existentes se preservaron; no se deshabilitó la regla global ni se cuentan esas dos excepciones como defectos funcionales corregidos.

Referencias primarias: [configuración de ESLint](https://eslint.org/docs/latest/use/configure/configuration-files), [variables sin uso](https://eslint.org/docs/latest/rules/no-unused-vars), [configuración de Prettier](https://prettier.io/docs/configuration) y [exclusiones](https://prettier.io/docs/ignore).

## 15. Métricas comparativas

Las métricas de código usan el mismo conjunto de **82 fuentes de ejecución propias** antes y después. No incluyen pruebas, la herramienta de métricas, vendor, archivos generados, datos privados ni archivados. El lint comparativo usa sus 122 archivos originales; el comando final comprueba además las herramientas y pruebas nuevas.

| Indicador | Inicial `82b8c75` | Final |
|---|---:|---:|
| Fuentes de ejecución analizadas | 82 | 82 |
| Líneas físicas, con blancos y comentarios | 10 734 | 19 672 |
| Funciones, incluidos callbacks | 1 724 | 1 727 |
| Funciones con JSDoc inmediato | 102 | 192 |
| JSDoc de funciones excluyendo IIFE de módulo | 79 | 148 |
| IIFE de módulo identificadas | 61 | 61 |
| Complejidad clásica máxima | 117 | 117 |
| Funciones con complejidad mayor de 20 | 40 | 39 |
| Errores de parseo AST | 0 | 0 |
| Líneas mayores de 300 caracteres | 169 en 24 archivos | 67 en 8 archivos |
| Ciclos estáticos CJS, alcance limitado | 0 | 0 |
| Diagnósticos de lint, mismo alcance de 122 archivos | 109 | 0 |
| Avisos de lint, mismo alcance | 0 | 0 |
| Pruebas Node aprobadas / fallidas | 164 / 0 | 171 / 0 |
| Archivos privados actuales intactos | 16 de referencia | 16 de 16 |
| HTML o paleta modificados | 0 | 0 |

El aumento de líneas procede principalmente de expandir fuentes comprimidas y documentar contratos; **no demuestra por sí solo mejor calidad**. La función no modular más larga pasa de 161 a 575 líneas físicas al expandir la fábrica de vistas `create`, cuya complejidad es 1. Las IIFE largas son envoltorios, no un caso de uso: se miden por separado.

El grafo sintáctico de `require` relativo literal entre CJS propios tiene 59 nodos y 69 aristas iniciales, frente a 63 y 70 finales; no hay componentes cíclicas ni autoaristas detectadas. Los cuatro nodos nuevos son configuración, métricas y dos pruebas. Se excluyen los 13 `require` dinámicos presentes en ambas revisiones, namespaces del navegador, HTML, VM y eventos: no se afirma ausencia global de ciclos. Evidencia: `dependency-graph.json`. Las líneas sobre 300 caracteres restantes contienen principalmente plantillas/literales preservados; no se cortan para aparentar una mejora.

La complejidad suma 1 más bifurcaciones clásicas (if, ternario, bucle, catch, case, expresiones/asignaciones lógicas, valores por defecto y accesos opcionales), sin atribuir callbacks a su función exterior. No mide dificultad cognitiva ni código fuera de funciones. JSDoc cuenta únicamente bloques inmediatamente asociados; no certifica la veracidad o suficiencia de cada comentario. Los avisos de complejidad son diagnósticos de la herramienta, separados de ESLint; no se ocultó la complejidad heredada mediante una regla deshabilitada.

La mayor complejidad sigue en `validateFinancialState` (117), callback HTTP del servidor (88), `InvoiceSchema.validateState` (77), construcción de informes (56) y operación de facturación (54). Dividir sus reglas sin una necesidad concreta ampliaría el riesgo de esta limpieza; permanecen identificadas para cambios futuros con pruebas.

Evidencia: `metrics-ast-before-final.json`, `metrics-ast-after.json`, `lint-baseline-correct-env.json` en `tmp/quality-phase5/`. Se descartaron del cómputo los falsos positivos iniciales causados por declarar callbacks Playwright como Node puro.

## 16. Pruebas y verificación integral

| Comprobación final | Resultado y alcance |
|---|---|
| `node --test tests/*.test.cjs` | **171/171**, cero fallos, omisiones ni cancelaciones. Incluye unidades, integración, arquitectura, seguridad y empaquetado. |
| `node test_shared.js` | OK. |
| `node test_dates.js` | OK: historial mensual real. |
| Seis suites de `npm run test:browser` | Workspace, facturación, informes, inventario, unidades/medidas y gastos: aprobadas en PC/móvil y los anchos previstos por cada suite. |
| Personal | PC, compacto y móvil: formularios, fallo/reintento, saldos, historial, perfil, recarga y reinicio aprobados. |
| Cuentas | 1366 y 390 px: registro/login, errores, aislamiento, borradores, movimientos, cierre y protección de sesión restaurada aprobados. |
| SQLite | Reinicio, contexto vacío, conflicto entre escritores, importación histórica y migración corrupta aprobados. |
| Respaldos | Crear, descargar, cancelar, confirmar restauración y recargar en PC/móvil aprobados, exclusivamente con bases ficticias. |
| Entrada adaptable | Mismo documento, núcleo, sesión y borrador entre tamaños/rotación; navegación y SQLite aprobados. |
| Recuperación de fase 2 | HTTP 401/403/400/500/503, conexión, timeout, respuesta perdida, reintento sin duplicación, sesión A/B y caducidad aprobados. |
| Seguridad | XSS almacenado en PC/móvil, CSP, cookie, memoria y persistencia aprobados; CSRF, autorización, cuotas, sesiones y rechazos sin escritura en la suite Node. |
| Calidad | `npm run quality`: ESLint y formato aprobados, cero errores y avisos. |
| Dependencias | `pnpm audit --json --fetch-timeout=15000 --fetch-retries=0`: 0 avisos de vulnerabilidad en las 170 dependencias contabilizadas (101 no dev y 69 dev). No prueba ausencia de fallos desconocidos. |
| Integridad SQL y API | 82 literales/plantillas SQL idénticos en 19 CJS; rutas API, claves exportadas y orden de guardas conservados. |
| Presentación | 14/17 huellas exactas, incluidos los tres HTML y paleta; las otras tres son CSS con eliminación exclusivamente de selectores muertos. Los 1729 fragmentos de plantillas literales revisados conservan contenido y las entradas PC/móvil mantienen el orden de sus 62 scripts compartidos. Capturas sintéticas de PC y móvil inspeccionadas. |
| Datos y Git | 16/16 huellas privadas idénticas, ningún privado de las categorías verificadas rastreado; sin bases/copias pendientes. |
| Android web | Prueba de empaquetado aprobada: fuentes activas y recursos locales, sin copiar bases, tests o archivos privados. No equivale a compilar un APK. |
| Diff | `git diff --check` aprobado. |

Se añadieron **siete pruebas Node**: tres sobre fallo de difusión/proyección sin exponer datos ni falsear persistencia, y cuatro sobre el analizador y el alcance real de las herramientas. No se eliminaron, omitieron ni relajaron aserciones anteriores para conseguir aprobaciones.

Los grupos de formato se comprobaron antes del cierre: cliente 48/48, backend 48/48 y frontend 76/76 en sus suites dirigidas, además de la matriz final. La primera ejecución final restringida produjo `EACCES` al conectar con localhost; se conservó el log y se repitió con permiso de red local. La ejecución permitida aprobó íntegra; no se alteraron pruebas para esconder la restricción.

Logs finales: `tests-final-permitted.log`, `quality-final.log`, `dependency-audit-final.json`, `browser-business-final.log` y `browser-*-final.log` bajo `tmp/quality-phase5/`. Las pruebas usan memoria o bases sintéticas bajo `tmp/`; nunca arrancan el servidor sobre `database/mibolsillo.sqlite` real.

## 17. Riesgos pendientes

| Riesgo heredado | Acción pendiente, sin ejecutar en esta fase |
|---|---|
| Datos privados en historial Git y posibles sesiones/credenciales históricas | Seguir el [plan de respuesta](PLAN_RESPUESTA_EXPOSICION.md): evaluar remotos/clones y exposición, revocar o rotar lo afectado y sanear de forma coordinada con autorización. No se publican valores ni se hace force push. |
| Credencial MySQL histórica del conector archivado | Rotarla en su emisor si tuvo uso real; permanece la necesidad de sanear el historial. No se probó contra una base real. |
| HTTPS, proxy y hosting | Verificar certificados, proxy autorizado, origen, firewall y respaldo antes de un despliegue aprobado. Esta fase no acredita una instalación pública. |
| CSP con `unsafe-inline` | Continúa necesaria para handlers actuales. Una CSP estricta exige cambiar esa integración en un trabajo autorizado. |
| Enumeración en registro | La respuesta de duplicado sigue siendo distinguible; diseñar registro/verificación uniforme sin alterar el flujo durante esta fase. |
| Cifrado y custodia | Datos/copias no incorporan cifrado de aplicación. Evaluar volumen, soportes, claves y restauración según la política existente; no se cambió formato ni motor. |
| Complejidad y contrato de compatibilidad | Permanecen las funciones indicadas y la limitación documentada de `guardarEstado`; usar unidades de trabajo confirmadas para nuevas operaciones. |

Una suite verde no cierra estos riesgos operativos ni sustituye una respuesta a una exposición real.

## 18. Limitaciones

No se realizó comprobación global de tipos, análisis exhaustivo de clones ni de dependencias dinámicas; los namespaces de scripts clásicos requieren conservar el orden de carga. Los controles de arquitectura existentes cubren límites e imports literales, no todas las conexiones posibles en ejecución.

No se recompilaron Qt/APK ni se probaron dispositivos físicos, otros motores de navegador, carga distribuida, TLS de hosting o todos los payloads posibles. Android independiente y web estática siguen usando almacenamiento del navegador hasta integrar SQLite/cuentas de forma correspondiente. No se presentan como SQLite nativo autenticado.

No se afirma igualdad de cada píxel en todos los estados: se verificaron las fuentes HTML/paleta, equivalencia de CSS restante, contratos y flujos, además de inspeccionar capturas. No se abrió SQLite real para releer importes: las huellas idénticas acreditan que esta fase no modificó esos archivos, y las pruebas sintéticas verifican conservación de resultados y persistencia.

## 19. Recomendaciones para futuros desarrolladores

Leer los estándares, preservar las diferencias de dominio y reutilizar sus unidades de trabajo. Revisar consumidores dinámicos antes de retirar código. Cambiar JSDoc junto a las firmas; documentar por qué existe una restricción. Ejecutar calidad, pruebas dirigidas y los flujos PC/móvil afectados. Los cambios financieros deben comprobar resultados relacionados, fallo, reintento y recarga.

No emplear datos reales como fixtures ni iniciar el servidor predeterminado para pruebas. No instalar dependencias sin justificar responsabilidad, mantenimiento y ámbito. No convertir una notificación opcional en fracaso de una escritura confirmada ni permitir que un error de lectura active un almacenamiento alternativo silencioso.

Para revisar el trabajo sin publicarlo:

```sh
git status --short
git diff --stat
git diff -- package.json AGENTS.md README.md
npm run quality
npm test
```

## 20. Recomendaciones para fase 6 y estado final

Antes de iniciar una nueva fase, acordar su objetivo y conservar esta referencia. Priorizar necesidades concretas con pruebas: complejidad en validadores/servidor, contratos compatibles, tipos graduales si aportan valor y riesgos operativos pendientes. No inferir que fase 6 autoriza automáticamente una migración de UI, framework, motor, credenciales o historial.

**Estado final: fase 5 completada dentro del alcance verificado, sin nuevas regresiones observadas.** Funcionalidades, diseño, arquitectura, seguridad e información financiera conservados con las limitaciones indicadas. Cambios disponibles en el árbol de trabajo para revisión. HEAD permanece en `82b8c75`; no se hizo commit, push ni despliegue y no se comenzó la fase 6.

## Anexo: inventario completo de archivos del cambio

127 archivos versionados modificados y 10 archivos nuevos. No hay archivos versionados eliminados. Las rutas se muestran para revisar el diff; las pruebas conservan sus aserciones.

### Versionados modificados

```text
AGENTS.md
README.md
package.json
pnpm-lock.yaml
scripts/auth-store.cjs
scripts/backend/http-transport.cjs
scripts/backend/sqlite-state-repository.cjs
scripts/backend/state-envelope.cjs
scripts/backend/storage-controller.cjs
scripts/backup-store.cjs
scripts/build-android-web.cjs
scripts/desktop-runtime.cjs
scripts/financial-validation.cjs
scripts/migrate-account-data.cjs
scripts/open-sqlite.cjs
scripts/private-files.cjs
scripts/rate-limiter.cjs
scripts/security-audit.cjs
scripts/security-policy.cjs
scripts/serve-sqlite.cjs
scripts/state-authorization.cjs
scripts/storage-patch.cjs
scripts/storage-receipts.cjs
src/domains/business/businessCommands.js
src/domains/business/businessDomain.js
src/domains/business/businessSchema.js
src/domains/business/cashFlowDomain.js
src/domains/business/inventoryDomain.js
src/domains/business/metricsDomain.js
src/domains/business/productUnits.js
src/domains/business/productsDomain.js
src/domains/business/readModel.js
src/domains/business/reportOperationsDomain.js
src/domains/business/reportPreferences.js
src/domains/business/reportsDomain.js
src/domains/business/workspaceMetrics.js
src/domains/personal/budgetDomain.js
src/domains/personal/debtsDomain.js
src/domains/personal/goalsDomain.js
src/domains/personal/movementsDomain.js
src/domains/personal/personalCommands.js
src/domains/user/userService.js
src/invoicing/exports.js
src/invoicing/money.js
src/invoicing/providers.js
src/invoicing/schema.js
src/invoicing/service.js
src/invoicing/ui.js
src/services/businessService.js
src/services/exportService.js
src/services/finanzasCore.js
src/services/stateNormalizer.js
src/storage/businessRepository.js
src/storage/demoData.js
src/storage/localStorage.js
src/storage/migrations.js
src/storage/personalRepository.js
src/storage/seedData.js
src/storage/sqliteBackend.js
src/ui/shared/accountAccess.js
src/ui/shared/accountSession.js
src/ui/shared/adaptiveEntry.js
src/ui/shared/authGuard.js
src/ui/shared/backupControls.js
src/ui/shared/debtReminders.js
src/ui/shared/formGuidance.js
src/ui/shared/formOperations.js
src/ui/shared/persistenceStatus.js
src/ui/shared/personalMovementEditor.js
src/ui/shared/referenceCharts.js
src/ui/shared/referenceIcons.js
src/ui/shared/visualPalette.js
src/ui/views/business/businessReportOperationsView.js
src/ui/views/business/businessReportsView.js
src/ui/views/business/businessWorkspace.js
src/ui/views/business/businessWorkspaceScreens.js
src/utils/businessNumbers.js
src/utils/dates.js
src/utils/desktop.js
src/utils/formatters.js
src/utils/mobile.js
src/utils/operationErrors.js
src/utils/security.js
src/utils/validators.js
styles/businessWorkspace.css
styles/reference-business.css
styles/responsive.css
test_dates.js
test_shared.js
tests/account-access.browser.cjs
tests/account-migration.test.cjs
tests/active-core.test.cjs
tests/adaptive-entry.browser.cjs
tests/android-package.test.cjs
tests/architecture.test.cjs
tests/auth-server.test.cjs
tests/backup-api.test.cjs
tests/backup-controls.browser.cjs
tests/backup-store.test.cjs
tests/business-expenses-unified.browser.cjs
tests/business-numbers.test.cjs
tests/business-reports.browser.cjs
tests/business-reports.test.cjs
tests/business-workspace-metrics.test.cjs
tests/business-workspace.browser.cjs
tests/business-workspace.test.cjs
tests/desktop-runtime.test.cjs
tests/helpers/browser-core.cjs
tests/inventory-unified.browser.cjs
tests/invoicing.browser.cjs
tests/invoicing.test.cjs
tests/personal-edit.test.cjs
tests/personal-flows.browser.cjs
tests/personal-flows.test.cjs
tests/phase2-functional.test.cjs
tests/phase2-regression.browser.cjs
tests/phase4-presentation.test.cjs
tests/private-data.test.cjs
tests/product-measures.browser.cjs
tests/product-units.test.cjs
tests/security-hardening.test.cjs
tests/security.browser.cjs
tests/server-financial-validation.test.cjs
tests/sqlite-async.test.cjs
tests/sqlite-server.test.cjs
tests/sqlite.browser.cjs
tests/structure.test.cjs
```

### Nuevos

```text
.editorconfig
.prettierignore
.prettierrc.json
docs/AUDITORIA_FASE_5.md
docs/CONVENCIONES_DESARROLLO.md
docs/ESTANDARES_CODIGO.md
eslint.config.cjs
scripts/quality/metrics.cjs
tests/quality-runtime.test.cjs
tests/quality-tools.test.cjs
```
