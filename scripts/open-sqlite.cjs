'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { openStore } = require('./serve-sqlite.cjs');

const database = path.resolve(process.env.MIBOLSILLO_DB_PATH || path.join(__dirname, '../database/mibolsillo.sqlite'));
if (!fs.existsSync(database)) openStore(database).close();
const candidates = [process.env.SQLITE_BROWSER_PATH,
  process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'DB Browser for SQLite', 'DB Browser for SQLite.exe'),
  process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'DB Browser for SQLite', 'DB Browser for SQLite.exe')];
const executable = candidates.find(file => file && fs.existsSync(file));
if (!executable) {
  console.error('No se encontró DB Browser. Defina SQLITE_BROWSER_PATH con la ruta a su ejecutable.');
  console.error('Base de datos: ' + database);
  process.exitCode = 1;
} else {
  const child = spawn(executable, [database], { detached: true, stdio: 'ignore', windowsHide: false });
  child.on('error', error => { console.error('No se pudo abrir DB Browser: ' + error.message); process.exitCode = 1; });
  child.unref();
  console.log('Abriendo ' + database);
}
