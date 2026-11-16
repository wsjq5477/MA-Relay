#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string]$OutputDirectory,
    [string]$Version
)

$ErrorActionPreference = 'Stop'
if (!$RepoRoot) { $RepoRoot = Split-Path -Parent $PSScriptRoot }
$repo = (Resolve-Path -LiteralPath $RepoRoot).Path
$desktop = Join-Path $repo 'desktop'
$desktopPackage = Get-Content -Raw -LiteralPath (Join-Path $desktop 'package.json') | ConvertFrom-Json
if (!$Version) {
    $base = $desktopPackage.version
    $separator = if ($base.Contains('-')) { '.' } else { '-' }
    $Version = $base + $separator + 'local.' + (Get-Date -Format yyyyMMddHHmmss)
}
if (!$OutputDirectory) { $OutputDirectory = Join-Path $desktop "release\local\$Version" }
$output = [IO.Path]::GetFullPath($OutputDirectory)
if ([IO.Path]::GetPathRoot($repo) -ieq 'C:\' -or [IO.Path]::GetPathRoot($output) -ieq 'C:\') {
    throw 'Keep the source and local EXE output on a drive other than C:.'
}

$node = (Get-Command node.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$temp = Join-Path $repo '.tmp\local-exe'
$variables = @{
    TEMP = $temp
    TMP = $temp
    TMPDIR = $temp
    APPDATA = Join-Path $temp 'appdata'
    LOCALAPPDATA = Join-Path $temp 'localappdata'
    NODE_COMPILE_CACHE = Join-Path $temp 'node-cache'
    npm_config_cache = Join-Path $repo '.npm-cache-build'
    npm_config_userconfig = Join-Path $temp 'npmrc'
    npm_config_audit = 'false'
    npm_execpath = Join-Path (Split-Path -Parent $npm) 'node_modules\npm\bin\npm-cli.js'
    ELECTRON_CACHE = Join-Path $repo '.cache-electron'
    ELECTRON_BUILDER_CACHE = Join-Path $repo '.cache-electron-builder'
    AGENTBRIDGE_LOCAL_EXE_VERSION = $Version
    CSC_IDENTITY_AUTO_DISCOVERY = 'false'
}
foreach ($key in @('npm_config_cache', 'ELECTRON_CACHE', 'ELECTRON_BUILDER_CACHE')) {
    $existing = [Environment]::GetEnvironmentVariable($key, 'Process')
    if ($existing -and [IO.Path]::IsPathRooted($existing) -and [IO.Path]::GetPathRoot($existing) -ine 'C:\') {
        $variables[$key] = $existing
    }
}

function Invoke-BuildStep([string[]]$BuildArguments) {
    & $node @BuildArguments
    if ($LASTEXITCODE -ne 0) { throw "Build step failed: $($BuildArguments[0]) ($LASTEXITCODE)" }
}

$previous = @{}
Push-Location $repo
try {
    New-Item -ItemType Directory -Force -Path $temp, $output | Out-Null
    foreach ($key in $variables.Keys) {
        $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $variables[$key], 'Process')
    }
    Invoke-BuildStep @('node_modules/typescript/bin/tsc', '-p', 'tsconfig.json')
    Set-Location $desktop
    Invoke-BuildStep @('node_modules/vite/bin/vite.js', 'build')
    Invoke-BuildStep @('scripts/stage-bridge.cjs')

    $desktopWs = Join-Path $desktop 'node_modules\ws'
    $rootWs = Join-Path $repo 'node_modules\ws'
    if (!(Test-Path -LiteralPath (Join-Path $desktopWs 'package.json')) -and
        (Test-Path -LiteralPath (Join-Path $rootWs 'package.json'))) {
        $wsPackage = Get-Content -Raw -LiteralPath (Join-Path $rootWs 'package.json') | ConvertFrom-Json
        if ($wsPackage.version -eq $desktopPackage.dependencies.ws) {
            New-Item -ItemType Directory -Force -Path $desktopWs | Out-Null
            Get-ChildItem -LiteralPath $rootWs -Force | Copy-Item -Destination $desktopWs -Recurse -Force
        }
    }
    $builder = @('node_modules/electron-builder/cli.js', '--win', 'portable', '--x64', '--config.compression=store',
        "--config.directories.output=$output", "--config.extraMetadata.version=$Version")
    $installedElectron = Join-Path $desktop 'node_modules\electron\dist'
    if (Test-Path -LiteralPath (Join-Path $installedElectron 'electron.exe')) {
        $builder += "--config.electronDist=$installedElectron"
    }
    Invoke-BuildStep $builder
    Write-Output (Join-Path $output "AgentBridge-$Version-Windows-x64.exe")
} finally {
    foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
    Pop-Location
}
