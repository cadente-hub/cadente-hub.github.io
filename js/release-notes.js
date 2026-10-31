// Release notes: the stable and beta channels, from the update feeds the app reads (/update.json, /update-beta.json)
// and the GitHub releases. The notes are written in English; dates follow the page's language.
import { initPage } from './page.js';
import { t, INTL } from './i18n.js';

const REPO = 'cadente-hub/cadente-hub.github.io';
const RELEASES = `https://github.com/${REPO}/releases`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const day = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(INTL, { dateStyle: 'medium' }).format(d); };
const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

// The few Markdown forms the release notes use: ## and ### headings, - lists and paragraphs.
function markdown(text) {
  const out = [];
  let list = false;
  const close = () => { if (list) { out.push('</ul>'); list = false; } };
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    if (line.startsWith('### ')) { close(); out.push(`<h4>${inline(line.slice(4))}</h4>`); continue; }
    if (line.startsWith('## ')) { close(); out.push(`<h3>${inline(line.slice(3))}</h3>`); continue; }
    if (line.startsWith('- ')) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(line.slice(2))}</li>`); continue; }
    close();
    out.push(`<p>${inline(line)}</p>`);
  }
  close();
  return out.join('');
}

async function json(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}
const fromFeed = m => ({ version: m.version, date: m.pub_date, body: m.notes, url: `${RELEASES}/tag/v${m.version}`, latest: true });
const fromGitHub = r => { const v = String(r.tag_name ?? '').replace(/^v/, ''); return VERSION.test(v) ? { version: v, beta: r.prerelease || v.includes('-'), date: r.published_at, body: r.body, url: r.html_url } : null; };
const unique = xs => xs.filter((x, i) => x && xs.findIndex(y => y?.version === x.version) === i);

function render(el, items) {
  el.innerHTML = items.length ? items.map(r => `<article class="rn-item"><p class="rn-item__meta"><b>v${esc(r.version)}</b>${r.latest ? `<span class="rn-badge">${esc(t('rn.latest'))}</span>` : ''}<time>${esc(day(r.date))}</time></p>
    <div class="rn-item__body">${markdown(r.body || `Cadente v${r.version}`)}</div><a class="rn-item__link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(t('rn.onGitHub'))}</a></article>`).join('')
    : `<p class="rn-empty">${esc(t('rn.none'))}</p>`;
}

initPage();
const $ = id => document.getElementById(id);
Promise.all([json('/update.json'), json('/update-beta.json'), json(`https://api.github.com/repos/${REPO}/releases?per_page=40`).catch(() => [])]).then(([stable, beta, gh]) => {
  const all = gh.map(fromGitHub).filter(Boolean);
  const stableList = unique([fromFeed(stable), ...all.filter(r => !r.beta)]).slice(0, 8);
  const betaList = unique([fromFeed(beta), ...all.filter(r => r.beta)]).slice(0, 8);
  $('rn-stable-version').textContent = stableList[0] ? `v${stableList[0].version}` : '—';
  $('rn-beta-version').textContent = betaList[0] ? `v${betaList[0].version}` : '—';
  render($('rn-stable'), stableList);
  render($('rn-beta'), betaList);
}).catch(() => {
  for (const id of ['rn-stable-version', 'rn-beta-version']) $(id).textContent = '—';
  for (const id of ['rn-stable', 'rn-beta']) $(id).innerHTML = `<p class="rn-empty">${t('rn.failed', { url: RELEASES })}</p>`;
});
