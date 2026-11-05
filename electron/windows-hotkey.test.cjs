const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('actual Windows chord detector handles order, repeats, third keys and repeated toggles', { skip: process.platform !== 'win32' }, () => {
  // Compile and exercise the real C# state machine without installing a keyboard hook.
  const result = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
    & $env:VOICE_SCRIBE_HOOK_TEST -CompileOnly
    $release = New-Object WinAltChord
    if ($release.Feed(91, $true)) { throw 'Must not trigger on Win down' }
    if ($release.Feed(164, $true)) { throw 'Must not trigger on Alt down' }
    if ($release.Feed(164, $false)) { throw 'Must wait until both keys are released' }
    if (-not $release.Feed(91, $false)) { throw 'Must trigger on final release' }
    $custom = New-Object ReleaseChord -ArgumentList 'Control+Shift+R'
    foreach ($key in @(162,160,82,-82,-160)) {
      if ($custom.Feed([Math]::Abs($key), $key -gt 0)) { throw 'Custom shortcut triggered before full release' }
    }
    if (-not $custom.Feed(162, $false)) { throw 'Custom shortcut failed on release' }
    function Count-Toggles($keys) {
      $chord = New-Object WinAltChord
      $count = 0
      foreach ($key in $keys) { if ($chord.Feed([Math]::Abs($key), $key -gt 0)) { $count++ } }
      return $count
    }
    $cases = @(
      @{ keys = @(91,164,-164,-91); expected = 1 },
      @{ keys = @(164,91,-91,-164); expected = 1 },
      @{ keys = @(92,165,165,165,-165,-92); expected = 1 },
      @{ keys = @(91,164,82,-82,-164,-91); expected = 0 },
      @{ keys = @(162,91,164,-164,-91,-162); expected = 0 },
      @{ keys = @(91,164,-164,164,-164,-91); expected = 1 },
      @{ keys = @(91,164,-164,-91,91,164,-91,-164); expected = 2 }
    )
    foreach ($case in $cases) { if ((Count-Toggles $case.keys) -ne $case.expected) { throw 'Chord test failed' } }
    Write-Output 'PASS'
  `], { encoding: 'utf8', windowsHide: true, env: { ...process.env, VOICE_SCRIBE_HOOK_TEST: path.join(__dirname, 'windows-hotkey.ps1') } });
  assert.match(result, /PASS/);
});
