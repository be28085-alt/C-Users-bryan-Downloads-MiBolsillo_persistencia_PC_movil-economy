# Corrección funcional, persistencia y pruebas de MiBolsillo

Fecha: 26 de noviembre de 2026. Se ejecutó exclusivamente la fase 2 sobre `2bde339` (`seguridad`), con el árbol inicialmente limpio. Se consultaron la auditoría y la política de datos privados de fase 1 antes de modificar código. No se hicieron commits, push, despliegues, reescrituras de historial ni operaciones financieras sobre bases reales.

## Estado inicial y reproducción

La referencia se reprodujo con `node --test tests/*.test.cjs`: **108 pruebas, 105 aprobadas y 3 fallidas**. `node test_shared.js` y `node test_dates.js` aprobaron. Se inventariaron mediante SHA-256 los 12 archivos existentes bajo `database/`, sin imprimir sus datos ni utilizarlos como fixtures.

| Prueba inicial | Qué verifica | Fallo reproducido y causa raíz | Corrección |
|---|---|---|---|
| `tests/desktop-runtime.test.cjs`, “Qt reutiliza toda la app HTML y la misma base SQLite sin abrir otro almacén”, aserción originalmente en línea 49 | Servidor Qt compartido, estado original, sesión y recuperación tras reinicio | Esperaba HTTP 200 y recibía 400. El fixture reemplazaba la cuenta con un estado incompleto: movimiento sin tipo/concepto/fecha, producto sin nombre/negocio y meta sin importes. La validación actual lo rechaza correctamente. Era una prueba desactualizada. | Se conserva el estado válido de la cuenta y se agregan registros sintéticos completos con una revisión nueva. Se añadió además una escritura incompleta que debe seguir recibiendo 400, comprobando que no cambie el disco. No se relajó la validación del servidor. |
| `tests/personal-flows.test.cjs`, variante `desktop.html`, “metas y deudas guardan importes e historial, rechazan sobrepagos y limpian relaciones”, línea 72 inicial | Importes, aportes, pagos, relaciones y persistencia al eliminar | Exigía borrar los abonos de una deuda que la aplicación archiva. La eliminación física de esos pagos rompería la trazabilidad de sus egresos. La expectativa era incompatible con la regla de conservación del historial. | Se comprueba que la deuda esté archivada, conserve sus dos abonos y cada egreso vinculado, y deje de aparecer entre las deudas visibles después de recargar. La eliminación de aportes de una meta sigue comprobándose. |
| La misma prueba, variante `mobile.html` | El mismo contrato financiero en móvil | Mismo fallo `true !== false` y misma causa. | Las mismas aserciones reforzadas para móvil. |

Las tres pruebas originales ahora aprueban. No se eliminaron ni deshabilitaron pruebas, ni se alteraron reglas financieras para admitir estados inválidos.

## Soluciones implementadas

### Deudas activas, pagadas y archivadas

`PersonalDebtsDomain.clasificar()` es la fuente compartida para las colecciones visibles, activas, pagadas y archivadas. Una deuda archivada se reconoce tanto por `archivada` como por el estado `ARCHIVADA`. `getDeudas()` utiliza esta clasificación para el resumen, y ambos controladores renderizan su lista enriquecida.

PC ya no cuenta ni muestra la tarjeta archivada. Móvil consume la misma fuente y los recordatorios se calculan desde las deudas activas. Un formulario antiguo no puede registrar otro abono sobre una deuda archivada. Las cuotas de deudas saldadas dejan de sumar. Los abonos, egresos vinculados y el total histórico amortizado se conservan; archivar no devuelve dinero a la cuenta ni elimina gastos anteriores.

Se verificaron tarjetas, número de obligaciones activas, saldo pendiente, cuotas, total amortizado, saldo de caja, relaciones y recarga. La regresión incluye una deuda parcialmente pagada, una pagada y otra activa, tanto en PC como en móvil.

### Sesión vencida y recuperación del formulario

Un HTTP 401 ya no destruye inmediatamente el formulario. El documento financiero se oculta y queda inerte, mientras un iframe muestra la pantalla de acceso existente. Los campos y la identidad del intento permanecen **solo en la memoria de esa pestaña**. No se crea un borrador en localStorage, sessionStorage, SQLite ni archivos descargables.

La recuperación tiene una caducidad de **15 minutos**, que se verifica por temporizador y nuevamente al intentar recuperar. El padre comprueba origen y ventana emisora del mensaje y consulta `/api/auth/session` directamente. El mensaje entre ventanas no contiene contraseñas ni tokens. Solo la misma cuenta verificada por el servidor puede recuperar el documento y actualizar su token de sesión.

