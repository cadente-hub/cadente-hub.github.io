/**
 * Cadente — Living Sky
 * A full-page night sky: layered twinkling stars with depth parallax,
 * scroll-velocity warp, cursor constellations, shooting stars,
 * a sparkle trail behind the pointer and click-to-wish meteors.
 *
 * Exposes window.cadenteSky = { meteor, burst, shower } for page effects.
 */

const canvas = document.getElementById('sky');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

const noop = () => {};
window.cadenteSky = { meteor: noop, burst: noop, shower: noop };

if (canvas) initSky();
initScrollComet();

function initScrollComet() {
  const comet = document.querySelector('.scroll-comet');
  if (!comet) return;
  let ticking = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    comet.style.setProperty('--p', p.toFixed(4));
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

function initSky() {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let stars = [];
  const meteors = [];
  const sparks = [];
  const wishes = [];

  // Pointer + scroll state (eased)
  const mouse = { x: -9999, y: -9999, tx: 0, ty: 0, px: 0, py: 0, active: false };
  let scrollY = window.scrollY;
  let lastScrollY = scrollY;
  let warp = 0;
  let time = 0;
  let nextMeteor = 1.5;
  let running = true;

  // ---------- Palette (re-read per frame so the theme toggle is live) ----------
  const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';
  const DARK = {
    tints: [[255, 246, 232], [255, 214, 170], [200, 220, 255], [255, 255, 255]],
    alpha: 1,
    line: [226, 179, 131],
    meteor: [255, 236, 210],
    nebula: [[219, 166, 118, 0.07], [120, 110, 200, 0.05], [200, 120, 90, 0.04]],
  };
  const LIGHT = {
    tints: [[120, 78, 44], [168, 104, 58], [90, 80, 120], [70, 55, 40]],
    alpha: 0.55,
    line: [168, 104, 58],
    meteor: [168, 104, 58],
    nebula: [[219, 166, 118, 0.1], [180, 160, 220, 0.07], [230, 170, 130, 0.06]],
  };

  // Pre-rendered glow sprites (one per tint, per theme)
  const spriteCache = new Map();
  function sprite(rgb) {
    const key = rgb.join(',');
    if (spriteCache.has(key)) return spriteCache.get(key);
    const s = document.createElement('canvas');
    const R = 32;
    s.width = s.height = R * 2;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(R, R, 0, R, R, R);
    grad.addColorStop(0, `rgba(${key},1)`);
    grad.addColorStop(0.12, `rgba(${key},0.9)`);
    grad.addColorStop(0.3, `rgba(${key},0.25)`);
    grad.addColorStop(1, `rgba(${key},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, R * 2, R * 2);
    spriteCache.set(key, s);
    return s;
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

  function seed() {
    const count = Math.min(Math.round((W * H) / 2600), 520);
    stars = [];
    for (let i = 0; i < count; i++) {
      const z = Math.pow(Math.random(), 1.8) * 0.9 + 0.1; // most stars far away
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z,
        r: 0.35 + z * 1.6 + (Math.random() < 0.03 ? 1.2 : 0),
        tint: Math.random() < 0.6 ? 0 : Math.random() < 0.5 ? 1 : Math.random() < 0.6 ? 2 : 3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 2.4,
        base: 0.35 + Math.random() * 0.65,
        glint: Math.random() < 0.035,
        drift: (Math.random() - 0.5) * 0.15,
      });
    }
  }

  // ---------- Effects API ----------
  function meteor(x, y, opts = {}) {
    const angle = opts.angle ?? (Math.PI * (0.72 + Math.random() * 0.12)); // down-left
    const speed = opts.speed ?? (900 + Math.random() * 700);
    meteors.push({
      x: x ?? (W * (0.35 + Math.random() * 0.75)),
      y: y ?? (-20 + Math.random() * H * 0.35),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      max: opts.life ?? (0.9 + Math.random() * 0.7),
      len: opts.len ?? (140 + Math.random() * 180),
      width: opts.width ?? (1.4 + Math.random() * 1.4),
      trail: [],
    });
  }

  function burst(x, y, n = 28, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (60 + Math.random() * 260) * power;
      sparks.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 40,
        life: 0,
        max: 0.6 + Math.random() * 0.9,
        r: 0.8 + Math.random() * 2,
        tint: Math.random() < 0.5 ? 1 : 0,
        g: 140,
      });
    }
  }

  function shower(n = 10, spread = 1800) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => meteor(), Math.random() * spread);
    }
  }

  window.cadenteSky = { meteor, burst, shower };

  // ---------- Input ----------
  if (finePointer && !reduceMotion) {
    let lastSpark = 0;
    window.addEventListener('pointermove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
      const now = performance.now();
      const dist = Math.hypot(e.clientX - mouse.px, e.clientY - mouse.py);
      if (now - lastSpark > 16 && dist > 4) {
        lastSpark = now;
        const n = Math.min(3, 1 + Math.floor(dist / 30));
        for (let i = 0; i < n; i++) {
          sparks.push({
            x: e.clientX + (Math.random() - 0.5) * 6,
            y: e.clientY + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 40 - (e.clientX - mouse.px) * 0.6,
            vy: (Math.random() - 0.5) * 40 - (e.clientY - mouse.py) * 0.6,
            life: 0,
            max: 0.5 + Math.random() * 0.6,
            r: 0.6 + Math.random() * 1.6,
            tint: Math.random() < 0.7 ? 1 : 0,
            g: 60,
          });
        }
      }
      mouse.px = e.clientX;
      mouse.py = e.clientY;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.active = false; });
  }

  const WISH_WORDS = ['wish granted', 'make it so', 'shipped', 'merged', '✦', 'it lands'];
  if (!reduceMotion) {
    window.addEventListener('click', (e) => {
      if (e.target.closest('a, button, input, select, textarea, label, summary, [role="button"], .pricing__toggle')) return;
      const x = e.clientX, y = e.clientY;
      burst(x, y, 34, 1.1);
      meteor(x + 260, y - 220, { angle: Math.PI * 0.78, speed: 1300, life: 0.55, len: 200, width: 2.6 });
      wishes.push({ x, y, life: 0, text: WISH_WORDS[Math.floor(Math.random() * WISH_WORDS.length)] });
    });
  }

  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  window.addEventListener('resize', () => { resize(); if (reduceMotion) drawStatic(); });
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running && !reduceMotion) { last = performance.now(); requestAnimationFrame(frame); }
  });

  // ---------- Drawing ----------
  // The nebula is painted once at low resolution and slid around each frame.
  const nebula = document.createElement('canvas');
  let nebulaKey = '';
  function paintNebula(pal) {
    const key = `${W}x${H}:${pal === LIGHT}`;
    if (key === nebulaKey) return;
    nebulaKey = key;
    const S = 0.25;
    const nw = nebula.width = Math.ceil(W * 1.2 * S);
    const nh = nebula.height = Math.ceil(H * 1.2 * S);
    const g = nebula.getContext('2d');
    g.clearRect(0, 0, nw, nh);
    const R = Math.max(nw, nh);
    [[0.22, 0.25, 0.55], [0.85, 0.6, 0.5], [0.5, 1.0, 0.45]].forEach(([fx, fy, fr], i) => {
      const [cr, cg, cb, ca] = pal.nebula[i];
      const grad = g.createRadialGradient(nw * fx, nh * fy, 0, nw * fx, nh * fy, R * fr);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${ca})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, nw, nh);
    });
  }

  function drawNebula(pal) {
    paintNebula(pal);
    const t = time * 0.05;
    const ox = -W * 0.1 + Math.sin(t) * W * 0.04;
    const oy = -H * 0.1 + Math.cos(t * 0.7) * H * 0.04 - (scrollY * 0.03) % (H * 0.1);
    ctx.drawImage(nebula, ox, oy, W * 1.2, H * 1.2);
  }

  function starPos(s) {
    // depth parallax from scroll + pointer, wrapped to the viewport
    const mx = mouse.active ? (mouse.tx - W / 2) : 0;
    const my = mouse.active ? (mouse.ty - H / 2) : 0;
    let x = s.x - mx * s.z * 0.035 + time * s.drift * 6 * s.z;
    let y = s.y - scrollY * s.z * 0.22 - my * s.z * 0.035;
    x = ((x % W) + W) % W;
    y = ((y % H) + H) % H;
    return [x, y];
  }

  function drawStars(pal, dt) {
    const light = pal === LIGHT;
    const nearby = [];
    for (const s of stars) {
      const [x, y] = starPos(s);
      const tw = 0.55 + 0.45 * Math.sin(time * s.speed + s.phase);
      const a = s.base * tw * pal.alpha;
      const tint = pal.tints[s.tint];

      // scroll warp: stretch stars into short streaks
      const stretch = warp * s.z * 0.9;
      if (Math.abs(stretch) > 1.5) {
        ctx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${a * 0.8})`;
        ctx.lineWidth = s.r * 0.9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + stretch);
        ctx.stroke();
      }

      const size = s.r * 6 * (light ? 0.8 : 1);
      ctx.globalAlpha = a;
      ctx.drawImage(sprite(tint), x - size / 2, y - size / 2, size, size);

      if (s.glint && !light) {
        const gl = (0.5 + 0.5 * Math.sin(time * s.speed * 0.6 + s.phase)) * s.r * 7;
        ctx.globalAlpha = a * 0.6;
        ctx.strokeStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x - gl, y); ctx.lineTo(x + gl, y);
        ctx.moveTo(x, y - gl); ctx.lineTo(x, y + gl);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (mouse.active && s.z > 0.35) {
        const dx = x - mouse.tx, dy = y - mouse.ty;
        const d2 = dx * dx + dy * dy;
        if (d2 < 170 * 170) nearby.push([x, y, d2]);
      }
    }

    // Cursor constellation: nearby stars reach toward the pointer and each other
    if (nearby.length) {
      nearby.sort((p, q) => p[2] - q[2]);
      const pts = nearby.slice(0, 7);
      const [lr, lg, lb] = pal.line;
      ctx.lineWidth = 0.7;
      for (let i = 0; i < pts.length; i++) {
        const [x, y, d2] = pts[i];
        const f = 1 - Math.sqrt(d2) / 170;
        ctx.strokeStyle = `rgba(${lr},${lg},${lb},${f * 0.35})`;
        ctx.beginPath();
        ctx.moveTo(mouse.tx, mouse.ty);
        ctx.lineTo(x, y);
        ctx.stroke();
        if (i > 0) {
          const [px, py] = pts[i - 1];
          ctx.strokeStyle = `rgba(${lr},${lg},${lb},${f * 0.2})`;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
    }
  }

  function drawMeteors(pal, dt) {
    const [r, g, b] = pal.meteor;
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.life += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const p = m.life / m.max;
      if (p >= 1 || m.y > H + 200 || m.x < -300) { meteors.splice(i, 1); continue; }
      const fade = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
      const sp = Math.hypot(m.vx, m.vy);
      const tx = m.x - (m.vx / sp) * m.len;
      const ty = m.y - (m.vy / sp) * m.len;

      // trail
      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, `rgba(${r},${g},${b},${0.95 * fade})`);
      grad.addColorStop(0.25, `rgba(226,179,131,${0.45 * fade})`);
      grad.addColorStop(1, 'rgba(226,179,131,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = m.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // head glow
      const hs = 26 * m.width * 0.5;
      ctx.globalAlpha = fade;
      ctx.drawImage(sprite([r, g, b]), m.x - hs / 2, m.y - hs / 2, hs, hs);
      ctx.globalAlpha = 1;

      // shed embers
      if (Math.random() < 0.6) {
        sparks.push({
          x: m.x, y: m.y,
          vx: m.vx * 0.04 + (Math.random() - 0.5) * 30,
          vy: m.vy * 0.04 + (Math.random() - 0.5) * 30,
          life: 0, max: 0.4 + Math.random() * 0.5,
          r: 0.5 + Math.random() * 1.2, tint: 1, g: 30,
        });
      }
    }
  }

  function drawSparks(pal, dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt;
      if (s.life >= s.max) { sparks.splice(i, 1); continue; }
      s.vx *= 0.96;
      s.vy = s.vy * 0.96 + s.g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const a = 1 - s.life / s.max;
      const size = s.r * 7 * a + 2;
      ctx.globalAlpha = a * pal.alpha;
      ctx.drawImage(sprite(pal.tints[s.tint]), s.x - size / 2, s.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    if (sparks.length > 900) sparks.splice(0, sparks.length - 900);
  }

  function drawWishes(pal, dt) {
    for (let i = wishes.length - 1; i >= 0; i--) {
      const w = wishes[i];
      w.life += dt;
      if (w.life > 1.6) { wishes.splice(i, 1); continue; }
      const p = w.life / 1.6;
      const [r, g, b] = pal.line;
      ctx.globalAlpha = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.font = 'italic 22px "Instrument Serif", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(w.text, w.x, w.y - 24 - p * 46);
      // expanding ring
      ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - p) * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w.x, w.y, 6 + p * 70, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;

    // ease pointer + warp from scroll velocity
    mouse.tx += (mouse.x - mouse.tx) * 0.08;
    mouse.ty += (mouse.y - mouse.ty) * 0.08;
    const v = scrollY - lastScrollY;
    lastScrollY = scrollY;
    warp += (Math.max(-60, Math.min(60, -v * 1.4)) - warp) * 0.18;

    const pal = isLight() ? LIGHT : DARK;
    ctx.clearRect(0, 0, W, H);
    drawNebula(pal);
    drawStars(pal, dt);
    drawMeteors(pal, dt);
    drawSparks(pal, dt);
    drawWishes(pal, dt);

    nextMeteor -= dt;
    if (nextMeteor <= 0) {
      meteor();
      if (Math.random() < 0.18) setTimeout(() => meteor(), 180 + Math.random() * 300);
      nextMeteor = 2.2 + Math.random() * 4.5;
    }

    requestAnimationFrame(frame);
  }

  function drawStatic() {
    const pal = isLight() ? LIGHT : DARK;
    ctx.clearRect(0, 0, W, H);
    drawNebula(pal);
    drawStars(pal, 0);
  }

  resize();
  if (reduceMotion) {
    drawStatic();
    new MutationObserver(drawStatic).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } else {
    requestAnimationFrame((t) => { last = t; frame(t); });
  }
}
