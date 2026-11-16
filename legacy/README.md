# Implementaciones anteriores

Esta carpeta conserva código completo que las páginas web actuales no cargan. No se eliminó por contener funciones, cálculos o acciones que pueden servir de referencia.

| Carpeta | Contenido |
|---|---|
| `web/` | Los cuatro JavaScript anteriores de raíz y sus dos puentes CSS. `shared.js` sigue cubierto por `test_shared.js`. |
| `modular/src/` | 52 módulos alternativos de arranque, estado, dominios e interfaz. Mantienen su estructura relativa original. |
| `modular/styles/` | Los estilos alternativos `base.css` y `layout.css`. |
| `console/` | Dos programas C++ autónomos; cada archivo tiene su propio `main` y se compila por separado. |

Las entradas vigentes permanecen en `desktop.html` y `mobile.html`, en la raíz del proyecto. Sus controladores son `src/utils/desktop.js` y `src/utils/mobile.js`. El prototipo Qt conserva su carpeta independiente `qt_app/`.

Los módulos archivados no forman una tercera aplicación web lista para abrir: son implementaciones anteriores que no estaban conectadas a los HTML actuales. Antes de reutilizarlos, revise sus dependencias y reglas; las correcciones financieras actuales están en `src/`.

Consulte el [mapa actual](../docs/ESTRUCTURA.md) y el [registro de la limpieza](../docs/AUDITORIA_LIMPIEZA.md).
