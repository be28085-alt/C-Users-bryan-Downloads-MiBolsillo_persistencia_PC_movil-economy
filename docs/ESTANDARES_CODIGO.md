# Estándares de código de MiBolsillo

Vigentes desde la fase 5, 28 de noviembre de 2026. Este documento define las reglas del código propio; [Convenciones de desarrollo](CONVENCIONES_DESARROLLO.md) explica cómo aplicarlas. La [arquitectura](ARQUITECTURA.md) y el [mapa del proyecto](ESTRUCTURA_PROYECTO.md) siguen siendo las referencias sobre responsabilidades y rutas.

## Alcance y compatibilidad

Estos estándares se aplican al cliente activo de `src/`, servidor y herramientas de `scripts/`, pruebas propias y configuración de calidad. No autorizan modificar dependencias, `src/vendor/`, salidas `dist/`, salidas generadas de Android/Qt, bases, copias privadas ni implementaciones archivadas. El prototipo nativo y los programas históricos conservan su alcance independiente.

No cambiar por limpieza endpoints, propiedades persistidas, nombres de eventos, columnas, claves de almacenamiento, estados financieros o métodos públicos de `FinanzasCore`. Las diferencias de PC/móvil se mantienen cuando pertenecen a la presentación o al contrato existente. Tampoco se unifican validaciones personales y empresariales solo por su parecido.

## Nombres y responsabilidades

| Elemento | Regla |
|---|---|
| Variables, funciones y parámetros | `camelCase`, con el propósito visible: `expectedRevision`, `pendingPersonal`, `authenticatedUserId`. |
| Clases | `PascalCase`, como `PersonalRepository` y `BusinessService`. |
| Constantes de protocolo o configuración inmutable | `UPPER_SNAKE_CASE`, acotadas al módulo propietario: `WRITE_LOCK_NAME`. No convertir cada `const` local en una constante global. |
| Booleanos | Expresar condición: `hasPendingChanges`, `isArchived`, `readBlocked`. Conservar nombres públicos existentes. |
| Archivos | Respetar las convenciones del directorio y separar responsabilidades reales, sin añadir un archivo por cada función. |
| Idioma | Mantener el vocabulario del módulo. Los contratos personales históricos en español y los empresariales en inglés no se traducen en masa. Comentarios y documentación técnica nuevos se redactan en español. |

Abreviaturas estándar como `id`, `req`, `res`, `db` o `ast` son válidas en su contexto. Evitar nombres genéricos cuando ocultan el propósito; un parámetro público `data` no se renombra sin revisar consumidores. No agregar un `index` global ni otro store para ocultar dependencias.

Los dominios no consultan DOM, HTTP, WebStorage ni SQLite. Los comandos reciben candidatos explícitos; la aplicación coordina y los repositorios gestionan la unidad de trabajo. El código del servidor y sus consultas permanecen fuera de los recursos estáticos.

## Formato automatizado

La configuración versionada es la autoridad: `.editorconfig`, `.prettierrc.json`, `.prettierignore` y `eslint.config.cjs`. No añadir preferencias contradictorias por archivo sin una razón técnica revisada.

- JavaScript: dos espacios, punto y coma, comillas simples, comas finales permitidas y finales LF. Prettier usa un ancho orientativo de 100 caracteres; no es una obligación de cortar cadenas o plantillas que cambiaría su valor.
- UTF-8 y nueva línea final. Los archivos `cmd`/`bat` conservan CRLF según EditorConfig.
- No recortar automáticamente espacios finales dentro de plantillas HTML/SQL o saltos de Markdown. No reordenar reglas CSS ni atributos/plantillas como una corrección de formato incidental.
- `embeddedLanguageFormatting: off` conserva fuera del formateo automático los lenguajes embebidos. El inventario de formato es `src/**/*.js`, `scripts/**/*.cjs`, `tests/**/*.cjs`, `*.cjs`, `test_*.js`, `package.json` y `.prettierrc.json`, sujeto a `.prettierignore`. HTML, CSS, documentación, datos, vendor, legacy y generado quedan fuera de esa aplicación masiva; otros JSON de configuración no se incluyen implícitamente.

Usar los scripts del proyecto. No sustituirlos por `prettier --write .`, un formateo recursivo sin alcance o una reparación forzada de dependencias. Si el formateador señala un archivo excluido deliberadamente, comprobar el inventario antes de ampliar el alcance.

## Funciones, constantes y duplicación

Cada función debe expresar una responsabilidad comprensible. Extraer un ayudante cuando permite nombrar una regla, aislar una validación o reutilizar exactamente el mismo comportamiento. No fragmentar una función para mejorar únicamente un contador.

