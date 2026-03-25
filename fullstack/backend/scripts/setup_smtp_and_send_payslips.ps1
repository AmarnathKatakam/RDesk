Param(
    [Parameter(Mandatory=$true)] [string]$EmailHost,
    [Parameter(Mandatory=$true)] [int]$EmailPort,
    [Parameter(Mandatory=$false)] [bool]$EmailUseTLS = $true,
    [Parameter(Mandatory=$false)] [bool]$EmailUseSSL = $false,
    [Parameter(Mandatory=$true)] [string]$EmailUser,
    [Parameter(Mandatory=$true)] [string]$EmailPassword,
    [Parameter(Mandatory=$true)] [string]$FromEmail,
    [Parameter(Mandatory=$false)] [string]$TestRecipient = "",
    [Parameter(Mandatory=$true)] [int[]]$EmployeeIds,
    [Parameter(Mandatory=$true)] [string]$Month,
    [Parameter(Mandatory=$true)] [string]$Year,
    [Parameter(Mandatory=$false)] [string]$SalaryType = "Monthly",
    [Parameter(Mandatory=$false)] [string]$ApiBase = "http://127.0.0.1:8000",
    [Parameter(Mandatory=$false)] [switch]$StartServer
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info($msg){ Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg){ Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg){ Write-Host "[ERROR] $msg" -ForegroundColor Red }

# 1) Move to backend dir
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $BackendDir
Write-Info "Backend directory: $BackendDir"

# 2) Backup and write .env
if (Test-Path .env) { Copy-Item .env .env.backup -Force; Write-Info "Backed up .env to .env.backup" }

$envContent = @"
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=$EmailHost
EMAIL_PORT=$EmailPort
EMAIL_USE_TLS=$EmailUseTLS
EMAIL_USE_SSL=$EmailUseSSL
EMAIL_HOST_USER=$EmailUser
EMAIL_HOST_PASSWORD=$EmailPassword
DEFAULT_FROM_EMAIL=$FromEmail
"@

$envContent | Out-File -Encoding utf8 -NoNewline .env
Write-Info ".env written with SMTP settings"

# 3) Activate venv
$VenvActivate = Resolve-Path (Join-Path $BackendDir "..\venv\Scripts\Activate.ps1")
if (-not (Test-Path $VenvActivate)) { Write-Err "Virtualenv not found at $VenvActivate"; exit 1 }
. $VenvActivate
Write-Info "Virtualenv activated"

# 4) Optionally start server if not running
function Test-PortOpen([string]$Host, [int]$Port){
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($Host, $Port, $null, $null)
        $success = $iar.AsyncWaitHandle.WaitOne(500)
        if ($success -and $client.Connected) { $client.EndConnect($iar); $client.Close(); return $true } else { $client.Close(); return $false }
    } catch { return $false }
}

$uri = [Uri]$ApiBase
if ($StartServer -or -not (Test-PortOpen $uri.Host $uri.Port)) {
    Write-Warn "Server not detected on $($uri.Host):$($uri.Port). Starting Django dev server..."
    $serverLog = Join-Path $BackendDir "server.log"
    Start-Process -FilePath python -ArgumentList "manage.py","runserver","$($uri.Host):$($uri.Port)" -RedirectStandardOutput $serverLog -RedirectStandardError $serverLog -WindowStyle Hidden
    # Wait until port opens or timeout
    $timeout = [DateTime]::UtcNow.AddSeconds(20)
    while ((-not (Test-PortOpen $uri.Host $uri.Port)) -and ([DateTime]::UtcNow -lt $timeout)) { Start-Sleep -Seconds 1 }
    if (-not (Test-PortOpen $uri.Host $uri.Port)) { Write-Err "Server failed to start within timeout"; exit 1 }
    Write-Info "Server is up. Logs: $serverLog"
} else {
    Write-Info "Server already running at $ApiBase"
}

# 5) Optional: send a test email
if ($TestRecipient -and $TestRecipient.Trim().Length -gt 0) {
    Write-Info "Sending test email to $TestRecipient"
    python manage.py sendtestemail $TestRecipient | Out-Null
}

# 6) Trigger payslip generation via API
$body = @{ employee_ids = $EmployeeIds; pay_period = @{ month = $Month; year = $Year }; salary_type = $SalaryType } | ConvertTo-Json -Depth 4
Write-Info "Triggering payslip generation for $Month $Year (employees: $($EmployeeIds -join ','))"
$response = Invoke-WebRequest -Method POST -Uri "$ApiBase/api/payslips/generate/" -ContentType "application/json" -Body $body -UseBasicParsing
Write-Host $response.StatusCode
Write-Host $response.Content

Write-Info "Done. Check backend/logs/django.log for email send results."


