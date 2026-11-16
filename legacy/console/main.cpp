
#include <iostream>
#include <vector>
#include <string>
#include <iomanip>
#include <algorithm>
#include <sstream>
#include <cmath>
#include <cstdlib>

using namespace std;

// ============================================================================
// COLORES ANSI PARA LA CONSOLA (Mejora de interfaz visual académica)
// ============================================================================
#define RESET   "\033[0m"
#define BOLD    "\033[1m"
#define RED     "\033[31m"
#define GREEN   "\033[32m"
#define YELLOW  "\033[33m"
#define BLUE    "\033[34m"
#define MAGENTA "\033[35m"
#define CYAN    "\033[36m"
#define WHITE   "\033[37m"

// ============================================================================
// 1. ESTRUCTURAS DE DATOS (struct)
// ============================================================================

enum class TipoMovimiento {
    INGRESO,
    GASTO
};

enum class TipoGestion {
    PERSONAL,
    MINI_EMPRESARIAL
};

struct Movimiento {
    int id;
    TipoMovimiento tipo;
    string descripcion;
    double valor;       // Valor en pesos colombianos (COP)
    string categoria;   // Ej: Salario, Vivienda, Alimentación, etc.
    string fecha;       // Formato: AAAA-MM-DD
};

struct AporteAhorro {
    int id;
    double valor;
    string fecha;
    string nota;
};

struct MetaAhorro {
    string descripcion;
    double metaTotal;
    vector<AporteAhorro> aportes;
};

struct AbonoDeuda {
    int id;
    double valor;
    string fecha;
};

struct Deuda {
    int id;
    string nombre;
    double valorInicial;
    string fecha;
    string notas;
    vector<AbonoDeuda> abonos;
};

// ============================================================================
// 2. UTILIDADES DE FORMATEO Y ENTRADA DE DATOS
// ============================================================================

/**
 * Formatea un número double al estándar monetario de Pesos Colombianos (COP)
 * Ejemplo: 1500000 -> "$ 1.500.000 COP"
 */
string formatearCOP(double valor) {
    long long entero = static_cast<long long>(std::round(valor));
    bool negativo = entero < 0;
    if (negativo) entero = -entero;

    string s = to_string(entero);
    int n = s.length() - 3;
    while (n > 0) {
        s.insert(n, ".");
        n -= 3;
    }

    stringstream ss;
    if (negativo) ss << "-";
    ss << "$ " << s << " COP";
    return ss.str();
}

/**
 * Limpia el búfer de entrada estándar en caso de errores de lectura
 */
void limpiarBuffer() {
    cin.clear();
    if (!cin.eof()) cin.ignore(10000, '\n');
}

double leerMontoPositivo(const string& mensaje) {
    double valor;
    cout << mensaje;
    while (!(cin >> valor) || !isfinite(valor) || valor <= 0.0) {
        if (cin.eof()) {
            cout << "\nFin de entrada. Saliendo del programa.\n";
            exit(0);
        }
        cout << RED << "Valor inválido. Ingrese un número mayor que cero: " << RESET;
        cin.clear();
        cin.ignore(10000, '\n');
    }
    cin.ignore(10000, '\n');
    return valor;
}

int siguienteIdMovimiento(const vector<Movimiento>& datos) {
    int mayor = 0;
    for (const auto& dato : datos) if (dato.id > mayor) mayor = dato.id;
    return mayor + 1;
}
int siguienteIdDeuda(const vector<Deuda>& datos) {
    int mayor = 0;
    for (const auto& dato : datos) if (dato.id > mayor) mayor = dato.id;
    return mayor + 1;
}
int siguienteIdAporte(const vector<AporteAhorro>& datos) {
    int mayor = 0;
    for (const auto& dato : datos) if (dato.id > mayor) mayor = dato.id;
    return mayor + 1;
}
int siguienteIdAbono(const vector<AbonoDeuda>& datos) {
    int mayor = 0;
    for (const auto& dato : datos) if (dato.id > mayor) mayor = dato.id;
    return mayor + 1;
}

void pausarConsola() {
    if (cin.eof()) return;
    cout << "\nPresione " << BOLD << "[ENTER]" << RESET << " para continuar...";
    cin.get();
}

void mostrarPerfilGestion(TipoGestion& modoGestion) {
    cout << "\n" << BOLD << CYAN << "================ PERFIL DE GESTIÓN ================" << RESET << "\n";
    cout << "Seleccione el tipo de gestión financiera:\n";
    cout << " 1. Gestión Financiera Personal\n";
    cout << " 2. Gestión Financiera Mini Empresarial\n";
    cout << "Opción [1-2]: ";

    int opcionPerfil;
    if (!(cin >> opcionPerfil)) {
        if (cin.eof()) {
            limpiarBuffer();
            return;
        }
        opcionPerfil = 1;
    }
    limpiarBuffer();

    if (opcionPerfil == 2) {
        modoGestion = TipoGestion::MINI_EMPRESARIAL;
        cout << GREEN << "✔️ Perfil actualizado: Gestión Financiera Mini Empresarial.\n" << RESET;
    } else {
        modoGestion = TipoGestion::PERSONAL;
        cout << GREEN << "✔️ Perfil actualizado: Gestión Financiera Personal.\n" << RESET;
    }
}

// ============================================================================
// 3. FÓRMULAS MATEMÁTICAS OBLIGATORIAS (Requisito 3)
// ============================================================================

/**
 * FÓRMULA 1: Ingresos Totales
 * Suma de todos los valores de movimientos de tipo INGRESO.
 */
double calcularIngresosTotales(const vector<Movimiento>& movimientos) {
    double total = 0.0;
    // Ciclo for-each para recorrer el arreglo de movimientos
    for (const auto& mov : movimientos) {
        if (mov.tipo == TipoMovimiento::INGRESO) {
            total += mov.valor;
        }
    }
    return total;
}

/**
 * FÓRMULA 2: Gastos Totales
 * Suma de todos los valores de movimientos de tipo GASTO.
 */
double calcularGastosTotales(const vector<Movimiento>& movimientos) {
    double total = 0.0;
    for (const auto& mov : movimientos) {
        if (mov.tipo == TipoMovimiento::GASTO) {
            total += mov.valor;
        }
    }
    return total;
}

