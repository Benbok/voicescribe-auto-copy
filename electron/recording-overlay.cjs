const path = require('node:path');
const WIDTH = 272;
const HEIGHT = 88;
const MARGIN = 24;

function createRecordingOverlay({ BrowserWindow, screen, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let window = null;
  let ready = false;
  let state = { status: 'IDLE', startedAt: 0 };
  let timer = null;
  let disposed = false;
  const cancelHide = () => { if (timer !== null) clearTimer(timer); timer = null; };
  function render() {
    if (!ready || !window || window.isDestroyed() || state.status === 'IDLE') return;
    window.webContents.send('overlay:state', state);
    window.showInactive();
  }
  function ensureWindow() {
    if (window && !window.isDestroyed()) return;
    ready = false;
    window = new BrowserWindow({
      width: WIDTH, height: HEIGHT, show: false, frame: false,
      transparent: true, resizable: false, movable: false,
      focusable: false, skipTaskbar: true, alwaysOnTop: true,
      hasShadow: false, backgroundColor: '#00000000',
      webPreferences: { preload: path.join(__dirname, 'overlay-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false },
    });
    window.setAlwaysOnTop(true, 'screen-saver');
    window.setIgnoreMouseEvents(true);
    window.once('ready-to-show', () => { ready = true; render(); });
    window.loadFile(path.join(__dirname, 'overlay.html'));
  }
  function position() {
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    window.setBounds({ x: area.x + Math.max(0, area.width - WIDTH - MARGIN), y: area.y + Math.max(0, area.height - HEIGHT - MARGIN), width: WIDTH, height: HEIGHT });
  }
  return {
    update(status) {
      if (disposed || !['IDLE', 'RECORDING', 'PROCESSING', 'COMPLETED', 'ERROR'].includes(status)) return;
      const previous = state.status;
      if (status === previous) return;
      state = { status, startedAt: status === 'RECORDING' ? Date.now() : state.startedAt };
      cancelHide();
      if (status === 'IDLE') { if (window && !window.isDestroyed()) window.hide(); return; }
      ensureWindow();
      if (status === 'RECORDING' || !state.startedAt) position();
      render();
      if (status === 'COMPLETED' || status === 'ERROR') timer = setTimer(() => {
        if (window && !window.isDestroyed()) window.hide();
        // Prevent a delayed ready-to-show from reviving an expired message.
        state = { ...state, status: 'IDLE' };
        timer = null;
      }, status === 'ERROR' ? 4500 : 2500);
    },
    dispose() { disposed = true; cancelHide(); if (window && !window.isDestroyed()) window.destroy(); window = null; },
  };
}

module.exports = { createRecordingOverlay };
