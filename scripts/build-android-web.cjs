// Empaqueta las entradas vigentes; no incluye históricos, pruebas ni datos del usuario.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist', 'android-web');
const copied = new Set();

/** Resuelve solo recursos locales dentro del paquete; no descarga dependencias remotas. */
function local(reference, parent) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return null;
  const file = path.posix.normalize(
    path.posix.join(path.posix.dirname(parent), reference.split(/[?#]/)[0]),
  );
  if (file.startsWith('../') || path.posix.isAbsolute(file)) {
    throw new Error('Ruta fuera del paquete: ' + file);
  }
  return file;
}

/** Escribe únicamente dentro de la salida generada, nunca en fuentes o datos privados. */
function write(file, data) {
  const destination = path.resolve(output, file);
  if (!destination.startsWith(output + path.sep)) throw new Error('Destino fuera del paquete');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, data);
}

/** Copia cada recurso una vez y recorre imports CSS sin incluir implementaciones archivadas. */
function copy(file) {
  if (copied.has(file)) return;
  if (file.startsWith('legacy/')) {
    throw new Error('Una entrada depende del código archivado: ' + file);
  }
  copied.add(file);
  const data = fs.readFileSync(path.join(root, file));
  write(file, data);
  if (file.endsWith('.css')) {
    for (const match of data
      .toString()
      .matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/g)) {
      const dependency = local(match[1] || match[2], file);
      if (dependency) copy(dependency);
    }
  }
}

// Solo se limpia el directorio generado conocido dentro del proyecto.
if (path.relative(root, output) !== path.join('dist', 'android-web')) {
  throw new Error('Directorio de salida inesperado');
}
fs.rmSync(output, { recursive: true, force: true });
for (const page of ['index.html', 'desktop.html', 'mobile.html']) {
  let html = fs.readFileSync(path.join(root, page), 'utf8');
  // Fuentes del sistema y Chart.js incluido: el arranque no depende de una CDN.
  html = html
    .replace(/<link\b[^>]*href=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/g, '')
    .replace('https://cdn.jsdelivr.net/npm/chart.js', 'vendor/chart.umd.js');
  for (const [, reference] of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const dependency = local(reference, page);
    if (dependency && !dependency.endsWith('.html') && dependency !== 'vendor/chart.umd.js') {
      copy(dependency);
    }
  }
  write(page, html);
}
write(
  'vendor/chart.umd.js',
  fs.readFileSync(path.join(root, 'node_modules/chart.js/dist/chart.umd.js')),
);
write(
  'vendor/chart.LICENSE.md',
  fs.readFileSync(path.join(root, 'node_modules/chart.js/LICENSE.md')),
);
copy('src/vendor/qrcode.LICENSE.txt');
console.log('Paquete Android web preparado: ' + path.relative(root, output));
