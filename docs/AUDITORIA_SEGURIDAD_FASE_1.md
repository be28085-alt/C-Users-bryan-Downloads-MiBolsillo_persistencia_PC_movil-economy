# Auditoría y protección de datos privados de MiBolsillo

Fecha: 26 de noviembre de 2026. Fase 1 ejecutada sobre el árbol que partía de `b83ae35`, inicialmente sin cambios. Se protegió el seguimiento de datos privados y la creación de archivos nuevos, sin cambiar UX/UI, tecnologías, funcionalidades ni información financiera existente. No se ejecutaron commits, push, despliegues, revocaciones ni reescrituras del historial.

## Alcance y referencia inicial

Se inventariaron los 287 archivos inicialmente rastreados, las entradas activas, código archivado, scripts, configuración Android/Qt, dependencias, permisos de datos y las 62 revisiones alcanzables desde las referencias locales. Se examinaron 502 blobs de texto únicos del historial con patrones de claves privadas, tokens de proveedores y credenciales en URL. La revisión actual de asignaciones de secretos encontró constantes sintéticas de pruebas, sin credenciales de proveedor confirmadas. El análisis por patrones no garantiza detectar secretos arbitrarios ni revisa objetos remotos que no estén disponibles localmente.

Hay un remoto configurado; su visibilidad y las descargas o clones externos no se determinaron. No se imprimieron URLs con credenciales, contraseñas, correos de titulares, hashes de contraseña ni tokens. Los artefactos técnicos locales están en `tmp/security-phase1/`, excluidos de Git.

Antes de modificar archivos se ejecutaron `node --test tests/*.test.cjs`, `node test_shared.js` y `node test_dates.js`. El resultado inicial fue 105 pruebas: 102 aprobadas y 3 fallidas; los dos comandos adicionales aprobaron. Las pruebas de HTTP se ejecutaron con acceso a localhost y bases temporales, sin iniciar el servidor sobre la base real.

## Revisión por componente

| Componente | Evidencia y evaluación |
|---|---|
| Frontend PC y móvil | `desktop.html` y `mobile.html` cargan el núcleo compartido y su controlador propio. Se revisaron inserciones HTML, escapes de texto/atributos, CSV y destinos de red. No se confirmó una inyección ejecutable en los flujos revisados; esta fase no certifica ausencia de XSS. No se editaron HTML, controladores ni estilos. |
| Backend HTTP | `serve-sqlite.cjs` valida Host, origen y Fetch Metadata; usa lista de recursos estáticos permitidos y comprobación de ruta real. Las bases y los respaldos ya estaban fuera de esa lista por su ruta directa. Se cerró un acceso por alias simbólico dentro del proyecto, se agregaron pruebas con archivos privados realmente existentes y encabezados contra framing externo y envío de referente. |
| SQLite y persistencia | Estado por usuario en `user_states`; comparación de revisiones, transacciones, WAL y confirmación de escritura. El cliente SQLite no cambia silenciosamente a localStorage tras un error. Las pruebas de cuentas, reinicio, aislamiento, disco fallido y respaldos comprueban esos controles. |
| Autenticación | Argon2id con sal aleatoria y comparación constante; límite de trabajos de hash simultáneos. El límite de intentos del servidor se aplica por dirección y correo, no constituye una defensa global para exposición pública. No se alteraron contraseñas ni cuentas. |
| Sesiones | Cookie HttpOnly y SameSite Strict; token del portador almacenado como hash; token CSRF ligado a la sesión; caducidad actual de 30 días. La cookie no tiene Secure y el servidor es HTTP: mantener el uso local. No se revocaron sesiones de usuarios. |
| API y respaldos | Sesión obligatoria, aislamiento por usuario, token para escrituras, validación de importes y referencias, restauración con revisión y copia previa. Se verificó que la API no entregue una copia a una sesión anónima y que las pruebas existentes rechacen accesos entre cuentas. |
| Dependencias JS | `pnpm audit --json --fetch-timeout=15000 --fetch-retries=0` consultó npm: 101 dependencias, 0 avisos reportados en todas las severidades. No se cambiaron versiones ni lockfile. Esto no cubre vulnerabilidades desconocidas ni las bibliotecas nativas Android/Qt. |
| Android y Qt | Android usa Capacitor, no tiene integración SQLite/cuentas nativa completa y permite backup del sistema (`allowBackup=true`); se documenta el riesgo sin retirar esa funcionalidad. Qt activo lanza el servidor de la web; el prototipo QML/MySQL y programas archivados no son el backend activo. No se recompilaron binarios Android/Qt. |
| Configuración y repositorio | Se excluyeron bases y diarios en cualquier nivel, respaldos, exportaciones, entornos locales y claves. `.env.example` define desarrollo aislado usando variables ya soportadas. Se retiraron cuatro respaldos y un archivo local de Qt Creator del índice, conservándolos en disco. |
| Permisos | ACL de `database/`, respaldos y archivos representativos: propietario local, SYSTEM, administradores y grupo de ejecución del entorno de desarrollo con lectura. Sin permisos genéricos para Everyone, Users o Authenticated Users. No se sustituyeron ACL NTFS. Los modos POSIX de nuevos archivos se reforzaron; no cambian las ACL de Windows. |

