# Protección de datos privados de MiBolsillo

Esta política cubre las bases SQLite, sus diarios, las copias de seguridad, las exportaciones y la configuración local. Los datos personales y empresariales se conservan en sus formatos actuales. No se guardan datos reales en Git, en los recursos web ni en las pruebas.

## Ubicaciones y entornos

| Entorno | Base y configuración | Regla |
|---|---|---|
| Uso real actual | `database/mibolsillo.sqlite` o la ruta ya configurada en `MIBOLSILLO_DB_PATH` | El inicio habitual conserva esta ruta; no se migra ni se reemplaza automáticamente. |
| Desarrollo | `database/development/mibolsillo.sqlite`, con `.env.development` local | Solo cuentas y datos sintéticos; puerto separado. |
| Pruebas | Directorios únicos bajo `tmp/` o el temporal del sistema, según cada prueba | Nunca reutilizar una base real. Las pruebas nuevas de privacidad usan `tmp/private-data-*`. |
| Copias | `backups/` junto a cada base | No mezclar carpetas de copias entre entornos. |
| Auditoría de seguridad | `security-audit/` junto a cada base | Metadatos mínimos, carpeta privada ignorada por Git; no contiene cuerpos, identidades ni tokens. |
| Exportaciones manuales | `exports/` o una carpeta privada fuera del repositorio | Revisar antes de adjuntar archivos, capturas o registros a un chat o incidencia. |

