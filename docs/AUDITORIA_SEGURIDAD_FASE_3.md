# Auditoría de seguridad — fase 3

Fecha: 26 de noviembre de 2026. Proyecto MiBolsillo. Referencia Git: `8734939`.

La implementación y las comprobaciones locales de esta fase están completadas. No se realizaron commit, push, despliegue, reescritura del historial, rotación de cuentas reales, cifrado ni migraciones sobre la base de uso real. No se inició la fase 4. Los riesgos y tareas operativas pendientes se distinguen abajo; este informe no certifica que la aplicación sea completamente segura.

## Estado inicial y alcance

Se consultaron `AGENTS.md`, las auditorías de fases 1 y 2 y la política de datos privados. La referencia se reprodujo antes de editar: **118 pruebas aprobadas, cero fallidas**, más `test_shared.js` y `test_dates.js` aprobados. Registro: `tmp/security-phase3/baseline.log`.

Se revisaron las entradas `index.html`, `desktop.html` y `mobile.html`, los controladores activos, dominios compartidos, facturación, exportaciones, persistencia SQLite/navegador, API, sesiones, validadores, respaldos, arranque Qt, configuración Capacitor/Android, dependencias, configuración de entorno e índice e historial Git. `legacy/` y `qt_app/` se evaluaron como implementaciones independientes; no se cargaron módulos archivados en las páginas activas. Las consultas SQL dinámicas de vistas usan listas constantes; las entradas externas se enlazan mediante parámetros. Los ejecutables locales se lanzan con argumentos separados, sin una shell alimentada por la API.

Todas las pruebas usan cuentas ficticias y bases aisladas en `tmp/`. La revisión de blobs históricos se hizo en memoria, con salida limitada a tipos y cantidades. No se usaron datos reales como fixtures ni se atacaron sistemas externos. El único acceso externo de auditoría fue la consulta de referencias técnicas y del registro de avisos de dependencias.

## Modelo de amenazas

| Elemento | Evaluación |
|---|---|
| Activos | Finanzas personales y empresariales, identidad, hashes y sales, sesiones y CSRF, SQLite/WAL/SHM, respaldos, exportaciones y borradores en memoria. |
| Entradas | Registro/login, cookies y encabezados, API de estado y respaldos, archivos importados, nombres y descripciones renderizados/exportados, recursos estáticos, variables administrativas y lanzadores nativos. |
| Límites | Navegador → API; sesión → estado de una cuenta; Personal → Mi Negocio; proxy TLS → servidor loopback; servidor → archivos privados; árbol Git actual → historial/clones; WebView → almacenamiento del sistema. |
| Actores | Cliente sin sesión, usuario A intentando operar sobre B, sesión robada, cliente autenticado que omite la UI, abuso de recursos y persona con acceso a repositorio/soporte. |
| Escenarios prioritarios | Selección de dueño por cuerpo/query; cambio de rol por estado completo; reutilización de operaciones; JSON inválido; fuerza bruta; robo de copia y adivinación offline; XSS/CSV; CSRF; alias de archivos; encabezados de proxy falsificados. |
| Fuera de garantía | Equipo comprometido, administrador del sistema, extensiones del navegador, clones ajenos y operación efectiva del hosting. La API no protege SQLite frente al propietario del sistema operativo. |

La unidad de aislamiento del contrato actual es **una cuenta autenticada y su agregado completo**. No hay un espacio empresarial compartido por varias cuentas. Los permisos empresariales existentes ahora limitan escrituras en el servidor, pero el GET del agregado sigue entregando todos los negocios de su propia cuenta; no representa aislamiento de lectura entre empleados. No compartir una cuenta para implantar ese modelo.

## Hallazgos y decisiones

No se confirmó una vulnerabilidad crítica en el alcance local. La gravedad considera el impacto y el uso actual; una exposición pública puede cambiarla.

