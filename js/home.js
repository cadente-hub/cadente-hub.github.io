// Home page: the pinned Cadente window, the plugin grid, the plugin rack, the store, Creator mode and the earnings calculator.
import { Stage, REDUCED } from './stage.js';
import { CHAPTERS, initial } from './theater.js';
import { Maker } from './maker.js';
import { APPS, CATEGORIES, WALL, priceOf } from './store-data.js';
import { PLUGINS, plugin } from './v4/plugins.mjs';
import { scene } from './v4/scenes.mjs';
import { reduce, leaves, activeTab } from './v4/model.mjs';

const $ = (sel, root = document) => root.querySelector(sel);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const onVisible = (el, fn, threshold = 0.2) => new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold }).observe(el);

// ── Navigation and reveal ─────────────────────────────────────────────
const nav = $('#nav');
const menu = $('#nav-menu'), sheet = $('#nav-sheet');
menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', open); sheet.hidden = !open; });
sheet.addEventListener('click', e => { if (e.target.closest('a')) { menu.setAttribute('aria-expanded', 'false'); sheet.hidden = true; } });

const reveal = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));

// ── Theater: the real v4 prototype, chapter by chapter ────────────────
const theater = $('#abrir'), track = $('#track'), stepsEl = $('#steps'), caption = $('#caption');
const body = $('.theater__body', theater), controls = $('#controls');
track.style.height = `${CHAPTERS.length * 80}vh`;

// Phones get a taller, narrower window without the sidebar, so the text stays readable once scaled.
const narrow = matchMedia('(max-width: 760px)').matches;
const fresh = () => (narrow ? reduce(initial(), { type: 'PATCH_SETTINGS', sidebar: false }) : initial());
const stage = new Stage($('#theater-stage'), {
  width: narrow ? 640 : 1240, height: narrow ? 900 : 760, state: fresh(), fitTo: body,
  maxHeight: () => body.clientHeight - parseFloat(getComputedStyle(body).paddingTop) - (controls.offsetHeight ? controls.offsetHeight + 14 : 0),
});

stepsEl.innerHTML = CHAPTERS.map((c, i) => `<li><button data-i="${i}"><span>${String(i + 1).padStart(2, '0')} ${c.step}</span></button></li>`).join('');
stepsEl.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const i = Number(b.dataset.i), span = theater.offsetHeight - innerHeight;
  if (stage.user) { stage.release(); current = -1; }
  scrollTo({ top: theater.offsetTop + ((i + 0.08) / CHAPTERS.length) * span, behavior: REDUCED ? 'auto' : 'smooth' });
});

let current = -1, built = -1;
const markSteps = i => [...stepsEl.children].forEach((li, k) => { li.classList.toggle('is-on', k === i); li.classList.toggle('is-done', k < i); });
// The caption tells the chapter; when the visitor takes over, it tells them how to drive and how to come back.
function showCaption(i, mode) {
  const c = CHAPTERS[i], n = `${String(i + 1).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}`;
  caption.innerHTML = mode === 'user'
    ? '<h3 class="caption__title"><span class="n">modo livre</span>Você está no controle.</h3><div class="caption__text"><p>Clique numa folha e use o teclado ou os atalhos abaixo. No navegador, <kbd>⌃</kbd> vale como <kbd>⌘</kbd>.</p><button class="btn btn--ghost btn--sm caption__resume" data-resume data-stage-control>↺ Voltar à demonstração</button></div>'
    : `<h3 class="caption__title"><span class="n">${n}</span>${c.title}</h3><p class="caption__text">${c.text}${mode === 'invite' ? ' <span class="caption__invite">Sua vez: clique numa folha.</span>' : ''}</p>`;
  markSteps(i);
}
function playChapter(i) {
  stage.play(async (s, id) => {
    if (built !== i - 1) {
      s.setState(fresh());
      await s.fastForward(async f => { for (let k = 0; k < i; k++) await CHAPTERS[k].run(f); });
    }
    built = -2;
    if (i === 0) s.setState(fresh());
    await CHAPTERS[i].run(s, id);
    built = i;
    if (i === CHAPTERS.length - 1) showCaption(i, 'invite');
  });
}
function goTo(i) {
  if (i === current) return;
  current = i;
  if (stage.user) { markSteps(i); return; }
  showCaption(i);
  playChapter(i);
}
stage.on(type => { if (type === 'user') { built = -2; showCaption(Math.max(0, current), 'user'); } });
caption.addEventListener('click', e => {
  if (!e.target.closest('[data-resume]')) return;
  stage.release();
  const i = current;
  current = -1;
  goTo(Math.max(0, i));
});
controls.addEventListener('click', e => {
  const b = e.target.closest('[data-key]');
  if (!b) return;
  stage.takeOver();
  stage.key(b.dataset.key);
});

