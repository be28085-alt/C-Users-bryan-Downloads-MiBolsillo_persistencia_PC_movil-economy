const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({}); context.window = context;
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/utils/businessNumbers.js'), 'utf8'), context);
const N = context.BusinessNumbers;

test('COP muestra miles, dos centavos y redondeo decimal exacto sin reinterpretar valores guardados', () => {
  for (const [value, expected] of [[10490, '10.490.00 COP'], ['11500.00', '11.500.00 COP'], ['4416.6667', '4.416.67 COP'], [10.49, '10.49 COP'], [11.5, '11.50 COP'], [0, '0.00 COP'], ['1.005', '1.01 COP'], ['-1.005', '-1.01 COP'], ['999.995', '1.000.00 COP'], [1e-7, '0.00 COP']]) assert.equal(N.formatMoney(value), expected);
  assert.equal(N.formatMoney('10490.00', false, ','), '10.490,00 COP');
  assert.equal(N.formatMoney('10490.00', true), '+10.490.00 COP');
  assert.equal(N.formatMoney('-0.004', true), '0.00 COP');
  assert.throws(() => N.formatMoney(Infinity));
  assert.throws(() => N.formatMoney('10.490,00'));
});

test('la entrada de importes distingue miles locales, centavos y datos numéricos canónicos', () => {
  for (const [input, expected] of [['10.490', '10490'], ['11.500', '11500'], ['4.416,67', '4416.67'], ['10.490,00', '10490.00'], ['10490.00', '10490.00'], ['10490', '10490'], ['10.49', '10.49'], [10.49, '10.49'], ['0,125', '0.125'], ['1.234,5678', '1234.5678'], ['1.000.000,01', '1000000.01'], ['10.490.00', '10490.00'], ['0001,50', '1.50']]) assert.equal(N.parseMoneyInput(input), expected);
  assert.equal(N.parseMoneyInput('', { allowEmpty: true }), '');
  assert.equal(N.parseMoneyInput('1.000,25', { scale: 2 }), '1000.25');
  assert.equal(N.parseMoneyInput('0.125'), '0.125');
  assert.equal(N.parseMoneyInput('0.1250'), '0.1250');
  assert.throws(() => N.parseMoneyInput('1,125', { scale: 2 }));
  for (const input of ['', '1,2,3', '1.23.456', '10.49,00', '1 000', '$ 10.490', '-1', '+1', 'NaN', 'Infinity', '1e3', '1.000,00001', '10,', '10.']) assert.throws(() => N.parseMoneyInput(input), input);
});

test('editar costos conserva cuatro decimales y las entradas generadas se pueden guardar sin cambiar su valor', () => {
  for (const value of ['10490', '10.49', '4416.6667', '0.125', '1.234', '4416.123', '123456789012.3456']) {
    const displayed = N.moneyInput(value);
    assert.equal(Number(N.parseMoneyInput(displayed)), Number(value), displayed);
  }
  assert.equal(N.moneyInput(10490), '10.490.00');
  assert.equal(N.moneyInput('4416.6667'), '4.416.6667');
  assert.equal(N.moneyInput('1.234'), '1.2340');
  assert.equal(N.moneyInput('4416.123'), '4.416.1230');
  assert.equal(N.moneyInput(''), '');
});

test('cantidades fraccionarias usan cuatro decimales sin convertir kilos o litros en miles', () => {
  assert.equal(N.parseQuantityInput('1.250'), '1.250');
  assert.equal(N.parseQuantityInput('1,250'), '1.250');
  assert.equal(N.parseQuantityInput('0,125'), '0.125');
  assert.equal(N.parseQuantityInput('19,25', { scale: 2 }), '19.25');
  assert.equal(N.quantityInput('1.2500'), '1.25');
  assert.equal(N.quantityInput('1000'), '1000');
  assert.equal(N.formatQuantity('1000.125'), '1.000,125');
  for (const value of ['1.000,50', '1,000.50', '0.00001', '-1', 'NaN']) assert.throws(() => N.parseQuantityInput(value));
});
