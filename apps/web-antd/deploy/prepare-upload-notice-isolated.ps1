[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$appRoot = Split-Path -Parent $PSScriptRoot
$deployRoot = Join-Path $appRoot 'dist-production'
$configPath = Join-Path $deployRoot 'active-root.conf'
$sourceHtml = Join-Path $appRoot 'public\tools\upload-tool.html'
$sourceShell = Join-Path $PSScriptRoot 'upload-task-shell.js'
$stagePath = Join-Path $deployRoot 'upload-notice-staging-20260917'

function Assert-DeployChildPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  $root = [System.IO.Path]::GetFullPath($deployRoot).TrimEnd('\') + '\'
  $target = [System.IO.Path]::GetFullPath($Path)
  if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to modify a path outside the deployment root: $target"
  }
}

function Write-GzipCopy {
  param([Parameter(Mandatory = $true)][string]$Path)
  $inputStream = [System.IO.File]::OpenRead($Path)
  $outputStream = [System.IO.File]::Create("$Path.gz")
  try {
    $gzip = [System.IO.Compression.GZipStream]::new(
      $outputStream,
      [System.IO.Compression.CompressionLevel]::Optimal,
      $true
    )
    try { $inputStream.CopyTo($gzip) }
    finally { $gzip.Dispose() }
  }
  finally {
    $inputStream.Dispose()
    $outputStream.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { throw 'Active frontend slot is unknown' }
$config = Get-Content -LiteralPath $configPath -Raw
if ($config -notmatch '/(blue|green)"?;') { throw 'Active frontend slot is not blue or green' }
$activeSlot = $Matches[1]
$activePath = Join-Path $deployRoot $activeSlot
Assert-DeployChildPath -Path $activePath
Assert-DeployChildPath -Path $stagePath
if (-not (Test-Path -LiteralPath $activePath -PathType Container)) { throw 'Active release path is missing' }
if (Test-Path -LiteralPath $stagePath) { throw "Staging path already exists: $stagePath" }
if (-not (Test-Path -LiteralPath $sourceHtml -PathType Leaf)) { throw 'Upload HTML source is missing' }
if (-not (Test-Path -LiteralPath $sourceShell -PathType Leaf)) { throw 'Upload shell source is missing' }

Copy-Item -LiteralPath $activePath -Destination $stagePath -Recurse
$targetHtml = Join-Path $stagePath 'tools\upload-tool.html'
$targetShell = Join-Path $stagePath 'tools\upload-task-shell.js'
Copy-Item -LiteralPath $sourceHtml -Destination $targetHtml -Force
Copy-Item -LiteralPath $sourceShell -Destination $targetShell -Force

$indexPath = Join-Path $stagePath 'index.html'
$index = Get-Content -LiteralPath $indexPath -Raw
$shellTag = '<script defer src="/tools/upload-task-shell.js?v=20260917-upload-drafts-v1"></script>'
if ($index.Contains('upload-task-shell.js')) { throw 'Active entry already contains an upload shell injection' }
if ([regex]::Matches($index, '</head>').Count -ne 1) { throw 'Unexpected frontend entry shape' }
$index = $index.Replace('</head>', "$shellTag</head>")
[System.IO.File]::WriteAllText($indexPath, $index, [System.Text.UTF8Encoding]::new($false))

Write-GzipCopy -Path $targetHtml
Write-GzipCopy -Path $targetShell
Write-GzipCopy -Path $indexPath

$allowedChanges = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
@('index.html', 'index.html.gz', 'tools\upload-tool.html', 'tools\upload-tool.html.gz') |
  ForEach-Object { [void]$allowedChanges.Add($_) }
$activePrefix = [System.IO.Path]::GetFullPath($activePath).TrimEnd('\') + '\'
foreach ($file in Get-ChildItem -LiteralPath $activePath -Recurse -File) {
  $relative = $file.FullName.Substring($activePrefix.Length)
  if ($allowedChanges.Contains($relative)) { continue }
  $candidate = Join-Path $stagePath $relative
  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { throw "Missing unchanged asset: $relative" }
  $oldHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
  $newHash = (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash
  if ($oldHash -ne $newHash) { throw "Unexpected change outside upload module: $relative" }
}

if ((Get-FileHash -LiteralPath $sourceHtml -Algorithm SHA256).Hash -ne
    (Get-FileHash -LiteralPath $targetHtml -Algorithm SHA256).Hash) {
  throw 'Staged upload HTML does not match source'
}
if ((Get-FileHash -LiteralPath $sourceShell -Algorithm SHA256).Hash -ne
    (Get-FileHash -LiteralPath $targetShell -Algorithm SHA256).Hash) {
  throw 'Staged upload shell does not match source'
}

Write-Host "Active slot preserved: $activeSlot"
Write-Host "Isolated candidate: $stagePath"
Write-Host 'All unchanged assets match the active release byte-for-byte.'
