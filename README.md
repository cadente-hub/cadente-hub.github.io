# Catarina AI

[![Latest Release](https://img.shields.io/github/v/release/catarina-claude/catarina-claude.github.io?style=flat-square&color=6366f1)](https://github.com/catarina-claude/catarina-claude.github.io/releases/latest)
[![GitHub Pages](https://img.shields.io/github/actions/workflow/status/catarina-claude/catarina-claude.github.io/deploy-site.yml?label=website&style=flat-square)](https://catarina-claude.github.io)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

Your AI-Powered Desktop Assistant — bringing the power of Claude directly to your desktop.

🌐 **Website**: [catarina-claude.github.io](https://catarina-claude.github.io)

## Downloads

| Platform | Architecture | Download |
|----------|-------------|----------|
| macOS | Apple Silicon (ARM64) | [`.dmg`](https://github.com/catarina-claude/catarina-claude.github.io/releases/latest) |
| macOS | Intel (x86_64) | [`.dmg`](https://github.com/catarina-claude/catarina-claude.github.io/releases/latest) |
| Linux | x86_64 | [`.AppImage`](https://github.com/catarina-claude/catarina-claude.github.io/releases/latest) / [`.deb`](https://github.com/catarina-claude/catarina-claude.github.io/releases/latest) |
| Windows | x86_64 | [`.exe`](https://github.com/catarina-claude/catarina-claude.github.io/releases/latest) / [`.msi`](https://github.com/catarina-claude/catarina-claude.github.io/releases/latest) |

## Installation

### macOS

1. Download the `.dmg` file for your architecture (Apple Silicon or Intel)
2. Open the `.dmg` and drag **Catarina AI** to your Applications folder
3. On first launch, right-click → Open (to bypass Gatekeeper until code signing is set up)

### Linux

**AppImage:**
```bash
chmod +x catarina-ai-*-linux-x64.AppImage
./catarina-ai-*-linux-x64.AppImage
```

**Debian/Ubuntu:**
```bash
sudo dpkg -i catarina-ai-*-linux-x64.deb
```

### Windows

Run the `.exe` installer or `.msi` package. Follow the installation wizard.

## Features

- 🚀 **AI-Powered Coding** — Integrated Claude Code CLI for intelligent code assistance
- 🔀 **Git Workspace Management** — Worktree-based isolation for organized projects
- 💬 **Real-time Streaming** — Watch AI responses appear instantly
- 🖥️ **Cross-Platform** — Native performance on macOS, Windows, and Linux

## Auto-Updates

The app includes a built-in auto-updater. When a new version is available, you'll be notified and can update with one click.

## Built With

- [Tauri 2](https://tauri.app) — Rust backend, WebView frontend
- [React 19](https://react.dev) — UI framework
- [Rust](https://www.rust-lang.org) — Backend logic
- [Vite](https://vitejs.dev) — Build tooling

## License

MIT