/**
 * FÓRMULA 3: Dinero Disponible
 * Dinero disponible = Ingresos totales - Gastos totales
 * Concepto: Representa el remanente de liquidez libre de la persona.
 */
double calcularDineroDisponible(double totalIngresos, double totalGastos) {
    return totalIngresos - totalGastos;
}

double calcularUtilidadNeta(double ingresos, double gastos) {
    return ingresos - gastos;
}

double calcularMargenUtilidad(double utilidad, double ingresos) {
    if (ingresos <= 0.0) {
        return 0.0;
    }
    return (utilidad / ingresos) * 100.0;
}

/**
 * FÓRMULA 4: Ahorro Acumulado
 * Suma de todos los aportes registrados en la meta de ahorro.
 */
double calcularAhorroAcumulado(const MetaAhorro& meta) {
    double total = 0.0;
    for (const auto& aporte : meta.aportes) {
        total += aporte.valor;
    }
    return total;
}

/**
 * FÓRMULA 5: Porcentaje de Ahorro
 * Porcentaje de ahorro = (Ahorro acumulado / Ingresos totales) * 100
 * Condición proposicional: Solo si Ingresos totales > 0.
 */
double calcularPorcentajeAhorro(double ahorro, double ingresosTotales) {
    if (ingresosTotales <= 0.0) {
        return 0.0; // Manejo de caso borde: evita indeterminación o división por cero
    }
    return (ahorro / ingresosTotales) * 100.0;
}

/**
 * FÓRMULA 6: Saldo Pendiente de una Deuda
 * Saldo pendiente = Valor inicial - Suma de abonos realizados
 */
double calcularSaldoDeuda(const Deuda& deuda) {
    double sumaAbonos = 0.0;
    for (const auto& abono : deuda.abonos) {
        sumaAbonos += abono.valor;
    }
    double saldo = deuda.valorInicial - sumaAbonos;
    return (saldo > 0.0) ? saldo : 0.0;
}

/**
 * Suma de todos los saldos pendientes de la colección de deudas.
 */
double calcularTotalDeudasPendientes(const vector<Deuda>& deudas) {
    double acumulador = 0.0;
    for (const auto& d : deudas) {
        acumulador += calcularSaldoDeuda(d);
    }
    return acumulador;
}

/**
 * FÓRMULA 7: Avance de la Meta de Ahorro
 * Porcentaje de avance = (Ahorro acumulado / Meta de ahorro) * 100
 * Condición obligatoria: Meta > 0 y tope máximo acotado al 100%.
 */
double calcularAvanceMeta(double ahorroAcumulado, double metaTotal) {
    if (metaTotal <= 0.0) {
        return 0.0;
    }
    double avance = (ahorroAcumulado / metaTotal) * 100.0;
    if (avance > 100.0) {
        avance = 100.0; // Acotamiento al 100% estricto
    }
    return avance;
}

double calcularFaltanteMeta(double ahorroAcumulado, double metaTotal) {
    double faltante = metaTotal - ahorroAcumulado;
    return (faltante > 0.0) ? faltante : 0.0;
}

// ============================================================================
// 4. LÓGICA PROPOSICIONAL Y DIAGNÓSTICO FINANCIERO (Requisitos 4 y 7)
// ============================================================================

/**
 * Evalúa el estado financiero utilizando proposiciones lógicas compuestas.
 */
void evaluarSaludFinanciera(double ingresos, double gastos, double disponible,
                            double ahorro, double presupuesto, double deudasPendientes) {
    cout << "\n" << BOLD << CYAN << "================== RESUMEN Y DIAGNÓSTICO FINANCIERO ==================" << RESET << "\n";

    // Proposiciones lógicas elementales:
    bool pDeficit = (gastos > ingresos);
    bool pPresupuestoExcedido = (presupuesto > 0.0 && gastos > presupuesto);
    bool pBuenaTasaAhorro = (ingresos > 0.0 && ((ahorro / ingresos) * 100.0) >= 10.0);
    bool pAltoEndeudamiento = (ingresos > 0.0 && deudasPendientes > (ingresos * 3.0));

    // Evaluación mediante lógica proposicional y condicionales
    if (ingresos == 0.0 && gastos == 0.0) {
        cout << YELLOW << "ℹ️  Sin movimientos registrados aún en el sistema." << RESET << "\n";
        return;
    }

    if (pDeficit || pPresupuestoExcedido) {
        cout << BOLD << RED << "❌ ESTADO FINANCIERO: CRÍTICO (Déficit / Sobrepaso de Gastos)" << RESET << "\n";
        if (pDeficit) {
            cout << RED << "   • [Lógica: Gastos > Ingresos] Déficit de: " << formatearCOP(gastos - ingresos) << RESET << "\n";
        }
        if (pPresupuestoExcedido) {
            cout << RED << "   • [Lógica: Gastos > Presupuesto] Exceso presupuestal de: "
                 << formatearCOP(gastos - presupuesto) << RESET << "\n";
        }
    } else if (pAltoEndeudamiento) {
        cout << BOLD << YELLOW << "⚠️  ESTADO FINANCIERO: PRECAUCIÓN (Alto Endeudamiento)" << RESET << "\n";
        cout << YELLOW << "   • Sus deudas pendientes (" << formatearCOP(deudasPendientes)
             << ") superan 3 meses de ingresos brutos." << RESET << "\n";
    } else {
        cout << BOLD << GREEN << "✅ ESTADO FINANCIERO: SALUDABLE (Superávit y Control Presupuestal)" << RESET << "\n";
        cout << GREEN << "   • Mantiene liquidez positiva de: " << formatearCOP(disponible) << RESET << "\n";
    }

    if (pBuenaTasaAhorro) {
        cout << GREEN << "   • Cumple con la recomendación de ahorro (>= 10% de sus ingresos)." << RESET << "\n";
    } else if (ingresos > 0.0) {
        cout << YELLOW << "   • Sugerencia: Incremente sus aportes al ahorro para alcanzar al menos el 10%." << RESET << "\n";
    }
    cout << CYAN << "----------------------------------------------------------------------" << RESET << "\n";
}

// ============================================================================
// 5. MÓDULOS DE GESTIÓN Y OPERACIONES DEL SISTEMA
// ============================================================================

