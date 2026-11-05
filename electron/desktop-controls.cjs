const fs = require('node:fs');
const path = require('node:path');
const { createShortcutManager } = require('./shortcut-manager.cjs');
const { startWinAlt } = require('./windows-hotkey.cjs');
const { pasteText } = require('./windows-paste.cjs');
const { createHash } = require('node:crypto');

function createDesktopControls({ app, ipcMain, globalShortcut, Tray, Menu, nativeImage, clipboard, getWindow, overlay, pasteText: paste = pasteText, startWinAlt: startModifierShortcut = startWinAlt }) {
  let tray;
  let quitting = false;
  const emit = (channel, value) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send(channel, value);
  };
  const show = () => {
    const window = getWindow();
    if (!window || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  };
  const settingsPath = () => path.join(app.getPath('userData'), 'recording-shortcut.json');
  const shortcuts = createShortcutManager({
    globalShortcut, startWinAlt: startModifierShortcut,
    read: () => {
      try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')).accelerator; }
      catch { return null; }
    },
    write: accelerator => {
      const target = settingsPath();
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(`${target}.tmp`, JSON.stringify({ accelerator }), 'utf8');
      fs.renameSync(`${target}.tmp`, target);
    },
    onToggle: () => emit('recording:toggle'),
    onState: state => emit('shortcut:state', state),
  });
  const ownRenderer = event => event.sender === getWindow()?.webContents;
  ipcMain.handle('shortcut:get', event => {
    if (!ownRenderer(event)) throw new Error('Unknown window');
    return shortcuts.getState();
  });
  ipcMain.handle('shortcut:set', (event, value) => {
    if (!ownRenderer(event)) throw new Error('Unknown window');
    return shortcuts.set(value);
  });
  ipcMain.handle('clipboard:write-text', (event, value) => {
    if (!ownRenderer(event) || typeof value !== 'string' || value.length > 2000000) throw new Error('Invalid clipboard request');
    clipboard.writeText(value);
  });
  ipcMain.handle('clipboard:copy-and-paste', async (event, value) => {
    if (!ownRenderer(event) || typeof value !== 'string' || !value.trim() || value.length > 2000000) throw new Error('Invalid paste request');
    clipboard.writeText(value);
    const expectedHash = createHash('sha256').update(value.replace(/\r\n/g, '\n'), 'utf16le').digest('hex');
    try { return { copied: true, ...await paste(expectedHash) }; }
    catch { return { copied: true, pasted: false, reason: 'helper-failed' }; }
  });
  ipcMain.on('recording:status', (event, status) => {
    if (!ownRenderer(event) || !tray) return;
    const labels = { RECORDING: 'Идёт запись', PROCESSING: 'Распознавание', IDLE: 'Готов к записи', COMPLETED: 'Текст готов', ERROR: 'Ошибка записи или распознавания' };
    if (!labels[status]) return;
    overlay?.update(status);
    tray.setImage(makeIcon(status === 'RECORDING'));
    tray.setToolTip(`Voice Scribe — ${labels[status]}`);
  });
  function makeIcon(recording = false) {
    const pixels = Buffer.alloc(16 * 16 * 4);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if ((x - 7.5) ** 2 + (y - 7.5) ** 2 > 56) continue;
      const mic = (x >= 6 && x <= 9 && y >= 3 && y <= 9) || (y === 11 && x >= 4 && x <= 11) || (x === 7 && y >= 11 && y <= 13);
      const offset = (y * 16 + x) * 4;
      pixels[offset] = mic ? 255 : recording ? 65 : 230;
      pixels[offset + 1] = mic ? 255 : recording ? 65 : 120;
      pixels[offset + 2] = mic ? 255 : recording ? 235 : 55;
      pixels[offset + 3] = 255;
    }
    return nativeImage.createFromBitmap(pixels, { width: 16, height: 16 });
  }
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => { overlay?.dispose(); shortcuts.dispose(); globalShortcut.unregisterAll(); });
  return {
    async init() {
      tray = new Tray(makeIcon());
      tray.setToolTip('Voice Scribe — Готов к записи');
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Открыть Voice Scribe', click: show },
        { label: 'Начать / остановить запись', click: () => emit('recording:toggle') },
        { type: 'separator' },
        { label: 'Выход', click: () => { quitting = true; app.quit(); } },
      ]));
      tray.on('double-click', show);
      return shortcuts.init();
    },
    attach(window) {
      window.on('close', event => { if (!quitting && tray) { event.preventDefault(); window.hide(); } });
      window.webContents.on('did-finish-load', () => emit('shortcut:state', shortcuts.getState()));
    },
    prepareQuit() { quitting = true; },
    show,
  };
}

module.exports = { createDesktopControls };