let ticking = false;
function onScroll() {
  ticking = false;
  nav.classList.toggle('is-scrolled', scrollY > 8);
  const r = theater.getBoundingClientRect(), vh = innerHeight;
  theater.style.setProperty('--rise', REDUCED ? 1 : clamp(1 - r.top / vh, 0, 1).toFixed(3));
  if (r.top > vh * 0.5 || r.bottom < vh * 0.3) return;
  const p = clamp(-r.top / (r.height - vh), 0, 0.9999);
  goTo(Math.floor(p * CHAPTERS.length));
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', () => { stage.fit(); onScroll(); });
showCaption(0);
onScroll();

// ── First-party plugins: click a card, the window opens it ────────────
const DESC = {
  inicio: 'Seu dia: agenda, tarefas, notas, clima e o que ficou aberto.',
  chat: 'Qualquer modelo, com plano, fila, sessões e o contexto à vista.',
  terminal: 'Blocos como no Warp, sugestão de IA e agentes como Claude Code e Codex.',
  workspaces: 'Repositórios, alterações e worktrees, com diff e commit.',
  pr: 'Seus PRs e os do time: diff, checks, threads e revisão com IA.',
  requests: 'Cliente HTTP com coleções, ambientes e histórico.',
  calendario: 'Dia, mês e próximos eventos. Digite “Reunião amanhã 10h” e ↵.',
  sistema: 'Memória, CPU, portas e Docker, ao vivo.',
  uso: 'Limites, custo e previsão de uso das suas contas.',
  foco: 'Pomodoro com tarefas e notas.',
  automacoes: 'Tarefas de IA agendadas, com histórico.',
  prompts: 'Biblioteca de prompts e técnicas, com sessão no Chat ao lado.',
  projetos: 'Projetos e sessões: adicionar, clonar e favoritar.',
  recursos: 'Skills, memória, agents, MCPs e instruções.',
  links: 'Links com tags. Cole uma URL e ↵.',
  ferramentas: 'JSON e Markdown para Word.',
  config: 'Contas, providers, atalhos, acesso e aparência.',
  plugins: 'Catálogo, grafo e troca de provider com prévia.',
};
const grid = $('#plugin-grid'), note = $('#plugin-note');
grid.innerHTML = PLUGINS.map(p => `<li><button class="pcard" data-plugin="${p.id}" aria-pressed="false"><span class="pcard__glyph" aria-hidden="true">${esc(p.glyph)}</span><span class="pcard__title">${esc(p.title)}</span><span class="pcard__desc">${esc(DESC[p.id] ?? '')}</span></button></li>`).join('');

const preview = $('.plugins__preview');
// The review scene of the prototype has three tabs with real-looking data (PR #248, Claude at work, Requests,
// a running Focus timer…). A plugin it already shows is zoomed in place; the others open in a tab of their own.
let base = reduce(scene('quad'), { type: 'NEW_TAB' });
const scratchTab = base.active, scratch = leaves(activeTab(base).tree)[0].id;
base = reduce(base, { type: 'OPEN', plugin: 'inicio', pane: scratch });
const pstage = new Stage($('#plugin-stage'), { width: 780, height: 560, state: base, sidebar: false, fitTo: preview });
let auto = true, autoAt = 0;
function showPlugin(id) {
  let S = pstage.S;
  const own = S.tabs.filter(t => t.id !== scratchTab).flatMap(t => leaves(t.tree).map(l => ({ t, l }))).find(x => x.l.plugin === id);
  const tab = own ? own.t.id : scratchTab, target = own ? own.l.id : scratch;
  S = reduce(S, { type: 'SELECT_TAB', id: tab });
  S = reduce(S, { type: 'FOCUS', id: target });
  if (!own) S = reduce(S, { type: 'OPEN', plugin: id, pane: scratch });
  pstage.setState({ ...S, zoom: target, overlay: null });
  if (!REDUCED) pstage.reveal(target);
  for (const b of grid.querySelectorAll('.pcard')) b.setAttribute('aria-pressed', String(b.dataset.plugin === id));
  const p = plugin(id);
  note.innerHTML = `<b><span>${esc(p.glyph)}</span>${esc(p.title)}</b> · ${esc(DESC[id] ?? '')} Clique na janela e use <kbd>⇥</kbd> para trocar de vista.`;
}
grid.addEventListener('click', e => {
  const b = e.target.closest('.pcard');
  if (!b) return;
  auto = false;
  showPlugin(b.dataset.plugin);
});
pstage.on(type => { if (type === 'user') auto = false; });
showPlugin('pr');
setInterval(() => {
  if (!auto || !pstage.visible || document.hidden) return;
  autoAt = (autoAt + 1) % PLUGINS.length;
  showPlugin(PLUGINS[autoAt].id);
}, 3600);
autoAt = PLUGINS.findIndex(p => p.id === 'pr');

// ── Plugin architecture: toggle, swap, install, remove ────────────────
const SERVICES = [
  { id: 'ai', name: 'provider de IA', options: ['cadente.ai.anthropic', 'cadente.ai.openai', 'cadente.ai.ollama'] },
  { id: 'compaction', name: 'compactação do contexto', options: ['cadente.compaction.default', 'cadente.compaction.manual', 'ana.compaction.resumo'] },
  { id: 'pty', name: 'terminal (pty)', options: ['cadente.pty.default', 'leo.pty.sandbox'] },
  { id: 'theme', name: 'tema', options: ['cadente.theme.dark', 'bitcraft.theme.neon', 'lumen.theme.contraste'] },
];
const g = id => plugin(id)?.glyph ?? '·';
const RACK = [
  { id: 'chat', g: g('chat'), name: 'Chat', uses: ['ai', 'compaction'] },
  { id: 'terminal', g: g('terminal'), name: 'Terminal', uses: ['pty'] },
  { id: 'pr', g: g('pr'), name: 'PR Reviews', uses: ['ai'] },
  { id: 'automacoes', g: g('automacoes'), name: 'Automações', uses: ['ai', 'compaction'] },
  { id: 'workspaces', g: g('workspaces'), name: 'Workspaces', uses: ['pty'] },
  { id: 'sidebar', g: '▤', name: 'Barra lateral', uses: ['theme'] },
  { id: 'tray', g: '◫', name: 'Barra do sistema', uses: ['theme'] },
];
const KANBAN = { id: 'kanban', g: '▦', name: 'Kanban · @ana', uses: ['ai', 'theme'], community: true };
const rack = { plugins: RACK.map(p => ({ ...p, on: true })), provider: Object.fromEntries(SERVICES.map(s => [s.id, 0])) };
const rp = $('#rack-plugins'), rs = $('#rack-services'), wires = $('#rack-wires'), rlog = $('#rack-log'), radd = $('#rack-add'), rcount = $('#rack-count'), rackEl = $('#rack');
const log = html => { rlog.innerHTML = html; rlog.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); };

