#include "data/DatabaseManager.h"

DatabaseManager& DatabaseManager::instance() {
    static DatabaseManager s_instance;
    return s_instance;
}

DatabaseManager::DatabaseManager(QObject* parent) : QObject(parent) {
    if (QSqlDatabase::contains("qt_sql_default_connection")) {
        m_db = QSqlDatabase::database("qt_sql_default_connection");
    } else {
        m_db = QSqlDatabase::addDatabase("QMYSQL");
    }
}

DatabaseManager::~DatabaseManager() {
    disconnect();
}

bool DatabaseManager::connectToDatabase(const QString& host,
                                       int port,
                                       const QString& dbName,
                                       const QString& user,
                                       const QString& password) {
    m_db.setHostName(host);
    m_db.setPort(port);
    m_db.setDatabaseName(dbName);
    m_db.setUserName(user);
    m_db.setPassword(password);

    if (!m_db.open()) {
        QString errMsg = m_db.lastError().text();
        qWarning() << "[DatabaseManager] Error al conectar a MySQL:" << errMsg;
        emit connectionStatusChanged(false, errMsg);
        return false;
    }

    qInfo() << "[DatabaseManager] Conexión establecida exitosamente con la base de datos:" << dbName;
    emit connectionStatusChanged(true, "Conectado");
    return true;
}

void DatabaseManager::disconnect() {
    if (m_db.isOpen()) {
        m_db.close();
        emit connectionStatusChanged(false, "Desconectado");
    }
}

bool DatabaseManager::isConnected() const {
    return m_db.isOpen();
}

bool DatabaseManager::beginTransaction() {
    return m_db.transaction();
}

bool DatabaseManager::commitTransaction() {
    return m_db.commit();
}

bool DatabaseManager::rollbackTransaction() {
    return m_db.rollback();
}

QSqlDatabase& DatabaseManager::database() {
    return m_db;
}
