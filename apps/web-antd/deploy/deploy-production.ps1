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
    if ($LASTEXITCODE -ne 0) {
      throw 'Nginx reload failed'
    }
  }
  catch {
    if ($previousConfig) {
      [System.IO.File]::WriteAllText(
        $activeConfigPath,
        $previousConfig,
        [System.Text.UTF8Encoding]::new($false)
      )
      & $nginxExecutable -t
      & $nginxExecutable -s reload
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
