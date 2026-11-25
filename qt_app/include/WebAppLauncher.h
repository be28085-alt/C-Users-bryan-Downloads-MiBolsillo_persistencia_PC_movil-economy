#pragma once

#include <QObject>
#include <QProcess>
#include <QTimer>
#include <QUrl>

// Starts the existing HTML application and its existing SQLite server. Financial
// rules, pages and persisted data stay in the original web application.
class WebAppLauncher : public QObject {
    Q_OBJECT
    Q_PROPERTY(QString status READ status NOTIFY stateChanged)
    Q_PROPERTY(QString error READ error NOTIFY stateChanged)
    Q_PROPERTY(QUrl url READ url NOTIFY stateChanged)
    Q_PROPERTY(QString database READ database NOTIFY stateChanged)
    Q_PROPERTY(bool running READ running NOTIFY stateChanged)
public:
    explicit WebAppLauncher(QObject *parent = nullptr);
    ~WebAppLauncher() override;
    QString status() const { return m_status; }
    QString error() const { return m_error; }
    QUrl url() const { return m_url; }
    QString database() const { return m_database; }
    bool running() const { return m_running; }

    Q_INVOKABLE void start();
    Q_INVOKABLE void retry();
    Q_INVOKABLE bool openApp();
    Q_INVOKABLE bool openDesktop();
    Q_INVOKABLE bool openMobile();
signals:
    void stateChanged();
    void applicationOpened(const QUrl &url);
private:
    QString projectRoot() const;
    QString nodeExecutable() const;
    bool launchBrowser(const QUrl &url);
    void readMessages();
    void consumeMessage(const QByteArray &line);
    void stop();
    void fail(const QString &message);

    QProcess m_process;
    QTimer m_startupTimer;
    QByteArray m_stdout;
    QByteArray m_stderr;
    QString m_status = QStringLiteral("Listo para abrir MiBolsillo");
    QString m_error;
    QUrl m_url;
    QString m_database;
    bool m_running = false;
    bool m_starting = false;
    bool m_stopping = false;
};
