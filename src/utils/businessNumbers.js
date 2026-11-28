(function () {
  'use strict';

  // Presentation accepts canonical model values only. Localized text is parsed
  // separately, at the form boundary, so a saved 10.49 remains ten pesos 49.
  const inputError = (scale) =>
    new Error(`Número inválido: usa separadores de miles completos y máximo ${scale} decimales.`);
  function checkScale(scale) {
    if (!Number.isInteger(scale) || scale < 0 || scale > 8) {
      throw new Error('Precisión numérica inválida.');
    }
  }
  function expandNumber(value) {
    if (!Number.isFinite(value)) throw new Error('El importe debe ser un número finito.');
    const text = String(value);
    if (!/[eE]/.test(text)) return text;
    const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
    const digits = match[2] + (match[3] || ''),
      point = match[2].length + Number(match[4]);
    return (
      match[1] +
      (point <= 0
        ? `0.${'0'.repeat(-point)}${digits}`
        : point >= digits.length
          ? digits + '0'.repeat(point - digits.length)
          : `${digits.slice(0, point)}.${digits.slice(point)}`)
    );
  }
  function canonical(value, negative = true) {
    const text = typeof value === 'number' ? expandNumber(value) : String(value ?? '0').trim();
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
    if (!match || (!negative && match[1]) || match[2].length > 32 || (match[3] || '').length > 32) {
      throw new Error('Importe decimal inválido.');
    }
    return {
      negative: Boolean(match[1]),
      whole: match[2].replace(/^0+(?=\d)/, ''),
      fraction: match[3] || '',
    };
  }
  function scaled(value, scale) {
    const parts = canonical(value),
      fraction = parts.fraction.padEnd(scale, '0');
    let amount =
      BigInt(parts.whole) * 10n ** BigInt(scale) + BigInt(fraction.slice(0, scale) || '0');
    if (fraction.length > scale && fraction[scale] >= '5') amount += 1n;
    return { amount, negative: parts.negative && amount !== 0n };
  }
  function partsAtScale(value, scale) {
    const result = scaled(value, scale),
      digits = result.amount.toString().padStart(scale + 1, '0');
    return {
      ...result,
      whole: scale ? digits.slice(0, -scale) : digits,
      fraction: scale ? digits.slice(-scale) : '',
    };
  }
  const group = (whole) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  function separator(value) {
    if (![',', '.'].includes(value)) throw new Error('Separador decimal inválido.');
    return value;
  }
  function formatMoney(value, signed = false, decimalSeparator = '.') {
    const result = partsAtScale(value, 2);
    const sign = result.negative ? '-' : signed && result.amount > 0n ? '+' : '';
    return `${sign}${group(result.whole)}${separator(decimalSeparator)}${result.fraction} COP`;
  }
  function moneyInput(value, scale = 4, decimalSeparator = '.') {
    checkScale(scale);
    if (value === '' || value === null || value === undefined) return '';
    const result = partsAtScale(value, scale);
    let fraction = result.fraction.replace(/0+$/, '');
    if (scale >= 2) fraction = fraction.padEnd(2, '0');
    // With a dot decimal separator, three fraction digits resemble a thousands
    // group. Keep the fourth digit so editing never changes 1.234 into 1234.
    if (decimalSeparator === '.' && fraction.length === 3) fraction += '0';
    return `${result.negative ? '-' : ''}${group(result.whole)}${fraction ? separator(decimalSeparator) + fraction : ''}`;
  }
  function resultText(whole, fraction, scale) {
    if (fraction.length > scale || whole.length > 16) throw inputError(scale);
    return `${whole.replace(/^0+(?=\d)/, '')}${fraction ? '.' + fraction : ''}`;
  }
  function parseMoneyInput(value, { scale = 4, allowEmpty = false } = {}) {
    checkScale(scale);
    if (typeof value === 'number' || typeof value === 'bigint') {
      const parts = canonical(value, false);
      return resultText(parts.whole, parts.fraction, scale);
    }
    const text = String(value ?? '').trim();
    if (!text && allowEmpty) return '';
    if (!text || text.length > 80) throw inputError(scale);
    // Colombian grouping is recognized only when the groups are complete.
    // Thus "10.490" means 10490, while "10.49" remains a decimal amount.
    let match = /^([1-9]\d{0,2}(?:\.\d{3})+)(?:,(\d+))?$/.exec(text);
    if (match) return resultText(match[1].replace(/\./g, ''), match[2] || '', scale);
    match = /^(\d+),(\d+)$/.exec(text);
    if (match) return resultText(match[1], match[2], scale);
    // Also accept the optional requested display style "10.490.00".
    match = /^([1-9]\d{0,2}(?:\.\d{3})+)\.(\d{1,2}|\d{4})$/.exec(text);
    if (match) return resultText(match[1].replace(/\./g, ''), match[2], scale);
    match = /^(\d+)(?:\.(\d+))?$/.exec(text);
    if (!match) throw inputError(scale);
    return resultText(match[1], match[2] || '', scale);
  }
  function parseQuantityInput(value, { scale = 4, allowEmpty = false } = {}) {
    checkScale(scale);
    if (typeof value === 'number' || typeof value === 'bigint') {
      const parts = canonical(value, false);
      return resultText(parts.whole, parts.fraction, scale);
    }
    const text = String(value ?? '').trim();
    if (!text && allowEmpty) return '';
    const match = /^(\d+)(?:[.,](\d+))?$/.exec(text);
    if (!match) throw inputError(scale);
    return resultText(match[1], match[2] || '', scale);
  }
  function quantityInput(value, scale = 4) {
    checkScale(scale);
    if (value === '' || value === null || value === undefined) return '';
    const result = partsAtScale(value, scale),
      fraction = result.fraction.replace(/0+$/, '');
    return `${result.negative ? '-' : ''}${result.whole}${fraction ? '.' + fraction : ''}`;
  }
  function formatQuantity(value, { maximumFractionDigits = 4 } = {}) {
    checkScale(maximumFractionDigits);
    const result = partsAtScale(value, maximumFractionDigits),
      fraction = result.fraction.replace(/0+$/, '');
    return `${result.negative ? '-' : ''}${group(result.whole)}${fraction ? ',' + fraction : ''}`;
  }

  window.BusinessNumbers = Object.freeze({
    formatMoney,
    parseMoneyInput,
    moneyInput,
    parseQuantityInput,
    quantityInput,
    formatQuantity,
  });
})();
