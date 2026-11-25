# Guía de uso de Mi Negocio

Esta guía describe las funciones disponibles actualmente en **Mi Negocio** para PC y móvil. Los nombres de las secciones pueden acomodarse de forma distinta según el tamaño de pantalla, pero usan los mismos datos y reglas.

## Antes de empezar

1. Abre MiBolsillo con el servidor local si necesitas guardar en SQLite y entra con tu cuenta.
2. Selecciona **Mi Negocio**. Si aún no tienes un negocio, elige **Crear mi negocio** y completa su nombre y datos de contacto.
3. Usa el selector **Negocio activo** para cambiar de negocio. Productos, contactos y operaciones quedan separados por negocio.
4. Espera el aviso de confirmación después de guardar. Si aparece un error, revisa los datos y vuelve a intentar; no cierres la pestaña si necesitas recuperar lo escrito.

Los valores monetarios se registran en COP. En cantidades y precios con decimales usa punto decimal y no escribas separadores de miles; por ejemplo, `1250.50`.

## Inicio

Muestra un resumen del negocio: ventas netas, utilidad, cuentas por cobrar y por pagar, gráfico de ventas/costos y recordatorios de inventario bajo. Los accesos rápidos llevan a inventario, compras, ventas, proveedores, utilidad, caja y gastos.

Usa **Período** para consultar el mes actual, el mes anterior, el año actual o el histórico. El selector afecta los resultados que se identifican como correspondientes al período; las cuentas pendientes y otros saldos actuales pueden abarcar todos los períodos.

## Inventario

### Registrar productos e insumos

Pulsa **Nuevo producto** y completa nombre, tipo, unidad de medida, costo unitario, precio de venta, mínimo de existencias y, si corresponde, proveedor. En un producto nuevo también puedes indicar la existencia inicial.

- **Producto** suele ser el artículo que vendes o que obtienes al fabricar.
- **Materia prima** suele ser un insumo consumido durante la fabricación.

Ambos se administran como artículos de inventario. En la versión actual, la selección de una receta no obliga a que el ingrediente esté marcado como materia prima; revisa cuidadosamente los artículos elegidos.

### Consultar y modificar existencias

La vista **Existencias** muestra catálogo, tipo, unidades disponibles, costo, precio y alertas. Usa **Editar** para actualizar los datos del catálogo o **Movimiento** para registrar una variación.

Desde **Movimiento** en el producto puedes registrar:

- **Entrada:** suma la cantidad indicada.
- **Salida:** resta la cantidad indicada.
- **Ajustar existencia final:** interpreta la cantidad como el nuevo saldo total, no como una diferencia.

Indica la fecha y un motivo para que el movimiento quede identificado. No se permite dejar existencias negativas. Los movimientos se conservan en los datos de la aplicación para mantener los registros de inventario, pero ya no se muestra una pantalla de historial.

## Compras

Pulsa **Nueva compra**, selecciona un proveedor y agrega uno o más productos con cantidad, precio antes de impuestos, descuento e impuesto. El costo puede proponerse a partir del costo unitario del producto; revísalo antes de confirmar.

Completa fecha, vencimiento, condición y medio de pago. **Pago inicial COP** determina cuánto se paga al registrar:

- Si escribes un monto, se registra ese pago y la diferencia queda pendiente.
- Si lo dejas vacío con condición **Crédito**, el comportamiento actual registra cero como pago inicial; el total queda pendiente.
- Si lo dejas vacío con condición **Contado**, el comportamiento actual toma el total como pagado.

Al confirmar, la compra aumenta las existencias, actualiza el costo promedio del producto y crea el saldo por pagar cuando hay una diferencia. Para abonar después, abre la compra y pulsa **Registrar pago**. El pago no puede superar el saldo pendiente.

La compra confirmada conserva su historial. Si necesitas corregirla, la anulación está sujeta a que el inventario pueda revertirse sin dejar existencias negativas.

## Proveedores y clientes

En **Proveedores** puedes alternar entre las pestañas **Proveedores** y **Clientes**. Usa **Nuevo proveedor** o **Nuevo cliente** para guardar nombre, identificación y datos de contacto. La identificación del cliente es obligatoria; la del proveedor es opcional.

Desde cada fila puedes consultar, editar o eliminar/archivar. Si el contacto ya tiene operaciones, se archiva para conservar las relaciones y el historial. En el directorio de proveedores puedes consultar compras y saldos asociados; desde **Cuentas por pagar** se gestionan obligaciones.

## Ventas

Pulsa **Nueva venta** o **Confirmar venta**:

1. Selecciona un cliente existente.
2. Añade productos disponibles, cantidades, precios, descuentos e impuestos.
3. Revisa el resumen de base, descuento, impuestos y total.
4. Indica fecha, vencimiento, condición de pago, medio de pago y, si aplica, pago inicial.
5. Confirma la venta.

El sistema verifica existencias y las descuenta al confirmar. Un pago parcial deja el resto en **Por cobrar**. Si el pago inicial queda vacío, **Crédito** registra cero y **Contado** registra el total; si escribes un monto, ese importe define lo pagado. Registra abonos posteriores desde la venta o desde **Por cobrar**.

Puedes consultar e imprimir el comprobante o descargarlo en PDF. Es un comprobante interno **sin validez fiscal**. Para borradores y documentos de facturación simulada usa **Facturación simulada**; no equivale a facturación electrónica validada por la DIAN. Las ventas confirmadas se corrigen mediante anulación, no editando silenciosamente sus líneas.

## Productos / utilidad

