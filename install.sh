#!/usr/bin/env bash
# ==============================================================================
# Cadente Universal 1-Line Installer (macOS & Linux)
# Installs Cadente with zero friction, removes macOS Gatekeeper quarantine,
# signs ad-hoc for Apple Silicon, and launches the app immediately.
# ==============================================================================
set -euo pipefail

BOLD="$(tput bold 2>/dev/null || printf '')"
GREEN="$(tput setaf 2 2>/dev/null || printf '')"
BLUE="$(tput setaf 4 2>/dev/null || printf '')"
YELLOW="$(tput setaf 3 2>/dev/null || printf '')"
RED="$(tput setaf 1 2>/dev/null || printf '')"
RESET="$(tput sgr0 2>/dev/null || printf '')"

printf "\n%s\n\n" "${BOLD}${BLUE}=== Cadente Installer ===${RESET}"

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    printf "Detected: %smacOS (%s)%s\n" "${BOLD}" "$ARCH" "${RESET}"

    if [ "$ARCH" = "arm64" ]; then
      TARGET_KEY="darwin-aarch64"
      FALLBACK_NAME="cadente-latest-macos-arm64.app.tar.gz"
    else
      TARGET_KEY="darwin-x86_64"
      FALLBACK_NAME="cadente-latest-macos-x64.app.tar.gz"
    fi

    MANIFEST_URL="https://cadente-hub.github.io/update-beta.json"
    printf "Fetching latest release information...\n"

    DOWNLOAD_URL=""
    if command -v curl >/dev/null 2>&1; then
      MANIFEST_JSON="$(curl -fsSL "$MANIFEST_URL" 2>/dev/null || curl -fsSL "https://cadente-hub.github.io/update.json" 2>/dev/null || true)"
      if [ -n "$MANIFEST_JSON" ]; then
        DOWNLOAD_URL="$(printf '%s' "$MANIFEST_JSON" | grep -A 4 "\"$TARGET_KEY\"" | grep '"url"' | head -n 1 | cut -d '"' -f 4 || true)"
      fi
    fi

    if [ -z "$DOWNLOAD_URL" ]; then
      DOWNLOAD_URL="https://github.com/cadente-hub/cadente-hub.github.io/releases/latest/download/$FALLBACK_NAME"
    fi

    INSTALL_DIR="/Applications"
    if [ ! -w "$INSTALL_DIR" ]; then
      INSTALL_DIR="$HOME/Applications"
      mkdir -p "$INSTALL_DIR"
    fi
    TARGET_APP="$INSTALL_DIR/Cadente.app"

    TMP_DIR="$(mktemp -d -t cadente-install-XXXXXX)"
    trap 'rm -rf "$TMP_DIR"' EXIT

    printf "Downloading Cadente...\n"
    curl -fL --progress-bar "$DOWNLOAD_URL" -o "$TMP_DIR/cadente.tar.gz"

    printf "Installing to %s...\n" "$TARGET_APP"
    pkill -f "Cadente.app/Contents/MacOS" 2>/dev/null || true
    sleep 0.5
    rm -rf "$TARGET_APP"
    tar -xzf "$TMP_DIR/cadente.tar.gz" -C "$INSTALL_DIR"

    printf "Clearing Gatekeeper quarantine & registering application...\n"
    xattr -dr com.apple.quarantine "$TARGET_APP" 2>/dev/null || true
    xattr -cr "$TARGET_APP" 2>/dev/null || true
    codesign --force --deep --sign - "$TARGET_APP" 2>/dev/null || true
    /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$TARGET_APP" 2>/dev/null || true

    printf "\n%s\n" "${GREEN}✓ Cadente installed successfully in $TARGET_APP${RESET}"
    printf "%s\n" "${GREEN}✓ Gatekeeper quarantine cleared (no 'move to trash' warning).${RESET}"
    printf "%s\n\n" "${GREEN}✓ Launching Cadente...${RESET}"

    open "$TARGET_APP"
    ;;

  Linux)
    printf "Detected: %sLinux (%s)%s\n" "${BOLD}" "$ARCH" "${RESET}"
    MANIFEST_URL="https://cadente-hub.github.io/update-beta.json"
    printf "Fetching latest release information...\n"

    DOWNLOAD_URL=""
    if command -v curl >/dev/null 2>&1; then
      MANIFEST_JSON="$(curl -fsSL "$MANIFEST_URL" 2>/dev/null || curl -fsSL "https://cadente-hub.github.io/update.json" 2>/dev/null || true)"
      if [ -n "$MANIFEST_JSON" ]; then
        DOWNLOAD_URL="$(printf '%s' "$MANIFEST_JSON" | grep -A 4 '"linux-x86_64"' | grep '"url"' | head -n 1 | cut -d '"' -f 4 || true)"
      fi
    fi

    if [ -z "$DOWNLOAD_URL" ]; then
      DOWNLOAD_URL="https://github.com/cadente-hub/cadente-hub.github.io/releases/latest/download/cadente-latest-linux-x64.AppImage.tar.gz"
    fi

    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"

    TMP_DIR="$(mktemp -d -t cadente-install-XXXXXX)"
    trap 'rm -rf "$TMP_DIR"' EXIT

    printf "Downloading Cadente...\n"
    curl -fL --progress-bar "$DOWNLOAD_URL" -o "$TMP_DIR/cadente.tar.gz"
    tar -xzf "$TMP_DIR/cadente.tar.gz" -C "$TMP_DIR"

    APP_IMAGE="$(find "$TMP_DIR" -name "*.AppImage" | head -n 1)"
    if [ -n "$APP_IMAGE" ]; then
      chmod +x "$APP_IMAGE"
      cp "$APP_IMAGE" "$INSTALL_DIR/cadente"
      printf "\n%s\n" "${GREEN}✓ Cadente binary installed in $INSTALL_DIR/cadente${RESET}"

      # Desktop entry
      DESKTOP_DIR="$HOME/.local/share/applications"
      mkdir -p "$DESKTOP_DIR"
      cat <<DESKTOPEOF > "$DESKTOP_DIR/cadente.desktop"
[Desktop Entry]
Name=Cadente
Comment=AI-powered desktop assistant with native launcher
Exec=$INSTALL_DIR/cadente
Terminal=false
Type=Application
Categories=Development;IDE;
DESKTOPEOF
      printf "%s\n" "${GREEN}✓ Desktop shortcut created in $DESKTOP_DIR/cadente.desktop${RESET}"
      printf "%s\n\n" "${GREEN}✓ Launching Cadente...${RESET}"
      nohup "$INSTALL_DIR/cadente" >/dev/null 2>&1 &
    else
      printf "%s\n" "${RED}Error: AppImage not found in archive.${RESET}"
      exit 1
    fi
    ;;

  *)
    printf "\n%s\n" "${RED}Unsupported operating system for bash script.${RESET}"
    printf "On Windows, open PowerShell and run:\n"
    printf "  irm https://cadente-hub.github.io/install.ps1 | iex\n\n"
    exit 1
    ;;
esac
