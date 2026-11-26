'use strict';
const fs = require('node:fs');
const path = require('node:path');

// POSIX modes apply at creation, before any private bytes are written. Windows
// uses the parent directory's NTFS ACL; mode bits do not replace that ACL.
function preparePrivateFile(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  let fd;
  try { fd = fs.openSync(filename, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') return false; throw error; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
  return true;
}

function createPrivateSnapshot(db, filename) {
  // VACUUM INTO accepts an empty destination. Reserve it exclusively so SQLite
  // cannot create the snapshot using a permissive process umask.
  if (!preparePrivateFile(filename)) throw new Error('El destino del respaldo ya existe; se conservó sin cambios.');
  try { db.prepare('VACUUM INTO ?').run(filename); }
  catch (error) {
    // Remove only our own incomplete newly-created file, never an existing copy.
    fs.unlinkSync(filename);
    throw error;
  }
}

module.exports = { preparePrivateFile, createPrivateSnapshot };
