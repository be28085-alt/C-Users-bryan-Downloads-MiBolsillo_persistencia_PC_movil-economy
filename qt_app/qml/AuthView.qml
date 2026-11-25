import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ScrollView {
    id: auth
    objectName: "authView"
    property bool creatingUser: false
    property Item focusedField: null
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
        function onKeyboardRectangleChanged() { auth.scheduleReveal() }
    }
    Connections {
        target: financeService
        function onStateChanged() { auth.scheduleReveal() }
    }
    ColumnLayout {
        width: Math.min(auth.availableWidth - 32, 420)
        x: (auth.availableWidth - width) / 2
        spacing: 14
        Item { Layout.preferredHeight: 32 }
        Label { text: "MiBolsillo"; font.bold: true; font.pixelSize: 32; color: "#0b3b3c" }
        Label { text: "Tus finanzas, en su lugar."; font.pixelSize: 18; color: "#526976" }
        Label {
            Layout.fillWidth: true
            text: auth.creatingUser ? "Crea tu usuario local" : "Inicia sesión en este dispositivo"
            font.pixelSize: 22
            font.bold: true
            topPadding: 18
            wrapMode: Text.Wrap
        }
        Label { text: "Nombre"; visible: auth.creatingUser }
        TextField {
            id: nameField
            objectName: "registerName"
            visible: auth.creatingUser
            Layout.fillWidth: true
            implicitHeight: 50
            maximumLength: 80
            placeholderText: "Tu nombre"
            Accessible.name: "Nombre"
            onActiveFocusChanged: if (activeFocus) auth.focusField(this)
        }
        Label { text: "Correo electrónico" }
        TextField {
            id: emailField
            objectName: "loginEmail"
            Layout.fillWidth: true
            implicitHeight: 50
            maximumLength: 150
            placeholderText: "nombre@correo.com"
            inputMethodHints: Qt.ImhEmailCharactersOnly | Qt.ImhNoAutoUppercase
            Accessible.name: "Correo electrónico"
            onActiveFocusChanged: if (activeFocus) auth.focusField(this)
        }
        Label { text: "Contraseña" }
        TextField {
            id: passwordField
            objectName: "loginPassword"
            Layout.fillWidth: true
            implicitHeight: 50
            maximumLength: 128
            echoMode: TextInput.Password
            placeholderText: auth.creatingUser ? "Mínimo 8 caracteres" : "Tu contraseña"
            inputMethodHints: Qt.ImhSensitiveData | Qt.ImhNoPredictiveText
            Accessible.name: "Contraseña"
            onActiveFocusChanged: if (activeFocus) auth.focusField(this)
            onAccepted: if (submitButton.enabled) submitButton.clicked()
        }
        Button {
            id: submitButton
            objectName: "loginSubmit"
            text: auth.creatingUser ? "Crear usuario y entrar" : "Iniciar sesión"
            Layout.fillWidth: true
            implicitHeight: 52
            highlighted: true
            onActiveFocusChanged: if (activeFocus) auth.focusField(this)
            enabled: financeService.ready && emailField.text.length > 0 && passwordField.text.length > 0
            onClicked: {
                Qt.inputMethod.hide()
                var saved = auth.creatingUser
                    ? financeService.registerUser(nameField.text, emailField.text, passwordField.text)
                    : financeService.login(emailField.text, passwordField.text)
                if (saved) passwordField.clear()
            }
        }
        Button {
            objectName: "toggleRegistration"
            text: auth.creatingUser ? "Ya tengo usuario: iniciar sesión" : "Primera vez: crear usuario local"
            Layout.fillWidth: true
            implicitHeight: 50
            flat: true
            onActiveFocusChanged: if (activeFocus) auth.focusField(this)
            onClicked: { auth.creatingUser = !auth.creatingUser; passwordField.clear() }
        }
        Label {
            Layout.fillWidth: true
            text: "Personal y Mi Negocio tienen cuentas y movimientos separados. Los datos se guardan en SQLite en este dispositivo; no se sincronizan con otros equipos."
            wrapMode: Text.Wrap
            color: "#526976"
            font.pixelSize: 13
        }
        Item { Layout.preferredHeight: Math.max(24, Qt.inputMethod.keyboardRectangle.height) }
    }
}
