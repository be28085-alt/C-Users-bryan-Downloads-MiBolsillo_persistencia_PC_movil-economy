'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const relative = file => path.relative(root, file).split(path.sep).join('/');
function files(directory, suffix) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const name = path.posix.join(directory, entry.name);
    return entry.isDirectory() ? files(name, suffix) : entry.isFile() && name.endsWith(suffix) ? [name] : [];
  });
}
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

/** El grafo cubre imports CommonJS literales; no confunde callbacks con ciclos. */
function commonJSGraph() {
  const graph = new Map(files('scripts', '.cjs').map(file => [file, []]));
  for (const [file, imports] of graph) {
    for (const match of source(file).matchAll(/\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g)) {
      if (!match[2].startsWith('.')) continue;
      let target;
      assert.doesNotThrow(() => { target = require.resolve(path.resolve(root, path.dirname(file), match[2])); }, `${file}: import inexistente ${match[2]}`);
      imports.push(relative(target));
    }
  }
  return graph;
}

test('los imports CommonJS del servidor se resuelven y no tienen ciclos', () => {
  const graph = commonJSGraph(), visited = new Set(), active = [];
  function visit(file) {
    assert.ok(!active.includes(file), `Ciclo de módulos: ${[...active, file].join(' -> ')}`);
    if (visited.has(file)) return;
    active.push(file);
    for (const target of graph.get(file) || []) if (graph.has(target)) visit(target);
    active.pop(); visited.add(file);
  }
  for (const file of graph.keys()) visit(file);
});

