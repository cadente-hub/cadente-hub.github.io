/**
 * Catarina AI - Downloads Page Logic
 * Handles: GitHub Releases API fetch, OS detection, dynamic download links
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

// ---------- OS Detection ----------
function detectOS() {
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';

  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) {
    // Try to detect Apple Silicon vs Intel
    // There's no 100% reliable way from the browser, so we default to ARM for modern Macs
    return 'macos-arm64';
  }

  if (/Linux/i.test(platform) || /Linux/i.test(ua)) {
    return 'linux-appimage';
  }

  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    return 'windows-exe';
  }

  return null;
}

function getOSDisplayName(platform) {
  const names = {
    'macos-arm64': 'macOS (Apple Silicon)',
    'macos-x64': 'macOS (Intel)',
    'linux-appimage': 'Linux',
    'linux-deb': 'Linux',
    'windows-exe': 'Windows',
    'windows-msi': 'Windows',
  };
  return names[platform] || 'your platform';
}

// ---------- Format Helpers ----------
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '--';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------- Fetch and Render ----------
async function fetchLatestRelease() {
  const versionValue = document.getElementById('version-value');
  const fallback = document.getElementById('downloads-fallback');
  const osMsg = document.getElementById('os-detect-msg');

  // Detect OS and show message
  const detectedOS = detectOS();
  if (osMsg) {
    if (detectedOS) {
      osMsg.textContent = `We detected you're on ${getOSDisplayName(detectedOS)}. Your recommended download is highlighted.`;
    } else {
      osMsg.textContent = 'Select the download for your operating system.';
    }
  }

  // Highlight recommended platform card
  if (detectedOS) {
    const recommendedCard = document.querySelector(`[data-platform="${detectedOS}"]`);
    if (recommendedCard) {
      recommendedCard.classList.add('recommended');
      const badge = recommendedCard.querySelector('.download-card__recommended');
      if (badge) badge.hidden = false;
    }
  }

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
        if (btn) {
          btn.href = asset.browser_download_url;
        }

        // Update file size
        const sizeEl = document.querySelector(`[data-size="${platformKey}"]`);
        if (sizeEl) {
          sizeEl.textContent = formatBytes(asset.size);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to fetch latest release:', error.message);

    // Update version badge to show fallback
    if (versionValue) {
      versionValue.textContent = 'Check GitHub';
    }

    // Show fallback section
    if (fallback) {
      fallback.hidden = false;
    }

    // Ensure all download links point to releases page
    document.querySelectorAll('.download-card__btn').forEach((btn) => {
      btn.href = RELEASES_URL;
    });
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  fetchLatestRelease();
});
