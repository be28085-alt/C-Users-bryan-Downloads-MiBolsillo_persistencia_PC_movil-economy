#include <QtTest>
#include <QFile>
#include <QSqlError>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QUuid>
#include "services/FinanceService.h"

namespace {
class InspectionConnection {
public:
    explicit InspectionConnection(const QString &path) {
        name = QUuid::createUuid().toString();
        db = QSqlDatabase::addDatabase("QSQLITE", name);
        db.setDatabaseName(path);
        db.open();
    }
    ~InspectionConnection() {
        db.close(); db = QSqlDatabase(); QSqlDatabase::removeDatabase(name);
    }
    QString name;
    QSqlDatabase db;
};
int accountId(const FinanceService &service) {
    return service.accounts().first().toMap().value("id").toInt();
}
}

class FinanceTests : public QObject {
    Q_OBJECT
private slots:
    void authAndReloadPersistence();
    void contextAndUserIsolation();
    void centsValidationAndDates();
    void writeAndCommitFailuresRollback();
    void committedWriteBlocksDuplicatesUntilRecovery();
    void incompatibleAndUnavailableStorage();
};

void FinanceTests::authAndReloadPersistence() {
    QTemporaryDir directory;
    QVERIFY(directory.isValid());
    const QString path = directory.filePath("finance.sqlite");
    {
        FinanceService service(path);
        QVERIFY2(service.ready(), qPrintable(service.error()));
        QVERIFY(!service.loggedIn());
        QVERIFY(!service.createAccount("No session", "1"));
        QVERIFY(!service.registerUser("", "alice@example.test", "password123"));
        QVERIFY(!service.registerUser("Alice", "bad-email", "password123"));
        QVERIFY(!service.registerUser("Alice", "alice@example.test", "short"));
        QVERIFY2(service.registerUser("Alice", "ALICE@example.test", "password123"), qPrintable(service.error()));
        QVERIFY(service.loggedIn());
        QCOMPARE(service.userName(), QString("Alice"));
        QCOMPARE(service.email(), QString("alice@example.test"));
        QVERIFY(service.createAccount("Ahorros", "100.10"));
        QVERIFY(service.addMovement(accountId(service), "INCOME", "25.25", "Trabajo", "2026-11-16"));
        QVERIFY(service.addMovement(accountId(service), "EXPENSE", "10.05", "Alimentos", "2026-11-16"));
        QCOMPARE(service.accounts().first().toMap().value("balance").toDouble(), 115.30);
        QCOMPARE(service.summary().value("balance").toDouble(), 115.30);
        QCOMPARE(service.summary().value("income").toDouble(), 25.25);
        QCOMPARE(service.summary().value("expense").toDouble(), 10.05);
        QVERIFY(service.updateProfile("Alice Actualizada"));
        service.logout();
        QVERIFY(!service.loggedIn());
        QVERIFY(service.accounts().isEmpty());
        QVERIFY(!service.login("alice@example.test", "wrong-password"));
        QVERIFY(!service.loggedIn());
        QVERIFY(!service.login("missing@example.test", "password123"));
        QVERIFY(!service.registerUser("Otra", "alice@example.test", "password123"));
    }
    {
        FinanceService reopened(path);
        QVERIFY(reopened.ready());
        QVERIFY(!reopened.loggedIn());
        QVERIFY2(reopened.login("alice@example.test", "password123"), qPrintable(reopened.error()));
        QCOMPARE(reopened.userName(), QString("Alice Actualizada"));
        QCOMPARE(reopened.accounts().size(), 1);
        QCOMPARE(reopened.movements().size(), 2);
        QCOMPARE(reopened.summary().value("balance").toDouble(), 115.30);
        QVERIFY(reopened.retryStorage());
        QCOMPARE(reopened.summary().value("balance").toDouble(), 115.30);
    }
    InspectionConnection inspection(path);
    QSqlQuery query(inspection.db);
    QVERIFY(query.exec("SELECT password_salt,password_hash,password_iterations FROM users"));
    QVERIFY(query.next());
    QCOMPARE(query.value(0).toByteArray().size(), 32);
    QCOMPARE(query.value(1).toByteArray().size(), 32);
    QVERIFY(query.value(1).toByteArray() != QByteArray("password123"));
    QVERIFY(query.value(2).toInt() >= 100000);
    QVERIFY(query.exec("SELECT amount_cents FROM movements ORDER BY id"));
    QVERIFY(query.next()); QCOMPARE(query.value(0).toLongLong(), 2525LL);
    QVERIFY(query.next()); QCOMPARE(query.value(0).toLongLong(), 1005LL);
}