/**
 * Carga de datos de prueba colombianos (COP) para agilizar demostraciones
 */
void cargarDatosDemo(vector<Movimiento>& movimientos, MetaAhorro& meta, vector<Deuda>& deudas, double& presupuesto) {
    movimientos.clear();
    deudas.clear();
    meta.aportes.clear();

    // Ingresos de prueba
    movimientos.push_back({1, TipoMovimiento::INGRESO, "Salario Nómina Mensual", 2800000.0, "Salario", "2026-10-01"});
    movimientos.push_back({2, TipoMovimiento::INGRESO, "Desarrollo Software Freelance", 650000.0, "Trabajos independientes", "2026-10-08"});
    movimientos.push_back({3, TipoMovimiento::INGRESO, "Venta accesorio tecnológico", 200000.0, "Ventas", "2026-10-12"});

    // Gastos de prueba
    movimientos.push_back({4, TipoMovimiento::GASTO, "Pago Arriendo Vivienda", 900000.0, "Vivienda", "2026-10-02"});
    movimientos.push_back({5, TipoMovimiento::GASTO, "Mercado de Alimentos Mensual", 450000.0, "Alimentación", "2026-10-04"});
    movimientos.push_back({6, TipoMovimiento::GASTO, "Transporte Público Masivo", 140000.0, "Transporte", "2026-10-05"});
    movimientos.push_back({7, TipoMovimiento::GASTO, "Servicio de Internet Fibra", 95000.0, "Vivienda", "2026-10-06"});
    movimientos.push_back({8, TipoMovimiento::GASTO, "Salida Recreativa Fin de Semana", 85000.0, "Entretenimiento", "2026-10-10"});
    movimientos.push_back({9, TipoMovimiento::GASTO, "Materiales de Estudio e Ingeniería", 60000.0, "Educación", "2026-10-11"});

    // Meta de ahorro de prueba
    meta.descripcion = "Computador Portátil para la Universidad";
    meta.metaTotal = 3500000.0;
    meta.aportes.push_back({1, 500000.0, "2026-10-03", "Ahorro primera quincena"});
    meta.aportes.push_back({2, 300000.0, "2026-10-10", "Abono freelance"});

    // Deudas de prueba
    Deuda d1;
    d1.id = 1;
    d1.nombre = "Tarjeta de Credito Bancolombia";
    d1.valorInicial = 800000.0;
    d1.fecha = "2026-09-15";
    d1.notas = "Plazo a 3 cuotas";
    d1.abonos.push_back({1, 250000.0, "2026-10-05"});
    deudas.push_back(d1);

    Deuda d2;
    d2.id = 2;
    d2.nombre = "Prestamo Familiar (Tia Martha)";
    d2.valorInicial = 500000.0;
    d2.fecha = "2026-09-20";
    d2.notas = "Sin intereses bancarios";
    d2.abonos.push_back({1, 100000.0, "2026-10-07"});
    deudas.push_back(d2);

    presupuesto = 2100000.0;
}

/**
 * MÓDULO A: Panel Principal o Dashboard
 */
void mostrarDashboard(const vector<Movimiento>& movimientos, const MetaAhorro& meta,
                      const vector<Deuda>& deudas, double presupuesto, TipoGestion modoGestion) {
    double totalIngresos = calcularIngresosTotales(movimientos);
    double totalGastos = calcularGastosTotales(movimientos);
    double disponible = calcularDineroDisponible(totalIngresos, totalGastos);
    double ahorro = calcularAhorroAcumulado(meta);
    double porcAhorro = calcularPorcentajeAhorro(ahorro, totalIngresos);
    double totalDeudas = calcularTotalDeudasPendientes(deudas);
    double utilidad = calcularUtilidadNeta(totalIngresos, totalGastos);
    double margen = calcularMargenUtilidad(utilidad, totalIngresos);

    cout << "\n" << BOLD << BLUE << "=======================================================================" << RESET << "\n";
    cout << BOLD << BLUE << (modoGestion == TipoGestion::PERSONAL
        ? "            PANEL PRINCIPAL / DASHBOARD FINANCIERO PERSONAL         "
        : "       PANEL PRINCIPAL / DASHBOARD FINANCIERO MINI EMPRESARIAL     ") << RESET << "\n";
    cout << BOLD << BLUE << "=======================================================================" << RESET << "\n";

    cout << left << setw(35) << " [1] Total Ingresos Registrados:" << GREEN << BOLD << formatearCOP(totalIngresos) << RESET << "\n";
    cout << left << setw(35) << " [2] Total Gastos Registrados:"   << RED   << BOLD << formatearCOP(totalGastos) << RESET << "\n";

    if (modoGestion == TipoGestion::PERSONAL) {
        cout << left << setw(35) << " [3] Dinero Disponible (Caja):";
        if (disponible >= 0) {
            cout << GREEN << BOLD << formatearCOP(disponible) << RESET << "\n";
        } else {
            cout << RED << BOLD << formatearCOP(disponible) << " (DÉFICIT)" << RESET << "\n";
        }
    } else {
        cout << left << setw(35) << " [3] Utilidad Neta:";
        if (utilidad >= 0) {
            cout << GREEN << BOLD << formatearCOP(utilidad) << RESET << "\n";
        } else {
            cout << RED << BOLD << formatearCOP(utilidad) << " (PÉRDIDA)" << RESET << "\n";
        }
    }

    cout << left << setw(35) << " [4] Ahorro Acumulado:"          << YELLOW << BOLD << formatearCOP(ahorro) << RESET 
         << " (" << fixed << setprecision(1) << porcAhorro << "% de ingresos)\n";

    cout << left << setw(35) << " [5] Total Deudas Pendientes:"    << MAGENTA << BOLD << formatearCOP(totalDeudas) << RESET << "\n";

    if (modoGestion == TipoGestion::MINI_EMPRESARIAL) {
        cout << left << setw(35) << " [6] Margen de Utilidad:" << CYAN << BOLD << fixed << setprecision(1) << margen << "%" << RESET << "\n";
        if (presupuesto > 0.0) {
            cout << left << setw(35) << " [7] Límite de Gastos:" << CYAN << BOLD << formatearCOP(presupuesto) << RESET;
            double pctPresupuesto = (totalGastos / presupuesto) * 100.0;
            cout << " (Gastado: " << fixed << setprecision(1) << pctPresupuesto << "%)\n";
        }
    } else if (presupuesto > 0.0) {
        cout << left << setw(35) << " [6] Límite de Gastos:"     << CYAN << BOLD << formatearCOP(presupuesto) << RESET;
        double pctPresupuesto = (totalGastos / presupuesto) * 100.0;
        cout << " (Gastado: " << fixed << setprecision(1) << pctPresupuesto << "%)\n";
    }

    cout << "\n" << YELLOW << "💡 NOTA CONCEPTUAL:" << RESET << "\n";
    cout << "   El dinero disponible personal y la utilidad neta empresarial representan\n";
    cout << "   la diferencia entre ingresos y gastos, pero con un enfoque distinto según el perfil.\n";

    cout << "\n" << BOLD << "📊 Representación Gráfica (Ingresos vs Gastos):" << RESET << "\n";
    double maxValor = max({totalIngresos, totalGastos, 1.0});
    int barIngresos = static_cast<int>((totalIngresos / maxValor) * 35);
    int barGastos   = static_cast<int>((totalGastos / maxValor) * 35);

    cout << "Ingresos: [" << GREEN << string(barIngresos, '#') << string(35 - barIngresos, ' ') << RESET << "] " << formatearCOP(totalIngresos) << "\n";
    cout << "Gastos:   [" << RED   << string(barGastos, '#')   << string(35 - barGastos, ' ')   << RESET << "] " << formatearCOP(totalGastos) << "\n";

    if (modoGestion == TipoGestion::PERSONAL) {
        evaluarSaludFinanciera(totalIngresos, totalGastos, disponible, ahorro, presupuesto, totalDeudas);
    } else {
        cout << "\n" << BOLD << CYAN << "=== DIAGNÓSTICO EMPRESARIAL ===" << RESET << "\n";
        cout << CYAN << "• Utilidad neta actual: " << formatearCOP(utilidad) << "\n";
        cout << "• Margen de utilidad: " << fixed << setprecision(1) << margen << "%\n" << RESET;
        if (utilidad >= 0.0) {
            cout << GREEN << "✅ La operación está generando rentabilidad positiva.\n" << RESET;
        } else {
            cout << RED << "⚠️ La operación presenta pérdidas; se recomienda revisar costos y gastos operativos.\n" << RESET;
        }
    }
}

