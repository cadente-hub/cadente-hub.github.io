#!/usr/bin/env bash
# Install the desktop artifact, validating it before replacing an existing app.
set -euo pipefail
CHANNEL="${CADENTE_CHANNEL:-beta}"
case "$CHANNEL" in beta) MANIFEST_URL="https://cadente-hub.github.io/update-beta.json";; stable) MANIFEST_URL="https://cadente-hub.github.io/update.json";; *) echo "Unknown channel: $CHANNEL" >&2; exit 1;; esac
OS="$(uname -s)"; ARCH="$(uname -m)"
case "$OS/$ARCH" in
  Darwin/arm64|Darwin/aarch64) PLATFORM=darwin-aarch64; INSTALLER_ARCH=arm64;;
  Darwin/x86_64) PLATFORM=darwin-x86_64; INSTALLER_ARCH=x64;;
  Linux/x86_64) PLATFORM=linux-x86_64; INSTALLER_ARCH=x64;;
  *) echo "Unsupported platform: $OS/$ARCH" >&2; exit 1;;
esac
TMP_DIR="$(mktemp -d -t cadente-install-XXXXXX)"
MOUNT=""; WORK=""; TARGET_APP=""; INSTALLED=0
cleanup() {
  if [ -n "$MOUNT" ]; then hdiutil detach "$MOUNT" >/dev/null 2>&1 || true; fi
  if [ -n "$WORK" ]; then
    if [ "$INSTALLED" != 1 ] && [ -d "$WORK/previous.app" ] && [ ! -e "$TARGET_APP" ]; then mv "$WORK/previous.app" "$TARGET_APP"; fi
    rm -rf "$WORK"
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT
curl -fsSL "$MANIFEST_URL" -o "$TMP_DIR/manifest.json"
json_value() {
  if [ "$OS" = Darwin ]; then
    local value
    if value="$(plutil -extract "$1" raw -o - "$TMP_DIR/manifest.json" 2>/dev/null)"; then printf '%s\n' "$value"; else return 1; fi
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; v=json.load(open(sys.argv[1]));
for k in sys.argv[2].split("."): v=v[k]
print(v)' "$TMP_DIR/manifest.json" "$1"
  else
    echo "python3 is required to read the release manifest on Linux" >&2; return 1
  fi
}
VERSION="$(json_value version)"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-beta\.[0-9]+)?$ ]]; then echo "Invalid release version" >&2; exit 1; fi
BASE_URL="https://github.com/cadente-hub/cadente-hub.github.io/releases/download/v$VERSION"
DOWNLOAD_URL="$(json_value "platforms.$PLATFORM.installerUrl" || true)"
EXPECTED_SHA="$(json_value "platforms.$PLATFORM.installerSha256" || true)"
if [ -z "$DOWNLOAD_URL" ]; then
  # Older feeds exposed only the native updater's executable archive. Select
  # the separately published desktop artifact, never extract that into /Applications.
  if [ "$OS" = Darwin ]; then NAME="cadente-$VERSION-macos-$INSTALLER_ARCH.dmg"; else NAME="cadente-$VERSION-linux-x64.AppImage"; fi
  DOWNLOAD_URL="$BASE_URL/$NAME"
  curl -fsSL "$BASE_URL/SHA256SUMS.txt" -o "$TMP_DIR/checksums"
  EXPECTED_SHA="$(awk -v name="$NAME" '$2 == name { print $1 }' "$TMP_DIR/checksums")"
