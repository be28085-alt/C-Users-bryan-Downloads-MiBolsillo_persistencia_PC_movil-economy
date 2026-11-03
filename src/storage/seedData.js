/**
 * ============================================================================
 * SEED DATA MODULE
 * Responsabilidad: Catálogos maestros, categorías de ingresos/gastos y constantes base.
 * ============================================================================
 */
(function () {
  'use strict';

  const CATEGORIAS_GASTO = [
    { id: 'Alimentación', nombre: 'Alimentación', icon: '🛒', color: '#10b981' },
    { id: 'Transporte', nombre: 'Transporte', icon: '🚌', color: '#06b6d4' },
    { id: 'Ocio', nombre: 'Ocio', icon: '☕', color: '#f59e0b' },
    { id: 'Vivienda', nombre: 'Vivienda', icon: '🏠', color: '#6366f1' },
    { id: 'Sanidad', nombre: 'Sanidad', icon: '⚕️', color: '#ec4899' },
    { id: 'Otros', nombre: 'Otros', icon: '···', color: '#8b5cf6' }
  ];

  const CATEGORIAS_INGRESO = [
    { id: 'Salario', nombre: 'Salario', icon: '💼', color: '#10b981' },
    { id: 'Ventas', nombre: 'Ventas', icon: '🏷️', color: '#06b6d4' },
    { id: 'Freelance', nombre: 'Freelance', icon: '💻', color: '#3b82f6' },
    { id: 'Inversiones', nombre: 'Inversión', icon: '📈', color: '#8b5cf6' },
    { id: 'Mesada', nombre: 'Apoyo', icon: '🤝', color: '#f59e0b' },
    { id: 'Otros', nombre: 'Otros', icon: '✨', color: '#14b8a6' }
  ];

  const CATEGORIAS_GASTO_NEGOCIO = [
    'Arriendo',
    'Servicios públicos',
    'Transporte',
    'Mantenimiento',
    'Nómina y personal',
    'Suministros y papelería',
    'Marketing y publicidad',
    'Impuestos y tasas',
    'Otros gastos operativos'
  ];

  const CUENTAS_BASE = [
    { id: 'cta-1', nombre: 'Cuenta Principal', tipo: 'BANCO', saldo: 2859500, entidad: 'Bancolombia' },
    { id: 'cta-2', nombre: 'Caja / Efectivo', tipo: 'EFECTIVO', saldo: 1000000, entidad: 'Billetera' }
  ];

  const seed = {
    CATEGORIAS_GASTO,
    CATEGORIAS_INGRESO,
    CATEGORIAS_GASTO_NEGOCIO,
    CUENTAS_BASE
  };

  window.FinanzasSeed = seed;
  window.CATEGORIAS_GASTO = CATEGORIAS_GASTO;
  window.CATEGORIAS_INGRESO = CATEGORIAS_INGRESO;
  window.CATEGORIAS_GASTO_NEGOCIO = CATEGORIAS_GASTO_NEGOCIO;
})();
