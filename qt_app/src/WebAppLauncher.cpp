#include "WebAppLauncher.h"

#include <QCoreApplication>
#include <QDesktopServices>
#include <QDir>
#include <QFileInfo>
#include <QJsonDocument>
#include <QJsonObject>
#include <QStandardPaths>

namespace {
bool isProject(const QString &path) {
    const QDir dir(path);
    return QFileInfo::exists(dir.filePath("scripts/desktop-runtime.cjs"))
        && QFileInfo::exists(dir.filePath("desktop.html"))
        && QFileInfo::exists(dir.filePath("mobile.html"));
}
QString usableExecutable(const QString &path) {
    if (path.isEmpty()) return {};
    const QFileInfo info(path);
    return info.isFile() && info.isExecutable() ? info.absoluteFilePath() : QString();
}
}

WebAppLauncher::WebAppLauncher(QObject *parent) : QObject(parent) {
    m_process.setProcessChannelMode(QProcess::SeparateChannels);
    m_startupTimer.setSingleShot(true);
    m_startupTimer.setInterval(20000);
    connect(&m_startupTimer, &QTimer::timeout, this, [this] {
        if (!m_starting) return;
        stop();
        fail(QStringLiteral("El servidor local no respondió a tiempo. Revisa el puerto y la base SQLite y reintenta."));
    });
    connect(&m_process, &QProcess::readyReadStandardOutput, this, &WebAppLauncher::readMessages);
    connect(&m_process, &QProcess::readyReadStandardError, this, [this] {
        m_stderr += m_process.readAllStandardError();
        if (m_stderr.size() > 8192) m_stderr = m_stderr.right(8192);
    });
    connect(&m_process, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
        if (m_stopping) return;
        if (error == QProcess::FailedToStart)
            fail(QStringLiteral("No se pudo iniciar Node.js: ") + m_process.errorString());
    });
    connect(&m_process, &QProcess::finished, this, [this](int, QProcess::ExitStatus) {
        if (m_stopping) return;
        readMessages();
        if (!m_error.isEmpty()) return;
        fail(QStringLiteral("El servicio local se cerró. No se guardará en otro almacenamiento. ")
             + QString::fromUtf8(m_stderr).trimmed());
    });
}

WebAppLauncher::~WebAppLauncher() { stop(); }

QString WebAppLauncher::projectRoot() const {
    const QString configured = qEnvironmentVariable("MIBOLSILLO_PROJECT_ROOT");
    if (!configured.isEmpty()) return isProject(configured) ? QDir(configured).absolutePath() : QString();
    QDir candidate(QCoreApplication::applicationDirPath());
    for (int i = 0; i < 7; ++i) {
        if (isProject(candidate.absolutePath())) return candidate.absolutePath();
        if (!candidate.cdUp()) break;
    }
#ifdef MIBOLSILLO_SOURCE_ROOT
    if (isProject(QStringLiteral(MIBOLSILLO_SOURCE_ROOT))) return QStringLiteral(MIBOLSILLO_SOURCE_ROOT);
#endif
    return {};
}

QString WebAppLauncher::nodeExecutable() const {
    const QString configured = qEnvironmentVariable("MIBOLSILLO_NODE");
    if (!configured.isEmpty()) return usableExecutable(configured);
#ifdef Q_OS_WIN
    const QString local = QDir(QCoreApplication::applicationDirPath()).filePath("runtime/node.exe");
#else
    const QString local = QDir(QCoreApplication::applicationDirPath()).filePath("runtime/node");
#endif
    if (const QString executable = usableExecutable(local); !executable.isEmpty()) return executable;
    if (const QString executable = QStandardPaths::findExecutable("node"); !executable.isEmpty()) return executable;
#ifdef Q_OS_WIN
    if (const QString executable = usableExecutable(QDir(qEnvironmentVariable("ProgramFiles")).filePath("nodejs/node.exe")); !executable.isEmpty()) return executable;
#endif
#ifdef MIBOLSILLO_DEV_NODE
    if (const QString executable = usableExecutable(QStringLiteral(MIBOLSILLO_DEV_NODE)); !executable.isEmpty()) return executable;
#endif
    return {};
}

void WebAppLauncher::start() {
    if (m_starting || m_running) return;
    m_error.clear();
    m_url = QUrl();
    m_database.clear();
    m_stdout.clear();
    m_stderr.clear();
    const QString root = projectRoot();
    if (root.isEmpty()) {
        fail(QStringLiteral("No se encuentra el proyecto HTML completo. Abre este proyecto desde su carpeta original o configura MIBOLSILLO_PROJECT_ROOT."));
        return;
    }
    const QString node = nodeExecutable();
    if (node.isEmpty()) {
        fail(QStringLiteral("No se encuentra Node.js. Instala Node.js 24.22 o posterior, o configura MIBOLSILLO_NODE con su ejecutable."));
        return;
    }
    m_starting = true;
    m_status = QStringLiteral("Abriendo la aplicación HTML y su base SQLite…");
    emit stateChanged();
    m_process.setWorkingDirectory(root);
    m_process.setProgram(node);
    m_process.setArguments({QDir(root).filePath("scripts/desktop-runtime.cjs")});
    m_process.start();
    m_startupTimer.start();
}

