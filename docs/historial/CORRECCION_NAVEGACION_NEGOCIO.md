> Documento histórico conservado durante la organización del proyecto del 14-11-2026. Describe el estado de una revisión anterior; los resultados de pruebas y los pendientes pertenecen a esa revisión. Para las rutas actuales y el funcionamiento vigente, consulte [la guía principal](../../README.md) y [la estructura del proyecto](../ESTRUCTURA.md).
>
> Rutas anteriores: los JavaScript de raíz se conservan en `legacy/web/`, los programas C++ en `legacy/console/` y los módulos alternativos sin conexión con las páginas actuales en `legacy/modular/src/`. Los puentes CSS anteriores se conservan en `legacy/web/`; las hojas activas están en `styles/`. Las rutas de código se interpretan desde la raíz del repositorio.

# Corrección de navegación en Mi negocio

## Archivos modificados
- `src/utils/mobile.js`
- `styles/mobile.css`

## Qué se corrigió
- La barra inferior ahora toma como fuente principal el módulo activo de la interfaz (`currentModule`), evitando que un estado atrasado del núcleo muestre la navegación empresarial mientras se está viendo una pantalla personal como “Tus metas”.
- La navegación se vuelve a sincronizar después de cada renderizado global.
- La barra inferior adapta el ancho de sus cinco accesos y el botón central a pantallas estrechas, respeta las áreas seguras del dispositivo y trunca etiquetas largas sin superponerlas.

## Conservación
No se eliminaron paneles, botones, acciones ni módulos. Se mantienen los accesos Inicio, Inventario, Movs, acción rápida, Clientes e Informes.

## Aplicación
Reemplaza los dos archivos respetando las rutas indicadas. Reinicia Live Server y recarga con Ctrl+F5.



