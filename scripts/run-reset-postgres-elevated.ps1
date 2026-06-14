# Self-elevating launcher for reset-postgres-dev.ps1
$script = Join-Path $PSScriptRoot 'reset-postgres-dev.ps1'
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)

if ($isAdmin) {
  & $script
  exit $LASTEXITCODE
}

$proc = Start-Process powershell `
  -Verb RunAs `
  -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" `
  -Wait `
  -PassThru

exit $proc.ExitCode
