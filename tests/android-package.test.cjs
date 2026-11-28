const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

test('el paquete Android conserva el código activo de PC/móvil y funciona sin recursos CDN', () => {
  execFileSync(process.execPath, ['scripts/build-android-web.cjs'], { cwd: root });
  const output = path.join(root, 'dist/android-web');
  for (const page of ['index.html', 'desktop.html', 'mobile.html']) {
    const original = fs.readFileSync(path.join(root, page), 'utf8');
    const packaged = fs.readFileSync(path.join(output, page), 'utf8');
    assert.ok(!/https:\/\/(?:fonts\.|cdn\.jsdelivr)/.test(packaged));
    for (const [, file] of original.matchAll(/<script\s+src="(src\/[^"?]+)/g)) {
      assert.deepEqual(
        fs.readFileSync(path.join(output, file)),
        fs.readFileSync(path.join(root, file)),
        file,
      );
    }
    for (const [, reference] of packaged.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
      if (/^(?:[a-z]+:|#|\/\/)/i.test(reference)) continue;
      assert.ok(fs.statSync(path.join(output, reference.split(/[?#]/)[0])).isFile(), reference);
    }
  }
  for (const forbidden of ['legacy', 'tests', 'database', 'tmp', '.git']) {
    assert.equal(fs.existsSync(path.join(output, forbidden)), false, forbidden);
  }
  assert.match(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), /account-access/);
  assert.match(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), /accountAccess\.js/);
  assert.deepEqual(
    fs.readFileSync(path.join(output, 'src/ui/shared/adaptiveEntry.js')),
    fs.readFileSync(path.join(root, 'src/ui/shared/adaptiveEntry.js')),
  );
  assert.match(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), /mibolsillo-app/);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json')));
  assert.equal(config.server.androidScheme, 'https');
  assert.equal(config.server.url, undefined, 'la app debe cargar los archivos incluidos');
});
