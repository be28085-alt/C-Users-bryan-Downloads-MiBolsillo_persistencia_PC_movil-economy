#include "services/FinanceService.h"

#include <QCryptographicHash>
#include <QDate>
#include <QDir>
#include <QFileInfo>
#include <QPasswordDigestor>
#include <QRandomGenerator>
#include <QRegularExpression>
#include <QSqlError>
#include <QSqlQuery>
#include <QStandardPaths>
#include <QUuid>
#include <cstring>

namespace {
constexpr int PasswordIterations = 210000;
constexpr qint64 MaxAmountCents = 1000000000000LL;
constexpr qint64 MaxLedgerCents = 900000000000000LL;
constexpr int ApplicationId = 0x4d424f4c;

QByteArray passwordKey(const QString &password, const QByteArray &salt, int iterations) {
    return QPasswordDigestor::deriveKeyPbkdf2(QCryptographicHash::Sha256,
                                            password.toUtf8(), salt, iterations, 32);
}
QByteArray randomSalt() {
    QByteArray salt(32, Qt::Uninitialized);
    for (int i = 0; i < salt.size(); i += sizeof(quint32)) {
        const quint32 value = QRandomGenerator::system()->generate();
        std::memcpy(salt.data() + i, &value, sizeof(value));
    }
    return salt;
}
bool equalKeys(const QByteArray &a, const QByteArray &b) {
    if (a.size() != b.size()) return false;
    volatile unsigned char difference = 0;
    for (qsizetype i = 0; i < a.size(); ++i)
        difference = difference | (static_cast<unsigned char>(a[i]) ^ static_cast<unsigned char>(b[i]));
    return difference == 0;
}
QString sqlError(const QString &action, const QSqlQuery &query) {
    return action + QStringLiteral(": ") + query.lastError().text();
}
}

FinanceService::FinanceService(const QString &path, QObject *parent) : QObject(parent) {
    m_databasePath = path.isEmpty()
        ? QDir(QStandardPaths::writableLocation(QStandardPaths::AppDataLocation)).filePath("mibolsillo-qt.sqlite")
        : QFileInfo(path).absoluteFilePath();
    m_connectionName = QStringLiteral("mibolsillo-") + QUuid::createUuid().toString(QUuid::WithoutBraces);
    m_db = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), m_connectionName);
    openStorage();
}

FinanceService::~FinanceService() {
    m_db.close();
    m_db = QSqlDatabase();
    QSqlDatabase::removeDatabase(m_connectionName);
}

bool FinanceService::fail(const QString &message) {
    m_error = message;
    emit stateChanged();
    return false;
}