Si inicia sesión B después de A, se descarta el documento completo de A y se abre un documento nuevo con la cuenta B. No se copian campos de A al documento de B. También se mantienen la protección ante restauraciones BFCache y la invalidación entre pestañas. Se probó un mensaje de recuperación desde una ventana incorrecta, que no desbloquea el formulario.

Cerrar sesión, abandonar la página o caducar la recuperación descarta el documento. Al guardar correctamente o cancelar un formulario se eliminan sus datos temporales y la identidad de reintento correspondiente. El editor de movimientos también limpia el formulario al guardar o cancelar. El usuario conserva los controles y estilos existentes; se reutiliza el acceso y el aviso de persistencia, sin rediseñar las pantallas.

### Errores y escrituras inciertas

`operationErrors.js` clasifica conexión, timeout, autenticación, autorización, conflicto, validación, persistencia y operación pendiente. Los detalles técnicos de SQL, trazas o rutas recibidos como error no se muestran al usuario. El error del almacenamiento del navegador también tiene un mensaje legible en lugar de mostrar `QuotaExceededError`.

El transporte sigue usando PATCH incremental y compare-and-set de SQLite. No cambia a localStorage tras un fallo. La caché y la interfaz solo publican una revisión confirmada. Si se pierde la respuesta, el reintento conserva exactamente el mismo `operationId`, revisión esperada y operaciones.

Si tampoco se recibe la segunda respuesta, la escritura queda incierta en memoria y el formulario continúa abierto. Una lectura de fondo no reenvía esa escritura. Un reintento explícito desde el formulario original puede reconciliarla; si ya fue confirmada, se devuelve el resultado anterior sin volver a crear movimiento, cliente, pago ni auditoría. Se retiene la identidad del formulario para reconocer ese mismo intento.

Cambiar los datos de un intento incierto o enviar otra intención no ejecuta silenciosamente la escritura anterior. Se pide recuperar el intento original o recargar y revisar lo confirmado. El repositorio empresarial y la facturación usan la misma protección, pasando una identidad que incluye negocio, clave e identificación del contenido. Una operación incierta de un módulo no se confirma desde una acción diferente del otro módulo.

El aviso existente de guardado conserva la referencia al formulario que falló, aun cuando el botón deshabilitado pierda el foco o se cierre el iframe de acceso. Esto evita que el aviso flotante cubra Guardar en móvil. No se eliminó el aviso ni se forzaron clics en las pruebas para ocultar el problema.

### Restablecimiento

Se revisaron las referencias de `reiniciarDatos`, `resetState` y `restablecerDatos`. No existe un botón activo de restablecimiento en los HTML actuales. Se conservaron los métodos internos por compatibilidad, sin volver a habilitar una opción retirada.

El restablecimiento utiliza el bloqueo y la transacción personal compartidos, comprueba explícitamente el resultado, conserva su identidad para reintentar y propaga el fallo. Los controladores muestran éxito solamente después de confirmación. Ante rechazo de escritura, memoria y SQLite mantienen el estado anterior. Si el resultado del transporte es incierto, el mensaje distingue esa incertidumbre; no promete que el servidor haya revertido un COMMIT desconocido.

Tras un guardado confirmado, el núcleo toma la representación confirmada del almacenamiento y la normaliza, incluyendo campos estructurales como `version` y `gastos`, para mantener memoria y estado persistido coherentes.

## Correcciones de las pruebas de navegador

`personal-flows.browser.cjs` intercepta PATCH y POST y exige que se haya interceptado una escritura real. Espera la respuesta rechazada y la finalización del controlador; ya no supone que toda petición termine en 40 ms. Compara el disco con su copia previa y la memoria con su copia previa normalizada, en vez de confundir las diferencias estructurales iniciales de ambas representaciones con una mutación financiera. El cambio de mes se comprueba después de su confirmación asíncrona.

La ejecución completa descubrió además un selector ambiguo preexistente de `business-workspace.browser.cjs`: Gastos tiene acciones legítimas de gasto e ingreso. La prueba ahora abre y comprueba **ambas**, con selectores semánticos por acción. No se eliminó ninguno de los botones ni se redujo la cobertura a la primera coincidencia.

## Archivos modificados y creados

