// A live Cadente v4 window on the page. The state, the keys and the drawing are the prototype's own (js/v4);
// this file only scales the window, animates what changed, plays scripted keystrokes and lets the visitor take over.
import { createState, reduce, leaves, activeTab, focused, findLeaf, activityOf, overlayResults } from './v4/model.mjs';
import { resolveKey, KEYMAP } from './v4/keys.mjs';
import { render } from './v4/view.mjs';
import { plugin } from './v4/plugins.mjs';

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.9,.1,1)';
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
export const labelOf = combo => KEYMAP.find(e => e.keys === combo && e.scope === 'global')?.label ?? '';
export const capsOf = combo => { const caps = []; let rest = combo; while (rest.length > 1 && MODS[rest[0]]) { caps.push(rest[0]); rest = rest.slice(1); } return [...caps, rest === ' ' ? 'espaço' : rest]; };

// Reconciliation from the prototype's app.mjs: only what changed is touched, so unchanged panes keep their nodes.
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
  constructor(host, { width = 1240, height = 760, state = createState(), maxHeight = null, sidebar = true, fitTo = host.parentElement } = {}) {
    this.host = host;
    this.width = width; this.height = height; this.maxHeight = maxHeight; this.fitTo = fitTo;
    this.S = state;
    if (!sidebar) this.S = reduce(this.S, { type: 'PATCH_SETTINGS', sidebar: false });
    this.run_ = 0;
    this.fast = false;
    this.user = false;
    this.listeners = new Set();
    this.tpl = document.createElement('template');

    host.classList.add('stage');
    host.innerHTML = '<div class="stage__viewport"><div class="v4 stage__app" aria-hidden="true"></div></div><div class="stage__hud" aria-hidden="true"></div><div class="sr-only" aria-live="polite"></div>';
    this.viewport = host.querySelector('.stage__viewport');
    this.root = host.querySelector('.stage__app');
    this.hud = host.querySelector('.stage__hud');
    this.live = host.querySelector('[aria-live]');
    Object.assign(this.root.style, { width: `${width}px`, height: `${height}px` });

    this.fit();
    new ResizeObserver(() => this.fit()).observe(this.fitTo);
    this.draw();
    this.measure();
    this.bindPointer();
    this.bindKeys();
    this.visible = false;
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { threshold: 0.05 }).observe(host);
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
    const b = box.getBoundingClientRect(), e = el.getBoundingClientRect(), s = this.scale || 1;
    const top = (e.top - b.top) / s + box.scrollTop, bottom = top + e.height / s;
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
    this.emit('change', action);
    return true;
  }
  flush() { this.draw(); this.measure(); }
  focusedPlugin() { return focused(this.S).plugin; }
  leafWith(pluginId) { return leaves(activeTab(this.S).tree).find(l => l.plugin === pluginId); }

  tick() {
    if (!this.visible || document.hidden || this.fast) return;
    const S = this.S, visible = S.zoom ? [findLeaf(S, S.zoom).leaf] : leaves(activeTab(S).tree);
    const working = S.tabs.some(t => leaves(t.tree).some(l => activityOf(l, S)?.state === 'trabalhando'));
    if (working || visible.some(l => plugin(l.plugin)?.live?.(l))) this.dispatch({ type: 'TICK' }, { quiet: true });
  }

  // ── Motion ──────────────────────────────────────────────────────────────
  animate(before, after) {
    const was = leafIds(before), now = leafIds(after);
    for (const [id, p] of now) {
      if (!was.has(id)) this.grow(id);
      else if (p && p !== was.get(id)) this.reveal(id);
    }
    const ov = after.overlay, old = before.overlay;
    if (ov?.kind === 'pick' && ov.mode === 'plugin' && !(old?.kind === 'pick' && old.pane === ov.pane)) this.pickIn(ov.pane);
    if (ov && ['palette', 'help', 'agents'].includes(ov.kind) && old?.kind !== ov.kind) this.root.querySelector('.ov')?.animate([{ opacity: 0, transform: 'translateX(-50%) translateY(-8px) scale(.98)' }, { opacity: 1, transform: 'translateX(-50%)' }], { duration: 260, easing: EASE });
    if (ov?.kind === 'jump' && old?.kind !== 'jump') this.root.querySelectorAll('.jl').forEach((el, i) => el.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.25)', offset: 0.7 }, { transform: 'none' }], { duration: 360, delay: i * 30, easing: 'ease-out', fill: 'backwards' }));
    if (after.ui.toast && after.ui.toast !== before.ui.toast) this.root.querySelector('.hint.toast')?.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
    if (before.disabled.length !== after.disabled.length) this.flash(this.root.querySelector('[data-pane][data-focused="true"] [data-cursor]'));
  }
  pane(id) { return this.root.querySelector(`[data-pane][data-id="${id}"]`); }
  // A split opens like a door: the new cell grows from zero while the old one gives way, and the divider glows.
  grow(id) {
    const pane = this.pane(id), cell = pane?.parentElement;
    if (!cell?.classList.contains('cell')) return;
    const split = cell.parentElement, [a, sp, b] = split.children;
    const ga = parseFloat(a.style.flexGrow) || 0.5, gb = parseFloat(b.style.flexGrow) || 0.5;
    const opts = { duration: 700, easing: EASE };
    a.animate([{ flexGrow: ga + gb }, { flexGrow: ga }], opts);
    b.animate([{ flexGrow: 0.0001 }, { flexGrow: gb }], opts);
    pane.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease-out' });
    sp.animate([{ backgroundColor: '#d8b4fe', boxShadow: '0 0 24px 3px rgba(180,107,255,.95)' }, { backgroundColor: 'rgba(255,255,255,.15)', boxShadow: '0 0 0 0 rgba(180,107,255,0)' }], { duration: 1400, easing: 'ease-out' });
  }
  reveal(id) {
    const pane = this.pane(id);
    if (!pane) return;
    pane.querySelectorAll('.pc > *').forEach((el, i) => i < 36 && el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 22, easing: EASE, fill: 'backwards' }));
    pane.querySelector('.pt')?.animate([{ color: '#d8b4fe', textShadow: '0 0 12px rgba(180,107,255,.9)' }, { color: 'rgba(255,255,255,.9)', textShadow: 'none' }], { duration: 1200, easing: 'ease-out' });
  }
  pickIn(id) {
    const rows = [...(this.pane(id)?.querySelectorAll('.pick > .ln') ?? [])].reverse();
    rows.forEach((el, i) => i < 20 && el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 340, delay: i * 24, easing: EASE, fill: 'backwards' }));
  }
  flash(el) { el?.animate([{ boxShadow: '0 0 0 2px #b46bff, 0 0 22px rgba(180,107,255,.8)' }, { boxShadow: '0 0 0 2px transparent' }], { duration: 900, easing: 'ease-out' }); }
  boot() {
    if (REDUCED || this.fast) return;
    const win = this.root.querySelector('.win');
    win?.animate([{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 700, easing: 'ease-out' });
    this.root.querySelectorAll('.side .si, .side .sf .ln').forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 250 + i * 40, easing: EASE, fill: 'backwards' }));
    this.root.querySelectorAll('[data-pane] .pc > *, [data-pane] .ph, [data-pane] .pp').forEach((el, i) => i < 40 && el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 450 + i * 28, easing: EASE, fill: 'backwards' }));
  }

  // ── Scripted input ──────────────────────────────────────────────────────
  // Every script step checks its run id, so a new script (or the visitor) cancels the one in progress.
  async play(script) {
    const id = ++this.run_;
    this.emit('play');
    try { await script(this, id); return true; } catch (e) { if (e !== CANCEL) throw e; return false; }
  }
  stop() { this.run_++; this.hideHud(); }
  check(id) { if (id !== undefined && id !== this.run_) throw CANCEL; }
  wait(ms, id) {
    this.check(id);
    if (this.fast || ms <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => setTimeout(() => (id !== undefined && id !== this.run_ ? reject(CANCEL) : resolve()), REDUCED ? Math.min(ms, 200) : ms));
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
      if (!this.fast) await this.wait((34 + Math.random() * 60) / speed, id);
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
    clearTimeout(this.hudTimer);
    this.hud.innerHTML = `<span class="hud__caps">${capsOf(combo).map(c => `<kbd>${c}</kbd>`).join('')}</span>${label ? `<span class="hud__label">${label}</span>` : ''}`;
    this.hud.classList.add('is-on');
    this.hud.animate([{ transform: 'translateX(-50%) scale(.94)', boxShadow: '0 0 0 1px rgba(180,107,255,.9), 0 0 40px rgba(180,107,255,.6)' }, { transform: 'translateX(-50%) scale(1)', boxShadow: '0 0 0 1px rgba(255,255,255,.14), 0 0 0 rgba(0,0,0,0)' }], { duration: 520, easing: EASE });
    if (label) this.live.textContent = `${combo} ${label}`;
    this.hudTimer = setTimeout(() => this.hideHud(), 1400);
  }
  hideHud() { this.hud.classList.remove('is-on'); }

  // ── The visitor takes over ──────────────────────────────────────────────
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, detail) { for (const fn of this.listeners) fn(type, detail); }
  takeOver() {
    if (!this.user) { this.user = true; this.stop(); this.emit('user'); }
    this.host.classList.add('is-armed');
  }
  release() { this.user = false; this.host.classList.remove('is-armed'); this.emit('release'); }
  // Clickable areas: panes, picker rows, palette rows, sidebar tabs and leaves, view tabs and jump letters.
  bindPointer() {
    this.root.addEventListener('pointerdown', e => {
      this.takeOver();
      const S = this.S, t = e.target;
      const jl = t.closest('.jl');
      if (jl) return this.dispatch({ type: 'JUMP_TO', label: jl.textContent });
      const ovRow = t.closest('.ov .res .ln.row, .pick .ln.row');
      if (ovRow && S.overlay) {
        const rows = [...ovRow.parentElement.querySelectorAll(':scope > .ln.row')];
        const i = rows.indexOf(ovRow), n = overlayResults(S).length;
        if (i >= 0 && n) { this.dispatch({ type: 'OV_MOVE', d: i - S.overlay.sel }); this.dispatch({ type: 'OV_ACCEPT' }); return; }
      }
      if (S.overlay && !t.closest('.ov') && !t.closest('[data-pane][data-focused="true"]') && ['palette', 'help', 'agents', 'jump'].includes(S.overlay.kind)) return this.dispatch({ type: 'ESC' });
      const side = t.closest('[data-side-item]');
      if (side) {
        const { kind, id } = side.dataset;
        if (kind === 'tab') return this.dispatch({ type: 'SELECT_TAB', id });
        if (kind === 'leaf') return this.dispatch({ type: 'FOCUS', id });
        if (kind === 'grave') return this.dispatch({ type: 'RESTORE', id });
        return;
      }
      const pane = t.closest('[data-pane]');
      if (!pane) return;
      if (pane.dataset.id !== focused(S).id) this.dispatch({ type: 'FOCUS', id: pane.dataset.id });
      const vt = t.closest('.vt');
      if (vt) {
        const xs = [...vt.parentElement.children], on = xs.findIndex(x => x.classList.contains('on')), at = xs.indexOf(vt);
        if (at !== on) this.dispatch({ type: 'VIEW', d: at - on });
      }
    });
  }
  bindKeys() {
    addEventListener('pointerdown', e => { if (this.host.classList.contains('is-armed') && !this.host.contains(e.target) && !e.target.closest('[data-stage-control]')) this.host.classList.remove('is-armed'); });
    addEventListener('keydown', e => {
      if (!this.host.classList.contains('is-armed') || e.isComposing || ['Meta', 'Control', 'Alt', 'Shift', 'Dead'].includes(e.key)) return;
      const action = resolveKey(this.S, { key: e.key, meta: e.metaKey || e.ctrlKey, ctrl: e.ctrlKey && !e.metaKey, alt: e.altKey, shift: e.shiftKey });
      if (!action && e.key !== 'Tab') return;
      e.preventDefault();
      if (action) this.dispatch(action);
    });
  }
}
