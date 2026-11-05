const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createShortcutManager, normalizeShortcut } = require('./shortcut-manager.cjs');

function setup(options = {}) {
  const registered = new Map();
  const writes = [];
  let killed = 0;
  let toggles = 0;
  const manager = createShortcutManager({
    platform: 'win32',
    globalShortcut: {
      register: (key, callback) => { if (key === 'Control+Alt+X') return false; registered.set(key, callback); return true; },
      unregister: key => registered.delete(key),
    },
    startWinAlt: async (callback, onExit, key = 'Super+Alt') => { registered.set(key, callback); return () => { killed++; registered.delete(key); }; },
    read: () => 'Super+Alt', write: key => writes.push(key), onToggle: () => toggles++,
    ...options,
  });
  return { manager, registered, writes, killed: () => killed, toggles: () => toggles };
}

test('Win+Alt is the default and works without showing a window', async () => {
  const s = setup();
  await s.manager.init();
  assert.equal(s.manager.getState().accelerator, 'Super+Alt');
  assert.equal(s.manager.getState().registered, true);
  s.registered.get('Super+Alt')();
  assert.equal(s.toggles(), 1);
  s.manager.dispose();
  assert.equal(s.killed(), 1);
});

test('conflicting shortcut leaves previous shortcut and disk settings intact', async () => {
  const s = setup();
  await s.manager.init();
  await assert.rejects(s.manager.set('Control+Alt+X'), /занято/);
  assert.equal(s.manager.getState().accelerator, 'Super+Alt');
  assert.equal(s.killed(), 0);
  assert.deepEqual(s.writes, []);
});

test('successful replacement persists then releases the previous registration', async () => {
  const s = setup();
  await s.manager.init();
  await s.manager.set('Control+Shift+R');
  assert.equal(s.manager.getState().registered, true);
  assert.equal(s.manager.getState().accelerator, 'Control+Shift+R');
  assert.deepEqual(s.writes, ['Control+Shift+R']);
  assert.equal(s.killed(), 1);
  s.registered.get('Control+Shift+R')();
  assert.equal(s.toggles(), 1);
});

test('disk failure disposes candidate but keeps working old shortcut', async () => {
  const s = setup({ write: () => { throw new Error('disk full'); } });
  await s.manager.init();
  await assert.rejects(s.manager.set('Control+Shift+R'), /disk full/);
  assert.equal(s.registered.has('Control+Shift+R'), false);
  assert.equal(s.registered.has('Super+Alt'), true);
});

test('validation allows Win+Alt and ordinary modified shortcuts, rejects plain and invalid keys', () => {
  assert.equal(normalizeShortcut('Win+Alt'), 'Super+Alt');
  assert.equal(normalizeShortcut('Ctrl+Alt+R'), 'Control+Alt+R');
  for (const key of ['R', 'Alt', 'Control+Alt', '', 'Control+Bogus', 'Super+Alt+R+T']) assert.throws(() => normalizeShortcut(key));
});

test('helper startup failure is visible instead of pretending registration succeeded', async () => {
  const s = setup({ startWinAlt: async () => { throw new Error('Hook failed'); } });
  const state = await s.manager.init();
  assert.equal(state.registered, false);
  assert.match(state.error, /Hook failed/);
});

test('changing shortcut during slow native startup preserves latest user selection', async () => {
  let ready;
  const s = setup({ startWinAlt: (_callback, _onExit, key) => key === 'Super+Alt'
    ? new Promise(resolve => { ready = () => resolve(() => {}); }) : Promise.resolve(() => {}) });
  const initialized = s.manager.init();
  // Let initialization begin while the Windows helper compiles.
  await new Promise(resolve => setImmediate(resolve));
  const changed = s.manager.set('Control+Shift+R');
  ready();
  await Promise.all([initialized, changed]);
  assert.equal(s.manager.getState().accelerator, 'Control+Shift+R');
  assert.deepEqual(s.writes, ['Control+Shift+R']);
});

test('custom Windows shortcut ignores keydown and toggles only through native release event', async () => {
  let pressed, released, toggles = 0;
  const manager = createShortcutManager({
    platform: 'win32', read: () => 'Control+Shift+R', write() {}, onToggle: () => toggles++,
    globalShortcut: { register: (_key, callback) => { pressed = callback; return true; }, unregister() {} },
    startWinAlt: async (callback, _onExit, key) => { assert.equal(key, 'Control+Shift+R'); released = callback; return () => {}; },
  });
  await manager.init();
  pressed();
  assert.equal(toggles, 0);
  released();
  assert.equal(toggles, 1);
  manager.dispose();
});