## Vulnerabilidades y riesgos clasificados

No se confirmó una vulnerabilidad de gravedad **crítica** en el alcance revisado. Las clasificaciones siguientes consideran el uso local actual; no constituyen una aprobación para exponer el servidor en Internet.

| ID | Gravedad | Hallazgo | Estado de fase 1 |
|---|---|---|---|
| PRIV-01 | Alta | Tres JSON con identidad/finanzas y una instantánea SQLite con cuentas y sesiones estaban versionados. | Corregido en el índice actual; exposición histórica pendiente. `.gitignore` recursivo y prueba preventiva. |
| PRIV-02 | Alta | Los mismos respaldos siguen recuperables en el historial local, al menos en `e21d92c` y `3d5f965`. La instantánea contiene 3 cuentas, 3 estados financieros y 2 sesiones. | Pendiente autorización de saneamiento y revisión del alcance externo. No se reescribió el historial. |
| PRIV-03 | Media | SQLite y JSON almacenan información privada sin cifrado de archivo. Los hashes de contraseña permiten intentos de adivinación fuera de línea si se roba la copia. | Política de cifrado evaluada; cifrado y rotación quedan como acciones manuales. El estado del cifrado de volumen no se pudo verificar. |
| PRIV-04 | Media | SQLite y `VACUUM INTO` podían crear archivos con permisos POSIX derivados de una umask permisiva. | Corregido para bases e instantáneas nuevas mediante reserva exclusiva `0600` y carpetas nuevas `0700`. Revisar archivos antiguos en otros equipos. |
| PRIV-05 | Media, condicional | Configurar el servidor para LAN expone autenticación y datos mediante HTTP, sin cookie Secure. Rate limiting por correo puede eludirse distribuyendo correos/direcciones. | Uso predeterminado continúa en loopback. No se habilitó red ni se rediseñó autenticación. No publicar esta configuración como servicio remoto seguro. |
| PRIV-06 | Media, condicional | En una distribución Android con datos locales, los backups del sistema están habilitados; el modo navegador conserva datos anteriores en localStorage sin cifrado de aplicación. | Documentado; no se desactivaron respaldos ni se cambió el almacenamiento Android/web estático. Revisar antes de distribuir datos reales. |
| PRIV-07 | Baja | Faltaban encabezados explícitos para limitar framing externo y envío del referente. | Corregido con `SAMEORIGIN`, CSP compatible con el iframe adaptable y `Referrer-Policy: no-referrer`. No se impuso una CSP de scripts que rompiera handlers existentes. |
| PRIV-08 | Baja | Configuración de Qt Creator específica del equipo incluida en Git. | Retirada del índice y excluida; se conserva localmente. No se confirmó un secreto en ella. |
| PRIV-09 | Media, condicional | Un symlink o junction en recursos públicos podía resolver hacia una ubicación privada dentro de la raíz y publicar su contenido mediante una extensión permitida. | Corregido: se valida también la ruta canónica con la lista pública. Probado con un junction sintético; no se detectó ese alias en los archivos versionados. Chart.js conserva su ruta autorizada, incluido el layout pnpm. |

