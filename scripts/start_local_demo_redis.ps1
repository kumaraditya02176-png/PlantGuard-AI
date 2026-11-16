$ErrorActionPreference = 'Stop'

$docker = Get-Command docker.exe -ErrorAction SilentlyContinue
if (-not $docker) {
    throw 'Docker CLI is not installed. Install Docker Desktop to run the supported local Redis session store.'
}

function Invoke-DockerQuiet([string[]] $Arguments) {
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& $docker.Source @Arguments 2>$null)
        $exitCode = $LASTEXITCODE
        return [pscustomobject]@{ ExitCode = $exitCode; Output = $output }
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

$engine = Invoke-DockerQuiet -Arguments @('info', '--format', '{{.ServerVersion}}')
if ($engine.ExitCode -ne 0 -or $engine.Output.Count -eq 0) {
    throw 'Docker CLI is installed, but the Docker Engine is unavailable. Start Docker Desktop, wait until it is running, then retry.'
}

$containerName = 'plantguard-local-demo-redis'
$containerQuery = Invoke-DockerQuiet -Arguments @('ps', '-aq', '--filter', "name=^/$containerName$")
if ($containerQuery.ExitCode -ne 0) {
    throw 'Docker could not inspect local containers.'
}

if ($containerQuery.Output.Count -gt 0) {
    $imageResult = Invoke-DockerQuiet -Arguments @('inspect', '--format', '{{.Config.Image}}', $containerName)
    if ($imageResult.ExitCode -ne 0 -or $imageResult.Output -notcontains 'redis:7.4-alpine') {
        throw 'A container with the local PlantGuard Redis name exists but is not the expected Redis image. Inspect it manually; no container was removed.'
    }
    $state = Invoke-DockerQuiet -Arguments @('inspect', '--format', '{{.State.Running}}', $containerName)
    if ($state.ExitCode -ne 0) {
        throw 'Docker could not inspect the existing local Redis container.'
    }
    if ($state.Output -notcontains 'true') {
        $startResult = Invoke-DockerQuiet -Arguments @('start', $containerName)
        if ($startResult.ExitCode -ne 0) {
            throw 'The existing PlantGuard Redis container could not start. No other process was stopped.'
        }
    }
}
else {
    $portInUse = Test-NetConnection -ComputerName '127.0.0.1' -Port 6379 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($portInUse) {
        throw 'Port 6379 is already in use by another service. It was left untouched; inspect that service before starting local Redis.'
    }
    $arguments = @(
        'run', '--detach', '--name', $containerName,
        '--restart', 'unless-stopped',
        '--publish', '127.0.0.1:6379:6379',
        'redis:7.4-alpine', 'redis-server', '--save', '', '--appendonly', 'no'
    )
    $runResult = Invoke-DockerQuiet -Arguments $arguments
    if ($runResult.ExitCode -ne 0) {
        throw 'Redis could not start in Docker. Check Docker Desktop, image download access, and port 6379.'
    }
}

$publishedPort = Invoke-DockerQuiet -Arguments @('port', $containerName, '6379/tcp')
if ($publishedPort.ExitCode -ne 0 -or $publishedPort.Output -notcontains '127.0.0.1:6379') {
    throw 'Redis is not published exclusively on 127.0.0.1:6379. The container was left running for manual inspection.'
}

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $ping = Invoke-DockerQuiet -Arguments @('exec', $containerName, 'redis-cli', 'ping')
    if ($ping.ExitCode -eq 0 -and "$($ping.Output -join '')".Trim() -eq 'PONG') {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    throw 'The Redis container started but did not pass its Redis health check.'
}

$hostPortReady = Test-NetConnection -ComputerName '127.0.0.1' -Port 6379 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $hostPortReady) {
    throw 'Redis answered inside Docker, but 127.0.0.1:6379 is not reachable from Windows.'
}
Write-Host 'Redis is responding on 127.0.0.1:6379 and is not published on external interfaces.'
