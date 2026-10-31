// Languages on the page: the picker in the menu and the footer, the notice when the browser speaks another ready
// language, the root page following a stored choice once, and the section where one window switches between the
// 15 languages of the app.
import LOCALES from '../i18n/locales.json';
import { LOCALE } from './i18n.js';
import { pickLocale, storedChoice, storeChoice } from './langs.mjs';
import { demoTranslator } from './v4-site/demo-catalogs.js';

const data = JSON.parse(document.getElementById('i18n')?.textContent ?? '{}');
const others = data.others ?? {};
const store = (() => { try { return window.localStorage; } catch { return null; } })();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function initLanguages() {
  // A visitor who chose a language before lands on it from the root page, once per visit.
  const chosen = storedChoice(store);
  if (location.pathname === '/' && chosen && others[chosen] && !sessionStorage.getItem('cadente.lang.followed')) {
    sessionStorage.setItem('cadente.lang.followed', '1');
    location.replace(others[chosen].href + location.hash);
    return;
  }
  for (const a of document.querySelectorAll('[data-lang]')) a.addEventListener('click', () => storeChoice(store, a.dataset.lang));
  // Closing the picker when focus or a click leaves it.
  for (const d of document.querySelectorAll('details.langpick')) document.addEventListener('click', e => { if (!d.contains(e.target)) d.open = false; });
  if (chosen) return;
  const best = pickLocale(navigator.languages ?? [navigator.language], [LOCALE, ...Object.keys(others)]);
  const o = best && best !== LOCALE ? others[best] : null;
  if (!o || !o.notice) return;
  const bar = document.createElement('div');
  bar.className = 'langbar';
  bar.lang = best;
  bar.dir = o.dir;
  bar.setAttribute('role', 'region');
  bar.innerHTML = `<p>${esc(o.notice)}</p><a href="${esc(o.href)}" data-lang="${esc(best)}">${esc(o.go)}</a><button type="button" aria-label="${esc(o.close)}">×</button>`;
  bar.querySelector('a').addEventListener('click', () => storeChoice(store, best));
  bar.querySelector('button').addEventListener('click', () => { storeChoice(store, LOCALE); bar.remove(); });
  document.body.append(bar);
  requestAnimationFrame(() => bar.classList.add('is-in'));
}

// One window, 15 languages. The buttons cycle on their own while the section is on screen, until the visitor picks.
export function languageSection({ Stage, state, host, buttons, fitTo }) {
  if (!host || !buttons) return;
  const stage = new Stage(host, { width: 900, height: 560, state, fitTo, hud: false });
  buttons.innerHTML = LOCALES.map(l => `<button type="button" role="radio" lang="${l.code}" dir="${l.dir}" data-code="${l.code}" aria-checked="${l.code === LOCALE}">${esc(l.name)}</button>`).join('');
  let current = LOCALE, touched = false, visible = false;
  async function show(code) {
    current = code;
    for (const b of buttons.children) b.setAttribute('aria-checked', String(b.dataset.code === code));
    stage.setLanguage(await demoTranslator(code));
    host.closest('.frame')?.animate?.([{ filter: 'brightness(1.5)' }, { filter: 'none' }], { duration: 500, easing: 'ease-out' });
  }
  buttons.addEventListener('click', e => { const b = e.target.closest('[data-code]'); if (b) { touched = true; show(b.dataset.code); } });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.3 }).observe(host);
  const order = LOCALES.map(l => l.code);
  setInterval(() => {
    if (touched || !visible || document.hidden) return;
    show(order[(order.indexOf(current) + 1) % order.length]);
  }, 2600);
  return stage;
}
