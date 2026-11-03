#include "services/BusinessService.h"
#include "data/DatabaseManager.h"
#include <QSqlQuery>
#include <QSqlError>
#include <QDate>
#include <QDebug>

BusinessService::BusinessService(QObject* parent) : QObject(parent) {}

QVariantList BusinessService::obtenerNegocios(int usuarioId) {
    QVariantList lista;
    QSqlQuery query(DatabaseManager::instance().database());
    query.prepare("SELECT id, nombre, tipo, descripcion, telefono, email, direccion, estado FROM negocio WHERE usuario_id = :uid ORDER BY id ASC");
    query.bindValue(":uid", usuarioId);

    if (query.exec()) {
        while (query.next()) {
            QVariantMap item;
            item["id"] = query.value("id").toInt();
            item["nombre"] = query.value("nombre").toString();
            item["tipo"] = query.value("tipo").toString();
            item["descripcion"] = query.value("descripcion").toString();
            item["telefono"] = query.value("telefono").toString();
            item["email"] = query.value("email").toString();
            item["direccion"] = query.value("direccion").toString();
            item["estado"] = query.value("estado").toString();
            lista.append(item);
        }
    } else {
        qWarning() << "[BusinessService] Error al obtener negocios:" << query.lastError().text();
    }
    return lista;
}

QVariantMap BusinessService::crearNegocio(int usuarioId, const QString& nombre, const QString& tipo,
                                          const QString& descripcion, const QString& telefono,
                                          const QString& email, const QString& direccion) {
    QVariantMap res;
    QSqlQuery query(DatabaseManager::instance().database());
    query.prepare("INSERT INTO negocio (usuario_id, nombre, tipo, descripcion, telefono, email, direccion, estado) "
                  "VALUES (:uid, :nom, :tipo, :desc, :tel, :mail, :dir, 'ACTIVO')");
    query.bindValue(":uid", usuarioId);
    query.bindValue(":nom", nombre);
    query.bindValue(":tipo", tipo);
    query.bindValue(":desc", descripcion);
    query.bindValue(":tel", telefono);
    query.bindValue(":mail", email);
    query.bindValue(":dir", direccion);

    if (query.exec()) {
        res["success"] = true;
        res["id"] = query.lastInsertId().toInt();
        emit operacionExitosa("Negocio creado exitosamente");
    } else {
        res["success"] = false;
        res["error"] = query.lastError().text();
        emit errorOcurrido(res["error"].toString());
    }
    return res;
}

QVariantList BusinessService::obtenerProductos(int negocioId, const QString& tipoFiltro) {
    QVariantList lista;
    QSqlQuery query(DatabaseManager::instance().database());
    QString sql = "SELECT id, tipo, nombre, descripcion, precio_compra, precio_venta, costo_unitario, unidad_medida, stock, stock_minimo, estado FROM producto WHERE negocio_id = :nid";
    if (tipoFiltro == "PRODUCTO") {
        sql += " AND tipo = 'PRODUCTO'";
    } else if (tipoFiltro == "MATERIA_PRIMA") {
        sql += " AND tipo = 'MATERIA_PRIMA'";
    }
    sql += " ORDER BY nombre ASC";

    query.prepare(sql);
    query.bindValue(":nid", negocioId);

    if (query.exec()) {
        while (query.next()) {
            QVariantMap item;
            item["id"] = query.value("id").toInt();
            item["tipo"] = query.value("tipo").toString();
            item["nombre"] = query.value("nombre").toString();
            item["descripcion"] = query.value("descripcion").toString();
            item["precioCompra"] = query.value("precio_compra").toDouble();
            item["precioVenta"] = query.value("precio_venta").toDouble();
            item["costoUnitario"] = query.value("costo_unitario").toDouble();
            item["unidadMedida"] = query.value("unidad_medida").toString();
            item["stock"] = query.value("stock").toDouble();
            item["stockMinimo"] = query.value("stock_minimo").toDouble();
            item["estado"] = query.value("estado").toString();
            lista.append(item);
        }
    }
    return lista;
}