/**
 * MÓDULO B: Registro de Ingresos
 */
void registrarIngreso(vector<Movimiento>& movimientos) {
    cout << "\n" << BOLD << GREEN << "--- REGISTRO DE NUEVO INGRESO (COP) ---" << RESET << "\n";
    Movimiento nuevo;
    nuevo.id = siguienteIdMovimiento(movimientos);
    nuevo.tipo = TipoMovimiento::INGRESO;

    cout << "Descripción del ingreso: ";
    getline(cin, nuevo.descripcion);

    nuevo.valor = leerMontoPositivo("Valor en Pesos Colombianos (COP): ");

    cout << "\nSeleccione la categoría de ingreso:\n";
    cout << " 1. Salario / Sueldo\n";
    cout << " 2. Ventas comerciales\n";
    cout << " 3. Trabajos independientes (Freelance)\n";
    cout << " 4. Inversiones / Rendimientos\n";
    cout << " 5. Otros ingresos\n";
    cout << "Opción [1-5]: ";
    int catOpc;
    if (!(cin >> catOpc)) {
        if (cin.eof()) { limpiarBuffer(); return; }
        catOpc = 5;
    }
    limpiarBuffer();

    switch (catOpc) {
        case 1: nuevo.categoria = "Salario"; break;
        case 2: nuevo.categoria = "Ventas"; break;
        case 3: nuevo.categoria = "Trabajos independientes"; break;
        case 4: nuevo.categoria = "Inversiones"; break;
        default: nuevo.categoria = "Otros ingresos"; break;
    }

    cout << "Fecha del ingreso (AAAA-MM-DD) [Ej: 2026-10-16]: ";
    getline(cin, nuevo.fecha);
    if (nuevo.fecha.empty()) nuevo.fecha = "2026-10-16";

    movimientos.push_back(nuevo);
    cout << GREEN << BOLD << "✔️ Ingreso registrado con éxito por " << formatearCOP(nuevo.valor) << RESET << "\n";
}

/**
 * MÓDULO C: Registro de Gastos
 */
void registrarGasto(vector<Movimiento>& movimientos) {
    cout << "\n" << BOLD << RED << "--- REGISTRO DE NUEVO GASTO (COP) ---" << RESET << "\n";
    Movimiento nuevo;
    nuevo.id = siguienteIdMovimiento(movimientos);
    nuevo.tipo = TipoMovimiento::GASTO;

    cout << "Descripción del gasto: ";
    getline(cin, nuevo.descripcion);

    nuevo.valor = leerMontoPositivo("Valor en Pesos Colombianos (COP): ");

    cout << "\nSeleccione la categoría del gasto:\n";
    cout << " 1. Alimentación y Mercado\n";
    cout << " 2. Transporte y Movilidad\n";
    cout << " 3. Educación y Materiales\n";
    cout << " 4. Vivienda y Servicios\n";
    cout << " 5. Entretenimiento y Salidas\n";
    cout << " 6. Salud y Medicamentos\n";
    cout << " 7. Otros gastos\n";
    cout << "Opción [1-7]: ";
    int catOpc;
    if (!(cin >> catOpc)) {
        if (cin.eof()) { limpiarBuffer(); return; }
        catOpc = 7;
    }
    limpiarBuffer();

    switch (catOpc) {
        case 1: nuevo.categoria = "Alimentación"; break;
        case 2: nuevo.categoria = "Transporte"; break;
        case 3: nuevo.categoria = "Educación"; break;
        case 4: nuevo.categoria = "Vivienda"; break;
        case 5: nuevo.categoria = "Entretenimiento"; break;
        case 6: nuevo.categoria = "Salud"; break;
        default: nuevo.categoria = "Otros gastos"; break;
    }

    cout << "Fecha del gasto (AAAA-MM-DD) [Ej: 2026-10-16]: ";
    getline(cin, nuevo.fecha);
    if (nuevo.fecha.empty()) nuevo.fecha = "2026-10-16";

    movimientos.push_back(nuevo);
    cout << RED << BOLD << "✔️ Gasto registrado con éxito por " << formatearCOP(nuevo.valor) << RESET << "\n";
}

