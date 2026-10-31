// The settled sky as one SVG, drawn at the host's size and again only when that size changes: for reduced motion,
// no WebGL2, data saver and small devices.
import { starfield, slots, settled } from './story.mjs';

const COLORS = ['#d6deff', '#f2dcff', '#b380ff'];

export function staticSky(host, { words, labels: labelHost, narrow = false, hub = { x: 0.5, y: 0.36 } }) {
  const model = { field: starfield(7, narrow ? 70 : 140), targets: slots(words.length, { narrow }), hub };
  const f = settled(model);
  const draw = () => {
    const W = Math.round(host.clientWidth) || 1000, H = Math.round(host.clientHeight) || 700, X = x => (x * W).toFixed(1), Y = y => (y * H).toFixed(1);
    const lines = f.segments.map(s => `<line x1="${X(s.a.x)}" y1="${Y(s.a.y)}" x2="${X(s.b.x)}" y2="${Y(s.b.y)}" stroke="${COLORS[s.hue]}" stroke-opacity="${s.alpha.toFixed(2)}" stroke-width="${Math.max(0.6, s.width).toFixed(2)}"/>`).join('');
    const dots = f.glows.map(g => `<circle cx="${X(g.x)}" cy="${Y(g.y)}" r="${(g.size * 0.8).toFixed(2)}" fill="${COLORS[g.hue]}" fill-opacity="${Math.min(1, g.alpha).toFixed(2)}"${g.hue ? ' filter="url(#sky-glow)"' : ''}/>`).join('');
    host.querySelector('.sky__svg')?.remove();
    host.insertAdjacentHTML('afterbegin', `<svg class="sky__svg" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><filter id="sky-glow" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="3"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${lines}${dots}</svg>`);
  };
  draw();
  let last = host.clientWidth;
  new ResizeObserver(() => { if (host.clientWidth !== last) { last = host.clientWidth; draw(); } }).observe(host);
  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.className = 'sky__label';
    s.textContent = w;
    Object.assign(s.style, { left: `${model.targets[i].x * 100}%`, top: `${model.targets[i].y * 100}%`, opacity: '1' });
    labelHost?.append(s);
  });
  return model;
}