fi
case "$DOWNLOAD_URL" in "$BASE_URL/"*) ;; *) echo "Installer belongs to a different release" >&2; exit 1;; esac
if [[ ! "$EXPECTED_SHA" =~ ^[0-9a-f]{64}$ ]]; then echo "Installer checksum is missing or invalid" >&2; exit 1; fi
printf 'Downloading Cadente %s for %s...\n' "$VERSION" "$PLATFORM"
curl -fL --progress-bar "$DOWNLOAD_URL" -o "$TMP_DIR/artifact"
if command -v shasum >/dev/null 2>&1; then ACTUAL_SHA="$(shasum -a 256 "$TMP_DIR/artifact" | awk '{print $1}')"; else ACTUAL_SHA="$(sha256sum "$TMP_DIR/artifact" | awk '{print $1}')"; fi
if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then echo "Installer checksum mismatch; existing installation was preserved" >&2; exit 1; fi
if [ "$OS" = Darwin ]; then
  case "$DOWNLOAD_URL" in
    *.dmg)
      MOUNT="$TMP_DIR/mount"; mkdir "$MOUNT"
      hdiutil attach -readonly -nobrowse -mountpoint "$MOUNT" "$TMP_DIR/artifact" >/dev/null
      SOURCE_APP="$MOUNT/Cadente.app";;
    *.app.tar.gz)
      mkdir "$TMP_DIR/extract"
      tar -xzf "$TMP_DIR/artifact" -C "$TMP_DIR/extract"
      SOURCE_APP="$TMP_DIR/extract/Cadente.app";;
    *) echo "Expected a macOS desktop bundle, not a portable executable" >&2; exit 1;;
  esac
  INFO="$SOURCE_APP/Contents/Info.plist"
  FOUND_VERSION="$(plutil -extract CFBundleShortVersionString raw -o - "$INFO" 2>/dev/null || true)"
  IDENTIFIER="$(plutil -extract CFBundleIdentifier raw -o - "$INFO" 2>/dev/null || true)"
  EXECUTABLE="$(plutil -extract CFBundleExecutable raw -o - "$INFO" 2>/dev/null || true)"
  if [ "$FOUND_VERSION" != "$VERSION" ] || [ "$IDENTIFIER" != com.cadente.app ] || [ -z "$EXECUTABLE" ] || [ ! -x "$SOURCE_APP/Contents/MacOS/$EXECUTABLE" ]; then
    echo "Downloaded artifact does not contain the expected Cadente.app; existing installation was preserved" >&2; exit 1
  fi
  INSTALL_DIR="${CADENTE_INSTALL_DIR:-/Applications}"
  if [ ! -w "$INSTALL_DIR" ] && [ -z "${CADENTE_INSTALL_DIR:-}" ]; then INSTALL_DIR="$HOME/Applications"; fi
  mkdir -p "$INSTALL_DIR"
  TARGET_APP="$INSTALL_DIR/Cadente.app"
  WORK="$(mktemp -d "$INSTALL_DIR/.cadente-install-XXXXXX")"
  ditto "$SOURCE_APP" "$WORK/Cadente.app"
  xattr -dr com.apple.quarantine "$WORK/Cadente.app" 2>/dev/null || true
  # All downloads and bundle checks have succeeded before touching the old app.
  pkill -f "$TARGET_APP/Contents/MacOS/" 2>/dev/null || true
  if [ -e "$TARGET_APP" ]; then mv "$TARGET_APP" "$WORK/previous.app"; fi
  mv "$WORK/Cadente.app" "$TARGET_APP"
  INSTALLED=1
  printf 'Cadente %s installed in %s\n' "$VERSION" "$TARGET_APP"
  if [ "${CADENTE_INSTALL_NO_LAUNCH:-0}" != 1 ]; then open "$TARGET_APP"; fi
else
  case "$DOWNLOAD_URL" in *.AppImage) ;; *) echo "Expected a desktop AppImage" >&2; exit 1;; esac
  INSTALL_DIR="${CADENTE_INSTALL_DIR:-$HOME/.local/bin}"
  mkdir -p "$INSTALL_DIR"
  chmod +x "$TMP_DIR/artifact"
  mv "$TMP_DIR/artifact" "$INSTALL_DIR/cadente"
  mkdir -p "$HOME/.local/share/applications"
  cat > "$HOME/.local/share/applications/cadente.desktop" <<DESKTOP
[Desktop Entry]
Name=Cadente
Exec="$INSTALL_DIR/cadente"
Terminal=false
Type=Application
Categories=Development;IDE;
DESKTOP
  printf 'Cadente %s installed in %s/cadente\n' "$VERSION" "$INSTALL_DIR"
  if [ "${CADENTE_INSTALL_NO_LAUNCH:-0}" != 1 ]; then nohup "$INSTALL_DIR/cadente" >/dev/null 2>&1 & fi
fi