function drawRack(fresh) {
  rp.innerHTML = rack.plugins.map(p => `<li><button class="rchip${p.on ? '' : ' is-off'}${p.id === fresh ? ' is-new' : ''}" data-plugin="${p.id}" aria-pressed="${p.on}"><span class="rchip__dot" aria-hidden="true"></span><span class="rchip__g" aria-hidden="true">${esc(p.g)}</span><span class="rchip__name">${esc(p.name)}</span><span class="rchip__meta">${p.community ? 'comunidade' : p.on ? 'ligado' : 'desligado'}</span></button>${p.community ? '<button class="rchip__x" data-remove aria-label="Remover Kanban">×</button>' : ''}</li>`).join('');
  rs.innerHTML = SERVICES.map(s => {
    const users = rack.plugins.filter(p => p.on && p.uses.includes(s.id)).map(p => p.name.split(' ·')[0]);
    return `<li><button class="svc" data-service="${s.id}"><span class="svc__name">${s.name}</span><span class="svc__provider"><i>${s.options[rack.provider[s.id]]}</i></span><span class="svc__uses">${users.length ? `usado por ${users.join(', ')}` : 'ninguém usa agora'}</span></button></li>`;
  }).join('');
  rcount.textContent = `${rack.plugins.filter(p => p.on).length} ligados`;
  radd.disabled = rack.plugins.some(p => p.id === 'kanban');
  wire();
}
function wire(hot = {}) {
  const box = rackEl.getBoundingClientRect();
  if (!box.width || getComputedStyle(wires).display === 'none') return;
  wires.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  const paths = [];
  for (const p of rack.plugins) {
    const a = rp.querySelector(`[data-plugin="${p.id}"]`)?.getBoundingClientRect();
    for (const s of p.uses) {
      const b = rs.querySelector(`[data-service="${s}"]`)?.getBoundingClientRect();
      if (!a || !b) continue;
      const x1 = a.right - box.left, y1 = a.top + a.height / 2 - box.top, x2 = b.left - box.left, y2 = b.top + Math.min(22, b.height / 2) - box.top, mx = (x1 + x2) / 2;
      const cls = !p.on ? 'is-off' : hot.service === s || hot.plugin === p.id ? 'is-hot' : '';
      paths.push(`<path class="${cls}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`);
    }
  }
  wires.innerHTML = paths.join('');
}
function togglePlugin(id) {
  const p = rack.plugins.find(x => x.id === id);
  p.on = !p.on;
  drawRack();
  log(p.on ? `<b>${esc(p.name)}</b> ligado de novo, sem reiniciar.` : `<b>${esc(p.name)}</b> desligado. A folha que usava ele fica e abre o seletor.`);
}
function swap(sid) {
  const s = SERVICES.find(x => x.id === sid), from = s.options[rack.provider[sid]];
  rack.provider[sid] = (rack.provider[sid] + 1) % s.options.length;
  drawRack();
  rs.querySelector(`[data-service="${sid}"] i`)?.classList.add('is-roll');
  wire({ service: sid });
  setTimeout(() => wire(), 1600);
  const users = rack.plugins.filter(p => p.on && p.uses.includes(sid)).map(p => p.name.split(' ·')[0]);
  log(`prévia · ${s.name}: <b>${from} → ${s.options[rack.provider[sid]]}</b>${users.length ? ` · ${users.join(', ')} terminam o que estão fazendo e reiniciam no novo provider` : ''}`);
}
function install() {
  if (rack.plugins.some(p => p.id === 'kanban')) return;
  rack.plugins.push({ ...KANBAN, on: true });
  drawRack('kanban');
  wire({ plugin: 'kanban' });
  setTimeout(() => wire(), 1600);
  log('instalado <b>ana.kanban 0.1.0</b> · sha256 ok · permissão: rede (api.github.com) · sem reiniciar');
}
function remove() {
  rack.plugins = rack.plugins.filter(p => p.id !== 'kanban');
  drawRack();
  log('<b>Kanban</b> removido. Os dados dele ficam no seu perfil até você apagar.');
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
log('Clique num plugin para desligar, num serviço para trocar o provider, ou instale um da comunidade.');
onVisible(rackEl, async () => {
  for (const step of [() => swap('ai'), () => install(), () => togglePlugin('tray')]) {
    await sleep(1500);
    if (rackTouched) return;
    step();
  }
}, 0.4);

// ── Store ─────────────────────────────────────────────────────────────
const wall = $('#store-wall');
const rows = 6, per = Math.ceil(WALL.length / rows);
wall.innerHTML = Array.from({ length: rows }, (_, r) => {
  const names = [...WALL.slice(r * per, r * per + per), ...WALL.slice(0, Math.max(0, per - (WALL.length - r * per)))];
  const items = names.map((n, i) => `<span${(i + r) % 9 === 0 ? ' class="on"' : ''}>${esc(n)}</span>`).join('');
  return `<div class="wall__row" style="--t:${70 + r * 9}s">${items}${items}</div>`;
}).join('');

const q = $('#shop-q'), cats = $('#shop-cats'), sgrid = $('#shop-grid'), empty = $('#shop-empty');
let cat = 'Todos', shopTouched = false;
const installed = new Set();
cats.innerHTML = CATEGORIES.map(c => `<button role="tab" aria-selected="${c === cat}" data-cat="${c}">${c}</button>`).join('');
const ACTION = { free: 'instalar', donation: 'instalar', subscription: 'assinar', once: 'comprar', trial: 'testar grátis' };
function drawShop() {
  const query = norm(q.value.trim());
  const hits = APPS.map((a, i) => ({ a, i })).filter(({ a }) => (cat === 'Todos' || a[4] === cat) && (!query || norm(`${a[1]} ${a[3]} ${a[4]} ${a[2]}`).includes(query))).slice(0, 9);
  empty.hidden = hits.length > 0;
  if (!hits.length) empty.innerHTML = 'Nenhum plugin com esse nome ainda. <a href="#creator">Que tal criar o seu?</a>';
  sgrid.innerHTML = hits.map(({ a: [glyph, name, by, desc], i }, k) => {
    const [kind, label] = priceOf(i), done = installed.has(i);
    return `<li class="app${done ? ' is-done' : ''}" style="animation-delay:${k * 40}ms"><div class="app__top"><span class="app__glyph" aria-hidden="true">${esc(glyph)}</span><div><p class="app__name">${esc(name)}</p><p class="app__by">@${esc(by)}</p></div></div><p class="app__desc">${esc(desc)}</p><div class="app__foot"><span class="price${kind === 'free' || kind === 'donation' ? ' price--free' : ''}">${label}</span><button class="install${done ? ' is-done' : ''}" data-app="${i}"${done ? ' disabled' : ''}>${done ? 'instalado' : ACTION[kind]}</button></div></li>`;
  }).join('');
}
async function installApp(btn) {
  const i = Number(btn.dataset.app), [kind] = priceOf(i);
  if (installed.has(i) || btn.classList.contains('is-busy')) return;
  btn.classList.add('is-busy');
  const steps = kind === 'free' || kind === 'donation' ? ['baixando…', 'sha256 ok', 'permissões ok'] : ['checkout do Cadente…', 'licença ok', 'sha256 ok'];
  for (const s of steps) { btn.textContent = s; await sleep(REDUCED ? 80 : 520); }
  installed.add(i);
  btn.classList.remove('is-busy');
  btn.classList.add('is-done');
  btn.textContent = 'instalado';
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
  for (const term of ['tema', 'sql', 'agente', '']) {
    if (shopTouched) return;
    q.value = '';
    for (const ch of term) { if (shopTouched) return; q.value += ch; drawShop(); await sleep(REDUCED ? 0 : 90); }
    if (!term) drawShop();
    await sleep(2200);
  }
}, 0.35);

