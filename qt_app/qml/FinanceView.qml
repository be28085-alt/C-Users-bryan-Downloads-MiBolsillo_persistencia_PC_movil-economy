import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ScrollView {
    id: finance
    objectName: "financeView"
    property bool compact: width < 800
    property string page: "dashboard"
    property bool showAccountForm: false
    property bool showMovementForm: false
    property string message: ""
    property string previousContext: ""
    Component.onCompleted: previousContext = financeService.context
    signal navigateRequested(string page)
    contentWidth: availableWidth
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    onHeightChanged: scheduleReveal()
    onPageChanged: {
        focusedField = null
        Qt.callLater(function() { if (contentItem) contentItem.contentY = 0 })
    }

    function money(value) { return Number(value || 0).toLocaleString(Qt.locale("es_CO"), "f", 2) + " COP" }
    function newAccount() {
        navigateRequested("accounts")
        showAccountForm = true
        showMovementForm = false
        message = ""
        Qt.callLater(function() { accountName.forceActiveFocus() })
    }
    function newMovement() {
        navigateRequested("movements")
        showMovementForm = true
        showAccountForm = false
        message = ""
        Qt.callLater(function() { movementAmount.forceActiveFocus() })
    }
    function reveal(item) {
        if (!item || !item.visible || !contentItem || !contentItem.contentItem) return
        var point = item.mapToItem(contentItem.contentItem, 0, 0)
        var top = contentItem.contentY
        var bottom = top + contentItem.height
        var nextTop = top
        if (point.y + item.height + 20 > bottom)
            nextTop = point.y + item.height + 20 - contentItem.height
        else if (point.y < top + 12) nextTop = point.y - 12
        var maxTop = Math.max(0, contentItem.contentHeight - contentItem.height)
        contentItem.contentY = Math.max(0, Math.min(maxTop, nextTop))
    }
    property Item focusedField: null
    function revealFocused() { reveal(focusedField) }
    function scheduleReveal() { Qt.callLater(revealFocused) }
    function focusField(item) { focusedField = item; scheduleReveal() }
    Connections {
        target: Qt.inputMethod
        function onKeyboardRectangleChanged() { finance.scheduleReveal() }
    }
    Connections {
        target: financeService
        function onStateChanged() {
            if (finance.previousContext !== financeService.context) {
                finance.previousContext = financeService.context
                finance.showAccountForm = false
                finance.showMovementForm = false
                finance.message = ""
                accountName.clear()
                accountInitial.text = "0"
                movementAmount.clear()
                movementDescription.clear()
            }
            finance.scheduleReveal()
        }
    }
    ColumnLayout {
        width: finance.availableWidth - (finance.compact ? 32 : 48)
        x: finance.compact ? 16 : 24
        spacing: 16
        Item { Layout.preferredHeight: 8 }
        Label {
            text: finance.page === "accounts" ? "Tus cuentas" : finance.page === "movements" ? "Movimientos"
                : finance.page === "report" ? "Reporte de caja" : financeService.context === "BUSINESS" ? "Mi Negocio" : "Finanzas personales"
            font.bold: true
            font.pixelSize: finance.compact ? 24 : 28
            color: "#0b3b3c"
            Layout.fillWidth: true
            wrapMode: Text.Wrap
        }
        Label {
            text: financeService.context === "BUSINESS" ? "Cuentas y movimientos de Mi Negocio" : "Cuentas y movimientos personales"
            color: "#526976"
            Layout.fillWidth: true
            wrapMode: Text.Wrap
        }
        BusinessModule { visible: financeService.context === "BUSINESS" && finance.page === "dashboard"; Layout.fillWidth: true }
        GridLayout {
            visible: finance.page === "dashboard" || finance.page === "report"
            columns: finance.compact ? 1 : 3
            Layout.fillWidth: true
            rowSpacing: 12
            columnSpacing: 12
            Repeater {
                model: [ {label: "Saldo actual", value: financeService.summary.balance, color: "#0b3b3c"},
                    {label: "Ingresos registrados", value: financeService.summary.income, color: "#087b66"},
                    {label: "Gastos registrados", value: financeService.summary.expense, color: "#ab4939"} ]
                delegate: Pane {
                    required property var modelData
                    Layout.fillWidth: true
                    padding: 16
                    background: Rectangle { color: "white"; radius: 12; border.color: "#dde6e8" }
                    contentItem: ColumnLayout {
                        spacing: 8
                        Label { text: modelData.label; color: "#526976"; Layout.fillWidth: true; wrapMode: Text.Wrap }
                        Label { text: finance.money(modelData.value); color: modelData.color; font.pixelSize: finance.compact ? 24 : 20; font.bold: true; Layout.fillWidth: true; wrapMode: Text.WrapAnywhere }
                    }
                }
            }
        }
        Label {
            visible: finance.page === "report"
            text: "Acumulado de todos los movimientos del contexto actual. El saldo incluye los saldos iniciales de las cuentas. Ingresos menos gastos representa el flujo de caja registrado; no incluye los saldos iniciales."
            Layout.fillWidth: true
            wrapMode: Text.Wrap
            color: "#526976"
        }
        GridLayout {
            visible: finance.page !== "report"
            Layout.fillWidth: true
            columns: finance.compact ? 1 : 3
            columnSpacing: 10
            rowSpacing: 10
            Button {
                objectName: "newAccountButton"
                text: "+ Abrir cuenta"
                Layout.fillWidth: true
                implicitHeight: 50
                onActiveFocusChanged: if (activeFocus) finance.focusField(this)
                onClicked: finance.newAccount()
            }
            Button {
                objectName: "newMovementButton"
                text: "+ Ingreso o gasto"
                Layout.fillWidth: true
                implicitHeight: 50
                highlighted: true
                onActiveFocusChanged: if (activeFocus) finance.focusField(this)
                enabled: financeService.accounts.length > 0
                onClicked: finance.newMovement()
            }
            Button {
                text: "Ver reporte de caja"
                visible: finance.page === "dashboard"
                Layout.fillWidth: true
                implicitHeight: 50
                onActiveFocusChanged: if (activeFocus) finance.focusField(this)
                onClicked: finance.navigateRequested("report")
            }
        }
        Label { text: finance.message; visible: text.length > 0; Layout.fillWidth: true; wrapMode: Text.Wrap; color: "#087b66" }
        Pane {
            visible: finance.showAccountForm && finance.page === "accounts"
            Layout.fillWidth: true
            padding: 16
            background: Rectangle { radius: 12; color: "white"; border.color: "#c7ddda" }
            contentItem: ColumnLayout {
                spacing: 12
                Label { text: "Abrir una cuenta"; font.pixelSize: 20; font.bold: true }
                Label { text: "Nombre de la cuenta" }
                TextField {
                    id: accountName
                    objectName: "accountName"
                    Layout.fillWidth: true
                    implicitHeight: 50
                    maximumLength: 80
                    placeholderText: financeService.context === "BUSINESS" ? "Caja del negocio" : "Efectivo o banco"
                    Accessible.name: "Nombre de la cuenta"
                    onActiveFocusChanged: if (activeFocus) finance.focusField(this)
                }
                Label { text: "Saldo inicial (COP)" }
                TextField {
                    id: accountInitial
                    objectName: "accountInitial"
                    Layout.fillWidth: true
                    implicitHeight: 50
                    text: "0"
                    maximumLength: 16
                    inputMethodHints: Qt.ImhFormattedNumbersOnly
                    placeholderText: "0,00"
                    Accessible.name: "Saldo inicial en COP"
                    onActiveFocusChanged: if (activeFocus) finance.focusField(this)
                }
                Label { text: "Usa coma o punto decimal, sin separadores de miles."; Layout.fillWidth: true; wrapMode: Text.Wrap; color: "#526976"; font.pixelSize: 12 }
                Flow {
                    Layout.fillWidth: true
                    spacing: 10
                    Button {
                        objectName: "saveAccount"
                        text: "Guardar cuenta"
                        implicitHeight: 50
                        highlighted: true
                        onActiveFocusChanged: if (activeFocus) finance.focusField(this)
                        onClicked: {
                            finance.message = ""
                            if (financeService.createAccount(accountName.text, accountInitial.text)) {
                                accountName.clear()
                                accountInitial.text = "0"
                                finance.showAccountForm = false
                                finance.message = "Cuenta guardada en SQLite."
                                Qt.inputMethod.hide()
                            }
                        }
                    }
                    Button { text: "Cancelar"; implicitHeight: 50; onActiveFocusChanged: if (activeFocus) finance.focusField(this); onClicked: { finance.showAccountForm = false; Qt.inputMethod.hide() } }
                }
            }
        }
        Pane {
            visible: finance.showMovementForm && finance.page === "movements"
            Layout.fillWidth: true
            padding: 16
            background: Rectangle { radius: 12; color: "white"; border.color: "#c7ddda" }
            contentItem: ColumnLayout {
                spacing: 12
                Label { text: "Registrar movimiento"; font.pixelSize: 20; font.bold: true; Layout.fillWidth: true; wrapMode: Text.Wrap }
                GridLayout {
                    Layout.fillWidth: true
                    columns: finance.compact ? 1 : 2
                    columnSpacing: 16
                    rowSpacing: 12
                    ColumnLayout {
                        Layout.fillWidth: true
                        Label { text: "Cuenta" }
                        ComboBox {
                            id: movementAccount
                            objectName: "movementAccount"
                            model: financeService.accounts
                            textRole: "name"
                            Layout.fillWidth: true
                            implicitHeight: 50
                            Accessible.name: "Cuenta del movimiento"
                            onActiveFocusChanged: if (activeFocus) finance.focusField(this)
                        }
                    }
                    ColumnLayout {
                        Layout.fillWidth: true
                        Label { text: "Tipo" }
                        ComboBox {
                            id: movementType
                            objectName: "movementType"
                            model: ["Ingreso", "Gasto"]
                            Layout.fillWidth: true
                            implicitHeight: 50
                            Accessible.name: "Tipo de movimiento"
                            onActiveFocusChanged: if (activeFocus) finance.focusField(this)
                        }
                    }
                    ColumnLayout {
                        Layout.fillWidth: true
                        Label { text: "Importe (COP)" }
                        TextField {
                            id: movementAmount
                            objectName: "movementAmount"
                            Layout.fillWidth: true
                            implicitHeight: 50
                            maximumLength: 16
                            placeholderText: "0,00"
                            inputMethodHints: Qt.ImhFormattedNumbersOnly
                            Accessible.name: "Importe en COP"
                            onActiveFocusChanged: if (activeFocus) finance.focusField(this)
                        }
                    }
                    ColumnLayout {
                        Layout.fillWidth: true
                        Label { text: "Fecha (AAAA-MM-DD)" }
                        TextField {
                            id: movementDate
                            objectName: "movementDate"
                            Layout.fillWidth: true
                            implicitHeight: 50
                            text: Qt.formatDate(new Date(), "yyyy-MM-dd")
                            maximumLength: 10
                            inputMethodHints: Qt.ImhDate
                            Accessible.name: "Fecha del movimiento"
                            onActiveFocusChanged: if (activeFocus) finance.focusField(this)
                        }
                    }
                }
                Label { text: "Descripción" }
                TextField {
                    id: movementDescription
                    objectName: "movementDescription"
                    Layout.fillWidth: true
                    implicitHeight: 50
                    maximumLength: 255
                    placeholderText: "¿De qué fue este movimiento?"
                    Accessible.name: "Descripción del movimiento"
                    onActiveFocusChanged: if (activeFocus) finance.focusField(this)
                }
                Label { text: "Usa coma o punto decimal, sin separadores de miles."; Layout.fillWidth: true; wrapMode: Text.Wrap; color: "#526976"; font.pixelSize: 12 }
                Flow {
                    Layout.fillWidth: true
                    spacing: 10
                    Button {
                        objectName: "saveMovement"
                        text: "Guardar movimiento"
                        implicitHeight: 50
                        highlighted: true
                        onActiveFocusChanged: if (activeFocus) finance.focusField(this)
                        enabled: movementAccount.currentIndex >= 0
                        onClicked: {
                            finance.message = ""
                            var account = financeService.accounts[movementAccount.currentIndex]
                            if (account && financeService.addMovement(account.id,
                                    movementType.currentIndex === 0 ? "INCOME" : "EXPENSE",
                                    movementAmount.text, movementDescription.text, movementDate.text)) {
                                movementAmount.clear()
                                movementDescription.clear()
                                finance.showMovementForm = false
                                finance.message = "Movimiento guardado en SQLite. Saldo actualizado."
                                Qt.inputMethod.hide()
                            }
                        }
                    }
                    Button { text: "Cancelar"; implicitHeight: 50; onActiveFocusChanged: if (activeFocus) finance.focusField(this); onClicked: { finance.showMovementForm = false; Qt.inputMethod.hide() } }
                }
            }
        }
        Label {
            visible: finance.page !== "movements"
            text: "Cuentas · " + financeService.accounts.length
            font.pixelSize: 20
            font.bold: true
            color: "#0b3b3c"
        }
        Label {
            visible: financeService.accounts.length === 0 && finance.page !== "movements"
            text: "Todavía no tienes cuentas en este contexto. Abre una cuenta para registrar tu primer ingreso o gasto."
            Layout.fillWidth: true
            wrapMode: Text.Wrap
            color: "#526976"
        }
        Repeater {
            model: finance.page === "movements" ? [] : financeService.accounts
            delegate: Pane {
                required property var modelData
                Layout.fillWidth: true
                padding: 16
                background: Rectangle { radius: 10; color: "white"; border.color: "#dde6e8" }
                contentItem: GridLayout {
                    columns: finance.compact ? 1 : 2
                    Label { text: modelData.name; font.bold: true; Layout.fillWidth: true; wrapMode: Text.Wrap }
                    Label { text: finance.money(modelData.balance); color: "#0b3b3c"; font.pixelSize: 20; Layout.fillWidth: true; wrapMode: Text.WrapAnywhere }
                }
            }
        }
        Label {
            visible: finance.page !== "accounts"
            text: "Movimientos · " + financeService.movements.length
            font.pixelSize: 20
            font.bold: true
            color: "#0b3b3c"
        }
        Label { visible: financeService.movements.length === 0 && finance.page !== "accounts"; text: "Aún no hay movimientos en este contexto."; Layout.fillWidth: true; wrapMode: Text.Wrap; color: "#526976" }
        Rectangle {
            visible: !finance.compact && finance.page !== "accounts" && financeService.movements.length > 0
            Layout.fillWidth: true
            implicitHeight: 42
            color: "#e2ebe9"
            RowLayout {
                anchors.fill: parent
                anchors.margins: 10
                Label { text: "Fecha"; Layout.preferredWidth: 96; font.bold: true }
                Label { text: "Cuenta / descripción"; Layout.fillWidth: true; font.bold: true }
                Label { text: "Importe"; Layout.preferredWidth: 170; font.bold: true; horizontalAlignment: Text.AlignRight }
            }
        }
        Repeater {
            model: finance.page === "accounts" ? [] : financeService.movements
            delegate: Pane {
                required property var modelData
                Layout.fillWidth: true
                padding: 12
                background: Rectangle { radius: finance.compact ? 10 : 2; color: "white"; border.color: "#dde6e8" }
                contentItem: GridLayout {
                    columns: finance.compact ? 1 : 3
                    columnSpacing: 12
                    Label { text: modelData.date; Layout.preferredWidth: finance.compact ? -1 : 96; color: "#526976" }
                    ColumnLayout {
                        Layout.fillWidth: true
                        Label { text: modelData.accountName; font.bold: true; Layout.fillWidth: true; wrapMode: Text.Wrap }
                        Label { text: modelData.description || (modelData.type === "INCOME" ? "Ingreso" : "Gasto"); Layout.fillWidth: true; wrapMode: Text.Wrap; color: "#526976" }
                    }
                    Label {
                        text: (modelData.type === "INCOME" ? "+ " : "− ") + finance.money(modelData.amount)
                        color: modelData.type === "INCOME" ? "#087b66" : "#ab4939"
                        font.bold: true
                        Layout.preferredWidth: finance.compact ? -1 : 170
                        Layout.fillWidth: finance.compact
                        horizontalAlignment: finance.compact ? Text.AlignLeft : Text.AlignRight
                        wrapMode: Text.WrapAnywhere
                    }
                }
            }
        }
        Item { Layout.preferredHeight: Math.max(24, Qt.inputMethod.keyboardRectangle.height) }
    }
}
