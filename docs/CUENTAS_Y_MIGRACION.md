# Cuentas, datos por usuario y migración

MiBolsillo sigue utilizando los HTML, estilos y módulos financieros del proyecto. La entrada `index.html` muestra Iniciar sesión / Crear cuenta y, con una sesión válida, abre un único documento financiero. El diseño cambia por ancho con CSS, sin recargar el documento, cambiar de cuenta ni reconstruir formularios. Ya no existe una selección PC/celular, ni una preferencia de plataforma.

## Ejecutar

Desde la raíz, con Node.js 24.22 o posterior y las dependencias del proyecto instaladas:

```powershell
npm start
```

Abra `http://127.0.0.1:5500/`. También puede ejecutar el destino **GestorFinanciero** desde `qt_app/CMakeLists.txt` en Qt Creator, con **Desktop Qt 6.12.0 MinGW 64-bit**. Qt mantiene el servidor local y abre la aplicación HTML en una ventana del navegador. Mantenga su ventana de servicio abierta. Después de actualizar, cierre normalmente el servidor anterior y vuelva a ejecutar; el lanzador rechaza reutilizar un servidor antiguo sin autenticación.

Cree su cuenta con nombre, correo y contraseña de 8 a 128 caracteres. Los correos son únicos sin distinguir mayúsculas. Las cuentas nuevas comienzan sin movimientos, saldos, presupuestos, metas ni inventario de demostración. Mi Negocio tiene un espacio vacío para empezar a registrar las operaciones. Cerrar sesión desde Perfil vuelve al acceso sin borrar datos.

Las páginas directas `desktop.html` y `mobile.html` también exigen sesión. Un servidor estático, Live Server o `file://` no implementan la API de acceso: no permiten utilizar la información financiera protegida. Se conservan los datos anteriores del navegador, pero ya no se importan automáticamente a una cuenta.

## Seguridad y almacenamiento

- Base local: `database/mibolsillo.sqlite`. No hay sincronización entre equipos o teléfonos.
- `auth_users`: identidad de acceso y contraseñas Argon2id con sal aleatoria de 32 bytes, 64 MiB de memoria y tres pasadas, mediante la biblioteca nativa `node:crypto` de Node 24.22. Nunca se envían hashes ni contraseñas en las respuestas de la API.
- `auth_sessions`: identificadores aleatorios de sesión conservados como hashes, vencimiento de 30 días y protección CSRF por sesión. La cookie es HttpOnly y SameSite=Strict. Cerrar sesión revoca la sesión de la base.
- `user_states`: estado completo de TODOS los módulos por `user_id`. Las lecturas y escrituras se autorizan con la sesión del servidor; los IDs enviados por el cliente no eligen a otro propietario. Se mantiene la comparación de versión y el commit transaccional antes de confirmar un guardado.
- Las pantallas viejas de otra cuenta se invalidan al cambiar de sesión; la sincronización entre pestañas usa un canal por usuario. Las restauraciones de páginas desde la caché del navegador vuelven a validar la sesión antes de mostrarse.
- `app_state` y las vistas `vista_*` anteriores se conservan como archivo sin propietario asignado. Las vistas históricas no representan los estados nuevos de los usuarios; para inspeccionar datos actuales en DB Browser consulte `user_states.raw` junto con `auth_users.id`.

El servidor está pensado para acceso local por loopback. No es un servicio público de Internet: no se ha configurado HTTPS, verificación de correo ni recuperación de contraseña por correo. No publique el servidor ni exponga su puerto sin preparar esos componentes.

## Migración automática del esquema

Al iniciar el servidor actualizado se agregan las tablas de cuentas, sesiones y estados por usuario, y la versión SQLite pasa a 2. Si existe información en `app_state`, primero se genera un respaldo SQLite consistente llamado `database/respaldo-antes-cuentas-*.sqlite`, incluso si la base usaba WAL. El registro anterior permanece intacto y ninguna cuenta nueva lo recibe automáticamente, aunque el correo coincida.

No hay contraseñas previas de la aplicación web que convertir. Las bases MySQL históricas y el prototipo QML independiente no se abren ni se migran a escondidas.

## Asignar datos antiguos después de verificar el propietario

**No se ha ejecutado esta asignación sobre sus datos reales.** Primero verifique quién es el titular y cree su cuenta. Cierre la app y el servidor antes de migrar. El correo del perfil anterior debe coincidir con el de la cuenta destinataria; un correo ausente o distinto se rechaza, porque no identifica al propietario.

Comprobar sin cambiar datos:

```powershell
node scripts/migrate-account-data.cjs --db database/mibolsillo.sqlite --email titular@ejemplo.com
```

Después de verificar la propiedad, aplicar explícitamente:

```powershell
node scripts/migrate-account-data.cjs --db database/mibolsillo.sqlite --email titular@ejemplo.com --apply --confirm-owner titular@ejemplo.com
```

