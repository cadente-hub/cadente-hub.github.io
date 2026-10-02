/**
 * Cadente — Night sky
 * Stars wheel slowly around a celestial pole above the top-right corner,
 * like a long-exposure star trail, with gentle scintillation, a faint
 * Milky Way band and the occasional meteor falling from one radiant.
 * Clicking empty sky releases a meteor. Static when motion is reduced.
 *
 * Exposes window.cadenteSky = { meteor } for page moments.
 */

const canvas = document.getElementById('sky');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

window.cadenteSky = { meteor: () => {} };

if (canvas) initSky();

function initSky() {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const SPIN = 0.0035; // radians per second — about 30 minutes per turn
  const RADIANT = Math.PI * 0.74; // meteors travel down-left

  let W = 0, H = 0, pole = { x: 0, y: 0 };
  let stars = [];
  let glow = [];
  const meteors = [];
  let angle = 0;
  let scrollY = window.scrollY;
  let px = 0, py = 0, tpx = 0, tpy = 0; // tiny pointer parallax
  let nextMeteor = 4;
  let running = !document.hidden;
  let last = performance.now();

  const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';

  const DARK = {
    tints: [[247, 243, 234], [207, 221, 255], [255, 222, 186]],
    alpha: 1,
    glow: [170, 190, 255],
    glowAlpha: 0.022,
    meteorHead: [255, 248, 236],
    meteorTail: [240, 180, 126],
  };
  const LIGHT = {
    tints: [[42, 51, 80], [60, 80, 130], [150, 90, 45]],
    alpha: 0.45,
    glow: [120, 130, 170],
    glowAlpha: 0,
    meteorHead: [184, 105, 47],
    meteorTail: [184, 105, 47],
  };

  // Soft round sprites, one per tint
  const sprites = new Map();
  function sprite(rgb) {
    const key = rgb.join(',');
    let s = sprites.get(key);
    if (s) return s;
    s = document.createElement('canvas');
    const R = 32;
    s.width = s.height = R * 2;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(R, R, 0, R, R, R);
    grad.addColorStop(0, `rgba(${key},1)`);
    grad.addColorStop(0.1, `rgba(${key},0.85)`);
    grad.addColorStop(0.28, `rgba(${key},0.18)`);
    grad.addColorStop(1, `rgba(${key},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, R * 2, R * 2);
    sprites.set(key, s);
    return s;
  }

  // Gaussian-ish random
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  function seed() {
    pole = { x: W * 0.86, y: -H * 0.42 };
    const corners = [[0, 0], [W, 0], [0, H + 600], [W, H + 600]];
    const rMax = Math.max(...corners.map(([x, y]) => Math.hypot(x - pole.x, y - pole.y))) + 40;
    const rMin = Math.max(0, -pole.y - 40);
    const ring = Math.PI * (rMax * rMax - rMin * rMin);
    const density = W < 700 ? 1 / 3600 : 1 / 2900; // stars per px²
    const count = Math.min(Math.round(ring * density), 4200);

    stars = [];
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(rMin * rMin + Math.random() * (rMax * rMax - rMin * rMin));
      const a = Math.random() * Math.PI * 2;
      // magnitude: many faint stars, very few bright ones
      const m = Math.pow(Math.random(), 3.2);
      stars.push(makeStar(Math.cos(a) * r, Math.sin(a) * r, m));
    }

    // Milky Way: a band crossing the initial view from lower-left to upper-right
    glow = [];
    const ax = -W * 0.1, ay = H * 1.05, bx = W * 0.95, by = -H * 0.2;
    const len = Math.hypot(bx - ax, by - ay);
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    const bandStars = Math.round(len * (W < 700 ? 0.35 : 0.6));
    for (let i = 0; i < bandStars; i++) {
      const t = Math.random();
      const off = gauss() * H * 0.14;
      const x = ax + (bx - ax) * t + nx * off - pole.x;
      const y = ay + (by - ay) * t + ny * off - pole.y;
      stars.push(makeStar(x, y, Math.pow(Math.random(), 5) * 0.5));
    }
    for (let i = 0; i < 70; i++) {
      const t = i / 69;
      const off = gauss() * H * 0.05;
      glow.push({
        dx: ax + (bx - ax) * t + nx * off - pole.x,
        dy: ay + (by - ay) * t + ny * off - pole.y,
        size: H * (0.28 + Math.random() * 0.22),
      });
    }
  }

  function makeStar(dx, dy, m) {
    const tintRoll = Math.random();
    return {
      dx, dy,
      r: 0.35 + m * 1.9,
      a: 0.25 + m * 0.75,
      tint: tintRoll < 0.72 ? 0 : tintRoll < 0.9 ? 1 : 2,
      z: 0.3 + Math.random() * 0.7,
      tw: 0.4 + Math.random() * 1.6,
      ph: Math.random() * Math.PI * 2,
      spike: m > 0.82,
    };
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
  }

  function meteor(x, y) {
    const speed = 1100 + Math.random() * 600;
    const ang = RADIANT + (Math.random() - 0.5) * 0.12;
    meteors.push({
      x: x ?? W * (0.3 + Math.random() * 0.75),
      y: y ?? -10 + Math.random() * H * 0.3,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: 0,
      max: 0.45 + Math.random() * 0.4,
      len: 110 + Math.random() * 130,
      w: 0.9 + Math.random() * 0.8,
    });
  }

  window.cadenteSky = { meteor };

  function draw(time, dt) {
    const pal = isLight() ? LIGHT : DARK;
    const c = Math.cos(angle), s = Math.sin(angle);
    const shiftY = -scrollY * 0.04;
    ctx.clearRect(0, 0, W, H);

    // Milky Way glow
    if (pal.glowAlpha > 0) {
      const g = sprite(pal.glow);
      ctx.globalAlpha = pal.glowAlpha;
      for (const b of glow) {
        const x = pole.x + b.dx * c - b.dy * s + px * 0.4;
        const y = pole.y + b.dx * s + b.dy * c + shiftY * 0.6 + py * 0.4;
        if (x < -b.size || x > W + b.size || y < -b.size || y > H + b.size) continue;
        ctx.drawImage(g, x - b.size / 2, y - b.size / 2, b.size, b.size);
      }
    }

    // Stars
    for (const st of stars) {
      const x = pole.x + st.dx * c - st.dy * s + px * st.z;
      const y = pole.y + st.dx * s + st.dy * c + shiftY * st.z + py * st.z;
      if (x < -6 || x > W + 6 || y < -6 || y > H + 6) continue;
      const twinkle = 0.78 + 0.22 * Math.sin(time * st.tw + st.ph);
      const alpha = st.a * twinkle * pal.alpha;
      const size = st.r * 5.5;
      const tint = pal.tints[st.tint];
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite(tint), x - size / 2, y - size / 2, size, size);
      if (st.spike && pal === DARK) {
        const l = st.r * 5 * twinkle;
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = `rgb(${tint})`;
        ctx.fillRect(x - l, y - 0.25, l * 2, 0.5);
        ctx.fillRect(x - 0.25, y - l, 0.5, l * 2);
      }
    }
    ctx.globalAlpha = 1;

    // Meteors
    const [hr, hg, hb] = pal.meteorHead;
    const [tr, tg, tb] = pal.meteorTail;
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.life += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const p = m.life / m.max;
      if (p >= 1) { meteors.splice(i, 1); continue; }
      // bright in the middle of its life, like burning up
      const f = Math.sin(Math.PI * p);
      const sp = Math.hypot(m.vx, m.vy);
      const tx = m.x - (m.vx / sp) * m.len * (0.4 + 0.6 * f);
      const ty = m.y - (m.vy / sp) * m.len * (0.4 + 0.6 * f);
      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, `rgba(${hr},${hg},${hb},${0.95 * f})`);
      grad.addColorStop(0.2, `rgba(${tr},${tg},${tb},${0.5 * f})`);
      grad.addColorStop(1, `rgba(${tr},${tg},${tb},0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = m.w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      const hs = 10 * m.w;
      ctx.globalAlpha = f;
      ctx.drawImage(sprite(pal.meteorHead), m.x - hs / 2, m.y - hs / 2, hs, hs);
      ctx.globalAlpha = 1;
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    angle += SPIN * dt;
    px += (tpx - px) * 0.04;
    py += (tpy - py) * 0.04;

    nextMeteor -= dt;
    if (nextMeteor <= 0) {
      meteor();
      nextMeteor = 6 + Math.random() * 9;
    }

    draw(now / 1000, dt);
    requestAnimationFrame(frame);
  }

  resize();

  if (reduceMotion) {
    const still = () => draw(0, 0);
    still();
    window.addEventListener('resize', () => { resize(); still(); });
    new MutationObserver(still).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return;
  }

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      tpx = (e.clientX / W - 0.5) * -10;
      tpy = (e.clientY / H - 0.5) * -6;
    }, { passive: true });
  }

  // A quiet easter egg: clicking empty sky releases a meteor from that point
  window.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, select, textarea, label, summary, [role="button"], .card, .tile, .demo, .ledger')) return;
    meteor(e.clientX + 40, e.clientY - 30);
  });

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });

  requestAnimationFrame((t) => { last = t; frame(t); });
}