Para desarrollar sin abrir los datos reales, desde la raíz del proyecto:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env.development
node --env-file=.env.development scripts/serve-sqlite.cjs
```

La plantilla usa el puerto 5501 y una base distinta. `--env-file` es de Node y no agrega bibliotecas. No se carga `.env` implícitamente. El auxiliar Qt también acepta `node --env-file=.env.development scripts/desktop-runtime.cjs`. `npm start` mantiene el comportamiento y los datos anteriores. No copiar datos reales para llenar el entorno de desarrollo.

No guardar contraseñas, claves de cifrado ni tokens de sesión en `.env.example`. `.env`, `.env.*`, claves privadas, almacenes de firma, bases y diarios quedan ignorados. Una exclusión no protege archivos ya rastreados: comprobar el índice antes de confirmar cambios.

## Acceso y permisos

La carpeta privada debe pertenecer al usuario que ejecuta MiBolsillo. No conceder lectura a usuarios ajenos, `Everyone`, `Users` o `Authenticated Users`, ni ubicarla en una carpeta compartida. No usar `src/`, `styles/`, recursos Android o directorios estáticos para guardar información privada. El servidor de MiBolsillo permite solo los recursos públicos previstos; un servidor estático distinto no hereda esta protección.

En Windows se debe revisar la ACL NTFS, también después de copiar o restaurar archivos:

```powershell
Get-Acl -LiteralPath database | Format-List Owner,AccessToString
Get-Acl -LiteralPath database/backups | Format-List Owner,AccessToString
```

Conservar acceso al propietario, SYSTEM y administradores y, cuando corresponda, a la identidad concreta del servicio. Antes de cambiar una ACL, guardar su configuración fuera de Git y comprobar que el usuario del servidor conserva acceso. No retirar permisos de herramientas de desarrollo sin revisar su necesidad. Los modos numéricos de Node no sustituyen las ACL de Windows. [Documentación de permisos de Node](https://nodejs.org/api/fs.html#fschmodpath-mode-callback).

En sistemas POSIX, las bases nuevas y las instantáneas nuevas se reservan con creación exclusiva y modo `0600`; las carpetas nuevas se solicitan con `0700`. No se reescriben archivos existentes ni se cambian sus permisos automáticamente. Revisar manualmente las bases y carpetas anteriores. Las instantáneas se reservan vacías antes de `VACUUM INTO`, que admite ese destino y conserva el contenido lógico de la base original. [Documentación de SQLite](https://www.sqlite.org/lang_vacuum.html#vacuum_with_an_into_clause).

## Creación, conservación y recuperación

- Se mantiene la frecuencia actual: una copia al corresponder durante el inicio y cada 24 horas mientras el servidor esté funcionando. La retención actual es de 7 instantáneas completas y 30 JSON por cuenta. La fase 1 no cambia esa retención ni ejecuta limpieza sobre datos reales.
- Las instantáneas completas contienen todas las cuentas, hashes de contraseña y sesiones. Solo el administrador local debe acceder a ellas. La API no las publica como descargas.
- Los JSON por cuenta contienen identidad y finanzas. La API exige una sesión del propietario; las restauraciones requieren además el token de sesión, confirmación y revisión vigente.
- Las copias SQLite se generan con `VACUUM INTO`, se comprueban y se publican después. No copiar solo el archivo principal de una base abierta ignorando sus diarios WAL.
- Mantener una copia externa protegida y probar su recuperación en una base aislada. Registrar fecha, verificación y resultado sin valores financieros, contraseñas ni tokens. No reemplazar una base real para probar una recuperación.
- Antes de una restauración completa, detener los escritores, conservar el conjunto actual y sus diarios, comprobar la instantánea y verificar la identidad de la base destino. No restaurar sesiones de una copia que haya sido expuesta.
- El checksum SHA-256 detecta corrupción accidental; no es una firma y no impide que alguien con acceso de escritura reemplace archivo y checksum. Proteger también los soportes y el acceso al sistema operativo.

La exclusión de Git no cifra los archivos, no impide `git add -f` y no elimina copias del historial. No ejecutar tareas automáticas de limpieza que eliminen el único respaldo recuperable.

## Evaluación del cifrado

| Alternativa | Alcance y decisión |
|---|---|
| BitLocker y BitLocker To Go | Protegen volúmenes locales y unidades externas frente a la pérdida del soporte. No cambian el formato SQLite/JSON ni la aplicación. Verificar disponibilidad, activación y custodia de la clave de recuperación por el propietario del equipo. No impiden que un proceso autorizado lea un volumen desbloqueado. |
| Archivo externo cifrado y autenticado | Adecuado para transportar copias fuera del equipo. La contraseña o clave debe guardarse separada del archivo y del repositorio. Comprobar una recuperación antes de depender de este mecanismo. No guardar datos reales en servicios externos sin autorización. |
| Cifrado propio de cada respaldo | Exigiría definir gestión y recuperación de claves, formato versionado, autenticación del contenido y compatibilidad de restauración. No se incorpora en esta fase ni se genera una clave junto a las copias. |
| Sustituir SQLite por un motor cifrado | Cambiaría dependencias y compatibilidad; queda fuera de las restricciones de esta fase. |

BitLocker y sus modalidades se describen en la [documentación oficial de Microsoft](https://learn.microsoft.com/en-us/windows/security/operating-system-security/data-protection/bitlocker/). La auditoría no pudo verificar su estado con los permisos disponibles. **Las copias actuales continúan en texto claro a nivel de archivo; no se afirma que estén cifradas.** Activar cifrado del soporte y custodiar su recuperación es una acción del propietario, no una modificación automática de sus datos.

### Claves, dispositivos y migración futura

BitLocker evita cambiar el formato y suele aprovechar aceleración del equipo; debe medirse el impacto de disco en ese hardware y no ofrece protección frente a un proceso autorizado con el volumen abierto. Las copias cifradas externas requieren cifrado autenticado, formato versionado y una clave distinta del repositorio/archivo. Medir creación, verificación y restauración, también con espacio libre reducido y en dispositivos de menor capacidad. No generar una clave junto al respaldo ni guardarla en localStorage.

En Windows, [DPAPI](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata) puede custodiar material ligado a la cuenta/máquina, con limitaciones al moverlo a otro equipo. En Android, [Keystore](https://developer.android.com/privacy-and-security/keystore) permite claves protegidas por el sistema y, cuando existe, hardware; desinstalación, pérdida del dispositivo y restauraciones requieren un plan de recuperación. Ninguna de estas integraciones existe actualmente en MiBolsillo. No guardar un token de sesión en preferencias para aparentar soporte nativo.

Un motor SQLite cifrado exigiría cambiar el controlador, compilar/probar Qt/Android y definir licencias, claves y compatibilidad; no se activó. Antes de aprobar una migración: inventariar versiones y soportes, crear snapshot consistente privado, probar cifrado sobre una **copia aislada**, comparar conteos/totales/relaciones y `integrity_check`, ensayar recuperación con clave separada y rollback al formato original. Nunca cifrar el archivo activo in situ como primer ensayo. Los diarios y temporales también deben quedar protegidos; cifrar solo JSON no protege la base de origen.

El propietario debe custodiar recuperación fuera del equipo/Git, con al menos una copia controlada y una prueba de acceso en otro entorno autorizado. Definir quién puede obtener claves, cómo se rotan y cómo se destruyen al vencer la retención; no destruir la única clave ni el único respaldo. La fase 3 solo documenta esta evaluación, no cambia los archivos existentes.

## Sesiones, eventos y operación desde fase 3

La política vigente crea sesiones de 12 horas con inactividad persistida de 30 minutos; login rota la cookie y cambiar contraseña revoca sesiones transaccionalmente. Producción requiere proxy HTTPS autorizado con servidor en loopback; la configuración local sigue siendo HTTP local. No publicar el puerto de desarrollo. Contratos, cuotas y configuración se detallan en [la auditoría de fase 3](AUDITORIA_SEGURIDAD_FASE_3.md).

La auditoría privada rota cinco archivos con umbral de 1 MiB y vencimiento de siete días comprobado al escribir. Guardar solamente metadatos permitidos y revisar el diagnóstico local de fallo; no adjuntar estados financieros o excepciones originales. La ausencia de un evento tras un fallo del disco no invalida un COMMIT financiero ya confirmado. No copiar estas carpetas a `src/` ni a un directorio estático.

## Git y exposición anterior

Antes de cada commit, revisar sin imprimir contenido privado:

```powershell
git ls-files -- database/backups
git diff --cached --stat
node --test tests/private-data.test.cjs
```

La primera orden debe quedar sin resultados. La prueba también comprueba las exclusiones de archivos nuevos, secretos y diarios. No publicar diffs completos de los respaldos retirados: su eliminación en Git puede mostrar el contenido anterior.

Si ya se confirmó información sensible, restringir el acceso a las copias y revisar clones, ramas, etiquetas, adjuntos y registros de CI. La reescritura del historial requiere una autorización separada y coordinación con quienes tengan copias; no garantiza borrar clones o descargas ajenas. El procedimiento vigente y las revocaciones pendientes están en [el plan revisable de exposición histórica](PLAN_RESPUESTA_EXPOSICION.md); la [auditoría de fase 1](AUDITORIA_SEGURIDAD_FASE_1.md) conserva la evidencia inicial.
