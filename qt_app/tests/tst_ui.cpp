#include <QtTest>
#include <QGuiApplication>
#include <QDir>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickItem>
#include <QQuickWindow>
#include <QQuickStyle>
#include <QTemporaryDir>
#include "services/FinanceService.h"

class ResponsiveUiTest : public QObject {
    Q_OBJECT
    static QQuickItem *item(QObject *root, const char *name) {
        // ScrollView changes visual parenting independently of QObject ownership.
        auto *window = qobject_cast<QQuickWindow *>(root);
        if (!window) return nullptr;
        QList<QQuickItem *> pending{window->contentItem()};
        while (!pending.isEmpty()) {
            auto *current = pending.takeLast();
            if (current->objectName() == QString::fromLatin1(name)) return current;
            pending.append(current->childItems());
        }
        return nullptr;
    }
    static bool fill(QObject *root, const char *name, const QString &text) {
        auto *field = item(root, name);
        return field && field->setProperty("text", text);
    }
    static bool click(QQuickWindow *window, const char *name) {
        QTest::qWait(40);
        auto *button = item(window, name);
        if (!button || !button->isVisible() || !button->isEnabled()) {
            qWarning() << "Unavailable control" << name << button;
            return false;
        }
        // Focus handlers scroll long forms into view, as they do with a keyboard.
        window->contentItem()->forceActiveFocus(Qt::TabFocusReason);
        button->forceActiveFocus(Qt::TabFocusReason);
        QTest::qWait(100);
        const auto point = button->mapToScene(QPointF(button->width() / 2, button->height() / 2));
        if (!window->contentItem()->contains(point)) {
            qWarning() << "Control outside viewport" << name << point << window->size();
            return false;
        }
        for (auto *parent = button->parentItem(); parent; parent = parent->parentItem()) {
            if (parent->clip() && !parent->contains(parent->mapFromScene(point))) {
                qWarning() << "Control hidden by scroll clipping" << name << point;
                return false;
            }
        }
        QTest::mouseClick(window, Qt::LeftButton, Qt::NoModifier, point.toPoint());
        QCoreApplication::processEvents();
        return true;
    }
    static bool capture(QQuickWindow *window, const QString &name) {
        const QString folder = qEnvironmentVariable("MIBOLSILLO_UI_ARTIFACTS");
        if (folder.isEmpty()) return true;
        if (!QDir().mkpath(folder)) return false;
        QTest::qWait(80);
        return window->grabWindow().save(QDir(folder).filePath(name + ".png"));
    }
private slots:
    void completeFlow_data() {
        QTest::addColumn<QSize>("size");
        QTest::newRow("desktop") << QSize(1180, 800);
        QTest::newRow("phone-portrait") << QSize(390, 844);
        QTest::newRow("small-phone") << QSize(320, 568);
        QTest::newRow("phone-landscape") << QSize(844, 390);
    }
    void completeFlow() {
        QFETCH(QSize, size);
        QTemporaryDir folder;
        QVERIFY(folder.isValid());
        const QString path = folder.filePath("ui.sqlite");
        {
            FinanceService service(path);
            QVERIFY2(service.ready(), qPrintable(service.error()));
            QQmlApplicationEngine engine;
            engine.rootContext()->setContextProperty("financeService", &service);
            engine.load(QUrl("qrc:/qml/main.qml"));
            QVERIFY(!engine.rootObjects().isEmpty());
            auto *window = qobject_cast<QQuickWindow *>(engine.rootObjects().first());
            QVERIFY(window);
            window->resize(size);
            QTRY_COMPARE(window->size(), size);
            QTRY_COMPARE(window->property("compact").toBool(), size.width() < 800);

            // Use real controls and SQLite, without a seed/demo account.
            QVERIFY(click(window, "toggleRegistration"));
            QVERIFY(fill(window, "registerName", "Prueba interfaz"));
            QVERIFY(fill(window, "loginEmail", "ui@example.test"));
            QVERIFY(fill(window, "loginPassword", "Local-test-2026"));
            QVERIFY(click(window, "loginSubmit"));
            QTRY_VERIFY(service.loggedIn());
            QCOMPARE(service.accounts().size(), 0);
            service.logout();
            QTRY_VERIFY(item(window, "loginEmail"));
            QVERIFY(fill(window, "loginEmail", "ui@example.test"));
            QVERIFY(fill(window, "loginPassword", "Local-test-2026"));
            QVERIFY(click(window, "loginSubmit"));
            QTRY_VERIFY(service.loggedIn());
            window->setProperty("currentPage", "accounts");
            QCoreApplication::processEvents();
            QVERIFY(click(window, "newAccountButton"));
            QVERIFY(fill(window, "accountName", "Cuenta comprobada"));
            QVERIFY(fill(window, "accountInitial", "100.00"));
            QVERIFY(click(window, "saveAccount"));
            QTRY_COMPARE(service.accounts().size(), 1);
            QCOMPARE(service.summary().value("balance").toDouble(), 100.0);

            window->setProperty("currentPage", "movements");
            QCoreApplication::processEvents();
            QVERIFY(click(window, "newMovementButton"));
            // A failed validation must preserve the recovery draft in both layouts.
            QVERIFY(fill(window, "movementAmount", "-5"));
            QVERIFY(fill(window, "movementDescription", "Borrador conservado"));
            QVERIFY(click(window, "saveMovement"));
            QCOMPARE(service.movements().size(), 0);
            QCOMPARE(item(window, "movementAmount")->property("text").toString(), QString("-5"));
            QVERIFY(fill(window, "movementAmount", "25.35"));
            QVERIFY(fill(window, "movementDescription", "Ingreso verificado"));
            QVERIFY(fill(window, "movementDate", "2026-11-16"));
            QVERIFY(click(window, "saveMovement"));
            QTRY_COMPARE(service.movements().size(), 1);
            QCOMPARE(service.summary().value("balance").toDouble(), 125.35);
            QVERIFY(click(window, "newMovementButton"));
            auto *type = item(window, "movementType");
            QVERIFY(type);
            type->setProperty("currentIndex", 1);
            QVERIFY(fill(window, "movementAmount", "5.10"));
            QVERIFY(fill(window, "movementDescription", "Gasto verificado"));
            QVERIFY(click(window, "saveMovement"));
            QTRY_COMPARE(service.movements().size(), 2);
            QCOMPARE(service.summary().value("balance").toDouble(), 120.25);
            QVERIFY(capture(window, QString::fromLatin1(QTest::currentDataTag()) + "-movements"));
            QVERIFY(QMetaObject::invokeMethod(window, "selectContext", Q_ARG(QVariant, QVariant("BUSINESS"))));
            QTRY_COMPARE(service.context(), QString("BUSINESS"));
            QCOMPARE(service.accounts().size(), 0);
            QCOMPARE(service.movements().size(), 0);
            QCOMPARE(service.summary().value("balance").toDouble(), 0.0);
            window->setProperty("currentPage", "accounts");
            QCoreApplication::processEvents();
            QVERIFY(click(window, "newAccountButton"));
            QVERIFY(fill(window, "accountName", "Caja separada"));
            QVERIFY(fill(window, "accountInitial", "50"));
            QVERIFY(click(window, "saveAccount"));
            QCOMPARE(service.accounts().size(), 1);
            QCOMPARE(service.summary().value("balance").toDouble(), 50.0);
            QVERIFY(QMetaObject::invokeMethod(window, "selectContext", Q_ARG(QVariant, QVariant("PERSONAL"))));
            QCOMPARE(service.summary().value("balance").toDouble(), 120.25);
            QVERIFY(capture(window, QString::fromLatin1(QTest::currentDataTag()) + "-dashboard"));
            window->setProperty("currentPage", "profile");
            QTRY_VERIFY(item(window, "profileName"));
            QVERIFY(fill(window, "profileName", "Perfil confirmado"));
            QVERIFY(click(window, "saveProfile"));
            QCOMPARE(service.userName(), QString("Perfil confirmado"));
            // Same scene reflows when the available width changes at runtime.
            window->resize(size.width() < 800 ? QSize(1180, 800) : QSize(390, 844));
            QTRY_COMPARE(window->property("compact").toBool(), size.width() >= 800);
            window->close();
        }
        FinanceService reopened(path);
        QVERIFY(reopened.login("ui@example.test", "Local-test-2026"));
        QCOMPARE(reopened.movements().size(), 2);
        QCOMPARE(reopened.summary().value("balance").toDouble(), 120.25);
        QCOMPARE(reopened.userName(), QString("Perfil confirmado"));
        QVERIFY(reopened.setContext("BUSINESS"));
        QCOMPARE(reopened.accounts().size(), 1);
        QCOMPARE(reopened.summary().value("balance").toDouble(), 50.0);
    }
};

int main(int argc, char **argv) {
    QGuiApplication app(argc, argv);
    QQuickStyle::setStyle("Basic");
    ResponsiveUiTest test;
    return QTest::qExec(&test, argc, argv);
}
#include "tst_ui.moc"
