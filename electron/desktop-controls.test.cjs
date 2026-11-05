const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createDesktopControls } = require('./desktop-controls.cjs');

function setup(options = {}) {
  const app = new EventEmitter();
  const handlers = new Map();
  const listeners = new Map();
  const sent = [];
  const copied = [];
  let shown = 0, hidden = 0, quits = 0, stopped = 0;
  let hook;
  const window = new EventEmitter();
  window.isDestroyed = () => false;
  window.isMinimized = () => true;
  window.restore = () => {};
  window.show = () => shown++;
  window.focus = () => {};
  window.hide = () => hidden++;
  window.webContents = new EventEmitter();
  window.webContents.send = (...args) => sent.push(args);
  app.getPath = () => require('node:os').tmpdir();
  app.isReady = () => true;
  app.quit = () => { quits++; app.emit('before-quit'); app.emit('will-quit'); };
  class Tray extends EventEmitter { setContextMenu(menu) { this.menu = menu; } setToolTip(value) { this.tooltip = value; } setImage() {} }
  const trayInstances = [];
  const desktop = createDesktopControls({
    app, getWindow: () => window,
    ipcMain: { handle: (key, handler) => handlers.set(key, handler), on: (key, handler) => listeners.set(key, handler) },
    globalShortcut: { register: () => true, unregister() {}, unregisterAll() {} },
    Tray: class extends Tray { constructor(...args) { super(...args); trayInstances.push(this); } },
    Menu: { buildFromTemplate: menu => menu }, nativeImage: { createFromBitmap: () => 'icon' },
    clipboard: { writeText: value => copied.push(value) },
    startWinAlt: async callback => { hook = callback; return () => stopped++; },
    ...options,
  });
  return { app, desktop, window, handlers, listeners, sent, copied, trayInstances, hook: () => hook(), shown: () => shown, hidden: () => hidden, quits: () => quits, stopped: () => stopped };
}

test('secondary instance can quit before readiness without using globalShortcut', () => {
  const s = setup({ globalShortcut: {
    register() { assert.fail('Must not register before ready'); },
    unregister() { assert.fail('Must not unregister before ready'); },
    unregisterAll() { throw new Error('globalShortcut cannot be used before the app is ready'); },
  } });
  s.app.isReady = () => false;
  assert.doesNotThrow(() => s.app.quit());
  assert.equal(s.quits(), 1);
});

test('global toggle reaches hidden renderer without showing or focusing the window', async () => {
  const s = setup();
  await s.desktop.init();
  s.desktop.attach(s.window);
  let prevented = false;
  s.window.emit('close', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(s.hidden(), 1);
  s.hook();
  assert.deepEqual(s.sent.at(-1), ['recording:toggle', undefined]);
  assert.equal(s.shown(), 0);
});

test('tray reopens window and explicit exit releases shortcut and allows close', async () => {
  let unregistered = 0;
  const s = setup({ globalShortcut: { register: () => true, unregister() {}, unregisterAll() { unregistered++; } } });
  await s.desktop.init();
  s.desktop.attach(s.window);
  s.trayInstances[0].emit('double-click');
  assert.equal(s.shown(), 1);
  s.trayInstances[0].menu.at(-1).click();
  assert.equal(s.quits(), 1);
  assert.equal(s.stopped(), 1);
  assert.equal(unregistered, 1);
  s.window.emit('close', { preventDefault() { assert.fail('Quit must allow close'); } });
});

test('background clipboard accepts own renderer and rejects untrusted input', async () => {
  const s = setup();
  const write = s.handlers.get('clipboard:write-text');
  write({ sender: s.window.webContents }, 'Hidden transcript');
  assert.deepEqual(s.copied, ['Hidden transcript']);
  assert.throws(() => write({ sender: {} }, 'bad'));
  assert.throws(() => write({ sender: s.window.webContents }, {}));
});

test('automatic delivery copies before pasting, while manual copy never pastes', async () => {
  let s, pastes = 0;
  s = setup({ pasteText: async expectedHash => {
    assert.equal(s.copied.at(-1), 'Dictated text');
    assert.equal(expectedHash, require('node:crypto').createHash('sha256').update('Dictated text', 'utf16le').digest('hex'));
    pastes++;
    return { pasted: true };
  } });
  const event = { sender: s.window.webContents };
  const result = await s.handlers.get('clipboard:copy-and-paste')(event, 'Dictated text');
  assert.equal(result.pasted, true);
  assert.equal(pastes, 1);
  s.handlers.get('clipboard:write-text')(event, 'Manual copy');
  assert.equal(pastes, 1);
  await assert.rejects(async () => s.handlers.get('clipboard:copy-and-paste')({ sender: {} }, 'Untrusted'));
});

test('paste failure preserves clipboard and returns a copy-only fallback', async () => {
  const s = setup({ pasteText: async () => { throw new Error('Native helper failed'); } });
  const result = await s.handlers.get('clipboard:copy-and-paste')({ sender: s.window.webContents }, 'Transcript');
  assert.equal(result.copied, true);
  assert.equal(result.pasted, false);
  assert.deepEqual(s.copied, ['Transcript']);
});

test('recording status updates tray indicator and update installation allows quit', async () => {
  const s = setup();
  await s.desktop.init();
  s.desktop.attach(s.window);
  s.listeners.get('recording:status')({ sender: s.window.webContents }, 'RECORDING');
  assert.match(s.trayInstances[0].tooltip, /Идёт запись/);
  s.desktop.prepareQuit();
  s.window.emit('close', { preventDefault() { assert.fail('Update must allow close'); } });
});
