'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { ESLint } = require('eslint');
const prettier = require('prettier');
const { analyzeSource } = require('../scripts/quality/metrics.cjs');

test('las métricas separan ramas de callbacks y reconocen documentación inmediata', () => {
  const result = analyzeSource(`
    /** Consulta sintética documentada. */
    function selectItems(value) {
      if (value) return [1].map(item => item > 0 ? item : 0);
      return [];
    }
  `);
  const outer = result.functions.find((fn) => fn.name === 'selectItems');
  assert.equal(outer.complexity, 2);
  assert.equal(outer.jsdoc, true);
  assert.equal(result.functions.length, 2);
  assert.equal(result.functions.find((fn) => fn !== outer).complexity, 2);
});

test('las métricas no cargan campos o bloques estáticos de clase a la función exterior', () => {
  const result = analyzeSource(`
    function containerFactory() {
      class Container {
        value = ready ? 1 : 0;
        static { if (ready) this.enabled = true; }
        read(value = 1) { return value?.amount ?? 0; }
      }
      return Container;
    }
  `);
  assert.equal(result.functions.find((fn) => fn.name === 'containerFactory').complexity, 1);
  assert.equal(result.functions.find((fn) => fn.name === 'read').complexity, 4);
  assert.throws(() => analyzeSource('function ('), SyntaxError);
});

test('los controles de calidad excluyen datos privados, terceros, generados y archivados', async () => {
  const lint = new ESLint();
  const excluded = [
    'database/synthetic.js',
    'src/vendor/qrcode.js',
    'dist/android-web/synthetic.js',
    'legacy/web/synthetic.js',
    'tmp/synthetic.js',
    'android/synthetic.js',
    'qt_app/synthetic.js',
  ];
  for (const file of excluded) {
    assert.equal(await lint.isPathIgnored(file), true, file);
    const info = await prettier.getFileInfo(file, {
      ignorePath: path.resolve(__dirname, '../.prettierignore'),
      resolveConfig: false,
    });
    assert.equal(info.ignored, true, file);
  }
  assert.equal(await lint.isPathIgnored('src/services/finanzasCore.js'), false);
});

test('lint detecta referencias indefinidas y variables abandonadas en código propio', async () => {
  const lint = new ESLint();
  const [result] = await lint.lintText(
    "'use strict'; const unusedEntry = 1; undefinedQualityDependency();",
    { filePath: path.resolve(__dirname, '../scripts/quality/synthetic.cjs') },
  );
  assert.ok(result.messages.some((message) => message.ruleId === 'no-unused-vars'));
  assert.ok(result.messages.some((message) => message.ruleId === 'no-undef'));
});