void FinanceTests::contextAndUserIsolation() {
    QTemporaryDir directory;
    FinanceService service(directory.filePath("finance.sqlite"));
    QVERIFY(service.registerUser("Alice", "alice@example.test", "password123"));
    QVERIFY(service.createAccount("Personal", "100"));
    const int personalId = accountId(service);
    QVERIFY(service.addMovement(personalId, "INCOME", "10", "Personal", "2026-11-16"));
    QVERIFY(service.setContext("BUSINESS"));
    QVERIFY(service.accounts().isEmpty());
    QVERIFY(service.movements().isEmpty());
    QCOMPARE(service.summary().value("balance").toDouble(), 0.0);
    QVERIFY(!service.addMovement(personalId, "INCOME", "999", "Ataque entre contextos", "2026-11-16"));
    QVERIFY(service.createAccount("Caja negocio", "20"));
    const int businessId = accountId(service);
    QVERIFY(service.addMovement(businessId, "EXPENSE", "3.50", "Negocio", "2026-11-16"));
    QCOMPARE(service.summary().value("balance").toDouble(), 16.50);
    QVERIFY(!service.setContext("INVALID"));
    QCOMPARE(service.context(), QString("BUSINESS"));
    QVERIFY(service.setContext("PERSONAL"));
    QCOMPARE(service.accounts().size(), 1);
    QCOMPARE(service.movements().size(), 1);
    QCOMPARE(service.summary().value("balance").toDouble(), 110.0);
    QVERIFY(!service.addMovement(businessId, "EXPENSE", "1", "Otra cuenta", "2026-11-16"));
    service.logout();
    QVERIFY(service.registerUser("Bob", "bob@example.test", "password123"));
    QVERIFY(service.accounts().isEmpty());
    QVERIFY(!service.addMovement(personalId, "INCOME", "1", "Cuenta ajena", "2026-11-16"));
    QVERIFY(service.setContext("BUSINESS"));
    QVERIFY(!service.addMovement(businessId, "INCOME", "1", "Negocio ajeno", "2026-11-16"));
    QVERIFY(service.movements().isEmpty());
    service.logout();
    QVERIFY(service.login("alice@example.test", "password123"));
    QCOMPARE(service.summary().value("balance").toDouble(), 110.0);
    QVERIFY(service.setContext("BUSINESS"));
    QCOMPARE(service.summary().value("balance").toDouble(), 16.50);
    InspectionConnection inspection(service.databasePath());
    QSqlQuery query(inspection.db);
    QVERIFY(query.exec("SELECT password_salt,password_hash FROM users ORDER BY id"));
    QVERIFY(query.next());
    const QByteArray salt = query.value(0).toByteArray();
    const QByteArray hash = query.value(1).toByteArray();
    QVERIFY(query.next());
    QVERIFY(query.value(0).toByteArray() != salt);
    QVERIFY(query.value(1).toByteArray() != hash);
}

void FinanceTests::centsValidationAndDates() {
    QTemporaryDir directory;
    FinanceService service(directory.filePath("finance.sqlite"));
    QVERIFY(service.registerUser("Alice", "alice@example.test", "password123"));
    QVERIFY(service.createAccount("Efectivo", "0"));
    const int id = accountId(service);
    for (const QString &amount : {"0", "-1", "NaN", "Infinity", "1e2", "1.001", "1,000.00", "10000000000.01", "999999999999999999999999", ""})
        QVERIFY2(!service.addMovement(id, "INCOME", amount, "Inválido", "2026-11-16"), qPrintable(amount));
    QVERIFY(service.movements().isEmpty());
    QVERIFY(!service.addMovement(id, "INCOME", "1", "Fecha inválida", "2026-02-30"));
    QVERIFY(!service.addMovement(id, "INCOME", "1", "Fecha sin formato", "2026-1-1"));
    QVERIFY(!service.addMovement(id, "TRANSFER", "1", "Tipo inválido", "2026-11-16"));
    QVERIFY(!service.addMovement(id, "INCOME", "1", "", "2026-11-16"));
    QVERIFY(service.addMovement(id, "INCOME", "0,10", "Diez centavos", "2026-11-16"));
    QVERIFY(service.addMovement(id, "INCOME", "0.20", "Veinte centavos", "2026-11-16"));
    QCOMPARE(service.summary().value("balance").toDouble(), 0.30);
    QVERIFY(service.addMovement(id, "EXPENSE", "0.30", "Treinta centavos", "2026-11-16"));
    QCOMPARE(service.summary().value("balance").toDouble(), 0.0);
    QVERIFY(service.refresh());
    QCOMPARE(service.accounts().first().toMap().value("balance").toDouble(), 0.0);
}