## Correcciones y archivos afectados

| Archivo | Cambio |
|---|---|
| `.gitignore` | Exclusiones recursivas y excepciones para plantilla saneada. |
| `.env.example` | Variables actuales para desarrollo con base y puerto distintos; sin credenciales. No cambia el arranque de producción. |
| `scripts/private-files.cjs` | Reserva exclusiva de archivos privados y generación de snapshots sin sobrescribir destinos existentes. |
| `scripts/serve-sqlite.cjs` | Creación privada de bases nuevas, validación del destino de alias y encabezados de protección HTTP. |
| `scripts/backup-store.cjs` | Reserva privada de la instantánea temporal antes de `VACUUM INTO`. |
| `scripts/auth-store.cjs` | Misma protección en el respaldo previo a migrar cuentas. |
| `scripts/migrate-account-data.cjs` | Misma protección en el respaldo previo a importar datos. |
| `tests/private-data.test.cjs` | Exclusiones Git, creación/snapshot, acceso HTTP, PC/móvil y conservación tras reiniciar. |
| `docs/SEGURIDAD_DATOS_PRIVADOS.md`, `docs/RESPALDOS.md`, este informe | Política, alcance del cifrado y procedimiento de respuesta. |

Se prepararon eliminaciones **solo del índice** para los tres JSON de `database/backups/accounts/`, la instantánea de `database/backups/database/` y `android/.qtcreator/project.json.user`. No se imprimen los contenidos de los diffs privados.

## Resultados de verificación

| Comprobación | Resultado |
|---|---|
| Suite final `node --test tests/*.test.cjs` | 108 pruebas: 105 aprobadas y los mismos 3 fallos iniciales; 0 regresiones nuevas observadas. |
| Pruebas nuevas de privacidad | 3 de 3 aprobadas; incluyen 68 solicitudes de archivos privados con y sin sesión, mediante GET y HEAD, todas rechazadas con 404. Se verifica además Chart.js mediante un junction pnpm legítimo. |
| `node test_shared.js` y `node test_dates.js` | Aprobados antes y después. |
| Base real y copias existentes | SHA-256 y existencia: 11 archivos privados de `database/` sin cambios. Configuración privada de Qt Creator también conservada sin cambios; 12 archivos inventariados en total. |
| Seguimiento Git | Ninguna base, diario, respaldo, entorno privado ni clave de las categorías comprobadas continúa rastreada. El archivo SQL histórico de esquema continúa versionado. |
| Archivos nuevos | `git check-ignore` confirma exclusión de nuevas copias JSON/SQLite, temporales, diarios, exportaciones y secretos, manteniendo `.env.example` visible. |
| HTTP y cuentas | Archivos privados existentes inaccesibles tanto con sesión como sin ella; `/api/storage`, configuración, bootstrap y respaldos requieren sesión. PC y móvil responden con su bootstrap SQLite. |
| Persistencia y backups | Creación/descarga de copia autorizada y lectura idéntica después de reiniciar el servidor en una base sintética; pruebas existentes de recuperación, aislamiento y error de disco aprobadas. |
| Plantilla de entorno | Node carga la plantilla; ruta de desarrollo distinta de la base real y host loopback. |
| Permisos Windows | ACL revisadas; no se detectaron concesiones a grupos genéricos de usuarios. BitLocker no verificable con los permisos disponibles. Las aserciones POSIX se ejecutarán en plataformas POSIX; no se simularon como ACL NTFS. |
| Navegador y binarios nativos | No se ejecutaron pruebas visuales Playwright ni compilaciones Android/Qt; no hay cambios de interfaz. Se verificaron HTTP, carga declarada de scripts y pruebas automatizadas para ambos modos. |

