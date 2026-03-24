#!/bin/bash
# Catarina Claude — One-Click Installer for macOS
# Double-click this file to install automatically.

set -e

clear
echo ""
echo "  ◆  Catarina Claude Installer"
echo "  ─────────────────────────────"
echo ""

# --- Step 1: Check / Install Homebrew ---
if command -v brew &>/dev/null; then
  echo "  ✓  Homebrew found"
else
  echo "  ⏳ Installing Homebrew (may ask for your password)..."
  echo ""
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  # Add brew to PATH for Apple Silicon Macs
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi

  echo ""
  echo "  ✓  Homebrew installed"
fi

echo ""

# --- Step 2: Tap & Install ---
echo "  ⏳ Installing Catarina Claude..."
echo ""
brew tap catarina-claude/apps 2>/dev/null
brew install --cask catarina-claude

echo ""
echo "  ─────────────────────────────"
echo "  ✓  Catarina Claude installed!"
echo ""
echo "  Opening the app now..."
echo ""

open -a "Catarina Claude" 2>/dev/null || echo "  You can find it in your Applications folder."

echo ""
echo "  You can close this window."
echo ""
