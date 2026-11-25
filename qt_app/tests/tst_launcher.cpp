#include <QtTest>
#include <QFile>
#include <QFileInfo>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QTemporaryDir>
#include "WebAppLauncher.h"

class EnvironmentValue {
public:
    EnvironmentValue(const char *key, const QByteArray &value) : m_key(key), m_old(qgetenv(key)), m_existed(qEnvironmentVariableIsSet(key)) { qputenv(key, value); }
    ~EnvironmentValue() { if (m_existed) qputenv(m_key.constData(), m_old); else qunsetenv(m_key.constData()); }
private:
    QByteArray m_key, m_old;
    bool m_existed;
};

class LauncherTests : public QObject {
    Q_OBJECT
private slots:
    void refusesMissingProject() {
        QTemporaryDir folder;
        EnvironmentValue root("MIBOLSILLO_PROJECT_ROOT", folder.path().toUtf8());
        WebAppLauncher launcher;
        launcher.start();
        QVERIFY(!launcher.running());
        QVERIFY(launcher.error().contains("HTML completo"));
        QVERIFY(launcher.url().isEmpty());
    }
    void refusesMissingNode() {
        EnvironmentValue node("MIBOLSILLO_NODE", "C:/nonexistent-mibolsillo/node.exe");
        WebAppLauncher launcher;
        launcher.start();
        QVERIFY(!launcher.running());
        QVERIFY(launcher.error().contains("Node.js"));
        QVERIFY(launcher.url().isEmpty());
    }
    void startsOriginalHtmlAndStopsOwnedServer() {
        QTemporaryDir folder;
        QVERIFY(folder.isValid());
        const QString path = folder.filePath("html.sqlite");
        EnvironmentValue browser("MIBOLSILLO_NO_BROWSER", "1");
        EnvironmentValue port("MIBOLSILLO_PORT", "0");
        EnvironmentValue db("MIBOLSILLO_DB_PATH", path.toUtf8());
        QUrl address;
        QNetworkAccessManager network;
        {
            WebAppLauncher launcher;
            QSignalSpy opened(&launcher, &WebAppLauncher::applicationOpened);
            launcher.start();
            QTRY_VERIFY_WITH_TIMEOUT(launcher.running() || !launcher.error().isEmpty(), 20000);
            QVERIFY2(launcher.running(), qPrintable(launcher.error()));
            QVERIFY(launcher.error().isEmpty());
            QCOMPARE(QFileInfo(launcher.database()).absoluteFilePath(), QFileInfo(path).absoluteFilePath());
            QVERIFY(QFileInfo::exists(path));
            address = launcher.url();
            QCOMPARE(address.host(), QString("127.0.0.1"));
            QVERIFY(address.port() > 0);
            QCOMPARE(opened.count(), 0);
            auto *reply = network.get(QNetworkRequest(address));
            QSignalSpy finished(reply, &QNetworkReply::finished);
            QVERIFY(finished.wait(10000));
            QCOMPARE(reply->error(), QNetworkReply::NoError);
            QVERIFY(reply->readAll().contains("MiBolsillo"));
            reply->deleteLater();
        }
        // Closing the Qt launcher must stop only the helper-owned service.
        auto *reply = network.get(QNetworkRequest(address.resolved(QUrl("api/config"))));
        QSignalSpy finished(reply, &QNetworkReply::finished);
        QVERIFY(finished.wait(10000));
        QVERIFY(reply->error() != QNetworkReply::NoError);
        reply->deleteLater();
    }
};
QTEST_GUILESS_MAIN(LauncherTests)
#include "tst_launcher.moc"
