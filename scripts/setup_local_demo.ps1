$ErrorActionPreference = 'Stop'

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'This setup script requires Windows DPAPI.'
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$settingsPath = Join-Path $projectRoot '.plantguard-local-demo.json'
$hashGenerator = Join-Path $PSScriptRoot 'generate_operator_password_hash.mjs'
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) {
    throw 'Node.js is required to generate the operator password hash.'
}
if (-not (Test-Path -LiteralPath $hashGenerator)) {
    throw 'The existing operator password hash generator was not found.'
}

if (Test-Path -LiteralPath $settingsPath) {
    $confirmation = Read-Host 'Local demo credentials already exist. Type REPLACE to rotate them'
    if ($confirmation -cne 'REPLACE') {
        throw 'Credential setup was cancelled; the existing local configuration was not changed.'
    }
}

$operatorUsername = (Read-Host 'Operator username').Trim()
if ([string]::IsNullOrWhiteSpace($operatorUsername) -or $operatorUsername.Length -gt 128) {
    throw 'Operator username must contain between 1 and 128 characters.'
}

$securePassword = Read-Host 'Operator password (minimum 16 characters)' -AsSecureString
if ($securePassword.Length -lt 16 -or $securePassword.Length -gt 1024) {
    $securePassword.Dispose()
    throw 'Operator password must contain 16 to 1024 characters.'
}

$passwordPointer = [IntPtr]::Zero
$plainPassword = $null
$previousOutputEncoding = $OutputEncoding
try {
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $OutputEncoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
    $hashOutput = @($plainPassword | & $node.Source $hashGenerator --password-stdin)
    $hashExitCode = $LASTEXITCODE
}
finally {
    $OutputEncoding = $previousOutputEncoding
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    $plainPassword = $null
    $securePassword.Dispose()
}

if ($hashExitCode -ne 0) {
    throw 'Password hash generation failed. No local credentials were saved.'
}
$passwordHash = @($hashOutput | Where-Object {
    $_ -match '^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$'
}) | Select-Object -First 1
if (-not $passwordHash) {
    throw 'The password hash generator returned an invalid result. No local credentials were saved.'
}

$tokenBytes = New-Object byte[] 48
$random = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $random.GetBytes($tokenBytes)
    $mutationToken = [Convert]::ToBase64String($tokenBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}
finally {
    [Array]::Clear($tokenBytes, 0, $tokenBytes.Length)
    $random.Dispose()
}

function Protect-LocalValue([string] $value) {
    $secureValue = ConvertTo-SecureString $value -AsPlainText -Force
    try {
        return ConvertFrom-SecureString $secureValue
    }
    finally {
        $secureValue.Dispose()
    }
}

$settings = [ordered]@{
    version = 1
    username_dpapi = Protect-LocalValue $operatorUsername
    password_hash_dpapi = Protect-LocalValue $passwordHash
    mutation_token_dpapi = Protect-LocalValue $mutationToken
}
$json = ConvertTo-Json -InputObject $settings
$temporaryPath = Join-Path $projectRoot ('.plantguard-local-demo.' + [Guid]::NewGuid().ToString('N') + '.tmp')
try {
    [IO.File]::WriteAllText($temporaryPath, $json, (New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false))
    Move-Item -LiteralPath $temporaryPath -Destination $settingsPath -Force
}
finally {
    if (Test-Path -LiteralPath $temporaryPath) {
        Remove-Item -LiteralPath $temporaryPath -Force
    }
}

$operatorUsername = $null
$passwordHash = $null
$mutationToken = $null
$settings = $null
$json = $null
Write-Host 'Local demo authentication is configured. Secrets are protected with Windows DPAPI for this Windows user.'
Write-Host 'No password, password hash, or mutation token was displayed.'
Write-Host 'Restart the backend and frontend with their local demo startup scripts to load the new configuration.'
