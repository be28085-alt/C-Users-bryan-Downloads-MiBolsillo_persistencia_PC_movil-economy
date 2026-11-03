#ifndef DATABASEMANAGER_H
#define DATABASEMANAGER_H

#include <QObject>
#include <QSqlDatabase>
#include <QSqlQuery>
#include <QSqlError>
#include <QString>
#include <QDebug>

/**
 * @brief Capa de Acceso a Datos (DAO / DatabaseManager)
 * Maneja la conexión a MySQL usando el driver QMYSQL de Qt SQL,
 * soporte de transacciones atómicas (START TRANSACTION, COMMIT, ROLLBACK)
 * y consultas preparadas con bindValue() para máxima seguridad contra SQL Injection.
 */
class DatabaseManager : public QObject {
    Q_OBJECT
public:
    static DatabaseManager& instance();

    bool connectToDatabase(const QString& host = "localhost",
                          int port = 3306,
                          const QString& dbName = "gestor_financiero",
                          const QString& user = "root",
                          const QString& password = "root");

    void disconnect();
    bool isConnected() const;

    // Control transaccional para Reglas de Negocio (Compras, Ventas, Producción)
    bool beginTransaction();
    bool commitTransaction();
    bool rollbackTransaction();

    QSqlDatabase& database();

signals:
    void connectionStatusChanged(bool connected, const QString& message);

private:
    DatabaseManager(QObject* parent = nullptr);
    ~DatabaseManager();
    DatabaseManager(const DatabaseManager&) = delete;
    DatabaseManager& operator=(const DatabaseManager&) = delete;

    QSqlDatabase m_db;
};

#endif // DATABASEMANAGER_H
