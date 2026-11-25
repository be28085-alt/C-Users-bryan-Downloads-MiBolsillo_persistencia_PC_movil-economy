#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>
#include <QTimer>
#ifdef MIBOLSILLO_NATIVE_PROTOTYPE
#include "services/FinanceService.h"
#else
#include "WebAppLauncher.h"
#endif

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    app.setApplicationDisplayName(QStringLiteral("MiBolsillo"));
    app.setOrganizationName(QStringLiteral("MiBolsillo"));
    app.setApplicationVersion(QStringLiteral("0.3.0"));
    QQuickStyle::setStyle(QStringLiteral("Basic"));
#ifdef MIBOLSILLO_NATIVE_PROTOTYPE
    app.setApplicationName(QStringLiteral("MiBolsilloQt"));
    FinanceService financeService;
    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty(QStringLiteral("financeService"), &financeService);
    const QUrl url(QStringLiteral("qrc:/qml/main.qml"));
#else
    app.setApplicationName(QStringLiteral("MiBolsilloHTML"));
    WebAppLauncher webLauncher;
    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty(QStringLiteral("webLauncher"), &webLauncher);
    const QUrl url(QStringLiteral("qrc:/qml/WebLauncher.qml"));
#endif
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreated, &app,
                     [url](QObject *object, const QUrl &objectUrl) {
        if (!object && url == objectUrl) QCoreApplication::exit(1);
    }, Qt::QueuedConnection);
    engine.load(url);
#ifndef MIBOLSILLO_NATIVE_PROTOTYPE
    if (!engine.rootObjects().isEmpty()) QTimer::singleShot(0, &webLauncher, &WebAppLauncher::start);
#endif
    return app.exec();
}
