// Quadro, a community plugin from the store, used in the site's demo: a whiteboard with hand-drawn shapes,
// driven by one key per tool. r draws a rectangle, o an ellipse, d a diamond; the label is typed right into the
// shape and ↵ keeps it. a joins the selected shape to the one before it with an arrow, ← → change the selection,
// ↵ edits the label and ⌫ erases. New shapes are laid out in rows, so a diagram needs no mouse.
import { fromManifest, registerFn } from '../v4/engine.mjs';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const W = 760, H = 400, SW = 190, SH = 96, MAX = 6;
const slot = i => ({ x: 40 + (i % 3) * 250, y: i < 3 ? 110 : 250, w: SW, h: SH });
const n = v => Math.round(v * 10) / 10;
// A seeded wobble, so each shape keeps its hand-drawn look between redraws.
function rng(seed) { let s = (seed * 7919) % 2147483647 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5); }
const seg = (r, [ax, ay], [bx, by], k = 2.4) => `M${n(ax + r() * k)} ${n(ay + r() * k)} Q${n((ax + bx) / 2 + r() * k * 1.6)} ${n((ay + by) / 2 + r() * k * 1.6)} ${n(bx + r() * k)} ${n(by + r() * k)}`;
function corners(kind, { x, y, w, h }) {
  if (kind === 'diamond') return [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]];
  if (kind === 'ellipse') return Array.from({ length: 16 }, (_, i) => [x + w / 2 + (w / 2) * Math.cos((i * Math.PI) / 8), y + h / 2 + (h / 2) * Math.sin((i * Math.PI) / 8)]);
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}
// Two loose passes over the outline, so each stroke looks drawn by hand.
function strokes(kind, box, seed) {
  const pts = corners(kind, box);
  return [0, 1].map(p => { const r = rng(seed + p * 101); return pts.map((a, i) => seg(r, a, pts[(i + 1) % pts.length], kind === 'ellipse' ? 1.8 : 3.6)).join(' '); });
}
const fillPath = (kind, box) => `M${corners(kind, box).map(([a, b]) => `${n(a)} ${n(b)}`).join(' L')} Z`;
function arrow(a, b, seed) {
  const r = rng(seed), same = a.y === b.y;
  const from = same ? [a.x + a.w + 6, a.y + a.h / 2] : [a.x + a.w / 2, a.y + a.h + 6], to = same ? [b.x - 8, b.y + b.h / 2] : [b.x + b.w / 2, b.y - 8];
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]), head = s => [to[0] - 16 * Math.cos(ang + s), to[1] - 16 * Math.sin(ang + s)];
  return `${seg(r, from, to, 2)} ${seg(r, to, head(0.45), 1)} ${seg(r, to, head(-0.45), 1)}`;
}
const TOOLS = [['▭', 'r', 'rect'], ['◇', 'd', 'diamond'], ['○', 'o', 'ellipse'], ['→', 'a', 'arrow'], ['╱', 'l', 'line'], ['✎', 'p', 'pen'], ['A', 't', 'text'], ['⌫', 'e', 'eraser']];
const KIND = { r: 'rect', o: 'ellipse', d: 'diamond' };
const editLabel = i => ({ data: { editing: { path: 'data.draft', label: 'texto', then: { op: 'fn', name: 'drawLabel', i } }, edAt: i } });

