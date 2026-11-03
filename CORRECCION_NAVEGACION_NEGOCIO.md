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
