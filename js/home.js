// Home page: the Cadente window playing on its own, the plugin tour, the plugin rack, the store, Creator mode,
// the earnings calculator and Cadu.
import { Stage, REDUCED, setWindowLanguage } from './stage.js';
import { CHAPTERS, initial, TEMPO, CARD, PAUSE, durations } from './theater.js';
import { Maker } from './maker.js';
import { t, usd, number, list, LOCALE } from './i18n.js';
import { demoTranslator } from './v4-site/demo-catalogs.js';
import { storeApps, storeCategories, filterApps, peopleAt, earnings, NO_AI, usersOf, rackLog, serviceNote } from './home-logic.mjs';
import { PLUGINS, plugin } from './v4/plugins.mjs';
import { scene } from './v4/scenes.mjs';
import { reduce, leaves, activeTab } from './v4/model.mjs';
import { Cadu } from './cadu.js';
import { playHero } from './hero.js';
import { initPage } from './page.js';
import { browserSkyMode } from './sky/gate.mjs';
import { languageSection } from './langs.js';

const $ = (sel, root = document) => root.querySelector(sel);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Every Cadente window on the page speaks the page's language (js/v4-site/translate.mjs).
setWindowLanguage(await demoTranslator(LOCALE));

const onVisible = (el, fn, threshold = 0.2) => new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold }).observe(el);

initPage();

// ── Hero ──────────────────────────────────────────────────────────────
// Each struck word falls into the sky (js/sky): a WebGL2 star where it is cheap, a still SVG elsewhere. The sky module
// loads after the first paint; words that fall before it is ready wait in a queue.
const skyMode = browserSkyMode(), skyNames = t('hero.stars'), fallen = [];
let sky = null;
export const hero = playHero({ slot: $('#hero-slot'), sub: $('#hero-sub'), reduced: REDUCED, onFall: (span, rect, i) => (sky ? sky.drop(i, rect) : fallen.push([i, rect])) });
requestAnimationFrame(() => setTimeout(async () => {
  const narrow = innerWidth < 760, labels = $('#sky-labels');
  if (skyMode === 'webgl') {
    const { createSky } = await import('./sky/renderer.mjs');
    try { sky = createSky($('#sky-canvas'), { words: skyNames, labels, narrow }); } catch { sky = null; }
  }
  if (!sky) {
    $('#sky-canvas').remove();
    const { staticSky } = await import('./sky/static.mjs');
    return staticSky($('#sky'), { words: skyNames, labels, narrow });
  }
  for (const [i, rect] of fallen.splice(0)) sky.drop(i, rect);
  // Scrolling away from the hero pours the stars into the window below, which lights up as they arrive.
  const heroEl = $('#topo'), frameEl = $('#theater-frame');
  const onScroll = () => {
    const r = heroEl.getBoundingClientRect(), p = Math.min(1, Math.max(0, -r.top / (r.height * 0.6)));
    sky.pour(p);
    frameEl.style.setProperty('--arrive', p.toFixed(3));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const hub = await hero;
  sky.settle((hub ?? $('#hero-slot')).getBoundingClientRect());
}, 0));

// ── Navigation and reveal ─────────────────────────────────────────────

const reveal = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));

// ── Theater: the real v4 prototype, played like a video ───────────────
// The window plays the chapters in order while it is on screen and starts over at the end. The page scrolls
// normally; the steps above the window jump to a chapter.
const stepsEl = $('#steps'), caption = $('#caption'), body = $('.theater__body');
const narrow = matchMedia('(max-width: 760px)').matches;
// Phones get a taller, narrower window without the sidebar, so the text stays readable once scaled.
const fresh = () => (narrow ? reduce(initial(), { type: 'PATCH_SETTINGS', sidebar: false }) : initial());
const stage = new Stage($('#theater-stage'), {
  width: narrow ? 640 : 1240, height: narrow ? 900 : 760, state: fresh(), fitTo: body, tempo: TEMPO, camera: true,
  // The steps, the caption and the whole window fit in one screen below the navigation bar.
  maxHeight: () => Math.max(300, innerHeight - 64 - $('.theater__head').offsetHeight - (narrow ? 40 : 64)),
});

