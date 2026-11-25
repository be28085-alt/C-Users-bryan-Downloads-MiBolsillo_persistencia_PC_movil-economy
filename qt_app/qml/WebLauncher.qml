import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: window
    objectName: "webLauncherWindow"
    width: 600
    height: 520
    minimumWidth: 340
    minimumHeight: 340
    visible: true
    title: "MiBolsillo · aplicación HTML"
    color: "#f3f6f8"
    palette.window: "#f3f6f8"
    palette.windowText: "#173f3c"
    palette.text: "#173f3c"
    palette.base: "#ffffff"
    palette.button: "#dcece7"
    palette.buttonText: "#173f3c"
    palette.highlight: "#087b66"
    palette.highlightedText: "#ffffff"

    ScrollView {
        id: launcherScroll
        anchors.fill: parent
        contentWidth: availableWidth
        clip: true
        ColumnLayout {
            width: launcherScroll.availableWidth - 40
            x: 20
            spacing: 16
            Item { Layout.preferredHeight: 8 }
            Label { text: "MiBolsillo"; font.pixelSize: 30; font.bold: true }
            Label {
                text: "Tu aplicación completa de siempre"
                font.pixelSize: 19
                Layout.fillWidth: true
                wrapMode: Text.Wrap
            }
            Label {
                objectName: "launcherStatus"
                text: webLauncher.status
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                font.bold: true
            }
            Label {
                visible: webLauncher.error.length > 0
                objectName: "launcherError"
                text: webLauncher.error
                color: "#a33e2e"
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                Accessible.role: Accessible.AlertMessage
            }
            Button {
                text: "Abrir MiBolsillo"
                objectName: "openFullApplication"
                Layout.fillWidth: true
                implicitHeight: 52
                highlighted: true
                enabled: webLauncher.running
                onClicked: webLauncher.openApp()
            }
            Button {
                text: "Reintentar inicio"
                implicitHeight: 48
                visible: !webLauncher.running && webLauncher.error.length > 0
                onClicked: webLauncher.retry()
            }
            Label {
                text: "Esta ventana inicia la app HTML completa en una ventana del navegador. Mantén este servicio abierto mientras la usas para que los cambios se guarden en SQLite."
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                color: "#526d68"
            }
            Label { text: webLauncher.url.toString(); Layout.fillWidth: true; wrapMode: Text.WrapAnywhere; visible: webLauncher.running }
            Label {
                text: webLauncher.database
                Layout.fillWidth: true
                wrapMode: Text.WrapAnywhere
                font.pixelSize: 12
                visible: webLauncher.running
            }
            Item { Layout.preferredHeight: 12 }
        }
    }
}