| ID | Gravedad / naturaleza | Causa y evidencia | Resultado |
|---|---|---|---|
| F3-01 | Alta, confirmada | La escritura del agregado aceptaba cambios de `usuario.facturacionRol` y propiedades de propietario en registros. Se reprodujo con HTTP 200 en una base ficticia. Los controles empresariales estaban principalmente en servicios del cliente. | Corregido: perfil con campos editables explícitos, metadatos de seguridad inmutables desde la API, autorización transaccional, rol LECTOR y negocios permitidos comprobados en backend, incluidos traslados y borrados anidados. No se confirmó lectura entre cuentas. |
| F3-02 | Media, confirmada | Una petición directa con `stock: null` era aceptada. Había tipos opcionales, campos raíz y referencias entre dominios insuficientemente restringidos. | Corregido: validación centralizada adicional de tipos, indicadores, moneda, textos, campos raíz y referencias Personal/Negocio. Se mantienen esquemas y cálculos compartidos y compatibilidad con registros históricos sin cambios. |
| F3-03 | Alta, exposición histórica confirmada | Tres JSON y una instantánea SQLite siguen en commits `e21d92c` y `3d5f965`. La instantánea contiene tres cuentas/estados y dos sesiones. | **Pendiente**: el árbol actual está protegido. Plan separado de contención, credenciales y saneamiento; no se ejecutó reescritura ni revocación real. No se determinó el alcance de descargas externas. |
| F3-04 | Media, riesgo potencial | Límite previo centrado en identidad y techo global alto: distribuir identidades podía consumir Argon2 y recursos. | Mitigado: cuotas combinadas de origen, identidad normalizada, proceso y cuenta, contadores acotados/temporales, concurrencia Argon2 conservada y límites de cuerpos, cabeceras, conexiones y tiempos. Los límites son por proceso y requieren coordinación si se escala a varios procesos. |
| F3-05 | Media, riesgo potencial | HTTP LAN y cookie sin Secure si se publica la configuración local; no había contrato TLS/proxy verificado por el servidor. | Mitigado mediante un modo producción que exige autenticación, origen HTTPS, loopback y proxy autorizado; Secure y HSTS solo en ese modo. **TLS real y hosting pendientes**, sin despliegue. El modo desarrollo/LAN continúa requiriendo precaución administrativa. |
| F3-06 | Media, riesgo potencial | Sesiones de 30 días, sin inactividad persistida ni servicio de cambio de credencial con revocación. | Nuevas sesiones de 12 h, inactividad de 30 min, rotación al autenticar, máximo de sesiones y cambio de contraseña transaccional con revocación. Sesiones antiguas mantienen su vencimiento absoluto; no se revocaron en masa. |
| F3-07 | Media, riesgo potencial | La confirmación de un reintento dependía de la revisión vigente; no había comprobante persistido que vinculase contenido e identidad. | Prevención adicional: recibos SQLite por cuenta y huella del cuerpo, confirmados con el estado. Mismo ID con otro contenido o revisión posterior devuelve 409; no reaplica ni rebasa operaciones. |
| F3-08 | Baja, confirmada en rutas de error | Se imprimían objetos/mensajes técnicos que podían incluir rutas o detalles de una excepción; faltaban correlación y auditoría estructurada. | Corregido: errores externos genéricos, referencia por solicitud, consola saneada y eventos privados con vocabulario cerrado. Retención y fallo de auditoría comprobados. No se confirmó una fuga previa de contraseñas en logs. |
| F3-09 | Baja, preventiva | CSP de fase 1 cubría principalmente framing; CSV no contemplaba todos los prefijos de espacios/controles. | CSP compatible ampliada y CSV reforzado; XSS almacenado comprobado en ambas interfaces. `unsafe-inline` continúa necesario para handlers existentes: CSP no elimina por sí sola el riesgo XSS. |
| F3-10 | Baja, residual confirmada | El registro duplicado devuelve 409 y un mensaje distinto. | El hash se calcula también para duplicados, pero **permanece enumeración por respuesta** para conservar el flujo actual. Registro/verificación de correo uniforme queda pendiente de diseño autorizado. Login inexistente/contraseña incorrecta sí responden igual. |
| F3-11 | Media, residual | Datos y copias sin cifrado de aplicación; APK actual sin backend SQLite/cuentas nativo y con backup de Android habilitado. | Evaluación de cifrado y custodia actualizada; no se alteraron formatos ni integraciones nativas. No se afirma cifrado, seguridad de un APK distribuido ni equivalencia nativa SQLite. |
| F3-12 | Media, literal confirmada / uso real no confirmado | `qt_app/include/data/DatabaseManager.h` tenía una contraseña predeterminada literal para MySQL. Este conector no se compila ni se usa en el lanzador actual. | Retirada del código: ahora lee `MIBOLSILLO_MYSQL_PASSWORD` del entorno sin fallback. Si el valor histórico se usó en una base real, rotarlo en su emisor y ampliar el saneamiento al blob afectado. No se imprimió ni se rotó automáticamente. |

