// Cadu Tamagotchi: the example plugin of Creator mode. It lives in the app's floating layer (shell.overlay),
// so it hovers over the panes: the visitor drags it around, feeds it and gives it a bath.
// Cadu is drawn in ANSI half blocks (▀ ▄), two sprite pixels per character, from the app's sprite sheet.
import sheet from './cadu.sprites.json' with { type: 'json' };
import { COLORS } from './cadu.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MUD = { M: '#6b4423', N: '#4a2f17' };
const color = ch => (ch === '.' ? null : MUD[ch] ?? COLORS[sheet.palette[ch]]);

// A frown for the hungry face, drawn over the resting frame.
const FRAMES = { ...sheet.frames, hungry: sheet.frames.rest.map((r, y) => (y === 10 ? '....SGGKKGGD....' : y === 11 ? '.....SKGGKD.....' : r)) };
// Where mud sticks, in order: more dirt, more spots. Every spot sits on Cadu's body.
const SPOTS = [[6, 5], [10, 9], [2, 7], [13, 8], [5, 9], [9, 5], [10, 10], [3, 8], [7, 11], [10, 6]];
const MAX = 5;

function ansi(rows, dirt) {
  const px = rows.map(r => [...r]);
  SPOTS.slice(0, dirt * 2).forEach(([x, y], i) => { if (px[y]?.[x] && px[y][x] !== '.') px[y][x] = i % 2 ? 'N' : 'M'; });
  const out = [];
  for (let y = 0; y < 16; y += 2) {
    let line = '';
    for (let x = 0; x < 16; x++) {
      const t = color(px[y][x]), b = color(px[y + 1][x]);
      line += !t && !b ? ' ' : !b ? `<i style="color:${t}">▀</i>` : !t ? `<i style="color:${b}">▄</i>` : `<i style="color:${t};background:${b}">▀</i>`;
    }
    out.push(line);
  }
  return out.join('\n');
}
const meter = n => `${'▮'.repeat(n)}<span class="tama__off">${'▯'.repeat(MAX - n)}</span>`;