/**
 * MÓDULO F: Historial de Movimientos y Filtros
 */
void mostrarHistorial(vector<Movimiento>& movimientos) {
    if (movimientos.empty()) {
        cout << YELLOW << "\nNo existen movimientos registrados en el sistema.\n" << RESET;
        return;
    }

    cout << "\n" << BOLD << CYAN << "================ HISTORIAL DE MOVIMIENTOS ================" << RESET << "\n";
    cout << "Seleccione el filtro deseado:\n";
    cout << " 1. Ver TODOS los movimientos\n";
    cout << " 2. Filtrar únicamente INGRESOS\n";
    cout << " 3. Filtrar únicamente GASTOS\n";
    cout << " 4. Filtrar por CATEGORÍA específica\n";
    cout << "Opción [1-4]: ";
    int opcFiltro;
    if (!(cin >> opcFiltro)) {
        if (cin.eof()) { limpiarBuffer(); return; }
        opcFiltro = 1;
    }
    limpiarBuffer();

    string categoriaBuscar = "";
    if (opcFiltro == 4) {
        cout << "Ingrese el nombre de la categoría a filtrar: ";
        getline(cin, categoriaBuscar);
    }

    cout << "\n" << string(75, '-') << "\n";
    cout << left << setw(4)  << "ID" 
         << setw(10) << "TIPO" 
         << setw(12) << "FECHA" 
         << setw(24) << "DESCRIPCIÓN" 
         << setw(14) << "CATEGORÍA" 
         << right << setw(18) << "MONTO (COP)" << "\n";
    cout << string(75, '-') << "\n";

    double subtotal = 0.0;
    int contador = 0;

    for (const auto& m : movimientos) {
        bool incluir = false;
        if (opcFiltro == 1) incluir = true;
        else if (opcFiltro == 2 && m.tipo == TipoMovimiento::INGRESO) incluir = true;
        else if (opcFiltro == 3 && m.tipo == TipoMovimiento::GASTO) incluir = true;
        else if (opcFiltro == 4 && m.categoria.find(categoriaBuscar) != string::npos) incluir = true;

        if (incluir) {
            contador++;
            bool esIngreso = (m.tipo == TipoMovimiento::INGRESO);
            cout << left << setw(4) << m.id;
            if (esIngreso) {
                cout << GREEN << setw(10) << "INGRESO" << RESET;
            } else {
                cout << RED << setw(10) << "GASTO" << RESET;
            }
            cout << setw(12) << m.fecha
                 << setw(24) << (m.descripcion.length() > 22 ? m.descripcion.substr(0, 20) + ".." : m.descripcion)
                 << setw(14) << (m.categoria.length() > 12 ? m.categoria.substr(0, 11) + ".." : m.categoria);
            
            if (esIngreso) {
                cout << GREEN << right << setw(18) << ("+ " + formatearCOP(m.valor)) << RESET << "\n";
                subtotal += m.valor;
            } else {
                cout << RED << right << setw(18) << ("- " + formatearCOP(m.valor)) << RESET << "\n";
                subtotal -= m.valor;
            }
        }
    }
    cout << string(75, '-') << "\n";
    cout << "Total registros visualizados: " << contador << " | Balance del filtro: " 
         << (subtotal >= 0 ? GREEN : RED) << formatearCOP(subtotal) << RESET << "\n";

    // Opción para eliminar registro
    cout << "\n¿Desea eliminar algún registro? (1 = Sí, 0 = No): ";
    int eliminarOpc;
    if (!(cin >> eliminarOpc)) {
        if (cin.eof()) { limpiarBuffer(); return; }
        eliminarOpc = 0;
    }
    limpiarBuffer();

    if (eliminarOpc == 1) {
        cout << "Ingrese el ID del movimiento a eliminar: ";
        int idEliminar;
        if (!(cin >> idEliminar)) {
            if (cin.eof()) { limpiarBuffer(); return; }
            limpiarBuffer();
            cout << RED << "❌ Entrada inválida.\n" << RESET;
            return;
        }
        limpiarBuffer();

        auto it = find_if(movimientos.begin(), movimientos.end(), [idEliminar](const Movimiento& m) {
            return m.id == idEliminar;
        });

        if (it != movimientos.end()) {
            movimientos.erase(it);
            cout << GREEN << "✔️ Movimiento #" << idEliminar << " eliminado correctamente.\n" << RESET;
        } else {
            cout << RED << "❌ No se encontró ningún movimiento con ID #" << idEliminar << ".\n" << RESET;
        }
    }
}

/**
 * MÓDULO D: Gestión de Ahorro
 */
