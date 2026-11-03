# MiBolsillo — organización y correcciones de lógica

## Archivos

- `shared.js`: núcleo único de estado, validación, cálculos y persistencia para la aplicación web.
- `desktop.js`: controlador de la interfaz de escritorio (conserva las llamadas al núcleo `Finanzas`).
- `mobile.js`: controlador de la interfaz móvil (conserva las llamadas al mismo núcleo `Finanzas`).
- `mibolsillo.cpp`: versión de consola C++ original; es un programa independiente y no comparte datos con la aplicación web.
- `test_shared.js`: prueba automatizada básica del núcleo web en Node.js.

## Orden de carga requerido

En `desktop.html`, cargar primero el núcleo y después el controlador de escritorio:

```html
<script src="shared.js"></script>
<script src="desktop.js"></script>
```

En `mobile.html`, cargar primero el núcleo y después el controlador móvil:

```html
<script src="shared.js"></script>
<script src="mobile.js"></script>
```

No cargar `desktop.js` y `mobile.js` simultáneamente en la misma página. Cada controlador espera su propio HTML y sus propios identificadores de elementos.

## Correcciones realizadas en el núcleo

1. La reserva de memoria de respaldo ahora es compartida entre llamadas; antes se recreaba cada vez que se consultaba el almacenamiento.
2. El guardado informa si se logró escribir en `localStorage`, si solo pudo usar `sessionStorage` o si quedó únicamente en memoria.
3. `sessionStorage` se trata como respaldo temporal, no como persistencia permanente.
4. Se incrementó la versión del esquema de almacenamiento a 3, manteniendo la lectura y normalización de datos anteriores.
5. Se usan identificadores menos propensos a colisiones para metas, deudas, aportes y abonos.
6. Al crear una meta con un monto inicial ahorrado, se registra también ese monto en el historial de aportes.
7. Al eliminar una meta o deuda, se eliminan sus aportes/abonos asociados para no dejar registros huérfanos.
8. Se agregaron validaciones defensivas al recibir datos para crear metas, deudas y actualizar el perfil.

## Pruebas ejecutadas

- `node --check shared.js`
- `node --check desktop.js`
- `node --check mobile.js`
- Prueba de creación de movimiento, cálculo, creación de meta con aporte inicial, eliminación en cascada, abono/eliminación de deuda y escritura en `localStorage` (`node test_shared.js`).
- Compilación sintáctica C++17 (`g++ -std=c++17 -fsyntax-only mibolsillo.cpp`).

## Límites que requieren los archivos faltantes

No se recibieron `desktop.html`, `mobile.html`, hojas CSS ni recursos externos. Por eso no es posible comprobar que cada `id`, formulario, botón, modal y gráfico exista en el HTML o hacer una prueba integral de navegación en navegador. Los controladores se conservaron y siguen dependiendo de esos elementos.

`localStorage` conserva datos en el mismo navegador y origen. No sincroniza entre computadores o celulares distintos. Para sincronización multi-dispositivo hace falta un backend con autenticación y base de datos (por ejemplo, Supabase o Firebase), además de definir cómo se resuelven conflictos de edición.

La aplicación C++ es otro programa. Actualmente carga datos de demostración al iniciar y no está conectada a `shared.js`; por tanto, no comparte persistencia ni sincroniza datos con la aplicación web. Debe tratarse como una versión de consola separada hasta implementar su propio almacenamiento o una API común.


## Integración HTML de escritorio (actualización)
- `desktop.html` incluye el formulario de registro conectado por `onsubmit` al controlador.
- `desktop.js` expone `window.pcApp` para garantizar compatibilidad con los manejadores inline del HTML.
- Mantén `desktop.css` en la misma carpeta; no venía incluido en el material entregado.
- Orden requerido al final de `desktop.html`: primero `shared.js`, después `desktop.js`.


## Auditoría de registro único (03-11-2026)

- Se eliminó el segundo listener global `document.addEventListener('submit', ...)` del controlador de escritorio. Los formularios PC ya ejecutan su manejador mediante `onsubmit` en el HTML; mantener ambos caminos ejecutaba dos veces `Finanzas.agregarMovimiento()` por un mismo envío.
- Se añadió protección de envío en curso y una ventana corta de idempotencia basada en tipo, importe, concepto, categoría y fecha para descartar una repetición inmediata del mismo envío. No se eliminan registros históricos ni se modifican transacciones existentes.
- Se aplicó la misma protección al modal rápido de PC y al controlador móvil que realmente carga `mobile.html` (`src/utils/mobile.js`).
- Se agregó el cambio de período antes de guardar para que las pantallas de movimientos/presupuestos consulten el mes del registro.
- Se versionaron las referencias locales de JavaScript en ambos HTML para evitar servir scripts viejos desde caché.
- Se conservan las funciones y archivos originales; no se hizo una reescritura destructiva de los módulos empresariales, metas, deudas, exportación o reportes.

### Arquitectura activa observada
- PC (`desktop.html`): `shared.js` + `desktop.js` (controlador legado).
- Móvil (`mobile.html`): carga la arquitectura modular bajo `src/`, incluyendo `src/services/finanzasCore.js`, `src/utils/shared.js` y `src/utils/mobile.js`.
- Hay dos implementaciones históricas de la interfaz móvil (`mobile.js` en la raíz y `src/utils/mobile.js`). La que se ejecuta desde `mobile.html` es `src/utils/mobile.js`; la de la raíz se conserva por compatibilidad pero no es el controlador activo de esa página.

### Verificación
- `node --check` para todos los JavaScript del proyecto: correcto.
- `node test_shared.js`: `OK`.
- No se ejecutó una prueba end-to-end en navegador ni se conectó a una base de datos remota. Los datos siguen dependiendo del almacenamiento local configurado por cada arquitectura....

## Persistencia compartida entre PC y móvil

Las versiones `desktop.html` y `mobile.html` usan la misma clave persistente (`FINANZAS_ETAPA_DATA_V2`) y el mismo formato de sobre JSON (`version`, `updatedAt`, `updatedBy`, `data`). La capa móvil también reconoce los datos antiguos guardados directamente, por lo que la primera lectura los migra sin descartar sus campos.

- **En el mismo navegador y origen** (por ejemplo, ambas rutas servidas desde el mismo Live Server): los datos son comunes. Los cambios guardados se notifican a otras pestañas mediante `storage` y `BroadcastChannel` cuando el navegador lo soporta.
- **Entre equipos o navegadores distintos**: `localStorage` no se comparte. Para sincronización automática real se necesita desplegar un backend/API con autenticación y una base de datos remota. Este proyecto no incluye URL, credenciales ni servidor remoto configurado; no se simula una nube inexistente.
- No uses `file://` ni cambies de puerto entre las dos versiones. Abre ambas desde el mismo servidor/origen, por ejemplo `http://127.0.0.1:5500/desktop.html` y `http://127.0.0.1:5500/mobile.html`.

### Organización de responsabilidades

- `src/storage/`: lectura, escritura, compatibilidad y migraciones de datos.
- `src/core/`: estado central, acciones y selectores.
- `src/domains/`: reglas de negocio por área (personal y empresarial).
- `src/services/`: coordinación de servicios y fachada `FinanzasCore`.
- `src/app/`: arranque y enrutamiento de la aplicación.
- `src/utils/`: utilidades de presentación y compatibilidad con código existente.
