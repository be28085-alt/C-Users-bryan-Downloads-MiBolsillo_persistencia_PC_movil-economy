#ifndef BUSINESSSERVICE_H
#define BUSINESSSERVICE_H

#include <QObject>
#include <QVariantList>
#include <QVariantMap>
#include <QString>

/**
 * @brief Capa de Lógica de Negocio (Business Logic Layer)
 * Expuesta a la interfaz QML mediante invokable methods.
 * Aplica todas las reglas de negocio especificadas:
 *  1. Compras aumentan existencias de inventario.
 *  2. Ventas disminuyen existencias de inventario.
 *  3. Validación de existencias para no sobre-vender.
 *  4. Ventas a crédito generan saldo pendiente.
 *  5. Abonos disminuyen saldo pendiente del cliente y de la factura.
 *  6. Producción descuenta materias primas y aumenta productos terminados.
 *  7. Separación absoluta entre finanzas personales y empresariales.
 *  8. Cálculos de utilidad basados en costo unitario real (COGS).
 *  9. Uso de transacciones atómicas de base de datos.
 */
class BusinessService : public QObject {
    Q_OBJECT
public:
    explicit BusinessService(QObject* parent = nullptr);

    // --- Negocios ---
    Q_INVOKABLE QVariantList obtenerNegocios(int usuarioId);
    Q_INVOKABLE QVariantMap crearNegocio(int usuarioId, const QString& nombre, const QString& tipo,
                                         const QString& descripcion, const QString& telefono,
                                         const QString& email, const QString& direccion);

    // --- Productos y Materias Primas ---
    Q_INVOKABLE QVariantList obtenerProductos(int negocioId, const QString& tipoFiltro = "ALL");
    Q_INVOKABLE QVariantMap crearProducto(int negocioId, const QString& tipo, const QString& nombre,
                                          const QString& descripcion, double precioCompra, double precioVenta,
                                          double costoUnitario, const QString& unidadMedida, double stock, double stockMinimo);

    // --- Compras (Regla 1: Aumenta stock con transacción) ---
    Q_INVOKABLE QVariantMap registrarCompra(int negocioId, int proveedorId, const QString& fecha,
                                            const QString& observaciones, const QVariantList& detalles);

    // --- Ventas (Reglas 2, 3, 4: Descuenta stock, valida existencias, crédito) ---
    Q_INVOKABLE QVariantMap registrarVenta(int negocioId, int clienteId, const QString& fecha,
                                           const QString& tipoPago, const QString& metodoPago,
                                           const QString& notas, const QVariantList& detalles);

    // --- Créditos y Cobranzas (Regla 5: Abonos reducen saldo) ---
    Q_INVOKABLE QVariantMap registrarAbono(int ventaId, int negocioId, double monto,
                                          const QString& fecha, const QString& metodoPago, const QString& notas);

    // --- Producción y Fórmulas (Regla 6: Consumo de insumos y aumento de producto terminado) ---
    Q_INVOKABLE QVariantMap registrarProduccion(int negocioId, int formulaId, double cantidadProducida,
                                                const QString& fecha, const QString& notas);

    // --- Ganancias y Reportes (Regla 9: Utilidad real basada en COGS) ---
    Q_INVOKABLE QVariantMap calcularGananciasYReportes(int negocioId, const QString& periodoFiltro = "MES_ACTUAL");

signals:
    void operacionExitosa(const QString& mensaje);
    void errorOcurrido(const QString& error);
};

#endif // BUSINESSSERVICE_H
