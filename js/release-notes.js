/**
 * Cadente release notes page.
 * Reads public update manifests and GitHub releases.
 */
import './main.js';
import './animations.js';

const GITHUB_REPO = 'cadente-hub/cadente-hub.github.io';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=40`;
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
const STABLE_MANIFEST = './update.json';
const BETA_MANIFEST = './update-beta.json';

const stableList = document.getElementById('stable-release-list');
const betaList = document.getElementById('beta-release-list');
const stableVersion = document.getElementById('stable-version');
const betaVersion = document.getElementById('beta-version');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseVersion(tag) {
  const version = String(tag || '').replace(/^v/, '').trim();
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) return null;
  return version;
}

function releaseChannel(version, prerelease) {
  return prerelease || version.includes('-beta') ? 'beta' : 'stable';
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function markdownToHtml(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const html = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      continue;
    }

    if (line.startsWith('## ')) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<h3>${inlineMarkdown(line.slice(3))}</h3>`);
      continue;
    }

    if (line.startsWith('### ')) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<h4>${inlineMarkdown(line.slice(4))}</h4>`);
      continue;
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    if (inList) {
      html.push('</ul>');
      inList = false;
    }
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  if (inList) html.push('</ul>');
  return html.join('');
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json();
}

function manifestRelease(manifest, channel) {
  return {
    version: manifest.version,
    channel,
    tag: channel === 'beta' ? `v${manifest.version}` : `v${manifest.version}`,
    name: `Cadente v${manifest.version}`,
    date: manifest.pub_date,
    body: manifest.notes || '',
    htmlUrl: `${RELEASES_URL}/tag/v${manifest.version}`,
    latest: true,
  };
}

function githubRelease(release) {
  const version = parseVersion(release.tag_name);
  if (!version) return null;
  const channel = releaseChannel(version, release.prerelease);
  return {
    version,
    channel,
    tag: release.tag_name,
    name: release.name || `Cadente v${version}`,
    date: release.published_at,
    body: release.body || '',
    htmlUrl: release.html_url,
    latest: false,
  };
}

function dedupeByVersion(releases) {
  const seen = new Set();
  return releases.filter((release) => {
    if (!release?.version || seen.has(release.version)) return false;
    seen.add(release.version);
    return true;
  });
}

function renderRelease(release) {
  const date = formatDate(release.date);
  return `
    <article class="release-note">
      <div class="release-note__meta">
        <span class="release-note__version">v${escapeHtml(release.version)}</span>
        ${release.latest ? '<span class="release-note__badge">Latest</span>' : ''}
        ${date ? `<span class="release-note__date">${escapeHtml(date)}</span>` : ''}
      </div>
      <div class="release-note__body">
        ${markdownToHtml(release.body || `Cadente v${release.version}`)}
      </div>
      <a class="release-note__link" href="${escapeHtml(release.htmlUrl)}" target="_blank" rel="noopener noreferrer">View on GitHub</a>
    </article>
  `;
}

function renderList(target, releases) {
  if (!target) return;
  if (!releases.length) {
    target.innerHTML = '<div class="release-loading">No release notes found.</div>';
    return;
  }
  target.innerHTML = releases.map(renderRelease).join('');
}

async function initReleaseNotes() {
  try {
    const [stableManifest, betaManifest, githubRaw] = await Promise.all([
      fetchJson(STABLE_MANIFEST),
      fetchJson(BETA_MANIFEST),
      fetchJson(RELEASES_API),
    ]);

    const githubReleases = githubRaw.map(githubRelease).filter(Boolean);
    const stable = dedupeByVersion([
      manifestRelease(stableManifest, 'stable'),
      ...githubReleases.filter((release) => release.channel === 'stable'),
    ]).slice(0, 8);
    const beta = dedupeByVersion([
      manifestRelease(betaManifest, 'beta'),
      ...githubReleases.filter((release) => release.channel === 'beta'),
    ]).slice(0, 8);

    stableVersion.textContent = stable[0] ? `v${stable[0].version}` : 'Unavailable';
    betaVersion.textContent = beta[0] ? `v${beta[0].version}` : 'Unavailable';
    renderList(stableList, stable);
    renderList(betaList, beta);
  } catch (error) {
    console.error('Failed to load release notes:', error);
    stableVersion.textContent = 'Unavailable';
    betaVersion.textContent = 'Unavailable';
    const fallback = `
      <div class="release-loading">
        Could not load release notes.
        <a href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer">Open GitHub releases</a>.
      </div>
    `;
    if (stableList) stableList.innerHTML = fallback;
    if (betaList) betaList.innerHTML = fallback;
  }
}

initReleaseNotes();
