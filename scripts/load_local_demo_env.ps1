$ErrorActionPreference = 'Stop'

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'This local demo configuration requires Windows DPAPI.'
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$settingsPath = Join-Path $projectRoot '.plantguard-local-demo.json'
if (-not (Test-Path -LiteralPath $settingsPath)) {
    throw 'Local demo authentication is not configured. Run .\scripts\setup_local_demo.ps1 first.'
}

try {
    $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
}
catch {
    throw 'The local demo configuration could not be read. Re-run the setup script to replace it.'
}
if ($settings.version -ne 1) {
    throw 'The local demo configuration version is unsupported. Re-run the setup script.'
}

function Unprotect-LocalValue([string] $encryptedValue) {
    try {
        $secureValue = ConvertTo-SecureString $encryptedValue
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
        try {
            return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
            $secureValue.Dispose()
        }
    }
    catch {
        throw 'Windows could not decrypt the local demo configuration. Use the same Windows account that created it.'
    }
}

$operatorUsername = Unprotect-LocalValue ([string]$settings.username_dpapi)
$passwordHash = Unprotect-LocalValue ([string]$settings.password_hash_dpapi)
$mutationToken = Unprotect-LocalValue ([string]$settings.mutation_token_dpapi)
if ([string]::IsNullOrWhiteSpace($operatorUsername) -or
    $operatorUsername.Length -gt 128 -or
    $passwordHash -notmatch '^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$' -or
    $mutationToken.Length -lt 32) {
    throw 'The local demo configuration is incomplete or invalid. Re-run the setup script.'
}

$env:PLANTGUARD_OPERATOR_USERNAME = $operatorUsername
$env:PLANTGUARD_OPERATOR_PASSWORD_HASH = $passwordHash
$env:PLANTGUARD_MUTATION_TOKEN = $mutationToken
$env:PLANTGUARD_SESSION_STORE_URL = 'redis://127.0.0.1:6379/0'
$env:PLANTGUARD_AUTH_ENV = 'development'
$env:PLANTGUARD_PUBLIC_ORIGIN = 'http://127.0.0.1:3102'
$env:PLANTGUARD_COOKIE_SECURE = 'false'
$env:PLANTGUARD_API_URL = 'http://127.0.0.1:8001'
$env:PLANTGUARD_TRUST_PROXY = 'false'
$env:PLANTGUARD_ENV = 'development'
$env:PLANTGUARD_CORS_ORIGINS = 'http://127.0.0.1:3102'

$operatorUsername = $null
$passwordHash = $null
$mutationToken = $null
$settings = $null