void FinanceTests::writeAndCommitFailuresRollback() {
    QTemporaryDir directory;
    const QString path = directory.filePath("finance.sqlite");
    FinanceService service(path);
    QVERIFY(service.registerUser("Alice", "alice@example.test", "password123"));
    QVERIFY(service.createAccount("Ahorros", "100"));
    const int id = accountId(service);
    {
        InspectionConnection inspection(path);
        QSqlQuery query(inspection.db);
        QVERIFY(query.exec("CREATE TRIGGER fail_movement BEFORE INSERT ON movements BEGIN SELECT RAISE(ABORT,'injected write failure'); END"));
        QVERIFY(!service.addMovement(id, "EXPENSE", "10", "Reintentar sin perder", "2026-11-16"));
        QVERIFY(service.error().contains("injected write failure"));
        QCOMPARE(service.summary().value("balance").toDouble(), 100.0);
        QVERIFY(query.exec("DROP TRIGGER fail_movement"));
        // This fault reaches COMMIT, exercising the confirmation/rollback path.
        QVERIFY(query.exec("CREATE TABLE deferred_fault (user_id INTEGER REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED)"));
        QVERIFY(query.exec("CREATE TRIGGER fail_commit AFTER INSERT ON movements BEGIN INSERT INTO deferred_fault VALUES(-1); END"));
        QVERIFY(!service.addMovement(id, "EXPENSE", "10", "Commit rechazado", "2026-11-16"));
        QVERIFY(service.error().contains("no confirmó"));
        QVERIFY(query.exec("SELECT count(*) FROM movements"));
        QVERIFY(query.next()); QCOMPARE(query.value(0).toInt(), 0); query.finish();
        QVERIFY(query.exec("SELECT count(*) FROM deferred_fault"));
        QVERIFY(query.next()); QCOMPARE(query.value(0).toInt(), 0); query.finish();
        QVERIFY(query.exec("DROP TRIGGER fail_commit"));
        QVERIFY(query.exec("DROP TABLE deferred_fault"));
    }
    QVERIFY(service.refresh());
    QCOMPARE(service.summary().value("balance").toDouble(), 100.0);
    QVERIFY(service.movements().isEmpty());
    QVERIFY(service.addMovement(id, "EXPENSE", "10", "Reintento confirmado", "2026-11-16"));
    FinanceService reopened(path);
    QVERIFY(reopened.login("alice@example.test", "password123"));
    QCOMPARE(reopened.summary().value("balance").toDouble(), 90.0);
    QCOMPARE(reopened.movements().size(), 1);
}

