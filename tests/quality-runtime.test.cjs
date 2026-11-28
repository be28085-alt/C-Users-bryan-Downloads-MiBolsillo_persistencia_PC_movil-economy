'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/** Adaptadores y canal en RAM; esta prueba no importa servidor ni abre bases. */
function storageFixture({ sqlite = false, failBroadcast = false } = {}) {
  let raw = JSON.stringify({
    version: 'FINANZAS_V2',
    revision: 'initial',
    updatedAt: '2026-11-28T12:00:00Z',
    updatedBy: 'another-synthetic-client',
    data: {
      usuario: { nombre: 'Persona ficticia', email: 'quality@example.test' },
      movimientos: [],
      saldoInicial: 10,
    },
  });
  let writes = 0;
  const warnings = [],
    messages = [],
    channels = [];
  class SyntheticChannel {
    constructor() {
      this.listeners = new Map();
      channels.push(this);
    }
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    }
    postMessage(message) {
      messages.push(message);
      if (failBroadcast) throw new Error('PRIVATE_SYNTHETIC_BROADCAST_ERROR');
    }
  }
  const localStorage = {
    getItem: () => raw,
    setItem(_storageKey, next) {
      writes++;
      raw = next;
    },
  };
  const backend = {
    getItem: () => raw,
    refresh: async () => raw,
    async setItem(_storageKey, next, expected) {
      assert.equal(expected, raw);
      writes++;
      raw = next;
    },
  };
  const context = vm.createContext({
    ...(sqlite
      ? {
          MiBolsilloSQLiteConfig: { user: { id: 999 }, allowLegacyImport: false },
          MiBolsilloSQLiteBackend: backend,
        }
      : {}),
    localStorage,
    BroadcastChannel: SyntheticChannel,
    crypto: { randomUUID: () => 'quality-synthetic-client' },
    console: {
      warn: (message) => warnings.push(message),
      error: (message) => warnings.push(message),
    },
    addEventListener() {},
    dispatchEvent() {},
  });
  context.window = context;
  const source = fs.readFileSync(path.join(__dirname, '../src/storage/localStorage.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'src/storage/localStorage.js' });
  const storage = context.FinanzasStorage,
    initial = storage.loadState({});
  return {
    storage,
    initial,
    warnings,
    messages,
    get raw() {
      return raw;
    },
    get writes() {
      return writes;
    },
    replace(envelope) {
      raw = JSON.stringify(envelope);
    },
    receive(envelope) {
      return channels[0].listeners.get('message')({ data: { type: 'STATE_UPDATED', ...envelope } });
    },
  };
}

for (const sqlite of [false, true]) {
  test(`la difusión fallida no falsea una escritura confirmada en ${sqlite ? 'SQLite' : 'navegador'}`, async () => {
    const fixture = storageFixture({ sqlite, failBroadcast: true });
    const candidate = { ...fixture.initial, saldoInicial: 20 };

    assert.equal(await fixture.storage.saveState(candidate, { keepPending: false }), true);

    assert.equal(fixture.writes, 1);
    assert.equal(JSON.parse(fixture.raw).data.saldoInicial, 20);
    assert.equal(fixture.storage.getPersistenceStatus().ok, true);
    assert.equal(fixture.messages.length, 1);
    assert.equal(fixture.messages[0].type, 'STATE_UPDATED');
    assert.equal(
      Boolean(fixture.messages[0].data),
      !sqlite,
      'SQLite solo anuncia revisión; el modo histórico conserva el sobre',
    );
    assert.equal(fixture.warnings.length, 1);
    assert.equal(fixture.warnings.join(' ').includes('PRIVATE_SYNTHETIC_BROADCAST_ERROR'), false);
    assert.equal(fixture.warnings.join(' ').includes('quality@example.test'), false);
  });
}

test('un fallo de proyección recibido por canal se informa sin rechazo suelto ni escritura obsoleta', async () => {
  const fixture = storageFixture();
  const unsubscribe = fixture.storage.subscribe((event) => {
    if (event.type === 'state') throw new Error('PRIVATE_SYNTHETIC_PROJECTION_ERROR');
  });
  const remote = {
    version: 'FINANZAS_V2',
    revision: 'remote',
    updatedAt: '2026-11-28T12:01:00Z',
    updatedBy: 'another-synthetic-client',
    data: { ...fixture.initial, saldoInicial: 40 },
  };
  fixture.replace(remote);

  await assert.doesNotReject(fixture.receive(remote));

  assert.equal(fixture.storage.getPersistenceStatus().ok, false);
  assert.equal(await fixture.storage.saveState(fixture.initial, { keepPending: false }), false);
  assert.equal(fixture.writes, 0);
  assert.equal(JSON.parse(fixture.raw).data.saldoInicial, 40);
  assert.equal(fixture.warnings.join(' ').includes('PRIVATE_SYNTHETIC_PROJECTION_ERROR'), false);

  unsubscribe();
  await fixture.receive(remote);
  assert.equal(fixture.storage.getPersistenceStatus().ok, true);
  assert.equal(
    await fixture.storage.saveState({ ...remote.data, saldoInicial: 50 }, { keepPending: false }),
    true,
  );
  assert.equal(fixture.writes, 1);
  assert.equal(JSON.parse(fixture.raw).data.saldoInicial, 50);
});
