# Respaldos locales y restauración

La gestión de archivos privados, entornos, permisos, cifrado y exclusiones de Git se rige por la [política de protección de datos](SEGURIDAD_DATOS_PRIVADOS.md). Consulte también [la auditoría de fase 1](AUDITORIA_SEGURIDAD_FASE_1.md) para los respaldos que aparecieron en el historial y las acciones de respuesta pendientes.

La aplicación SQLite crea instantáneas locales cada 24 horas mientras su servidor está abierto. Al iniciar, crea la copia que corresponda si la última tiene más de 24 horas. No necesita mantener abierta una página del navegador y no sube datos a servicios externos.

En **Perfil → Respaldos**, disponible en PC y móvil conectados al servidor SQLite, puede:

- Crear una copia de los datos confirmados de su cuenta.
- Consultar las últimas copias y descargar una como archivo JSON.
- Restaurar una copia de la lista o un archivo JSON descargado previamente.

Antes de restaurar, la aplicación pide confirmación, verifica el formato, la integridad y las reglas financieras, y guarda una copia del estado actual. El reemplazo de los datos de la cuenta se confirma en una transacción SQLite. Si el archivo es inválido, pertenece a otra cuenta o los datos cambiaron durante la confirmación, no se reemplaza el estado actual. Las credenciales y la identidad actual de acceso se conservan. Las copias conservadas antes de restaurar aparecen también en la lista.

Resuelva primero cualquier aviso de cambios pendientes. Una copia manual contiene los datos que la base confirmó, no los campos de un formulario todavía sin guardar. Los archivos importados mediante el navegador tienen un límite de 15 MB.

## Dónde se guardan

Con la configuración predeterminada:

- `database/backups/database/`: últimas 7 instantáneas completas de SQLite. Son copias administrativas locales e incluyen todas las cuentas; la API nunca permite descargarlas o restaurarlas desde una cuenta individual.
- `database/backups/accounts/<id>/`: últimas 30 copias JSON de la cuenta, incluidas las automáticas, manuales y las creadas antes de restaurar. El servidor solo entrega copias del usuario de la sesión.

Si usa otra ruta de base de datos, `backups/` queda junto a ella. Las copias completas se generan con `VACUUM INTO`, que incorpora de forma consistente las escrituras del diario WAL. Se verifican con `PRAGMA quick_check` y solo después se publican con su nombre definitivo. No copie manualmente solo el archivo SQLite principal mientras existan escrituras o un WAL activo.

Las carpetas de respaldo están excluidas de Git y no se sirven como archivos estáticos. Los archivos contienen información financiera privada. Restrinja el acceso del sistema operativo y descargue una copia en un disco externo o memoria USB: guardar las copias en el mismo equipo no protege frente a la pérdida de ese equipo.

## Recuperación de todo el equipo

La restauración normal desde Perfil afecta únicamente a la cuenta activa. Para recuperar una instantánea completa SQLite, detenga el servidor, conserve una copia de la base actual y sus diarios, verifique la instantánea con una herramienta SQLite y restaure el conjunto de la aplicación con asistencia técnica. Una instantánea completa recupera todas las cuentas y sus credenciales al momento de la copia. Nunca sustituya una base que siga abierta por el servidor o DB Browser.

Un archivo JSON descargado puede restaurarse en una cuenta con el mismo correo en otro equipo. Las copias locales del mismo servidor también identifican la cuenta por su ID y la identidad de la base, por lo que un cambio posterior de correo no impide recuperar sus propias copias locales. No se permite restaurar copias de otra cuenta.

El modo web estático y el paquete Android independiente todavía no ofrecen estos respaldos SQLite. Esta función requiere una sesión autenticada en el servidor local.