stepsEl.innerHTML = CHAPTERS.map((c, i) => `<li><button data-i="${i}" aria-label="${i + 1}. ${esc(c.step)}"><span>${esc(c.step)}</span><i class="steps__bar"></i></button></li>`).join('');
// Each step's bar fills over its chapter, and stops while the window is off screen.
durations().then(ds => ds.forEach((d, i) => stepsEl.children[i].style.setProperty('--d', `${Math.round(d)}ms`)));
new IntersectionObserver(([e]) => stepsEl.classList.toggle('is-paused', !e.isIntersecting), { threshold: 0.2 }).observe($('#theater-stage'));
const markSteps = i => [...stepsEl.children].forEach((li, k) => {
  li.classList.toggle('is-done', k < i);
  li.classList.remove('is-on');
  if (k === i) { void li.offsetWidth; li.classList.add('is-on'); }
});
const pad = n => String(n).padStart(2, '0');
function showCaption(i) {
  const c = CHAPTERS[i];
  caption.innerHTML = `<h3 class="caption__title"><span class="n">${pad(i + 1)} / ${pad(CHAPTERS.length)}</span>${c.title}</h3><p class="caption__text">${c.text}</p>`;
  markSteps(i);
}
const card = i => ({ kicker: `${pad(i + 1)} / ${pad(CHAPTERS.length)} · ${CHAPTERS[i].step}`, title: CHAPTERS[i].title });
// One run plays from chapter `from` to the end, then starts over from a fresh window. Between two chapters the
// camera pulls back with the next title over the window and pushes in again as the chapter starts, with no stop.
function story(from = 0) {
  stage.play(async (s, id) => {
    let i = from;
    if (i > 0) {
      await s.fade(true, id);
      s.setState(fresh());
      await s.fastForward(async f => { for (let k = 0; k < i; k++) await CHAPTERS[k].run(f); });
      await s.fade(false, id);
    }
    for (;;) {
      await s.whenVisible(id);
      showCaption(i);
      await s.interlude(card(i), CARD, id);
      await CHAPTERS[i].run(s, id);
      await s.wait(i === CHAPTERS.length - 1 ? 2400 : PAUSE, id);
      i = (i + 1) % CHAPTERS.length;
      if (i === 0) {
        await s.whenVisible(id);
        await s.fade(true, id);
        s.setState(fresh());
        await s.fade(false, id);
      }
    }
  });
}
stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) story(Number(b.dataset.i)); });
showCaption(0);
story(0);


// ── First-party plugins: the window walks through them on its own; a card jumps to one ──
const grid = $('#plugin-grid'), note = $('#plugin-note');
const FIRST = PLUGINS.filter(p => !p.community && !p.store);
const titleOf = p => (t.has(`plugins.title.${p.id}`) ? t(`plugins.title.${p.id}`) : p.title);
grid.innerHTML = FIRST.map(p => `<li><button class="pcard" data-plugin="${p.id}" aria-pressed="false"><span class="pcard__glyph" aria-hidden="true">${esc(p.glyph)}</span><span class="pcard__title">${esc(titleOf(p))}</span></button></li>`).join('');