void gestionarAhorro(MetaAhorro& meta, double ingresosTotales) {
    cout << "\n" << BOLD << YELLOW << "================ GESTIÓN DEL AHORRO ================" << RESET << "\n";
    double ahorroActual = calcularAhorroAcumulado(meta);
    double faltante = calcularFaltanteMeta(ahorroActual, meta.metaTotal);
    double avance = calcularAvanceMeta(ahorroActual, meta.metaTotal);
    double porcAhorroIngresos = calcularPorcentajeAhorro(ahorroActual, ingresosTotales);

    cout << "Meta actual: " << BOLD << (meta.descripcion.empty() ? "Sin meta definida" : meta.descripcion) << RESET << "\n";
    cout << "Monto objetivo: " << formatearCOP(meta.metaTotal) << "\n";
    cout << "Ahorro acumulado: " << GREEN << BOLD << formatearCOP(ahorroActual) << RESET << "\n";
    cout << "Falta para la meta: " << YELLOW << formatearCOP(faltante) << RESET << "\n";
    cout << "Porcentaje de avance: " << BOLD << fixed << setprecision(1) << avance << "%" << RESET << "\n";
    cout << "Tasa sobre ingresos:  " << fixed << setprecision(1) << porcAhorroIngresos << "% del ingreso total\n";

    // Barra de progreso visual en consola
    int barLen = static_cast<int>((avance / 100.0) * 30);
    cout << "Progreso: [" << GREEN << string(barLen, '=') << string(30 - barLen, '.') << RESET << "] " 
         << avance << "%\n";

    if (avance >= 100.0) {
        cout << GREEN << BOLD << "🎉 ¡Felicitaciones! Ha alcanzado el 100% de su meta de ahorro.\n" << RESET;
    }

    cout << "\nOpciones de Ahorro:\n";
    cout << " 1. Definir o modificar la meta de ahorro\n";
    cout << " 2. Registrar un nuevo aporte al ahorro\n";
    cout << " 3. Ver historial de aportes\n";
    cout << " 0. Volver al menú principal\n";
    cout << "Opción [0-3]: ";
    int opc;
    if (!(cin >> opc)) {
        if (cin.eof()) { limpiarBuffer(); return; }
        opc = 0;
    }
    limpiarBuffer();

    if (opc == 1) {
        cout << "Nombre u objetivo de la meta: ";
        getline(cin, meta.descripcion);
        meta.metaTotal = leerMontoPositivo("Monto objetivo en COP: ");
        cout << GREEN << "✔️ Meta de ahorro establecida con éxito.\n" << RESET;
    } else if (opc == 2) {
        AporteAhorro nuevoAporte;
        nuevoAporte.id = siguienteIdAporte(meta.aportes);
        nuevoAporte.valor = leerMontoPositivo("Valor del aporte en COP: ");
        cout << "Fecha del aporte (AAAA-MM-DD): ";
        getline(cin, nuevoAporte.fecha);
        cout << "Nota u origen del aporte (Ej: Sobrante quincena): ";
        getline(cin, nuevoAporte.nota);

        meta.aportes.push_back(nuevoAporte);
        cout << GREEN << "✔️ Aporte guardado exitosamente.\n" << RESET;
    } else if (opc == 3) {
        cout << "\n--- HISTORIAL DE APORTES ---\n";
        for (const auto& ap : meta.aportes) {
            cout << "• " << ap.fecha << " | " << setw(20) << ap.nota << " | " << GREEN << formatearCOP(ap.valor) << RESET << "\n";
        }
    }
}

/**
 * MÓDULO E: Gestión de Deudas
 */
void gestionarDeudas(vector<Deuda>& deudas) {
    cout << "\n" << BOLD << MAGENTA << "================ GESTIÓN DE DEUDAS ================" << RESET << "\n";
    double totalPendiente = calcularTotalDeudasPendientes(deudas);
    cout << "Total deudas pendientes activas: " << RED << BOLD << formatearCOP(totalPendiente) << RESET << "\n\n";

    if (deudas.empty()) {
        cout << "No hay deudas registradas en el sistema.\n";
    } else {
        cout << left << setw(4) << "ID" 
             << setw(26) << "ENTIDAD / DESCRIPCIÓN" 
             << setw(18) << "VALOR INICIAL" 
             << right << setw(18) << "SALDO PENDIENTE" << "\n";
        cout << string(68, '-') << "\n";

        for (const auto& d : deudas) {
            double saldo = calcularSaldoDeuda(d);
            cout << left << setw(4) << d.id
                 << setw(26) << (d.nombre.length() > 24 ? d.nombre.substr(0, 22) + ".." : d.nombre)
                 << setw(18) << formatearCOP(d.valorInicial)
                 << right << setw(18) << (saldo == 0 ? GREEN + string("PAGADA") + RESET : RED + formatearCOP(saldo) + RESET) << "\n";
        }
    }

    cout << "\nOpciones de Deudas:\n";
    cout << " 1. Registrar una nueva deuda u obligación\n";
    cout << " 2. Realizar un abono a una deuda existente\n";
    cout << " 3. Eliminar una deuda\n";
    cout << " 0. Volver al menú principal\n";
    cout << "Opción [0-3]: ";
    int opc;
    if (!(cin >> opc)) {
        if (cin.eof()) { limpiarBuffer(); return; }
        opc = 0;
    }
    limpiarBuffer();

    if (opc == 1) {
        Deuda nueva;
        nueva.id = siguienteIdDeuda(deudas);
        cout << "Nombre de la deuda o acreedor: ";
        getline(cin, nueva.nombre);
        nueva.valorInicial = leerMontoPositivo("Valor inicial total (COP): ");
        cout << "Fecha de adquisición (AAAA-MM-DD): ";
        getline(cin, nueva.fecha);
        cout << "Notas o plazo (opcional): ";
        getline(cin, nueva.notas);

        deudas.push_back(nueva);
        cout << GREEN << "✔️ Deuda registrada exitosamente.\n" << RESET;
    } else if (opc == 2) {
        cout << "Ingrese el ID de la deuda a abonar: ";
        int idDeuda;
        if (!(cin >> idDeuda)) {
            if (cin.eof()) { limpiarBuffer(); return; }
            limpiarBuffer();
            cout << RED << "❌ Entrada inválida.\n" << RESET;
            return;
        }
        limpiarBuffer();

        auto it = find_if(deudas.begin(), deudas.end(), [idDeuda](const Deuda& d) {
            return d.id == idDeuda;
        });

        if (it != deudas.end()) {
            double saldoActual = calcularSaldoDeuda(*it);
            cout << "Deuda: " << it->nombre << " | Saldo actual: " << formatearCOP(saldoActual) << "\n";
            if (saldoActual <= 0.0) {
                cout << GREEN << "Esta deuda ya se encuentra completamente pagada.\n" << RESET;
            } else {
                AbonoDeuda nuevoAbono;
                nuevoAbono.id = siguienteIdAbono(it->abonos);
                nuevoAbono.valor = leerMontoPositivo("Monto del abono (COP): ");
                cout << "Fecha del abono (AAAA-MM-DD): ";
                getline(cin, nuevoAbono.fecha);

                if (nuevoAbono.valor > saldoActual) {
                    cout << YELLOW << "⚠️ El abono supera el saldo pendiente. Se ajustará al saldo restante.\n" << RESET;
                    nuevoAbono.valor = saldoActual;
                }

                it->abonos.push_back(nuevoAbono);
                cout << GREEN << "✔️ Abono registrado con éxito. Nuevo saldo: " 
                     << formatearCOP(calcularSaldoDeuda(*it)) << RESET << "\n";
            }
        } else {
            cout << RED << "❌ Deuda con ID no encontrada.\n" << RESET;
        }
    } else if (opc == 3) {
        cout << "Ingrese el ID de la deuda a eliminar: ";
        int idEliminar;
        if (!(cin >> idEliminar)) {
            if (cin.eof()) { limpiarBuffer(); return; }
            limpiarBuffer();
            cout << RED << "❌ Entrada inválida.\n" << RESET;
            return;
        }
        limpiarBuffer();

        auto it = find_if(deudas.begin(), deudas.end(), [idEliminar](const Deuda& d) {
            return d.id == idEliminar;
        });

        if (it != deudas.end()) {
            deudas.erase(it);
            cout << GREEN << "✔️ Deuda eliminada correctamente.\n" << RESET;
        } else {
            cout << RED << "❌ Deuda no encontrada.\n" << RESET;
        }
    }
}

