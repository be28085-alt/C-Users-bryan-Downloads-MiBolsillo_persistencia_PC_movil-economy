# MiBolsillo

Aplicación de Finanzas Personales y Mi Negocio con acceso por cuenta y SQLite local. Comparte reglas y datos entre sus distribuciones de PC y móvil. La entrada se adapta al ancho sin selector de plataforma ni recargas al redimensionar. Cada usuario tiene su propio estado persistente; consulte [Cuentas y migración](docs/CUENTAS_Y_MIGRACION.md).

## Abrir la aplicación

Para guardar en SQLite, instale Node.js 24.22 o posterior, instale las dependencias del proyecto y ejecute desde la raíz:

```sh
npm start
```

Abra [MiBolsillo adaptable](http://127.0.0.1:5500/), que utiliza las pantallas originales según el ancho, o las entradas directas [PC](http://127.0.0.1:5500/desktop.html) y [móvil](http://127.0.0.1:5500/mobile.html). `npm run start:sqlite` inicia el mismo servidor. La información se guarda en `database/mibolsillo.sqlite`, compartida por ambas interfaces, y puede inspeccionarse en DB Browser for SQLite. Mantenga el servidor funcionando durante el uso. Consulte [la guía de SQLite](docs/SQLITE.md) para migrar datos, consultar la base y crear respaldos.

Al abrir aparece Iniciar sesión / Crear cuenta; una sesión válida entra directamente. Live Server, un servidor estático y `file://` no proporcionan la API de cuentas y no permiten cargar las finanzas privadas. Los datos antiguos del navegador se conservan, pero se deben migrar después de identificar al propietario.

No hay sincronización con la nube ni entre dispositivos. El paquete Android independiente aún requiere integrar acceso/SQLite nativo o una API segura; no se presenta como listo para utilizar cuentas sin un backend. Desde el perfil puede cerrar sesión y cambiar sus preferencias; se retiró el apartado de gestión y respaldo. Ante un error de persistencia, conserve la pestaña y use las opciones de recuperación del aviso de guardado.

## Dónde está cada cosa

| Ruta | Contenido |
|---|---|
| `index.html`, `desktop.html`, `mobile.html` | Entrada adaptable e interfaces web activas completas |
| `src/utils/desktop.js`, `src/utils/mobile.js` | Controladores activos de PC y móvil |
| `src/domains/` | Reglas personales, empresariales y de usuario |
| `src/services/`, `src/storage/` | Coordinación financiera, exportaciones y persistencia |
| `src/invoicing/` | Facturación simulada y exportación de documentos |
| `src/ui/`, `styles/` | Vistas compartidas, avisos y estilos de las interfaces |
| `android/`, `capacitor.config.json` | Proyecto Android de desarrollo y configuración de Capacitor |
| `scripts/build-android-web.cjs` | Empaqueta las entradas activas para Android en `dist/android-web/` |
| `scripts/serve-sqlite.cjs` | Servidor local y persistencia transaccional en SQLite |
| `database/mibolsillo.sqlite` | Base local generada al iniciar el servidor; datos privados, excluidos de Git |
| `tests/`, `test_shared.js`, `test_dates.js` | Pruebas automatizadas; `test_shared.js` conserva cobertura del núcleo histórico |
| `docs/` | Guías actuales; las revisiones anteriores están en `docs/historial/` |
| `legacy/web/` | Implementaciones web anteriores y puentes CSS, conservados sin cargarlos en las páginas activas |
| `legacy/modular/` | Módulos y estilos alternativos que las páginas actuales no cargan |
| `legacy/console/` | Dos programas C++ independientes, conservados completos |
| `qt_app/` | Lanzador Qt de la aplicación HTML completa; conserva el prototipo QML independiente como opción |
| `database/gestor_financiero.sql` | Esquema MySQL histórico independiente y conservado |
| `tmp/` | Capturas y exportaciones generadas por las pruebas de navegador; ignoradas por Git |

El orden de carga de los scripts está declarado en cada HTML. Mantenga las funciones equivalentes en PC y móvil y la separación de Finanzas Personales y Mi Negocio. Las nuevas correcciones de la web deben realizarse en los archivos activos de `src/`.

## Verificar cambios

Desde la raíz, con Node.js y las dependencias del proyecto instaladas (por ejemplo, `pnpm install --frozen-lockfile`):

```sh
node --test tests/*.test.cjs
node test_shared.js
node test_dates.js
```

`npm test` ejecuta los mismos comandos. Para verificar los flujos reales de PC y móvil con Playwright disponible:

```sh
npm run test:browser
npm run test:personal:browser
```

Las pruebas de navegador admiten `PLAYWRIGHT_MODULE` para localizar Playwright y `PLAYWRIGHT_CHROME` para indicar el ejecutable del navegador. Generan sus resultados en `tmp/`.

La regresión personal comprueba los formularios de movimientos, metas, aportes, deudas, abonos, presupuesto y perfil en PC y móvil. Simula errores de escritura, conserva los campos para reintentar y comprueba SQLite después de recargar y reiniciar el servidor. Los resúmenes de ingresos, gastos y presupuesto usan el mes seleccionado; el saldo disponible conserva todos los movimientos. El correo editado en Perfil pasa a ser el correo de inicio de sesión después de confirmar el guardado.

## Alcance y documentación

Mi Negocio incluye inventario, ventas, compras, contactos, cartera, gastos, empleados, producción, informes y facturación simulada. Los PDF y XML de facturación son de simulación; la integración DIAN, autenticación remota, sincronización entre equipos y nómina legal requieren trabajo adicional.

- [Estructura y responsabilidades del código](docs/ESTRUCTURA.md)
- [Guía de uso de Mi Negocio](docs/GUIA_MI_NEGOCIO.md)
- [Proyecto Android y preparación para Google Play](docs/ANDROID.md)
- [Uso de SQLite y DB Browser](docs/SQLITE.md)
- [Acceso, aislamiento por usuario y migración con respaldo](docs/CUENTAS_Y_MIGRACION.md)
- [Plan de almacenamiento local y en la nube](docs/ALMACENAMIENTO_LOCAL_Y_NUBE.md)
- [Registro de la limpieza y archivos conservados](docs/AUDITORIA_LIMPIEZA.md)
- [Auditoría de Mi Negocio y reglas de persistencia](docs/MI_NEGOCIO_AUDITORIA.md)
- [Alcance, reglas y límites de la facturación simulada](docs/FACTURACION_SIMULADA.md)
- Historial: [documentación técnica](docs/historial/Documentation.md), [informe académico](docs/historial/INFORME_ACADEMICO.md), [corrección de navegación](docs/historial/CORRECCION_NAVEGACION_NEGOCIO.md) y [README anterior](docs/historial/README_ANTERIOR.md).

El destino predeterminado de Qt inicia esta misma aplicación HTML completa, con su servidor y su base SQLite original, y la abre en una ventana de aplicación de Edge o Chrome. Es un lanzador, no un WebView incrustado. Abra `qt_app/CMakeLists.txt` en Qt Creator y consulte [la guía de Qt y HTML](qt_app/README.md). El prototipo QML reducido queda como opción independiente; los programas de consola y el MySQL histórico tampoco sustituyen la aplicación web. Android reutiliza el HTML mediante el proyecto Capacitor existente y aún requiere configurar su entorno para compilar.