bool FinanceService::openStorage() {
    m_ready = false;
    m_db.close();
    if (!QDir().mkpath(QFileInfo(m_databasePath).absolutePath()))
        return fail(QStringLiteral("No se pudo crear la carpeta de datos. Conserva tus archivos y reintenta."));
    m_db.setDatabaseName(m_databasePath);
    m_db.setConnectOptions(QStringLiteral("QSQLITE_BUSY_TIMEOUT=5000"));
    if (!m_db.open())
        return fail(QStringLiteral("No se pudo abrir SQLite: ") + m_db.lastError().text());
    QSqlQuery query(m_db);
    if (!query.exec(QStringLiteral("PRAGMA foreign_keys=ON")))
        return fail(sqlError(QStringLiteral("No se pudieron activar las claves de pertenencia"), query));
    if (!query.exec(QStringLiteral("PRAGMA user_version")) || !query.next())
        return fail(sqlError(QStringLiteral("No se pudo leer la versión de datos"), query));
    const int version = query.value(0).toInt();
    query.finish();
    if (version == 0) {
        if (!query.exec(QStringLiteral("SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")) || !query.next())
            return fail(sqlError(QStringLiteral("No se pudo inspeccionar SQLite"), query));
        const bool emptyDatabase = query.value(0).toInt() == 0;
        query.finish();
        if (!emptyDatabase)
            return fail(QStringLiteral("La base existente no es de MiBolsillo Qt. Se conservó sin migrar; selecciona la base correcta."));
        if (!m_db.transaction()) return fail(QStringLiteral("No se pudo iniciar la creación de la base: ") + m_db.lastError().text());
        const QStringList statements{
            QStringLiteral("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80), email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(email) BETWEEN 3 AND 150), password_salt BLOB NOT NULL CHECK(length(password_salt)=32), password_hash BLOB NOT NULL CHECK(length(password_hash)=32), password_iterations INTEGER NOT NULL CHECK(password_iterations BETWEEN 100000 AND 1000000))"),
            QStringLiteral("CREATE TABLE accounts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), context TEXT NOT NULL CHECK(context IN ('PERSONAL','BUSINESS')), name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80), opening_cents INTEGER NOT NULL CHECK(typeof(opening_cents)='integer' AND opening_cents BETWEEN 0 AND 1000000000000), UNIQUE(id,user_id,context))"),
            QStringLiteral("CREATE TABLE movements (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL, user_id INTEGER NOT NULL, context TEXT NOT NULL CHECK(context IN ('PERSONAL','BUSINESS')), type TEXT NOT NULL CHECK(type IN ('INCOME','EXPENSE')), amount_cents INTEGER NOT NULL CHECK(typeof(amount_cents)='integer' AND amount_cents BETWEEN 1 AND 1000000000000), description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 255), date TEXT NOT NULL CHECK(length(date)=10), FOREIGN KEY(account_id,user_id,context) REFERENCES accounts(id,user_id,context))"),
            QStringLiteral("CREATE INDEX accounts_scope ON accounts(user_id,context)"),
            QStringLiteral("CREATE INDEX movements_scope ON movements(user_id,context,date,id)"),
            QStringLiteral("PRAGMA application_id=%1").arg(ApplicationId),
            QStringLiteral("PRAGMA user_version=1")
        };
        for (const auto &statement : statements) {
            if (!query.exec(statement)) {
                const QString message = sqlError(QStringLiteral("No se pudo crear la base local"), query);
                m_db.rollback();
                return fail(message);
            }
        }
        if (!m_db.commit()) {
            const QString message = QStringLiteral("SQLite no confirmó la creación: ") + m_db.lastError().text();
            m_db.rollback();
            return fail(message);
        }
    } else if (version != 1) {
        return fail(QStringLiteral("Versión de base no compatible (%1). No se modificó el formato.").arg(version));
    }
    if (!query.exec(QStringLiteral("PRAGMA application_id")) || !query.next() || query.value(0).toInt() != ApplicationId)
        return fail(QStringLiteral("Esta base no pertenece a MiBolsillo Qt. No se modificó."));
    query.finish();
    if (!query.exec(QStringLiteral("PRAGMA quick_check")) || !query.next() || query.value(0).toString() != QStringLiteral("ok"))
        return fail(QStringLiteral("SQLite detectó un archivo dañado. Conserva una copia del archivo antes de recuperarlo."));
    query.finish();
    // Validate expected columns before exposing a usable connection. Never recreate an incompatible store.
    for (const auto &statement : {
             "SELECT id,name,email,password_salt,password_hash,password_iterations FROM users LIMIT 0",
             "SELECT id,user_id,context,name,opening_cents FROM accounts LIMIT 0",
             "SELECT id,account_id,user_id,context,type,amount_cents,description,date FROM movements LIMIT 0"}) {
        if (!query.exec(QString::fromLatin1(statement)))
            return fail(sqlError(QStringLiteral("El esquema local está incompleto; se conservó para recuperación"), query));
        query.finish();
    }
    m_ready = true;
    m_error.clear();
    emit stateChanged();
    return true;
}

bool FinanceService::retryStorage() {
    if (!openStorage()) return false;
    return loggedIn() ? refresh() : true;
}

