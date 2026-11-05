const { execFile } = require('node:child_process');
const path = require('node:path');

function pasteText(expectedHash) {
  if (process.platform !== 'win32') return Promise.resolve({ pasted: false, reason: 'unsupported' });
  if (!/^[a-f0-9]{64}$/.test(expectedHash || '')) return Promise.resolve({ pasted: false, reason: 'clipboard-changed' });
  return new Promise(resolve => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'windows-paste.ps1'), '-ExcludedProcessId', String(process.pid), '-ExpectedTextHash', expectedHash], {
      windowsHide: true, timeout: 6000, maxBuffer: 4096,
    }, (error, stdout) => {
      const result = (stdout || '').trim();
      const known = ['pasted', 'no-target', 'own-window', 'keys-held', 'focus-changed', 'clipboard-changed', 'blocked'];
      const reason = !error && known.includes(result) ? result : 'helper-failed';
      resolve({ pasted: reason === 'pasted', reason });
    });
  });
}

module.exports = { pasteText };
