/**
 * Catarina Claude - Downloads Page Logic
 * Handles: GitHub Releases API fetch, OS detection, dynamic download links
 * Layout: Big hero card for detected platform, compact grid for others
 */

const GITHUB_REPO = 'catarina-claude/catarina-claude.github.io';
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

// Platform mapping: filename patterns -> platform keys
const PLATFORM_PATTERNS = {
  'macos-arm64': { match: (name) => /macos.*arm64.*\.dmg$/i.test(name) || /aarch64.*\.dmg$/i.test(name) },
  'macos-x64': { match: (name) => /macos.*x64.*\.dmg$/i.test(name) || /x86_64.*\.dmg$/i.test(name) || (/\.dmg$/i.test(name) && !/arm64|aarch64/i.test(name)) },
  'linux-appimage': { match: (name) => /linux.*x64.*\.AppImage$/i.test(name) || /\.AppImage$/i.test(name) },
  'linux-deb': { match: (name) => /linux.*x64.*\.deb$/i.test(name) || /\.deb$/i.test(name) },
  'windows-exe': { match: (name) => /windows.*x64.*\.exe$/i.test(name) || (/\.exe$/i.test(name) && !/\.msi/i.test(name)) },
  'windows-msi': { match: (name) => /windows.*x64.*\.msi$/i.test(name) || /\.msi$/i.test(name) },
};

// SVG Icons (monochrome, professional)
const SVG_ICONS = {
  apple: `<svg viewBox="0 0 24 24" fill="currentColor" class="platform-icon"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`,
  linux: `<svg viewBox="0 0 24 24" fill="currentColor" class="platform-icon"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602.01.199.059.389.137.564.259.56.848.59 1.314.596.3.003.548-.02.727-.048.096.131.226.256.418.376.405.254.878.379 1.344.379.543 0 1.074-.165 1.46-.555.155-.148.276-.338.372-.563h1.306c.096.225.217.415.372.563.386.39.917.555 1.46.555.466 0 .939-.125 1.344-.379.192-.12.322-.245.418-.376.179.028.427.051.727.048.466-.006 1.055-.036 1.314-.596.078-.175.127-.365.137-.564.004-.208-.042-.413-.132-.602-.206-.411-.551-.544-.864-.68-.312-.133-.598-.201-.797-.4-.213-.239-.403-.571-.663-.839a.424.424 0 00-.11-.135c.123-.805-.009-1.657-.287-2.489-.589-1.771-1.831-3.47-2.716-4.521-.75-1.067-.974-1.928-1.05-3.02-.065-1.491 1.056-5.965-3.17-6.298A5.042 5.042 0 0012.504 0zm-.218 1.53c.057-.003.12 0 .186.007 1.168.138 1.578 1.468 1.57 2.618-.008 1.197-.238 2.208-.88 3.312-.802 1.26-1.862 2.8-2.406 4.444-.258.788-.378 1.573-.278 2.267-.036-.003-.072-.004-.109-.004a1.86 1.86 0 00-.537.08c-.052-.467-.02-.937.115-1.393.432-1.444 1.335-2.9 2.127-4.148.79-1.228 1.068-2.353 1.083-3.622.016-1.292-.596-2.343-1.053-2.805a.764.764 0 01.182-.756z"/></svg>`,
  windows: `<svg viewBox="0 0 24 24" fill="currentColor" class="platform-icon"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>`,
};

// CLI install commands per platform
// macOS: installs Homebrew if missing, then installs the app
const BREW_INSTALL = 'command -v brew >/dev/null || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
const BREW_CASK = 'brew tap catarina-claude/apps && brew install --cask catarina-claude';
const CLI_COMMANDS = {
  'macos-arm64': `${BREW_INSTALL} && ${BREW_CASK}`,
  'macos-x64': `${BREW_INSTALL} && ${BREW_CASK}`,
  'linux-appimage': 'curl -fsSL https://github.com/catarina-claude/catarina-claude.github.io/releases/latest/download/catarina-claude-linux-x64.AppImage -o catarina-claude.AppImage && chmod +x catarina-claude.AppImage',
  'linux-deb': 'curl -fsSL https://github.com/catarina-claude/catarina-claude.github.io/releases/latest/download/catarina-claude-linux-x64.deb -o catarina-claude.deb && sudo dpkg -i catarina-claude.deb',
  'windows-exe': 'winget install catarina-claude',
  'windows-msi': 'winget install catarina-claude --installer-type msi',
};

