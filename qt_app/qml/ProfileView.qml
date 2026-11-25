import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ScrollView {
    id: profile
    property bool compact: width < 800
    property Item focusedField: null
    signal abrirModuloEmpresarial()
    contentWidth: availableWidth
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    onHeightChanged: scheduleReveal()
    function reveal(item) {
        if (!item || !item.visible || !contentItem || !contentItem.contentItem) return
        var point = item.mapToItem(contentItem.contentItem, 0, 0)
        var top = contentItem.contentY
        var nextTop = top
        if (point.y + item.height + 20 > top + contentItem.height)
            nextTop = point.y + item.height + 20 - contentItem.height
        else if (point.y < top + 12) nextTop = point.y - 12
        var maxTop = Math.max(0, contentItem.contentHeight - contentItem.height)
        contentItem.contentY = Math.max(0, Math.min(maxTop, nextTop))
    }
    function revealFocused() { reveal(focusedField) }
    function scheduleReveal() { Qt.callLater(revealFocused) }
    function focusField(item) { focusedField = item; scheduleReveal() }
    Connections {
        target: Qt.inputMethod
        function onKeyboardRectangleChanged() { profile.scheduleReveal() }
    }
    Connections {
        target: financeService
        function onStateChanged() { profile.scheduleReveal() }
    }
    ColumnLayout {
        width: profile.availableWidth - 32
        x: 16
        spacing: 14
        Item { Layout.preferredHeight: 8 }
        Label { text: "Mi perfil"; font.pixelSize: 26; font.bold: true; color: "#0b3b3c" }
        Label { text: financeService.email; Layout.fillWidth: true; wrapMode: Text.Wrap }
        Label { text: "Nombre" }
        TextField {
            id: profileName
            objectName: "profileName"
            Component.onCompleted: text = financeService.userName
            Layout.fillWidth: true
            Layout.maximumWidth: 520
            implicitHeight: 50
            maximumLength: 80
            Accessible.name: "Nombre del perfil"
            onActiveFocusChanged: if (activeFocus) profile.focusField(this)
        }
        Button {
            text: "Guardar perfil"
            objectName: "saveProfile"
            implicitHeight: 50
            onActiveFocusChanged: if (activeFocus) profile.focusField(this)
            onClicked: {
                profileMessage.text = ""
                if (financeService.updateProfile(profileName.text)) profileMessage.text = "Perfil guardado en SQLite."
            }
        }
        Label { id: profileMessage; Layout.fillWidth: true; wrapMode: Text.Wrap; color: "#087b66" }
        Label { text: "Almacenamiento local"; font.bold: true; font.pixelSize: 18; topPadding: 16 }
        Label {
            text: "Moneda: COP. Esta aplicación Qt usa su propia base SQLite. No modifica la base web ni importa automáticamente los datos históricos de MySQL."
            Layout.fillWidth: true
            wrapMode: Text.Wrap
            color: "#526976"
        }
        Label { text: financeService.databasePath; Layout.fillWidth: true; wrapMode: Text.WrapAnywhere; font.pixelSize: 12 }
        Button { text: "Abrir Mi Negocio"; implicitHeight: 50; onActiveFocusChanged: if (activeFocus) profile.focusField(this); onClicked: profile.abrirModuloEmpresarial() }
        Button { objectName: "logoutButton"; text: "Cerrar sesión"; implicitHeight: 50; onActiveFocusChanged: if (activeFocus) profile.focusField(this); onClicked: financeService.logout() }
        Item { Layout.preferredHeight: Math.max(24, Qt.inputMethod.keyboardRectangle.height) }
    }
}
