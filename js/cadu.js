// Cadu, the Cadente mascot and app icon (ADR 0065 and 0066 of the app). The art is the app's own sprite sheet:
// 16×16 frames of role characters, drawn here as one SVG path per colour role.
import sheet from './cadu.sprites.json' with { type: 'json' };

// Colours of the brand ramp (tokens --brand-cadente-*). The trail takes the accent: purple on the site.
export const COLORS = { body: '#f6c343', light: '#fbe48d', shade: '#df8623', deep: '#a04f27', glow: '#fff9e2', ink: '#291508', blush: '#f68678', spark: '#fbe48d', dust: '#a855f7', alert: '#ff8272' };
const ORDER = ['body', 'light', 'shade', 'deep', 'glow', 'blush', 'ink', 'spark', 'dust', 'alert'];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// One path per role, with horizontal runs merged, so a frame is at most ten small paths.
export function frameSVG(name, cls = 'cadu') {
  const rows = sheet.frames[name] ?? sheet.frames.rest, paths = {};
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      let end = x;
      while (row[end + 1] === ch) end++;
      const role = sheet.palette[ch];
      paths[role] = (paths[role] ?? '') + `M${x} ${y}h${end - x + 1}v1h-${end - x + 1}z`;
      x = end + 1;
    }
  });
  return `<svg class="${cls}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${ORDER.filter(r => paths[r]).map(r => `<path fill="${COLORS[r]}" d="${paths[r]}"/>`).join('')}</svg>`;
}

const cache = {};
const svg = name => (cache[name] ??= frameSVG(name));

// Plays an animation of the sheet in an element: one frame swap per tick (100 ms), and only while it is on screen.
export class Cadu {
  constructor(el, { idle = 'idle' } = {}) {
    this.el = el; this.idle = idle; this.timer = 0; this.visible = false; this.queue = [];
    el.innerHTML = svg('rest');
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible && !this.timer) this.next(); }, { threshold: 0.1 }).observe(el);
  }
  // Plays `name` once (or its loop once), then goes back to the idle loop, or rests when there is none.
  play(name) { this.queue = [name]; this.restart(); return this; }
  restart() { clearTimeout(this.timer); this.timer = 0; if (this.visible) this.next(); }
  next() {
    if (REDUCED) { this.el.innerHTML = svg('rest'); this.timer = 0; return; }
    const name = this.queue.shift() ?? this.idle;
    if (!name) { this.el.innerHTML = svg('rest'); this.timer = 0; return; }
    const anim = sheet.animations[name];
    const ticks = anim.steps.flatMap(([f, n]) => Array(n).fill(f));
    let i = 0;
    const step = () => {
      if (!this.visible) { this.timer = 0; return; }
      if (i >= ticks.length) { this.next(); return; }
      this.el.innerHTML = svg(ticks[i++]);
      this.timer = setTimeout(step, sheet.tickMs);
    };
    step();
  }
}
