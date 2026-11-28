# Convenciones de desarrollo

Flujo práctico de trabajo, actualizado en fase 5 el 28 de noviembre de 2026. Las reglas normativas están en [Estándares de código](ESTANDARES_CODIGO.md); aquí se describe cómo preparar, verificar y revisar un cambio sin repetirlas.

## Antes de editar

1. Leer `AGENTS.md`, [arquitectura](ARQUITECTURA.md), [estructura](ESTRUCTURA_PROYECTO.md) y la auditoría de la fase pertinente. Identificar entradas y consumidores reales, incluidos HTML, eventos y adaptadores.
2. Revisar `git status --short` y respetar cambios ajenos. Las fases o tareas anteriores pueden seguir en el árbol sin commit; no restaurar archivos indiscriminadamente.
3. Delimitar el cambio y sus contratos. Distinguir código propio de vendor, dependencias, archivado, generado y almacenamiento privado.
4. Ejecutar una referencia de pruebas adecuada antes de refactorizar y conservar su resultado. Si una solicitud exige la matriz completa, ejecutarla también antes de cambiar código. No anunciar el resultado de una fase antigua como si fuese una ejecución nueva.

No iniciar `npm start` para preparar una prueba: usa por defecto el almacén real. Los fixtures existentes crean bases temporales o almacenamiento en memoria. Si se compara integridad de archivos reales, hacerlo mediante metadatos/huellas sin mostrarlos ni usarlos como datos ficticios. La actividad del usuario puede cambiar legítimamente esos archivos; no revertirla para hacer coincidir una huella.

## Localizar la responsabilidad

| Cambio | Lugar inicial |
|---|---|
| Regla, estado o cálculo personal/empresarial | Dominio correspondiente, conservando precisión y contrato. |
| Coordinación entre registros relacionados | Servicio/fachada y unidad de trabajo existente. |
| Escritura, revisión o intento incierto del cliente | Repositorio y adaptador de almacenamiento, sin otro store. |
| Consulta SQL, sesión, autorización o HTTP | Módulo privado del servidor y composición protegida. |
| Renderizado, evento o adaptación PC/móvil | Controlador/vista correspondiente, reutilizando comportamiento compartido. |
| Descarga, exportación o formato de documento | Adaptador existente y su contrato de salida; verificar también impresión. |

Si la función es común a PC/móvil, revisar primero los módulos compartidos. No copiar una regla al segundo controlador ni unificar comportamientos que tengan diferencias deliberadas. Registrar módulos nuevos en ambas entradas antes del consumidor, sin cargar `legacy/`.

## Cambios pequeños y comprobables

Separar una modificación funcional de una puramente mecánica cuando sea posible. Después de cada extracción, eliminación o simplificación, comprobar sintaxis, consumidores y el grupo de pruebas afectado. El formato no debe ocultar una modificación de un literal, una transacción o una condición financiera.

Antes de eliminar una variable/importación, comprobar sus referencias reales. Antes de eliminar una función pública, revisar llamadas dinámicas, HTML, configuración, eventos e integraciones. Antes de retirar CSS, revisar también clases generadas y PDF. Que un nombre no aparezca en un import no significa que esté sin uso en scripts clásicos.

Los casos de uso existentes expresan el contrato de persistencia. Por ejemplo, al modificar un abono de deuda, comprobar juntos saldo, abono y egreso asociado; un reintento de respuesta perdida debe conservar su identidad y no crear otro registro. No escribir cada parte por separado para acortar una función.

## Comentarios y contratos durante la edición

Al cambiar una función relevante, actualizar el JSDoc en la misma modificación. Documentar el retorno verdadero, las promesas y los errores que se convierten en resultados, sin prometer una comprobación de tipos no implementada.

Explicar especialmente:

- qué datos puede mutar el candidato y cuándo se publica;
- qué operaciones deben confirmarse juntas;
- qué significa una respuesta incierta y cómo se recupera;
- qué restricción impide omitir una validación o un control de seguridad;
- por qué un fallo opcional se maneja sin invalidar la operación principal.

No agregar comentarios que narren cada asignación. Retirar documentación obsoleta, conservando razones de compatibilidad todavía válidas. Los ejemplos deben usar valores sintéticos o `example.test`, sin datos, claves, rutas privadas o cuerpos reales.

## Calidad automática

Instalar las dependencias del proyecto con el lockfile vigente, por ejemplo:

```powershell
pnpm install --frozen-lockfile
```

Utilizar los scripts de `package.json`, que son la fuente de verdad del alcance:

```powershell
npm run lint
npm run format:check
npm run quality:metrics
npm test
```

`npm run quality` ejecuta `lint` y `format:check`, en ese orden. Las métricas, `npm test` y las suites de navegador se ejecutan aparte; ese agregado no los incluye. Para corregir solo problemas mecánicos revisables:

```powershell
npm run lint:fix
npm run format
```

Revisar el diff después y volver a ejecutar las comprobaciones. No usar una reparación automática para cambiar contratos financieros o eliminar aserciones. El formateador se limita al inventario propio admitido; HTML, CSS, documentación y contenido privado se revisan sin una escritura masiva.

Las métricas pueden compararse con una revisión de fuentes:

```powershell
node scripts/quality/metrics.cjs --ref 82b8c75
node scripts/quality/metrics.cjs --threshold 20
```

El primer comando informa sobre la revisión indicada; el segundo, sobre el árbol de trabajo. Las métricas incluyen los JS propios referenciados desde las tres entradas HTML y los CJS de `scripts/`, excluido `scripts/quality/`. No incluyen pruebas ni todas las fuentes que revisa lint. La comparación lee únicamente fuentes admitidas; no ejecuta módulos ni debe usarse para volcar respaldos históricos. Usar la misma definición, alcance y umbral en ambos lados. Documentar límites de la medición: líneas y cobertura de comentarios no prueban por sí solos mantenibilidad, corrección o seguridad.

## Matriz de pruebas

La suite base sigue siendo:

```powershell
node --test tests/*.test.cjs
node test_shared.js
node test_dates.js
```

Para flujos de cliente con Playwright/Chromium disponibles:

```powershell
npm run test:personal:browser
npm run test:browser
npm run test:accounts:browser
npm run test:sqlite:browser
node tests/backup-controls.browser.cjs
npm run test:adaptive:browser
node tests/phase2-regression.browser.cjs
node tests/security.browser.cjs
```

Según el cambio, verificar fallo y reintento, recarga/reinicio, aislamiento de usuarios, separación Personal/Negocio y PC/móvil. La matriz completa es obligatoria cuando la tarea o el alcance transversal la requieran. Las pruebas de empaquetado verifican recursos web; no equivalen a compilar o probar un APK/Qt en un dispositivo.

Los contadores del runner de Node y los grupos PASS de navegador son resultados distintos. Registrar el comando, el alcance y el resultado realmente observado. Un fallo previo o una limitación se documentan; no se rebajan resultados esperados para declararlo resuelto.

## Revisión antes de entregar

La revisión debe responder a estas preguntas concretas:

1. ¿Las reglas, importes, tipos, formatos y referencias persistidas conservan su contrato?
2. ¿Las escrituras esperan confirmación y una pérdida de respuesta mantiene la recuperación sin duplicados?
3. ¿La sesión decide al dueño, las guardas siguen antes de la ruta y el repositorio autoriza dentro de la transacción?
4. ¿PC/móvil conservan comportamiento, presentación y sus diferencias deliberadas?
5. ¿Los nombres y comentarios aclaran responsabilidades reales, sin secretos ni promesas falsas?
6. ¿Las excepciones de lint tienen alcance y motivo explícitos, y se revisaron imports/variables no usados?
7. ¿Las pruebas nuevas comprueban contratos útiles y todas las comprobaciones anteriores siguen presentes?
8. ¿El diff evita vendor, archivos generados, datos privados y cambios ajenos al objetivo?

Comprobar también el árbol actual sin imprimir contenido privado:

```powershell
git diff --check
git diff --stat
git ls-files -- database/backups
git diff --cached --stat
```

El listado de respaldos rastreados debe estar vacío. Estas comprobaciones no sanean el historial, no rotan credenciales y no autorizan un commit, push, despliegue o migración. Conservar esos límites de autorización.

## Entrega y continuidad

Informar qué cambió y por qué, archivos afectados, pruebas ejecutadas, riesgos y límites. Si se mantuvo una deuda técnica para respetar compatibilidad, nombrarla con precisión. Evitar resultados globales como «cero complejidad» o «seguridad completa» derivados de una sola herramienta.

Consultar [la política de datos privados](SEGURIDAD_DATOS_PRIVADOS.md) y [el plan de exposición histórica](PLAN_RESPUESTA_EXPOSICION.md) para actuaciones administrativas. Los pendientes de credenciales, HTTPS, CSP, enumeración y cifrado no desaparecen por limpiar el código. No iniciar una fase siguiente ni una publicación sin su autorización correspondiente.