| Archivos modificados | Finalidad |
|---|---|
| `desktop.html`, `mobile.html` | Cargar los dos módulos compartidos nuevos; sin cambios de campos, estructura visual o estilos. |
| `src/domains/personal/debtsDomain.js` | Clasificación y resumen únicos. |
| `src/services/finanzasCore.js` | Deudas, recordatorios, validación de pagos archivados, publicación confirmada, reintentos y restablecimiento. |
| `src/utils/desktop.js`, `src/utils/mobile.js` | Lista compartida de deudas, envoltorio común de formularios y propagación de fallos del restablecimiento. |
| `src/storage/sqliteBackend.js`, `src/storage/localStorage.js` | Clasificación, confirmación, operación incierta, recuperación explícita y avisos. |
| `src/storage/businessRepository.js` | Protección compartida contra reenvío desde otra intención y recuperación del resultado confirmado. |
| `src/services/businessService.js`, `src/invoicing/service.js` | Identidad de operación para el repositorio compartido. |
| `src/ui/shared/accountSession.js`, `src/ui/shared/accountAccess.js` | Reautenticación segura, caducidad y verificación de cuenta/origen. |
| `src/ui/shared/persistenceStatus.js` | Mensajes clasificados y aviso anclado al formulario. |
| `src/ui/shared/personalMovementEditor.js` | Limpieza de campos al guardar o cancelar. |
| `tests/desktop-runtime.test.cjs`, `tests/personal-flows.test.cjs` | Corregir y reforzar los tres casos inicialmente fallidos. |
| `tests/personal-flows.browser.cjs`, `tests/business-workspace.browser.cjs` | Interceptación efectiva, sincronización y selectores específicos. |
| `tests/sqlite-async.test.cjs` | Clasificación HTTP y reintentos inciertos de conexión/timeout. |

Archivos creados:

- `src/utils/operationErrors.js`: errores públicos compartidos.
- `src/ui/shared/formOperations.js`: identidad del intento, bloqueo de doble envío, limpieza y referencia al formulario pendiente.
- `tests/phase2-functional.test.cjs`: cuatro regresiones parametrizadas para deudas y restablecimiento.
- `tests/phase2-regression.browser.cjs`: matriz real de fallos, sesión, privacidad, deudas, reintentos personales/empresariales y restablecimiento en ambos controladores.
- `docs/AUDITORIA_FASE_2.md`: este informe.

No se eliminaron archivos versionados. Un auxiliar temporal de diagnóstico se creó y retiró durante la ejecución; no forma parte del cambio final. Playwright y Chromium se prepararon como herramientas bajo `tmp/phase2-tools/`, ignorado por Git; no se cambiaron `package.json`, el lockfile ni las tecnologías de la aplicación.

## Resultados finales

| Verificación | Resultado |
|---|---|
| Suite inicial | 108 pruebas: 105 aprobadas, 3 fallidas. |
| Suite final `node --test tests/*.test.cjs` | **118 pruebas: 118 aprobadas, 0 fallidas**, incluidas las pruebas de privacidad de fase 1. |
| Nuevas pruebas del runner de Node | 10: cuatro regresiones funcionales PC/móvil y seis de transporte/clasificación. |
| `node test_shared.js`, `node test_dates.js` | Aprobados. |
| `personal-flows.browser.cjs` | PC, compacto y móvil: fallos, reintentos, período, metas, deudas, perfil/correo de acceso, recarga y reinicio completo. |
| `phase2-regression.browser.cjs` | 22 grupos PASS entre PC y móvil. HTTP 401 real por sesión revocada en una base sintética; 403, 400, 500, 503, conexión perdida, timeout, respuesta perdida tras COMMIT, reintento modificado, deuda archivada, operación empresarial incierta, restablecimiento, caducidad y A/B. |
| `account-access.browser.cjs` | Aprobado a 1366 y 390 px: registro, duplicado, contraseña errónea, edición/eliminación, cierre de sesión, recuperación y aislamiento. |
| `npm run test:browser` | Sus seis scripts aprobaron: espacio empresarial, facturación, informes, inventario, unidades/medidas y gastos/ingresos. 38 grupos PASS, incluidos anchos de 320 a 1920 px según la suite. |
| `adaptive-entry.browser.cjs` | Aprobado: mismo documento y núcleo al cambiar tamaño/rotar; navegación y persistencia. |
| `sqlite.browser.cjs` | Aprobado: formularios PC/móvil, error de disco, reinicio, conflictos entre contextos, importación y datos corruptos. |
| `backup-controls.browser.cjs` | Aprobado en PC y móvil: crear, descargar, cancelar y confirmar restauración y recargar. |
| `git diff --check` y sintaxis de módulos | Sin errores de formato o sintaxis detectados. |

Los contadores PASS de los scripts de navegador son grupos de verificaciones, no se suman al contador de pruebas del runner de Node. Las pruebas de timeout reducen exclusivamente el reloj del transporte en el navegador sintético para comprobar el caso; el timeout normal de la aplicación permanece en 30 segundos.

Se inspeccionaron las capturas del formulario recuperado en PC y móvil. Los campos conservan sus valores, los estilos y controles existentes y el acceso al guardado. Los artefactos de esta ejecución están bajo `tmp/security-phase2/` y los directorios de salida indicados por cada suite, todos fuera del seguimiento de Git.