test('el backend privado no importa presentación y sus repositorios no dependen de HTTP', () => {
  for (const [file, imports] of commonJSGraph()) {
    for (const target of imports) assert.ok(!target.startsWith('src/ui/') && !/^src\/utils\/(desktop|mobile)\.js$/.test(target), `${file}: depende de presentación ${target}`);
    if (file.startsWith('scripts/backend/') && file.endsWith('repository.cjs')) {
      for (const target of imports) assert.ok(!/(?:controller|http-transport|serve-sqlite)\.cjs$/.test(target), `${file}: dependencia invertida hacia ${target}`);
      assert.doesNotMatch(source(file), /require\s*\(\s*['"]node:https?['"]\s*\)/, `${file}: transporte HTTP dentro del repositorio`);
    }
  }
});

test('los dominios conservan reglas independientes del DOM, transporte y almacenamiento', () => {
  // Son límites de acceso directo. Las pruebas funcionales verifican los contratos ejecutados.
  for (const file of files('src/domains', '.js')) {
    const code = source(file);
    assert.doesNotMatch(code, /\b(?:window\.)?document\s*\./, `${file}: acceso al DOM`);
    assert.doesNotMatch(code, /\b(?:window\.)?(?:fetch|XMLHttpRequest)\s*\(/, `${file}: transporte dentro del dominio`);
    assert.doesNotMatch(code, /\b(?:window\.)?(?:localStorage|sessionStorage)\s*(?:\.|\[)/, `${file}: persistencia dentro del dominio`);
    assert.doesNotMatch(code, /\b(?:pcApp|mobileApp)\s*\./, `${file}: dependencia de un controlador visual`);
  }
});

test('el adaptador de almacenamiento no conoce la fachada financiera concreta', () => {
  assert.doesNotMatch(source('src/storage/localStorage.js'), /\bwindow\.(?:Finanzas|MiBolsilloStore|MiBolsilloState)\b/, 'El almacenamiento debe comunicar confirmaciones mediante su contrato, sin modificar la fachada ni un store legado');
});

test('los scripts públicos no importan SQLite nativo ni módulos privados del servidor', () => {
  for (const file of files('src', '.js').filter(file => !file.startsWith('src/vendor/'))) {
    const code = source(file);
    assert.doesNotMatch(code, /\brequire\s*\(\s*['"](?:node:|[^'"]*scripts\/backend\/)/, `${file}: módulo privado en código público`);
    assert.doesNotMatch(code, /\b(?:new\s+DatabaseSync|sqlite3_open|sqlite3_exec)\b/, `${file}: acceso directo al motor nativo`);
  }
});

test('los controladores visuales usan servicios sin transporte ni Web Storage directos', () => {
  for (const file of ['src/utils/desktop.js', 'src/utils/mobile.js']) {
    const code = source(file);
    assert.doesNotMatch(code, /\b(?:window\.)?(?:fetch|XMLHttpRequest)\s*\(/, `${file}: transporte directo`);
    assert.doesNotMatch(code, /\b(?:window\.)?(?:localStorage|sessionStorage)\s*(?:\.|\[)/, `${file}: almacenamiento directo`);
  }
});

test('las entradas distribuibles solo referencian scripts públicos del cliente', () => {
  // Android copia las referencias de estas entradas; los módulos privados no se empaquetan.
  for (const page of ['index.html', 'desktop.html', 'mobile.html']) {
    for (const match of source(page).matchAll(/<script\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"]/gi)) {
      if (/^https?:\/\//i.test(match[1])) continue;
      const file = match[1].split(/[?#]/)[0];
      assert.ok(file.startsWith('src/') && file.endsWith('.js'), `${page}: script fuera del cliente público ${file}`);
    }
  }
});

/** Puerto SQLite simulado en memoria: no importa servidor ni abre archivos de datos. */
function isolatedStorage() {
  let raw = JSON.stringify({ revision: 'remote-1', updatedAt: '2026-11-27T12:00:00Z', updatedBy: 'synthetic-other-client',
    data: { usuario: { nombre: 'Persona ficticia', email: 'architecture@example.test' }, movimientos: [], saldoInicial: 10 } });
  let writes = 0;
  const messages = [];
  const backend = {
    getItem: () => raw,
    refresh: async () => raw,
    async setItem(key, next, expected) {
      assert.equal(expected, raw, 'la escritura debe partir de la revisión confirmada');
      writes++; raw = next;
    }
  };
  const context = vm.createContext({
    MiBolsilloSQLiteConfig: { user: { id: 999 }, allowLegacyImport: false },
    MiBolsilloSQLiteBackend: backend,
    crypto: { randomUUID: () => 'synthetic-storage-client' },
    console: { error: message => messages.push(message), warn: message => messages.push(message) },
    addEventListener() {}, dispatchEvent() {},
    localStorage: { getItem() { throw new Error('La prueba no admite fallback a Web Storage.'); } }
  });
  context.window = context;
  vm.runInContext(source('src/storage/localStorage.js'), context, { filename: 'src/storage/localStorage.js' });
  const storage = context.FinanzasStorage;
  const initial = storage.loadState({});
  return { storage, initial, messages, get raw() { return raw; }, get writes() { return writes; }, replace(envelope) { raw = JSON.stringify(envelope); } };
}

test('los observers reciben copias, pueden cancelarse y sus errores de status no falsean un COMMIT', async () => {
  const fixture = isolatedStorage(), received = [], unaffected = [];
  assert.throws(() => fixture.storage.subscribe(null), /debe ser una función/);
  const unsubscribe = fixture.storage.subscribe(event => {
    received.push(event.type);
    if (event.type === 'persistence') event.result.ok = 'mutado por el consumidor';
  });
  fixture.storage.subscribe(event => { if (event.type === 'persistence') unaffected.push(event.result); });
  fixture.storage.subscribe(() => { throw new Error('SYNTHETIC_PRIVATE_LISTENER_ERROR'); });
  assert.equal(await fixture.storage.saveState({ ...fixture.initial, saldoInicial: 20 }, { keepPending: false }), true);
  assert.equal(fixture.writes, 1); assert.equal(JSON.parse(fixture.raw).data.saldoInicial, 20);
  assert.equal(fixture.storage.getPersistenceStatus().ok, true);
  assert.equal(unaffected.at(-1).ok, true, 'un consumidor no modifica el evento del siguiente');
  assert.ok(fixture.messages.length > 0);
  assert.equal(fixture.messages.join(' ').includes('SYNTHETIC_PRIVATE_LISTENER_ERROR'), false);
  unsubscribe(); const previousEvents = received.length;
  assert.equal(await fixture.storage.saveState({ ...fixture.initial, saldoInicial: 30 }, { keepPending: false }), true);
  assert.equal(received.length, previousEvents); assert.equal(fixture.writes, 2);
});

test('un observer de estado fallido bloquea la escritura obsoleta y permite recuperar tras cancelarlo', async () => {
  const fixture = isolatedStorage(), stateEvents = [], accepted = [];
  fixture.storage.subscribe(event => {
    if (event.type !== 'state') return;
    stateEvents.push(event.data);
    event.data.usuario.nombre = 'Mutación privada del primer consumidor';
  });
  const unsubscribe = fixture.storage.subscribe(event => { if (event.type === 'state') throw new Error('SYNTHETIC_REJECTED_STATE'); });
  fixture.storage.subscribe(event => { if (event.type === 'state') accepted.push(event.data); });
  const remote = { revision: 'remote-2', updatedAt: '2026-11-27T12:01:00Z', updatedBy: 'synthetic-other-client', data: { ...fixture.initial, saldoInicial: 40 } };
  fixture.replace(remote);
  assert.equal(await fixture.storage.refreshFromBackend(), false);
  assert.equal(await fixture.storage.saveState(fixture.initial, { keepPending: false }), false);
  assert.equal(fixture.writes, 0); assert.equal(JSON.parse(fixture.raw).data.saldoInicial, 40);
  assert.equal(accepted[0].usuario.nombre, 'Persona ficticia');
  unsubscribe();
  assert.equal(await fixture.storage.refreshFromBackend(), true);
  assert.equal(stateEvents.length, 2, 'la revisión rechazada sigue pendiente de aplicación');
  assert.equal(await fixture.storage.saveState({ ...accepted.at(-1), saldoInicial: 50 }, { keepPending: false }), true);
  assert.equal(fixture.writes, 1); assert.equal(JSON.parse(fixture.raw).data.saldoInicial, 50);
});
