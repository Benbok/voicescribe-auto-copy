param([int]$ExcludedProcessId = 0, [switch]$CompileOnly, [string]$ExpectedTextHash = '')
$ErrorActionPreference = 'Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'windows-paste.cs')
if (-not $CompileOnly) {
    Write-Output ([VoiceScribePaste]::Paste($ExcludedProcessId, $ExpectedTextHash))
}
