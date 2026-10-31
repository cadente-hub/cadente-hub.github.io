// A Cadente v4 window on the page, played automatically. The state, the keys and the drawing are the prototype's
// own (js/v4); this file scales the window, animates what changed and plays scripted keystrokes. Visitors watch it:
// the window takes no clicks or keys.
import { createState, reduce, leaves, activeTab, findLeaf, activityOf, rects } from './v4/model.mjs';
import { resolveKey, KEYMAP } from './v4/keys.mjs';
import { render } from './v4/view.mjs';
import { plugin } from './v4/plugins.mjs';
import { translateTree } from './v4-site/translate.mjs';

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const CANCEL = Symbol('cancel');
// The camera holds each shot at least this long (ms of real time) before it reframes on its own.
const DWELL = 1500;
const NAMED = { '↵': 'Enter', esc: 'Escape', '⇥': 'Tab', '↑': 'ArrowUp', '↓': 'ArrowDown', '←': 'ArrowLeft', '→': 'ArrowRight', '⌫': 'Backspace', espaço: ' ', End: 'End', Home: 'Home' };
const MODS = { '⌘': 'meta', '⇧': 'shift', '⌥': 'alt', '⌃': 'ctrl' };

export function parseKey(combo) {
  const ev = { key: '', meta: false, shift: false, alt: false, ctrl: false };
  let rest = combo;
  while (rest.length > 1 && MODS[rest[0]]) { ev[MODS[rest[0]]] = true; rest = rest.slice(1); }
  ev.key = NAMED[rest] ?? rest;
  if (ev.shift && ev.key.length === 1) ev.key = ev.key.toUpperCase();
  return ev;
}
const labelOf = combo => KEYMAP.find(e => e.keys === combo && e.scope === 'global')?.label ?? '';
// The language windows are drawn in (js/v4-site/translate.mjs): null keeps the prototype's pt-BR. A window created
// later takes the page's language; Stage.setLanguage changes one window. `onDraw` sees every frame (the harvest).
let pageLanguage = null;
export const setWindowLanguage = tr => { pageLanguage = tr; };
export const drawHooks = [];
const capsOf = combo => { const caps = []; let rest = combo; while (rest.length > 1 && MODS[rest[0]]) { caps.push(rest[0]); rest = rest.slice(1); } return [...caps, rest]; };

// Reconciliation from the prototype's app.mjs: only what changed is touched, so unchanged panes keep their nodes
// (and any animation running on them).
function morph(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b); return; }
  if (a.nodeType === 3) { if (a.data !== b.data) a.data = b.data; return; }
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of b.attributes) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  const ac = [...a.childNodes], bc = [...b.childNodes];
  for (let i = 0; i < bc.length; i++) { if (ac[i]) morph(ac[i], bc[i]); else a.append(bc[i]); }
  for (let i = bc.length; i < ac.length; i++) ac[i].remove();
}

const leafIds = S => new Map(S.tabs.flatMap(t => leaves(t.tree)).map(l => [l.id, l.plugin]));