QVariantMap BusinessService::crearProducto(int negocioId, const QString& tipo, const QString& nombre,
                                           const QString& descripcion, double precioCompra, double precioVenta,
                                           double costoUnitario, const QString& unidadMedida, double stock, double stockMinimo) {
    QVariantMap res;
    QSqlQuery query(DatabaseManager::instance().database());
    query.prepare("INSERT INTO producto (negocio_id, tipo, nombre, descripcion, precio_compra, precio_venta, costo_unitario, unidad_medida, stock, stock_minimo, estado) "
                  "VALUES (:nid, :tipo, :nom, :desc, :pc, :pv, :cu, :um, :stock, :smin, IF(:stock > 0, 'DISPONIBLE', 'AGOTADO'))");
    query.bindValue(":nid", negocioId);
    query.bindValue(":tipo", tipo);
    query.bindValue(":nom", nombre);
    query.bindValue(":desc", descripcion);
    query.bindValue(":pc", precioCompra);
    query.bindValue(":pv", tipo == "MATERIA_PRIMA" ? 0.0 : precioVenta);
    query.bindValue(":cu", costoUnitario > 0 ? costoUnitario : precioCompra);
    query.bindValue(":um", unidadMedida);
    query.bindValue(":stock", stock);
    query.bindValue(":smin", stockMinimo);

    if (query.exec()) {
        res["success"] = true;
        res["id"] = query.lastInsertId().toInt();
        emit operacionExitosa("Artículo guardado correctamente");
    } else {
        res["success"] = false;
        res["error"] = query.lastError().text();
        emit errorOcurrido(res["error"].toString());
    }
    return res;
}

// Regla 1 & 10: Compra confirmada aumenta existencias con transacción SQL
QVariantMap BusinessService::registrarCompra(int negocioId, int proveedorId, const QString& fecha,
                                             const QString& observaciones, const QVariantList& detalles) {
    QVariantMap res;
    auto& db = DatabaseManager::instance();

    if (!db.beginTransaction()) {
        res["success"] = false;
        res["error"] = "No se pudo iniciar la transacción de compra.";
        return res;
    }

    double totalCompra = 0.0;
    for (const auto& item : detalles) {
        QVariantMap m = item.toMap();
        totalCompra += (m["cantidad"].toDouble() * m["precioUnitario"].toDouble());
    }

    QSqlQuery qCabecera(db.database());
    qCabecera.prepare("INSERT INTO compra (negocio_id, proveedor_id, fecha, total, estado, observaciones) "
                     "VALUES (:nid, :pid, :fecha, :total, 'CONFIRMADA', :obs)");
    qCabecera.bindValue(":nid", negocioId);
    qCabecera.bindValue(":pid", proveedorId);
    qCabecera.bindValue(":fecha", fecha.isEmpty() ? QDate::currentDate().toString("yyyy-MM-dd") : fecha);
    qCabecera.bindValue(":total", totalCompra);
    qCabecera.bindValue(":obs", observaciones);

    if (!qCabecera.exec()) {
        db.rollbackTransaction();
        res["success"] = false;
        res["error"] = qCabecera.lastError().text();
        return res;
    }

    int compraId = qCabecera.lastInsertId().toInt();

    // Renglones de compra (Triggers de MySQL actualizan stock y kardex automáticamente)
    for (const auto& item : detalles) {
        QVariantMap m = item.toMap();
        int prodId = m["productoId"].toInt();
        double cant = m["cantidad"].toDouble();
        double precio = m["precioUnitario"].toDouble();
        double subtotal = cant * precio;

        QSqlQuery qDetalle(db.database());
        qDetalle.prepare("INSERT INTO detalle_compra (compra_id, producto_id, cantidad, precio_unitario, subtotal) "
                        "VALUES (:cid, :pid, :cant, :precio, :sub)");
        qDetalle.bindValue(":cid", compraId);
        qDetalle.bindValue(":pid", prodId);
        qDetalle.bindValue(":cant", cant);
        qDetalle.bindValue(":precio", precio);
        qDetalle.bindValue(":sub", subtotal);

        if (!qDetalle.exec()) {
            db.rollbackTransaction();
            res["success"] = false;
            res["error"] = qDetalle.lastError().text();
            return res;
        }
    }

    db.commitTransaction();
    res["success"] = true;
    res["compraId"] = compraId;
    res["total"] = totalCompra;
    emit operacionExitosa("Compra confirmada e inventario actualizado.");
    return res;
}