Preferir retornos tempranos y condiciones con nombre si aclaran ramas complejas. Las comparaciones siguen `eqeqeq`, salvo la comprobación de ausencia `value == null` cuando corresponde al contrato de la regla configurada. Declarar con `const` lo que no se reasigna y usar `let` cuando sea necesario; no introducir `var` en código propio.

Mantener los valores junto a su responsabilidad: sesiones y límites privados en seguridad; precisión y límites de dominio en su módulo; tokens cromáticos en `styles/palette.css`. No crear un archivo gigante de constantes ni compartir configuración privada con el navegador. El nombre del bloqueo común y las claves de protocolo no se cambian para hacerlos más descriptivos.

Antes de reutilizar código parecido, comparar límites, precisión, valores por defecto, orden, tipos y errores. En MiBolsillo los importes de negocio y los personales tienen contratos diferentes. No reemplazar la aritmética decimal existente por `Number`, ni interpretar entradas monetarias con `parseFloat` como una limpieza de estilo.

```javascript
// Incorrecto para una entrada empresarial localizada: trunca su interpretación.
const amount = parseFloat('10.490,00');

// Correcto en el adaptador empresarial existente, sin cambiar su contrato.
const businessAmount = BusinessNumbers.parseMoneyInput('10.490,00');
```

## Comentarios y JSDoc

Comentar decisiones, restricciones y consecuencias: por qué se conserva un historial, qué debe confirmarse atómicamente o por qué un aviso entre pestañas es opcional. El comentario debe seguir siendo verdadero después de editar el código. No describir como implementado un plan pendiente.

```javascript
// Incorrecto: repite la instrucción y no explica el riesgo.
// Guardar el estado.

// Correcto: documenta la garantía que debe conservar el escritor.
// Publicar solo después de confirmar SQLite; el formulario conserva el intento incierto.
```

Documentar mediante JSDoc las API relevantes, repositorios, servicios y algoritmos con parámetros, retorno, promesas, efectos secundarios y rechazos reales. Usar `@typedef` para estructuras compartidas que aclaren el contrato. No es necesario documentar cada callback trivial.

El contrato de `PersonalRepository.escribirPersonal` ilustra la distinción importante:

```javascript
/**
 * @template Result
 * @param {function(object): Result} mutate Mutación síncrona del candidato, sin E/S.
 * @returns {Promise<Result|PersonalWriteFailure>} Resultado confirmado o error público.
 */
```

No anotar `@throws` para afirmar que todo rechazo de validación se propaga si el método lo convierte en `{ error }`. Los adaptadores o puertos aún pueden rechazar: documentar ese límite. Tampoco anotar `Promise<void>` cuando el llamador recibe una confirmación, entidad o booleano.

JSDoc no reemplaza validación del servidor, comprobación de tipos o pruebas. Las herramientas actuales no certifican que una anotación sea semánticamente verdadera ni convierten el proyecto a TypeScript. Nunca poner contraseñas, cookies, tokens o datos financieros reales en ejemplos o comentarios.

## Errores, asincronía y persistencia

Esperar las operaciones asíncronas antes de mostrar éxito o depender de su estado. Conservar el `await` que permite al manejador central capturar un rechazo. En `finally`, rehabilitar controles y liberar el estado de envío necesario; no convertir cualquier fallo en éxito.

```javascript
// Incorrecto: la promesa puede fallar después del mensaje.
Finanzas.actualizarPresupuesto('1000.00');
pcApp.showToast('Presupuesto guardado');

// Correcto dentro de un handler de PC que conserva su formulario.
const result = await Finanzas.actualizarPresupuesto('1000.00');
if (result.error) {
  pcApp.showToast(result.error);
  return;
}
pcApp.showToast('Presupuesto guardado');
```

El ejemplo usa un importe ficticio; no es una instrucción para ejecutar cambios sobre datos reales. En móvil se conserva el método de presentación correspondiente y las reglas del mismo caso de uso.

Un `catch` vacío solo es admisible si una explicación local y verificable justifica la degradación. La pérdida de una notificación opcional de `BroadcastChannel` no revierte un COMMIT; la pérdida de una escritura o de la aplicación de estado sí exige conservar recuperación y comunicar el fallo. No usar un `catch` para activar localStorage después de fallar SQLite.

Una respuesta incierta no demuestra que el COMMIT se revirtió. Conservar clave, contenido y revisión del intento original, sin ejecutar otra intención ni rebases silenciosos. Los borradores de sesión siguen en memoria, para la misma cuenta y durante 15 minutos; no guardarlos en un mecanismo persistente para simplificar el código.

## Seguridad y registros

