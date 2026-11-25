# MiBolsillo para Android y Google Play

El proyecto Android Capacitor está en `android/` y conserva las fuentes HTML de MiBolsillo. La entrada actual muestra el acceso a la cuenta; con backend disponible, una sola pantalla financiera se adapta al ancho sin selector ni recarga. El APK independiente todavía necesita integrar el backend de cuentas/SQLite nativo o una API segura: no está listo para utilizar las cuentas localmente ni para publicar. Consulte [Cuentas y migración](CUENTAS_Y_MIGRACION.md).

## Estado comprobado

- El empaquetador `scripts/build-android-web.cjs` copia la entrada adaptable y las dependencias declaradas por ambas interfaces a `dist/android-web/`. Los módulos financieros se incluyen sin reescribirlos. No incluye código archivado, pruebas, SQL ni archivos personales.
- Chart.js y su licencia se incluyen localmente. Las páginas empaquetadas usan fuentes del sistema para evitar depender de Google Fonts al arrancar. Los HTML web originales se conservan.
- Capacitor carga el contenido incluido desde `https://localhost`, sin servidor remoto ni HTTP inseguro. Mantener ese origen en futuras versiones evita cambiar accidentalmente el almacenamiento local.
- El [servidor local SQLite](SQLITE.md) guarda estados separados por usuario en el computador. No se incluye en Android. El paquete estático sin API de acceso muestra el error de conexión y bloquea las finanzas privadas; no utiliza `localStorage` como sustituto de una cuenta autenticada. La integración nativa y su migración siguen pendientes.
- Proyecto nativo generado y sincronizado. Android mínimo: API 24; compilación y destino: API 36. Nombre provisional: MiBolsillo; identificador provisional: `com.mibolsillo.app`.
- La compilación de APK se intentó, pero este equipo no dispone de Java/JAVA_HOME ni se encontró el SDK Android. No se ha generado un APK/AAB ni probado la aplicación en un dispositivo Android.
- Verificación: 58 pruebas Node y las comprobaciones de compatibilidad aprobadas. Sobre el paquete web se verificaron en Chrome los flujos personales y empresariales completos de PC (1366 px) y móvil (390 px), incluida persistencia tras recarga, operaciones, descargas y cambio de plataforma. Estas pruebas no sustituyen la comprobación en Android WebView.

## Preparación y compilación

Instale Android Studio compatible con Capacitor 8, su JDK y el SDK Android 36. Configure `JAVA_HOME` y la ubicación del SDK. Instale las dependencias JavaScript con `pnpm install --frozen-lockfile` usando pnpm 11.25.0 y Node.js compatible con Capacitor 8. También es posible utilizar npm, aunque el archivo de bloqueo de este repositorio corresponde a pnpm.

Desde la raíz:

```sh
npm run android:sync
npm run android:open
```

`android:sync` reconstruye los recursos y actualiza el proyecto nativo. Ejecútelo cada vez que cambie la web; no edite los recursos generados dentro de `android/app/src/main/assets/public/`.

Para una compilación de prueba en Windows, desde `android/`:

```powershell
.\gradlew.bat assembleDebug
```

Con Android Studio y un teléfono/emulador, verifique los flujos antes de preparar un lanzamiento firmado. Google Play utiliza el paquete de distribución AAB; Android Studio permite generarlo con su asistente de firma. Las claves de firma no se guardan en Git.

## Trabajo pendiente antes de distribuir

El objetivo de persistencia en Android es guardar en SQLite nativo y sincronizar con una cuenta en la nube. La arquitectura, migración, respaldos y fases pendientes se describen en el [plan de almacenamiento local y en la nube](ALMACENAMIENTO_LOCAL_Y_NUBE.md). El servidor SQLite para uso web local ya tiene una implementación separada; SQLite nativo Android y la nube todavía no están implementados.

1. Confirmar identificador definitivo, titular y nombre comercial antes de la primera publicación. El identificador actual es provisional y no acredita disponibilidad en Google Play.
2. Probar en Android todas las funciones personales y empresariales, el teclado, el botón Atrás, la rotación, la pantalla completa, Web Locks y el funcionamiento sin red.
3. Adaptar y probar las descargas CSV/JSON/PDF/XML, las ventanas de consulta y la impresión. Actualmente usan APIs del navegador; su funcionamiento en Chrome de escritorio no demuestra que funcionen en Android WebView. No se han eliminado estas acciones.
4. Validar la persistencia tras cerrar, reiniciar y actualizar la app; definir copias/restauración y si se necesita almacenamiento nativo. Los datos del navegador web no se transfieren automáticamente a la instalación Android. No hay sincronización entre dispositivos.
5. Sustituir los iconos y recursos de lanzamiento de la plantilla; preparar ficha, capturas, contacto, política de privacidad y declaraciones de datos según el funcionamiento final.
   Preparar también la bienvenida y el estado inicial para nuevos usuarios: la web actual incluye datos personales de demostración.
6. Crear/verificar la cuenta de Play Console, firmar el AAB y realizar las pruebas exigidas antes de solicitar publicación. La aprobación depende de Google.

Al 14-11-2026, la documentación de Google exige API 36 para nuevas apps Android de teléfonos. Las cuentas personales creadas después del 13-11-2023 deben completar una prueba cerrada con al menos 12 participantes durante 14 días continuos antes de solicitar acceso a producción. Compruebe las exigencias de su cuenta al presentar la app.

## Fuentes

- [Instalación y entorno de Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Configuración de Capacitor](https://capacitorjs.com/docs/config)
- [Publicación de Capacitor en Google Play](https://capacitorjs.com/docs/android/deploying-to-google-play)
- [Nivel de API exigido por Google Play](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Pruebas para cuentas personales nuevas](https://support.google.com/googleplay/android-developer/answer/14151465)
