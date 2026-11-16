# MiBolsillo

Aplicación web de Finanzas Personales y Mi Negocio, con interfaces para PC y móvil. Ambas comparten las reglas financieras y los datos locales del mismo navegador y origen.

## Abrir la aplicación

Sirva la raíz del proyecto con Live Server o un servidor estático. Por ejemplo, si tiene Python instalado:

```sh
python -m http.server 5500
```

Abra [el portal](http://localhost:5500/index.html), [PC](http://localhost:5500/desktop.html) o [móvil](http://localhost:5500/mobile.html). Mantenga el mismo protocolo, dominio y puerto al alternar entre PC y móvil. Evite `file://`: algunas funciones de facturación requieren un contexto seguro como localhost o HTTPS.

Los datos se guardan en `localStorage`; no se sincronizan entre equipos o navegadores. Desde el perfil puede descargar y restaurar copias JSON. Ante un error de persistencia, conserve la pestaña y use el aviso de reintento o descargue una copia antes de continuar.

## Dónde está cada cosa

| Ruta | Contenido |
|---|---|
| `index.html` | Portal de entrada a PC, móvil y el script SQL |
| `desktop.html`, `mobile.html` | Interfaces web activas |
| `src/utils/desktop.js`, `src/utils/mobile.js` | Controladores activos de PC y móvil |
| `src/domains/` | Reglas personales, empresariales y de usuario |
| `src/services/`, `src/storage/` | Coordinación financiera, exportaciones y persistencia |
| `src/invoicing/` | Facturación simulada y exportación de documentos |
| `src/ui/`, `styles/` | Vistas compartidas, avisos y estilos de las interfaces |
| `android/`, `capacitor.config.json` | Proyecto Android de desarrollo y configuración de Capacitor |
| `scripts/build-android-web.cjs` | Empaqueta las entradas activas para Android en `dist/android-web/` |
| `tests/`, `test_shared.js`, `test_dates.js` | Pruebas automatizadas; `test_shared.js` conserva cobertura del núcleo histórico |
| `docs/` | Guías actuales; las revisiones anteriores están en `docs/historial/` |
| `legacy/web/` | Implementaciones web anteriores y puentes CSS, conservados sin cargarlos en las páginas activas |
| `legacy/modular/` | Módulos y estilos alternativos que las páginas actuales no cargan |
| `legacy/console/` | Dos programas C++ independientes, conservados completos |
| `qt_app/`, `database/` | Prototipo Qt independiente y esquema MySQL |
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
```

Las pruebas de navegador admiten `PLAYWRIGHT_MODULE` para localizar Playwright y `PLAYWRIGHT_CHROME` para indicar el ejecutable del navegador. Generan sus resultados en `tmp/`.

## Alcance y documentación

Mi Negocio incluye inventario, ventas, compras, contactos, cartera, gastos, empleados, producción, informes y facturación simulada. Los PDF y XML de facturación son de simulación; la integración DIAN, autenticación remota, sincronización entre equipos y nómina legal requieren trabajo adicional.

- [Estructura y responsabilidades del código](docs/ESTRUCTURA.md)
- [Proyecto Android y preparación para Google Play](docs/ANDROID.md)
- [Plan de almacenamiento local y en la nube](docs/ALMACENAMIENTO_LOCAL_Y_NUBE.md)
- [Registro de la limpieza y archivos conservados](docs/AUDITORIA_LIMPIEZA.md)
- [Auditoría de Mi Negocio y reglas de persistencia](docs/MI_NEGOCIO_AUDITORIA.md)
- [Alcance, reglas y límites de la facturación simulada](docs/FACTURACION_SIMULADA.md)
- Historial: [documentación técnica](docs/historial/Documentation.md), [informe académico](docs/historial/INFORME_ACADEMICO.md), [corrección de navegación](docs/historial/CORRECCION_NAVEGACION_NEGOCIO.md) y [README anterior](docs/historial/README_ANTERIOR.md).

Qt y los programas de consola no son el servidor de la web ni comparten automáticamente sus datos. El prototipo Qt conserva dependencias ausentes en sus archivos de compilación; su estado se detalla en la guía de estructura.
