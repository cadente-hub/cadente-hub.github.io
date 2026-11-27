#!/usr/bin/env bash
# Install Cadente: the installer of the version the signed feed offers, checked against the release's
# SHA256SUMS.txt before an existing app is replaced.
#   curl -fsSL https://cadente-hub.github.io/install.sh | bash
#   CADENTE_CHANNEL=stable|beta picks the app channel (default: stable, or beta while there is
#   no stable release). The launcher has no separate channel and always updates to the latest build.
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

check_checksum() {
  local sums_file="$1" name="$2" file="$3" expected actual
  expected="$(awk -v name="$name" '$2 == name || $2 == "*" name { print $1 }' "$sums_file")"
  if [[ ! "$expected" =~ ^[0-9a-f]{64}$ ]]; then echo "The release has no checksum for $name" >&2; exit 1; fi
  if command -v shasum >/dev/null 2>&1; then actual="$(shasum -a 256 "$file" | awk '{print $1}')"; else actual="$(sha256sum "$file" | awk '{print $1}')"; fi
  if [ "$actual" != "$expected" ]; then echo "Checksum mismatch for $name; existing installation was preserved" >&2; exit 1; fi
}

latest_darwin_launcher() {
  local platform="$1" app_ver="$2"
  curl -fsSL "$SITE/feeds/stable.json" -o "$TMP_DIR/stable-feed.json" 2>/dev/null || echo '{}' > "$TMP_DIR/stable-feed.json"
  curl -fsSL "$SITE/feeds/beta.json" -o "$TMP_DIR/beta-feed.json" 2>/dev/null || echo '{}' > "$TMP_DIR/beta-feed.json"
  osascript -l JavaScript - "$platform" "$app_ver" "$TMP_DIR/stable-feed.json" "$TMP_DIR/beta-feed.json" <<'JXA' 2>/dev/null || true
ObjC.import("Foundation");
function readJson(path) {
  const data = $.NSData.dataWithContentsOfFile(path);
  if (!data) return {};
  const str = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding);
  try { return JSON.parse(str ? str.js : "{}"); } catch (_) { return {}; }
}
function parseVer(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/.exec(String(v || "").trim());
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], isBeta: m[4] !== undefined, beta: m[4] ? +m[4] : 0, raw: m[0] };
}
function cmpBase(a, b) {
  return (a.major - b.major) || (a.minor - b.minor) || (a.patch - b.patch);
}
function releaseDateMs(tag) {
  try {
    const url = $.NSURL.URLWithString("https://api.github.com/repos/cadente-hub/cadente-hub.github.io/releases/tags/v" + tag);
    const data = $.NSData.dataWithContentsOfURL(url);
    if (!data) return 0;
    const str = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding);
    const obj = JSON.parse(str.js);
    return Date.parse(obj.published_at || obj.created_at || "") || 0;
  } catch (_) { return 0; }
}
function isNewer(cand, ref, stableHasRefLauncher) {
  if (!cand) return false;
  if (!ref) return true;
  if (cand.raw === ref.raw) return false;
  const base = cmpBase(cand, ref);
  if (base !== 0) return base > 0;
  if (cand.isBeta && ref.isBeta) return cand.beta > ref.beta;
  if (!cand.isBeta && ref.isBeta) return true;
  // Candidate is X.Y.Z-beta.N while current app is X.Y.Z: if X.Y.Z has no launcher payload, beta wins;
  // otherwise compare release timestamps so a newer beta after promotion still updates.
  if (!stableHasRefLauncher) return true;
  const candMs = releaseDateMs(cand.raw);
  const refMs = releaseDateMs(ref.raw);
  return candMs > 0 && refMs > 0 && candMs > refMs;
}
function run(argv) {
  const [platform, appVerRaw, stablePath, betaPath] = argv;
  const stable = readJson(stablePath).releases || [];
  const beta = readJson(betaPath).releases || [];
  const appVer = parseVer(appVerRaw);
  const stableHasAppLauncher = stable.some(r => r.product === "launcher" && r.platform === platform && r.version === appVerRaw);
  let best = null;
  for (const r of stable.concat(beta)) {
    if (r.product !== "launcher" || r.platform !== platform || !r.artifactUrl) continue;
    const v = parseVer(r.version);
    if (!v) continue;
    if (!best) { best = { r, v }; continue; }
    const b = cmpBase(v, best.v);
    if (b > 0 || (b === 0 && !v.isBeta && best.v.isBeta && releaseDateMs(v.raw) >= releaseDateMs(best.v.raw))
        || (b === 0 && v.isBeta && best.v.isBeta && v.beta > best.v.beta)
        || (b === 0 && v.isBeta && !best.v.isBeta && releaseDateMs(v.raw) > releaseDateMs(best.v.raw))) {
      best = { r, v };
    }
  }
  if (!best || !isNewer(best.v, appVer, stableHasAppLauncher)) return "";
  return [best.r.version, best.r.artifactUrl, best.r.artifactDigest || ""].join("\t");
}
JXA
}

