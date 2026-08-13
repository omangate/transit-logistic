# Fix Railway API networking (502 / x-railway-fallback) after `railway login`.
# Usage (from repo root):
#   npx @railway/cli login
#   pwsh -File scripts/railway-fix-api-networking.ps1

$ErrorActionPreference = "Stop"

$Railway = "npx --yes @railway/cli"
$ProjectId = "c447c09c-0e6a-4d72-914d-c8b2829e31a8"
$Environment = "production"
$ApiDomain = "transit-logistic-production.up.railway.app"
$TargetPort = 8080
$HealthPath = "/health/live"

function Invoke-Railway {
  param([Parameter(Mandatory)][string[]]$Args)
  $output = & cmd /c "$Railway $($Args -join ' ') 2>&1"
  if ($LASTEXITCODE -ne 0) {
    throw "railway $($Args -join ' ') failed:`n$output"
  }
  return $output
}

Write-Host "== Railway API networking fix ==" -ForegroundColor Cyan

$whoami = & cmd /c "$Railway whoami 2>&1"
if ($LASTEXITCODE -ne 0) {
  Write-Host $whoami
  throw "Not logged in. Run: npx @railway/cli login"
}
Write-Host "Logged in as: $whoami"

Write-Host "`nLinking project $ProjectId (environment: $Environment)..."
Invoke-Railway @("link", "-p", $ProjectId, "-e", $Environment) | Out-Null

Write-Host "`nServices in project:"
Invoke-Railway @("service", "list", "--json") | Write-Host

$serviceJson = Invoke-Railway @("service", "list", "--json") | ConvertFrom-Json
$apiService = $serviceJson | Where-Object {
  $_.name -match 'api' -or $_.name -match 'transit-logistic' -and $_.name -notmatch 'web|frontend|insightful'
} | Select-Object -First 1

if (-not $apiService) {
  Write-Host "Could not auto-detect API service. Pass -ServiceName or link manually:" -ForegroundColor Yellow
  Write-Host "  npx @railway/cli link -p $ProjectId -e $Environment -s <api-service-name>"
  throw "API service not found"
}

$serviceName = $apiService.name
Write-Host "`nUsing API service: $serviceName"

Write-Host "`nCurrent variables (API service):"
Invoke-Railway @("variable", "list", "-s", $serviceName, "--json") | Write-Host

$vars = Invoke-Railway @("variable", "list", "-s", $serviceName, "--json") | ConvertFrom-Json
$apiPort = ($vars | Where-Object { $_.name -eq "API_PORT" }).value
$port = ($vars | Where-Object { $_.name -eq "PORT" }).value

Write-Host "`nPORT=$port  API_PORT=$apiPort"

if ($apiPort -and $apiPort -ne '${{PORT}}' -and $apiPort -ne '$' + '{PORT}') {
  Write-Host "Removing conflicting API_PORT=$apiPort (app reads PORT first; proxy must match listen port)..." -ForegroundColor Yellow
  Invoke-Railway @("variable", "delete", "API_PORT", "-s", $serviceName) | Out-Null
}

Write-Host "`nDomains on API service:"
Invoke-Railway @("domain", "list", "-s", $serviceName, "--json") | Write-Host

Write-Host "`nSetting domain target port to $TargetPort..."
Invoke-Railway @("domain", "update", $ApiDomain, "--port", "$TargetPort", "-s", $serviceName) | Write-Host

Write-Host "`nRedeploying API service..."
Invoke-Railway @("redeploy", "-s", $serviceName, "-y") | Write-Host

Write-Host "`nWaiting 45s for deploy..."
Start-Sleep -Seconds 45

$base = "https://$ApiDomain"
$paths = @("/", "/health/live", "/api/v1/health/live", "/api/v1/marketplace/home")

Write-Host "`nVerification:"
foreach ($path in $paths) {
  $url = "$base$path"
  try {
    $resp = Invoke-WebRequest -Uri $url -Method Get -UseBasicParsing -TimeoutSec 30
    Write-Host "  OK  $($resp.StatusCode)  $url" -ForegroundColor Green
  }
  catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  FAIL $code  $url" -ForegroundColor Red
  }
}

Write-Host "`nDone. If any check fails, open Railway dashboard -> $serviceName -> Settings -> Networking and confirm:"
Write-Host "  - Public networking enabled"
Write-Host "  - Domain $ApiDomain is on the API service (not web)"
Write-Host "  - Target port = $TargetPort"
Write-Host "  - Health check path = $HealthPath"