/**
 * MÓDULO G: Presupuesto y Alertas
 */
void gestionarPresupuesto(double& presupuesto, double gastosTotales, double ingresosTotales) {
    cout << "\n" << BOLD << CYAN << "================ LÍMITE DE GASTOS Y ALERTAS ================" << RESET << "\n";
    cout << "Límite de gastos configurado: " << formatearCOP(presupuesto) << "\n";
    cout << "Gastos registrados acumulados:    " << RED << formatearCOP(gastosTotales) << RESET << "\n";

    if (presupuesto > 0.0) {
        double porcConsumo = (gastosTotales / presupuesto) * 100.0;
        cout << "Porcentaje consumido:           " << fixed << setprecision(1) << porcConsumo << "%\n";

        if (gastosTotales > presupuesto) {
            cout << BOLD << RED << "🚨 ¡ALERTA! Ha superado el límite de gasto por: "
                 << formatearCOP(gastosTotales - presupuesto) << RESET << "\n";
        } else if (gastosTotales == presupuesto) {
            cout << BOLD << YELLOW << "⚠️ Ha llegado exactamente al límite de gasto. No queda presupuesto disponible.\n" << RESET;
        } else if (porcConsumo >= 80.0) {
            cout << BOLD << YELLOW << "⚠️ PRECAUCIÓN: Ha consumido el " << porcConsumo 
                 << "% del presupuesto fijado. Le quedan: " << formatearCOP(presupuesto - gastosTotales) << RESET << "\n";
        } else {
            cout << GREEN << "✔️ Sus gastos están dentro del margen presupuestal programado.\n" << RESET;
        }
    } else {
        cout << YELLOW << "Aún no ha configurado un límite de gasto mensual.\n" << RESET;
    }

    if (gastosTotales > ingresosTotales && ingresosTotales > 0.0) {
        cout << BOLD << RED << "⚠️ ADVERTENCIA CRÍTICA: Sus gastos superan sus ingresos totales.\n" << RESET;
    }

    cout << "\n¿Desea cambiar el límite de gasto mensual? (1 = Sí, 0 = No): ";
    int opc;
    if (!(cin >> opc)) {
        if (cin.eof()) { limpiarBuffer(); return; }
        opc = 0;
    }
    limpiarBuffer();

    if (opc == 1) {
        presupuesto = leerMontoPositivo("Nuevo límite de gasto (COP): ");
        cout << GREEN << "✔️ Presupuesto actualizado a: " << formatearCOP(presupuesto) << RESET << "\n";
    }
}

/**
 * MÓDULO 4: Explicación de Fundamentos Académicos de Ingeniería de Sistemas
 */
void mostrarConsejosFinancieros(const vector<Movimiento>& movimientos,
                               const MetaAhorro& meta,
                               const vector<Deuda>& deudas,
                               double presupuesto) {
    double ingresos = calcularIngresosTotales(movimientos);
    double gastos = calcularGastosTotales(movimientos);
    double disponible = calcularDineroDisponible(ingresos, gastos);
    double ahorro = calcularAhorroAcumulado(meta);
    double deudaPendiente = calcularTotalDeudasPendientes(deudas);

    cout << "\n" << BOLD << CYAN
         << "================ CONSEJOS PARA TUS FINANZAS ================" << RESET << "\n";

    if (movimientos.empty()) {
        cout << YELLOW << "Registra tus ingresos y gastos para recibir recomendaciones personalizadas.\n" << RESET;
        return;
    }
    if (ingresos <= 0.0) {
        cout << YELLOW << "• Registra tus ingresos para comparar tus gastos con el dinero que recibes.\n" << RESET;
    } else if (gastos > ingresos) {
        cout << RED << "• Tus gastos superan tus ingresos en " << formatearCOP(gastos - ingresos)
             << ". Revisa los gastos no esenciales y prioriza los pagos importantes.\n" << RESET;
    } else {
        cout << GREEN << "• Tu balance de movimientos es positivo: " << formatearCOP(disponible) << ".\n" << RESET;
    }

    if (presupuesto > 0.0) {
        double porcentaje = (gastos / presupuesto) * 100.0;
        if (gastos > presupuesto) {
            cout << RED << "• Has superado tu límite de gastos por " << formatearCOP(gastos - presupuesto) << ".\n" << RESET;
        } else if (porcentaje >= 80.0) {
            cout << YELLOW << "• Has utilizado el " << fixed << setprecision(1) << porcentaje
                 << "% de tu límite de gastos. Modera compras no prioritarias.\n" << RESET;
        } else {
            cout << GREEN << "• Has utilizado el " << fixed << setprecision(1) << porcentaje
                 << "% de tu límite de gastos.\n" << RESET;
        }
    } else {
        cout << YELLOW << "• Define un límite de gastos para ayudarte a controlar tus compras.\n" << RESET;
    }

    if (ingresos > 0.0) {
        double tasa = (ahorro / ingresos) * 100.0;
        if (tasa < 10.0) {
            cout << YELLOW << "• Tu ahorro registrado equivale al " << fixed << setprecision(1) << tasa
                 << "% de tus ingresos. Si puedes, fija una meta pequeña y constante.\n" << RESET;
        } else {
            cout << GREEN << "• Tu ahorro registrado equivale al " << fixed << setprecision(1) << tasa
                 << "% de tus ingresos.\n" << RESET;
        }
    }

    if (deudaPendiente > 0.0) {
        cout << MAGENTA << "• Tienes " << formatearCOP(deudaPendiente)
             << " en deudas pendientes. Revisa fechas de pago y prioriza las obligaciones urgentes.\n" << RESET;
    } else {
        cout << GREEN << "• No tienes deudas pendientes registradas.\n" << RESET;
    }

    if (meta.metaTotal > 0.0) {
        cout << CYAN << "• Tu meta \"" << meta.descripcion << "\" lleva un avance del "
             << fixed << setprecision(1) << calcularAvanceMeta(ahorro, meta.metaTotal) << "%.\n" << RESET;
    }

    cout << YELLOW << "\nNota: el balance de ingresos menos gastos no descuenta automáticamente los aportes de ahorro ni los abonos de deuda. Para reflejarlos en el balance, registra esos pagos como gastos.\n" << RESET;
    cout << string(63, '-') << "\n";
}