NAME="cadente-$VERSION-$SUFFIX"
curl -fsSL "$DOWNLOADS/v$VERSION/SHA256SUMS.txt" -o "$TMP_DIR/checksums"
printf 'Downloading Cadente %s (%s)...\n' "$VERSION" "$NAME"
curl -fL --progress-bar "$DOWNLOADS/v$VERSION/$NAME" -o "$TMP_DIR/artifact"
check_checksum "$TMP_DIR/checksums" "$NAME" "$TMP_DIR/artifact"

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
  LAUNCHER_VERSION="$VERSION"
  if [ "$ARCH" = arm64 ] || [ "$ARCH" = aarch64 ]; then LAUNCHER_PLATFORM="darwin-aarch64"; else LAUNCHER_PLATFORM="darwin-x86_64"; fi
  L_VER=""; L_URL=""; L_DIGEST=""
  IFS=$'\t' read -r L_VER L_URL L_DIGEST <<< "$(latest_darwin_launcher "$LAUNCHER_PLATFORM" "$VERSION")" || true
  if [ -n "${L_VER:-}" ] && [ -n "${L_URL:-}" ] && [[ "$L_VER" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-beta\.[0-9]+)?$ ]]; then
    L_NAME="cadente-launcher-$L_VER-$LAUNCHER_PLATFORM.tar.gz"
    printf 'Updating launcher to %s (%s)...\n' "$L_VER" "$L_NAME"
    curl -fsSL "$DOWNLOADS/v$L_VER/SHA256SUMS.txt" -o "$TMP_DIR/launcher-checksums"
    curl -fL --progress-bar "$DOWNLOADS/v$L_VER/$L_NAME" -o "$TMP_DIR/launcher.tar.gz"
    check_checksum "$TMP_DIR/launcher-checksums" "$L_NAME" "$TMP_DIR/launcher.tar.gz"
    if [ -n "${L_DIGEST:-}" ]; then
      ACTUAL_L_SHA="$(shasum -a 256 "$TMP_DIR/launcher.tar.gz" | awk '{print $1}')"
      if [ "$ACTUAL_L_SHA" != "$L_DIGEST" ]; then echo "Launcher feed digest mismatch; existing installation was preserved" >&2; exit 1; fi
    fi
    tar -xzf "$TMP_DIR/launcher.tar.gz" -C "$WORK"
    if [ ! -x "$WORK/Cadente.app/Contents/MacOS/$EXECUTABLE" ]; then
      echo "Downloaded launcher payload is missing $EXECUTABLE; existing installation was preserved" >&2; exit 1
    fi
    codesign --force --deep --sign - "$WORK/Cadente.app" >/dev/null 2>&1 || true
    LAUNCHER_VERSION="$L_VER"
  fi
  xattr -dr com.apple.quarantine "$WORK/Cadente.app" 2>/dev/null || true
  # All downloads and bundle checks have succeeded before touching the old app.
  pkill -f "Cadente\.app/Contents/MacOS/" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -f "Cadente\.app/Contents/MacOS/" >/dev/null 2>&1 || break
    sleep 0.2
  done
  if [ -e "$TARGET_APP" ]; then mv "$TARGET_APP" "$WORK/previous.app"; fi
  mv "$WORK/Cadente.app" "$TARGET_APP"
  INSTALLED=1
  if [ "$LAUNCHER_VERSION" != "$VERSION" ]; then
    printf 'Cadente %s (launcher %s) installed in %s\n' "$VERSION" "$LAUNCHER_VERSION" "$TARGET_APP"
  else
    printf 'Cadente %s installed in %s\n' "$VERSION" "$TARGET_APP"
  fi
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