// ── Creator mode ──────────────────────────────────────────────────────
new Maker($('#maker-win'), $('#maker-steps'));

// ── Earnings calculator ───────────────────────────────────────────────
const MODELS = {
  subscription: { share: 0.7, price: 'Preço por mês', people: 'Assinantes', per: 'por mês' },
  once: { share: 0.7, price: 'Preço', people: 'Compradores', per: 'no total' },
  donation: { share: 0.9, price: 'Doação média por mês', people: 'Apoiadores', per: 'por mês' },
};
const money = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const people = v => { const n = 10 * 10 ** (v / 25); const p = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; };
const price = $('#calc-price'), crowd = $('#calc-people'), value = $('#calc-value');
let model = 'subscription', shown = 0, anim = 0;
function calc() {
  const m = MODELS[model], pr = Number(price.value), n = people(Number(crowd.value));
  $('#calc-price-label').textContent = m.price;
  $('#calc-people-label').textContent = m.people;
  $('#calc-price-out').textContent = `US$ ${pr}`;
  $('#calc-people-out').textContent = money.format(n);
  $('#calc-per').textContent = m.per;
  for (const r of [price, crowd]) r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
  for (const card of document.querySelectorAll('.model')) card.classList.toggle('is-on', card.dataset.model === model);
  const target = pr * n * m.share, start = shown, t0 = performance.now();
  cancelAnimationFrame(anim);
  const step = t => {
    const k = REDUCED ? 1 : clamp((t - t0) / 600, 0, 1), e = 1 - (1 - k) ** 3;
    shown = start + (target - start) * e;
    value.textContent = `US$ ${money.format(shown)}`;
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
value.textContent = 'US$ 0';

// ── Install one-liner ─────────────────────────────────────────────────
$('#oneliner-copy').addEventListener('click', async e => {
  const btn = e.currentTarget;
  try { await navigator.clipboard.writeText($('#oneliner').textContent); btn.textContent = 'copiado'; } catch { btn.textContent = 'selecione e copie'; }
  setTimeout(() => { btn.textContent = 'copiar'; }, 1600);
});