Los fallos anteriores a esta fase son `desktop-runtime.test.cjs:49` (fixture incompleto rechazado con 400) y `personal-flows.test.cjs:72` para PC y móvil (el test exige eliminar abonos que el comportamiento actual conserva al archivar). No se relajó la validación ni se borró historial financiero para hacerlos pasar. El fallo de intercepción POST/PATCH de la prueba de navegador personal, ya identificado en la revisión anterior, queda fuera de esta fase.

## Sesiones y credenciales potencialmente expuestas

La copia SQLite guarda hashes Argon2id y sales de las 3 cuentas; no contraseñas en texto claro. Sus 2 filas de sesión contienen hashes del token de cookie y tokens CSRF. El hash del token no permite usarlo directamente como cookie. Aun así, para una copia que haya salido del control del propietario, revocar las sesiones afectadas, rotar contraseñas de las cuentas reales presentes y cambiar cualquier contraseña reutilizada en otros servicios. No se encontraron claves privadas de proveedor confirmadas que deban rotarse por esta revisión.

No se revocó ni rotó nada automáticamente: la instrucción de esta fase exige identificarlo y conservar los datos existentes. Borrar una sesión en la base actual tampoco borra copias antiguas. Al restaurar una instantánea expuesta se podrían reactivar sesiones o credenciales anteriores; realizar esa recuperación de forma controlada.

## Acciones manuales y comandos recomendados

1. Restringir acceso a copias del repositorio y revisar si los commits afectados llegaron al remoto, a otros clones, adjuntos o CI. La presencia de un remoto no prueba una publicación pública.
2. Revocar sesiones potencialmente expuestas y rotar contraseñas reales mediante un procedimiento administrativo verificado. No sustituir hashes manualmente con texto claro. Con el servidor detenido y tras un respaldo privado verificado, un administrador puede ejecutar `DELETE FROM auth_sessions;` sobre la base correcta para cerrar todas sus sesiones. No se ejecutó esa sentencia.
3. Verificar cifrado de volumen y de las copias externas y custodiar la recuperación fuera de Git. Revisar ACL del soporte destino al copiar respaldos.
4. Revisar y confirmar la protección del árbol actual. Desde la raíz, sin mostrar contenido financiero:

```powershell
git ls-files -- database/backups
git diff --cached --stat
git add -- .gitignore .env.example scripts/private-files.cjs scripts/serve-sqlite.cjs scripts/backup-store.cjs scripts/auth-store.cjs scripts/migrate-account-data.cjs tests/private-data.test.cjs docs/SEGURIDAD_DATOS_PRIVADOS.md docs/AUDITORIA_SEGURIDAD_FASE_1.md docs/RESPALDOS.md
git diff --cached --stat
git commit -m "Protege datos privados y respaldos de MiBolsillo"
```

Las bajas del índice ya están preparadas; `git add` no vuelve a incluir las copias ignoradas. No usar `git add -f`. El commit queda a cargo del usuario; no se ejecutó.

### Saneamiento del historial con autorización separada

Antes de hacerlo, conservar los datos locales fuera del clon a sanear y un espejo privado restringido del repositorio anterior. Coordinar una ventana sin escrituras con todos los colaboradores. Trabajar en un clon espejo nuevo, sin bases reales en su árbol y con la herramienta `git-filter-repo` revisada e instalada. En ese espejo, el comando propuesto es:

```powershell
git filter-repo --path database/backups/ --path android/.qtcreator/project.json.user --invert-paths
git log --all --oneline -- database/backups android/.qtcreator/project.json.user
git rev-list --objects --all
```

No se ejecutó ninguno de esos comandos de saneamiento. Comprobar todas las referencias y objetos restantes, posibles rutas anteriores y clones externos; revisar que la aplicación y etiquetas necesarias permanezcan intactas. Solo después de autorización explícita se coordinaría la actualización forzada de referencias remotas y la sustitución de clones. No se recomienda un force push indiscriminado. Conservar el espejo anterior únicamente como material privado de recuperación con acceso restringido.

## Estado final

Fase 1 implementada y verificada en el árbol actual, con los datos locales intactos y sin regresiones nuevas observadas. La remediación completa de la exposición histórica permanece pendiente de autorización y actuaciones administrativas; el cifrado de copias no se activó. No se inició ninguna fase posterior.