void FinanceTests::incompatibleAndUnavailableStorage() {
    QTemporaryDir directory;
    const QString foreignPath = directory.filePath("foreign.sqlite");
    {
        InspectionConnection inspection(foreignPath);
        QSqlQuery query(inspection.db);
        QVERIFY(query.exec("CREATE TABLE valuable_data (content TEXT)"));
        QVERIFY(query.exec("INSERT INTO valuable_data VALUES('preserve me')"));
    }
    FinanceService foreign(foreignPath);
    QVERIFY(!foreign.ready());
    QVERIFY(!foreign.registerUser("Alice", "alice@example.test", "password123"));
    {
        InspectionConnection inspection(foreignPath);
        QSqlQuery query(inspection.db);
        QVERIFY(query.exec("SELECT content FROM valuable_data"));
        QVERIFY(query.next()); QCOMPARE(query.value(0).toString(), QString("preserve me"));
        QVERIFY(query.exec("SELECT count(*) FROM sqlite_master WHERE name='users'"));
        QVERIFY(query.next()); QCOMPARE(query.value(0).toInt(), 0);
    }
    const QString futurePath = directory.filePath("future.sqlite");
    { InspectionConnection inspection(futurePath); QSqlQuery query(inspection.db); QVERIFY(query.exec("PRAGMA user_version=99")); }
    FinanceService future(futurePath);
    QVERIFY(!future.ready());
    QVERIFY(future.error().contains("99"));
    const QString blockedPath = directory.filePath("blocked");
    QFile blocked(blockedPath);
    QVERIFY(blocked.open(QIODevice::WriteOnly)); blocked.write("existing file"); blocked.close();
    FinanceService unavailable(blockedPath + "/data.sqlite");
    QVERIFY(!unavailable.ready());
    QVERIFY(!unavailable.retryStorage());
    QVERIFY(!unavailable.registerUser("Alice", "alice@example.test", "password123"));
    QVERIFY(!unavailable.loggedIn());
}

void FinanceTests::committedWriteBlocksDuplicatesUntilRecovery() {
    QTemporaryDir directory;
    const QString path = directory.filePath("finance.sqlite");
    FinanceService service(path);
    QVERIFY(service.registerUser("Alice", "alice@example.test", "password123"));
    {
        InspectionConnection inspection(path);
        QSqlQuery query(inspection.db);
        QVERIFY(query.exec("CREATE TABLE injection_numbers (n INTEGER)"));
        QVERIFY(query.exec("WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM numbers WHERE n<901) INSERT INTO injection_numbers SELECT n FROM numbers"));
        // The write itself commits, but this simulated external corruption makes
        // the following read exceed the supported ledger range and fail.
        QVERIFY(query.exec("CREATE TRIGGER inject_unreadable_total AFTER INSERT ON accounts BEGIN INSERT INTO accounts(user_id,context,name,opening_cents) SELECT NEW.user_id,NEW.context,'fault-'||n,1000000000000 FROM injection_numbers; END"));
        QVERIFY(!service.createAccount("Confirmada", "1"));
        QVERIFY(service.error().contains("confirmó el guardado"));
        QVERIFY(service.ready());
        QVERIFY(service.accounts().isEmpty());
        QVERIFY(query.exec("SELECT count(*) FROM accounts"));
        QVERIFY(query.next()); QCOMPARE(query.value(0).toInt(), 902); query.finish();
        // Preserved form data cannot produce a second write while the confirmed
        // operation is awaiting a successful refresh.
        QVERIFY(!service.createAccount("Confirmada", "1"));
        QVERIFY(service.error().contains("ya está guardada"));
        QVERIFY(!service.addMovement(1, "INCOME", "2", "No duplicar", "2026-11-16"));
        QVERIFY(service.error().contains("ya está guardada"));
        QVERIFY(!service.updateProfile("No guardar todavía"));
        QVERIFY(query.exec("SELECT count(*) FROM accounts"));
        QVERIFY(query.next()); QCOMPARE(query.value(0).toInt(), 902); query.finish();
        QVERIFY(query.exec("DROP TRIGGER inject_unreadable_total"));
        QVERIFY(query.exec("DELETE FROM accounts WHERE name LIKE 'fault-%'"));
        QVERIFY(query.exec("DROP TABLE injection_numbers"));
    }
    QVERIFY2(service.refresh(), qPrintable(service.error()));
    QCOMPARE(service.accounts().size(), 1);
    QCOMPARE(service.accounts().first().toMap().value("name").toString(), QString("Confirmada"));
    QCOMPARE(service.summary().value("balance").toDouble(), 1.0);
    QVERIFY(service.createAccount("Después de recuperar", "2"));
    QCOMPARE(service.accounts().size(), 2);
    FinanceService reopened(path);
    QVERIFY(reopened.login("alice@example.test", "password123"));
    QCOMPARE(reopened.accounts().size(), 2);
    QCOMPARE(reopened.summary().value("balance").toDouble(), 3.0);
}

QTEST_GUILESS_MAIN(FinanceTests)
#include "tst_finance.moc"
