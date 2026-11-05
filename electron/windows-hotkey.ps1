param([int]$ParentProcessId = 0, [switch]$CompileOnly, [string]$Shortcut = 'Super+Alt')
$ErrorActionPreference = 'Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'windows-hotkey.cs')
if (-not $CompileOnly) {
    [VoiceScribeHotkey]::Run($ParentProcessId, $Shortcut)
}