// Platform display info
const PLATFORM_INFO = {
  'macos-arm64': { icon: SVG_ICONS.apple, title: 'macOS', arch: 'Apple Silicon', format: '.dmg', btnLabel: 'Download for macOS (Apple Silicon)' },
  'macos-x64': { icon: SVG_ICONS.apple, title: 'macOS', arch: 'Intel (x86_64)', format: '.dmg', btnLabel: 'Download for macOS (Intel)' },
  'linux-appimage': { icon: SVG_ICONS.linux, title: 'Linux', arch: 'x86_64 (AppImage)', format: '.AppImage', btnLabel: 'Download AppImage' },
  'linux-deb': { icon: SVG_ICONS.linux, title: 'Linux', arch: 'x86_64 (Debian/Ubuntu)', format: '.deb', btnLabel: 'Download .deb Package' },
  'windows-exe': { icon: SVG_ICONS.windows, title: 'Windows', arch: 'x86_64 (Installer)', format: '.exe', btnLabel: 'Download .exe Installer' },
  'windows-msi': { icon: SVG_ICONS.windows, title: 'Windows', arch: 'x86_64 (MSI)', format: '.msi', btnLabel: 'Download .msi Package' },
};

// Group platforms by OS family
const OS_FAMILIES = {
  macos: ['macos-arm64', 'macos-x64'],
  linux: ['linux-appimage', 'linux-deb'],
  windows: ['windows-exe', 'windows-msi'],
};

// ---------- OS Detection ----------
function detectOS() {
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';

  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) {
    return detectMacArch();
  }

  if (/Linux/i.test(platform) || /Linux/i.test(ua)) {
    return 'linux-appimage';
  }

  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    return 'windows-exe';
  }

  return null;
}

function detectMacArch() {
  // Method 1: Check navigator.userAgentData (Chromium 90+)
  if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    // This is async but we need sync — use the sync hints if available
    const brands = navigator.userAgentData.brands || [];
    // On ARM Macs, the architecture in userAgentData is 'arm'
    if (navigator.userAgentData.architecture === 'arm') return 'macos-arm64';
    if (navigator.userAgentData.architecture === 'x86') return 'macos-x64';
  }

  // Method 2: Check WebGL renderer for Apple GPU (Apple Silicon has Apple GPU, Intel has Intel GPU)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        // Apple Silicon GPUs show as "Apple M1", "Apple M2", "Apple GPU", etc.
        if (/Apple M|Apple GPU/i.test(renderer)) return 'macos-arm64';
        // Intel GPUs show as "Intel" on Intel Macs
        if (/Intel/i.test(renderer)) return 'macos-x64';
      }
    }
  } catch (e) {
    // WebGL not available
  }

  // Method 3: Check platform string
  const platform = navigator.platform || '';
  if (/arm/i.test(platform)) return 'macos-arm64';

  // Default: Intel (safer default — ARM users on modern browsers will be caught above)
  return 'macos-x64';
}

function getOSDisplayName(platform) {
  const info = PLATFORM_INFO[platform];
  return info ? `${info.title} ${info.arch}` : 'your platform';
}

// ---------- Format Helpers ----------
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '--';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

// ---------- CLI Snippet Builder ----------
function buildCLISnippet(platformKey) {
  const cmd = CLI_COMMANDS[platformKey];
  if (!cmd) return '';
  return `
    <div class="cli-snippet">
      <div class="cli-snippet__header">
        <span class="cli-snippet__label">Terminal</span>
        <button class="cli-snippet__copy" data-copy="${platformKey}" aria-label="Copy command" title="Copy to clipboard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cli-snippet__copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cli-snippet__check-icon"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </div>
      <div class="cli-snippet__body">
        <code class="cli-snippet__code" id="cli-cmd-${platformKey}">$ ${cmd}</code>
      </div>
    </div>
  `;
}

