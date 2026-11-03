-- ============================================================================
-- BASE DE DATOS: gestor_financiero
-- SISTEMA INTEGRAL: FINANZAS PERSONALES Y GESTIÓN EMPRESARIAL
-- TECNOLOGÍA: MySQL 8.0+ / MariaDB 10.5+
-- AUTOR: Gestor Financiero Team
-- ============================================================================

DROP DATABASE IF EXISTS gestor_financiero;
CREATE DATABASE gestor_financiero 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE gestor_financiero;

-- ============================================================================
-- 1. MÓDULO GENERAL / AUTENTICACIÓN
-- ============================================================================

-- Tabla: usuario
CREATE TABLE usuario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    telefono VARCHAR(30) NULL,
    password_hash VARCHAR(255) NOT NULL,
    moneda_principal VARCHAR(10) NOT NULL DEFAULT 'COP',
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso DATETIME NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    INDEX idx_usuario_email (email),
    INDEX idx_usuario_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: persona_natural (Datos de perfil del usuario)
CREATE TABLE persona_natural (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL UNIQUE,
    tipo_documento VARCHAR(20) NOT NULL DEFAULT 'CC',
    numero_documento VARCHAR(50) NOT NULL,
    fecha_nacimiento DATE NULL,
    profesion VARCHAR(100) NULL,
    direccion VARCHAR(200) NULL,
    saldo_inicial DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_persona_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuario(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: negocio (Uno o varios negocios por usuario)
CREATE TABLE negocio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    tipo VARCHAR(80) NOT NULL, -- e.g. 'Panadería', 'Manufactura', 'Comercio', 'Servicios'
    descripcion TEXT NULL,
    telefono VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    direccion VARCHAR(200) NULL,
    moneda VARCHAR(10) NOT NULL DEFAULT 'COP',
    estado ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_negocio_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuario(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_negocio_usuario (usuario_id, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 2. MÓDULO DE FINANZAS PERSONALES
-- ============================================================================

-- Tabla: cuenta_personal
CREATE TABLE cuenta_personal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    tipo ENUM('AHORRO', 'CORRIENTE', 'EFECTIVO', 'TARJETA_CREDITO', 'INVERSION') NOT NULL DEFAULT 'AHORRO',
    saldo DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    moneda VARCHAR(10) NOT NULL DEFAULT 'COP',
    color VARCHAR(20) NOT NULL DEFAULT '#10b981',
    icono VARCHAR(50) NOT NULL DEFAULT '💳',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cuenta_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuario(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_cuenta_usuario (usuario_id, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: categoria_personal
CREATE TABLE categoria_personal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL, -- NULL indica categoría predeterminada del sistema
    nombre VARCHAR(80) NOT NULL,
    tipo ENUM('INGRESO', 'GASTO') NOT NULL,
    icono VARCHAR(50) NOT NULL DEFAULT '🏷️',
    color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_categoria_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuario(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_categoria_tipo (tipo, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: movimiento_personal
CREATE TABLE movimiento_personal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    cuenta_id INT NOT NULL,
    categoria_id INT NOT NULL,
    tipo ENUM('INGRESO', 'GASTO', 'TRANSFERENCIA') NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL DEFAULT 'Transferencia',
    referencia VARCHAR(100) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mov_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuario(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_mov_cuenta FOREIGN KEY (cuenta_id) 
        REFERENCES cuenta_personal(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_mov_categoria FOREIGN KEY (categoria_id) 
        REFERENCES categoria_personal(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_mov_usuario_fecha (usuario_id, fecha),
    INDEX idx_mov_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: presupuesto
CREATE TABLE presupuesto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    categoria_id INT NULL, -- NULL si es presupuesto global mensual
    nombre VARCHAR(100) NOT NULL,
    monto_limite DECIMAL(15,2) NOT NULL,
    periodo ENUM('SEMANAL', 'QUINCENAL', 'MENSUAL', 'ANUAL') NOT NULL DEFAULT 'MENSUAL',
    anio INT NOT NULL,
    mes INT NOT NULL, -- 1 a 12
    activo TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_pres_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuario(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pres_categoria FOREIGN KEY (categoria_id) 
        REFERENCES categoria_personal(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_pres_periodo (usuario_id, anio, mes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: meta_ahorro
CREATE TABLE meta_ahorro (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT NULL,
    monto_objetivo DECIMAL(15,2) NOT NULL,
    monto_actual DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    fecha_inicio DATE NOT NULL,
    fecha_limite DATE NOT NULL,
    categoria VARCHAR(50) NOT NULL DEFAULT 'Seguridad',
    prioridad ENUM('BAJA', 'MEDIA', 'ALTA') NOT NULL DEFAULT 'MEDIA',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_meta_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuario(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: aporte_meta
CREATE TABLE aporte_meta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meta_id INT NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    fecha DATE NOT NULL,
    nota VARCHAR(255) NULL,
    CONSTRAINT fk_aporte_meta FOREIGN KEY (meta_id) 
        REFERENCES meta_ahorro(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: deuda_personal
CREATE TABLE deuda_personal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT NULL,
    monto_total DECIMAL(15,2) NOT NULL,
    monto_pagado DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    tasa_interes DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    cuota_mensual DECIMAL(15,2) NULL,
    fecha_inicio DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    acreedor VARCHAR(100) NOT NULL,
    tipo ENUM('PRESTAMO', 'TARJETA', 'HIPOTECA', 'OTRO') NOT NULL DEFAULT 'OTRO',
    estado ENUM('ACTIVA', 'PAGADA', 'VENCIDA') NOT NULL DEFAULT 'ACTIVA',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_deuda_usuario FOREIGN KEY (usuario_id) 
        REFERENCES usuario(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: pago_deuda
CREATE TABLE pago_deuda (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deuda_id INT NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    fecha_pago DATE NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL DEFAULT 'Transferencia',
    referencia VARCHAR(100) NULL,
    notas VARCHAR(255) NULL,
    CONSTRAINT fk_pago_deuda FOREIGN KEY (deuda_id) 
        REFERENCES deuda_personal(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 3. MÓDULO DE GESTIÓN EMPRESARIAL
-- ============================================================================

-- Tabla: producto (Productos Terminados y Materias Primas)
CREATE TABLE producto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    tipo ENUM('PRODUCTO', 'MATERIA_PRIMA') NOT NULL DEFAULT 'PRODUCTO',
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT NULL,
    precio_compra DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    precio_venta DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    costo_unitario DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    unidad_medida VARCHAR(30) NOT NULL DEFAULT 'unidades', -- 'kg', 'litros', 'unidades', etc.
    stock DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    stock_minimo DECIMAL(12,2) NOT NULL DEFAULT 5.00,
    estado ENUM('DISPONIBLE', 'AGOTADO', 'DESCONTINUADO') NOT NULL DEFAULT 'DISPONIBLE',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prod_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocio(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_prod_negocio_tipo (negocio_id, tipo, activo),
    INDEX idx_prod_stock (negocio_id, stock, stock_minimo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: proveedor
CREATE TABLE proveedor (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(40) NULL,
    email VARCHAR(150) NULL,
    direccion VARCHAR(255) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prov_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocio(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_prov_negocio (negocio_id, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: cliente
CREATE TABLE cliente (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(40) NULL,
    email VARCHAR(150) NULL,
    direccion VARCHAR(255) NULL,
    saldo_pendiente DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cli_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocio(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_cli_negocio (negocio_id, activo),
    INDEX idx_cli_saldo (negocio_id, saldo_pendiente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: compra (Cabecera de Compras)
CREATE TABLE compra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    proveedor_id INT NOT NULL,
    fecha DATE NOT NULL,
    total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    estado ENUM('PENDIENTE', 'CONFIRMADA', 'CANCELADA') NOT NULL DEFAULT 'CONFIRMADA',
    observaciones TEXT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_compra_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocio(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_compra_proveedor FOREIGN KEY (proveedor_id) 
        REFERENCES proveedor(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_compra_negocio_fecha (negocio_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: detalle_compra (Renglones de la compra)
CREATE TABLE detalle_compra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    compra_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad DECIMAL(12,2) NOT NULL,
    precio_unitario DECIMAL(15,2) NOT NULL,
    subtotal DECIMAL(15,2) NOT NULL,
    CONSTRAINT fk_detcompra_compra FOREIGN KEY (compra_id) 
        REFERENCES compra(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_detcompra_producto FOREIGN KEY (producto_id) 
        REFERENCES producto(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: venta (Cabecera de Ventas)
CREATE TABLE venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    cliente_id INT NOT NULL,
    fecha DATE NOT NULL,
    tipo_pago ENUM('CONTADO', 'CREDITO') NOT NULL DEFAULT 'CONTADO',
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    saldo_pendiente DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    estado ENUM('PAGADA', 'PENDIENTE', 'CANCELADA') NOT NULL DEFAULT 'PAGADA',
    metodo_pago VARCHAR(50) NOT NULL DEFAULT 'Efectivo',
    notas TEXT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_venta_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocio(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_venta_cliente FOREIGN KEY (cliente_id) 
        REFERENCES cliente(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_venta_negocio_fecha (negocio_id, fecha),
    INDEX idx_venta_estado (negocio_id, estado, tipo_pago)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: detalle_venta (Renglones de la venta)
CREATE TABLE detalle_venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad DECIMAL(12,2) NOT NULL,
    precio_unitario DECIMAL(15,2) NOT NULL,
    costo_unitario DECIMAL(15,2) NOT NULL DEFAULT 0.00, -- Para calcular utilidad real
    subtotal DECIMAL(15,2) NOT NULL,
    CONSTRAINT fk_detventa_venta FOREIGN KEY (venta_id) 
        REFERENCES venta(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_detventa_producto FOREIGN KEY (producto_id) 
        REFERENCES producto(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: pago_venta (Abonos a ventas a crédito)
CREATE TABLE pago_venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT NOT NULL,
    negocio_id INT NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    fecha DATE NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL DEFAULT 'Efectivo',
    referencia VARCHAR(100) NULL,
    notas VARCHAR(255) NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pagoventa_venta FOREIGN KEY (venta_id) 
        REFERENCES venta(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pagoventa_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocio(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_pagoventa_fecha (negocio_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: gasto_negocio (Gastos Operativos Empresariales)
CREATE TABLE gasto_negocio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    categoria ENUM('ARRIENDO', 'SERVICIOS_PUBLICOS', 'TRANSPORTE', 'MANTENIMIENTO', 'NOMINA', 'MARKETING', 'OTROS') NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    fecha DATE NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    comprobante VARCHAR(100) NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gastoneg_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocio(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_gastoneg_fecha (negocio_id, fecha, categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: empleado
CREATE TABLE empleado (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    cargo VARCHAR(80) NOT NULL,
    telefono VARCHAR(40) NULL,
    salario DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    fecha_ingreso DATE NOT NULL,
    estado ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT fk_emp_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocio(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_emp_negocio (negocio_id, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: pago_empleado
CREATE TABLE pago_empleado (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    empleado_id INT NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    concepto VARCHAR(120) NOT NULL DEFAULT 'Salario Quincenal / Mensual',
    periodo VARCHAR(50) NOT NULL,
    fecha DATE NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL DEFAULT 'Transferencia',
    notas VARCHAR(255) NULL,
    CONSTRAINT fk_pagoemp_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocio(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pagoemp_empleado FOREIGN KEY (empleado_id) 
        REFERENCES empleado(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_pagoemp_fecha (negocio_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: movimiento_inventario (Kardex / Auditoría de Stock)
CREATE TABLE movimiento_inventario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    producto_id INT NOT NULL,
    tipo ENUM('ENTRADA', 'SALIDA', 'AJUSTE', 'PRODUCCION') NOT NULL,
    cantidad DECIMAL(12,2) NOT NULL,
    stock_anterior DECIMAL(12,2) NOT NULL,
    stock_posterior DECIMAL(12,2) NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movinv_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocio(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_movinv_producto FOREIGN KEY (producto_id) 
        REFERENCES producto(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_movinv_prod_fecha (producto_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: formula_producto (Recetas / Fórmulas de Fabricación)
CREATE TABLE formula_producto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    producto_id INT NOT NULL, -- Producto terminado que se obtiene
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT NULL,
    cantidad_base DECIMAL(12,2) NOT NULL DEFAULT 1.00, -- Cantidad de producto terminado que produce esta fórmula
    activo TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_formula_negocio FOREIGN KEY (negocio_id) 
        REFERENCES negocio(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_formula_producto FOREIGN KEY (producto_id) 
        REFERENCES producto(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: detalle_formula (Materias primas que componen la receta)
CREATE TABLE detalle_formula (
    id INT AUTO_INCREMENT PRIMARY KEY,
    formula_id INT NOT NULL,
    materia_prima_id INT NOT NULL,
    cantidad_requerida DECIMAL(12,4) NOT NULL, -- Cantidad necesaria para la cantidad_base
    CONSTRAINT fk_detform_formula FOREIGN KEY (formula_id) 
        REFERENCES formula_producto(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_detform_mp FOREIGN KEY (materia_prima_id) 
        REFERENCES producto(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla: produccion (Lotes de Fabricación Realizados)
CREATE TABLE produccion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    formula_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad_producida DECIMAL(12,2) NOT NULL,
    costo_total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    costo_unitario DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    fecha DATE NOT NULL,
    estado ENUM('COMPLETADA', 'CANCELADA') NOT NULL DEFAULT 'COMPLETADA',
    notas TEXT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prod_negocio_prod FOREIGN KEY (negocio_id) 
        REFERENCES negocio(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_prod_formula FOREIGN KEY (formula_id) 
        REFERENCES formula_producto(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_prod_prod_terminado FOREIGN KEY (producto_id) 
        REFERENCES producto(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_produccion_fecha (negocio_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 4. TRIGGERS / PROCEDIMIENTOS ALMACENADOS PARA REGLAS DE NEGOCIO
-- ============================================================================

DELIMITER //

-- Regla 1: Al confirmar una compra, aumentar automáticamente el inventario
CREATE TRIGGER trg_despues_insert_detalle_compra
AFTER INSERT ON detalle_compra
FOR EACH ROW
BEGIN
    DECLARE v_stock_actual DECIMAL(12,2);
    DECLARE v_negocio_id INT;

    SELECT stock, negocio_id INTO v_stock_actual, v_negocio_id 
    FROM producto WHERE id = NEW.producto_id;

    -- Aumentar stock del producto
    UPDATE producto 
    SET stock = stock + NEW.cantidad,
        precio_compra = NEW.precio_unitario,
        costo_unitario = NEW.precio_unitario,
        estado = IF(stock + NEW.cantidad > 0, 'DISPONIBLE', estado)
    WHERE id = NEW.producto_id;

    -- Registrar auditoría en kardex
    INSERT INTO movimiento_inventario (negocio_id, producto_id, tipo, cantidad, stock_anterior, stock_posterior, motivo, fecha)
    VALUES (v_negocio_id, NEW.producto_id, 'ENTRADA', NEW.cantidad, v_stock_actual, v_stock_actual + NEW.cantidad, CONCAT('Compra Reg #', NEW.compra_id), CURDATE());
END //

-- Regla 2 y 3: Al registrar una venta, verificar y descontar stock automáticamente
CREATE TRIGGER trg_antes_insert_detalle_venta
BEFORE INSERT ON detalle_venta
FOR EACH ROW
BEGIN
    DECLARE v_stock_disponible DECIMAL(12,2);
    DECLARE v_costo DECIMAL(15,2);

    SELECT stock, costo_unitario INTO v_stock_disponible, v_costo 
    FROM producto WHERE id = NEW.producto_id;

    -- Regla 3: No permitir vender cantidades superiores a las disponibles
    IF v_stock_disponible < NEW.cantidad THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Error: Existencias insuficientes en inventario para realizar la venta.';
    END IF;

    -- Asignar el costo unitario histórico para el cálculo real de utilidad
    SET NEW.costo_unitario = v_costo;
END //

CREATE TRIGGER trg_despues_insert_detalle_venta
AFTER INSERT ON detalle_venta
FOR EACH ROW
BEGIN
    DECLARE v_stock_actual DECIMAL(12,2);
    DECLARE v_negocio_id INT;

    SELECT stock, negocio_id INTO v_stock_actual, v_negocio_id 
    FROM producto WHERE id = NEW.producto_id;

    -- Disminuir existencias
    UPDATE producto 
    SET stock = stock - NEW.cantidad,
        estado = IF(stock - NEW.cantidad <= 0, 'AGOTADO', 'DISPONIBLE')
    WHERE id = NEW.producto_id;

    -- Registrar auditoría en kardex
    INSERT INTO movimiento_inventario (negocio_id, producto_id, tipo, cantidad, stock_anterior, stock_posterior, motivo, fecha)
    VALUES (v_negocio_id, NEW.producto_id, 'SALIDA', NEW.cantidad, v_stock_actual, v_stock_actual - NEW.cantidad, CONCAT('Venta Factura #', NEW.venta_id), CURDATE());
END //

-- Regla 4: Al registrar una venta a crédito, actualizar el saldo pendiente del cliente
CREATE TRIGGER trg_despues_insert_venta
AFTER INSERT ON venta
FOR EACH ROW
BEGIN
    IF NEW.tipo_pago = 'CREDITO' AND NEW.total > 0 THEN
        UPDATE cliente 
        SET saldo_pendiente = saldo_pendiente + NEW.total
        WHERE id = NEW.cliente_id;
    END IF;
END //

-- Regla 5: Al registrar un abono a venta a crédito, disminuir el saldo pendiente
CREATE TRIGGER trg_despues_insert_pago_venta
AFTER INSERT ON pago_venta
FOR EACH ROW
BEGIN
    DECLARE v_saldo_actual DECIMAL(15,2);
    DECLARE v_cliente_id INT;

    -- Obtener saldo pendiente de la venta y el cliente
    SELECT saldo_pendiente, cliente_id INTO v_saldo_actual, v_cliente_id 
    FROM venta WHERE id = NEW.venta_id;

    -- Actualizar saldo de la venta
    UPDATE venta 
    SET saldo_pendiente = GREATEST(0.00, saldo_pendiente - NEW.monto),
        estado = IF(saldo_pendiente - NEW.monto <= 0.001, 'PAGADA', 'PENDIENTE')
    WHERE id = NEW.venta_id;

    -- Disminuir saldo pendiente del cliente
    UPDATE cliente 
    SET saldo_pendiente = GREATEST(0.00, saldo_pendiente - NEW.monto)
    WHERE id = v_cliente_id;
END //

DELIMITER ;


-- ============================================================================
-- 5. DATOS DEMOSTRATIVOS INICIALES (SEED DATA)
-- ============================================================================

-- Usuario principal
INSERT INTO usuario (id, nombre, apellido, email, telefono, password_hash, moneda_principal)
VALUES (1, 'Lucía', 'Martín', 'lucia.martin@email.com', '+57 300 123 4567', '$2a$12$e8Y5M59j.lY2rS..mockBcryptHash', 'COP');

INSERT INTO persona_natural (usuario_id, tipo_documento, numero_documento, profesion, direccion, saldo_inicial)
VALUES (1, 'CC', '1098765432', 'Ingeniera de Sistemas & Emprendedora', 'Cra 45 # 12-34, Bogotá', 0.00);

-- Negocio del usuario
INSERT INTO negocio (id, usuario_id, nombre, tipo, descripcion, telefono, email, direccion, estado)
VALUES (1, 1, 'Panadería & Delicias La Aurora', 'Alimentos / Panadería Artesanal', 'Elaboración y venta de productos de panadería fina, café y repostería artesanal.', '+57 310 987 6543', 'contacto@deliciaslaaurora.co', 'Av. Las Palmas # 50-20, Bogotá', 'ACTIVO');

-- Cuentas personales
INSERT INTO cuenta_personal (id, usuario_id, nombre, tipo, saldo, moneda, color, icono)
VALUES 
(1, 1, 'Cuenta Nómina Bancolombia', 'AHORRO', 1359500.00, 'COP', '#10b981', '🏦'),
(2, 1, 'Bolsillo Efectivo', 'EFECTIVO', 150000.00, 'COP', '#06b6d4', '💵');

-- Categorías personales
INSERT INTO categoria_personal (id, usuario_id, nombre, tipo, icono, color)
VALUES
(1, NULL, 'Alimentación', 'GASTO', '🛒', '#10b981'),
(2, NULL, 'Transporte', 'GASTO', '🚌', '#06b6d4'),
(3, NULL, 'Ocio', 'GASTO', '☕', '#f59e0b'),
(4, NULL, 'Vivienda', 'GASTO', '🏠', '#6366f1'),
(5, NULL, 'Sanidad', 'GASTO', '⚕️', '#ec4899'),
(6, NULL, 'Otros Gastos', 'GASTO', '···', '#8b5cf6'),
(7, NULL, 'Salario', 'INGRESO', '💼', '#10b981'),
(8, NULL, 'Ventas Negocio', 'INGRESO', '🏷️', '#06b6d4'),
(9, NULL, 'Freelance', 'INGRESO', '💻', '#3b82f6');

-- Productos y Materias Primas del Negocio
INSERT INTO producto (id, negocio_id, tipo, nombre, descripcion, precio_compra, precio_venta, costo_unitario, unidad_medida, stock, stock_minimo, estado)
VALUES
-- Materias Primas
(1, 1, 'MATERIA_PRIMA', 'Harina de Trigo Especial', 'Bulto de harina fortificada panadera', 85000.00, 0.00, 1700.00, 'kg', 120.00, 20.00, 'DISPONIBLE'),
(2, 1, 'MATERIA_PRIMA', 'Mantequilla Pura 82%', 'Mantequilla sin sal para hojaldres', 24000.00, 0.00, 24000.00, 'kg', 25.00, 5.00, 'DISPONIBLE'),
(3, 1, 'MATERIA_PRIMA', 'Levadura Fresca', 'Levadura prensada para fermentación', 12000.00, 0.00, 12000.00, 'kg', 15.00, 3.00, 'DISPONIBLE'),
(4, 1, 'MATERIA_PRIMA', 'Azúcar Blanca Refinada', 'Azúcar de caña fina', 4500.00, 0.00, 4500.00, 'kg', 40.00, 10.00, 'DISPONIBLE'),
(5, 1, 'MATERIA_PRIMA', 'Café Especial en Grano', 'Café arábica de origen Huila', 32000.00, 0.00, 32000.00, 'kg', 18.00, 4.00, 'DISPONIBLE'),
-- Productos Terminados
(6, 1, 'PRODUCTO', 'Croissant de Mantequilla Artesanal', 'Croissant clásico con hojaldre francés 100% mantequilla', 0.00, 6500.00, 2800.00, 'unidades', 45.00, 15.00, 'DISPONIBLE'),
(7, 1, 'PRODUCTO', 'Pan Baguette Tradicional', 'Pan crujiente con masa madre y fermentación lenta', 0.00, 5000.00, 1900.00, 'unidades', 35.00, 10.00, 'DISPONIBLE'),
(8, 1, 'PRODUCTO', 'Café Cappuccino 12oz', 'Bebida a base de espresso doble y leche texturizada', 0.00, 7500.00, 2200.00, 'unidades', 60.00, 15.00, 'DISPONIBLE'),
(9, 1, 'PRODUCTO', 'Tarta Vasca de Queso (Porción)', 'Porción individual de tarta cremosa caramelizada', 0.00, 12000.00, 5100.00, 'unidades', 18.00, 6.00, 'DISPONIBLE');

-- Proveedores
INSERT INTO proveedor (id, negocio_id, nombre, telefono, email, direccion)
VALUES
(1, 1, 'Molinos del Valle S.A.S.', '+57 312 456 7890', 'pedidos@molinosdelvalle.com', 'Zona Industrial Km 3, Bogotá'),
(2, 1, 'Lácteos & Derivados del Prado', '+57 315 789 1234', 'ventas@lacteosdelprado.co', 'Calle 13 # 68-40, Bogotá'),
(3, 1, 'Café Hacienda El Retiro', '+57 318 654 9870', 'haciendaelretiro@cafe.co', 'Cra 7 # 116-50, Bogotá');

-- Clientes
INSERT INTO cliente (id, negocio_id, nombre, telefono, email, direccion, saldo_pendiente)
VALUES
(1, 1, 'Cafetería del Parque', '+57 311 222 3344', 'admin@cafedelparque.com', 'Parque Central Local 4', 185000.00),
(2, 1, 'Restaurante Bistro San Ángel', '+57 314 555 6677', 'bistro@sanangel.com', 'Cra 11 # 85-20', 320000.00),
(3, 1, 'David Ricardo Morales', '+57 301 999 8877', 'david.morales@correo.com', 'Calle 72 # 9-45', 0.00),
(4, 1, 'Carolina Restrepo', '+57 320 444 1122', 'carolina.restrepo@empresa.com', 'Av. 19 # 104-30', 45000.00);

-- Empleados
INSERT INTO empleado (id, negocio_id, nombre, cargo, telefono, salario, fecha_ingreso, estado)
VALUES
(1, 1, 'Mateo Gómez Salazar', 'Maestro Panadero & Jefe de Producción', '+57 313 111 2233', 1850000.00, '2025-06-15', 'ACTIVO'),
(2, 1, 'Valentina Ruiz Peña', 'Barista & Atención al Cliente', '+57 316 444 5566', 1420000.00, '2025-09-01', 'ACTIVO');

-- Fórmulas / Recetas
INSERT INTO formula_producto (id, negocio_id, producto_id, nombre, descripcion, cantidad_base)
VALUES
(1, 1, 6, 'Receta Croissant Clásico x 20 uds', 'Fórmula de hojaldre francés para 20 unidades de croissants de 85g', 20.00),
(2, 1, 7, 'Receta Baguette Francesa x 10 uds', 'Masa madre con hidratación del 68% para 10 baguettes', 10.00);

-- Ingredientes de la Receta 1 (Croissant x 20 uds)
INSERT INTO detalle_formula (formula_id, materia_prima_id, cantidad_requerida)
VALUES
(1, 1, 1.2000), -- 1.2 kg Harina
(1, 2, 0.6500), -- 0.65 kg Mantequilla
(1, 3, 0.0600), -- 0.06 kg Levadura
(1, 4, 0.1400); -- 0.14 kg Azúcar

-- Ingredientes de la Receta 2 (Baguette x 10 uds)
INSERT INTO detalle_formula (formula_id, materia_prima_id, cantidad_requerida)
VALUES
(2, 1, 3.5000), -- 3.5 kg Harina
(2, 3, 0.0500); -- 0.05 kg Levadura

-- Gastos Operativos del Negocio
INSERT INTO gasto_negocio (negocio_id, categoria, monto, fecha, descripcion)
VALUES
(1, 'ARRIENDO', 1200000.00, '2026-10-05', 'Arriendo del local comercial mes de octubre'),
(1, 'SERVICIOS_PUBLICOS', 380000.00, '2026-10-10', 'Factura de energía y gas natural comercial'),
(1, 'MANTENIMIENTO', 150000.00, '2026-10-12', 'Mantenimiento preventivo horno rotativo');

-- Compras iniciales registradas
INSERT INTO compra (id, negocio_id, proveedor_id, fecha, total, estado, observaciones)
VALUES
(1, 1, 1, '2026-10-02', 425000.00, 'CONFIRMADA', 'Compra mensual de harina especial'),
(2, 1, 2, '2026-10-03', 600000.00, 'CONFIRMADA', 'Mantequilla pura de importación');

INSERT INTO detalle_compra (compra_id, producto_id, cantidad, precio_unitario, subtotal)
VALUES
(1, 1, 5.00, 85000.00, 425000.00),
(2, 2, 25.00, 24000.00, 600000.00);

-- Ventas iniciales registradas (Contado y Crédito)
INSERT INTO venta (id, negocio_id, cliente_id, fecha, tipo_pago, subtotal, total, saldo_pendiente, estado, metodo_pago)
VALUES
(1, 1, 3, '2026-10-14', 'CONTADO', 38000.00, 38000.00, 0.00, 'PAGADA', 'Tarjeta Débito'),
(2, 1, 1, '2026-10-15', 'CREDITO', 185000.00, 185000.00, 185000.00, 'PENDIENTE', 'Crédito a 15 días'),
(3, 1, 2, '2026-10-16', 'CREDITO', 320000.00, 320000.00, 320000.00, 'PENDIENTE', 'Crédito mensual');

INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal)
VALUES
(1, 6, 4.00, 6500.00, 2800.00, 26000.00),
(1, 8, 2.00, 6000.00, 2200.00, 12000.00),
(2, 6, 20.00, 6500.00, 2800.00, 130000.00),
(2, 7, 11.00, 5000.00, 1900.00, 55000.00),
(3, 6, 30.00, 6500.00, 2800.00, 195000.00),
(3, 9, 10.00, 12500.00, 5100.00, 125000.00);

-- Producción registrada
INSERT INTO produccion (negocio_id, formula_id, producto_id, cantidad_producida, costo_total, costo_unitario, fecha, estado, notas)
VALUES
(1, 1, 6, 40.00, 112000.00, 2800.00, '2026-10-14', 'COMPLETADA', 'Lote matutino de croissants dorados');
