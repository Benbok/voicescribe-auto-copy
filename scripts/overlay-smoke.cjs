// Run with Electron, not Node. Renders the actual overlay without showing a window.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const profile = path.join(__dirname, '..', '.tmp', 'overlay-preview', 'profile');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setPath('sessionData', profile);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 272, height: 88, show: false, frame: false, transparent: true,
    focusable: false, skipTaskbar: true, alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, '..', 'electron', 'overlay-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    await window.loadFile(path.join(__dirname, '..', 'electron', 'overlay.html'));
    const output = path.join(__dirname, '..', '.tmp', 'overlay-preview');
    fs.mkdirSync(output, { recursive: true });
    for (const status of ['RECORDING', 'PROCESSING', 'COMPLETED', 'ERROR']) {
      window.webContents.send('overlay:state', { status, startedAt: Date.now() - 12000 });
      await new Promise(resolve => setTimeout(resolve, 100));
      const text = await window.webContents.executeJavaScript('document.getElementById("title").textContent');
      const expected = { RECORDING: 'Идёт запись', PROCESSING: 'Запись закончена', COMPLETED: 'Готово', ERROR: 'Не удалось обработать' };
      if (text !== expected[status]) throw new Error(`Overlay failed: ${status}`);
      if (window.isFocused()) throw new Error('Overlay unexpectedly focused');
      fs.writeFileSync(path.join(output, `${status.toLowerCase()}.png`), (await window.webContents.capturePage()).toPNG());
    }
    console.log('Overlay smoke: all four states render; hidden window did not take focus.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally { window.destroy(); app.exit(process.exitCode || 0); }
});