La identidad del propietario se resuelve en el servidor. No confiar en IDs, roles o permisos del cuerpo. Las consultas sensibles se parametrizan y se ejecutan en el repositorio privado con el usuario ya autenticado; no se trasladan a la vista ni al cliente.

```javascript
// Incorrecto: el cliente decide el dueño y se concatena entrada en SQL.
db.prepare('SELECT raw FROM user_states WHERE user_id=' + body.userId).get();

// Correcto solo dentro del repositorio privado, con identidad resuelta por servidor.
db.prepare('SELECT raw FROM user_states WHERE user_id=?').get(authenticatedUserId);
```

Conservar la autorización transaccional, CSRF, cuotas, cookies, validadores, rutas canónicas y recibos de las fases anteriores. No crear un atajo que invoque un controlador sin las guardas de composición.

No registrar cuerpos, estados completos, contraseñas, cookies, tokens, SQL con datos, rutas privadas o excepciones originales en registros compartidos. Usar mensajes públicos y metadatos de auditoría permitidos con correlación. Los mensajes operativos necesarios de una CLI no son automáticamente depuración eliminable.

## HTML, CSS y pruebas

Conservar semántica, accesibilidad, IDs usados por controladores y comportamiento responsivo. Antes de quitar un selector, buscar plantillas, eventos, clases construidas dinámicamente y usos de impresión. `.br-header`, por ejemplo, se usa en PDF aunque no aparezca en la pantalla normal.

No eliminar `!important` por una regla numérica: `[hidden]`, reducción de movimiento y correcciones responsivas pueden justificarlo. No reordenar la cascada ni cambiar tokens, colores, distribución o texto como parte de esta fase.

Las pruebas deben separar preparación, acción y comprobación, usar nombres de escenario y datos sintéticos, y verificar el estado persistido cuando el caso lo exige. Los fixtures comparten herramientas técnicas cuando corresponde, sin depender del orden de ejecución. No quitar aserciones para adaptar un fallo a la implementación.

Las comprobaciones de arquitectura verifican límites concretos e imports literales; no prueban todas las dependencias dinámicas. Los callbacks Playwright corren en el navegador aunque su archivo sea CommonJS; los globals explícitos de lint no sustituyen esa comprobación de contexto.

## Herramientas y excepciones

Las versiones de desarrollo se fijan en `package.json` y el lockfile: ESLint 10.15.0, `@eslint/js` 10.0.1, `globals` 17.14.0 y Prettier 3.10.1. Son herramientas de desarrollo, no dependencias del cliente distribuido.

La sintaxis de configuración se documenta en [ESLint](https://eslint.org/docs/latest/use/configure/configuration-files) y [Prettier](https://prettier.io/docs/configuration). El comportamiento aplicado al proyecto lo determinan sus archivos versionados; consultar una recomendación externa no autoriza ampliar su alcance ni ocultar errores.

ESLint combina reglas recomendadas con variables/importaciones sin uso, bloques vacíos, `curly` para cuerpos de varias líneas, comparaciones, `no-var` y `prefer-const`. `lint` y `lint:fix` revisan `src`, `scripts`, `tests`, `eslint.config.cjs`, `test_shared.js` y `test_dates.js`, sujetos a las exclusiones de la configuración. Ambos comandos rechazan advertencias mediante `--max-warnings=0`.

Los archivos `src/**/*.js` usan el entorno de scripts clásicos del navegador; los CJS propios y `test_*.js`, CommonJS/Node. `tests/*.browser.cjs` añade globals de navegador a todo el archivo para sus callbacks Playwright: lint no distingue por sí solo el contexto de cada callback. Se excluyen `node_modules`, `src/vendor`, `legacy`, `database`, `dist`, `tmp`, `android` y `qt_app`. No desactivar reglas globalmente para obtener un resultado verde.

Las dos excepciones locales actuales de `no-control-regex` corresponden al rechazo de caracteres de control en unidades y XML. Deben seguir limitadas a la línea, con justificación. Toda excepción nueva requiere identificar por qué el código es correcto; una directiva que ya no se use debe retirarse.

`quality:metrics` mide fuentes con AST, documentación adyacente y complejidad según su definición explícita. Se distinguen envoltorios IIFE de módulo y funciones internas. Una función sobre el umbral es un diagnóstico para revisión, no una autorización para cambiar finanzas ni una advertencia que deba esconderse. El crecimiento de comentarios o archivos no demuestra por sí solo mayor calidad.

La [guía práctica](CONVENCIONES_DESARROLLO.md) contiene la secuencia de comandos y la lista de revisión. El informe de [fase 5](AUDITORIA_FASE_5.md) registra resultados y limitaciones; los riesgos históricos, credenciales, HTTPS, CSP, enumeración y cifrado siguen en sus documentos de seguridad.
