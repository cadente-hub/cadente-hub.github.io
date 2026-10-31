// Cadu Tamagotchi: the example plugin of Creator mode. It lives in the app's floating layer (shell.overlay), so Cadu
// is loose over the panes, with no window: he floats, wanders, gets hungry and dirty, and the visitor drags him,
// feeds him (f) and gives him a bath (b). He is drawn in ANSI half blocks (▀ ▄), two sprite pixels per character,
// from the app's sprite sheet in the site palette.
import sheet from './cadu.sprites.json' with { type: 'json' };
import { COLORS, MUD } from './cadu-colors.mjs';
import { t as tr } from './i18n.js';

const say = key => tr(`tama.${key}`);

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const color = ch => (ch === '.' ? null : MUD[ch] ?? COLORS[sheet.palette[ch]]);
// A frown for the hungry face, drawn over the resting frame.
const FRAMES = { ...sheet.frames, hungry: sheet.frames.rest.map((r, y) => (y === 10 ? '....SGGKKGGD....' : y === 11 ? '.....SKGGKD.....' : r)) };
// Where mud sticks, in order: more dirt, more spots. Every spot sits on Cadu's body.
const SPOTS = [[6, 5], [10, 9], [2, 7], [13, 8], [5, 9], [9, 5], [10, 10], [3, 8], [7, 11], [10, 6]];
const MAX = 5;
const sleep = ms => new Promise(r => setTimeout(r, REDUCED ? 0 : ms));

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