## Autenticación, contraseñas y sesiones

Se conserva Argon2id nativo: **64 MiB, tres pasadas, paralelismo 1, salida de 32 bytes y sal aleatoria de 32 bytes por hash**. Máximo de cuatro derivaciones simultáneas; las verificaciones comparan buffers con `timingSafeEqual`. Las frases de 8 a 128 caracteres se conservan completas, incluidas Unicode y espacios. No se usa SHA-256 para contraseñas: SHA-256 se limita a hashes de tokens aleatorios, huellas de operaciones y checksums. El esquema activo solo admite Argon2id; no se encontraron cuentas activas con un algoritmo anterior que migrar. Los prototipos MySQL/QML no se convirtieron.

Se mantienen normalización de email y UNIQUE sin distinción de mayúsculas; correos/nombres/longitudes se validan también en servidor. Argon2 se vuelve a contrastar con la credencial vigente dentro de la transacción, evitando autenticar con un hash cambiado durante el cálculo. Respuestas y logs no incluyen contraseña, sal ni hash. No existe recuperación por correo; no se inventó un restablecimiento sin verificar al titular. La política mínima existente de ocho caracteres se conserva por compatibilidad; una política más fuerte sin MFA y una comprobación de contraseñas comprometidas requieren una revisión posterior.

La cookie contiene 256 bits aleatorios; solo se persiste su hash. Se mantiene HttpOnly, SameSite=Strict, Path=/ y sin Domain. `Secure` se exige en producción; local HTTP necesita la cookie local compatible. El token CSRF se entrega únicamente a la sesión que lo necesita, nunca por URL. Login/registro válidos reemplazan la sesión del navegador; logout la borra. `POST /api/auth/password` verifica contraseña actual y sesión vigente, cambia el hash con sal nueva, revoca las sesiones de la cuenta y crea otra dentro de la misma transacción. No agrega pantalla ni modifica credenciales reales durante esta auditoría.

La inactividad se persiste en una tabla aditiva; se actualiza de forma acotada. Sesiones anteriores sin actividad registrada empiezan ese control en su primer uso válido, sin renovar su expiración absoluta. El máximo por defecto es 50 sesiones. No se garantiza revocación histórica por el mero cambio del código: aplicar el plan de incidente cuando corresponda.

Los borradores de fase 2 permanecen exclusivamente en memoria durante 15 minutos, ligados a la misma cuenta; no se trasladaron a almacenamiento persistente. Se comprobaron expiración, cambio A/B, recarga y reintentos con respuesta perdida. Una escritura SQLite fallida sigue bloqueando la publicación en memoria y no habilita un fallback silencioso.

## Autorización y contrato de la API

Todas las lecturas/escrituras de usuarios se ejecutan con el `user_id` obtenido de la sesión. El cuerpo y los selectores de propietario no eligen el espacio. Un encabezado de cuenta discordante invalida la petición; es una protección de pantalla antigua, no una prueba de autorización. El servidor protege cambios a roles, permisos, IDs de dueño, tokens y credenciales dentro del estado. Los permisos preexistentes deben ser revisados administrativamente si hubo exposición: conservar un valor antiguo no demuestra que su asignación histórica fuera legítima.

