import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

ApplicationWindow {
    id: rootWindow
    width: 1280
    height: 800
    visible: true
    title: "Gestor Financiero Integral: Personal & Empresarial"
    color: "#f3f6f8"

    property string moduloActivo: "PERSONAL" // "PERSONAL" | "EMPRESARIAL"
    property string vistaActual: "dashboard"

    RowLayout {
        anchors.fill: parent
        spacing: 0

        // ====================================================================
        // SIDEBAR DE NAVEGACIÓN
        // ====================================================================
        Rectangle {
            Layout.fillHeight: true
            Layout.preferredWidth: 260
            color: "#0b3b3c"

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 16
                spacing: 12

                // Logotipo / Marca
                RowLayout {
                    spacing: 10
                    Rectangle {
                        width: 36; height: 36; radius: 8
                        color: "#114b4e"
                        Text {
                            anchors.centerIn: parent
                            text: moduloActivo === "PERSONAL" ? "❖" : "🏢"
                            color: "#ffffff"
                            font.bold: true
                            font.pixelSize: 18
                        }
                    }
                    Column {
                        Text {
                            text: moduloActivo === "PERSONAL" ? "mi dinero" : "gestor pro"
                            color: "#ffffff"
                            font.bold: true
                            font.pixelSize: 16
                        }
                        Text {
                            text: moduloActivo === "PERSONAL" ? "Finanzas personales" : "Gestión empresarial"
                            color: "#94a3b8"
                            font.pixelSize: 11
                        }
                    }
                }

                // Conmutador de Módulos (Personal / Negocios)
                Rectangle {
                    Layout.fillWidth: true
                    height: 38
                    radius: 8
                    color: Qt.rgba(1, 1, 1, 0.1)

                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 3
                        spacing: 4

                        Button {
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            text: "👤 Personal"
                            flat: true
                            background: Rectangle {
                                radius: 6
                                color: moduloActivo === "PERSONAL" ? "#ffffff" : "transparent"
                            }
                            contentItem: Text {
                                text: parent.text
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                                color: moduloActivo === "PERSONAL" ? "#0b3b3c" : "#cbd5e1"
                                font.bold: true
                                font.pixelSize: 12
                            }
                            onClicked: {
                                moduloActivo = "PERSONAL";
                                vistaActual = "dashboard";
                            }
                        }

                        Button {
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            text: "🏢 Negocios"
                            flat: true
                            background: Rectangle {
                                radius: 6
                                color: moduloActivo === "EMPRESARIAL" ? "#ffffff" : "transparent"
                            }
                            contentItem: Text {
                                text: parent.text
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                                color: moduloActivo === "EMPRESARIAL" ? "#0b3b3c" : "#cbd5e1"
                                font.bold: true
                                font.pixelSize: 12
                            }
                            onClicked: {
                                moduloActivo = "EMPRESARIAL";
                                vistaActual = "biz-dashboard";
                            }
                        }
                    }
                }

                // Menú Vertical Finanzas Personales
                ColumnLayout {
                    Layout.fillWidth: true
                    visible: moduloActivo === "PERSONAL"
                    spacing: 4

                    NavButton { text: "🏠 Inicio / Dashboard"; active: vistaActual === "dashboard"; onClicked: vistaActual = "dashboard" }
                    NavButton { text: "⇋ Movimientos"; active: vistaActual === "movimientos"; onClicked: vistaActual = "movimientos" }
                    NavButton { text: "🎯 Presupuesto"; active: vistaActual === "presupuesto"; onClicked: vistaActual = "presupuesto" }
                    NavButton { text: "🐖 Metas de Ahorro"; active: vistaActual === "metas"; onClicked: vistaActual = "metas" }
                    NavButton { text: "💳 Deudas Personales"; active: vistaActual === "deudas"; onClicked: vistaActual = "deudas" }
                    NavButton { text: "⚙️ Mi Perfil y Ajustes"; active: vistaActual === "perfil"; onClicked: vistaActual = "perfil" }
                }

                // Menú Vertical Gestión Empresarial
                ColumnLayout {
                    Layout.fillWidth: true
                    visible: moduloActivo === "EMPRESARIAL"
                    spacing: 4

                    NavButton { text: "📊 Dashboard"; active: vistaActual === "biz-dashboard"; onClicked: vistaActual = "biz-dashboard" }
                    NavButton { text: "🏢 Mi Negocio"; active: vistaActual === "biz-perfil"; onClicked: vistaActual = "biz-perfil" }
                    NavButton { text: "📦 Productos"; active: vistaActual === "biz-productos"; onClicked: vistaActual = "biz-productos" }
                    NavButton { text: "🧪 Materias Primas"; active: vistaActual === "biz-materias"; onClicked: vistaActual = "biz-materias" }
                    NavButton { text: "📋 Inventario & Stock"; active: vistaActual === "biz-inventario"; onClicked: vistaActual = "biz-inventario" }
                    NavButton { text: "🛒 Compras"; active: vistaActual === "biz-compras"; onClicked: vistaActual = "biz-compras" }
                    NavButton { text: "⚙️ Producción & Recetas"; active: vistaActual === "biz-produccion"; onClicked: vistaActual = "biz-produccion" }
                    NavButton { text: "💰 Ventas & Facturación"; active: vistaActual === "biz-ventas"; onClicked: vistaActual = "biz-ventas" }
                    NavButton { text: "👥 Clientes & Créditos"; active: vistaActual === "biz-clientes"; onClicked: vistaActual = "biz-clientes" }
                    NavButton { text: "👷 Empleados & Nómina"; active: vistaActual === "biz-empleados"; onClicked: vistaActual = "biz-empleados" }
                    NavButton { text: "💸 Gastos Negocio"; active: vistaActual === "biz-gastos"; onClicked: vistaActual = "biz-gastos" }
                    NavButton { text: "📈 Ganancias & Reportes"; active: vistaActual === "biz-reportes"; onClicked: vistaActual = "biz-reportes" }
                }

                Item { Layout.fillHeight: true }
            }
        }

        // ====================================================================
        // ÁREA PRINCIPAL DE CONTENIDO
        // ====================================================================
        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: moduloActivo === "PERSONAL" ? (vistaActual === "perfil" ? 1 : 0) : 2

            // Vista Personal Dashboard
            Rectangle {
                color: "#f3f6f8"
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 24
                    spacing: 16
                    Text { text: "Panel de Finanzas Personales"; font.pixelSize: 22; font.bold: true; color: "#0f172a" }
                    Text { text: "Control de ingresos, gastos, presupuestos y metas de ahorro."; color: "#64748b" }
                }
            }

            // Vista Mi Perfil (Contiene el botón hacia el módulo empresarial)
            ProfileView {
                onAbrirModuloEmpresarial: {
                    moduloActivo = "EMPRESARIAL";
                    vistaActual = "biz-dashboard";
                }
            }

            // Módulo Empresarial Completo
            BusinessModule {
                vistaSubmodulo: vistaActual
            }
        }
    }

    // Componente auxiliar de botón en navegación lateral
    component NavButton : Button {
        property bool active: false
        Layout.fillWidth: true
        height: 38
        flat: true
        background: Rectangle {
            radius: 6
            color: active ? Qt.rgba(1, 1, 1, 0.15) : "transparent"
        }
        contentItem: Text {
            text: parent.text
            verticalAlignment: Text.AlignVCenter
            color: active ? "#ffffff" : "#cbd5e1"
            font.bold: active
            font.pixelSize: 13
            leftPadding: 8
        }
    }
}