const preview = $('.plugins__preview');
// The review scene of the prototype has three tabs with real-looking data (PR #248, Claude at work, Requests,
// a running Focus timer…). A plugin it already shows is zoomed in place; the others open in a tab of their own.
let base = reduce(scene('quad'), { type: 'NEW_TAB' });
const scratchTab = base.active, scratch = leaves(activeTab(base).tree)[0].id;
base = reduce(reduce(base, { type: 'OPEN', plugin: 'inicio', pane: scratch }), { type: 'PATCH_SETTINGS', sidebar: false });
const pstage = new Stage($('#plugin-stage'), { width: 780, height: 560, state: base, fitTo: preview, hud: false });
function showPlugin(id) {
  let S = pstage.S;
  const own = S.tabs.filter(x => x.id !== scratchTab).flatMap(x => leaves(x.tree).map(l => ({ t: x, l }))).find(x => x.l.plugin === id);
  const tab = own ? own.t.id : scratchTab, target = own ? own.l.id : scratch;
  S = reduce(S, { type: 'SELECT_TAB', id: tab });
  S = reduce(S, { type: 'FOCUS', id: target });
  if (!own) S = reduce(S, { type: 'OPEN', plugin: id, pane: scratch });
  pstage.setState({ ...S, zoom: target, overlay: null });
  pstage.reveal(target);
  for (const b of grid.querySelectorAll('.pcard')) b.setAttribute('aria-pressed', String(b.dataset.plugin === id));
  const p = plugin(id);
  note.innerHTML = `<b><span>${esc(p.glyph)}</span>${esc(titleOf(p))}</b> · ${esc(t.has(`plugins.desc.${id}`) ? t(`plugins.desc.${id}`) : '')}`;
}
// Each plugin shows its first view, then walks two more with ⇥, then the next plugin opens.
function tour(from) {
  pstage.play(async (s, id) => {
    for (let k = from; ; k = (k + 1) % FIRST.length) {
      await s.whenVisible(id);
      showPlugin(FIRST[k].id);
      await s.wait(1300, id);
      for (let v = 0; v < 2; v++) { await s.key('⇥', id, { hold: 0 }); await s.wait(1000, id); }
    }
  });
}
grid.addEventListener('click', e => { const b = e.target.closest('.pcard'); if (b) tour(FIRST.findIndex(p => p.id === b.dataset.plugin)); });
tour(FIRST.findIndex(p => p.id === 'pr'));

// ── 15 languages: the review scene, one window, every language ───────
languageSection({ Stage, state: reduce(scene('quad'), { type: 'PATCH_SETTINGS', sidebar: true }), host: $('#langs-stage'), buttons: $('#langs-buttons'), fitTo: $('#langs-body .frame') });

// ── Plugin architecture: toggle, swap, install, remove ────────────────
// Providers are plugin ids, the same in every language; only "no AI" is a word.
const SERVICES = [
  { id: 'ai', options: ['cadente.ai.anthropic', 'cadente.ai.openai', 'cadente.ai.ollama', NO_AI] },
  { id: 'compaction', options: ['cadente.compaction.default', 'cadente.compaction.manual', 'ana.compaction.resumo'] },
  { id: 'pty', options: ['cadente.pty.default', 'leo.pty.sandbox'] },
  { id: 'theme', options: ['cadente.theme.dark', 'bitcraft.theme.neon', 'lumen.theme.contraste'] },
];
const serviceName = id => t(`rack.service.${id}`);
const optionLabel = o => (o === NO_AI ? t('rack.noAi') : o);
const g = id => plugin(id)?.glyph ?? '·';
const RACK = [
  { id: 'chat', g: g('chat'), uses: ['ai', 'compaction'] },
  { id: 'terminal', g: g('terminal'), uses: ['pty'] },
  { id: 'pr', g: g('pr'), uses: ['ai'] },
  { id: 'automacoes', g: g('automacoes'), uses: ['ai', 'compaction'] },
  { id: 'workspaces', g: g('workspaces'), uses: ['pty'] },
  { id: 'sidebar', g: '▤', uses: ['theme'] },
  { id: 'tray', g: '◫', uses: ['theme'] },
].map(p => ({ ...p, name: t(`rack.plugin.${p.id}`) }));
const KANBAN = { id: 'kanban', g: '▦', name: 'Kanban', author: '@ana', uses: ['ai', 'theme'], community: true };
const rack = { plugins: RACK.map(p => ({ ...p, on: true })), provider: Object.fromEntries(SERVICES.map(s => [s.id, 0])) };
const rp = $('#rack-plugins'), rs = $('#rack-services'), wires = $('#rack-wires'), rlog = $('#rack-log'), radd = $('#rack-add'), rcount = $('#rack-count'), rackEl = $('#rack');
const log = action => { rlog.innerHTML = rackLog(t, list, action); rlog.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); };

