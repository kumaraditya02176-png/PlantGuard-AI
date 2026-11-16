$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'load_local_demo_env.ps1')

$docker = Get-Command docker.exe -ErrorAction SilentlyContinue
if (-not $docker) {
    throw 'Docker CLI is unavailable. Start the local Redis session store with .\scripts\start_local_demo_redis.ps1.'
}
$previousPreference = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    $redisPing = & $docker.Source exec plantguard-local-demo-redis redis-cli ping 2>$null
    $redisExitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $previousPreference
}
if ($redisExitCode -ne 0 -or "$redisPing".Trim() -ne 'PONG') {
    throw 'The local Redis container did not respond to PING. Start it with .\scripts\start_local_demo_redis.ps1.'
}
$redisPortReady = Test-NetConnection -ComputerName '127.0.0.1' -Port 6379 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $redisPortReady) {
    throw 'Redis is unavailable at 127.0.0.1:6379. Start it with .\scripts\start_local_demo_redis.ps1 before starting the frontend.'
}

try {
    $health = Invoke-WebRequest -Uri 'http://127.0.0.1:8001/health' -UseBasicParsing -TimeoutSec 5
}
catch {
    throw 'The FastAPI backend is unavailable at 127.0.0.1:8001. Start it with .\scripts\start_local_demo_backend.ps1 first.'
}
if ($health.StatusCode -ne 200) {
    throw "The FastAPI health check returned HTTP $($health.StatusCode)."
}

$listener = Get-NetTCPConnection -LocalPort 3102 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    throw 'Port 3102 is already in use. No process was stopped; inspect the listener before starting the frontend.'
}
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
    throw 'pnpm is not installed or is not available on PATH.'
}

Set-Location (Join-Path $projectRoot 'frontend')
& $pnpm.Source run dev:next -- --hostname 127.0.0.1 --port 3102
