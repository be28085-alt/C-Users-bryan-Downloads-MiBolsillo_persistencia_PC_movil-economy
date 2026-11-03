cmake_minimum_required(VERSION 3.16)
project(GestorFinanciero LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 REQUIRED COMPONENTS Core Gui Qml Quick Sql)

set(PROJECT_SOURCES
    src/main.cpp
    src/data/DatabaseManager.cpp
    src/services/PersonalFinanceService.cpp
    src/services/BusinessService.cpp
    include/data/DatabaseManager.h
    include/models/Negocio.h
    include/models/Producto.h
    include/models/Proveedor.h
    include/models/Cliente.h
    include/models/Compra.h
    include/models/Venta.h
    include/models/Empleado.h
    include/services/PersonalFinanceService.h
    include/services/BusinessService.h
)

qt_add_executable(GestorFinanciero ${PROJECT_SOURCES})

target_include_directories(GestorFinanciero PRIVATE
    include
    include/data
    include/models
    include/services
)

target_link_libraries(GestorFinanciero PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Qml
    Qt6::Quick
    Qt6::Sql
)

qt_add_qml_module(GestorFinanciero
    URI GestorFinanciero
    VERSION 1.0
    QML_FILES
        qml/main.qml
        qml/ProfileView.qml
        qml/BusinessModule.qml
)
