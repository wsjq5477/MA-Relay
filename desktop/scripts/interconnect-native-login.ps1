[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ProfileRoot, [switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $ProfileRoot).Path
if ([IO.Path]::GetPathRoot($root).TrimEnd([char]92) -ieq 'C:') { throw 'Native acceptance state must stay off C:.' }
$manifest = Get-Content -LiteralPath (Join-Path $root 'native-profile-manifest.json') -Raw | ConvertFrom-Json
foreach ($item in @($manifest.codex, $manifest.profile, $manifest.home)) {
    $resolved = (Resolve-Path -LiteralPath $item).Path
    if (-not $resolved.StartsWith($root.TrimEnd([char]92) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'The original native profile binding does not match.' }
    $current = Get-Item -LiteralPath $resolved
    while ($null -ne $current -and $current.FullName.Length -gt 3) {
        if (($current.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'A native acceptance path was replaced by a link.' }
        $current = if ($current.PSIsContainer) { $current.Parent } else { $current.Directory }
    }
}
if ((Get-FileHash -LiteralPath $manifest.codex -Algorithm SHA256).Hash -ine $manifest.codexSha256) { throw 'The pinned native executable changed.' }
if ($ValidateOnly) { Write-Output 'Native login setup validated; sign-in was not started.'; return }
$temp = Join-Path $manifest.home 'tmp'
New-Item -ItemType Directory -Path $temp -Force | Out-Null
$vars = @{
    CODEX_HOME=$manifest.profile; CODEX_SQLITE_HOME=(Join-Path $manifest.profile 'sqlite'); CODEX_CLI_PATH=$manifest.codex
    TEMP=$temp; TMP=$temp; USERPROFILE=$manifest.home; HOME=$manifest.home
    APPDATA=(Join-Path $manifest.home 'AppData\Roaming'); LOCALAPPDATA=(Join-Path $manifest.home 'AppData\Local')
    XDG_CACHE_HOME=(Join-Path $manifest.home 'cache'); XDG_CONFIG_HOME=(Join-Path $manifest.home 'config'); XDG_DATA_HOME=(Join-Path $manifest.home 'data')
}
$saved = @{}
try {
    foreach ($key in $vars.Keys) {
        $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $vars[$key], 'Process')
    }
    Write-Output 'Complete native Codex device sign-in. Do not send the displayed code or tokens to the assistant.'
    & $manifest.codex login --device-auth
    if ($LASTEXITCODE -ne 0) { throw 'Native Codex sign-in did not complete.' }
    Write-Output 'Native sign-in completed. Reply 已登录 in Codex.'
} finally {
    foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key], 'Process') }
}
