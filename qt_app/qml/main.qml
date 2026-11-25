import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: rootWindow
    objectName: "mainWindow"
    width: 1180
    height: 800
    minimumWidth: 320
    minimumHeight: 320
    visible: true
    title: "MiBolsillo"
    color: "#f3f6f8"
    // Cards use light backgrounds on every platform, including Windows dark mode.
    palette {
        window: "#f3f6f8"
        windowText: "#172c32"
        base: "#ffffff"
        alternateBase: "#edf3f1"
        text: "#172c32"
        button: "#e3eeeb"
        buttonText: "#173e38"
        highlight: "#087768"
        highlightedText: "#ffffff"
        placeholderText: "#60766f"
        light: "#ffffff"
        midlight: "#edf3f1"
        mid: "#b8cbc5"
        dark: "#94afa6"
        shadow: "#59766c"
        brightText: "#ffffff"
        link: "#087768"
        linkVisited: "#385c55"
        toolTipBase: "#173e38"
        toolTipText: "#ffffff"
    }
    readonly property bool compact: width < 800
    property string currentPage: "dashboard"

    function navigate(page) {
        currentPage = page
        Qt.inputMethod.hide()
    }
    function selectContext(context) {
        if (financeService.setContext(context)) navigate("dashboard")
    }
    Connections {
        target: financeService
        function onStateChanged() {
            if (!financeService.loggedIn) rootWindow.currentPage = "dashboard"
        }
    }

    header: ToolBar {
        visible: rootWindow.compact && financeService.loggedIn
        height: visible ? 64 : 0
        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 12
            anchors.rightMargin: 12
            Label { text: "MiBolsillo"; font.bold: true; font.pixelSize: 19; Layout.fillWidth: true }
            ComboBox {
                objectName: "contextPicker"
                implicitHeight: 48
                implicitWidth: 148
                model: ["Personal", "Mi Negocio"]
                currentIndex: financeService.context === "BUSINESS" ? 1 : 0
                onActivated: rootWindow.selectContext(currentIndex === 0 ? "PERSONAL" : "BUSINESS")
                Accessible.name: "Contexto financiero"
            }
        }
    }
    footer: TabBar {
        objectName: "compactNavigation"
        visible: rootWindow.compact && financeService.loggedIn
        height: visible ? 60 : 0
        currentIndex: rootWindow.currentPage === "accounts" ? 1
                      : rootWindow.currentPage === "movements" ? 2
                      : rootWindow.currentPage === "profile" ? 3 : 0
        TabButton { text: "Inicio"; implicitHeight: 60; onClicked: rootWindow.navigate("dashboard") }
        TabButton { text: "Cuentas"; implicitHeight: 60; onClicked: rootWindow.navigate("accounts") }
        TabButton { text: "Movimientos"; implicitHeight: 60; onClicked: rootWindow.navigate("movements") }
        TabButton { text: "Perfil"; implicitHeight: 60; onClicked: rootWindow.navigate("profile") }
    }
    RowLayout {
        anchors.fill: parent
        spacing: 0
        Rectangle {
            visible: !rootWindow.compact && financeService.loggedIn
            Layout.fillHeight: true
            Layout.preferredWidth: 224
            color: "#0b3b3c"
            ScrollView {
                id: sidebarScroll
                anchors.fill: parent
                anchors.margins: 16
                contentWidth: availableWidth
                clip: true
                ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
            ColumnLayout {
                width: sidebarScroll.availableWidth
                height: Math.max(implicitHeight, sidebarScroll.availableHeight)
                spacing: 10
                Label { text: "MiBolsillo"; color: "white"; font.bold: true; font.pixelSize: 25; topPadding: 12; bottomPadding: 10 }
                Label { text: financeService.userName; color: "#c9e8e3"; wrapMode: Text.Wrap; Layout.fillWidth: true }
                ComboBox {
                    objectName: "desktopContextPicker"
                    Layout.fillWidth: true
                    implicitHeight: 48
                    model: ["Personal", "Mi Negocio"]
                    currentIndex: financeService.context === "BUSINESS" ? 1 : 0
                    onActivated: rootWindow.selectContext(currentIndex === 0 ? "PERSONAL" : "BUSINESS")
                    Accessible.name: "Contexto financiero"
                }
                Label { text: "TU ESPACIO"; color: "#94bcb8"; font.pixelSize: 11; topPadding: 18; bottomPadding: 4 }
                Repeater {
                    model: [ {label: "Inicio", page: "dashboard"}, {label: "Cuentas", page: "accounts"},
                        {label: "Movimientos", page: "movements"}, {label: "Reporte de caja", page: "report"},
                        {label: "Mi perfil", page: "profile"} ]
                    delegate: Button {
                        required property var modelData
                        Layout.fillWidth: true
                        implicitHeight: 48
                        text: modelData.label
                        highlighted: rootWindow.currentPage === modelData.page
                        onClicked: rootWindow.navigate(modelData.page)
                    }
                }
                Item { Layout.fillHeight: true }
                Label {
                    text: "SQLite local · COP\nDatos independientes en este dispositivo"
                    color: "#c9e8e3"
                    wrapMode: Text.Wrap
                    Layout.fillWidth: true
                    font.pixelSize: 12
                }
            }
            }
        }
        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0
            Rectangle {
                Layout.fillWidth: true
                visible: financeService.error.length > 0 || !financeService.ready
                implicitHeight: errorRow.implicitHeight + 24
                color: "#fff0ed"
                RowLayout {
                    id: errorRow
                    anchors.fill: parent
                    anchors.margins: 12
                    Label {
                        Layout.fillWidth: true
                        text: financeService.error.length ? financeService.error : "No se pudo abrir el almacenamiento."
                        color: "#922d25"
                        wrapMode: Text.Wrap
                        Accessible.role: Accessible.AlertMessage
                    }
                    Button {
                        text: "Reintentar"
                        implicitHeight: 48
                        onClicked: financeService.ready ? financeService.refresh() : financeService.retryStorage()
                    }
                }
            }
            Loader {
                Layout.fillWidth: true
                Layout.fillHeight: true
                sourceComponent: !financeService.loggedIn ? authComponent
                                 : rootWindow.currentPage === "profile" ? profileComponent : financeComponent
            }
        }
    }
    Component { id: authComponent; AuthView {} }
    Component {
        id: financeComponent
        FinanceView {
            compact: rootWindow.compact
            page: rootWindow.currentPage
            onNavigateRequested: function(page) { rootWindow.navigate(page) }
        }
    }
    Component {
        id: profileComponent
        ProfileView {
            compact: rootWindow.compact
            onAbrirModuloEmpresarial: rootWindow.selectContext("BUSINESS")
        }
    }
}