bool FinanceService::requireSession() {
    if (!m_ready || !m_db.isOpen()) return fail(QStringLiteral("El almacenamiento no está disponible. Reintenta la conexión; no se guardó en otro lugar."));
    if (!loggedIn()) return fail(QStringLiteral("Inicia sesión para continuar."));
    return true;
}

bool FinanceService::parseAmount(const QString &text, qint64 &cents, bool allowZero) {
    static const QRegularExpression pattern(QStringLiteral("^[0-9]{1,11}(?:[.,][0-9]{1,2})?$"));
    const QString normalized = text.trimmed();
    if (!pattern.match(normalized).hasMatch()) return false;
    const QStringList parts = QString(normalized).replace(',', '.').split('.');
    bool ok = false;
    const qint64 units = parts[0].toLongLong(&ok);
    if (!ok || units > MaxAmountCents / 100) return false;
    const int fraction = parts.size() == 2 ? parts[1].leftJustified(2, '0').toInt() : 0;
    cents = units * 100 + fraction;
    return cents <= MaxAmountCents && (allowZero ? cents >= 0 : cents > 0);
}

bool FinanceService::registerUser(const QString &name, const QString &email, const QString &password) {
    if (!m_ready) return fail(QStringLiteral("No hay almacenamiento disponible. Reintenta antes de crear el usuario."));
    if (loggedIn()) return fail(QStringLiteral("Cierra la sesión antes de crear otro usuario."));
    const QString cleanName = name.trimmed();
    const QString cleanEmail = email.trimmed().toLower();
    static const QRegularExpression emailPattern(QStringLiteral("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"));
    if (cleanName.isEmpty() || cleanName.size() > 80) return fail(QStringLiteral("Escribe un nombre de 1 a 80 caracteres."));
    if (cleanEmail.size() > 150 || !emailPattern.match(cleanEmail).hasMatch()) return fail(QStringLiteral("Escribe un correo válido de hasta 150 caracteres."));
    if (password.size() < 8 || password.size() > 128) return fail(QStringLiteral("La contraseña debe tener entre 8 y 128 caracteres."));
    const QByteArray salt = randomSalt();
    const QByteArray key = passwordKey(password, salt, PasswordIterations);
    if (key.size() != 32) return fail(QStringLiteral("No se pudo proteger la contraseña; no se creó el usuario."));
    if (!m_db.transaction()) return fail(QStringLiteral("No se pudo iniciar el registro: ") + m_db.lastError().text());
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("INSERT INTO users(name,email,password_salt,password_hash,password_iterations) VALUES(?,?,?,?,?)"));
    query.addBindValue(cleanName); query.addBindValue(cleanEmail); query.addBindValue(salt);
    query.addBindValue(key); query.addBindValue(PasswordIterations);
    if (!query.exec()) return rollback(sqlError(QStringLiteral("No se pudo registrar; comprueba si el correo ya existe"), query));
    const qint64 id = query.lastInsertId().toLongLong();
    if (!m_db.commit()) return rollback(QStringLiteral("SQLite no confirmó el usuario: ") + m_db.lastError().text());
    m_userId = id;
    m_context = QStringLiteral("PERSONAL");
    m_refreshRequired = true;
    if (refresh()) return true;
    return fail(QStringLiteral("SQLite confirmó el usuario, pero no se pudo actualizar la vista. Usa Actualizar o reabre la conexión antes de continuar. ") + m_error);
}