// Reglas 2, 3, 4, 10: Venta descuenta stock, valida existencias, maneja crédito
QVariantMap BusinessService::registrarVenta(int negocioId, int clienteId, const QString& fecha,
                                            const QString& tipoPago, const QString& metodoPago,
                                            const QString& notas, const QVariantList& detalles) {
    QVariantMap res;
    auto& db = DatabaseManager::instance();

    // Regla 3: Validar antes de iniciar que todas las cantidades están disponibles
    for (const auto& item : detalles) {
        QVariantMap m = item.toMap();
        int prodId = m["productoId"].toInt();
        double cantPedida = m["cantidad"].toDouble();

        QSqlQuery qStock(db.database());
        qStock.prepare("SELECT nombre, stock, unidad_medida FROM producto WHERE id = :pid");
        qStock.bindValue(":pid", prodId);
        if (qStock.exec() && qStock.next()) {
            double stockDisp = qStock.value("stock").toDouble();
            if (stockDisp < cantPedida) {
                res["success"] = false;
                res["error"] = QString("Existencias insuficientes para %1. Disponible: %2 %3")
                               .arg(qStock.value("nombre").toString())
                               .arg(stockDisp)
                               .arg(qStock.value("unidad_medida").toString());
                return res;
            }
        }
    }

    if (!db.beginTransaction()) {
        res["success"] = false;
        res["error"] = "Error al iniciar transacción de venta.";
        return res;
    }

    double totalVenta = 0.0;
    for (const auto& item : detalles) {
        QVariantMap m = item.toMap();
        totalVenta += (m["cantidad"].toDouble() * m["precioUnitario"].toDouble());
    }

    bool esCredito = (tipoPago == "CREDITO");
    double saldoPendiente = esCredito ? totalVenta : 0.0;

    QSqlQuery qVenta(db.database());
    qVenta.prepare("INSERT INTO venta (negocio_id, cliente_id, fecha, tipo_pago, subtotal, total, saldo_pendiente, estado, metodo_pago, notas) "
                  "VALUES (:nid, :cid, :fecha, :tipo, :sub, :tot, :saldo, :est, :met, :notas)");
    qVenta.bindValue(":nid", negocioId);
    qVenta.bindValue(":cid", clienteId);
    qVenta.bindValue(":fecha", fecha.isEmpty() ? QDate::currentDate().toString("yyyy-MM-dd") : fecha);
    qVenta.bindValue(":tipo", tipoPago);
    qVenta.bindValue(":sub", totalVenta);
    qVenta.bindValue(":tot", totalVenta);
    qVenta.bindValue(":saldo", saldoPendiente);
    qVenta.bindValue(":est", esCredito ? "PENDIENTE" : "PAGADA");
    qVenta.bindValue(":met", metodoPago);
    qVenta.bindValue(":notas", notas);

    if (!qVenta.exec()) {
        db.rollbackTransaction();
        res["success"] = false;
        res["error"] = qVenta.lastError().text();
        return res;
    }

    int ventaId = qVenta.lastInsertId().toInt();

    for (const auto& item : detalles) {
        QVariantMap m = item.toMap();
        int prodId = m["productoId"].toInt();
        double cant = m["cantidad"].toDouble();
        double precio = m["precioUnitario"].toDouble();
        double subtotal = cant * precio;

        // Triggers de MySQL descuentan existencias y registran kardex
        QSqlQuery qDet(db.database());
        qDet.prepare("INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal) "
                     "VALUES (:vid, :pid, :cant, :precio, :sub)");
        qDet.bindValue(":vid", ventaId);
        qDet.bindValue(":pid", prodId);
        qDet.bindValue(":cant", cant);
        qDet.bindValue(":precio", precio);
        qDet.bindValue(":sub", subtotal);

        if (!qDet.exec()) {
            db.rollbackTransaction();
            res["success"] = false;
            res["error"] = qDet.lastError().text();
            return res;
        }
    }

    db.commitTransaction();
    res["success"] = true;
    res["ventaId"] = ventaId;
    res["total"] = totalVenta;
    emit operacionExitosa("Venta procesada e inventario actualizado.");
    return res;
}