Consulta costo unitario, precio actual, utilidad estimada por unidad, margen y existencias del catálogo. Los indicadores del período muestran utilidad bruta, costo histórico de lo vendido y valor potencial de venta del inventario.

La utilidad unitaria usa los costos y precios actuales del catálogo. La utilidad bruta del período utiliza el costo histórico de los productos vendidos; no es una cotización ni reemplaza la contabilidad formal.

## Caja / flujo de efectivo

Muestra cobros y pagos registrados, entradas, salidas, flujo neto, gráfico por período y medio de pago. Incluye pagos iniciales y abonos posteriores, así como ingresos y gastos registrados.

Este flujo refleja movimientos registrados en la aplicación. No incluye un saldo inicial bancario y no sustituye un extracto o conciliación bancaria. Un cobro de una venta anterior cambia la caja y la cuenta por cobrar; no debe contarse otra vez como una venta.

## Gastos del negocio

Pulsa **Registrar gasto** y completa descripción, categoría, monto, fecha y medio de pago. También puedes relacionarlo con un proveedor. Para dejar un gasto parcialmente o totalmente pendiente, selecciona **Crédito**, indica el proveedor y registra el pago inicial; el saldo queda en **Por pagar**. Un gasto a crédito requiere proveedor.

Registra pagos posteriores desde la obligación correspondiente. Puedes consultar, editar o anular gastos; la anulación conserva el historial y registra la reversión aplicable.

## Otros movimientos

Esta sección reúne las pestañas **Cobros y pagos**, **Gastos** y **Otros ingresos**:

- **Cobros y pagos** es una consulta del flujo registrado. Los botones **Gasto** e **Ingreso** permiten crear los movimientos correspondientes.
- **Gastos** permite consultar y administrar gastos por fecha, categoría, descripción y monto.
- **Otros ingresos** permite registrar un ingreso adicional con descripción, categoría, monto, fecha y medio de pago.

No dupliques aquí pagos de ventas, compras o gastos que ya se registraron desde sus documentos: utiliza **Registrar pago** en el documento para mantener el saldo y el historial relacionados.

## Gestión

### Compras, por cobrar y por pagar

- **Compras:** consulta documentos, totales, pagos y saldos; desde cada compra puedes consultar, registrar un pago, imprimir comprobante o anular cuando sea posible.
- **Por cobrar:** muestra ventas con saldo pendiente, cliente, vencimiento y saldo. Usa **Registrar pago** para añadir un abono.
- **Por pagar:** muestra obligaciones de compras y gastos con proveedor, vencimiento y saldo. Usa **Registrar pago** para abonarlas.

El vencimiento ayuda a identificar obligaciones atrasadas. Los saldos pendientes son actuales y no se limitan necesariamente al período elegido en otros informes.

### Empleados

Registra nombre, cargo, datos de contacto, salario de referencia y fecha de ingreso. El salario de referencia es informativo. Desde el empleado activo puedes **Registrar pago**, indicar monto, concepto, período, fecha y medio de pago, y consultar o imprimir el comprobante.

Esta función es un registro administrativo: no calcula prestaciones, seguridad social ni liquidación legal de nómina.

### Producción: recetas y lotes

Para fabricar productos mediante insumos:

1. Registra primero en Inventario el producto terminado y cada insumo, con sus unidades, existencias y costos.
2. En **Gestión > Producción**, pulsa **Receta**. Indica nombre, producto a fabricar, cantidad base y los ingredientes con la cantidad requerida para esa base.
3. Guarda la receta. Comprueba que cada ingrediente, cantidad y unidad representen correctamente tu proceso.
4. Pulsa **Producir** en la receta, indica cantidad del lote y fecha, y confirma.

La aplicación escala los ingredientes según la cantidad solicitada, valida que haya existencias suficientes antes de producir, registra la salida de los insumos, suma el producto fabricado al inventario y calcula un costo unitario. El lote queda en **Lotes fabricados** y conserva una copia de la receta utilizada.

Si falta un insumo, no se completa la producción. La clasificación **Materia prima** es descriptiva: actualmente no impide seleccionar otros tipos de producto como ingrediente, por lo que conviene verificar las selecciones. La fabricación tampoco reemplaza un sistema de planificación de producción ni añade costos indirectos como mano de obra o gastos de fábrica.

### Mi negocio

Permite editar los datos del negocio activo y crear otro negocio. Cada negocio conserva su propio catálogo y operaciones. Un negocio con historial no se puede eliminar desde esta pantalla; así se evitan romper referencias a documentos existentes.

## Informes y herramientas de consulta

Las listas incluyen búsqueda, filtro **Todos / Activos / Archivados o anulados**, paginación y exportación CSV cuando esté disponible. La búsqueda se aplica a la sección abierta. **Consultar** muestra el registro y sus datos relacionados.

En Gestión, **Ver informe de esta sección** abre el informe relacionado con compras, saldos pendientes, personal u operación. Los informes permiten consultar períodos y detalles sin cambiar los movimientos originales.

## Recomendaciones

- Registra proveedores y productos antes de hacer compras; registra clientes y productos antes de vender.
- Mantén unidades de medida consistentes entre la receta, el insumo y la producción.
- Revisa los totales e impuestos antes de confirmar documentos.
- Usa las acciones del documento para pagar o corregirlo; evita crear movimientos duplicados.
- Conserva los comprobantes y revisa que la aplicación confirme cada guardado.
- Mi Negocio es una herramienta de control operativo; los comprobantes y nómina descritos no sustituyen documentos fiscales o contables oficiales.