## Verificación de privacidad y conservación

- Los 12 archivos inventariados bajo `database/` siguen disponibles y conservan el mismo SHA-256. No se abrió el servidor de pruebas sobre la base de uso real.
- `git ls-files -- database/backups` no devuelve archivos. No se modificaron `.gitignore`, los módulos de permisos privados, el servidor HTTP ni el almacén de autenticación de fase 1.
- Las 68 solicitudes de archivos privados siguen rechazadas por las pruebas de fase 1. Se conserva la validación del destino canónico de enlaces y los encabezados de seguridad.
- No se copiaron datos financieros reales a fixtures. Las cuentas, contraseñas y operaciones de pruebas son sintéticas y sus bases están en directorios aislados.
- No se guardan contraseñas o tokens dentro de borradores ni mensajes de recuperación. El token nuevo se obtiene por la API de sesión existente para la misma cuenta y se mantiene en la configuración de memoria que ya utiliza el transporte.
- Finanzas Personales y Mi Negocio mantienen sus colecciones, reglas y resultados separados. Se probaron ambos módulos y el bloqueo de una intención distinta cuando hay una operación incierta.

## Riesgos pendientes y limitaciones

1. La recuperación es deliberadamente efímera: cerrar o recargar la pestaña, abandonar la página o superar los 15 minutos descarta el formulario no confirmado. No promete recuperación después de cerrar el navegador. Esa decisión evita crear otro almacén financiero privado sin un diseño de cifrado y custodia de claves autorizado.
2. Descartar un formulario no equivale a deshacer un COMMIT que pudo haberse ejecutado. Una operación incierta conserva su comprobante en memoria y bloquea nuevas intenciones. Si otra pestaña avanzó la revisión, se presenta un conflicto; no se fuerza una sobrescritura. Revisar el estado confirmado antes de volver a registrar manualmente una operación tras recargar.
3. Las pruebas de compilación nativa Android y Qt no se ejecutaron. Sí se verificaron el lanzador Qt/servidor, las páginas activas, la construcción del paquete web Android incluida en la suite y sus recursos locales. Android independiente continúa sin presentarse como SQLite autenticado nativo.
4. Siguen pendientes las actuaciones administrativas de fase 1: exposición en historial, revocaciones/rotaciones que correspondan y verificación del cifrado del soporte. Esta fase no las ejecuta ni modifica el historial.
5. Las pruebas automatizadas y la revisión de capturas no certifican todos los navegadores ni todas las condiciones de red posibles.

## Comandos utilizados y reproducción

Desde la raíz del proyecto:

```powershell
node --test tests/*.test.cjs
node test_shared.js
node test_dates.js
git diff --check
git ls-files -- database/backups
```

Para las verificaciones de navegador se prepararon herramientas de prueba aisladas, sin agregarlas a las dependencias de la aplicación:

```powershell
npm install --prefix tmp/phase2-tools --no-package-lock --ignore-scripts playwright
$env:PLAYWRIGHT_MODULE = (Join-Path (Get-Location) 'tmp/phase2-tools/node_modules/playwright')
$env:PLAYWRIGHT_BROWSERS_PATH = (Join-Path (Get-Location) 'tmp/phase2-tools/browsers')
node tmp/phase2-tools/node_modules/playwright/cli.js install chromium
node tests/personal-flows.browser.cjs
node tests/phase2-regression.browser.cjs
node tests/account-access.browser.cjs
npm run test:browser
node tests/adaptive-entry.browser.cjs
node tests/sqlite.browser.cjs
node tests/backup-controls.browser.cjs
```

Los servidores usados por esas pruebas son locales y utilizan las bases temporales que crean sus fixtures. Se ejecutaron con permisos para acceder a localhost. No requieren iniciar `npm start` ni abrir la base financiera real.

## Recomendaciones para la fase 3

Sin comenzar esa fase: automatizar la matriz completa en CI con fixtures sintéticos y versiones controladas de herramientas de prueba; ampliar pruebas de concurrencia y de accesibilidad de los avisos; decidir, solo con autorización y un modelo de privacidad explícito, si se necesita recuperación durable de borradores. Mantener separadas las actuaciones administrativas de saneamiento del historial y custodia del cifrado.

## Estado final de la fase

**Fase 2 implementada y verificada.** Los tres fallos iniciales están resueltos, se añadieron regresiones y todas las suites ejecutadas aprobaron. Se conservaron el diseño de UX/UI, los formularios y funcionalidades existentes, los datos financieros reales y las medidas de seguridad de fase 1. No se habilitó el restablecimiento retirado de la interfaz. No se hicieron commit, push, despliegue ni reescritura de historial, y no se comenzó la fase 3.
