# ==============================================================================
# Cadente Universal 1-Line Installer for Windows (PowerShell)
# Usage: irm https://cadente-hub.github.io/install.ps1 | iex
# ==============================================================================
$ErrorActionPreference = 'Stop'
Write-Host ""
Write-Host "=== Cadente Installer for Windows ===" -ForegroundColor Cyan
Write-Host ""

$manifestUrl = "https://cadente-hub.github.io/update.json"
Write-Host "Fetching latest release..." -ForegroundColor Yellow

try {
    $manifest = Invoke-RestMethod -Uri $manifestUrl
    $downloadUrl = $manifest.platforms.'windows-x86_64'.url
} catch {
    $downloadUrl = "https://github.com/cadente-hub/cadente-hub.github.io/releases/latest"
}

$tempZip = Join-Path $env:TEMP "cadente-setup.zip"
Write-Host "Downloading Cadente from $downloadUrl..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $downloadUrl -OutFile $tempZip

$extractPath = Join-Path $env:TEMP "cadente-installer"
if (Test-Path $extractPath) {
    Remove-Item -Path $extractPath -Recurse -Force
}
New-Item -ItemType Directory -Path $extractPath -Force | Out-Null

Expand-Archive -Path $tempZip -DestinationPath $extractPath -Force
$setupExe = Get-ChildItem -Path $extractPath -Filter "*.exe" -Recurse | Select-Object -First 1

if ($setupExe) {
    Write-Host "Launching Cadente setup wizard..." -ForegroundColor Green
    Start-Process -FilePath $setupExe.FullName -Wait
    Write-Host "✓ Cadente installed successfully!" -ForegroundColor Green
} else {
    Write-Host "Installer executable not found in download package." -ForegroundColor Red
}

Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue
Remove-Item -Path $extractPath -Recurse -Force -ErrorAction SilentlyContinue
