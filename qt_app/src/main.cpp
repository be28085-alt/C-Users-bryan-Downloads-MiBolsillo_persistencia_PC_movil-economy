#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include "data/DatabaseManager.h"
#include "services/BusinessService.h"
#include <QDebug>

int main(int argc, char *argv[]) {
    QGuiApplication app(argc, argv);
    app.setApplicationName("GestorFinanciero");
    app.setOrganizationName("FinanzasApp");

    // 1. Inicializar conexión a MySQL mediante Qt SQL (QMYSQL)
    auto& db = DatabaseManager::instance();
    bool dbConnected = db.connectToDatabase("localhost", 3306, "gestor_financiero", "root", "1234");
    if (!dbConnected) {
        qWarning() << "[Main] Advertencia: Base de datos MySQL no disponible en localhost. Ejecutando en modo demostración/desconectado.";
    }

    // 2. Instanciar servicios de lógica de negocio
    BusinessService businessService;

    // 3. Inicializar motor QML
    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty("businessService", &businessService);
    engine.rootContext()->setContextProperty("dbConnected", dbConnected);

    const QUrl url(QStringLiteral("qrc:/qml/main.qml"));
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreated,
                     &app, [url](QObject *obj, const QUrl &objUrl) {
        if (!obj && url == objUrl)
            QCoreApplication::exit(-1);
    }, Qt::QueuedConnection);

    engine.load(url);

    return app.exec();
}
