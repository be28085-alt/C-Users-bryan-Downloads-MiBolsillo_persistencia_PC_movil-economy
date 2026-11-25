# Alternative qmake entry for the complete HTML application's desktop launcher.
QT += core gui qml quick quickcontrols2
CONFIG += c++17
TARGET = GestorFinanciero
TEMPLATE = app
INCLUDEPATH += include
HEADERS += include/WebAppLauncher.h
SOURCES += src/main.cpp src/WebAppLauncher.cpp
RESOURCES += web-launcher.qrc
# The executable discovers the original project through its parent folders.
# For a separate output folder set MIBOLSILLO_PROJECT_ROOT at run time.
android: error("Para la aplicación HTML completa de Android, abra ../android/ (Capacitor).")
