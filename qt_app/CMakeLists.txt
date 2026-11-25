cmake_minimum_required(VERSION 3.21)
project(GestorFinanciero VERSION 0.3.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
find_package(Qt6 6.5 REQUIRED COMPONENTS Core Gui Qml Quick QuickControls2)
qt_standard_project_setup(REQUIRES 6.5)

option(MIBOLSILLO_BUILD_NATIVE_PROTOTYPE "Build the independent reduced C++/QML prototype" OFF)
if(ANDROID)
    message(FATAL_ERROR "La aplicación HTML completa para Android está en ../android/ (Capacitor). El lanzador Qt de escritorio requiere Node.js y no es un APK Android. No se sustituye por el prototipo reducido.")
endif()

# This is a launcher for the original complete application, not a rewritten
# financial UI. It keeps its HTML/JS and its original SQLite database unchanged.
include("${CMAKE_CURRENT_SOURCE_DIR}/node-runtime.local.cmake" OPTIONAL)
find_program(MIBOLSILLO_NODE_EXECUTABLE NAMES node node.exe)
get_filename_component(MIBOLSILLO_SOURCE_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/.." ABSOLUTE)
add_library(mibolsillo_web_launcher STATIC src/WebAppLauncher.cpp include/WebAppLauncher.h)
target_include_directories(mibolsillo_web_launcher PUBLIC include)
target_link_libraries(mibolsillo_web_launcher PUBLIC Qt6::Core Qt6::Gui)
target_compile_definitions(mibolsillo_web_launcher PRIVATE MIBOLSILLO_SOURCE_ROOT="${MIBOLSILLO_SOURCE_ROOT}")
if(MIBOLSILLO_NODE_EXECUTABLE)
    target_compile_definitions(mibolsillo_web_launcher PRIVATE MIBOLSILLO_DEV_NODE="${MIBOLSILLO_NODE_EXECUTABLE}")
endif()
qt_add_executable(GestorFinanciero src/main.cpp)
qt_add_qml_module(GestorFinanciero URI MiBolsilloLauncher VERSION 1.0
    RESOURCE_PREFIX / NO_RESOURCE_TARGET_PATH QML_FILES qml/WebLauncher.qml)
target_link_libraries(GestorFinanciero PRIVATE mibolsillo_web_launcher
    Qt6::Qml Qt6::Quick Qt6::QuickControls2)
set_target_properties(GestorFinanciero PROPERTIES WIN32_EXECUTABLE TRUE)
if(MIBOLSILLO_NODE_EXECUTABLE AND EXISTS "${MIBOLSILLO_NODE_EXECUTABLE}")
    # Qt Creator can have a different PATH from the terminal. Keep the selected
    # runtime beside the application, where the launcher already looks for it.
    add_custom_command(TARGET GestorFinanciero POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_FILE_DIR:GestorFinanciero>/runtime"
        COMMAND ${CMAKE_COMMAND} -E copy_if_different "${MIBOLSILLO_NODE_EXECUTABLE}"
            "$<TARGET_FILE_DIR:GestorFinanciero>/runtime/node.exe")
endif()

include(CTest)
if(BUILD_TESTING)
    find_package(Qt6 REQUIRED COMPONENTS Test Network)
    qt_add_executable(launcher_tests tests/tst_launcher.cpp)
    set_target_properties(launcher_tests PROPERTIES WIN32_EXECUTABLE FALSE)
    target_link_libraries(launcher_tests PRIVATE mibolsillo_web_launcher Qt6::Test Qt6::Network)
    add_test(NAME html_launcher COMMAND launcher_tests)
endif()

# Preserve the earlier independent experiment for inspection only. It is not
# what the default Run target starts and never replaces the original HTML data.
if(MIBOLSILLO_BUILD_NATIVE_PROTOTYPE)
    find_package(Qt6 REQUIRED COMPONENTS Sql Network)
    add_library(mibolsillo_finance STATIC src/services/FinanceService.cpp include/services/FinanceService.h)
    target_include_directories(mibolsillo_finance PUBLIC include)
    target_link_libraries(mibolsillo_finance PUBLIC Qt6::Core Qt6::Sql Qt6::Network)
    set(prototype_qml qml/main.qml qml/AuthView.qml qml/FinanceView.qml qml/ProfileView.qml qml/BusinessModule.qml)
    qt_add_executable(MiBolsilloNativePrototype src/main.cpp)
    target_compile_definitions(MiBolsilloNativePrototype PRIVATE MIBOLSILLO_NATIVE_PROTOTYPE)
    qt_add_qml_module(MiBolsilloNativePrototype URI MiBolsilloNativePrototype VERSION 1.0
        RESOURCE_PREFIX / NO_RESOURCE_TARGET_PATH QML_FILES ${prototype_qml})
    target_link_libraries(MiBolsilloNativePrototype PRIVATE mibolsillo_finance Qt6::Gui Qt6::Qml Qt6::Quick Qt6::QuickControls2)
    set_target_properties(MiBolsilloNativePrototype PROPERTIES WIN32_EXECUTABLE TRUE)
    if(BUILD_TESTING)
        qt_add_executable(finance_tests tests/tst_finance.cpp)
        set_target_properties(finance_tests PROPERTIES WIN32_EXECUTABLE FALSE)
        target_link_libraries(finance_tests PRIVATE mibolsillo_finance Qt6::Test)
        add_test(NAME native_prototype_finance COMMAND finance_tests)
        qt_add_executable(ui_tests tests/tst_ui.cpp)
        set_target_properties(ui_tests PROPERTIES WIN32_EXECUTABLE FALSE)
        qt_add_resources(ui_tests ui_files PREFIX / FILES ${prototype_qml})
        target_link_libraries(ui_tests PRIVATE mibolsillo_finance Qt6::Test Qt6::Gui Qt6::Qml Qt6::Quick Qt6::QuickControls2)
        add_test(NAME native_prototype_ui COMMAND ui_tests)
        set_tests_properties(native_prototype_ui PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen;QT_QUICK_BACKEND=software")
    endif()
endif()
install(TARGETS GestorFinanciero RUNTIME DESTINATION bin BUNDLE DESTINATION .)