function drawRack(fresh) {
  rp.innerHTML = rack.plugins.map(p => `<li><button class="rchip${p.on ? '' : ' is-off'}${p.id === fresh ? ' is-new' : ''}" data-plugin="${p.id}" aria-pressed="${p.on}"><span class="rchip__dot" aria-hidden="true"></span><span class="rchip__g" aria-hidden="true">${esc(p.g)}</span><span class="rchip__name">${esc(p.author ? `${p.name} · ${p.author}` : p.name)}</span><span class="rchip__meta">${t(p.community ? 'rack.meta.community' : p.on ? 'rack.meta.on' : 'rack.meta.off')}</span></button>${p.community ? `<button class="rchip__x" data-remove aria-label="${esc(t('rack.removeKanban'))}">×</button>` : ''}</li>`).join('');
  rs.innerHTML = SERVICES.map(s => {
    const option = s.options[rack.provider[s.id]];
    return `<li><button class="svc${option === NO_AI ? ' is-off' : ''}" data-service="${s.id}"><i class="svc__star" aria-hidden="true"></i><span class="svc__name">${esc(serviceName(s.id))}</span><span class="svc__provider"><i>${esc(optionLabel(option))}</i></span><span class="svc__uses">${esc(serviceNote(t, list, { noAi: option === NO_AI, users: usersOf(rack, s.id) }))}</span></button></li>`;
  }).join('');
  rcount.textContent = t('rack.count', { count: rack.plugins.filter(p => p.on).length });
  radd.disabled = rack.plugins.some(p => p.id === 'kanban');
  wire();
}
// In a right-to-left page the plugins sit on the right, so the wires leave from their left edge.
function wire(hot = {}) {
  const box = rackEl.getBoundingClientRect();
  if (!box.width || getComputedStyle(wires).display === 'none') return;
  const rtl = getComputedStyle(rackEl).direction === 'rtl';
  wires.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  // The rack as a constellation: every plugin and service is a star, every use a line between them. A service without
  // a provider (the AI turned off) goes dark, and so do its lines.
  const paths = [], stars = new Map();
  const dark = sid => SERVICES.find(x => x.id === sid)?.options[rack.provider[sid]] === NO_AI;
  for (const p of rack.plugins) {
    const a = rp.querySelector(`[data-plugin="${p.id}"]`)?.getBoundingClientRect();
    for (const s of p.uses) {
      const b = rs.querySelector(`[data-service="${s}"]`)?.getBoundingClientRect();
      if (!a || !b) continue;
      const x1 = (rtl ? a.left : a.right) - box.left, y1 = a.top + a.height / 2 - box.top, x2 = (rtl ? b.right : b.left) - box.left, y2 = b.top + Math.min(22, b.height / 2) - box.top, mx = (x1 + x2) / 2;
      const cls = !p.on ? 'is-off' : dark(s) ? 'is-dark' : hot.service === s || hot.plugin === p.id ? 'is-hot' : '';
      paths.push(`<path class="${cls}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`);
      if (p.on) stars.set(`p:${p.id}`, `<circle class="star" cx="${x1}" cy="${y1}" r="2.6"/>`);
    }
  }
  wires.innerHTML = paths.join('') + [...stars.values()].join('');
}
function togglePlugin(id) {
  const p = rack.plugins.find(x => x.id === id);
  p.on = !p.on;
  drawRack();
  log({ type: p.on ? 'on' : 'off', name: esc(p.name) });
}
function swap(sid) {
  const s = SERVICES.find(x => x.id === sid), from = s.options[rack.provider[sid]];
  rack.provider[sid] = (rack.provider[sid] + 1) % s.options.length;
  drawRack();
  rs.querySelector(`[data-service="${sid}"] i`)?.classList.add('is-roll');
  wire({ service: sid });
  setTimeout(() => wire(), 1600);
  const users = usersOf(rack, sid).map(esc), to = s.options[rack.provider[sid]];
  if (to === NO_AI) return log({ type: 'noAi', users });
  log({ type: 'swap', service: esc(serviceName(sid)), from: esc(optionLabel(from)), to: esc(optionLabel(to)), users });
}
function install() {
  if (rack.plugins.some(p => p.id === 'kanban')) return;
  rack.plugins.push({ ...KANBAN, on: true });
  drawRack('kanban');
  wire({ plugin: 'kanban' });
  setTimeout(() => wire(), 1600);
  log({ type: 'install' });
}
function remove() {
  rack.plugins = rack.plugins.filter(p => p.id !== 'kanban');
  drawRack();
  log({ type: 'remove' });
}
let rackTouched = false;
rp.addEventListener('click', e => {
  rackTouched = true;
  if (e.target.closest('[data-remove]')) return remove();
  const b = e.target.closest('[data-plugin]');
  if (b) togglePlugin(b.dataset.plugin);
});
rp.addEventListener('pointerover', e => { const b = e.target.closest('[data-plugin]'); if (b) wire({ plugin: b.dataset.plugin }); });
rp.addEventListener('pointerleave', () => wire());
rs.addEventListener('click', e => { rackTouched = true; const b = e.target.closest('[data-service]'); if (b) swap(b.dataset.service); });
radd.addEventListener('click', () => { rackTouched = true; install(); });
new ResizeObserver(() => wire()).observe(rackEl);
drawRack();
log({ type: 'hint' });
onVisible(rackEl, async () => {
  for (const step of [() => swap('ai'), () => install(), () => togglePlugin('tray')]) {
    await sleep(1500);
    if (rackTouched) return;
    step();
  }
}, 0.4);

