// Home page, first screen: the hero, the sky, the bar and the reveals. The sections below it (js/home-sections.js)
// download while the hero plays and are built once the first screen is painted.
import { t, LOCALE } from './i18n.js';
import { demoTranslator } from './v4-site/demo-catalogs.js';
import { Cadu } from './cadu.js';
import { playHero } from './hero.js';
import { initPage } from './page.js';
import { browserSkyMode } from './sky/gate.mjs';

const $ = (sel, root = document) => root.querySelector(sel);
// The same test as js/stage.js, without loading the windows for it.
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
// The window catalog of the page's language starts loading now; the windows wait for it, the hero does not.
const windowLanguage = demoTranslator(LOCALE);
// The first screen is the hero. The windows and sections below it are built after the browser has painted it, one
// section per task, so the hero shows and starts moving without waiting for them. A visitor who does not start at
// the top (a #link, a reload, the back button) gets everything built before the first paint, as before.
const navType = performance.getEntriesByType?.('navigation')[0]?.type;
const eager = (location.hash && location.hash !== '#topo') || navType === 'reload' || navType === 'back_forward';
const painted = () => (eager ? null : new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))));
const yieldTask = () => (eager ? null : new Promise(r => setTimeout(r, 0)));

initPage();
const sections = import('./home-sections.js');

// ── Hero ──────────────────────────────────────────────────────────────
// Each struck word falls into the sky (js/sky): a WebGL2 star where it is cheap, a still SVG elsewhere. The sky module
// loads after the first paint; words that fall before it is ready wait in a queue.
const skyMode = browserSkyMode(), skyNames = t('hero.stars'), fallen = [];
let sky = null;
const hero = playHero({ slot: $('#hero-slot'), sub: $('#hero-sub'), reduced: REDUCED, onFall: (span, rect, i) => (sky ? sky.drop(i, rect) : fallen.push([i, rect])) });
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

// The logo in the bar is Cadu, the app icon: it waves when the pointer touches it. It is on the first screen, so it
// is in place before the first paint.
const navMark = $('.nav .brand__mark'), navCadu = document.createElement('span');
navCadu.className = 'brand__mark';
navMark.replaceWith(navCadu);
const logo = new Cadu(navCadu, { idle: null });
$('.nav .brand').addEventListener('pointerenter', () => logo.play('wave'));

await painted();
const { initSections } = await sections;
await initSections({ windowLanguage, yieldTask });
// A #link to a section lands on it again once the sections above it have their windows and their final height.
if (eager && location.hash.length > 1) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: 'start' });
