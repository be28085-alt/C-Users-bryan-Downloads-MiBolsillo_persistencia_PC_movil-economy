import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Item {
    id: profileView
    signal abrirModuloEmpresarial()

    ScrollView {
        anchors.fill: parent
        contentWidth: availableWidth

        ColumnLayout {
            width: parent.width
            spacing: 20
            anchors.margins: 28

            // Título de la Sección
            Column {
                Text { text: "Tu Espacio · Mi Perfil"; font.pixelSize: 24; font.bold: true; color: "#0f172a" }
                Text { text: "Administración de perfil de usuario y acceso a módulos extendidos."; color: "#64748b"; font.pixelSize: 13 }
            }

            // Tarjeta de Identidad de Usuario
            Rectangle {
                Layout.fillWidth: true
                height: 100
                radius: 12
                color: "#ffffff"
                border.color: "#e2e8f0"

                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 18
                    spacing: 16

                    Rectangle {
                        width: 60; height: 60; radius: 30
                        color: "#0b3b3c"
                        Text {
                            anchors.centerIn: parent
                            text: "LM"
                            color: "#ffffff"
                            font.bold: true
                            font.pixelSize: 20
                        }
                    }

                    ColumnLayout {
                        spacing: 2
                        Text { text: "Lucía Martín"; font.bold: true; font.pixelSize: 18; color: "#0f172a" }
                        Text { text: "lucia.martin@email.com · Moneda: COP ($)"; color: "#64748b"; font.pixelSize: 13 }
                    }

                    Item { Layout.fillWidth: true }

                    Button {
                        text: "✏️ Editar Perfil"
                        flat: true
                    }
                }
            }

            // ================================================================
            // NUEVO APARTADO: GESTIÓN EMPRESARIAL (BOTÓN Y HERO REQUERIDO)
            // ================================================================
            Rectangle {
                Layout.fillWidth: true
                radius: 16
                color: "#0b3b3c"
                border.color: Qt.rgba(1, 1, 1, 0.15)
                implicitHeight: 220

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 24
                    spacing: 16

                    RowLayout {
                        Layout.fillWidth: true

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 6

                            Rectangle {
                                width: 220; height: 26; radius: 13
                                color: Qt.rgba(1, 1, 1, 0.15)
                                Text {
                                    anchors.centerIn: parent
                                    text: "🚀 NUEVO MÓDULO EMPRESARIAL"
                                    color: "#6ee7b7"
                                    font.bold: true
                                    font.pixelSize: 11
                                }
                            }

                            Text {
                                text: "Gestión de Pequeños Negocios y Emprendimientos"
                                font.pixelSize: 20
                                font.bold: true
                                color: "#ffffff"
                            }

                            Text {
                                Layout.fillWidth: true
                                text: "Administra materias primas, productos, compras, fórmulas de fabricación, ventas de contado y a crédito, clientes, empleados y cálculo de utilidad real."
                                color: "#e2e8f0"
                                font.pixelSize: 13
                                wrapMode: Text.WordWrap
                            }
                        }

                        // Botón de Acceso Directo
                        Button {
                            text: "🏢 Entrar a Gestión Empresarial →"
                            implicitHeight: 46
                            implicitWidth: 260
                            background: Rectangle {
                                radius: 10
                                color: "#ffffff"
                            }
                            contentItem: Text {
                                text: parent.text
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                                font.bold: true
                                font.pixelSize: 13
                                color: "#0b3b3c"
                            }
                            onClicked: profileView.abrirModuloEmpresarial()
                        }
                    }

                    // Fila de Indicadores Rápidos
                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 12

                        Rectangle {
                            Layout.fillWidth: true
                            height: 60
                            radius: 8
                            color: Qt.rgba(1, 1, 1, 0.08)
                            Column {
                                anchors.centerIn: parent
                                Text { text: "NEGOCIO ACTIVO"; color: "#94a3b8"; font.pixelSize: 10; font.bold: true }
                                Text { text: "Panadería & Delicias La Aurora"; color: "#ffffff"; font.bold: true; font.pixelSize: 13 }
                            }
                        }

                        Rectangle {
                            Layout.fillWidth: true
                            height: 60
                            radius: 8
                            color: Qt.rgba(1, 1, 1, 0.08)
                            Column {
                                anchors.centerIn: parent
                                Text { text: "VENTAS DEL MES"; color: "#94a3b8"; font.pixelSize: 10; font.bold: true }
                                Text { text: "$ 543.000 COP"; color: "#6ee7b7"; font.bold: true; font.pixelSize: 13 }
                            }
                        }

                        Rectangle {
                            Layout.fillWidth: true
                            height: 60
                            radius: 8
                            color: Qt.rgba(1, 1, 1, 0.08)
                            Column {
                                anchors.centerIn: parent
                                Text { text: "UTILIDAD NETA REAL"; color: "#94a3b8"; font.pixelSize: 10; font.bold: true }
                                Text { text: "$ 281.400 COP"; color: "#ffffff"; font.bold: true; font.pixelSize: 13 }
                            }
                        }
                    }
                }
            }

            Item { height: 20 }
        }
    }
}