// ── Store ─────────────────────────────────────────────────────────────
const APPS = storeApps(t, usd);
const WALL = [...APPS.map(a => a.name), ...t('store.wall')];
const wall = $('#store-wall');
const rows = 6, per = Math.ceil(WALL.length / rows);
wall.innerHTML = Array.from({ length: rows }, (_, r) => {
  const names = [...WALL.slice(r * per, r * per + per), ...WALL.slice(0, Math.max(0, per - (WALL.length - r * per)))];
  const items = names.map((n, i) => `<span${(i + r) % 9 === 0 ? ' class="on"' : ''}>${esc(n)}</span>`).join('');
  return `<div class="wall__row" style="--t:${70 + r * 9}s">${items}${items}</div>`;
}).join('');

const q = $('#shop-q'), cats = $('#shop-cats'), sgrid = $('#shop-grid'), empty = $('#shop-empty');
let cat = 'all', shopTouched = false, shopKey = '';
let onScreen = new Set();
const installed = new Set();
cats.innerHTML = storeCategories(t).map(c => `<button role="tab" aria-selected="${c.id === cat}" data-cat="${c.id}">${esc(c.label)}</button>`).join('');
const action = kind => t(`store.action.${kind}`);
function drawShop() {
  const hits = filterApps(APPS, { cat, query: q.value });
  const key = `${hits.map(h => h.i).join(',')}|${[...installed].join(',')}`;
  if (key === shopKey) return;
  shopKey = key;
  empty.hidden = hits.length > 0;
  if (!hits.length) empty.innerHTML = t('store.empty');
  sgrid.innerHTML = hits.map((a, k) => {
    const done = installed.has(a.i);
    return `<li class="app${done ? ' is-done' : ''}${onScreen.has(a.i) ? '' : ' is-new'}" style="animation-delay:${k * 40}ms"><div class="app__top"><span class="app__glyph" aria-hidden="true">${esc(a.glyph)}</span><div><p class="app__name">${esc(a.name)}</p><p class="app__by">@${esc(a.author)}</p></div></div><p class="app__desc">${esc(a.desc)}</p><div class="app__foot"><span class="price${a.kind === 'free' || a.kind === 'donation' ? ' price--free' : ''}">${esc(a.price)}</span><button class="install${done ? ' is-done' : ''}" data-app="${a.i}"${done ? ' disabled' : ''}>${esc(done ? t('store.installed') : action(a.kind))}</button></div></li>`;
  }).join('');
  onScreen = new Set(hits.map(h => h.i));
}
async function installApp(btn) {
  const i = Number(btn.dataset.app), { kind } = APPS[i];
  if (installed.has(i) || btn.classList.contains('is-busy')) return;
  btn.classList.add('is-busy');
  for (const s of t(kind === 'free' || kind === 'donation' ? 'store.stepsFree' : 'store.stepsPaid')) { btn.textContent = s; await sleep(REDUCED ? 80 : 520); }
  installed.add(i);
  btn.classList.remove('is-busy');
  btn.classList.add('is-done');
  btn.textContent = t('store.installed');
  btn.disabled = true;
  btn.closest('.app').classList.add('is-done');
}
q.addEventListener('input', () => { shopTouched = true; drawShop(); });
q.addEventListener('focus', () => { shopTouched = true; });
cats.addEventListener('click', e => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  shopTouched = true;
  cat = b.dataset.cat;
  for (const x of cats.children) x.setAttribute('aria-selected', String(x === b));
  drawShop();
});
sgrid.addEventListener('click', e => { const b = e.target.closest('[data-app]'); if (b) { shopTouched = true; installApp(b); } });
drawShop();
onVisible($('#shop'), async () => {
  for (const term of [...t('store.demoSearches'), '']) {
    if (shopTouched) return;
    q.value = '';
    for (const ch of term) { if (shopTouched) return; q.value += ch; drawShop(); await sleep(REDUCED ? 0 : 90); }
    if (!term) drawShop();
    await sleep(2200);
  }
}, 0.35);

