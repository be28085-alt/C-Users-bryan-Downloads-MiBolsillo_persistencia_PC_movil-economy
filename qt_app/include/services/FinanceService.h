#ifndef FINANCESERVICE_H
#define FINANCESERVICE_H

#include <QObject>
#include <QSqlDatabase>
#include <QVariantList>
#include <QVariantMap>

// Local Qt application data only. The historical MySQL and web stores are never opened.
class FinanceService : public QObject {
    Q_OBJECT
    Q_PROPERTY(bool ready READ ready NOTIFY stateChanged)
    Q_PROPERTY(QString error READ error NOTIFY stateChanged)
    Q_PROPERTY(QString databasePath READ databasePath CONSTANT)
    Q_PROPERTY(bool loggedIn READ loggedIn NOTIFY stateChanged)
    Q_PROPERTY(QString userName READ userName NOTIFY stateChanged)
    Q_PROPERTY(QString email READ email NOTIFY stateChanged)
    Q_PROPERTY(QString context READ context NOTIFY stateChanged)
    Q_PROPERTY(QVariantList accounts READ accounts NOTIFY stateChanged)
    Q_PROPERTY(QVariantList movements READ movements NOTIFY stateChanged)
    Q_PROPERTY(QVariantMap summary READ summary NOTIFY stateChanged)
public:
    explicit FinanceService(const QString &databasePath = QString(), QObject *parent = nullptr);
    ~FinanceService() override;
    bool ready() const { return m_ready; }
    QString error() const { return m_error; }
    QString databasePath() const { return m_databasePath; }
    bool loggedIn() const { return m_userId > 0; }
    QString userName() const { return m_userName; }
    QString email() const { return m_email; }
    QString context() const { return m_context; }
    QVariantList accounts() const { return m_accounts; }
    QVariantList movements() const { return m_movements; }
    QVariantMap summary() const { return m_summary; }

    Q_INVOKABLE bool registerUser(const QString &name, const QString &email, const QString &password);
    Q_INVOKABLE bool login(const QString &email, const QString &password);
    Q_INVOKABLE void logout();
    Q_INVOKABLE bool setContext(const QString &context);
    Q_INVOKABLE bool createAccount(const QString &name, const QString &initialAmount);
    Q_INVOKABLE bool addMovement(int accountId, const QString &type, const QString &amount,
                                const QString &description, const QString &date);
    Q_INVOKABLE bool updateProfile(const QString &name);
    Q_INVOKABLE bool refresh();
    Q_INVOKABLE bool retryStorage();
signals:
    void stateChanged();
private:
    bool openStorage();
    bool fail(const QString &message);
    bool requireSession();
    bool beginWrite();
    bool rollback(const QString &message);
    bool commitAndRefresh();
    bool withinLedgerLimit(qint64 additionalCents);
    static bool parseAmount(const QString &text, qint64 &cents, bool allowZero);
    QString m_connectionName;
    QString m_databasePath;
    QSqlDatabase m_db;
    bool m_ready = false;
    bool m_refreshRequired = false;
    qint64 m_userId = 0;
    QString m_userName;
    QString m_email;
    QString m_context = QStringLiteral("PERSONAL");
    QString m_error;
    QVariantList m_accounts;
    QVariantList m_movements;
    QVariantMap m_summary{{"balance", 0.0}, {"income", 0.0}, {"expense", 0.0}};
};
#endif