// ============================================================================
// 6. FUNCIÓN PRINCIPAL (main)
// ============================================================================

int main() {
    // Configuración regional básica para visualización limpia
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Variables de estado del sistema
    vector<Movimiento> movimientos;
    MetaAhorro metaAhorro = {"Fondo de Ahorro Universitario", 3000000.0, {}};
    vector<Deuda> deudas;
    double presupuestoMensual = 2000000.0;

    // Cargar automáticamente datos de prueba iniciales para demostración fluida
    cargarDatosDemo(movimientos, metaAhorro, deudas, presupuestoMensual);

    int opcion = -1;
    TipoGestion modoGestion = TipoGestion::PERSONAL;

    do {
        cout << "\n" << BOLD << CYAN << "======================================================================" << RESET << "\n";
        cout << BOLD << CYAN << "       SISTEMA DE FINANZAS PERSONALES | INGENIERÍA DE SISTEMAS       " << RESET << "\n";
        cout << BOLD << CYAN << "======================================================================" << RESET << "\n";
        cout << " MODO ACTUAL: " << (modoGestion == TipoGestion::PERSONAL ? "GESTIÓN PERSONAL" : "GESTIÓN MINI EMPRESARIAL") << "\n";
        cout << " 1. 📊 Ver Panel Principal (Dashboard y Diagnóstico Financiero)\n";
        cout << " 2. 💰 Registrar Nuevo Ingreso\n";
        cout << " 3. 💸 Registrar Nuevo Gasto\n";
        cout << " 4. 📜 Historial de Movimientos (Filtros y Eliminación)\n";
        cout << " 5. 🎯 Gestión de Ahorro (Metas, Aportes y Avance)\n";
        cout << " 6. 💳 Gestión de Deudas (Abonos y Saldos Pendientes)\n";
        cout << " 7. ⚖️  Presupuesto Mensual y Matriz de Alertas\n";
        cout << " 8. ⚡ Recargar Datos de Demostración (Colombia COP)\n";
        cout << " 9. 💡 Consejos para mejorar tus finanzas\n";
        cout << " 10. 🏢 Abrir pantalla Mini Empresarial\n";
        cout << " 11. 👤 Volver a pantalla Personal\n";
        cout << " 12. ⚙️ Perfil de Gestión (Personal / Mini Empresarial)\n";
        cout << " 0. 🚪 Salir del Programa\n";
        cout << BOLD << CYAN << "----------------------------------------------------------------------" << RESET << "\n";
        cout << "Seleccione una opción [0-12]: ";

        if (!(cin >> opcion)) {
            if (cin.eof()) {
                opcion = 0;
                cout << "\nFin de entrada detectado. Saliendo...\n";
                break;
            }
            cout << RED << "Entrada inválida. Ingrese un número.\n" << RESET;
            limpiarBuffer();
            continue;
        }
        limpiarBuffer();

        switch (opcion) {
            case 1:
                mostrarDashboard(movimientos, metaAhorro, deudas, presupuestoMensual, modoGestion);
                pausarConsola();
                break;
            case 2:
                registrarIngreso(movimientos);
                pausarConsola();
                break;
            case 3:
                registrarGasto(movimientos);
                pausarConsola();
                break;
            case 4:
                mostrarHistorial(movimientos);
                pausarConsola();
                break;
            case 5:
                gestionarAhorro(metaAhorro, calcularIngresosTotales(movimientos));
                pausarConsola();
                break;
            case 6:
                gestionarDeudas(deudas);
                pausarConsola();
                break;
            case 7:
                gestionarPresupuesto(presupuestoMensual, calcularGastosTotales(movimientos), calcularIngresosTotales(movimientos));
                pausarConsola();
                break;
            case 8: {
                cout << YELLOW << "Esto reemplazará tus registros por datos de demostración.\n"
                     << "¿Deseas continuar? (1 = Sí, 0 = No): " << RESET;
                int confirmar;
                if (!(cin >> confirmar)) {
                    if (cin.eof()) {
                        limpiarBuffer();
                        opcion = 0;
                        cout << "\nFin de entrada detectado. Saliendo...\n";
                        break;
                    }
                    confirmar = 0;
                }
                if (confirmar == 1) {
                    limpiarBuffer();
                    cargarDatosDemo(movimientos, metaAhorro, deudas, presupuestoMensual);
                    cout << GREEN << BOLD << "✔️ Datos de demostración cargados.\n" << RESET;
                } else {
                    limpiarBuffer();
                    cout << "Operación cancelada. Tus registros no se modificaron.\n";
                }
                pausarConsola();
                break;
            }
            case 9:
                mostrarConsejosFinancieros(movimientos, metaAhorro, deudas, presupuestoMensual);
                pausarConsola();
                break;
            case 10:
                modoGestion = TipoGestion::MINI_EMPRESARIAL;
                cout << GREEN << "✔️ Pantalla Mini Empresarial abierta.\n" << RESET;
                pausarConsola();
                break;
            case 11:
                modoGestion = TipoGestion::PERSONAL;
                cout << GREEN << "✔️ Pantalla Personal abierta.\n" << RESET;
                pausarConsola();
                break;
            case 12:
                mostrarPerfilGestion(modoGestion);
                pausarConsola();
                break;
            case 0:
                cout << GREEN << "\n¡Gracias por utilizar MiBolsillo!\n" << RESET;
                break;
            default:
                cout << RED << "Opción inválida. Intente de nuevo.\n" << RESET;
                pausarConsola();
                break;
        }

    } while (opcion != 0);

    return 0;
}
