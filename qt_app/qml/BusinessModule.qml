import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Item {
    id: businessModule
    property string vistaSubmodulo: "biz-dashboard"

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 24
        spacing: 16

        // Barra Superior del Negocio Activo
        Rectangle {
            Layout.fillWidth: true
            height: 60
            radius: 12
            color: "#ffffff"
            border.color: "#e2e8f0"

            RowLayout {
                anchors.fill: parent
                anchors.margins: 12
                spacing: 16

                Rectangle {
                    width: 36; height: 36; radius: 8
                    color: "#e6f4f2"
                    Text { anchors.centerIn: parent; text: "🏢"; font.pixelSize: 18 }
                }

                Column {
                    Text { text: "Panadería & Delicias La Aurora"; font.bold: true; font.pixelSize: 15; color: "#0f172a" }
                    Text { text: "Sector: Alimentos / Panadería Artesanal · Moneda: COP"; font.pixelSize: 11; color: "#64748b" }
                }

                Item { Layout.fillWidth: true }

                Button {
                    text: "+ Nueva Venta"
                    highlighted: true
                }
                Button {
                    text: "+ Nueva Compra"
                }
                Button {
                    text: "🏭 Fabricar Lote"
                }
            }
        }

        // Subvistas
        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: {
                if (vistaSubmodulo === "biz-dashboard") return 0;
                if (vistaSubmodulo === "biz-productos") return 1;
                if (vistaSubmodulo === "biz-inventario") return 2;
                if (vistaSubmodulo === "biz-reportes") return 3;
                return 0;
            }

            // Subvista 0: Dashboard
            ScrollView {
                contentWidth: availableWidth
                ColumnLayout {
                    width: parent.width
                    spacing: 16

                    Text { text: "Dashboard Operativo y Financiero"; font.bold: true; font.pixelSize: 18; color: "#0f172a" }

                    // Grid de KPIs
                    GridLayout {
                        columns: 3
                        Layout.fillWidth: true
                        rowSpacing: 12
                        columnSpacing: 12

                        Rectangle {
                            Layout.fillWidth: true; height: 90; radius: 10; color: "#ffffff"; border.color: "#e2e8f0"
                            Column {
                                anchors.centerIn: parent
                                Text { text: "VENTAS DEL PERÍODO"; font.pixelSize: 11; font.bold: true; color: "#64748b" }
                                Text { text: "$ 543.000 COP"; font.pixelSize: 20; font.bold: true; color: "#0f172a" }
                                Text { text: "3 facturas emitidas"; font.pixelSize: 11; color: "#059669" }
                            }
                        }

                        Rectangle {
                            Layout.fillWidth: true; height: 90; radius: 10; color: "#ffffff"; border.color: "#e2e8f0"
                            Column {
                                anchors.centerIn: parent
                                Text { text: "COSTO DE VENTAS (COGS REAL)"; font.pixelSize: 11; font.bold: true; color: "#64748b" }
                                Text { text: "$ 194.200 COP"; font.pixelSize: 20; font.bold: true; color: "#d97706" }
                                Text { text: "Basado en insumos reales"; font.pixelSize: 11; color: "#64748b" }
                            }
                        }

                        Rectangle {
                            Layout.fillWidth: true; height: 90; radius: 10; color: "#ecfdf5"; border.color: "#a7f3d0"
                            Column {
                                anchors.centerIn: parent
                                Text { text: "UTILIDAD NETA ESTIMADA"; font.pixelSize: 11; font.bold: true; color: "#065f46" }
                                Text { text: "$ 281.400 COP"; font.pixelSize: 20; font.bold: true; color: "#059669" }
                                Text { text: "Margen Neto: 51.8%"; font.pixelSize: 11; font.bold: true; color: "#065f46" }
                            }
                        }
                    }

                    Rectangle {
                        Layout.fillWidth: true; height: 200; radius: 12; color: "#ffffff"; border.color: "#e2e8f0"
                        ColumnLayout {
                            anchors.fill: parent
                            anchors.margins: 16
                            Text { text: "Estado de Operaciones Comerciales"; font.bold: true; font.pixelSize: 14 }
                            Text { text: "• Regla 1: Compras aumentan existencias de inventario automáticamente en transacción SQL."; font.pixelSize: 12 }
                            Text { text: "• Regla 2: Ventas descuentan existencias de bodega."; font.pixelSize: 12 }
                            Text { text: "• Regla 3: Validación para impedir ventas por encima del stock disponible."; font.pixelSize: 12 }
                            Text { text: "• Regla 4: Ventas a crédito actualizan saldo pendiente del cliente."; font.pixelSize: 12 }
                            Text { text: "• Regla 5: Abonos reducen saldo pendiente de créditos en tiempo real."; font.pixelSize: 12 }
                            Text { text: "• Regla 6: Producción consume materias primas y crea producto terminado."; font.pixelSize: 12 }
                        }
                    }
                }
            }

            // Subvista 1: Catálogo Productos
            Rectangle {
                color: "#ffffff"
                radius: 12
                border.color: "#e2e8f0"
                ColumnLayout {
                    anchors.fill: parent; anchors.margins: 16
                    Text { text: "Catálogo de Productos Terminados"; font.bold: true; font.pixelSize: 16 }
                    Text { text: "Artículos listos para venta al por mayor o al detal."; color: "#64748b"; font.pixelSize: 12 }
                    Item { Layout.fillHeight: true }
                }
            }

            // Subvista 2: Inventario
            Rectangle {
                color: "#ffffff"
                radius: 12
                border.color: "#e2e8f0"
                ColumnLayout {
                    anchors.fill: parent; anchors.margins: 16
                    Text { text: "Control de Inventario y Kardex"; font.bold: true; font.pixelSize: 16 }
                    Text { text: "Auditoría de entradas por compras, salidas por ventas y lotes de producción."; color: "#64748b"; font.pixelSize: 12 }
                    Item { Layout.fillHeight: true }
                }
            }

            // Subvista 3: Reportes
            Rectangle {
                color: "#ffffff"
                radius: 12
                border.color: "#e2e8f0"
                ColumnLayout {
                    anchors.fill: parent; anchors.margins: 16
                    Text { text: "Estado de Resultados y Ganancias"; font.bold: true; font.pixelSize: 16 }
                    Text { text: "Cálculo real de Utilidad Bruta y Neta separando finanzas personales de empresariales."; color: "#64748b"; font.pixelSize: 12 }
                    Item { Layout.fillHeight: true }
                }
            }
        }
    }
}
