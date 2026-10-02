# Cadente

[![Latest Release](https://img.shields.io/github/v/release/cadente-hub/cadente-hub.github.io?style=flat-square&color=6366f1)](https://github.com/cadente-hub/cadente-hub.github.io/releases/latest)
[![GitHub Pages](https://img.shields.io/github/actions/workflow/status/cadente-hub/cadente-hub.github.io/deploy-site.yml?label=website&style=flat-square)](https://cadente-hub.github.io)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

A desktop AI workspace for developers — use Claude, ChatGPT, Gemini or a local model with your repositories, terminals and pull requests.

🌐 **Website**: [cadente-hub.github.io](https://cadente-hub.github.io)

## Downloads

| Platform | Architecture | Download |
|----------|-------------|----------|
| macOS | Apple Silicon (ARM64) | [`.dmg`](https://github.com/cadente-hub/cadente-hub.github.io/releases/latest) |
| macOS | Intel (x86_64) | [`.dmg`](https://github.com/cadente-hub/cadente-hub.github.io/releases/latest) |
| Linux | x86_64 | [`.AppImage`](https://github.com/cadente-hub/cadente-hub.github.io/releases/latest) / [`.deb`](https://github.com/cadente-hub/cadente-hub.github.io/releases/latest) |
| Windows | x86_64 | [`.exe`](https://github.com/cadente-hub/cadente-hub.github.io/releases/latest) / [`.msi`](https://github.com/cadente-hub/cadente-hub.github.io/releases/latest) |

## Installation

### macOS

1. Download the `.dmg` file for your architecture (Apple Silicon or Intel)
2. Open the `.dmg` and drag **Cadente** to your Applications folder
3. On first launch, right-click → Open (to bypass Gatekeeper until code signing is set up)

### Linux

**AppImage:**
```bash
chmod +x cadente-*-linux-x64.AppImage
./cadente-*-linux-x64.AppImage
```

**Debian/Ubuntu:**
```bash
sudo dpkg -i cadente-*-linux-x64.deb
```

### Windows

Run the `.exe` installer or `.msi` package. Follow the installation wizard.

## Features

- **Any model** — Claude and ChatGPT subscriptions (via the official CLIs), API keys for Anthropic, OpenAI, Gemini, DeepSeek, OpenRouter and other OpenAI-compatible providers, or local models through Ollama and LM Studio
- **Chat with project context** — plan mode, message queue, conversation branching and undo to any earlier turn
- **Workspaces & PR reviews** — Git worktree isolation, inline diff review, pull request tracking and AI-assisted review
- **Terminals** — real shells the AI can read, in tabs or their own window
- **Automations** — scheduled AI tasks with run history
- **In control** — tool permission modes, guarded destructive actions, sandboxed shell and reversible file edits
- **More** — prompt builder, API requests, MCP servers and Skills, focus tools, calendar, diagrams and profiles
- **Cross-platform** — macOS, Windows and Linux, in 15 interface languages

## Auto-Updates

The app includes a built-in auto-updater. When a new version is available, you'll be notified and can update with one click.

## Built With

- [Tauri 2](https://tauri.app) — Rust backend, WebView frontend
- [React 19](https://react.dev) — UI framework
- [Rust](https://www.rust-lang.org) — Backend logic
- [Vite](https://vitejs.dev) — Build tooling

## License

MIT
