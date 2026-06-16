# Деплой FastAPI-приложения на удалённый Linux-сервер (Windows PowerShell).
# Требуется OpenSSH Client (встроен в Windows 10/11).
#
# Использование:
#   1. Скопируйте .deploy.env.example -> .deploy.env и заполните
#   2. .\scripts\deploy.ps1
#   3. Первый раз на сервере: sudo bash scripts/server-bootstrap.sh /opt/utility-jkh

param(
    [switch]$BootstrapOnly,
    [string]$ConfigFile = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Get-DeployConfig {
    param([string]$Path)
    $cfg = @{}
    Get-Content $Path -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        $cfg[$key] = $val
    }
    return $cfg
}

$envPath = if ($ConfigFile) { $ConfigFile } else { Join-Path $Root ".deploy.env" }
if (-not (Test-Path $envPath)) {
    Write-Error "Файл $envPath не найден. Скопируйте .deploy.env.example в .deploy.env"
}

$C = Get-DeployConfig $envPath
$Host_ = $C["DEPLOY_HOST"]
$User = $C["DEPLOY_USER"]
$Port = if ($C["DEPLOY_PORT"]) { $C["DEPLOY_PORT"] } else { "22" }
$RemotePath = if ($C["DEPLOY_PATH"]) { $C["DEPLOY_PATH"] } else { "/opt/utility-jkh" }
$Service = if ($C["DEPLOY_SERVICE"]) { $C["DEPLOY_SERVICE"] } else { "utility-jkh" }
$SshKey = $C["DEPLOY_SSH_KEY"]
$HealthUrl = $C["DEPLOY_HEALTH_URL"]

if (-not $Host_ -or -not $User) {
    Write-Error "В .deploy.env должны быть заданы DEPLOY_HOST и DEPLOY_USER"
}

$Remote = "${User}@${Host_}"
$SshArgs = @("-p", $Port, "-o", "StrictHostKeyChecking=accept-new")
$ScpArgs = @("-P", $Port, "-o", "StrictHostKeyChecking=accept-new")
if ($SshKey) {
    $SshArgs += @("-i", $SshKey)
    $ScpArgs += @("-i", $SshKey)
}

if ($BootstrapOnly) {
    Write-Host "==> Running server bootstrap on $Remote ..."
    $bootstrap = Join-Path $Root "scripts\server-bootstrap.sh"
    if (-not (Test-Path $bootstrap)) { Write-Error "server-bootstrap.sh not found" }
    scp @ScpArgs $bootstrap "${Remote}:/tmp/server-bootstrap.sh"
    ssh @SshArgs $Remote "chmod +x /tmp/server-bootstrap.sh && sudo bash /tmp/server-bootstrap.sh '$RemotePath' '$Service'"
    exit 0
}

$Archive = Join-Path $env:TEMP "utility-jkh-deploy.tar.gz"
if (Test-Path $Archive) { Remove-Item $Archive -Force }

Write-Host "==> Building archive..."
$tarArgs = @(
    "-czf", $Archive,
    "--exclude=venv",
    "--exclude=__pycache__",
    "--exclude=*.pyc",
    "--exclude=.env",
    "--exclude=utility.db",
    "--exclude=.deploy.env",
    "--exclude=*.docx",
    "--exclude=.git",
    "--exclude=deploy.tar.gz",
    "-C", $Root,
    "app", "requirements.txt", "deploy",
    "scripts/remote-install.sh", "scripts/server-bootstrap.sh"
)
& tar @tarArgs
if ($LASTEXITCODE -ne 0) { Write-Error "tar failed (exit $LASTEXITCODE)" }

Write-Host "==> Uploading to ${Remote}:${RemotePath} ..."
ssh @SshArgs $Remote "mkdir -p '$RemotePath'"
scp @ScpArgs $Archive "${Remote}:/tmp/utility-jkh-deploy.tar.gz"

Write-Host "==> Installing on server..."
$remoteScript = @"
set -euo pipefail
mkdir -p '$RemotePath'
tar -xzf /tmp/utility-jkh-deploy.tar.gz -C '$RemotePath'
rm -f /tmp/utility-jkh-deploy.tar.gz
export DEPLOY_SERVICE='$Service'
bash '$RemotePath/scripts/remote-install.sh' '$RemotePath'
"@
ssh @SshArgs $Remote $remoteScript

Remove-Item $Archive -Force -ErrorAction SilentlyContinue

if ($HealthUrl) {
    Write-Host "==> Health check: $HealthUrl"
    Start-Sleep -Seconds 2
    try {
        Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 10 | Out-Null
        Write-Host "OK"
    } catch {
        Write-Warning "Health check failed: $_"
    }
}

Write-Host "==> Deploy finished: $Host_"
