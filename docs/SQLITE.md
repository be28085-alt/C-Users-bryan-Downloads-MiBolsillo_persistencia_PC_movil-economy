# SQLite local y datos por cuenta

Ejecute `npm start` con Node.js 24.22 o posterior, o inicie **GestorFinanciero** en Qt Creator. Abra `http://127.0.0.1:5500/` y cree su cuenta o inicie sesión. El servidor debe seguir abierto para confirmar las escrituras.

La base local sigue siendo `database/mibolsillo.sqlite`. No sincroniza teléfonos ni equipos por Internet. Una cuenta puede utilizar las distribuciones ancha y estrecha del mismo servidor sin copiar datos; redimensionar no reconstruye la página ni pierde formularios.

## Consultar en DB Browser

Use `npm run db:open` o abra el archivo desde DB Browser for SQLite. Para ver los datos actuales:

- `auth_users`: identidad de acceso; contraseñas Argon2id y sal, nunca en texto plano.
- `auth_sessions`: sesiones revocables con vencimiento; los identificadores se conservan como hashes.
- `user_states`: estado financiero completo en `raw`, con una fila por `user_id`. Incluye movimientos, cuentas, presupuesto, metas, deudas y todos los módulos empresariales y de facturación.
- `app_state` y `vista_*`: estado histórico anterior a las cuentas, conservado sin propietario asignado. No son los datos actuales de todas las cuentas.
- `account_imports`, si existe: huellas de importaciones confirmadas para evitar duplicados.

Las operaciones normales se realizan desde MiBolsillo para aplicar validaciones, aislamiento y comparación de versiones. El servidor identifica al dueño por la sesión, no por un ID proporcionado en un formulario. Si otra ventana ha guardado una versión más reciente, se rechaza la sobrescritura y se muestran opciones de recuperación.

No publique este servidor local en Internet. No dispone de HTTPS, verificación de correo ni recuperación remota de contraseña configurados.

## Conservar y migrar información anterior

La actualización agrega el esquema de cuentas automáticamente. Si había datos en `app_state`, crea una copia SQLite consistente `respaldo-antes-cuentas-*.sqlite`, conserva el original y no lo entrega automáticamente a la primera cuenta creada.

El almacenamiento anterior del navegador tampoco se importa automáticamente, porque no identifica a un propietario autenticado. Conserve sus copias JSON. Consulte [Cuentas y migración](CUENTAS_Y_MIGRACION.md) para la comprobación previa y el comando local que exige verificar el titular, crea otro respaldo y evita reemplazos y duplicados.

El perfil ya no incluye el apartado de gestión y respaldo de datos. Los cambios se guardan automáticamente en SQLite. Para trasladar datos anteriores, utilice la migración documentada; ante un fallo, el aviso de persistencia conserva las opciones de recuperación.

## Errores, respaldos y verificación

Un guardado solo se informa como confirmado después del commit SQLite. Si el servidor o la base fallan, no se cambia silenciosamente a `localStorage`. Conserve el formulario o la pestaña y revise el aviso de persistencia, reintente cuando corresponda o descargue una copia antes de cerrar.

En los formularios personales, una escritura fallida no modifica los saldos ni publica registros en memoria: los campos permanecen abiertos para corregir o reintentar. El aviso se coloca dentro del formulario para permitir pulsar Guardar. Los borradores pendientes de versiones anteriores conservan su recuperación. Perfil guarda nombre, correo de acceso y capital inicial en una sola transacción; un correo ocupado o un fallo de escritura revierte toda la operación.

Para copiar la base manualmente, cierre la aplicación, detenga su servidor y cierre DB Browser. No copie solo el archivo principal mientras haya escrituras o un diario WAL activo. Los respaldos automáticos del esquema y de la migración utilizan una instantánea consistente. Las bases, diarios y respaldos están excluidos de Git y no se sirven como archivos HTTP.

`npm run test:sqlite:browser` verifica la capa histórica con bases temporales. `npm run test:accounts:browser` comprueba acceso real, datos por usuario y el flujo crear/editar/eliminar después de reiniciar el servidor y SQLite. `npm run test:adaptive:browser` comprueba el mismo documento y borrador a distintos anchos. `npm run test:personal:browser` comprueba los formularios personales con errores de guardado, reintentos y persistencia tras un reinicio completo. Estas pruebas no modifican su base de uso habitual.

El APK Android independiente todavía no incluye el backend de cuentas ni SQLite nativo, y el entorno carece del SDK/JDK necesario para generarlo y probarlo. Un paquete estático sin API de acceso falla de forma visible; no permite entrar mediante un almacén alternativo.