// Regla 5: Abonos a créditos reducen saldo pendiente
QVariantMap BusinessService::registrarAbono(int ventaId, int negocioId, double monto,
                                            const QString& fecha, const QString& metodoPago, const QString& notas) {
    QVariantMap res;
    QSqlQuery query(DatabaseManager::instance().database());
    query.prepare("INSERT INTO pago_venta (venta_id, negocio_id, monto, fecha, metodo_pago, notas) "
                  "VALUES (:vid, :nid, :monto, :fecha, :met, :notas)");
    query.bindValue(":vid", ventaId);
    query.bindValue(":nid", negocioId);
    query.bindValue(":monto", monto);
    query.bindValue(":fecha", fecha.isEmpty() ? QDate::currentDate().toString("yyyy-MM-dd") : fecha);
    query.bindValue(":met", metodoPago);
    query.bindValue(":notas", notas);

    if (query.exec()) {
        res["success"] = true;
        emit operacionExitosa("Abono registrado correctamente.");
    } else {
        res["success"] = false;
        res["error"] = query.lastError().text();
        emit errorOcurrido(res["error"].toString());
    }
    return res;
}

// Regla 6: Producción descuenta materias primas y aumenta producto terminado
QVariantMap BusinessService::registrarProduccion(int negocioId, int formulaId, double cantidadProducida,
                                                 const QString& fecha, const QString& notas) {
    QVariantMap res;
    auto& db = DatabaseManager::instance();

    // Obtener detalles de la receta
    QSqlQuery qForm(db.database());
    qForm.prepare("SELECT producto_id, cantidad_base FROM formula_producto WHERE id = :fid");
    qForm.bindValue(":fid", formulaId);
    if (!qForm.exec() || !qForm.next()) {
        res["success"] = false;
        res["error"] = "Fórmula no encontrada.";
        return res;
    }

    int productoTerminadoId = qForm.value("producto_id").toInt();
    double cantBase = qForm.value("cantidad_base").toDouble();
    if (cantBase <= 0) cantBase = 1.0;
    double factor = cantidadProducida / cantBase;

    // Obtener insumos requeridos
    QSqlQuery qIng(db.database());
    qIng.prepare("SELECT materia_prima_id, cantidad_requerida FROM detalle_formula WHERE formula_id = :fid");
    qIng.bindValue(":fid", formulaId);
    if (!qIng.exec()) {
        res["success"] = false;
        res["error"] = qIng.lastError().text();
        return res;
    }

    if (!db.beginTransaction()) {
        res["success"] = false;
        res["error"] = "Error de transacción al iniciar lote de producción.";
        return res;
    }

    double costoTotalLote = 0.0;

    while (qIng.next()) {
        int mpId = qIng.value("materia_prima_id").toInt();
        double cantRequerida = qIng.value("cantidad_requerida").toDouble() * factor;

        // Validar stock de materia prima
        QSqlQuery qMP(db.database());
        qMP.prepare("SELECT nombre, stock, costo_unitario FROM producto WHERE id = :mpid FOR UPDATE");
        qMP.bindValue(":mpid", mpId);
        if (qMP.exec() && qMP.next()) {
            double stockActual = qMP.value("stock").toDouble();
            double costoUnitarioMP = qMP.value("costo_unitario").toDouble();
            if (stockActual < cantRequerida) {
                db.rollbackTransaction();
                res["success"] = false;
                res["error"] = QString("Insumo insuficiente: %1").arg(qMP.value("nombre").toString());
                return res;
            }

            costoTotalLote += (cantRequerida * costoUnitarioMP);

            // Descontar materia prima
            QSqlQuery qDesc(db.database());
            qDesc.prepare("UPDATE producto SET stock = stock - :cant WHERE id = :mpid");
            qDesc.bindValue(":cant", cantRequerida);
            qDesc.bindValue(":mpid", mpId);
            qDesc.exec();
        }
    }

    double costoUnitarioReal = cantidadProducida > 0 ? (costoTotalLote / cantidadProducida) : 0.0;

    // Aumentar existencias del producto terminado y actualizar costo
    QSqlQuery qInc(db.database());
    qInc.prepare("UPDATE producto SET stock = stock + :cant, costo_unitario = :cu, estado = 'DISPONIBLE' WHERE id = :ptid");
    qInc.bindValue(":cant", cantidadProducida);
    qInc.bindValue(":cu", costoUnitarioReal);
    qInc.bindValue(":ptid", productoTerminadoId);
    qInc.exec();

    // Registrar en tabla produccion
    QSqlQuery qProd(db.database());
    qProd.prepare("INSERT INTO produccion (negocio_id, formula_id, producto_id, cantidad_producida, costo_total, costo_unitario, fecha, estado, notas) "
                 "VALUES (:nid, :fid, :ptid, :cant, :ctot, :cu, :fecha, 'COMPLETADA', :notas)");
    qProd.bindValue(":nid", negocioId);
    qProd.bindValue(":fid", formulaId);
    qProd.bindValue(":ptid", productoTerminadoId);
    qProd.bindValue(":cant", cantidadProducida);
    qProd.bindValue(":ctot", costoTotalLote);
    qProd.bindValue(":cu", costoUnitarioReal);
    qProd.bindValue(":fecha", fecha.isEmpty() ? QDate::currentDate().toString("yyyy-MM-dd") : fecha);
    qProd.bindValue(":notas", notas);
    qProd.exec();

    db.commitTransaction();
    res["success"] = true;
    res["costoUnitario"] = costoUnitarioReal;
    emit operacionExitosa("Lote de producción completado e inventario ajustado.");
    return res;
}

