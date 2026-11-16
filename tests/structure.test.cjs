const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pages = ['index.html', 'desktop.html', 'mobile.html'];

function localFile(from, reference) {
  if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return null;
  const url = new URL(reference.replace(/&amp;/g, '&'), `http://localhost/${from}`);
  const file = decodeURIComponent(url.pathname).replace(/^\//, '');
  const absolute = path.resolve(root, file);
  assert.ok(absolute.startsWith(root + path.sep), `${from}: ruta fuera del proyecto: ${reference}`);
  assert.ok(fs.statSync(absolute, { throwIfNoEntry: false })?.isFile(), `${from}: falta ${file}`);
  return file;
}

test('las tres entradas conservan sus enlaces, scripts y estilos locales', () => {
  const checkedStyles = new Set();
  function checkStyle(file) {
    if (checkedStyles.has(file)) return;
    checkedStyles.add(file);
    const css = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/g)) {
      const target = localFile(file, match[1] || match[2]);
      if (target?.endsWith('.css')) checkStyle(target);
    }
  }
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    for (const [, reference] of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
      const file = localFile(page, reference);
      if (!file) continue;
      assert.ok(!file.startsWith('legacy/'), `${page}: dependencia de una implementación archivada: ${file}`);
      if (file.endsWith('.css')) checkStyle(file);
    }
  }
  checkStyle('legacy/web/desktop.css');
  checkStyle('legacy/web/mobile.css');
});

test('PC y móvil mantienen el mismo núcleo y su controlador propio', () => {
  function scripts(page) {
    return [...fs.readFileSync(path.join(root, page), 'utf8').matchAll(/<script\s+src="([^"?]+)/g)]
      .map(match => match[1]).filter(source => source.startsWith('src/'));
  }
  const desktop = scripts('desktop.html'), mobile = scripts('mobile.html');
  assert.ok(desktop.includes('src/utils/desktop.js'));
  assert.ok(mobile.includes('src/utils/mobile.js'));
  assert.equal(new Set(desktop).size, desktop.length, 'PC carga un script dos veces');
  assert.equal(new Set(mobile).size, mobile.length, 'Móvil carga un script dos veces');
  assert.deepEqual(
    desktop.filter(file => file !== 'src/utils/desktop.js'),
    mobile.filter(file => file !== 'src/utils/mobile.js')
  );
});
