// A Cadente v4 window on the page, played automatically. The state, the keys and the drawing are the prototype's
// own (js/v4); this file scales the window, animates what changed and plays scripted keystrokes. Visitors watch it:
// the window takes no clicks or keys.
import { createState, reduce, leaves, activeTab, findLeaf, activityOf, rects } from './v4/model.mjs';
import { resolveKey, KEYMAP } from './v4/keys.mjs';
import { render } from './v4/view.mjs';
import { plugin } from './v4/plugins.mjs';

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const CANCEL = Symbol('cancel');
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
    this.S = state;
    this.run_ = 0;
    this.fast = false;
    this.tpl = document.createElement('template');

    host.classList.add('stage');
    host.innerHTML = `<div class="stage__viewport"><div class="stage__cam"><div class="v4 stage__app" aria-hidden="true"></div></div></div>`
      + (hud ? '<i class="stage__vig" aria-hidden="true"></i><div class="stage__card" aria-hidden="true"></div><i class="stage__lb stage__lb--t" aria-hidden="true"></i><i class="stage__lb stage__lb--b" aria-hidden="true"></i><div class="stage__hud" aria-hidden="true"></div>' : '');
    this.viewport = host.querySelector('.stage__viewport');
    this.cam = host.querySelector('.stage__cam');
    this.root = host.querySelector('.stage__app');
    this.hud = host.querySelector('.stage__hud');
    this.cardEl = host.querySelector('.stage__card');
    this.bars = [...host.querySelectorAll('.stage__lb')];
    Object.assign(this.root.style, { width: `${width}px`, height: `${height}px` });

    this.fit();
    let lastW = 0;
    new ResizeObserver(() => { const w = this.fitTo.clientWidth; if (w !== lastW) { lastW = w; this.fit(); } }).observe(this.fitTo);
    this.draw();
    this.measure();
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

  // ── State ───────────────────────────────────────────────────────────────
  setState(S) { this.S = S; this.draw(); this.measure(); this.cut(); }
  dispatch(action, { quiet = false } = {}) {
    const before = this.S, next = reduce(before, action);
    if (next === before) return false;
    this.S = next;
    if (this.fast) return true;
    this.draw();
    if (!quiet && !REDUCED) this.animate(before, next);
    if (!quiet) this.follow(before);
    return true;
  }
  flush() { this.draw(); this.measure(); this.cut(); }

  // ── Camera ──────────────────────────────────────────────────────────────
  // A directed camera over the window, as in a product film: it pushes in on the pane where the action is when that
  // pane is a small part of the window, and pulls back to the whole window when the page changes, a window-wide
  // overlay opens or the chapter ends. It frames the pane's final place in the layout (from the split tree), so it
  // never chases a split while it is still opening. Only the transform of one layer moves.
  follow(before) {
    if (!this.camera) return;
    const S = this.S, tab = activeTab(S), ls = leaves(tab.tree);
    if (before && before.active !== S.active) { this.hold = true; this.pin = false; return this.go('wide'); }
    // A directed shot (Stage.shot) holds until the layout changes or an overlay opens.
    if (this.pin && before && leaves(activeTab(before).tree).length === ls.length && before.zoom === S.zoom && !S.overlay) return;
    this.pin = false;
    if (this.hold && before && activeTab(before).focus === tab.focus && leaves(activeTab(before).tree).length === ls.length) return;
    this.hold = false;
    const wide = S.zoom || S.ui.side || ['palette', 'help', 'agents', 'jump', 'notice'].includes(S.overlay?.kind) || ls.length < 3;
    if (wide) return this.go('wide');
    const r = rects(tab.tree)[tab.focus], tree = this.root.querySelector('.tree');
    if (!r || !tree || r.w * r.h > 0.4) return this.go('wide');
    this.go(`${tab.id}:${tab.focus}:${ls.length}`, { x: tree.offsetLeft + r.x * tree.clientWidth, y: tree.offsetTop + r.y * tree.clientHeight, w: r.w * tree.clientWidth, h: r.h * tree.clientHeight });
  }
  // A directed close-up on one part of the window, by selector (the note being written, the result grid…).
  // `z` forces the zoom when the part is too wide to be framed on its own.
  shot(sel, z) {
    if (!this.camera || this.fast) return;
    const el = this.root.querySelector(sel);
    if (!el) return;
    const a = this.root.getBoundingClientRect(), b = el.getBoundingClientRect(), k = a.width / this.width;
    this.pin = true; this.hold = false;
    this.go(`shot:${sel}`, { x: (b.left - a.left) / k, y: (b.top - a.top) / k, w: b.width / k, h: b.height / k }, z);
  }
  // Frames a box given in the window's own pixels.
  go(shot, box, force) {
    if (shot === this.framed) return;
    this.framed = shot;
    if (!box) return this.move(0, 0, 1);
    const s = this.scale, W = this.width * s, H = this.height * s;
    const x = box.x * s, y = box.y * s, w = box.w * s, h = box.h * s;
    const z = force ? Math.min(1.6, Math.max(1, force)) : Math.min(1.5, (W * 0.9) / w, (H * 0.9) / h);
    if (z < 1.12) return this.move(0, 0, 1);
    const clamp = (v, lo) => Math.min(0, Math.max(lo, v));
    // A part taller than the shot is framed from its top, where a note or a page starts.
    const top = h * z > H * 0.95 ? H * 0.04 - z * y : H / 2 - z * (y + h / 2);
    this.move(clamp(W / 2 - z * (x + w / 2), W - z * W), clamp(top, H - z * H), z);
  }
  move(x, y, z) {
    this.cam.style.transform = z === 1 ? '' : `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${z.toFixed(3)})`;
    this.host.classList.toggle('is-close', z !== 1);
  }
  wide() { this.hold = true; this.pin = false; this.go('wide'); }
  // A hard cut back to the whole window, without the move (new state, resize, jump between chapters).
  cut() {
    if (!this.cam) return;
    this.cam.style.transition = 'none';
    this.framed = 'wide'; this.hold = false; this.pin = false;
    this.move(0, 0, 1);
    void this.cam.offsetWidth;
    this.cam.style.transition = '';
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
    this.hideCard();
    try { await script(this, id); return true; } catch (e) { if (e !== CANCEL) throw e; return false; }
  }
  stop() { this.run_++; this.hideHud(); this.hideCard(); }
  // A new run takes the title card and the letterbox down at once, even while the old run is still holding them.
  hideCard() { for (const el of [this.cardEl, ...(this.bars ?? [])]) el?.getAnimations({ subtree: true }).forEach(a => a.cancel()); }
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
    if (!this.fast) this.showHud(combo, label ?? labelOf(combo));
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
  // A chapter's title card over the window, like a cut in a film: the letterbox closes in, a shooting star crosses,
  // the words rise one by one, and the card lets go while the chapter already starts underneath.
  // Only opacity and transform move.
  async card({ kicker, title }, ms, id) {
    this.check(id);
    if (!this.cardEl || this.fast || REDUCED) return;
    this.hideCard();
    const el = this.cardEl, inn = 240, E2 = 'cubic-bezier(.16,1,.3,1)';
    const words = title.split(' ').map(w => `<span class="w"><span>${w}</span></span>`).join(' ');
    el.innerHTML = `<i class="stage__star"></i><div class="stage__card-in"><span class="stage__card-n"><i></i>${kicker}<i></i></span><b>${words}</b></div>`;
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: inn, easing: 'ease-out', fill: 'forwards' });
    for (const b of this.bars) b.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 520, easing: E2, fill: 'forwards' });
    el.querySelector('.stage__star').animate([{ opacity: 0, transform: 'translate(-70%, 0) rotate(-14deg)' }, { opacity: 1, offset: 0.25 }, { opacity: 0, transform: 'translate(70%, 0) rotate(-14deg)' }], { duration: 1000, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'forwards' });
    el.querySelector('.stage__card-n').animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: E2, fill: 'forwards' });
    for (const n of el.querySelectorAll('.stage__card-n i')) n.animate([{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 700, delay: 120, easing: E2, fill: 'forwards' });
    [...el.querySelectorAll('.w > span')].forEach((w, i) => w.animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: 760, delay: 90 + i * 55, easing: E2, fill: 'backwards' }));
    try { await this.wait(ms - inn / this.tempo, id); } finally {
      // Only the run that showed the card takes it down; a newer run already cleared it.
      if (id === undefined || id === this.run_) {
        el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.03)' }], { duration: 420, easing: 'ease-in', fill: 'forwards' });
        for (const b of this.bars) b.animate([{ transform: 'none' }, { transform: 'scaleY(0)' }], { duration: 620, delay: 80, easing: E2, fill: 'forwards' });
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
