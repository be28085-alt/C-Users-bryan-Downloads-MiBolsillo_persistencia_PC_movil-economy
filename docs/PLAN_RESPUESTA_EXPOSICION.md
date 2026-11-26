# Plan revisable ante exposición histórica

Fecha de revisión: 26 de noviembre de 2026. **Preparado; no ejecutado.** La autorización de fase 3 no incluye reescritura, force push, revocación masiva, rotación de credenciales reales ni eliminación de copias locales. Aprobar esas acciones por separado después de verificar alcance, responsables y recuperación.

## Alcance confirmado

En `e21d92c` y `3d5f965` hay tres JSON de `database/backups/accounts/` con perfil, correo y finanzas, y una instantánea de `database/backups/database/` con tres cuentas, tres estados y dos filas de sesión. Se volvió a verificar leyendo blobs en memoria, sin imprimir valores. Las cuentas contienen hashes Argon2id y sales; las sesiones contienen hash del token aleatorio, vencimiento y CSRF. No se confirmó contraseña en claro ni clave de proveedor en esa instantánea. La baja del árbol aparece en `2bde339`; **borrar del árbol no borra del historial**.

Un hash de token no funciona directamente como cookie. El CSRF aislado tampoco autentica. Aun así, una copia fuera de control exige valorar revocación de las sesiones asociadas y restablecimiento de las contraseñas reales presentes, por el riesgo de adivinación offline. No es necesario volver a registrar ni borrar cuentas. Si la contraseña se reutilizó en otro servicio, el titular debe cambiarla allí también. No imprimir IDs nominales, correos, hashes ni tokens en incidencias públicas.

La existencia del remoto configurado no prueba que el repositorio fuese público, ni que alguien descargase esos blobs. No se consultaron permisos remotos ni caches privadas. Determinar esa exposición es un paso de contención, no una conclusión ya demostrada.

También se encontró una contraseña literal en `qt_app/include/data/DatabaseManager.h`, conector MySQL archivado que el lanzador actual no compila. Se retiró del árbol y se sustituyó por lectura de `MIBOLSILLO_MYSQL_PASSWORD`, sin fallback; el valor sigue en commits previos. No se imprimió ni se comprobó contra un servidor. Si se usó como credencial real, debe rotarse la contraseña MySQL correspondiente y revisar su reutilización y permisos. Retirar el literal no realiza esa rotación.

## 1. Contener y preservar

1. Identificar repositorio, ramas/tags, remotos, forks, clones, artefactos CI, releases, adjuntos y personas con acceso. Restringir permisos donde corresponda, con autorización del responsable. Registrar fechas y resultados sin volcar datos.
2. Preservar un espejo de evidencia en almacenamiento privado cifrado y con ACL restringida. Conservar los respaldos locales originales; no usar una limpieza de Git para borrar el único respaldo recuperable.
3. Inventariar las cuentas de la instantánea contra la base correcta en una estación privada. Distinguir cuentas ficticias de reales y comprobar si sus credenciales o sesiones aún están vigentes. No restaurar la copia expuesta sobre producción para hacer la comparación.
4. Verificar una copia recuperable antes de actuar; si hay WAL, usar snapshot consistente. Detener escritores y confirmar la ruta y el propietario de la base antes de tareas administrativas. No copiar solamente el SQLite abierto ignorando WAL/SHM.

## 2. Sesiones y credenciales, tras autorización

- Revocar las sesiones vigentes de las cuentas afectadas usando parámetros SQL sobre IDs verificados, en una transacción; no enviar IDs recibidos de un cliente como autoridad. Puede emplearse `DELETE FROM auth_sessions WHERE user_id = ?` mediante una herramienta administrativa que enlace el parámetro. Si se autoriza cerrar todas las sesiones, hacerlo explícitamente en la base confirmada, nunca como efecto secundario de abrir la app. La tabla de actividad se elimina por cascada.
- El titular con contraseña actual puede usar el nuevo `POST /api/auth/password`, desde su sesión y con CSRF. El servicio verifica la credencial, usa Argon2id con sal nueva y revoca las demás sesiones en una transacción. No existe una pantalla ni recuperación por correo añadida en esta fase.
- Si el titular no conserva su contraseña, preparar un procedimiento administrativo de verificación de identidad y restablecimiento antes de ejecutar nada. Nunca sustituir hashes con SHA-256 simple, texto claro o una contraseña compartida. No enviar credenciales por logs/URL ni modificar finanzas para recuperar acceso.
- Rotar solo secretos de proveedores confirmados, desde sus emisores y mediante un canal autorizado. No se identificó uno concreto que rotar en esta revisión. Renovar CSRF por sí solo no reemplaza la revocación de la sesión.
- Verificar rechazo de cookies anteriores y de la contraseña antigua, login con la nueva y finanzas idénticas. No publicar las evidencias de esas credenciales. Vigilar también copias antiguas: restaurarlas puede reintroducir sesiones y contraseñas expuestas.

