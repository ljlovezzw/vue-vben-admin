[CmdletBinding()]
param([switch]$Activate)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$appRoot = Split-Path -Parent $PSScriptRoot
$deployRoot = Join-Path $appRoot 'dist-production'
$configPath = Join-Path $deployRoot 'active-root.conf'
$manifestPath = Join-Path $deployRoot 'net-profit-no-margin-20260923.manifest.json'
$nginxExecutable = 'C:\Windows\nginx\nginx.exe'
$nginxDirectory = 'C:\Windows\nginx'
$nginxTask = 'Kanban Nginx Frontend'
$gate = 'E:\junlee\Kanban\tmp\check_full_release_active_work_20260921.py'
$backendRoot = 'E:\kanban-release\backend-halloween-performance-20260922\Kanban'
$python = 'E:\kanban-release\backend-halloween-performance-20260922\.venv\Scripts\python.exe'
$resultPath = Join-Path $deployRoot 'net-profit-no-margin-20260923.activation.json'

function Assert-DeployChildPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  $root = [System.IO.Path]::GetFullPath($deployRoot).TrimEnd('\') + '\'
  $target = [System.IO.Path]::GetFullPath($Path)
  if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to activate a path outside the deployment root: $target"
  }
}

function Assert-Idle {
  & $python $gate $backendRoot
  if ($LASTEXITCODE -ne 0) { throw 'Business work is active; frontend switch refused' }
}

function Write-Config {
  param([Parameter(Mandatory = $true)][string]$Content)
  $temporary = "$configPath.net-profit-no-margin.tmp"
  [System.IO.File]::WriteAllText($temporary, $Content, [System.Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporary -Destination $configPath -Force
}

function Reload-Nginx {
  Push-Location $nginxDirectory
  try {
    & $nginxExecutable -t
    if ($LASTEXITCODE -ne 0) { throw 'Nginx configuration validation failed' }
    & $nginxExecutable -s reload
    if ($LASTEXITCODE -ne 0) { Start-ScheduledTask -TaskName $nginxTask }
  }
  finally { Pop-Location }
}

function Wait-Active {
  param(
    [Parameter(Mandatory = $true)][string]$ExpectedHtml,
    [int]$Attempts = 40
  )
  foreach ($attempt in 1..$Attempts) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5668/index.html' `
        -Headers @{ Host = 'hub.junlee.top'; 'Cache-Control' = 'no-cache' } -TimeoutSec 5
      if ($response.StatusCode -eq 200 -and $response.Content -ceq $ExpectedHtml) { return }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  throw 'Nginx did not activate the expected frontend index'
}

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'Release manifest is missing' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$candidate = [string]$manifest.candidate
Assert-DeployChildPath -Path $candidate
if (-not (Test-Path -LiteralPath $candidate -PathType Container)) { throw 'Candidate directory is missing' }
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { throw 'Active frontend config is missing' }
$currentConfig = Get-Content -LiteralPath $configPath -Raw
if ($currentConfig -cne [string]$manifest.activeConfig) { throw 'Active frontend changed after candidate preparation' }

foreach ($property in $manifest.files.PSObject.Properties) {
  $file = Join-Path $candidate $property.Name
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Candidate file is missing: $($property.Name)" }
  if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne [string]$property.Value) {
    throw "Candidate hash mismatch: $($property.Name)"
  }
  if (-not (Test-Path -LiteralPath "$file.gz" -PathType Leaf)) { throw "Candidate gzip is missing: $($property.Name)" }
}

$expectedIndex = Get-Content -LiteralPath (Join-Path $candidate 'index.html') -Raw
if (-not $expectedIndex.Contains([string]$manifest.entry)) { throw 'Candidate index does not reference the release entry' }
Assert-Idle
if (-not $Activate) {
  Write-Output 'Read-only frontend release preflight passed. No active configuration changed.'
  exit 0
}

$candidateConfig = 'set $kanban_root "' + $candidate.Replace('\', '/') + '";'
$switched = $false
try {
  Assert-Idle
  Write-Config -Content $candidateConfig
  $switched = $true
  Reload-Nginx
  Wait-Active -ExpectedHtml $expectedIndex
  $result = [ordered]@{
    status = 'activated'
    completedAt = (Get-Date -Format o)
    previous = [string]$manifest.active
    active = $candidate
    entry = [string]$manifest.entry
  }
} catch {
  $problem = $_.Exception.Message
  if ($switched) {
    try {
      Write-Config -Content ([string]$manifest.activeConfig)
      Reload-Nginx
      $previousIndex = Get-Content -LiteralPath (Join-Path ([string]$manifest.active) 'index.html') -Raw
      Wait-Active -ExpectedHtml $previousIndex
    } catch { $problem += '; rollback failed: ' + $_.Exception.Message }
  }
  $result = [ordered]@{ status = 'failed'; completedAt = (Get-Date -Format o); error = $problem }
}

$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $resultPath -Encoding UTF8
$result | ConvertTo-Json -Depth 5
if ($result.status -ne 'activated') { exit 1 }
