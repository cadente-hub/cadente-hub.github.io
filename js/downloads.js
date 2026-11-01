// Downloads: the file for the visitor's system first, the others below. The version is the one the signed feed
// offers (/feeds/stable.json, or /feeds/beta.json while there is no stable release); its files come from the
// GitHub release of that version, or from the latest release.
import { initPage } from './page.js';
import { t, number } from './i18n.js';

const REPO = 'cadente-hub/cadente-hub.github.io';
const RELEASES = `https://github.com/${REPO}/releases`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Each file the release may have: the system, how it is packaged, and how to recognize it.
const FILES = [
  { id: 'macos-arm64', os: 'macOS', arch: 'Apple Silicon', ext: '.dmg', match: n => /(arm64|aarch64).*\.dmg$/i.test(n) },
  { id: 'macos-x64', os: 'macOS', arch: 'Intel', ext: '.dmg', match: n => /\.dmg$/i.test(n) && !/arm64|aarch64/i.test(n) },
  { id: 'windows-exe', os: 'Windows', arch: 'x64', ext: '.exe', match: n => /\.exe$/i.test(n) },
  { id: 'linux-deb', os: 'Linux', arch: 'Debian, Ubuntu', ext: '.deb', match: n => /\.deb$/i.test(n) },
  { id: 'linux-appimage', os: 'Linux', arch: 'AppImage', ext: '.AppImage', match: n => /\.AppImage$/i.test(n) },
];

function detect() {
  const ua = navigator.userAgent, platform = navigator.userAgentData?.platform ?? navigator.platform ?? '';
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return 'windows-exe';
  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) {
    if (navigator.userAgentData?.architecture === 'x86') return 'macos-x64';
    try {
      const gl = document.createElement('canvas').getContext('webgl'), info = gl?.getExtension('WEBGL_debug_renderer_info');
      if (info && /Intel/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))) return 'macos-x64';
    } catch { /* no WebGL */ }
    return 'macos-arm64';
  }
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return /Fedora|RHEL|SUSE/i.test(ua) ? 'linux-appimage' : 'linux-deb';
  return null;
}

const size = bytes => (bytes ? `${number(bytes / 1048576, { maximumFractionDigits: 1 })} MB` : '');
const label = f => `${f.os} · ${f.arch}`;

function draw(primaryId, assets = {}) {
  const primary = FILES.find(f => f.id === primaryId) ?? FILES[0];
  const a = assets[primary.id];
  document.getElementById('dl-primary').innerHTML = `<p class="dl-primary__os">${esc(label(primary))}<span>${esc(primary.ext)}${a ? ` · ${esc(size(a.size))}` : ''}</span></p>
    <a class="btn btn--light btn--lg" href="${esc(a?.browser_download_url ?? RELEASES)}" rel="noopener">${esc(t('dl.downloadFor', { os: primary.os }))}</a>
    ${primary.os === 'macOS' ? `<p class="dl-primary__note">${t('dl.macNote')}</p>` : ''}`;
  document.getElementById('dl-others').innerHTML = FILES.filter(f => f.id !== primary.id).map(f => {
    const x = assets[f.id];
    return `<li><a href="${esc(x?.browser_download_url ?? RELEASES)}" rel="noopener"><b>${esc(f.os)}</b><span>${esc(f.arch)}</span><i>${esc(f.ext)}${x ? ` · ${esc(size(x.size))}` : ''}</i></a></li>`;
  }).join('');
}

async function json(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw Object.assign(new Error(`${url}: ${r.status}`), { status: r.status });
  return r.json();
}
// The release files keep the same names in every version (cadente-1.1.0-macos-arm64.dmg…), so the links still work
// when the GitHub API says no: it answers 60 calls an hour per address, and an office shares one address.
const NAMES = { 'macos-arm64': 'macos-arm64.dmg', 'macos-x64': 'macos-x64.dmg', 'windows-exe': 'windows-x64.exe', 'linux-deb': 'linux-x64.deb', 'linux-appimage': 'linux-x64.AppImage' };
const byName = version => ({
  tag_name: `v${version}`,
  assets: Object.values(NAMES).map(suffix => ({ name: `cadente-${version}-${suffix}`, browser_download_url: `${RELEASES}/download/v${encodeURIComponent(version)}/cadente-${version}-${suffix}` })),
});
const limited = e => e?.status === 403 || e?.status === 429;
// The version a channel's signed feed offers, or null when the channel has no release yet.
const feedVersion = channel => json(`/feeds/${channel}.json`).then(f => f.releases?.[0]?.version ?? null, () => null);
async function release() {
  const version = (await feedVersion('stable')) ?? (await feedVersion('beta'));
  const known = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? '');
  if (known) {
    try { return await json(`https://api.github.com/repos/${REPO}/releases/tags/v${encodeURIComponent(version)}`); }
    catch (e) { if (limited(e)) return byName(version); /* else the latest release */ }
  }
  try { return await json(`https://api.github.com/repos/${REPO}/releases/latest`); }
  catch (e) { if (known) return byName(version); throw e; }
}

initPage();
const detected = detect();
const found = FILES.find(f => f.id === detected);
document.getElementById('dl-detected').textContent = found ? t('dl.detected', { os: label(found) }) : t('dl.pick');
draw(detected);
release().then(r => {
  const assets = {};
  for (const f of FILES) { const a = (r.assets ?? []).find(x => f.match(x.name)); if (a) assets[f.id] = a; }
  document.getElementById('dl-version').textContent = r.tag_name ?? r.name ?? '';
  draw(detected, assets);
}).catch(() => {
  document.getElementById('dl-version').textContent = '—';
  document.getElementById('dl-fallback').hidden = false;
});
