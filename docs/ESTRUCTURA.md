# Estructura del proyecto

La organización separa la aplicación web activa, sus pruebas y documentación de las implementaciones anteriores. Los archivos históricos se trasladaron completos para poder consultarlos y recuperarlos; archivar un módulo no elimina las acciones de la aplicación actual.

## Aplicación web activa

`index.html` es el portal. `desktop.html` y `mobile.html` declaran mediante etiquetas `script` los archivos que usa cada interfaz y su orden de carga. Son scripts clásicos del navegador, sin empaquetador ni servidor de aplicación. Los estilos se cargan directamente desde `styles/`.

| Capa | Archivos o carpeta | Responsabilidad |
|---|---|---|
| Controladores | `src/utils/desktop.js`, `src/utils/mobile.js` | Navegación, eventos, formularios y presentación propios de PC o móvil |
| Compatibilidad y utilidades | `src/utils/shared.js`, `dates.js`, `formatters.js`, `security.js`, `validators.js` | Instancia global y funciones compartidas para los scripts existentes |
| Fachada financiera | `src/services/finanzasCore.js` | Coordinar el estado, las reglas personales y el acceso a operaciones empresariales |
| Servicios | `src/services/businessService.js`, `exportService.js` | Guardar operaciones empresariales y exportar o restaurar datos |
| Persistencia | `src/storage/` | Datos iniciales, migraciones, almacenamiento local y repositorio empresarial |
| Reglas personales | `src/domains/personal/` | Movimientos, presupuesto, metas y deudas |
| Reglas empresariales | `src/domains/business/` | Comandos, inventario, productos, caja, métricas, modelos de lectura e informes |
| Usuario | `src/domains/user/` | Datos y operaciones del perfil |
| Facturación | `src/invoicing/` | Importes decimales, documentos simulados, repositorio, interfaz, PDF y XML |
| Interfaz compartida | `src/ui/views/business/`, `src/ui/shared/` | Pantallas y formularios empresariales, informes y aviso de persistencia |
| Estilos | `styles/` | Diseño PC, móvil, espacio empresarial, informes y facturación |
| Dependencias incluidas | `src/vendor/` | Generador QR y su licencia |

Los controladores activos siguen en `src/utils/` porque sus rutas forman parte de las entradas vigentes. No deben confundirse con los archivos del mismo nombre en `legacy/web/`. `src/utils/shared.js` también sigue activo: es un puente de compatibilidad usado por ambas interfaces.

Finanzas Personales y Mi Negocio conservan dominios y flujos separados. Las operaciones empresariales comparten servicio y repositorio con la facturación. Para una función común a ambas interfaces, prefiera los módulos compartidos antes de duplicar reglas dentro de cada controlador.

## Almacenamiento y entradas

PC y móvil usan la clave `FINANZAS_ETAPA_DATA_V2` en el almacenamiento del navegador. Para compartir datos, ambas páginas deben abrirse desde el mismo origen: mismo protocolo, dominio y puerto. `localhost` y `127.0.0.1` cuentan como dominios distintos. La aplicación no conecta su almacenamiento local con MySQL ni con las implementaciones C++.

El esquema `database/gestor_financiero.sql` se conserva y sigue enlazado desde el portal. Es un recurso independiente, no una dependencia de arranque de la web. Las copias y restauraciones JSON de la web se gestionan con el servicio de exportación.

## Código anterior conservado

| Carpeta | Origen y uso |
|---|---|
| `legacy/web/` | Los anteriores `app.js`, `shared.js`, `desktop.js` y `mobile.js` de raíz y los puentes CSS. Las páginas actuales no los cargan. La prueba `test_shared.js` conserva cobertura del núcleo histórico. |
| `legacy/modular/src/` | Árbol alternativo de módulos que no aparece en las dependencias de las páginas activas. Se conserva su estructura relativa para distinguir propuestas anteriores de la implementación utilizada. |
| `legacy/modular/styles/` | Estilos alternativos `base.css` y `layout.css`, sin carga desde las páginas actuales. |
| `legacy/console/` | `main.cpp` y `mibolsillo.cpp`, programas diferentes de consola. Compílelos por separado. |

Los puentes CSS archivados conservan sus importaciones relativas hacia `styles/`. Su presencia permite consultar la compatibilidad anterior, mientras que las interfaces actuales cargan los estilos directamente.

Ejemplo de compilación de cada consola, desde la raíz, con un compilador C++17:

```sh
g++ -std=c++17 -Wall -Wextra legacy/console/main.cpp -o finanzas.exe
g++ -std=c++17 -Wall -Wextra legacy/console/mibolsillo.cpp -o mibolsillo.exe
```

La carpeta `qt_app/` mantiene su organización propia con fuentes, cabeceras y QML. Sus archivos CMake y qmake ya referenciaban dependencias que no están en el repositorio: los modelos de `include/models/`, `PersonalFinanceService` y, para qmake, `qml.qrc`. Esta reorganización conserva ese prototipo; no supone que se haya completado o comprobado su compilación. No se debe borrar un servicio Qt por no utilizarse en la web.

## Pruebas y documentación

`tests/*.test.cjs` cubre el núcleo web y reglas empresariales; `tests/helpers/` contiene utilidades de prueba. `test_dates.js` comprueba las fechas y `test_shared.js` el núcleo histórico. Los comandos completos y la verificación de navegador están en [README](../README.md).

Las suites `tests/*.browser.cjs` abren PC y móvil, verifican acciones y resultados y generan capturas o exportaciones en `tmp/`. Esos archivos son salidas de verificación, están ignorados por Git y no forman parte del código de la aplicación.

Los documentos actuales son [la auditoría de Mi Negocio](MI_NEGOCIO_AUDITORIA.md) y [la guía de facturación simulada](FACTURACION_SIMULADA.md). `docs/historial/` conserva los informes y notas anteriores con un aviso visible: sus referencias, resultados de pruebas y pendientes corresponden a la revisión que describen. Para decidir qué archivo editar, use este mapa y los scripts declarados en los HTML actuales.
