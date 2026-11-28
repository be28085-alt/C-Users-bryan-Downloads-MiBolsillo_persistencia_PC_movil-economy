'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { parseArgs } = require('node:util');

const ROOT = path.resolve(__dirname, '../..');
const ENTRIES = ['index.html', 'desktop.html', 'mobile.html'];
const DEFAULT_COMPLEXITY_THRESHOLD = 20;
const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);
const BRANCH_TYPES = new Set([
  'IfStatement',
  'ConditionalExpression',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'CatchClause',
  'LogicalExpression',
  'AssignmentPattern',
]);

/** Resuelve el parser que ya usa ESLint; no incorpora otro analizador de producción. */
function parser() {
  const eslintRequire = createRequire(require.resolve('eslint'));
  return eslintRequire('espree');
}

/**
 * Ejecuta Git sin shell y solo devuelve metadatos o fuentes previamente admitidas.
 * @param {string[]} args Argumentos separados; nunca un comando interpolado.
 * @returns {string} Salida UTF-8, sin ejecutarla como código.
 */
function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Enumera fuentes propias; nunca desciende por enlaces simbólicos o datos privados. */
function filesIn(directory) {
  return fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(relative);
    return entry.isFile() ? [relative] : [];
  });
}

/**
 * Selecciona el código cliente declarado en las entradas y los scripts del servidor.
 * @param {string|null} reference Revisión opcional, resuelta antes a un commit.
 * @returns {{revision: string, files: string[], read: Function}} Fuentes y lector restringido.
 * No lee respaldos, SQLite, secretos, dependencias, vendor ni código archivado.
 */