// ── Creator mode ──────────────────────────────────────────────────────
new Maker($('#maker-win'), $('#maker-steps'), $('#maker-ex'));

// ── Earnings calculator ───────────────────────────────────────────────
const price = $('#calc-price'), crowd = $('#calc-people'), value = $('#calc-value');
let model = 'subscription', shown = 0, anim = 0;
function calc() {
  const pr = Number(price.value), n = peopleAt(Number(crowd.value));
  $('#calc-price-label').textContent = t(`calc.${model}.price`);
  $('#calc-people-label').textContent = t(`calc.${model}.people`);
  $('#calc-price-out').textContent = usd(pr);
  $('#calc-people-out').textContent = number(n);
  $('#calc-per').textContent = t(`calc.${model}.per`);
  for (const r of [price, crowd]) r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
  for (const c of document.querySelectorAll('.model')) c.classList.toggle('is-on', c.dataset.model === model);
  const target = earnings(model, pr, n), start = shown, t0 = performance.now();
  cancelAnimationFrame(anim);
  const step = now => {
    const k = REDUCED ? 1 : clamp((now - t0) / 600, 0, 1), e = 1 - (1 - k) ** 3;
    shown = start + (target - start) * e;
    value.textContent = usd(shown);
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
document.querySelectorAll('[data-calc]').forEach(b => b.addEventListener('click', () => {
  model = b.dataset.calc;
  document.querySelectorAll('[data-calc]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
  calc();
}));
price.addEventListener('input', calc);
crowd.addEventListener('input', calc);
onVisible($('#calc'), calc, 0.3);
value.textContent = usd(0);

// ── Cadu ──────────────────────────────────────────────────────────────
// The logo is Cadu, the app icon. He waves in the hero, waves again when the pointer touches the logo,
// and celebrates at the download.
const navMark = $('.nav .brand__mark'), navCadu = document.createElement('span');
navCadu.className = 'brand__mark';
navMark.replaceWith(navCadu);
const logo = new Cadu(navCadu, { idle: null });
$('.nav .brand').addEventListener('pointerenter', () => logo.play('wave'));
const finaleCadu = new Cadu($('#finale-cadu'));
onVisible($('#finale-cadu'), () => finaleCadu.play('celebrate'), 0.6);

// The store wall only moves while it is on screen.
new IntersectionObserver(([e]) => $('#loja').classList.toggle('is-live', e.isIntersecting)).observe($('#loja'));