export class Tama {
  constructor(host) {
    this.host = host;
    this.food = 1; this.dirt = 4; this.busy = false; this.dragging = false; this.tick = 0;
    this.el = document.createElement('div');
    this.el.className = 'cadu-pet';
    this.el.hidden = true;
    this.el.tabIndex = 0;
    this.el.setAttribute('role', 'img');
    this.el.innerHTML = `<p class="cadu-pet__say" aria-live="polite"></p><pre class="cadu-pet__fx" aria-hidden="true"></pre><pre class="cadu-pet__art" aria-hidden="true"></pre>
      <div class="cadu-pet__acts"><button type="button" data-act="feed"><b>f</b> ${say('feedButton')}</button><button type="button" data-act="bath"><b>b</b> ${say('bathButton')}</button></div>`;
    host.append(this.el);
    this.art = this.el.querySelector('.cadu-pet__art');
    this.fx = this.el.querySelector('.cadu-pet__fx');
    this.bubble = this.el.querySelector('.cadu-pet__say');
    this.el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) this[b.dataset.act](); });
    this.el.addEventListener('keydown', e => { if (e.key === 'f') this.feed(); if (e.key === 'b') this.bath(); });
    this.drag();
    this.visible = false;
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(host);
    // He gets hungry and dirty again over time, and wanders when left alone, but only while someone is looking.
    const alive = () => this.visible && !this.el.hidden && !this.busy && !this.dragging;
    setInterval(() => { if (alive() && this.food > 0) { this.food--; this.mood(); } }, 10000);
    setInterval(() => { if (alive() && this.dirt < MAX) { this.dirt++; this.mood(); } }, 15000);
    setInterval(() => { if (alive()) this.breathe(); }, 600);
    setInterval(() => { if (alive() && !REDUCED) this.wander(); }, 5200);
    this.mood();
  }
  // Pops out of the plugin's pane, like an overlay opening.
  show() {
    if (!this.el.hidden) return;
    this.el.hidden = false;
    this.place(this.host.clientWidth - this.el.offsetWidth - 40, this.host.clientHeight - this.el.offsetHeight - 70, false);
    if (!REDUCED) this.el.animate([{ opacity: 0, translate: '0 24px', scale: '.6' }, { opacity: 1, translate: '0 -10px', scale: '1.05', offset: 0.7 }, { opacity: 1, translate: '0 0', scale: '1' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' });
    this.say(say('hello'));
  }
  hide() { this.el.hidden = true; }
  place(x, y, glide) {
    const maxX = this.host.clientWidth - this.el.offsetWidth - 4, maxY = this.host.clientHeight - this.el.offsetHeight - 4;
    this.x = Math.max(4, Math.min(maxX, x)); this.y = Math.max(28, Math.min(maxY, y));
    this.el.classList.toggle('is-gliding', !!glide);
    this.el.style.transform = `translate(${this.x}px, ${this.y}px)`;
  }
  // A short flight to somewhere near, with the shooting-star frames of the sheet.
  async wander() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const tx = this.x + (Math.random() - 0.5) * w * 0.5, ty = this.y + (Math.random() - 0.5) * h * 0.4;
    this.place(tx, ty, true);
    this.busy = true;
    for (let i = 0; i < 12; i++) { this.drawRows(FRAMES[['fly_0', 'fly_1', 'fly_2'][i % 3]]); await sleep(120); }
    this.busy = false;
    this.mood();
  }
  drag() {
    let start = null;
    this.el.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      start = { px: e.clientX, py: e.clientY, x: this.x, y: this.y };
      this.dragging = true;
      this.el.setPointerCapture(e.pointerId);
      this.el.classList.add('is-drag');
      this.drawRows(FRAMES.happy);
      this.say(say('drag'));
    });
    this.el.addEventListener('pointermove', e => { if (start) this.place(start.x + e.clientX - start.px, start.y + e.clientY - start.py, false); });
    const end = () => {
      if (!start) return;
      start = null; this.dragging = false;
      this.el.classList.remove('is-drag');
      if (!REDUCED) this.art.animate([{ transform: 'scale(1.12, .86)' }, { transform: 'scale(.95, 1.06)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' });
      this.mood();
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }
  say(text) {
    this.bubble.textContent = text;
    this.el.classList.toggle('has-say', !!text);
  }
  state() { return this.food <= 2 ? 'hungry' : this.dirt >= 3 ? 'dirty' : 'happy'; }
  mood() {
    if (this.busy) return;
    const s = this.state();
    this.say(this.food === 0 ? say('starving') : s === 'hungry' ? say('hungry') : s === 'dirty' ? say('dirty') : '');
    this.el.classList.toggle('is-hungry', s === 'hungry');
    this.el.setAttribute('aria-label', tr('tama.aria', { mood: say(`mood.${s}`) }));
    this.breathe();
  }
  breathe() {
    this.tick++;
    const s = this.state(), base = s === 'hungry' ? 'hungry' : s === 'happy' ? 'happy' : 'rest';
    this.drawRows(FRAMES[this.tick % 7 === 0 ? 'blink' : this.tick % 2 ? 'float' : base]);
    this.drawFx(this.dirt >= 3 ? 'stink' : s === 'happy' && this.tick % 3 === 0 ? 'spark' : '');
  }
  drawRows(rows) { this.art.innerHTML = ansi(rows, this.dirt); }
  drawFx(kind) {
    const t = this.tick % 2;
    this.fx.className = `cadu-pet__fx fx-${kind}`;
    this.fx.textContent = { stink: t ? ' ~   ≈    ~\n   ≈   ~  ' : '  ≈   ~   ≈\n ~    ≈    ', crumbs: t ? '     ·  °\n   °   ·' : '    °  ·\n  ·   °  ', bubbles: t ? ' o   °  O\n   O    o ' : '  °  O   o\n o    °  ', spark: t ? '  ✦      ·' : '·      ✦  ' }[kind] ?? '';
  }
  // Plays sheet frames at the sheet's tick, with an effect, then settles.
  async act(frames, fx, ms) {
    this.busy = true;
    for (const [i, f] of frames.entries()) { this.tick = i; this.drawRows(FRAMES[f]); this.drawFx(fx); await sleep(ms); }
    this.busy = false;
  }
  async feed() {
    if (this.busy) return;
    if (this.food >= MAX) { this.say(say('full')); return; }
    this.say(say('eating'));
    await this.act(['happy', 'cheer_crouch', 'happy', 'cheer_crouch', 'happy', 'cheer_a', 'cheer_b', 'cheer_a', 'happy'], 'crumbs', 130);
    this.food = Math.min(MAX, this.food + 2);
    this.mood();
    if (this.food >= MAX && this.dirt < 3) this.say(say('thanks'));
  }
  async bath() {
    if (this.busy) return;
    if (this.dirt === 0) { this.say(say('clean')); return; }
    this.say(say('splash'));
    await this.act(['blink', 'rest', 'blink', 'float', 'blink', 'rest', 'float', 'rest'], 'bubbles', 150);
    this.dirt = 0;
    this.mood();
    if (this.state() === 'happy') this.say(say('fresh'));
  }
}