function sources(reference = null) {
  const revision = reference
    ? git(['rev-parse', '--verify', '--end-of-options', reference + '^{commit}']).trim()
    : null;
  if (revision && !/^[a-f0-9]{40,64}$/.test(revision)) throw new Error('Revisión no válida.');
  const available = revision
    ? git(['ls-tree', '-r', '-z', '--name-only', revision, '--', 'src', 'scripts', ...ENTRIES])
        .split('\0')
        .filter(Boolean)
    : [...filesIn('src'), ...filesIn('scripts'), ...ENTRIES];
  const sourcePath = (file) =>
    ENTRIES.includes(file) ||
    /^src\/(?!vendor\/)[^\\]+\.js$/.test(file) ||
    /^scripts\/(?!quality\/)[^\\]+\.cjs$/.test(file);
  const admitted = new Set(available.filter(sourcePath));
  const read = (file) => {
    if (!admitted.has(file) || file.split('/').some((part) => part === '..')) {
      throw new Error('Fuente fuera del alcance.');
    }
    return revision
      ? git(['show', revision + ':' + file])
      : fs.readFileSync(path.join(ROOT, file), 'utf8');
  };
  const client = new Set();
  for (const entry of ENTRIES) {
    for (const match of read(entry).matchAll(/<script\b[^>]*\bsrc\s*=\s*(['"])([^'"]+)\1/gi)) {
      const file = match[2].split(/[?#]/)[0];
      if (file.startsWith('src/') && admitted.has(file)) client.add(file);
    }
  }
  const server = [...admitted].filter(
    (file) => file.startsWith('scripts/') && file.endsWith('.cjs'),
  );
  return { revision: revision || 'working-tree', files: [...client, ...server].sort(), read };
}

/** Determina el nombre y la posición documental sin inferir el significado del código. */
function declaration(node, ancestors) {
  const parent = ancestors.at(-1),
    grandparent = ancestors.at(-2);
  let anchor = node,
    name = node.id?.name || '<anónima>';
  const moduleWrapper =
    parent?.type === 'CallExpression' &&
    parent.callee === node &&
    grandparent?.type === 'ExpressionStatement' &&
    ancestors.length === 3 &&
    ancestors[0].type === 'Program';
  if (['Property', 'MethodDefinition'].includes(parent?.type)) {
    anchor = parent;
    name =
      parent.key.name || (typeof parent.key.value === 'string' ? parent.key.value : '<calculada>');
  } else if (parent?.type === 'VariableDeclarator') {
    anchor = grandparent?.type === 'VariableDeclaration' ? grandparent : parent;
    name = parent.id.name || '<desestructurada>';
  } else if (parent?.type === 'AssignmentExpression') {
    anchor = parent;
    name = parent.left.name || parent.left.property?.name || '<asignada>';
  } else if (
    parent?.type === 'CallExpression' &&
    parent.callee === node &&
    grandparent?.type === 'ExpressionStatement'
  ) {
    anchor = grandparent;
    name = moduleWrapper ? '<módulo IIFE>' : '<IIFE>';
  }
  return { anchor, name, moduleWrapper };
}

/** Solo cuenta bloques JSDoc inmediatamente asociados a la declaración o método. */
function hasJSDoc(comments, text, start) {
  for (let index = comments.length - 1; index >= 0; index--) {
    const comment = comments[index];
    if (comment.end > start) continue;
    return (
      comment.type === 'Block' &&
      comment.value.startsWith('*') &&
      text.slice(comment.end, start).trim() === ''
    );
  }
  return false;
}

/** Cuenta las bifurcaciones clásicas, sin atribuir a una función las de sus callbacks. */
function isBranch(node) {
  return (
    BRANCH_TYPES.has(node.type) ||
    (node.type === 'SwitchCase' && node.test !== null) ||
    (node.type === 'AssignmentExpression' && ['&&=', '||=', '??='].includes(node.operator)) ||
    (['MemberExpression', 'CallExpression'].includes(node.type) && node.optional === true)
  );
}

/**
 * Mide sintaxis, no ejecuta módulos, controladores ni cálculos financieros.
 * @param {string} source Texto propio que se analizará con Espree.
 * @param {string} file Ruta relativa únicamente para identificar el resultado.
 * @returns {object} Líneas físicas y funciones con complejidad/JSDoc.
 * @throws {SyntaxError} Si el texto no admite la gramática JavaScript configurada.
 */
function analyzeSource(source, file = '<fuente>') {
  const text = source.replace(/\r\n?/g, '\n');
  const ast = parser().parse(text, {
    ecmaVersion: 'latest',
    sourceType: 'script',
    loc: true,
    range: true,
    comment: true,
  });
  const functions = [],
    active = [];
  function visit(node, ancestors = []) {
    const enclosingStaticBlock = node.type === 'StaticBlock' ? active.splice(0) : null;
    const isFunction = FUNCTION_TYPES.has(node.type);
    if (isFunction) {
      const { anchor, name, moduleWrapper } = declaration(node, ancestors);
      const metric = {
        file,
        name,
        line: node.loc.start.line,
        lines: node.loc.end.line - node.loc.start.line + 1,
        complexity: 1,
        jsdoc: hasJSDoc(ast.comments || [], text, anchor.start),
        moduleWrapper,
      };
      functions.push(metric);
      active.push(metric);
    } else if (active.length && isBranch(node)) active.at(-1).complexity++;
    for (const [key, child] of Object.entries(node)) {
      if (['comments', 'tokens', 'loc', 'range'].includes(key)) continue;
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item.type === 'string') visit(item, [...ancestors, node]);
        }
      } else if (child && typeof child.type === 'string') {
        // Los inicializadores de campo son caminos implícitos independientes;
        // sus expresiones no pertenecen a la función que declara la clase.
        const enclosingInitializer =
          node.type === 'PropertyDefinition' && key === 'value' ? active.splice(0) : null;
        visit(child, [...ancestors, node]);
        if (enclosingInitializer) active.push(...enclosingInitializer);
      }
    }
    if (isFunction) active.pop();
    if (enclosingStaticBlock) active.push(...enclosingStaticBlock);
  }
  visit(ast);
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return {
    file,
    lines: lines.length,
    maxLineLength: Math.max(0, ...lines.map((line) => line.length)),
    functions,
  };
}

/** Construye un informe comparable; los errores de parseo se notifican sin volcar fuentes. */
function report({
  reference = null,
  threshold = DEFAULT_COMPLEXITY_THRESHOLD,
  details = false,
} = {}) {
  const selected = sources(reference),
    files = [],
    failures = [];
  for (const file of selected.files) {
    try {
      files.push(analyzeSource(selected.read(file), file));
    } catch (error) {
      failures.push({ file, line: error.lineNumber || null, code: 'parse-error' });
    }
  }
  const functions = files.flatMap((file) => file.functions);
  const nonModuleFunctions = functions.filter((fn) => !fn.moduleWrapper);
  const warned = functions.filter((fn) => fn.complexity > threshold);
  return {
    revision: selected.revision,
    definitions: {
      scope:
        'JS propios referenciados por las tres entradas y scripts CJS; excluye vendor, quality, tests, legacy, generado y datos privados.',
      lines:
        'Líneas físicas, incluidos comentarios y blancos; no demuestra calidad ni complejidad.',
      functions:
        'Declaraciones, expresiones y flechas; callbacks anidados se miden por separado. Se distinguen las IIFE de módulo para no confundir su extensión con un caso de uso.',
      complexity:
        'Clásica: 1 + if, ternario, bucle, catch, case no default, expresión/asignación lógica, valor por defecto y acceso/llamada opcional. No mide código fuera de funciones ni caminos implícitos de campos/bloques estáticos de clase.',
      jsdoc:
        'Bloque /** inmediatamente asociado a declaración, asignación o método; no valida tipos ni veracidad de su texto.',
      warnings:
        'Solo funciones por encima del umbral de complejidad; no son errores ni avisos del comando ESLint.',
    },
    summary: {
      files: files.length,
      physicalLines: files.reduce((total, file) => total + file.lines, 0),
      functions: functions.length,
      functionsWithJSDoc: functions.filter((fn) => fn.jsdoc).length,
      moduleWrappers: functions.length - nonModuleFunctions.length,
      nonModuleFunctionsWithJSDoc: nonModuleFunctions.filter((fn) => fn.jsdoc).length,
      maxNonModuleFunctionLines: Math.max(0, ...nonModuleFunctions.map((fn) => fn.lines)),
      maxFunctionLines: Math.max(0, ...functions.map((fn) => fn.lines)),
      maxComplexity: Math.max(0, ...functions.map((fn) => fn.complexity)),
      complexityThreshold: threshold,
      complexityWarnings: warned.length,
      parseErrors: failures.length,
    },
    files: files.map((file) => ({
      file: file.file,
      lines: file.lines,
      maxLineLength: file.maxLineLength,
      functions: file.functions.length,
      functionsWithJSDoc: file.functions.filter((fn) => fn.jsdoc).length,
      maxComplexity: Math.max(0, ...file.functions.map((fn) => fn.complexity)),
    })),
    complexFunctions: warned.sort(
      (first, second) =>
        second.complexity - first.complexity || first.file.localeCompare(second.file),
    ),
    parseErrors: failures,
    ...(details ? { functions } : {}),
  };
}

if (require.main === module) {
  try {
    const { values } = parseArgs({
      options: {
        ref: { type: 'string' },
        threshold: { type: 'string' },
        details: { type: 'boolean' },
      },
    });
    const threshold =
      values.threshold === undefined ? DEFAULT_COMPLEXITY_THRESHOLD : Number(values.threshold);
    if (!Number.isSafeInteger(threshold) || threshold < 1) throw new Error('Umbral inválido.');
    const result = report({
      reference: values.ref || null,
      threshold,
      details: values.details || false,
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.summary.parseErrors) process.exitCode = 1;
  } catch {
    console.error(
      'No se pudieron calcular las métricas. Usa --ref <commit> y --threshold <entero positivo>; instala primero las dependencias de desarrollo.',
    );
    process.exitCode = 1;
  }
}

module.exports = { analyzeSource, report };
