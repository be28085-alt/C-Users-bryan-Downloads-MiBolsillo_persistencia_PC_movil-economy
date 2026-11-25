# MiBolsillo desde Qt Creator

Abra `C:\Users\bryan\Downloads\economiapersonal\economy\qt_app\CMakeLists.txt` y seleccione **Desktop Qt 6.12.0 MinGW 64-bit**. Ejecute el destino **GestorFinanciero** con el triángulo verde.

El destino principal inicia el servidor SQLite y abre la aplicación HTML existente en una ventana de Edge/Chrome. Qt es el lanzador; las funciones financieras siguen en `desktop.html`, `mobile.html` y `src/`. El kit instalado no incluye un motor web incrustado. Conserve la carpeta del proyecto y las dependencias Node. Mantenga el servicio abierto durante el uso.

La entrada ahora es **Iniciar sesión / Crear cuenta**. No hay selector PC/celular. La misma pantalla se adapta al ancho sin recargar ni perder formularios. Cada usuario tiene un estado SQLite propio; el inicio no carga demostraciones ni asigna los datos anteriores a una nueva cuenta.

## Compilar

Desde la raíz:

```powershell
.\qt_app\build-windows.ps1
.\qt_app\test-windows.ps1
.\qt_app\build-windows.ps1 -Run
```

El ejecutable habitual queda en `qt_app/build/windows/GestorFinanciero.exe`. La revisión de acceso también se verifica en `qt_app/build/accounts/GestorFinanciero.exe`. En Qt Creator puede usar su directorio `build/creator`.

CMake localiza Node y copia el ejecutable junto a la app, en `runtime/node.exe`, para que Qt Creator funcione aunque su PATH sea distinto. La configuración local `node-runtime.local.cmake` queda excluida de Git. También se puede definir `MIBOLSILLO_NODE`. Se requiere Node.js 24.22 o posterior con SQLite y Argon2id.

`GestorFinanciero.pro` conserva la alternativa qmake. El experimento QML reducido sigue como opción `MIBOLSILLO_BUILD_NATIVE_PROTOTYPE=ON`, desactivada por defecto; no es el destino principal ni utiliza los datos de la app HTML.

## Datos y actualización

La base sigue en `database/mibolsillo.sqlite`. Al iniciar se agregan las tablas de acceso y estados por usuario con respaldo previo si había información antigua. Los datos anteriores permanecen en `app_state`, sin asignación automática. Para verificar al propietario y migrar sin duplicación, siga [Cuentas y migración](../docs/CUENTAS_Y_MIGRACION.md).

Cierre normalmente la ventana del servicio anterior antes de ejecutar la versión actualizada. El lanzador comprueba que el servidor tiene autenticación y no reutiliza una instancia antigua sin ella. Nunca elimina datos para resolver un error de arranque.

## Android

El proyecto de la aplicación HTML es `android/` (Capacitor). Su distribución móvil se ha verificado en navegador, pero el APK independiente aún necesita integrar acceso/SQLite nativo o una API segura, además de disponer de SDK/JDK. El entorno actual no permite generar ni instalar el APK. Las pruebas en ventanas estrechas de Windows no se presentan como pruebas en Android.

Las instrucciones y resultados de las cuentas, la persistencia, el aislamiento y los límites están en [Cuentas y migración](../docs/CUENTAS_Y_MIGRACION.md).
