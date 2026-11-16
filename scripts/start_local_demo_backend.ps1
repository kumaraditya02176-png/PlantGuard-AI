$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'load_local_demo_env.ps1')

$python = Join-Path (Split-Path -Parent $projectRoot) '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    throw "The project Python environment was not found at $python."
}
$listener = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    throw 'Port 8001 is already in use. No process was stopped; inspect the listener before starting the backend.'
}

$env:PYTHONPATH = $projectRoot
Set-Location $projectRoot
& $python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001
