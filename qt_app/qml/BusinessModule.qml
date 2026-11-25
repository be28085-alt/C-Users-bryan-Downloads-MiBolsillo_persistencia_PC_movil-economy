import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Pane {
    padding: 16
    background: Rectangle { radius: 10; color: "#e7f2ef" }
    contentItem: ColumnLayout {
        spacing: 8
        Label { text: "Mi Negocio · Caja"; font.bold: true; font.pixelSize: 18; color: "#0b3b3c" }
        Label {
            Layout.fillWidth: true
            text: "Registra las cuentas, ingresos y gastos de tu negocio por separado de tus finanzas personales."
            wrapMode: Text.Wrap
            color: "#315e58"
        }
        Label {
            Layout.fillWidth: true
            text: "Inventario, compras, ventas a crédito y producción del prototipo MySQL todavía no están disponibles en esta versión Qt local. El reporte muestra flujo de caja, no utilidad comercial."
            wrapMode: Text.Wrap
            font.pixelSize: 12
            color: "#526976"
        }
    }
}