bool FinanceService::login(const QString &email, const QString &password) {
    if (!m_ready) return fail(QStringLiteral("No hay almacenamiento disponible. Reintenta antes de iniciar sesión."));
    if (loggedIn()) return fail(QStringLiteral("Ya hay una sesión abierta."));
    if (password.size() > 128) return fail(QStringLiteral("Correo o contraseña incorrectos."));
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("SELECT id,password_salt,password_hash,password_iterations FROM users WHERE email=?"));
    query.addBindValue(email.trimmed().toLower());
    if (!query.exec()) return fail(sqlError(QStringLiteral("No se pudo leer el usuario"), query));
    if (!query.next()) {
        // Avoid returning immediately for unknown addresses.
        passwordKey(password, QByteArray(32, '\0'), PasswordIterations);
        return fail(QStringLiteral("Correo o contraseña incorrectos."));
    }
    const int iterations = query.value(3).toInt();
    const QByteArray salt = query.value(1).toByteArray();
    const QByteArray expected = query.value(2).toByteArray();
    if (iterations < 100000 || iterations > 1000000 || salt.size() != 32 || expected.size() != 32)
        return fail(QStringLiteral("El registro de acceso está dañado. Conserva la base para recuperación."));
    const QByteArray actual = passwordKey(password, salt, iterations);
    if (!equalKeys(actual, expected)) return fail(QStringLiteral("Correo o contraseña incorrectos."));
    m_userId = query.value(0).toLongLong();
    query.finish();
    m_context = QStringLiteral("PERSONAL");
    if (refresh()) return true;
    const QString message = m_error;
    logout();
    return fail(message);
}

void FinanceService::logout() {
    m_userId = 0;
    m_userName.clear(); m_email.clear(); m_accounts.clear(); m_movements.clear();
    m_context = QStringLiteral("PERSONAL");
    m_summary = {{"balance", 0.0}, {"income", 0.0}, {"expense", 0.0}};
    m_refreshRequired = false;
    m_error.clear();
    emit stateChanged();
}

bool FinanceService::setContext(const QString &context) {
    if (!requireSession()) return false;
    if (context != QStringLiteral("PERSONAL") && context != QStringLiteral("BUSINESS"))
        return fail(QStringLiteral("Selecciona Personal o Mi Negocio."));
    const QString previous = m_context;
    m_context = context;
    if (refresh()) return true;
    m_context = previous;
    emit stateChanged();
    return false;
}

bool FinanceService::beginWrite() {
    if (!requireSession()) return false;
    if (m_refreshRequired)
        return fail(QStringLiteral("La operación anterior ya está guardada en SQLite. Usa Actualizar o reabre la conexión antes de guardar otra vez."));
    if (!m_db.transaction()) return fail(QStringLiteral("No se pudo iniciar el guardado: ") + m_db.lastError().text());
    return true;
}

bool FinanceService::rollback(const QString &message) {
    if (!m_db.rollback()) {
        m_ready = false;
        return fail(message + QStringLiteral(" No se pudo confirmar la reversión; reabre la conexión antes de reintentar."));
    }
    return fail(message);
}

bool FinanceService::commitAndRefresh() {
    if (!m_db.commit()) return rollback(QStringLiteral("SQLite no confirmó el guardado: ") + m_db.lastError().text());
    m_refreshRequired = true;
    if (refresh()) return true;
    return fail(QStringLiteral("SQLite confirmó el guardado, pero no se pudo actualizar la vista. Usa Actualizar antes de repetir la operación. ") + m_error);
}

bool FinanceService::withinLedgerLimit(qint64 additionalCents) {
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("SELECT (SELECT COALESCE(SUM(opening_cents),0) FROM accounts WHERE user_id=? AND context=?) + (SELECT COALESCE(SUM(amount_cents),0) FROM movements WHERE user_id=? AND context=?)"));
    query.addBindValue(m_userId); query.addBindValue(m_context);
    query.addBindValue(m_userId); query.addBindValue(m_context);
    if (!query.exec() || !query.next()) return fail(sqlError(QStringLiteral("No se pudo verificar el límite financiero"), query));
    const qint64 total = query.value(0).toLongLong();
    if (total < 0 || total > MaxLedgerCents - additionalCents)
        return fail(QStringLiteral("El contexto alcanzó el límite de importes admitido. No se guardó la operación."));
    return true;
}