export class Stage {
  constructor(host, { width = 1240, height = 760, state = createState(), maxHeight = null, fitTo = host.parentElement, hud = true, tempo = 1, camera = false } = {}) {
    this.host = host;
    this.width = width; this.height = height; this.maxHeight = maxHeight; this.fitTo = fitTo;
    // Every wait, keystroke and tick plays at `tempo` of its written length (1 = as written).
    this.tempo = tempo;
    this.camera = camera && !REDUCED;
    this.framed = 'wide'; // the shot the camera holds now
    this.framedAt = 0;
    this.view = { x: 0, y: 0, z: 1 };
    this.S = state;
    this.run_ = 0;
    this.fast = false;
    this.tpl = document.createElement('template');
    this.tr = pageLanguage;

    host.classList.add('stage');
    host.innerHTML = `<div class="stage__viewport"><div class="stage__cam"><div class="stage__tilt"><div class="v4 stage__app" aria-hidden="true"></div></div></div></div>`
      + (hud ? '<i class="stage__vig" aria-hidden="true"></i><div class="stage__title" aria-hidden="true"></div><div class="stage__hud" aria-hidden="true"></div>' : '');
    this.viewport = host.querySelector('.stage__viewport');
    this.cam = host.querySelector('.stage__cam');
    this.root = host.querySelector('.stage__app');
    this.hud = host.querySelector('.stage__hud');
    this.titleEl = host.querySelector('.stage__title');
    Object.assign(this.root.style, { width: `${width}px`, height: `${height}px` });

    this.fit();
    let lastW = 0;
    new ResizeObserver(() => { const w = this.fitTo.clientWidth; if (w !== lastW) { lastW = w; this.fit(); } }).observe(this.fitTo);
    this.draw();
    this.measure();
    // The focus beam lives inside the window, after it, so the redraw never touches it and the camera carries it.
    if (this.camera) { this.beamEl = document.createElement('i'); this.beamEl.className = 'stage__beam'; this.root.append(this.beamEl); }
    this.visible = false;
    this.waiters = [];
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) { this.waiters.splice(0).forEach(fn => fn()); }
    }, { threshold: 0.2 }).observe(host);
    setInterval(() => this.tick(), 1000 * this.tempo);
  }

  // ── Layout ──────────────────────────────────────────────────────────────
  fit() {
    const box = this.fitTo, cs = getComputedStyle(box);
    const w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) || this.width;
    const limit = typeof this.maxHeight === 'function' ? this.maxHeight() : this.maxHeight;
    this.scale = Math.max(0.1, Math.min(w / this.width, limit ? limit / this.height : Infinity));
    const sw = `${Math.floor(this.width * this.scale)}px`, sh = `${Math.floor(this.height * this.scale)}px`;
    this.root.style.transform = `scale(${this.scale})`;
    Object.assign(this.viewport.style, { width: sw, height: sh });
    Object.assign(this.host.style, { width: sw, height: sh });
    this.cut();
  }
  measure() {
    const tree = this.root.querySelector('.tree');
    if (tree && (tree.clientWidth !== this.S.ui.vw || tree.clientHeight !== this.S.ui.vh)) this.S = reduce(this.S, { type: 'PATCH_SETTINGS', vw: tree.clientWidth, vh: tree.clientHeight });
  }

  // ── Drawing ─────────────────────────────────────────────────────────────
  draw() {
    this.tpl.innerHTML = render(this.S);
    if (this.tr) translateTree(this.tpl.content, this.tr);
    for (const hook of drawHooks) hook(this.tpl.content, this);
    const next = this.tpl.content.firstElementChild;
    if (!this.root.firstElementChild) this.root.append(next); else morph(this.root.firstElementChild, next);
    // Scroll inside the window only: scrollIntoView would also move the page.
    for (const pc of this.root.querySelectorAll('.pc')) {
      const target = pc.querySelector('[data-cursor], [data-sel="true"]');
      if (target) this.nearest(pc, target);
      else if (['terminal', 'chat'].includes(pc.closest('[data-pane]').dataset.plugin) || pc.querySelector('.pick')) pc.scrollTop = pc.scrollHeight;
    }
    for (const sel of this.root.querySelectorAll('.ov .res [data-sel="true"], [data-side-cursor]')) this.nearest(sel.closest('.res, .sl'), sel);
    // Plugins drawn as one block (the Postgres script, the notes, the web page) keep their own line in view.
    for (const box of this.root.querySelectorAll('[data-scrollbox]')) { const at = box.querySelector('[data-at]'); if (at) this.keep(box, at); }
    for (const on of this.root.querySelectorAll('.vts .vt.on')) {
      const t = on.parentElement, xs = [...t.children], at = xs.indexOf(on), x = el => el.offsetLeft - xs[0].offsetLeft;
      let first = xs.findIndex(el => x(el) >= t.scrollLeft);
      if (first < 0 || at < first) first = at;
      while (x(on) + on.offsetWidth - x(xs[first]) > t.clientWidth && first < at) first++;
      t.scrollLeft = x(xs[first]);
    }
  }
  nearest(box, el) {
    if (!box) return;
    const top = el.offsetTop - box.offsetTop, bottom = top + el.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
  }
  // `box` is positioned, so offsetTop is measured from it; two lines of context stay visible around the target.
  keep(box, el) {
    const pad = el.offsetHeight * 2, top = el.offsetTop, bottom = top + el.offsetHeight;
    if (top - pad < box.scrollTop) box.scrollTop = Math.max(0, top - pad);
    else if (bottom + pad > box.scrollTop + box.clientHeight) box.scrollTop = bottom + pad - box.clientHeight;
  }

  setLanguage(tr) { this.tr = tr; this.draw(); }
  label(text) { return (text && this.tr?.(text)) || text; }

  // ── State ───────────────────────────────────────────────────────────────
  setState(S) { this.S = S; this.draw(); this.measure(); this.cut(); this.beam(); }
  dispatch(action, { quiet = false } = {}) {
    const before = this.S, next = reduce(before, action);
    if (next === before) return false;
    this.S = next;
    if (this.fast) return true;
    this.draw();
    if (!quiet && !REDUCED) this.animate(before, next);
    if (!quiet) { this.follow(before); this.beam(); }
    return true;
  }
  flush() { this.draw(); this.measure(); this.cut(); this.beam(); }

  // ── Camera ──────────────────────────────────────────────────────────────
  // A camera operator over the window. It frames one subject at a time: the whole window, the pane where the action
  // is, or a part the script points at (Stage.shot). Panes are framed at their final place in the layout, so the
  // camera never chases a split while it opens. Each shot is held for at least DWELL ms and a new subject has to stay
  // put for SETTLE ms before the camera goes, so quick focus changes do not make it swing back and forth. A move
  // between two far close-ups pulls back on the way, like a reframe. Only one layer's transform moves.
  paneBox(id) {
    const S = this.S, tab = activeTab(S), r = rects(tab.tree)[id], tree = this.root.querySelector('.tree');
    if (!r || !tree) return null;
    const a = this.root.getBoundingClientRect(), t = tree.getBoundingClientRect(), k = a.width / this.width;
    const x = (t.left - a.left) / k, y = (t.top - a.top) / k, w = t.width / k, h = t.height / k;
    return { x: x + r.x * w, y: y + r.y * h, w: r.w * w, h: r.h * h };
  }
  // What the camera should frame now, if the script points at nothing.
  subject() {
    const S = this.S, tab = activeTab(S), ls = leaves(tab.tree);
    if (S.zoom || S.ui.side || ['palette', 'help', 'agents', 'jump', 'notice'].includes(S.overlay?.kind) || ls.length < 3 || this.hold) return { key: 'wide' };
    const r = rects(tab.tree)[tab.focus];
    if (!r || r.w * r.h > 0.4) return { key: 'wide' };
    return { key: `${tab.id}:${tab.focus}:${ls.length}`, box: this.paneBox(tab.focus) };
  }
  follow(before) {
    if (!this.camera) return;
    const S = this.S;
    const layout = st => st && `${st.active}|${st.zoom}|${leaves(activeTab(st).tree).length}|${['palette', 'help', 'agents', 'jump', 'notice'].includes(st.overlay?.kind)}`;
    const changed = layout(before) !== layout(S);
    // A new page opens on the whole window and stays there until something happens on it.
    if (before && before.active !== S.active) { this.pin = null; this.hold = true; return this.go('wide', null, null, true); }
    if (this.pin && !changed) return;
    if (changed) this.pin = null;
    if (this.hold && before && activeTab(before).focus === activeTab(S).focus && !changed) return;
    this.hold = false;
    const want = this.subject();
    clearTimeout(this.pending);
    if (want.key === this.framed) return;
    // The shot is held for DWELL, unless the focused pane has left it: then the camera goes as soon as it settles.
    const v = this.view, hw = this.width / (2 * v.z), hh = this.height / (2 * v.z), f = this.paneBox(activeTab(S).focus);
    const seen = !f ? 1 : (Math.max(0, Math.min(f.x + f.w, v.x + hw) - Math.max(f.x, v.x - hw)) * Math.max(0, Math.min(f.y + f.h, v.y + hh) - Math.max(f.y, v.y - hh))) / (f.w * f.h);
    const wait = seen < 0.6 ? 120 : Math.max(260, DWELL - (performance.now() - this.framedAt));
    this.pending = setTimeout(() => { if (this.pin) return; const w = this.subject(); this.go(w.key, w.box); }, wait);
  }
  // A close-up the script asks for, on one part of the window (the note being written, the result grid…). It is
  // measured once the window's own animations end, and held until the layout changes or Stage.wide().
  // `z` forces the zoom when the part is too wide to be framed on its own.
  shot(sel, z) {
    if (!this.camera || this.fast) return;
    this.pin = sel; this.hold = false;
    clearTimeout(this.pending);
    const id = this.run_, running = this.root.getAnimations({ subtree: true }).filter(an => an.effect?.getKeyframes?.().some(k => 'flexGrow' in k));
    Promise.all(running.map(an => an.finished.catch(() => {}))).then(() => requestAnimationFrame(() => {
      if (this.pin !== sel || id !== this.run_) return;
      const el = this.root.querySelector(sel);
      if (!el) return;
      const a = this.root.getBoundingClientRect(), b = el.getBoundingClientRect(), k = a.width / this.width;
      this.go(`shot:${sel}`, { x: (b.left - a.left) / k, y: (b.top - a.top) / k, w: b.width / k, h: b.height / k }, z, true);
    }));
  }
  wide() { this.pin = null; this.hold = true; clearTimeout(this.pending); this.go('wide', null, null, true); }
  // Frames a box given in the window's own pixels; `force` sets the zoom.
  go(key, box, force, now) {
    if (key === this.framed && !now) return;
    this.framed = key; this.framedAt = performance.now();
    if (!box) return this.move({ x: this.width / 2, y: this.height / 2, z: 1 });
    let z = force ? Math.min(1.6, Math.max(1, force)) : Math.min(1.5, (this.width * 0.88) / box.w, (this.height * 0.88) / box.h);
    if (z < 1.12) return this.move({ x: this.width / 2, y: this.height / 2, z: 1 });
    // A part taller than the shot is framed from its top, where a note or a page starts.
    const y = box.h * z > this.height * 0.95 ? box.y + (0.46 * this.height) / z : box.y + box.h / 2;
    this.move({ x: box.x + box.w / 2, y, z });
  }
  // Moves the view (its centre in the window's pixels, and its zoom). A long move between two close-ups goes through
  // a wider midpoint first.
  move(to, { ms = 1150, ease = 'cubic-bezier(.65,0,.35,1)' } = {}) {
    clearTimeout(this.leg);
    const from = this.view, far = Math.hypot(to.x - from.x, to.y - from.y) / (this.width / Math.max(from.z, to.z));
    if (from.z > 1.05 && to.z > 1.05 && far > 0.45) {
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: Math.max(1, Math.min(from.z, to.z) * 0.78) };
      this.place(mid, 620, 'cubic-bezier(.45,0,.55,1)');
      this.leg = setTimeout(() => this.place(to, 900, 'cubic-bezier(.22,1,.36,1)'), 600);
      return;
    }
    this.place(to, ms, ease);
  }
  place(v, ms, ease) {
    this.view = v;
    const s = this.scale, W = this.width * s, H = this.height * s, z = v.z;
    let tx = W / 2 - z * s * v.x, ty = H / 2 - z * s * v.y;
    if (z >= 1) { tx = Math.min(0, Math.max(W - z * W, tx)); ty = Math.min(0, Math.max(H - z * H, ty)); }
    else { tx = (W - z * W) / 2; ty = (H - z * H) / 2; }
    this.cam.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
    this.cam.style.transform = Math.abs(z - 1) < 1e-3 ? '' : `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${z.toFixed(3)})`;
    this.host.classList.toggle('is-close', z > 1.05);
    this.host.classList.toggle('is-far', z < 0.98);
  }
  // A hard cut back to the whole window, without the move (new state, resize, jump between chapters).
  cut() {
    if (!this.cam) return;
    clearTimeout(this.leg); clearTimeout(this.pending);
    this.framed = 'wide'; this.hold = false; this.pin = null;
    this.place({ x: this.width / 2, y: this.height / 2, z: 1 }, 0);
    void this.cam.offsetWidth;
  }
  // The focus beam: a thin light around the focused pane that glides to the next one when the focus moves, so the
  // eye always knows where the action went. Hidden with one pane, on a zoomed pane or under a window-wide overlay.
  beam() {
    const el = this.beamEl;
    if (!el || this.fast) return;
    const S = this.S, tab = activeTab(S), box = this.paneBox(tab.focus);
    const off = !box || leaves(tab.tree).length < 2 || S.zoom || S.ui.side || ['palette', 'help', 'agents', 'jump', 'notice'].includes(S.overlay?.kind);
    el.classList.toggle('is-on', !off);
    if (off) { this.beamKey = null; return; }
    const key = `${tab.id}:${tab.focus}:${Math.round(box.x)}:${Math.round(box.y)}:${Math.round(box.w)}:${Math.round(box.h)}`;
    if (key === this.beamKey) return;
    const jumped = !this.beamKey || !this.beamKey.startsWith(`${tab.id}:`);
    this.beamKey = key;
    el.style.transition = jumped ? 'none' : '';
    Object.assign(el.style, { transform: `translate(${box.x + 2}px, ${box.y + 2}px)`, width: `${box.w - 4}px`, height: `${box.h - 4}px` });
    if (!jumped) el.animate([{ opacity: 1, boxShadow: '0 0 0 1px rgba(216,180,254,.9), 0 0 40px 6px rgba(180,107,255,.75)' }, { opacity: 0.7 }], { duration: 900, delay: 380, easing: 'ease-out' });
  }

  tick() {
    if (!this.visible || document.hidden || this.fast) return;
    const S = this.S, visible = S.zoom ? [findLeaf(S, S.zoom).leaf] : leaves(activeTab(S).tree);
    const working = S.tabs.some(t => leaves(t.tree).some(l => activityOf(l, S)?.state === 'trabalhando'));
    if (working || visible.some(l => plugin(l.plugin)?.live?.(l))) this.dispatch({ type: 'TICK' }, { quiet: true });
  }

  // ── Motion ──────────────────────────────────────────────────────────────
  // Only transform and opacity are animated, and no element gets a delayed start: a later redraw can never
  // show a line that an animation was still hiding.
  animate(before, after) {
    const was = leafIds(before), now = leafIds(after);
    for (const [id, p] of now) {
      if (!was.has(id)) this.grow(id);
      else if (p && p !== was.get(id)) this.reveal(id);
    }
    const ov = after.overlay, old = before.overlay;
    if (ov?.kind === 'pick' && ov.mode === 'plugin' && !(old?.kind === 'pick' && old.pane === ov.pane)) this.pane(ov.pane)?.querySelector('.pick')?.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: EASE });
    if (ov && ['palette', 'help', 'agents'].includes(ov.kind) && old?.kind !== ov.kind) this.root.querySelector('.ov')?.animate([{ opacity: 0, transform: 'translateX(-50%) translateY(-8px) scale(.98)' }, { opacity: 1, transform: 'translateX(-50%)' }], { duration: 280, easing: EASE });
    if (ov?.kind === 'jump' && old?.kind !== 'jump') this.root.querySelectorAll('.jl').forEach(el => el.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.7 }, { transform: 'none' }], { duration: 380, easing: 'ease-out' }));
    if (after.ui.toast && after.ui.toast !== before.ui.toast) this.root.querySelector('.hint.toast')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240 });
  }
  pane(id) { return this.root.querySelector(`[data-pane][data-id="${id}"]`); }
  // A split opens like a door: the new cell grows from the edge, the old one gives way, and the divider glows.
  grow(id) {
    const pane = this.pane(id), cell = pane?.parentElement;
    if (!cell?.classList.contains('cell')) return;
    const split = cell.parentElement, [a, sp, b] = split.children;
    const ga = parseFloat(a.style.flexGrow) || 0.5, gb = parseFloat(b.style.flexGrow) || 0.5;
    const opts = { duration: 560, easing: EASE };
    a.animate([{ flexGrow: ga + gb - 0.0001 }, { flexGrow: ga }], opts);
    b.animate([{ flexGrow: 0.0001 }, { flexGrow: gb }], opts);
    pane.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
    sp.animate([{ backgroundColor: '#d8b4fe', boxShadow: '0 0 22px 3px rgba(180,107,255,.9)' }, { backgroundColor: 'rgba(255,255,255,.15)', boxShadow: '0 0 0 0 rgba(180,107,255,0)' }], { duration: 1200, easing: 'ease-out' });
  }
  reveal(id) {
    const pane = this.pane(id);
    if (!pane) return;
    pane.querySelector('.pc')?.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
    pane.querySelector('.pt')?.animate([{ color: '#d8b4fe' }, { color: 'rgba(255,255,255,.9)' }], { duration: 1000, easing: 'ease-out' });
  }
  boot() {
    if (REDUCED || this.fast) return;
    this.root.querySelector('.win')?.animate([{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: EASE });
  }
  // Cross-fade used when the story starts over or jumps to a chapter.
  async fade(out, id) {
    if (REDUCED) return;
    const a = this.viewport.animate(out ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-in-out', fill: 'forwards' });
    await a.finished.catch(() => {});
    if (!out) a.cancel();
    this.check(id);
  }

  // ── Scripted input ──────────────────────────────────────────────────────
  // Every step checks its run id, so starting another script cancels the one in progress.
  async play(script) {
    const id = ++this.run_;
    this.hideTitle();
    try { await script(this, id); return true; } catch (e) { if (e !== CANCEL) throw e; return false; }
  }
  stop() { this.run_++; this.hideHud(); this.hideTitle(); }
  // A new run takes the chapter title down at once, even while the old run is still holding it.
  hideTitle() { if (this.titleEl) { this.titleEl.getAnimations({ subtree: true }).forEach(a => a.cancel()); this.titleEl.innerHTML = ''; } }
  check(id) { if (id !== undefined && id !== this.run_) throw CANCEL; }
  wait(ms, id) {
    this.check(id);
    if (this.fast || ms <= 0) return Promise.resolve();
    const t = REDUCED ? Math.min(ms, 200) : ms * this.tempo;
    return new Promise((resolve, reject) => setTimeout(() => (id !== undefined && id !== this.run_ ? reject(CANCEL) : resolve()), t));
  }
  // Resolves when the window is on screen, so the story never runs ahead while nobody is watching.
  whenVisible(id) {
    this.check(id);
    return this.visible && !document.hidden ? Promise.resolve() : new Promise(resolve => this.waiters.push(resolve)).then(() => this.check(id));
  }
  async key(combo, id, { label, hold = 520 } = {}) {
    this.check(id);
    const action = resolveKey(this.S, parseKey(combo));
    if (!this.fast) this.showHud(combo, label ?? this.label(labelOf(combo)));
    if (action) this.dispatch(action);
    if (!this.fast) await this.wait(hold, id);
  }
  async type(text, id, { speed = 1 } = {}) {
    for (const ch of text) {
      this.check(id);
      this.dispatch(this.S.overlay && 'query' in this.S.overlay ? { type: 'OV_TYPE', text: ch } : { type: 'TYPE', text: ch });
      if (!this.fast) await this.wait((40 + Math.random() * 45) / speed, id);
    }
  }
  async fastForward(script) {
    this.fast = true;
    try { await script(this); } finally { this.fast = false; }
    this.flush();
  }
  // Time passing: the agent and the Chat advance one step per tick. Fast-forward ticks at once.
  async ticks(n, id) {
    if (this.fast) { for (let i = 0; i < n; i++) this.dispatch({ type: 'TICK' }); return; }
    await this.wait(n * 1000 + 250, id);
  }
  // Between chapters the camera pulls back until the window floats in the dark, tilted like a product shot, a light
  // runs across its glass, a shooting star crosses, and the next chapter's title rises word by word over it. Then the title lifts away while the camera pushes back in and
  // the chapter already starts. Nothing stops: the window keeps living under the title.
  async interlude({ kicker, title }, ms, id) {
    this.check(id);
    if (!this.titleEl || this.fast || REDUCED) return;
    this.hideTitle();
    const el = this.titleEl, E2 = 'cubic-bezier(.16,1,.3,1)';
    clearTimeout(this.untilt);
    this.host.classList.add('is-tilting');
    if (this.camera) { this.pin = null; this.hold = true; clearTimeout(this.pending); this.framed = 'far'; this.move({ x: this.width / 2, y: this.height / 2, z: 0.8 }, { ms: 950, ease: 'cubic-bezier(.65,0,.35,1)' }); }
    const words = title.split(' ').map(w => `<span class="w"><span>${w}</span></span>`).join(' ');
    el.innerHTML = `<i class="stage__meteor"></i><div class="stage__title-in"><span class="stage__kicker">${kicker}</span><b>${words}</b></div>`;
    const inn = el.querySelector('.stage__title-in');
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease-out', fill: 'forwards' });
    inn.animate([{ transform: 'translateY(10px)' }, { transform: 'translateY(-6px)' }], { duration: ms * this.tempo + 600, easing: 'linear', fill: 'forwards' });
    el.querySelector('.stage__meteor').animate([{ opacity: 0, transform: 'translate(-30vw, -40px) rotate(-16deg) scaleX(.4)' }, { opacity: 1, offset: 0.3 }, { opacity: 0, transform: 'translate(40vw, 60px) rotate(-16deg) scaleX(1)' }], { duration: 1300, delay: 150, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'both' });
    el.querySelector('.stage__kicker').animate([{ opacity: 0, transform: 'translateY(10px)', letterSpacing: '.5em' }, { opacity: 1, transform: 'none', letterSpacing: '.24em' }], { duration: 900, delay: 120, easing: E2, fill: 'both' });
    [...el.querySelectorAll('.w > span')].forEach((w, i) => w.animate([{ transform: 'translateY(110%) rotate(4deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 220 + i * 70, easing: E2, fill: 'both' }));
    try { await this.wait(ms, id); } finally {
      if (id === undefined || id === this.run_) {
        [...el.querySelectorAll('.w > span')].forEach((w, i) => w.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-70%)', opacity: 0 }], { duration: 520, delay: i * 35, easing: 'cubic-bezier(.55,0,.75,.2)', fill: 'forwards' }));
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, delay: 200, easing: 'ease-in', fill: 'forwards' });
        if (this.camera) { this.hold = true; this.framed = 'wide'; this.framedAt = performance.now(); this.move({ x: this.width / 2, y: this.height / 2, z: 1 }, { ms: 1100, ease: 'cubic-bezier(.22,1,.36,1)' }); }
        // The tilted layer is promoted only while it moves, so the window is sharp again once it is back.
        this.untilt = setTimeout(() => this.host.classList.remove('is-tilting'), 1300);
      }
    }
  }

  // ── Keycaps under the window ────────────────────────────────────────────
  // The same key pressed again keeps its pill and only presses the caps again, so a run of ↓ reads as one gesture.
  showHud(combo, label) {
    if (!this.hud) return;
    clearTimeout(this.hudTimer);
    const key = `${combo}|${label}`;
    if (key !== this.hudKey || !this.hud.classList.contains('is-on')) {
      this.hudKey = key;
      this.hud.innerHTML = `<span class="hud__caps">${capsOf(combo).map(c => `<kbd>${c}</kbd>`).join('')}</span>${label ? `<span class="hud__label">${label}</span>` : ''}`;
      this.hud.querySelector('.hud__label')?.animate([{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
    }
    for (const k of this.hud.querySelectorAll('kbd')) k.animate([{ transform: 'translateY(3px) scale(.94)' }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    this.hud.classList.add('is-on');
    this.hudTimer = setTimeout(() => this.hideHud(), 1300);
  }
  hideHud() { this.hud?.classList.remove('is-on'); }
}
