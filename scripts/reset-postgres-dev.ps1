# Reset local PostgreSQL dev access when the postgres password is unknown.
# Temporarily enables trust auth on localhost, recreates dev credentials, then restores auth.

$ErrorActionPreference = 'Stop'

$logFile = Join-Path $PSScriptRoot 'reset-postgres-dev.log'
function Write-Log {
  param([string]$Message)
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
  Write-Host $line
  Add-Content -Path $logFile -Value $line
}

$pgData = 'C:\Program Files\PostgreSQL\16\data'
$pgHba = Join-Path $pgData 'pg_hba.conf'
$pgHbaBackup = Join-Path $pgData 'pg_hba.conf.transit-logistic-backup'
$psql = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
$serviceName = 'postgresql-x64-16'

$postgresPassword = 'postgres'
$appUser = 'transit'
$appPassword = 'transit_secret'
$appDb = 'transit_logistic'

if (-not (Test-Path $pgHba)) {
  throw "pg_hba.conf not found at $pgHba"
}

if (-not (Test-Path $psql)) {
  throw "psql not found at $psql"
}

function Invoke-Psql {
  param(
    [string]$Sql,
    [string]$User = 'postgres',
    [string]$Database = 'postgres',
    [string]$Password = $null,
  )
  if ($Password) { $env:PGPASSWORD = $Password }
  try {
    & $psql -U $User -h 127.0.0.1 -p 5432 -d $Database -v ON_ERROR_STOP=1 -c $Sql
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Set-TrustAuth {
  if (-not (Test-Path $pgHbaBackup)) {
    Copy-Item $pgHba $pgHbaBackup -Force
  }

  $content = Get-Content $pgHba -Raw
  $content = $content -replace '^(local\s+all\s+all\s+)scram-sha-256', '${1}trust'
  $content = $content -replace '^(host\s+all\s+all\s+127\.0\.0\.1/32\s+)scram-sha-256', '${1}trust'
  $content = $content -replace '^(host\s+all\s+all\s+::1/128\s+)scram-sha-256', '${1}trust'
  $content = $content -replace '^(local\s+replication\s+all\s+)scram-sha-256', '${1}trust'
  $content = $content -replace '^(host\s+replication\s+all\s+127\.0\.0\.1/32\s+)scram-sha-256', '${1}trust'
  $content = $content -replace '^(host\s+replication\s+all\s+::1/128\s+)scram-sha-256', '${1}trust'
  Set-Content -Path $pgHba -Value $content -NoNewline
}

function Restore-ScramAuth {
  if (Test-Path $pgHbaBackup) {
    Copy-Item $pgHbaBackup $pgHba -Force
  }
}

function Restart-PostgresService {
  try {
    Restart-Service -Name $serviceName -Force
  } catch {
    net stop $serviceName | Out-Null
    net start $serviceName | Out-Null
  }
  Start-Sleep -Seconds 3
}

function Reload-PostgresConfig {
  & 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' reload -D $pgData | Out-Null
}

Write-Log 'reset-postgres-dev.ps1 started'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
  Write-Log 'ERROR: not running as administrator'
  throw 'Run this script in an elevated PowerShell (Run as administrator).'
}

Write-Log 'Backing up pg_hba.conf and enabling temporary trust auth on localhost...'
Set-TrustAuth
try {
  Reload-PostgresConfig
} catch {
  Restart-PostgresService
}

try {
  Write-Log 'Resetting postgres superuser password...'
  Invoke-Psql "ALTER USER postgres WITH PASSWORD '$postgresPassword';"

  Write-Log 'Creating application role and database...'
  $roleSql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$appUser') THEN
    CREATE ROLE $appUser LOGIN PASSWORD '$appPassword';
  ELSE
    ALTER ROLE $appUser WITH LOGIN PASSWORD '$appPassword';
  END IF;
END
`$`$;
"@
  Invoke-Psql $roleSql

  $dbExists = & $psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$appDb'"
  if ($dbExists.Trim() -ne '1') {
    Invoke-Psql "CREATE DATABASE $appDb OWNER $appUser;"
  } else {
    Invoke-Psql "ALTER DATABASE $appDb OWNER TO $appUser;"
  }

  Invoke-Psql "GRANT ALL PRIVILEGES ON DATABASE $appDb TO $appUser;"

  Write-Log 'Verifying transit credentials...'
  Invoke-Psql -Sql 'SELECT current_user, current_database();' -User $appUser -Database $appDb -Password $appPassword

  Write-Log 'Dev database access restored.'
  Write-Log "postgres superuser password set to: $postgresPassword"
  Write-Log "app connection: postgresql://${appUser}:${appPassword}@localhost:5432/${appDb}"
}
finally {
  Write-Log 'Restoring scram-sha-256 auth and reloading PostgreSQL...'
  Restore-ScramAuth
  try {
    Reload-PostgresConfig
  } catch {
    Restart-PostgresService
  }
}

Write-Host ''
Write-Host 'Done. Log file:' $logFile
Write-Host 'postgres password: postgres'
Write-Host 'app DATABASE_URL: postgresql://transit:transit_secret@localhost:5432/transit_logistic'
Write-Host ''
Read-Host 'Press Enter to close this window'
