[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [switch]$Rollback
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = "$(& git -C $PSScriptRoot rev-parse --show-toplevel 2>$null)".Trim()
$appRoot = if ($LASTEXITCODE -eq 0 -and $repositoryRoot) {
  Join-Path $repositoryRoot 'apps\web-antd'
} else {
  Split-Path -Parent $PSScriptRoot
}
$deployRoot = Join-Path $appRoot 'dist-production'
$activeConfigPath = Join-Path $deployRoot 'active-root.conf'
$nginxExecutable = 'C:\Windows\nginx\nginx.exe'
$nginxWorkingDirectory = 'C:\Windows\nginx'
$nginxEnsureTaskName = 'Kanban Nginx Frontend'

function Assert-DeployChildPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  $resolvedRoot = [System.IO.Path]::GetFullPath($deployRoot).TrimEnd('\') + '\'
  $resolvedPath = [System.IO.Path]::GetFullPath($Path)
  if (-not $resolvedPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to modify path outside deployment root: $resolvedPath"
  }
}

function Remove-DeployPathWithRetry {
  param([Parameter(Mandatory = $true)][string]$Path)

  Assert-DeployChildPath -Path $Path
  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  for ($attempt = 1; $attempt -le 10; $attempt += 1) {
    try {
      Remove-Item -LiteralPath $Path -Recurse -Force
      return
    }
    catch {
      if ($attempt -eq 10) {
        throw
      }
      Start-Sleep -Milliseconds 500
    }
  }
}

function Write-ActiveRootConfig {
  param([Parameter(Mandatory = $true)][string]$ReleasePath)

  Assert-DeployChildPath -Path $ReleasePath
  $nginxRoot = $ReleasePath.Replace('\', '/')
  $content = "set `$kanban_root `"$nginxRoot`";`r`n"
  [System.IO.File]::WriteAllText(
    $activeConfigPath,
    $content,
    [System.Text.UTF8Encoding]::new($false)
  )
}

function Test-ReleaseActive {
  param([Parameter(Mandatory = $true)][string]$ReleasePath)

  try {
    $response = Invoke-WebRequest `
      -UseBasicParsing `
      -Uri 'http://127.0.0.1:5668/' `
      -Headers @{ Host = 'hub.junlee.top'; 'Cache-Control' = 'no-cache' } `
      -TimeoutSec 5
    if ($response.StatusCode -ne 200) {
      return $false
    }
    $expectedIndexPath = Join-Path $ReleasePath 'index.html'
    $expectedIndex = Get-Content -LiteralPath $expectedIndexPath -Raw
    $entryPattern = '/jse/[^"'']+\.js'
    $liveEntry = [regex]::Match($response.Content, $entryPattern).Value
    $expectedEntry = [regex]::Match($expectedIndex, $entryPattern).Value
    if (-not ($liveEntry -and $expectedEntry -and $liveEntry -eq $expectedEntry)) {
      return $false
    }
    $expectedToolPath = Join-Path $ReleasePath 'tools\upload-tool.html'
    if (Test-Path -LiteralPath $expectedToolPath -PathType Leaf) {
      $toolResponse = Invoke-WebRequest `
        -UseBasicParsing `
        -Uri 'http://127.0.0.1:5668/tools/upload-tool.html' `
        -Headers @{ Host = 'hub.junlee.top'; 'Cache-Control' = 'no-cache' } `
        -TimeoutSec 5
      $expectedTool = Get-Content -LiteralPath $expectedToolPath -Raw
      if ($toolResponse.StatusCode -ne 200 -or $toolResponse.Content -cne $expectedTool) {
        return $false
      }
    }
    return $true
  }
  catch {
    return $false
  }
}

function Wait-ReleaseActive {
  param(
    [Parameter(Mandatory = $true)][string]$ReleasePath,
    [int]$Attempts = 40
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
    if (Test-ReleaseActive -ReleasePath $ReleasePath) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Start-SystemNginxEnsureTask {
  Start-ScheduledTask -TaskName $nginxEnsureTaskName -ErrorAction Stop
}

New-Item -ItemType Directory -Path $deployRoot -Force | Out-Null

$activeSlot = ''
if (Test-Path -LiteralPath $activeConfigPath -PathType Leaf) {
  $activeConfig = Get-Content -LiteralPath $activeConfigPath -Raw
  if ($activeConfig -match '/(blue|green)"?;') {
    $activeSlot = $Matches[1]
  }
}

$nextSlot = if ($activeSlot -eq 'blue') { 'green' } else { 'blue' }
$nextPath = Join-Path $deployRoot $nextSlot
Assert-DeployChildPath -Path $nextPath

if ($Rollback) {
  if (-not $activeSlot) {
    throw 'Cannot roll back because no active deployment slot is recorded'
  }
  $SkipBuild = $true
}

if (-not $SkipBuild) {
  Remove-DeployPathWithRetry -Path $nextPath
  Push-Location $appRoot
  try {
    & pnpm exec vite build --mode production --outDir $nextPath --emptyOutDir
    if ($LASTEXITCODE -ne 0) {
      throw "Frontend production build failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}

$nextIndex = Join-Path $nextPath 'index.html'
if (-not (Test-Path -LiteralPath $nextIndex -PathType Leaf)) {
  throw "Deployment candidate is incomplete: $nextIndex is missing"
}

$previousConfig = if (Test-Path -LiteralPath $activeConfigPath) {
  Get-Content -LiteralPath $activeConfigPath -Raw
} else {
  ''
}

Write-ActiveRootConfig -ReleasePath $nextPath

if (Test-Path -LiteralPath $nginxExecutable -PathType Leaf) {
  Push-Location $nginxWorkingDirectory
  try {
    & $nginxExecutable -t
    if ($LASTEXITCODE -ne 0) {
      throw 'Nginx configuration validation failed'
    }
    & $nginxExecutable -s reload
    $directReloadSucceeded = $LASTEXITCODE -eq 0
    if (-not $directReloadSucceeded -or -not (Wait-ReleaseActive -ReleasePath $nextPath -Attempts 10)) {
      Write-Warning "Direct Nginx reload was unavailable; starting scheduled task '$nginxEnsureTaskName'."
      Start-SystemNginxEnsureTask
      if (-not (Wait-ReleaseActive -ReleasePath $nextPath)) {
        throw "Nginx did not activate release through scheduled task '$nginxEnsureTaskName'"
      }
    }
  }
  catch {
    if ($previousConfig) {
      [System.IO.File]::WriteAllText(
        $activeConfigPath,
        $previousConfig,
        [System.Text.UTF8Encoding]::new($false)
      )
      if ($previousConfig -match '"([^"]+)"') {
        $previousPath = $Matches[1].Replace('/', '\')
        try {
          Start-SystemNginxEnsureTask
          [void](Wait-ReleaseActive -ReleasePath $previousPath)
        }
        catch {
          Write-Warning "Rollback config was restored but Nginx activation failed: $($_.Exception.Message)"
        }
      }
    }
    throw
  }
  finally {
    Pop-Location
  }
}

$entryScript = Select-String -Path $nextIndex -Pattern '/jse/[^"'']+\.js' |
  Select-Object -First 1 -ExpandProperty Matches |
  ForEach-Object { $_.Value }

Write-Host "Frontend release activated: $nextSlot"
Write-Host "Release path: $nextPath"
Write-Host "Entry script: $entryScript"
if ($activeSlot) {
  Write-Host "Rollback slot retained: $activeSlot"
}
