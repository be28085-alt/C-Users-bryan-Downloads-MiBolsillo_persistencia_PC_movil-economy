QT += core gui qml quick sql
CONFIG += c++17

TARGET = GestorFinanciero
TEMPLATE = app

INCLUDEPATH += include \
               include/data \
               include/models \
               include/services

HEADERS += \
    include/data/DatabaseManager.h \
    include/models/Negocio.h \
    include/models/Producto.h \
    include/models/Proveedor.h \
    include/models/Cliente.h \
    include/models/Compra.h \
    include/models/Venta.h \
    include/models/Empleado.h \
    include/services/PersonalFinanceService.h \
    include/services/BusinessService.h

SOURCES += \
    src/main.cpp \
    src/data/DatabaseManager.cpp \
    src/services/PersonalFinanceService.cpp \
    src/services/BusinessService.cpp

RESOURCES += \
    qml.qrc