void WebAppLauncher::retry() {
    stop();
    start();
}

void WebAppLauncher::stop() {
    m_stopping = true;
    m_startupTimer.stop();
    if (m_process.state() != QProcess::NotRunning) {
        // EOF tells the helper to close only the server it owns. A previously
        // running web server belongs to the user and is never stopped here.
        m_process.closeWriteChannel();
        if (!m_process.waitForFinished(1500)) {
            m_process.terminate();
            if (!m_process.waitForFinished(1000)) {
                m_process.kill();
                m_process.waitForFinished(1000);
            }
        }
    }
    m_starting = false;
    m_running = false;
    m_stopping = false;
}

void WebAppLauncher::fail(const QString &message) {
    m_startupTimer.stop();
    m_starting = false;
    m_running = false;
    m_error = message.trimmed();
    m_status = QStringLiteral("MiBolsillo necesita atención");
    emit stateChanged();
}

void WebAppLauncher::readMessages() {
    m_stdout += m_process.readAllStandardOutput();
    if (m_stdout.size() > 1024 * 1024) {
        stop();
        fail(QStringLiteral("El servicio local devolvió una respuesta demasiado grande."));
        return;
    }
    while (true) {
        const auto newline = m_stdout.indexOf('\n');
        if (newline < 0) break;
        const QByteArray line = m_stdout.left(newline).trimmed();
        m_stdout.remove(0, newline + 1);
        if (!line.isEmpty()) consumeMessage(line);
    }
}

void WebAppLauncher::consumeMessage(const QByteArray &line) {
    const auto document = QJsonDocument::fromJson(line);
    if (!document.isObject()) return;
    const auto message = document.object();
    const QString event = message.value("event").toString();
    if (event == "error") {
        fail(message.value("message").toString(QStringLiteral("No se pudo abrir la aplicación HTML con SQLite.")));
        return;
    }
    if (event != "ready" || !m_starting) return;
    const QUrl address(message.value("url").toString());
    if (address.scheme() != "http" || address.host() != "127.0.0.1" || address.port() <= 0
        || !address.userInfo().isEmpty() || message.value("database").toString().isEmpty()) {
        stop();
        fail(QStringLiteral("El servicio local devolvió una dirección no válida. No se abrió el navegador."));
        return;
    }
    m_startupTimer.stop();
    m_starting = false;
    m_running = true;
    m_url = address;
    m_database = message.value("database").toString();
    m_error.clear();
    m_status = QStringLiteral("MiBolsillo HTML está lista · SQLite local");
    emit stateChanged();
    if (qEnvironmentVariable("MIBOLSILLO_NO_BROWSER") != "1") openApp();
}

bool WebAppLauncher::launchBrowser(const QUrl &address) {
    if (!m_running) return false;
#ifdef Q_OS_WIN
    QStringList candidates;
    for (const auto &base : {qEnvironmentVariable("ProgramFiles(x86)"), qEnvironmentVariable("ProgramFiles"), qEnvironmentVariable("LOCALAPPDATA")}) {
        if (base.isEmpty()) continue;
        candidates << QDir(base).filePath("Microsoft/Edge/Application/msedge.exe")
                   << QDir(base).filePath("Google/Chrome/Application/chrome.exe");
    }
    for (const auto &candidate : candidates) {
        if (!QFileInfo::exists(candidate)) continue;
        // Reuse the user's browser profile. No private profile, different origin
        // or copied localStorage is created by this launcher.
        if (QProcess::startDetached(candidate, {QStringLiteral("--app=") + address.toString(QUrl::FullyEncoded)})) {
            m_error.clear();
            emit stateChanged();
            emit applicationOpened(address);
            return true;
        }
    }
#endif
    if (QDesktopServices::openUrl(address)) {
        m_error.clear();
        emit stateChanged();
        emit applicationOpened(address);
        return true;
    }
    m_error = QStringLiteral("El servidor SQLite está listo, pero no se pudo abrir el navegador. Abre la dirección que aparece en esta ventana.");
    emit stateChanged();
    return false;
}

bool WebAppLauncher::openApp() { return launchBrowser(m_url); }
bool WebAppLauncher::openDesktop() { return launchBrowser(m_url.resolved(QUrl("desktop.html"))); }
bool WebAppLauncher::openMobile() { return launchBrowser(m_url.resolved(QUrl("mobile.html"))); }