| Ruta | Acceso y controles |
|---|---|
| `GET /api/app-info` | Público, solo información del servicio y huella opaca para el lanzador; no ruta ni finanzas. |
| `POST /api/auth/register`, `/login` | JSON limitado a 16 KiB, campos explícitos, validación y cuotas de autenticación combinadas. |
| `GET /api/auth/session` | Devuelve identidad pública y CSRF de la sesión válida, o 401. |
| `POST /api/auth/logout`, `/password` | Sesión, origen y CSRF; password añade validación, cuota y verificación de contraseña actual. |
| `GET /api/auth/legacy-status`, `/api/config`, `/api/sqlite-bootstrap.js` | Requieren sesión en el modo normal. El estado legado no se asigna automáticamente a una cuenta. |
| `GET /api/storage` | Solo agregado de la cuenta; únicamente acepta el selector de revisión. Los reportes/exportaciones del cliente derivan de ese agregado, sin endpoint de consulta ajena. |
| `POST /api/storage` | Contrato anterior conservado: sesión, CSRF, JSON, campos admitidos, validación y comparación transaccional del estado anterior. |
| `PATCH /api/storage` | Lo anterior más operaciones/path seguros, revisión y recibo vinculado a cuenta/contenido; 409 no rebasa ni duplica la escritura. |
| `GET /api/backups`, `/api/backups/:id` | Lista/descarga exclusivamente dentro de la carpeta de la cuenta. No descarga las instantáneas completas. IDs estrictos y sin rutas arbitrarias. |
| `POST /api/backups` | Sesión, CSRF y cuotas de escritura/respaldos. No recibe estado financiero del cliente. |
| `POST /api/backups/restore` | JSON, CSRF, campos explícitos, identidad de copia, checksum, confirmación, revisión actual y validación estricta. Preserva identidad y privilegios actuales, crea copia de seguridad y confirma SQLite. |

Se conservan CAS, ROLLBACK, separación de dominios y validadores financieros compartidos; no se modifican cálculos monetarios. Entradas nuevas con null en importes, infinito, fecha imposible, booleano incorrecto, IDs repetidos, referencias cruzadas o propiedades reservadas se rechazan antes del COMMIT. Campos históricos sin cambios siguen legibles. El servidor rechaza `__proto__`, `prototype` y `constructor`, limita profundidad a 45 y el estado a 32 MiB por defecto; cuerpo HTTP máximo 20 MiB. Estos techos administrativos pueden necesitar dimensionamiento para cuentas grandes; no se aplicó una reducción de datos existentes.

## HTTP, producción y recursos

Por defecto se sigue escuchando en loopback para uso local. Para **preparar** producción sin modificar infraestructura:

```dotenv
MIBOLSILLO_ENV=production
MIBOLSILLO_HOST=127.0.0.1
MIBOLSILLO_PUBLIC_ORIGIN=https://mibolsillo.example.test
MIBOLSILLO_TRUSTED_PROXIES=127.0.0.1,::1,::ffff:127.0.0.1
```

Sustituir el dominio ficticio, elegir una ruta privada de datos distinta de desarrollo y proporcionar TLS válido en el proxy de la misma máquina. Conservar Host público y reemplazar `X-Forwarded-Proto` por `https` y `X-Forwarded-For` por **una sola IP verificada**, sin aceptar la cadena enviada por el cliente. La aplicación no acepta cadenas XFF ni proxies distintos de los configurados; fuera de producción ignora los encabezados reenviados. No abrir el puerto backend a Internet. No se instaló ni configuró un proxy real.

Producción se rechaza antes de abrir SQLite si falta autenticación, origen HTTPS o escucha loopback. Secure y HSTS (un año, sin preload ni includeSubDomains) aparecen solo tras validar ese canal. Verificar certificados, renovación, firewall, límites del proxy, retención de sus logs y recuperación antes de desplegar; no incluir cuerpos, cookies ni query con secretos en registros del hosting.

No se habilita CORS comodín. Se conservan comprobación de Origin/Fetch-Site, no-store, nosniff, Referrer-Policy, SAMEORIGIN y lista canónica de recursos públicos. CSP limita scripts/conexiones/frames al origen, objetos a ninguno, base y formularios al origen; estilos/fuentes mantienen los proveedores ya usados. `unsafe-inline` es una limitación explícita. Permissions-Policy desactiva cámara, micrófono, geolocalización y pagos no usados. El iframe adaptable del mismo origen continúa funcionando.

Cuotas por defecto: API pública 600/min/origen; autenticación 60/5 min/origen, 12/5 min/identidad y 1000/5 min/proceso; cuenta 1800/min, escrituras 600/min y creación/restauración de respaldos 60/5 min. Ventanas con vencimiento, respuesta 429/Retry-After y claves HMAC efímeras; no hay bloqueo permanente. Capacidad acotada y cuatro hashes concurrentes. Un proceso tiene máximo 128 conexiones, 1000 peticiones por socket, 16 KiB de cabeceras, 10 s para cabeceras, 30 s de request y 15 s para lectura JSON. La protección distribuida y las métricas de capacidad quedan para la operación futura; no se promete resistencia a una denegación de servicio volumétrica.

