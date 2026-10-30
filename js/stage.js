// A Cadente v4 window on the page, played automatically. The state, the keys and the drawing are the prototype's
// own (js/v4); this file scales the window, animates what changed and plays scripted keystrokes. Visitors watch it:
// the window takes no clicks or keys.
import { createState, reduce, leaves, activeTab, findLeaf, activityOf } from './v4/model.mjs';
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
  constructor(host, { width = 1240, height = 760, state = createState(), maxHeight = null, fitTo = host.parentElement, hud = true } = {}) {
    this.host = host;
    this.width = width; this.height = height; this.maxHeight = maxHeight; this.fitTo = fitTo;
    this.S = state;
    this.run_ = 0;
    this.fast = false;
    this.tpl = document.createElement('template');

    host.classList.add('stage');
    host.innerHTML = `<div class="stage__viewport"><div class="v4 stage__app" aria-hidden="true"></div></div>${hud ? '<div class="stage__hud" aria-hidden="true"></div>' : ''}`;
    this.viewport = host.querySelector('.stage__viewport');
    this.root = host.querySelector('.stage__app');
    this.hud = host.querySelector('.stage__hud');
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
    setInterval(() => this.tick(), 1000);
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

  // ── State ───────────────────────────────────────────────────────────────
  setState(S) { this.S = S; this.draw(); this.measure(); }
  dispatch(action, { quiet = false } = {}) {
    const before = this.S, next = reduce(before, action);
    if (next === before) return false;
    this.S = next;
    if (this.fast) return true;
    this.draw();
    if (!quiet && !REDUCED) this.animate(before, next);
    return true;
  }
  flush() { this.draw(); this.measure(); }

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
    try { await script(this, id); return true; } catch (e) { if (e !== CANCEL) throw e; return false; }
  }
  stop() { this.run_++; this.hideHud(); }
  check(id) { if (id !== undefined && id !== this.run_) throw CANCEL; }
  wait(ms, id) {
    this.check(id);
    if (this.fast || ms <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => setTimeout(() => (id !== undefined && id !== this.run_ ? reject(CANCEL) : resolve()), REDUCED ? Math.min(ms, 200) : ms));
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

  // ── Keycaps under the window ────────────────────────────────────────────
  showHud(combo, label) {
    if (!this.hud) return;
    clearTimeout(this.hudTimer);
    this.hud.innerHTML = `<span class="hud__caps">${capsOf(combo).map(c => `<kbd>${c}</kbd>`).join('')}</span>${label ? `<span class="hud__label">${label}</span>` : ''}`;
    this.hud.classList.add('is-on');
    this.hudTimer = setTimeout(() => this.hideHud(), 1300);
  }
  hideHud() { this.hud?.classList.remove('is-on'); }
}
