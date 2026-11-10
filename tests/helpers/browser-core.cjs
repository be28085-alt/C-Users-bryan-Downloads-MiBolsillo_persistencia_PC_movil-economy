const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto, randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
function createLocks() {
  let queue = Promise.resolve();
  return { request(name, opts, callback) { const next = queue.then(callback); queue = next.catch(() => {}); return next; } };
}
function app(page = 'desktop.html', options = {}) {
  const disk = options.disk || new Map(), locks = options.locks || createLocks();
  let fail = false; const listeners = {};
  const context = vm.createContext({ console: { log() {}, warn() {}, error() {} }, TextEncoder, Uint8Array, URL, setTimeout, clearTimeout,
    crypto: { randomUUID, subtle: webcrypto.subtle }, navigator: { locks },
    document: { readyState: 'loading', addEventListener() {} },
    location: { origin: 'http://localhost:5500', pathname: `/${page}`, href: `http://localhost:5500/${page}` },
    localStorage: { getItem: k => disk.get(k) ?? null, setItem(k, v) { if (fail) throw new Error('QuotaExceededError'); disk.set(k, v); } },
    CustomEvent: class { constructor(type, args) { this.type = type; this.detail = args.detail; } },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); }, dispatchEvent(event) { (listeners[event.type] || []).forEach(fn => fn(event)); }
  }); context.window = context;
  for (const [, source] of fs.readFileSync(path.join(root, page), 'utf8').matchAll(/<script\s+src="([^"?]+)/g)) {
    if (!source.startsWith('src/') || ['src/utils/desktop.js', 'src/utils/mobile.js', 'src/ui/shared/persistenceStatus.js'].includes(source)) continue;
    vm.runInContext(fs.readFileSync(path.join(root, source), 'utf8'), context, { filename: source });
  }
  return { context, core: context.Finanzas, storage: context.FinanzasStorage, disk, locks, setFailure: v => { fail = v; } };
}
module.exports = { app, createLocks };