Para una copia JSON exportada del almacenamiento anterior, añada `--source C:\ruta\copia.json`. Se mantiene el archivo de origen. La migración crea otro respaldo consistente, copia el estado completo dentro de una transacción y registra su huella para evitar una segunda importación. Rechaza IDs duplicados y cuentas que ya contengan operaciones, negocios personalizados o registros de facturación/bitácora. No mezcla ni reemplaza información de una cuenta usada.

Si no se puede identificar al dueño por el perfil anterior, conserve el respaldo y resuelva la titularidad antes de asignar registros. No edite el correo de una copia para eludir esta comprobación. Tras importar, inicie el servidor, entre con la cuenta y compruebe ambos modos y sus totales.

## Verificaciones y límites

Las pruebas usan cuentas, perfiles de navegador y bases temporales. Incluyen registro, duplicados, contraseña incorrecta, sesiones tras reiniciar, bloqueo de páginas/API privadas, aislamiento A/B, CSRF, edición/eliminación de movimientos con confirmación en disco, errores de escritura y migración sin asignación automática. La interfaz se prueba ancha, estrecha y en giro simulado, manteniendo el mismo documento y el texto del formulario.

```powershell
node --test tests/*.test.cjs
node test_shared.js
node test_dates.js
npm run test:accounts:browser
npm run test:adaptive:browser
npm run test:browser
npm run test:sqlite:browser
```

Los scripts de navegador requieren Playwright y Chrome; admiten `PLAYWRIGHT_MODULE` y `PLAYWRIGHT_CHROME`.

Android: las distribuciones móviles se verifican en Chrome con el mismo servidor local. El proyecto Capacitor conserva las fuentes, pero no incluye un backend de cuentas/SQLite nativo. Su APK independiente aún requiere esa integración y un entorno SDK/JDK para compilar y probar. Sin API de acceso, muestra un error de conexión y no carga finanzas privadas mediante un almacenamiento alternativo. No se ha instalado ni probado en un teléfono.

Referencia: [Argon2 en Node 24.22](https://nodejs.org/download/release/v24.22.1/docs/api/crypto.html#cryptoargon2algorithm-parameters-callback).

## Archivos principales de esta revisión y resultados

- Entrada y distribución: `index.html`, `desktop.html`, `mobile.html`, `src/ui/shared/adaptiveEntry.js`, `styles/responsive.css` y `qt_app/qml/WebLauncher.qml` (sin botones de elección de plataforma).
- Acceso: `scripts/auth-store.cjs`, `scripts/serve-sqlite.cjs`, `src/ui/shared/authGuard.js`, `accountAccess.js`, `accountSession.js` y `styles/account-access.css`.
- Persistencia y movimiento editable: `src/storage/sqliteBackend.js`, `src/storage/localStorage.js`, `src/storage/demoData.js`, `src/services/finanzasCore.js`, `src/ui/shared/personalMovementEditor.js` y los controladores activos `src/utils/desktop.js` y `src/utils/mobile.js`.
- Arranque y migración: `scripts/desktop-runtime.cjs`, `scripts/migrate-account-data.cjs`, `package.json` y las guías README/SQLite/Android/estructura. El empaquetador Android existente incluye los recursos compartidos a partir de las referencias de las tres entradas HTML.
- Pruebas nuevas o actualizadas: cuentas HTTP, migración de propietario, edición personal, integración de cuentas en navegador, adaptación sin recarga, empaquetado Android y las suites de regresión SQLite/negocio/facturación/informes.

Resultados reales: 72/72 pruebas Node aprobadas; `test_shared.js` y `test_dates.js` aprobados. Registro/inicio/cierre de sesión, contraseña incorrecta, duplicados, aislamiento A/B y crear/editar/eliminar después de cerrar el contexto y reiniciar servidor+SQLite aprobados en Chrome a 1366 y 390 px. La prueba adaptable conserva el mismo documento y controlador y un formulario abierto a 1366, 390, 844×390 y 320 px; también confirma un producto empresarial en la base de la cuenta y después de recargar. Las suites empresariales y de informes aprobaron 14 combinaciones cada una, con formularios, pagos, producción, exportaciones y errores de guardado. Facturación y SQLite también aprobaron sus regresiones.

Qt: compilación Windows aprobada en `qt_app/build/accounts/GestorFinanciero.exe`; CTest del lanzador aprobado con HTTP y SQLite temporales. Recursos Android sincronizados; no APK, instalación ni prueba en dispositivo por los componentes y backend pendientes indicados arriba.

Registros principales: `tmp/qt/accounts-node-verified.log`, `accounts-access-verified.log`, `accounts-responsive-verified.log`, `accounts-business-complete.log`, `accounts-reports-browser.log`, `accounts-invoicing-browser.log`, `accounts-sqlite-browser.log`, `accounts-build.log` y `accounts-ctest.log`. Todas estas pruebas usaron datos temporales. No se ejecutó la asignación de datos financieros anteriores a una cuenta real, no se publicó la app y no se realizó git push.
