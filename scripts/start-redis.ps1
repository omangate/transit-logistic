$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$redisDir = Join-Path $root 'infra\redis'
$server = Join-Path $redisDir 'redis-server.exe'
$conf = Join-Path $redisDir 'redis.conf'
$dataDir = Join-Path $redisDir 'data'

if (-not (Test-Path $server)) {
  Write-Error "Redis not found at $server. Run: pnpm run redis:install"
  exit 1
}

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

$existing = Get-NetTCPConnection -LocalPort 6379 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Redis already listening on port 6379 (PID $($existing.OwningProcess))"
  exit 0
}

Start-Process -FilePath $server -ArgumentList $conf -WorkingDirectory $redisDir -WindowStyle Hidden
Start-Sleep -Seconds 2

$ready = Get-NetTCPConnection -LocalPort 6379 -State Listen -ErrorAction SilentlyContinue
if ($ready) {
  Write-Host "Redis started on port 6379"
} else {
  Write-Error "Failed to start Redis"
  exit 1
}