export const draw = fromManifest({
  id: 'draw', title: 'Quadro', short: 'DRAW', glyph: '✎', community: true, author: 'bitcraft', cursorless: true,
  keywords: 'quadro desenho diagrama whiteboard rabisco',
  hint: 'r retângulo · o elipse · d losango · a seta · ↵ texto',
  init: () => ({ shapes: [], arrows: [], sel: -1, tool: 'select', fresh: null, seq: 1 }),
  view(leaf, S) {
    const d = leaf.data, inp = leaf.input;
    const boxes = d.shapes.map((s, i) => slot(i));
    const shapes = d.shapes.map((s, i) => {
      const box = boxes[i], editing = d.editing && d.edAt === i, label = editing ? inp.text : s.label;
      const [a, b] = strokes(s.kind, box, s.seed);
      return `<g class="xs${s.id === d.fresh ? ' xd-new' : ''}"><path class="xf" d="${fillPath(s.kind, box)}"/><path class="st" pathLength="1" d="${a}"/><path class="st st2" pathLength="1" d="${b}"/>`
        + `<text x="${box.x + box.w / 2}" y="${box.y + box.h / 2 + 6}">${esc(label)}${editing ? '<tspan class="xc">|</tspan>' : ''}</text></g>`;
    }).join('');
    const arrows = d.arrows.map((x, k) => {
      const ai = d.shapes.findIndex(s => s.id === x.from), bi = d.shapes.findIndex(s => s.id === x.to);
      return ai < 0 || bi < 0 ? '' : `<path class="ar${k === d.freshArrow ? ' xd-new' : ''}" pathLength="1" d="${arrow(boxes[ai], boxes[bi], k + 7)}"/>`;
    }).join('');
    const sb = boxes[d.sel], sel = sb ? `<rect class="xsel" x="${sb.x - 9}" y="${sb.y - 9}" width="${sb.w + 18}" height="${sb.h + 18}"/>${[[sb.x - 9, sb.y - 9], [sb.x + sb.w + 9, sb.y - 9], [sb.x - 9, sb.y + sb.h + 9], [sb.x + sb.w + 9, sb.y + sb.h + 9]].map(([x, y]) => `<rect class="xh" x="${x - 4}" y="${y - 4}" width="8" height="8"/>`).join('')}` : '';
    const empty = d.shapes.length ? '' : `<text class="xhint" x="${W / 2}" y="${H / 2}">r faz um retângulo · o uma elipse · d um losango</text>`;
    const tools = TOOLS.map(([g, k, t]) => `<span class="${t === d.tool ? 'on' : ''}">${g}<i>${k}</i></span>`).join('');
    const html = `<div class="xdv"><div class="xd-top"><span class="xd-menu">☰</span><div class="xd-tools">${tools}</div><span class="xd-share">Compartilhar</span></div>`
      + `<svg class="xd-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><defs><pattern id="xd-h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)"><line x1="0" y1="0" x2="0" y2="7"/></pattern></defs>`
      + `<g class="xa">${arrows}</g><g class="xg">${shapes}</g><g>${sel}</g>${empty}</svg>`
      + `<div class="xd-foot"><span>− 100% +</span><span>↶ ↷</span><span class="xd-keys">${d.editing ? '↵ guarda o texto · esc cancela' : 'r retângulo · o elipse · d losango · a seta · ← → seleção · ↵ texto'}</span></div></div>`;
    return { subject: d.shapes.length ? `${d.shapes.length} ${d.shapes.length === 1 ? 'forma' : 'formas'}` : 'quadro novo', lines: [{ t: 'tui', html }] };
  },
  keys: leaf => (leaf.data.editing ? [] : ['r', 'o', 'd', 'a', 'ArrowLeft', 'ArrowRight', 'Enter', 'Backspace']),
  key(leaf, key, item, S) {
    const d = leaf.data;
    if (KIND[key]) {
      if (d.shapes.length >= MAX) return { toast: 'o quadro do exemplo cabe seis formas' };
      const id = `x${d.seq}`;
      d.shapes = [...d.shapes, { id, kind: KIND[key], label: '', seed: d.seq * 13 }];
      const i = d.shapes.length - 1, fx = editLabel(i);
      Object.assign(fx.data, { sel: i, tool: KIND[key], fresh: id, freshArrow: null, seq: d.seq + 1 });
      return { ...fx, input: '' };
    }
    if (key === 'a') {
      if (d.sel < 1) return { toast: 'selecione a segunda forma para ligar com uma seta' };
      const from = d.shapes[d.sel - 1].id, to = d.shapes[d.sel].id;
      if (d.arrows.some(x => x.from === from && x.to === to)) return null;
      d.arrows = [...d.arrows, { from, to }];
      return { data: { tool: 'arrow', fresh: null, freshArrow: d.arrows.length - 1 } };
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') return d.shapes.length ? { data: { sel: Math.max(0, Math.min(d.shapes.length - 1, d.sel + (key === 'ArrowLeft' ? -1 : 1))), tool: 'select' } } : null;
    if (key === 'Enter' && d.shapes[d.sel]) return { ...editLabel(d.sel), input: d.shapes[d.sel].label };
    if (key === 'Backspace' && d.shapes[d.sel]) {
      const gone = d.shapes[d.sel].id;
      d.shapes = d.shapes.filter(s => s.id !== gone);
      d.arrows = d.arrows.filter(x => x.from !== gone && x.to !== gone);
      return { data: { sel: Math.min(d.sel, d.shapes.length - 1), tool: 'eraser', fresh: null, freshArrow: null } };
    }
    return null;
  },
  signal: leaf => (leaf.data.editing ? 'escrevendo' : 'salvo'),
});

registerFn({
  drawLabel(S, leaf, ctx, op) {
    const s = leaf.data.shapes[op.i];
    if (s) s.label = leaf.data.draft ?? '';
    leaf.data.draft = null;
    leaf.data.tool = 'select';
    return {};
  },
});
