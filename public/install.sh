#!/usr/bin/env bash
# Install Cadente: the installer of the version the signed feed offers, checked against the release's
# SHA256SUMS.txt before an existing app is replaced.
#   curl -fsSL https://cadente-hub.github.io/install.sh | bash
#   CADENTE_CHANNEL=stable|beta picks a channel; by default the stable release, or the beta while
#   there is no stable one.
set -euo pipefail
SITE="https://cadente-hub.github.io"
DOWNLOADS="https://github.com/cadente-hub/cadente-hub.github.io/releases/download"
OS="$(uname -s)"; ARCH="$(uname -m)"
case "$OS/$ARCH" in
  Darwin/arm64|Darwin/aarch64) SUFFIX=macos-arm64.dmg;;
  Darwin/x86_64) SUFFIX=macos-x64.dmg;;
  Linux/x86_64) SUFFIX=linux-x64.AppImage;;
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

# The version of a channel's feed, or nothing when the channel has no release.
feed_version() {
  curl -fsSL "$SITE/feeds/$1.json" -o "$TMP_DIR/feed.json" || return 0
  if [ "$OS" = Darwin ]; then
    # plutil prints its error on stdout: only a successful extraction is a version.
    local value
    if value="$(plutil -extract releases.0.version raw -o - "$TMP_DIR/feed.json" 2>/dev/null)"; then printf '%s\n' "$value"; fi
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; r=json.load(open(sys.argv[1])).get("releases") or [{}]; print(r[0].get("version", ""))' "$TMP_DIR/feed.json"
  else
    echo "python3 is required to read the release feed on Linux" >&2; exit 1
  fi
}
CHANNEL="${CADENTE_CHANNEL:-}"
case "$CHANNEL" in
  stable|beta) VERSION="$(feed_version "$CHANNEL")";;
  "") VERSION="$(feed_version stable)"; [ -n "$VERSION" ] || VERSION="$(feed_version beta)";;
  *) echo "Unknown channel: $CHANNEL" >&2; exit 1;;
esac
if [ -z "$VERSION" ]; then echo "No Cadente release is published${CHANNEL:+ in the $CHANNEL channel} yet" >&2; exit 1; fi
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-beta\.[0-9]+)?$ ]]; then echo "Invalid release version" >&2; exit 1; fi

NAME="cadente-$VERSION-$SUFFIX"
curl -fsSL "$DOWNLOADS/v$VERSION/SHA256SUMS.txt" -o "$TMP_DIR/checksums"
EXPECTED_SHA="$(awk -v name="$NAME" '$2 == name || $2 == "*" name { print $1 }' "$TMP_DIR/checksums")"
if [[ ! "$EXPECTED_SHA" =~ ^[0-9a-f]{64}$ ]]; then echo "The release has no checksum for $NAME" >&2; exit 1; fi
printf 'Downloading Cadente %s (%s)...\n' "$VERSION" "$NAME"
curl -fL --progress-bar "$DOWNLOADS/v$VERSION/$NAME" -o "$TMP_DIR/artifact"
if command -v shasum >/dev/null 2>&1; then ACTUAL_SHA="$(shasum -a 256 "$TMP_DIR/artifact" | awk '{print $1}')"; else ACTUAL_SHA="$(sha256sum "$TMP_DIR/artifact" | awk '{print $1}')"; fi
if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then echo "Installer checksum mismatch; existing installation was preserved" >&2; exit 1; fi

if [ "$OS" = Darwin ]; then
  MOUNT="$TMP_DIR/mount"; mkdir "$MOUNT"
  hdiutil attach -readonly -nobrowse -mountpoint "$MOUNT" "$TMP_DIR/artifact" >/dev/null
  SOURCE_APP="$MOUNT/Cadente.app"
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