## Privacidad, cifrado, nativos y registros

Los 12 archivos del inventario de fase 2 bajo `database/` conservan existencia y SHA-256; también se contrastó la configuración privada Qt con el inventario de fase 1. No se abrió el servidor de pruebas con esos datos. Ningún respaldo/base/diario/secreto de las categorías comprobadas está rastreado y las exclusiones siguen funcionando para archivos nuevos. Se revisaron 292 archivos rastreados; no hubo coincidencias en la búsqueda de claves privadas y formatos de tokens de alta confianza. Esto no prueba la ausencia de todo secreto ni de contraseñas de ejemplo en código histórico.

La ACL de respaldos en este equipo mantiene propietario, SYSTEM, administradores y lectura del grupo concreto del entorno Codex; no se encontraron concesiones genéricas Everyone/Users/Authenticated Users. No se modificaron ACL existentes. La protección POSIX `0600/0700`, WAL/SHM, rutas privadas y alias canónicos se conserva y vuelve a probar. Los modos numéricos de Node no garantizan ACL Windows.

Además del escaneo de formatos de tokens, se revisaron asignaciones de credenciales literales en los archivos rastreados. Se detectó y retiró la predeterminada del conector MySQL archivado (F3-12). El valor histórico permanece en Git; no se intentó conectarse con él ni verificarlo contra una base real. El lanzador CMake/qmake actual no incluye ese conector. Si se usa por separado, configurar la variable en el entorno del proceso Qt, nunca en el encabezado ni en una plantilla versionada. El prototipo QML independiente emplea PBKDF2-HMAC-SHA256 con sal y 210000 iteraciones, no SHA-256 directo; no es el sistema Argon2id de la web y su costo debe revisarse antes de reutilizarlo. No se migraron sus usuarios.

La evaluación de BitLocker, cifrado de copias, claves, migración, rendimiento y recuperación está en [la política de datos privados](SEGURIDAD_DATOS_PRIVADOS.md). No se activó cifrado ni se cambió de motor. Windows DPAPI y Android Keystore son alternativas futuras de custodia, no integraciones implementadas. Qt sigue usando el servidor local y la cookie de WebView; su IPC local de arranque conserva la ruta necesaria para el lanzador, sin publicarla en la API externa. No se compilaron binarios Qt ni APK en esta fase. Android/web estático siguen usando almacenamiento de navegador y no se describen como SQLite nativo.

La auditoría nueva guarda solamente fecha, tipo de evento, UUID de solicitud, estado HTTP, grupo de ruta y método. Nunca cuerpo, query, email, usuario, finanzas, token, cookie, contraseña, SQL o excepción original. Registra autenticación, logout, cambio de contraseña, escrituras y rechazos; la respuesta de error incluye el mismo UUID de `X-Request-Id`. La minimización impide reconstruir una historia nominal por usuario; es una limitación deliberada de privacidad.

Los archivos privados `security-audit/events.jsonl*`, junto a la base, rotan con umbral de 1 MiB y cinco archivos, vencimiento de siete días comprobado al escribir. Una entrada puede superar levemente el umbral; no hay tarea de borrado cuando el proceso está parado. Los recibos conservan hasta 5000 huellas por cuenta, sin cuerpos financieros. Si falla la auditoría, se emite un código fijo una vez y `getHealth()` informa el fallo: no se convierte un COMMIT confirmado en un error de guardado. Debe supervisarse ese diagnóstico al operar un servicio. Ambos directorios siguen fuera de HTTP/Git.

## Archivos y dependencias

Creado, cada uno con una responsabilidad de seguridad:

- `scripts/security-policy.cjs`: configuración, origen/proxy, comparación de tokens y campos admitidos.
- `scripts/rate-limiter.cjs`: cuotas temporales acotadas.
- `scripts/security-audit.cjs`: eventos minimizados, retención y salud local.
- `scripts/state-authorization.cjs`: autorización de estado y perfil restaurado.
- `scripts/storage-receipts.cjs`: comprobantes de idempotencia transaccional.
- `tests/security-hardening.test.cjs`, `tests/security.browser.cjs`: pruebas nuevas.
- Este informe y `docs/PLAN_RESPUESTA_EXPOSICION.md`.