## 3. Preparar un saneamiento coordinado

Antes de autorizar: ventana sin escrituras Git, todos los responsables informados, inventario de referencias y rutas históricas, espejo de recuperación privado, datos locales fuera del clon de saneamiento y versión revisada de `git-filter-repo`. No ejecutar esto en el árbol de trabajo con los archivos privados locales.

Comprobaciones de solo lectura propuestas:

```powershell
git status --short
git ls-files -- database/backups
git log --all --format="%h %cs" -- database/backups
git for-each-ref --format="%(refname)"
git rev-list --objects --all -- database/backups
```

La lista actual de archivos rastreados debe quedar vacía. Las otras órdenes todavía pueden encontrar historia. Guardar listados de evidencia de forma privada; no mostrar `git show` de JSON/SQLite en una terminal compartida o informe público.

En **un espejo nuevo y privado**, tras autorización explícita, revisar antes todas las rutas históricas, incluidas variantes renombradas. Propuesta de filtrado para las rutas confirmadas:

```powershell
git filter-repo --path database/backups/ --path android/.qtcreator/project.json.user --invert-paths
```

Es una propuesta, **no se ejecutó**. La configuración Qt se incluye por su carácter privado del equipo, sin afirmar que contuviera una contraseña. Si el inventario descubre otras rutas, el filtro deberá ampliarse antes de publicar nada. No usar `git push --mirror` de manera indiscriminada: puede eliminar referencias remotas ajenas al alcance. El conjunto exacto de ramas/tags y el mecanismo de actualización forzada se revisarán y autorizarán después de verificar el espejo saneado.

Para el literal del encabezado MySQL, no eliminar el archivo de código completo del historial. Preparar fuera del repositorio una regla privada de sustitución exacta, con permisos restrictivos y sin imprimir el valor. Revisar y autorizar `git-filter-repo --replace-text` junto al filtrado de respaldos en el espejo. Validar que la sustitución no cambie otras cadenas/código ni deje el literal en otras rutas o referencias. La regla también contiene el secreto y requiere custodia y retirada controlada después del saneamiento.

## 4. Verificar y coordinar la sustitución

1. En el espejo filtrado, recorrer **todas** las ramas, etiquetas y referencias retenidas: rutas, nombres renombrados, blobs de los archivos inventariados y patrones de secretos; no basta con `git ls-files` o con HEAD. Confirmar también ausencia de referencias de respaldo creadas por herramientas.
2. Probar el código limpio con datos ficticios y comprobar que `.gitignore` protege nuevas copias y diarios. Comparar inventario local privado fuera del espejo: el saneamiento no debe borrar esos archivos.
3. Después de la publicación autorizada, clonar desde el remoto en una carpeta nueva y repetir las comprobaciones sobre todas sus referencias accesibles. Verificar permisos/visibilidad del proveedor y artefactos aparte de Git.
4. Revisar referencias de PR, forks y cachés del proveedor. Pueden requerir gestión del administrador o solicitudes al proveedor; la actualización de ramas normales no demuestra que esas copias hayan desaparecido.
5. Pedir a colaboradores que sustituyan sus clones siguiendo la coordinación aprobada. Un merge o push desde un clon antiguo puede reintroducir la historia. Conservar el espejo de evidencia solo durante el plazo privado acordado; su destrucción requerirá una decisión separada.

Reescribir historia **no revoca credenciales, no recupera descargas ajenas y no garantiza borrado de forks, clones ni cachés**. Mantener esa limitación en el cierre del incidente. No ejecutar limpieza agresiva de objetos ni destruir la evidencia para simular que desapareció el riesgo.

## Criterio de cierre operativo

Responsables deben confirmar: alcance evaluado; permisos restringidos; sesiones y credenciales necesarias rotadas; pruebas de recuperación y rechazo realizadas; referencias remotas saneadas/verificadas; colaboradores coordinados; copias restantes bajo custodia y limitaciones documentadas. Hasta entonces el riesgo histórico permanece abierto, aunque la fase 3 de implementación haya terminado.

Referencias: [política de datos privados](SEGURIDAD_DATOS_PRIVADOS.md), [auditoría fase 1](AUDITORIA_SEGURIDAD_FASE_1.md) y [auditoría fase 3](AUDITORIA_SEGURIDAD_FASE_3.md).
