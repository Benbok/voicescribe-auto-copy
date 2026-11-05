const { spawn } = require('node:child_process');
const path = require('node:path');

function startWinAlt(onToggle, onExit, accelerator = 'Super+Alt') {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'windows-hotkey.ps1'), '-ParentProcessId', String(process.pid), '-Shortcut', accelerator], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let ready = false;
    let disposed = false;
    let buffer = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Не удалось запустить обработчик клавиш. Перезапустите приложение или используйте кнопку записи.')); }, 15000);
    const dispose = () => { disposed = true; clearTimeout(timer); child.kill(); };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) {
        if (line === 'ready' && !ready) { ready = true; clearTimeout(timer); resolve(dispose); }
        else if (line === 'toggle' && ready && !disposed) onToggle();
      }
    });
    // Consume compile diagnostics without retaining console output or key information.
    child.stderr.resume();
    child.on('error', () => { clearTimeout(timer); reject(new Error('Не удалось запустить PowerShell для Win+Alt.')); });
    child.on('exit', () => {
      clearTimeout(timer);
      if (!ready) reject(new Error('Обработчик клавиш завершился до запуска. Перезапустите приложение или используйте кнопку записи.'));
      else if (!disposed) onExit('Обработчик Win+Alt остановлен. Сохраните сочетание повторно.');
    });
  });
}

module.exports = { startWinAlt };
