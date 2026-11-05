const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createRecordingOverlay } = require('./recording-overlay.cjs');

function setup() {
  const windows = [], timers = new Map();
  let counter = 0;
  class Window extends EventEmitter {
    constructor(options) { super(); this.options = options; this.sent = []; this.shown = 0; this.hidden = 0; this.webContents = { send: (...args) => this.sent.push(args) }; windows.push(this); }
    loadFile() {}
    setAlwaysOnTop(...args) { this.top = args; }
    setIgnoreMouseEvents(value) { this.clickThrough = value; }
    setBounds(value) { this.bounds = value; }
    showInactive() { this.shown++; }
    hide() { this.hidden++; }
    destroy() { this.destroyed = true; }
    isDestroyed() { return Boolean(this.destroyed); }
  }
  const overlay = createRecordingOverlay({
    BrowserWindow: Window,
    screen: { getCursorScreenPoint: () => ({ x: 1200, y: 300 }), getDisplayNearestPoint: () => ({ workArea: { x: 1000, y: 0, width: 1200, height: 900 } }) },
    setTimer: callback => { const id = ++counter; timers.set(id, callback); return id; },
    clearTimer: id => timers.delete(id),
  });
  return { overlay, windows, timers };
}

test('recording overlay waits for readiness, stays above windows and never takes focus', () => {
  const s = setup();
  s.overlay.update('IDLE');
  assert.equal(s.windows.length, 0);
  s.overlay.update('RECORDING');
  const w = s.windows[0];
  assert.equal(w.options.focusable, false);
  assert.equal(w.options.skipTaskbar, true);
  assert.equal(w.clickThrough, true);
  assert.equal(w.shown, 0);
  w.emit('ready-to-show');
  assert.equal(w.shown, 1);
  assert.equal(w.top[0], true);
  assert.equal(w.sent.at(-1)[1].status, 'RECORDING');
  assert.ok(w.bounds.x >= 1000 && w.bounds.x < 2200);
});

test('stop indication persists during recognition, ready hides later, new recording cancels timer', () => {
  const s = setup();
  s.overlay.update('RECORDING');
  const w = s.windows[0];
  w.emit('ready-to-show');
  s.overlay.update('PROCESSING');
  assert.equal(w.sent.at(-1)[1].status, 'PROCESSING');
  assert.equal(s.timers.size, 0);
  s.overlay.update('COMPLETED');
  assert.equal(s.timers.size, 1);
  s.overlay.update('RECORDING');
  assert.equal(s.timers.size, 0);
  assert.equal(w.sent.at(-1)[1].status, 'RECORDING');
  s.overlay.update('ERROR');
  [...s.timers.values()][0]();
  assert.equal(w.hidden, 1);
  s.overlay.dispose();
  assert.equal(w.destroyed, true);
});

test('expired result does not reappear when the overlay finishes loading late', () => {
  const s = setup();
  s.overlay.update('COMPLETED');
  const w = s.windows[0];
  [...s.timers.values()][0]();
  w.emit('ready-to-show');
  assert.equal(w.shown, 0);
});