export class Tama {
  constructor(host) {
    this.host = host;
    this.food = 1; this.dirt = 4; this.busy = false; this.frame = 'hungry'; this.fx = '';
    this.el = document.createElement('div');
    this.el.className = 'tama';
    this.el.tabIndex = 0;
    this.el.setAttribute('aria-label', 'Cadu Tamagotchi: arraste, f alimenta, b dá banho');
    this.el.hidden = true;
    this.el.innerHTML = `<div class="tama__bar"><span class="tama__grip" aria-hidden="true">⠿</span><span>cadu · tamagotchi</span><span class="tama__tag">flutuante</span></div>
      <div class="tama__stage"><p class="tama__say" aria-live="polite"></p><pre class="tama__art" aria-hidden="true"></pre><pre class="tama__fx" aria-hidden="true"></pre></div>
      <dl class="tama__meters"><div><dt>fome</dt><dd data-m="food"></dd></div><div><dt>sujeira</dt><dd data-m="dirt"></dd></div></dl>
      <div class="tama__acts"><button type="button" data-act="feed"><b>f</b> alimentar</button><button type="button" data-act="bath"><b>b</b> dar banho</button></div>`;
    host.append(this.el);
    this.art = this.el.querySelector('.tama__art');
    this.fxEl = this.el.querySelector('.tama__fx');
    this.say = this.el.querySelector('.tama__say');
    this.el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) this[b.dataset.act](); });
    this.el.addEventListener('keydown', e => { if (e.key === 'f') this.feed(); if (e.key === 'b') this.bath(); });
    this.drag();
    // He gets hungry and dirty again over time, but only while someone is looking.
    this.visible = false;
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(host);
    setInterval(() => { if (this.visible && !this.el.hidden && !this.busy && this.food > 0) { this.food--; this.mood(); } }, 9000);
    setInterval(() => { if (this.visible && !this.el.hidden && !this.busy && this.dirt < MAX) { this.dirt++; this.mood(); } }, 14000);
    setInterval(() => { if (this.visible && !this.el.hidden && !this.busy) this.idle(); }, 700);
    this.mood();
  }
  // Floats in from the top right of the window, like a plugin opening its overlay.
  show() {
    if (!this.el.hidden) return;
    this.el.hidden = false;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.place(w - this.el.offsetWidth - 24, h - this.el.offsetHeight - 56);
    if (!REDUCED) this.el.animate([{ opacity: 0, transform: 'translateY(-14px) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  place(x, y) {
    const maxX = this.host.clientWidth - this.el.offsetWidth - 4, maxY = this.host.clientHeight - this.el.offsetHeight - 4;
    this.x = Math.max(4, Math.min(maxX, x)); this.y = Math.max(4, Math.min(maxY, y));
    this.el.style.transform = `translate(${this.x}px, ${this.y}px)`;
  }
  drag() {
    let start = null;
    this.el.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      start = { px: e.clientX, py: e.clientY, x: this.x, y: this.y };
      this.el.setPointerCapture(e.pointerId);
      this.el.classList.add('is-drag');
      this.talk('opa! para onde vamos?');
    });
    this.el.addEventListener('pointermove', e => { if (start) this.place(start.x + e.clientX - start.px, start.y + e.clientY - start.py); });
    const end = () => { if (start) { start = null; this.el.classList.remove('is-drag'); this.mood(); } };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }
  talk(text) { this.say.textContent = text; }
  mood() {
    if (this.busy) return;
    this.frame = this.food <= 2 ? 'hungry' : this.dirt >= 3 ? 'rest' : 'happy';
    this.talk(this.food === 0 ? 'fome… muita fome' : this.food <= 2 ? 'estou com fome' : this.dirt >= 3 ? 'que sujeira…' : 'tô feliz ✦');
    this.fx = this.dirt >= 3 ? 'stink' : '';
    this.draw();
  }
  idle() {
    // Breathes: the resting frames alternate with a float now and then.
    if (this.frame === 'hungry') { this.tick = (this.tick ?? 0) + 1; this.drawRows(this.tick % 6 === 0 ? FRAMES.blink : FRAMES.hungry); this.drawFx(); return; }
    this.tick = (this.tick ?? 0) + 1;
    this.drawRows(this.tick % 4 === 1 ? FRAMES.float : FRAMES[this.frame]);
    this.drawFx();
  }
  draw() {
    this.drawRows(FRAMES[this.frame]);
    this.drawFx();
    this.el.querySelector('[data-m="food"]').innerHTML = meter(this.food);
    this.el.querySelector('[data-m="dirt"]').innerHTML = meter(this.dirt);
    this.el.classList.toggle('is-hungry', this.food <= 2);
  }
  drawRows(rows) { this.art.innerHTML = ansi(rows, this.dirt); }
  drawFx() {
    const t = this.tick ?? 0;
    this.fxEl.className = `tama__fx fx-${this.fx}`;
    this.fxEl.textContent = this.fx === 'stink' ? (t % 2 ? ' ~   ≈    ~\n   ~    ≈ ' : '  ≈   ~   ≈\n ~    ~    ') : this.fx === 'crumbs' ? (t % 2 ? '     ·  °\n   °   ·' : '    °  ·\n  ·   °  ') : this.fx === 'bubbles' ? (t % 2 ? ' o   °  O\n   O    o ' : '  °  O   o\n o    °  ') : '';
  }
  // Plays sheet frames at the sheet's tick, with an effect, then settles.
  async act(frames, fx, ms = 130) {
    this.busy = true; this.fx = fx;
    for (const [i, f] of frames.entries()) { this.tick = i; this.drawRows(FRAMES[f]); this.drawFx(); await new Promise(r => setTimeout(r, REDUCED ? 0 : ms)); }
    this.busy = false;
  }
  async feed() {
    if (this.busy) return;
    if (this.food >= MAX) { this.talk('já comi, obrigado!'); return; }
    this.talk('nham nham!');
    await this.act(['happy', 'cheer_crouch', 'happy', 'cheer_crouch', 'happy', 'cheer_a', 'cheer_b', 'cheer_a', 'happy'], 'crumbs');
    this.food = Math.min(MAX, this.food + 2);
    this.mood();
  }
  async bath() {
    if (this.busy) return;
    if (this.dirt === 0) { this.talk('já estou limpinho'); return; }
    this.talk('splash!');
    await this.act(['blink', 'rest', 'blink', 'float', 'blink', 'rest', 'float', 'rest'], 'bubbles', 150);
    this.dirt = 0;
    this.mood();
  }
}
