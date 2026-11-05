const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('native paste helper compiles with correct Win32 INPUT layout without injecting keys', { skip: process.platform !== 'win32' }, () => {
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
    & $env:VOICE_SCRIBE_PASTE_TEST -CompileOnly
    $expected = 28
    if ([IntPtr]::Size -eq 8) { $expected = 40 }
    if ([VoiceScribePaste]::InputSize() -ne $expected) { throw 'Invalid INPUT layout' }
    $keys = [VoiceScribePaste]::BuildInputs()
    if ($keys.Length -ne 4) { throw 'Expected Ctrl+V down/up events only' }
    if ($keys[0].data.keyboard.vk -ne 17 -or $keys[1].data.keyboard.vk -ne 86) { throw 'Incorrect shortcut' }
    if ($keys[2].data.keyboard.flags -ne 2 -or $keys[3].data.keyboard.flags -ne 2) { throw 'Missing key releases' }
    if ([VoiceScribePaste]::TextHash("line1\r\nline2") -ne [VoiceScribePaste]::TextHash("line1\nline2")) { throw 'Line ending normalization mismatch' }
    if ([VoiceScribePaste]::TextHash('text') -eq [VoiceScribePaste]::TextHash('different')) { throw 'Clipboard hash must detect replacements' }
    Write-Output 'PASS'
  `], { encoding: 'utf8', windowsHide: true, env: { ...process.env, VOICE_SCRIBE_PASTE_TEST: path.join(__dirname, 'windows-paste.ps1') } });
  assert.match(output, /PASS/);
});