Modificado:

- `.env.example`, `.gitignore`: modo de producción de ejemplo y logs privados excluidos.
- `scripts/auth-store.cjs`, `scripts/serve-sqlite.cjs`, `scripts/backup-store.cjs`, `scripts/financial-validation.cjs`: controles descritos arriba. Solo se agregan las tablas de metadatos `auth_session_activity` y `storage_receipts` al arrancar una base; no se reescriben sus estados financieros. Ese arranque **no se ejecutó sobre la base real**.
- `src/storage/localStorage.js`, `src/services/finanzasCore.js`: mensajes de consola sin excepciones originales.
- `src/ui/shared/backupControls.js`: encabezado de cuenta y aviso de sesión vencida para conservar el aislamiento de una pantalla antigua, sin cambios visuales.
- `src/utils/security.js`: neutralización CSV adicional.
- `qt_app/include/data/DatabaseManager.h`: contraseña literal sustituida por configuración de entorno en el conector archivado, sin conexión ni rotación real. La API de entorno se contrastó con [Qt](https://doc.qt.io/qt-6/qtenvironmentvariables.html).
- `tests/auth-server.test.cjs`, `tests/account-access.browser.cjs`: ahora exigen rechazo explícito de selectores/propietario, además de comprobar ambos estados. La prueba del techo global configura cuotas superiores solo en su fixture para seguir alcanzándolo; otra prueba verifica los límites bajos seguros.
- `tests/backup-store.test.cjs`: petición de restauración con su Content-Type JSON real.
- `tests/private-data.test.cjs`: exclusión adicional de auditoría privada.
- `tests/phase2-regression.browser.cjs`: timeout reducido solo durante el escenario de timeout simulado, conservando la comprobación de su código y reintento. Ya no acorta las escrituras normales, evitando carreras por carga.
- `docs/SEGURIDAD_DATOS_PRIVADOS.md`, `docs/CUENTAS_Y_MIGRACION.md`: política vigente y referencias, sin copiar los informes anteriores.

No se cambiaron HTML, CSS, diseños, tecnologías, dependencias de ejecución, manifiestos de paquetes ni archivos de bloqueo. Playwright existente bajo `tmp/phase2-tools/` se usó como herramienta de prueba sin agregarse al proyecto. `pnpm audit --json` reportó **101 dependencias, cero avisos**, antes y después. No se efectuaron actualizaciones forzadas. La ausencia de avisos no demuestra mantenimiento futuro ni ausencia de vulnerabilidades desconocidas; revisar periódicamente Capacitor, Chart.js y Node. No se incorporó una dependencia abandonada nueva.

## Pruebas y comparación final

| Comprobación | Inicial | Final |
|---|---|---|
| Suite `node --test tests/*.test.cjs` | 118/118 | **146/146**, cero fallos, omisiones o cancelaciones; 28 pruebas nuevas. |
| `node test_shared.js`, `node test_dates.js` | OK | OK. |
| Argon2, rotación/idle/revocación, A/B, rol, validación, cuotas, errores, recibos | Cobertura parcial | 28 casos nuevos con respuestas y estado SQLite; incluyen reinicio, expiración absoluta, sesión máxima, restore antiguo, borrado anidado y rechazo de permisos históricos inválidos. |
| Navegador personal | Referencia de fase 2 | Suite aprobada: escritorio, compacto y móvil, CRUD, fallos y recarga. |
| Navegador empresarial | Referencia de fase 2 | Las seis suites aprobadas: workspace, facturación, informes, inventario, medidas y gastos. Incluyen modos estáticos y pruebas SQLite según cada suite. |
| Cuentas / SQLite / respaldos / entrada adaptable | Referencia de fase 2 | Todas aprobadas; aislamiento, escritura real, reinicio, restore y navegación. |
| Recuperación fase 2 | Referencia de fase 2 | PC/móvil: 400/401/403/500/503, conexión/timeout/respuesta perdida, formularios A/B, 15 min, deuda archivada, reintentos personales/empresariales sin duplicados. |
| XSS en navegador | Revisión de escape existente | Nueva suite aprobada PC/móvil: perfil/bootstrap, movimientos, metas, deudas y producto; texto conservado tras recarga, sin ejecución ni secretos en local/sessionStorage. |
| Recursos privados | 68 rechazos de fase 1 | Prueba conservada, incluidos GET/HEAD con/sin sesión y junctions. |
| Integridad | Inventario SHA-256 al empezar | 12/12 archivos de `database/` intactos y disponibles; configuración privada Qt también intacta. |
| Encabezado MySQL archivado | Credencial literal | Sin literal y sintaxis aprobada con Qt 6.12/MinGW (`-fsyntax-only`), sin generar binarios ni conectar MySQL. |
| Git/dependencias | Protección fase 1 | Sin privados rastreados; nuevas exclusiones válidas; cero avisos de dependencias. |

Comandos de verificación, desde la raíz (Playwright/Chromium deben estar disponibles):

```powershell
node --test tests/*.test.cjs
node test_shared.js
node test_dates.js
npm run test:personal:browser
npm run test:browser
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

Evidencia local en `tmp/security-phase3/`: `baseline.log`, `unit-final.log`, `security-extra.log`, `shared-final.log`, `dates-final.log`, `personal-browser.log`, `business-browser.log`, `accounts-browser.log`, `sqlite-browser.log`, `backups-browser.log`, `adaptive-browser.log`, `phase2-browser.log`, `security-browser.log`, `qt-header-syntax.log` y `dependency-audit-final.json`. `security-extra.log` registra los 27 casos de una ejecución intermedia; `unit-final.log` incluye los 28 definitivos. El log de sintaxis Qt está vacío porque el compilador terminó correctamente sin diagnósticos. Los artefactos del navegador son sintéticos y están ignorados. Los nombres exactos de carpetas temporales se registran en cada log. `git diff --check` aprobó; las advertencias LF/CRLF son de la configuración Git del equipo.

No se eliminaron ni deshabilitaron pruebas. No se observaron regresiones en las suites ejecutadas. No se realizaron pruebas de carga de producción, TLS externo, dispositivos físicos, compilación Qt/Android ni pruebas exhaustivas de cada combinación de payload/renderizador.

## Pendientes, autorización y continuidad

1. Ejecutar únicamente con autorización el [plan de exposición histórica](PLAN_RESPUESTA_EXPOSICION.md): verificar remotos/clones, sesiones y cuentas afectadas, restablecimiento seguro, saneamiento coordinado y verificación de referencias. No se ejecutó ninguna revocación masiva ni force push.
2. Preparar y probar TLS/proxy, firewall, supervisión de fallos de auditoría y límites bajo carga antes de publicar; el modo producción es una comprobación de configuración, no un despliegue seguro ya realizado.
3. Revisar cifrado de volumen, soportes externos y ACL al copiar datos; aprobar por separado cualquier migración cifrada y ensayar recuperación con custodia de claves.
4. Resolver con diseño autorizado enumeración de registro, verificación de email, recuperación de contraseña, política de contraseña y eventual MFA. No se ocultan estas limitaciones tras un resultado verde de pruebas.
5. Sustituir handlers inline si se aprueba una CSP estricta en otra fase. Para usuarios empresariales compartidos hacen falta proyecciones de lectura y permisos por recurso: el agregado de una cuenta sigue siendo privado a esa cuenta completa.
6. Integrar almacenamiento/custodia nativos y probar Qt/Android en sus dispositivos antes de ofrecer garantías equivalentes. No copiar tokens a preferencias/localStorage.

Para fase 4 se recomienda conservar estos contratos y pruebas, y separar la reorganización general del código de futuros cambios de permisos. Es una recomendación; **no se inició esa fase**. Cambios de esta fase quedan en el árbol de trabajo para revisión, sin commit ni publicación.

## Referencias técnicas

La revisión toma controles concretos como referencia, sin atribuir una certificación ASVS: [OWASP ASVS](https://asvs.owasp.org/), [Top 10 2025](https://top10.owasp.org/2025/) y [API3: autorización de propiedades](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/). Corresponden principalmente a control de acceso, autenticación, validación, consumo de recursos y registros.

Los criterios de contraseñas, sesiones y errores se contrastaron con [Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) y [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). La minimización de eventos y la exportación se contrastaron con [Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) y [CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection). Las medidas locales implementadas y las limitaciones explícitas anteriores son la evidencia de esta fase.