bool FinanceService::createAccount(const QString &name, const QString &initialAmount) {
    if (!requireSession()) return false;
    const QString cleanName = name.trimmed();
    qint64 cents = 0;
    if (cleanName.isEmpty() || cleanName.size() > 80) return fail(QStringLiteral("Escribe un nombre de cuenta de 1 a 80 caracteres."));
    if (!parseAmount(initialAmount, cents, true)) return fail(QStringLiteral("Saldo inicial inválido. Usa hasta dos decimales, sin separadores de miles (máximo 10000000000)."));
    if (!beginWrite()) return false;
    if (!withinLedgerLimit(cents)) return rollback(m_error);
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("INSERT INTO accounts(user_id,context,name,opening_cents) VALUES(?,?,?,?)"));
    query.addBindValue(m_userId); query.addBindValue(m_context); query.addBindValue(cleanName); query.addBindValue(cents);
    if (!query.exec()) return rollback(sqlError(QStringLiteral("No se pudo guardar la cuenta"), query));
    return commitAndRefresh();
}

bool FinanceService::addMovement(int accountId, const QString &type, const QString &amount,
                                const QString &description, const QString &date) {
    if (!requireSession()) return false;
    if (type != QStringLiteral("INCOME") && type != QStringLiteral("EXPENSE")) return fail(QStringLiteral("Selecciona ingreso o gasto."));
    qint64 cents = 0;
    if (!parseAmount(amount, cents, false)) return fail(QStringLiteral("Importe inválido. Debe ser positivo, con hasta dos decimales y sin separadores de miles (máximo 10000000000)."));
    const QString cleanDescription = description.trimmed();
    if (cleanDescription.isEmpty() || cleanDescription.size() > 255) return fail(QStringLiteral("Escribe un concepto de 1 a 255 caracteres."));
    const QDate movementDate = QDate::fromString(date, Qt::ISODate);
    if (!movementDate.isValid() || movementDate.toString(Qt::ISODate) != date) return fail(QStringLiteral("La fecha debe ser válida y tener formato AAAA-MM-DD."));
    if (!beginWrite()) return false;
    QSqlQuery owner(m_db);
    owner.prepare(QStringLiteral("SELECT id FROM accounts WHERE id=? AND user_id=? AND context=?"));
    owner.addBindValue(accountId); owner.addBindValue(m_userId); owner.addBindValue(m_context);
    if (!owner.exec()) return rollback(sqlError(QStringLiteral("No se pudo verificar la cuenta"), owner));
    if (!owner.next()) return rollback(QStringLiteral("La cuenta no pertenece al usuario y contexto activos. Selecciona una cuenta de esta sección."));
    owner.finish();
    if (!withinLedgerLimit(cents)) return rollback(m_error);
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("INSERT INTO movements(account_id,user_id,context,type,amount_cents,description,date) VALUES(?,?,?,?,?,?,?)"));
    query.addBindValue(accountId); query.addBindValue(m_userId); query.addBindValue(m_context);
    query.addBindValue(type); query.addBindValue(cents); query.addBindValue(cleanDescription); query.addBindValue(date);
    if (!query.exec()) return rollback(sqlError(QStringLiteral("No se pudo guardar el movimiento"), query));
    return commitAndRefresh();
}

bool FinanceService::updateProfile(const QString &name) {
    const QString cleanName = name.trimmed();
    if (cleanName.isEmpty() || cleanName.size() > 80) return fail(QStringLiteral("Escribe un nombre de 1 a 80 caracteres."));
    if (!beginWrite()) return false;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("UPDATE users SET name=? WHERE id=?"));
    query.addBindValue(cleanName); query.addBindValue(m_userId);
    if (!query.exec() || query.numRowsAffected() != 1) return rollback(sqlError(QStringLiteral("No se pudo guardar el perfil"), query));
    return commitAndRefresh();
}