// Copy to clipboard handler
function initCopyButtons() {
  document.querySelectorAll('.cli-snippet__copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const platformKey = btn.dataset.copy;
      const cmd = CLI_COMMANDS[platformKey];
      if (!cmd) return;

      try {
        await navigator.clipboard.writeText(cmd);
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 2000);
      } catch {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = cmd;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 2000);
      }
    });
  });
}

// ---------- macOS Guided Install ----------
function initMacInstallButton() {
  const btn = document.getElementById('mac-install-btn');
  const steps = document.getElementById('mac-install-steps');
  if (!btn || !steps) return;

  btn.addEventListener('click', async () => {
    const cmd = CLI_COMMANDS['macos-arm64'];
    try {
      await navigator.clipboard.writeText(cmd);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = cmd;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    // Show steps with animation
    steps.hidden = false;
    steps.classList.add('visible');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><polyline points="20 6 9 17 4 12"/></svg>
      Copied! Follow steps below
    `;
    btn.classList.add('btn--success');
    btn.disabled = true;
  });
}

// ---------- Dynamic Layout Builder ----------
function buildDownloadsLayout(detectedOS) {
  const container = document.getElementById('downloads-dynamic');
  if (!container) return;

  // Determine the primary platform and alternatives
  const primaryPlatform = detectedOS || 'macos-arm64';
  const allPlatforms = Object.keys(PLATFORM_INFO);
  const otherPlatforms = allPlatforms.filter((p) => p !== primaryPlatform);

  // Build the hero (primary) card
  const primaryInfo = PLATFORM_INFO[primaryPlatform];
  const isMac = primaryPlatform.startsWith('macos-');

  // macOS gets a "Recommended: install via terminal" with a guided flow
  const macInstallerHTML = isMac
    ? `
      <div class="download-hero-card__options">
        <button class="btn btn--primary btn--lg download-hero-card__btn" id="mac-install-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Copy Install Command
        </button>
        <div class="install-steps" id="mac-install-steps" hidden>
          <div class="install-steps__success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="install-steps__check"><polyline points="20 6 9 17 4 12"/></svg>
            Command copied!
          </div>
          <div class="install-steps__guide">
            <div class="install-step">
              <span class="install-step__num">1</span>
              <span>Open <strong>Terminal</strong> — press <kbd>⌘</kbd> + <kbd>Space</kbd>, type <strong>Terminal</strong>, hit Enter</span>
            </div>
            <div class="install-step">
              <span class="install-step__num">2</span>
              <span>Paste with <kbd>⌘</kbd> + <kbd>V</kbd> and press <strong>Enter</strong></span>
            </div>
            <div class="install-step">
              <span class="install-step__num">3</span>
              <span>If it asks for a password, type your <strong>Mac password</strong> and press Enter <span class="install-step__note">(the characters won't appear — that's normal)</span></span>
            </div>
            <div class="install-step">
              <span class="install-step__num">4</span>
              <span>Done! It installs everything automatically and opens the app.</span>
            </div>
          </div>
        </div>
        <div class="download-hero-card__or">
          <span>or download manually</span>
        </div>
        <a class="btn btn--outline btn--lg download-hero-card__btn download-hero-card__btn--secondary" data-download="${primaryPlatform}" href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer">
          <span class="btn__icon">↓</span>
          ${primaryInfo.btnLabel}
        </a>
      </div>`
    : `
      <a class="btn btn--primary btn--lg download-hero-card__btn" data-download="${primaryPlatform}" href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer">
        <span class="btn__icon">↓</span>
        ${primaryInfo.btnLabel}
      </a>`;

  const heroHTML = `
    <div class="download-hero-card animate-on-scroll" data-platform="${primaryPlatform}">
      <div class="download-hero-card__badge">
        <span class="download-hero-card__badge-dot"></span>
        Detected: ${primaryInfo.title} ${primaryInfo.arch}
      </div>
      <div class="download-hero-card__content">
        <div class="download-hero-card__icon">${primaryInfo.icon}</div>
        <div class="download-hero-card__info">
          <h2 class="download-hero-card__title">Download for ${primaryInfo.title}</h2>
          <p class="download-hero-card__arch">${primaryInfo.arch}</p>
          <div class="download-hero-card__meta">
            <span class="download-card__format">${primaryInfo.format}</span>
            <span class="download-card__size" data-size="${primaryPlatform}">--</span>
          </div>
        </div>
      </div>
      ${macInstallerHTML}
      ${buildCLISnippet(primaryPlatform)}
    </div>
  `;

  // Build the compact grid of other platforms
  const othersHTML = otherPlatforms
    .map(
      (platformKey) => {
        const info = PLATFORM_INFO[platformKey];
        return `
      <div class="download-alt-card animate-on-scroll" data-platform="${platformKey}">
        <div class="download-alt-card__top">
          <div class="download-alt-card__left">
            <span class="download-alt-card__icon">${info.icon}</span>
            <div>
              <h3 class="download-alt-card__title">${info.title}</h3>
              <p class="download-alt-card__arch">${info.arch}</p>
            </div>
          </div>
          <div class="download-alt-card__right">
            <div class="download-alt-card__meta">
              <span class="download-card__format">${info.format}</span>
              <span class="download-card__size" data-size="${platformKey}">--</span>
            </div>
            <a class="btn btn--sm btn--outline download-alt-card__btn" data-download="${platformKey}" href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer">
              <span class="btn__icon">↓</span>
              Download
            </a>
          </div>
        </div>
        ${buildCLISnippet(platformKey)}
      </div>
    `;
      }
    )
    .join('');

  container.innerHTML = `
    ${heroHTML}
    <div class="download-alt-section">
      <h3 class="download-alt-section__title">Other platforms</h3>
      <div class="download-alt-grid">
        ${othersHTML}
      </div>
    </div>
  `;

  // Re-observe for scroll animations (elements were just created)
  container.querySelectorAll('.animate-on-scroll').forEach((el) => {
    requestAnimationFrame(() => el.classList.add('visible'));
  });

  // Init copy buttons
  initCopyButtons();

  // Init macOS guided install button
  initMacInstallButton();
}

// ---------- Fetch and Render ----------
async function fetchLatestRelease() {
  const versionValue = document.getElementById('version-value');
  const fallback = document.getElementById('downloads-fallback');
  const osMsg = document.getElementById('os-detect-msg');

  // Detect OS
  const detectedOS = detectOS();

  // Update subtitle
  if (osMsg) {
    if (detectedOS) {
      const info = PLATFORM_INFO[detectedOS];
      osMsg.textContent = `We detected ${info.title} ${info.arch} — your download is ready.`;
    } else {
      osMsg.textContent = 'Select the download for your operating system.';
    }
  }

  // Build the dynamic layout
  buildDownloadsLayout(detectedOS);

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const release = await response.json();

    // Update version badge
    if (versionValue) {
      versionValue.textContent = release.tag_name || release.name || 'Unknown';
    }

    // Map assets to platforms
    const assets = release.assets || [];

    for (const [platformKey, config] of Object.entries(PLATFORM_PATTERNS)) {
      const asset = assets.find((a) => config.match(a.name));

      if (asset) {
        // Update download link
        const btn = document.querySelector(`[data-download="${platformKey}"]`);
        if (btn) btn.href = asset.browser_download_url;

        // Update file size
        const sizeEl = document.querySelector(`[data-size="${platformKey}"]`);
        if (sizeEl) sizeEl.textContent = formatBytes(asset.size);
      }
    }
  } catch (error) {
    console.warn('Failed to fetch latest release:', error.message);

    if (versionValue) versionValue.textContent = 'Check GitHub';
    if (fallback) fallback.hidden = false;

    document.querySelectorAll('[data-download]').forEach((btn) => {
      btn.href = RELEASES_URL;
    });
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  fetchLatestRelease();
});