// Regla 9: Cálculos de utilidad basados en costo unitario real de venta (COGS)
QVariantMap BusinessService::calcularGananciasYReportes(int negocioId, const QString& periodoFiltro) {
    QVariantMap res;
    Q_UNUSED(periodoFiltro);

    // 1. Ventas y COGS
    QSqlQuery qVentas(DatabaseManager::instance().database());
    qVentas.prepare("SELECT COALESCE(SUM(total), 0) AS total_ventas FROM venta WHERE negocio_id = :nid");
    qVentas.bindValue(":nid", negocioId);
    double totalVentas = 0.0;
    if (qVentas.exec() && qVentas.next()) totalVentas = qVentas.value("total_ventas").toDouble();

    QSqlQuery qCOGS(DatabaseManager::instance().database());
    qCOGS.prepare("SELECT COALESCE(SUM(dv.cantidad * dv.costo_unitario), 0) AS cogs "
                  "FROM detalle_venta dv "
                  "JOIN venta v ON dv.venta_id = v.id "
                  "WHERE v.negocio_id = :nid");
    qCOGS.bindValue(":nid", negocioId);
    double cogs = 0.0;
    if (qCOGS.exec() && qCOGS.next()) cogs = qCOGS.value("cogs").toDouble();

    // 2. Gastos operativos
    QSqlQuery qGastos(DatabaseManager::instance().database());
    qGastos.prepare("SELECT COALESCE(SUM(monto), 0) AS total_gastos FROM gasto_negocio WHERE negocio_id = :nid");
    qGastos.bindValue(":nid", negocioId);
    double totalGastos = 0.0;
    if (qGastos.exec() && qGastos.next()) totalGastos = qGastos.value("total_gastos").toDouble();

    QSqlQuery qNom(DatabaseManager::instance().database());
    qNom.prepare("SELECT COALESCE(SUM(monto), 0) AS total_nomina FROM pago_empleado WHERE negocio_id = :nid");
    qNom.bindValue(":nid", negocioId);
    double totalNomina = 0.0;
    if (qNom.exec() && qNom.next()) totalNomina = qNom.value("total_nomina").toDouble();

    double gastosOperativos = totalGastos + totalNomina;
    double utilidadBruta = totalVentas - cogs;
    double utilidadNeta = utilidadBruta - gastosOperativos;

    res["ventasTotales"] = totalVentas;
    res["costoVentas"] = cogs;
    res["utilidadBruta"] = utilidadBruta;
    res["gastosOperativos"] = gastosOperativos;
    res["utilidadNeta"] = utilidadNeta;
    res["margenBrutoPct"] = totalVentas > 0 ? (utilidadBruta / totalVentas) * 100.0 : 0.0;
    res["margenNetoPct"] = totalVentas > 0 ? (utilidadNeta / totalVentas) * 100.0 : 0.0;

    return res;
}
