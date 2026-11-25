(function () {
  'use strict';
  // Unit selection describes the quantity already recorded; it never converts stock.
  const definitions = [
    ['UND', 'Unidades', 'und', ['unidad', 'unidades', 'und', 'uds', 'u']],
    ['KG', 'Kilogramos', 'kg', ['kilo', 'kilos', 'kilogramo', 'kilogramos', 'kg', 'kgs']],
    ['G', 'Gramos', 'g', ['gramo', 'gramos', 'g', 'gr', 'grs']],
    ['L', 'Litros', 'l', ['litro', 'litros', 'l', 'lt', 'lts']],
    ['ML', 'Mililitros', 'ml', ['mililitro', 'mililitros', 'ml']],
    ['M', 'Metros', 'm', ['metro', 'metros', 'm', 'mt', 'mts']],
    ['M2', 'Metros cuadrados', 'm²', ['metro cuadrado', 'metros cuadrados', 'm2', 'm²']],
    ['M3', 'Metros cúbicos', 'm³', ['metro cubico', 'metros cubicos', 'm3', 'm³']],
    ['PZA', 'Piezas', 'pza', ['pieza', 'piezas', 'pza', 'pzas']],
    ['PAQ', 'Paquetes', 'paq', ['paquete', 'paquetes', 'paq', 'pqt', 'pqte']],
    ['CAJA', 'Cajas', 'caja', ['caja', 'cajas', 'cja']],
    ['PAR', 'Pares', 'par', ['par', 'pares']]
  ];
  const key = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\./g, '').trim();
  const aliases = new Map();
  const catalog = Object.freeze(definitions.map(([code, label, symbol, names]) => {
    for (const name of [code, label, symbol, ...names]) aliases.set(key(name), code);
    return Object.freeze({ code, label, symbol });
  }));
  function normalize(value) {
    if (value !== undefined && value !== null && typeof value !== 'string') throw new Error('Selecciona una unidad de medida o escribe su nombre.');
    const text = String(value ?? '').trim();
    if (!text) return 'UND';
    if (text.length > 200 || /[\u0000-\u001f\u007f]/.test(text)) throw new Error('La unidad de medida debe tener hasta 200 caracteres y no contener caracteres de control.');
    return aliases.get(key(text)) || text;
  }
  function get(value) {
    const code = normalize(value);
    return catalog.find(item => item.code === code) || { code, label: code, symbol: code };
  }
  function options(value) {
    const entries = catalog.map(item => [item.code, `${item.label} (${item.symbol})`]);
    const current = normalize(value);
    if (!catalog.some(item => item.code === current)) entries.push([current, current]);
    return entries;
  }
  function formatQuantity(value, unit) {
    const quantity = Number(value ?? 0);
    const formatted = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 }).format(Number.isFinite(quantity) ? quantity : 0);
    return `${formatted} ${get(unit).symbol}`;
  }
  window.BusinessProductUnits = Object.freeze({ catalog, normalize, get, options, formatQuantity });
})();
