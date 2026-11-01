# Install Cadente on Windows: the installer of the version the signed feed offers, checked against the
# release's SHA256SUMS.txt before it runs.
#   irm https://cadente-hub.github.io/install.ps1 | iex
#   $env:CADENTE_CHANNEL = 'stable' or 'beta' picks a channel; by default the stable release, or the
#   beta while there is no stable one. $env:CADENTE_INSTALL_SILENT = '1' installs without the wizard.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$site = 'https://cadente-hub.github.io'
$downloads = 'https://github.com/cadente-hub/cadente-hub.github.io/releases/download'

# The version of a channel's feed, or nothing when the channel has no release.
function Get-FeedVersion([string]$channel) {
    try { $feed = Invoke-RestMethod -Uri "$site/feeds/$channel.json" -UseBasicParsing } catch { return $null }
    if (@($feed.releases).Count -gt 0) { return [string]@($feed.releases)[0].version }
    return $null
}

$channel = $env:CADENTE_CHANNEL
if ($channel) {
    if ($channel -notin @('stable', 'beta')) { throw "Unknown channel: $channel" }
    $version = Get-FeedVersion $channel
} else {
    $version = Get-FeedVersion 'stable'
    if (-not $version) { $version = Get-FeedVersion 'beta' }
}
if (-not $version) { throw 'No Cadente release is published yet.' }
if ($version -notmatch '^\d+\.\d+\.\d+(-beta\.\d+)?$') { throw 'Invalid release version.' }

$name = "cadente-$version-windows-x64.exe"
$work = Join-Path $env:TEMP ("cadente-install-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work -Force | Out-Null
try {
    Invoke-WebRequest -Uri "$downloads/v$version/SHA256SUMS.txt" -OutFile (Join-Path $work 'SHA256SUMS.txt') -UseBasicParsing
    $expected = $null
    foreach ($line in Get-Content (Join-Path $work 'SHA256SUMS.txt')) {
        if ($line -match '^([0-9a-f]{64})\s+\*?(.+)$' -and $Matches[2].Trim() -eq $name) { $expected = $Matches[1]; break }
    }
    if (-not $expected) { throw "The release has no checksum for $name." }

    Write-Host "Downloading Cadente $version ($name)..."
    $installer = Join-Path $work $name
    Invoke-WebRequest -Uri "$downloads/v$version/$name" -OutFile $installer -UseBasicParsing
    $actual = (Get-FileHash -Path $installer -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw 'Installer checksum mismatch; nothing was installed.' }

    Write-Host 'Running the Cadente installer...'
    # CADENTE_INSTALL_SILENT=1 installs without the wizard (NSIS /S).
    if ($env:CADENTE_INSTALL_SILENT -eq '1') {
        Start-Process -FilePath $installer -ArgumentList '/S' -Wait
    } else {
        Start-Process -FilePath $installer -Wait
    }
    Write-Host "Cadente $version installed."
} finally {
    Remove-Item -Path $work -Recurse -Force -ErrorAction SilentlyContinue
}
