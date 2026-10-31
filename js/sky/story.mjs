// The hero sky as data: a quiet starfield, and one shooting star for each struck word of the title. Each one flies
// from the word to its place in a constellation on either side of the title; when the title settles on "hub", faint
// lines join the constellations to it. Pure and deterministic (seeded), so it is tested in Node; js/sky/renderer.mjs
// draws what `frame` returns and js/sky/static.mjs draws the settled state.

// Mulberry32: a small seeded random generator.
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = p => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
export const FLIGHT = 1150, LINE = 700, SETTLE = 1600, FADE_IN = 1200;

// Background stars, in 0..1 coordinates.
export function starfield(seed = 7, count = 140) {
  const r = rng(seed);
  return Array.from({ length: count }, () => ({ x: r(), y: r(), size: 0.6 + r() ** 3 * 1.8, alpha: 0.18 + r() * 0.5, phase: r() * Math.PI * 2 }));
}

// Where each word's star ends, in 0..1 coordinates: two constellations flanking the centered title on wide screens,
// a band above the title on narrow ones. Alternates sides so the sky fills evenly as the words fall.
export function slots(n, { seed = 11, narrow = false } = {}) {
  const r = rng(seed);
  if (narrow) return Array.from({ length: n }, (_, i) => ({ x: clamp(0.08 + (i + 0.5) * (0.84 / n) + (r() - 0.5) * 0.04, 0.05, 0.95), y: clamp((i % 2 ? 0.1 : 0.16) + (r() - 0.5) * 0.03, 0.05, 0.95), side: 0 }));
  const left = Math.ceil(n / 2), right = n - left;
  return Array.from({ length: n }, (_, i) => {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), count = side < 0 ? left : right;
    const y = 0.2 + (count > 1 ? k / (count - 1) : 0.5) * 0.56 + (r() - 0.5) * 0.05;
    const x = 0.5 + side * (0.36 + (k % 2 ? 0.06 : 0) + r() * 0.03);
    return { x: clamp(x, 0.05, 0.95), y: clamp(y, 0.05, 0.95), side };
  });
}

// A point along the flight from `a` to `b`, arcing upward; p is 0..1.
export function flight(a, b, p) {
  const e = ease(clamp(p, 0, 1)), cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - 0.18 - Math.abs(b.x - a.x) * 0.12;
  const u = 1 - e;
  return { x: u * u * a.x + 2 * u * e * cx + e * e * b.x, y: u * u * a.y + 2 * u * e * cy + e * e * b.y };
}

// The sky at time `t` (ms). `drops` are { at, from } (from: the word's centre in 0..1), in the order the words fell;
// `hub` is { at, x, y } once the title settled. Returns glows, segments, label alphas and whether it still moves.
// `pour` (0..1) is how far the hero has scrolled away: the landed stars stream down toward the window below it, and
// their lines and names fade on the way.
const SINK = { x: 0.5, y: 1.06 };
export function frame({ field, targets, drops, hub, pour = 0 }, t) {
  const glows = [], segments = [], labels = [];
  const at = i => ease(clamp(pour * 1.5 - i * 0.06, 0, 1));
  const place = (q, i) => (pour > 0 ? lerp(q, SINK, at(i)) : q);
  const keep = clamp(1 - pour * 1.8, 0, 1);
  const start = drops[0]?.at ?? t;
  const fade = clamp((t - start) / FADE_IN, 0, 1);
  for (const s of field) {
    const tw = moving(drops, hub, t) ? 0.75 + 0.25 * Math.sin(t / 900 + s.phase) : 1;
    glows.push({ x: s.x, y: s.y, size: s.size, alpha: s.alpha * fade * tw, hue: 0 });
  }
  const landed = [];
  drops.forEach((d, i) => {
    const to = targets[i], p = (t - d.at) / FLIGHT;
    if (!to || p < 0) { labels.push(0); return; }
    if (p < 1) {
      const head = flight(d.from, to, p);
      for (let k = 1; k <= 14; k++) {
        const q = flight(d.from, to, p - k * 0.022), q0 = flight(d.from, to, p - (k - 1) * 0.022);
        if (p - k * 0.022 < 0) break;
        segments.push({ a: q0, b: q, width: 2.4 * (1 - k / 15), alpha: 0.85 * (1 - k / 15), hue: 1 });
      }
      glows.push({ x: head.x, y: head.y, size: 7, alpha: 1, hue: 1 });
      labels.push(0);
    } else {
      const since = t - d.at - FLIGHT, flash = Math.max(0, 1 - since / 500);
      const here = place(to, i), k = at(i);
      glows.push({ x: here.x, y: here.y, size: 3.2 + flash * 9 + k * 2, alpha: 0.95 * (1 - k * k * 0.6), hue: 1 });
      if (k > 0.02 && k < 0.98) for (let j = 1; j <= 6; j++) { const back = lerp(to, SINK, Math.max(0, k - j * 0.035)); segments.push({ a: j === 1 ? here : lerp(to, SINK, Math.max(0, k - (j - 1) * 0.035)), b: back, width: 1.6 * (1 - j / 7), alpha: 0.6 * (1 - j / 7), hue: 1 }); }
      labels.push(clamp(since / 400, 0, 1) * keep);
      landed.push({ i, to: here, home: to, at: d.at + FLIGHT });
    }
  });
  // Each landed star links to the previous one on its side.
  for (const side of [-1, 0, 1]) {
    const chain = landed.filter(l => l.to.side === side).sort((a, b) => a.i - b.i);
    for (let k = 1; k < chain.length; k++) {
      const p = clamp((t - chain[k].at) / LINE, 0, 1);
      if (p > 0 && keep > 0) segments.push({ a: chain[k - 1].to, b: lerp(chain[k - 1].to, chain[k].to, p), width: 1, alpha: 0.32 * keep, hue: 2 });
    }
  }
  if (hub) {
    const p = clamp((t - hub.at) / SETTLE, 0, 1);
    if (keep > 0) for (const l of landed) segments.push({ a: l.to, b: lerp(l.to, hub, ease(p)), width: 0.8, alpha: 0.14 * p * keep, hue: 2 });
    const pulse = Math.max(0, 1 - (t - hub.at) / 1200);
    if (pulse > 0) glows.push({ x: hub.x, y: hub.y, size: 60 * (1 - pulse) + 20, alpha: pulse * 0.6, hue: 1 });
  }
  return { glows, segments, labels, moving: moving(drops, hub, t) };
}
const lerp = (a, b, p) => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p });
// Still moving until every star landed, its line drew, and the hub lines settled.
function moving(drops, hub, t) {
  if (!hub) return true;
  const last = Math.max(hub.at + SETTLE, ...drops.map(d => d.at + FLIGHT + LINE + 500));
  return t < last;
}

// The settled sky, for the SVG fallback and for tests: every star in place, every line drawn.
export function settled({ field, targets, hub }) {
  const drops = targets.map((_, i) => ({ at: 0, from: targets[i] }));
  return frame({ field, targets, drops, hub: { ...hub, at: 0 } }, 1e9);
}
