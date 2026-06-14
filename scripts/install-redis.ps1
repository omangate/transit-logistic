$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$redisDir = Join-Path $root 'infra\redis'
$server = Join-Path $redisDir 'redis-server.exe'

if (Test-Path $server) {
  Write-Host "Redis already installed at $server"
  exit 0
}

New-Item -ItemType Directory -Force -Path $redisDir | Out-Null
$zip = Join-Path $env:TEMP 'Redis-x64.zip'
Invoke-WebRequest -Uri 'https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip' -OutFile $zip
Expand-Archive -Path $zip -DestinationPath $redisDir -Force
Remove-Item $zip -Force
Write-Host "Redis installed at $server"
