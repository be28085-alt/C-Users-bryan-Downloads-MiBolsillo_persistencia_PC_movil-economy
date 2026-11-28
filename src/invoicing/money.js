(function () {
  'use strict';
  // La entrada decimal no se convierte a Number: la aritmética usa enteros escalados.
  const LIMIT = 100000000000000n; // Un billón de COP en centavos; compatible con la visualización existente.
  /**
   * Convierte un decimal no negativo en unidades enteras sin redondear su entrada.
   * @param {*} value Entrada convertida a texto, con dígitos y punto decimal opcional.
   * @param {number} [scale=2] Cifras decimales admitidas; define el exponente de la escala.
   * @returns {bigint} Valor multiplicado por 10 elevado a scale.
   * @throws {Error} Si la sintaxis, la precisión o el límite permitido no son válidos.
   */
  function units(value, scale = 2) {
    const text = String(value ?? '').trim();
    const match = /^(\d{1,16})(?:\.(\d+))?$/.exec(text);
    if (!match || (match[2] || '').length > scale) {
      throw new Error(`Decimal inválido: use punto y máximo ${scale} decimales.`);
    }
    const result =
      BigInt(match[1]) * 10n ** BigInt(scale) + BigInt((match[2] || '').padEnd(scale, '0') || '0');
    if (result > LIMIT * 100n) throw new Error('Valor fuera del límite permitido.');
    return result;
  }
  /**
   * Representa un entero escalado como decimal con una cantidad fija de cifras.
   * @param {bigint} value Unidades enteras, con signo si corresponde.
   * @param {number} [scale=2] Escala positiva utilizada al obtener las unidades.
   * @returns {string} Decimal con punto y exactamente scale cifras fraccionarias.
   */
  function decimal(value, scale = 2) {
    const negative = value < 0n;
    const text = (negative ? -value : value).toString().padStart(scale + 1, '0');
    return `${negative ? '-' : ''}${text.slice(0, -scale)}.${text.slice(-scale)}`;
  }
  /**
   * Redondea el cociente no negativo al entero más próximo con criterio HALF_UP.
   * @param {bigint} n Numerador no negativo.
   * @param {bigint} d Divisor positivo que elimina la escala sobrante.
   * @returns {bigint} Cociente redondeado; los empates se redondean hacia arriba.
   * @throws {Error} Si el numerador es negativo o el divisor no es positivo.
   */
  function round(n, d) {
    if (n < 0n || d <= 0n) throw new Error('Redondeo fuera de dominio.');
    return (n + d / 2n) / d;
  }
  /**
   * Calcula líneas en COP con BigInt y suma sus importes ya redondeados a centavos.
   * Cantidad, precio y costo unitario usan escala 4; descuento y tarifa usan escala 2.
   * Cada bruto, descuento, impuesto y costo de línea aplica HALF_UP antes de sumar.
   * @param {object[]} items Artículos con cantidad, precio, costo, descuento e impuesto.
   * @returns {object} Líneas, totales y grupos tributarios con importes en cadenas decimales.
   * @throws {Error} Si los artículos, sus valores o el total incumplen las validaciones existentes.
   */
  function calculate(items) {
    if (!Array.isArray(items) || !items.length || items.length > 100) {
      throw new Error('Incluya entre 1 y 100 artículos.');
    }
    let gross = 0n,
      discount = 0n,
      base = 0n,
      tax = 0n,
      cost = 0n;
    const groups = {};
    const lines = items.map((item, index) => {
      const q = units(item.quantity, 4),
        p = units(item.unitPrice, 4),
        pct = units(item.discountPercent ?? '0', 2);
      const rate = units(item.taxRate ?? '0', 2),
        unitCost = units(item.unitCost ?? '0', 4);
      const taxKind = item.taxKind || 'IVA';
      if (
        !q ||
        !p ||
        pct > 10000n ||
        rate > 10000n ||
        !['IVA', 'INC', 'EXENTO', 'EXCLUIDO'].includes(taxKind)
      ) {
        throw new Error(`Revise cantidad, precio, descuento o impuesto del artículo ${index + 1}.`);
      }
      if (['EXENTO', 'EXCLUIDO'].includes(taxKind) && rate) {
        throw new Error('Exento y excluido requieren tarifa cero.');
      }
      const g = round(q * p, 1000000n),
        d = round(g * pct, 10000n),
        b = g - d,
        t = round(b * rate, 10000n),
        c = round(q * unitCost, 1000000n);
      gross += g;
      discount += d;
      base += b;
      tax += t;
      cost += c;
      const key = `${taxKind}:${decimal(rate)}`;
      groups[key] ||= { kind: taxKind, rate: decimal(rate), base: 0n, amount: 0n };
      groups[key].base += b;
      groups[key].amount += t;
      return {
        ...item,
        quantity: decimal(q, 4),
        unitPrice: decimal(p, 4),
        unitCost: decimal(unitCost, 4),
        discountPercent: decimal(pct),
        taxKind,
        taxRate: decimal(rate),
        gross: decimal(g),
        discount: decimal(d),
        base: decimal(b),
        tax: decimal(t),
        total: decimal(b + t),
        cost: decimal(c),
      };
    });
    if (base + tax <= 0n || gross > LIMIT || base + tax > LIMIT || cost > LIMIT) {
      throw new Error('Total cero o fuera del límite permitido.');
    }
    return {
      currency: 'COP',
      rounding: 'HALF_UP; bruto, descuento e impuesto por línea a 2 decimales; suma de líneas',
      lines,
      gross: decimal(gross),
      discount: decimal(discount),
      base: decimal(base),
      tax: decimal(tax),
      total: decimal(base + tax),
      cost: decimal(cost),
      taxes: Object.values(groups).map((g) => ({
        ...g,
        base: decimal(g.base),
        amount: decimal(g.amount),
      })),
    };
  }
  window.InvoiceMoney = Object.freeze({ units, decimal, round, calculate });
})();
