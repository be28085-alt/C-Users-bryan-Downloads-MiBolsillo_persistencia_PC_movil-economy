# Plan de almacenamiento local y en la nube

Estado: propuesta pendiente de implementación. Esta guía define el objetivo para PC y móvil; no significa que SQLite, las cuentas o la sincronización ya estén disponibles.

## Situación actual

- La web guarda sus datos en `localStorage`, con la clave `FINANZAS_ETAPA_DATA_V2`.
- PC y móvil comparten datos únicamente dentro del mismo navegador, perfil y origen. La instalación Android tiene su propio almacenamiento, separado del navegador.
- Existen copias y restauraciones JSON. No hay un servidor remoto conectado ni sincronización entre dispositivos.
- El esquema de `database/` no está conectado a la web activa.

## Objetivo

Guardar la información localmente para trabajar sin internet y sincronizarla con una cuenta en la nube cuando haya conexión. Conservar la separación entre Finanzas Personales y Mi Negocio y obtener los mismos resultados financieros en PC y móvil.

Ejemplo: un gasto se guarda primero en el celular; queda pendiente de sincronización; al recuperar conexión se envía al servidor y puede consultarse desde PC. La interfaz solo debe mostrar «sincronizado» después de recibir confirmación del servidor.

## Diseño propuesto

| Componente | Responsabilidad |
|---|---|
| Base local Android | Evaluar SQLite para movimientos, ventas, compras, inventario y demás registros; guardar cada operación y su envío pendiente en una misma transacción. |
| Base local web | Evaluar IndexedDB para PC y móvil en navegador, mediante un adaptador con el mismo contrato funcional que Android. |
| Repositorios compartidos | Separar el acceso a datos de las reglas financieras y de los controladores `src/utils/desktop.js` y `src/utils/mobile.js`. |
| API y base de datos remota | Autenticar usuarios, autorizar cada acceso, validar operaciones y conservar la información de cada cuenta y negocio. El proveedor queda por decidir. |
| Servicio de sincronización | Enviar operaciones pendientes, recibir cambios, reintentar sin duplicar y presentar conflictos que requieran resolución. |
| Copias de seguridad | Mantener exportación y restauración verificables y definir respaldos remotos con recuperación probada. |

La nube requiere un backend o servicio administrado con controles de acceso. No se deben incluir credenciales administrativas de la base de datos en la web ni en el paquete Android.

## Reglas de sincronización y recuperación

- Asignar identificadores estables a registros y operaciones, versiones y un cursor de cambios del servidor. No depender solo del reloj del dispositivo.
- Hacer idempotente el procesamiento remoto: reenviar una operación no debe duplicar un gasto, venta, pago ni movimiento de inventario.
- Resolver en el servidor las transacciones que afecten conjuntamente caja, cartera, inventario y facturación. Las operaciones sin conexión deben mostrar su estado pendiente; un rechazo remoto necesita un flujo explícito de conciliación.
- No sobrescribir toda la información con la última copia recibida. Definir reglas por entidad; los conflictos financieros no deben resolverse silenciosamente por fecha.
- Propagar las eliminaciones mediante marcas hasta que se hayan sincronizado. Definir el tratamiento de restauraciones y cambios de cuenta para evitar duplicados o mezclar información.
- Mostrar estados de guardado local, envío pendiente, sincronizado y error en ambas interfaces. Conservar los pendientes tras cerrar o reiniciar.
- Mantener los datos locales separados por cuenta y negocio; definir cierre de sesión, protección de sesiones y acceso sin conexión antes de habilitar usuarios.
- La sincronización también puede propagar errores y eliminaciones: no sustituye las copias de seguridad. Definir retención, restauración, privacidad y eliminación de cuenta antes de publicar.

## Plan de ejecución

1. **Definir el contrato de datos.** Inventariar entidades, separación personal/negocio, versiones, identificadores y operaciones que necesitan transacciones. Elegir motor local y proveedor remoto después de evaluar requisitos y costes.
2. **Implementar almacenamiento local.** Crear adaptadores y migraciones versionadas, manteniendo las reglas financieras compartidas. Exportar una copia antes de migrar desde `localStorage` y comprobar saldos, cartera e inventario antes de dar la migración por terminada.
3. **Preparar respaldos.** Adaptar exportación/importación a Android y navegador, validar formato y versión y probar recuperación. La importación JSON será la vía inicial para trasladar datos del navegador al celular.
4. **Implementar la nube.** Añadir cuentas, permisos por usuario y negocio, API, validaciones, transacciones remotas y copias de seguridad. Usar conexiones cifradas y almacenamiento adecuado para las credenciales de sesión.
5. **Añadir sincronización.** Implementar cola persistente, confirmaciones, reintentos, recepción incremental, eliminaciones y conciliación de conflictos. Una actualización de la app debe conservar los pendientes.
6. **Validar y desplegar por etapas.** Empezar con almacenamiento local y respaldos; habilitar la nube y después el uso simultáneo de varios dispositivos cuando sus pruebas estén aprobadas.

## Criterios de aceptación

- Crear y consultar registros sin internet; cerrar, reiniciar y actualizar sin perder información ni pendientes.
- Tras reconectar, consultar los mismos datos y resultados financieros desde PC y móvil sin duplicar operaciones al reintentar.
- Probar dos dispositivos editando el mismo registro y vendiendo el mismo inventario; informar y conciliar conflictos sin ocultar diferencias.
- Impedir que una cuenta acceda a datos de otra y conservar la separación entre Finanzas Personales y Mi Negocio.
- Migrar y restaurar copias comprobando movimientos, saldos, deudas, cartera e inventario; recuperar de un fallo de almacenamiento o de red sin informar un guardado inexistente.
- Ejecutar `node --test tests/*.test.cjs`, `node test_shared.js` y `node test_dates.js` al modificar lógica financiera, más pruebas de integración de persistencia y sincronización. Verificar los flujos afectados en PC, móvil web y Android real.

Esta documentación no activa almacenamiento remoto ni cambia dónde se guardan los datos actuales.
