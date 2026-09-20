$ErrorActionPreference = 'Stop'

$root = 'C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready'
$frontend = Join-Path $root 'frontend'
$venvPython = 'C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\.venv\Scripts\python.exe'
$npmCmd = (Get-Command npm.cmd).Source
$npmRunner = 'C:\Program Files\nodejs\npm.cmd'

if (-not (Test-Path $root)) {
    throw "Authoritative workspace not found: $root"
}

if (-not (Test-Path $venvPython)) {
    throw "Workspace-local Python environment is missing: $venvPython"
}

if (-not (Test-Path $npmRunner)) {
    throw "npm PowerShell launcher not found: $npmRunner"
}

Set-Location $root
$env:PYTHONPATH = $root

function Stop-PlantGuardProcesses {
    $matches = Get-CimInstance Win32_Process |
        Where-Object {
            $_.Name -match 'node|python' -and (
                $_.CommandLine -match 'C:\\Users\\ADITYA\\Downloads\\PlantGuard-AI-Codex-Ready1.0\\PlantGuard-AI-Codex-Ready' -or
                $_.CommandLine -match 'next dev' -or
                $_.CommandLine -match 'uvicorn' -or
                $_.CommandLine -match 'backend.app.main:app'
            )
        }

    foreach ($p in $matches) {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

Stop-PlantGuardProcesses

$ports = @(3000, 8001)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($c in $connections) {
            $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
            if ($proc) {
                $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($c.OwningProcess)").CommandLine
                if ($cmd -match 'PlantGuard|next dev|uvicorn|backend.app.main:app') {
                    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
}

$backendProc = Start-Process -FilePath $venvPython -ArgumentList @('-m','uvicorn','backend.app.main:app','--host','127.0.0.1','--port','8001') -WorkingDirectory $root -PassThru -NoNewWindow
Start-Sleep -Seconds 2

$frontendProc = Start-Process -FilePath $npmRunner -ArgumentList @('run','dev','--','--hostname','127.0.0.1','--port','3000') -WorkingDirectory $frontend -PassThru -NoNewWindow

Write-Host "Authoritative workspace root: $root"
Write-Host "Workspace Python: $venvPython"
Write-Host "Backend PID: $($backendProc.Id)"
Write-Host "Frontend PID: $($frontendProc.Id)"
Write-Host "Frontend: http://127.0.0.1:3000"
Write-Host "Backend: http://127.0.0.1:8001"
Write-Host "Health check: http://127.0.0.1:8001/health"