bool FinanceService::refresh() {
    if (!requireSession()) return false;
    if (!m_db.transaction()) return fail(QStringLiteral("No se pudo iniciar la lectura: ") + m_db.lastError().text());
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("SELECT name,email FROM users WHERE id=?")); query.addBindValue(m_userId);
    if (!query.exec() || !query.next()) return rollback(sqlError(QStringLiteral("No se pudo recuperar el perfil"), query));
    const QString name = query.value(0).toString();
    const QString email = query.value(1).toString();
    query.finish();
    QVariantList accounts;
    QVariantList movements;
    qint64 opening = 0, income = 0, expense = 0;
    query.prepare(QStringLiteral("SELECT a.id,a.name,a.opening_cents,COALESCE(SUM(CASE m.type WHEN 'INCOME' THEN m.amount_cents ELSE -m.amount_cents END),0) FROM accounts a LEFT JOIN movements m ON m.account_id=a.id AND m.user_id=a.user_id AND m.context=a.context WHERE a.user_id=? AND a.context=? GROUP BY a.id,a.name,a.opening_cents ORDER BY a.id"));
    query.addBindValue(m_userId); query.addBindValue(m_context);
    if (!query.exec()) return rollback(sqlError(QStringLiteral("No se pudieron leer las cuentas"), query));
    while (query.next()) {
        const qint64 initial = query.value(2).toLongLong();
        const qint64 delta = query.value(3).toLongLong();
        if (initial < 0 || initial > MaxAmountCents || delta < -MaxLedgerCents || delta > MaxLedgerCents || opening > MaxLedgerCents - initial)
            return rollback(QStringLiteral("Los importes de la base superan los límites admitidos. Conserva el archivo para revisión."));
        opening += initial;
        accounts.append(QVariantMap{{"id", query.value(0)}, {"name", query.value(1)}, {"balance", (initial + delta) / 100.0}});
    }
    if (query.lastError().isValid())
        return rollback(sqlError(QStringLiteral("La lectura de cuentas se interrumpió; no se actualizaron los saldos"), query));
    query.finish();
    query.prepare(QStringLiteral("SELECT m.id,a.name,m.type,m.amount_cents,m.date,m.description FROM movements m JOIN accounts a ON a.id=m.account_id AND a.user_id=m.user_id AND a.context=m.context WHERE m.user_id=? AND m.context=? ORDER BY m.date DESC,m.id DESC"));
    query.addBindValue(m_userId); query.addBindValue(m_context);
    if (!query.exec()) return rollback(sqlError(QStringLiteral("No se pudieron leer los movimientos"), query));
    while (query.next()) {
        const qint64 cents = query.value(3).toLongLong();
        if (cents <= 0 || cents > MaxAmountCents || opening + income + expense > MaxLedgerCents - cents)
            return rollback(QStringLiteral("Los movimientos superan los límites admitidos. Conserva el archivo para revisión."));
        const QString type = query.value(2).toString();
        if (type == QStringLiteral("INCOME")) income += cents; else expense += cents;
        movements.append(QVariantMap{{"id", query.value(0)}, {"accountName", query.value(1)}, {"type", type},
                                     {"amount", cents / 100.0}, {"date", query.value(4)}, {"description", query.value(5)}});
    }
    if (query.lastError().isValid())
        return rollback(sqlError(QStringLiteral("La lectura de movimientos se interrumpió; no se actualizaron los totales"), query));
    query.finish();
    if (!m_db.commit()) return rollback(QStringLiteral("No se pudo confirmar la lectura: ") + m_db.lastError().text());
    m_userName = name; m_email = email; m_accounts = accounts; m_movements = movements;
    m_summary = {{"balance", (opening + income - expense) / 100.0}, {"income", income / 100.0}, {"expense", expense / 100.0}};
    m_refreshRequired = false;
    m_error.clear();
    emit stateChanged();
    return true;
}
