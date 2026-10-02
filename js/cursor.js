/**
 * Cadente — Guiding-star cursor
 * A small four-point star leads; a ring follows with a soft lag and leaves a
 * comet tail when the pointer moves fast. Over buttons and links the ring
 * wraps the element's own shape; marked areas show a short label; clicks
 * throw a few sparks. Mouse and trackpad only, and never with reduced motion.
 */

const fine = window.matchMedia('(pointer: fine)').matches;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (fine && !reduceMotion) initCursor();

function initCursor() {
  const root = document.createElement('div');
  root.className = 'cur is-hidden';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="cur__ring"></div>
    <svg class="cur__star" viewBox="0 0 24 24"><path d="M12 1.5l2.1 8.4 8.4 2.1-8.4 2.1-2.1 8.4-2.1-8.4L1.5 12l8.4-2.1z"/></svg>
    <span class="cur__label"></span>`;
  const TRAIL = 8;
  const trail = Array.from({ length: TRAIL }, (_, i) => {
    const t = document.createElement('i');
    t.className = 'cur__trail';
    t.style.setProperty('--k', String(1 - i / TRAIL));
    root.appendChild(t);
    return t;
  });
  document.body.appendChild(root);
  document.documentElement.classList.add('has-cursor');

  const ring = root.querySelector('.cur__ring');
  const star = root.querySelector('.cur__star');
  const label = root.querySelector('.cur__label');

  const MORPH = '.btn, .navbar__links a, .theme-toggle, .pl-step, .pricing__toggle-btn, .reasons a, .footer__col a, .navbar__logo, .navbar__hamburger, .cli-snippet__copy, .download-alt-card__swap';
  const LINK = 'a, button, [role="button"], summary, label, select, .tongues__track span';
  const NATIVE = 'input, textarea, select, [contenteditable="true"], .pl-code pre, code';

  let mx = -100, my = -100;           // pointer
  let rx = -100, ry = -100;           // ring centre
  let rw = 34, rh = 34, rr = 17;      // ring size and radius
  let tw = 34, th = 34, tr = 17;      // ring targets
  let tx = null, ty = null;           // ring target centre when wrapping an element
  let hovered = null;
  const history = [];

  function setTarget(el) {
    hovered = el;
    root.classList.remove('is-link', 'is-wrap');
    tx = ty = null;
    tw = th = 34; tr = 17;
    if (!el) return;
    const wrap = el.closest(MORPH);
    if (wrap) {
      const r = wrap.getBoundingClientRect();
      const cs = getComputedStyle(wrap);
      const pad = 6;
      tw = r.width + pad * 2;
      th = r.height + pad * 2;
      tr = Math.min(parseFloat(cs.borderTopLeftRadius) || 8, th / 2) + pad;
      tx = r.left + r.width / 2;
      ty = r.top + r.height / 2;
      root.classList.add('is-wrap');
      hovered = wrap;
      return;
    }
    if (el.closest(LINK)) {
      tw = th = 52; tr = 26;
      root.classList.add('is-link');
    }
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    mx = e.clientX;
    my = e.clientY;
    root.classList.remove('is-hidden');
    const el = e.target instanceof Element ? e.target : null;
    root.classList.toggle('is-native', !!el?.closest(NATIVE));
    const area = el?.closest('[data-cursor]');
    label.textContent = area ? area.getAttribute('data-cursor') : '';
    root.classList.toggle('has-label', !!area);
    const next = el?.closest(MORPH) || el?.closest(LINK) || null;
    if (next !== hovered) setTarget(next);
    else if (hovered?.matches(MORPH)) setTarget(hovered); // follow layout shifts
  }, { passive: true });

  document.addEventListener('pointerleave', () => root.classList.add('is-hidden'));
  window.addEventListener('blur', () => root.classList.add('is-hidden'));
  window.addEventListener('scroll', () => { if (hovered) setTarget(hovered.matches(MORPH) ? hovered : null); }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    root.classList.add('is-down');
    burst(e.clientX, e.clientY);
  });
  window.addEventListener('pointerup', () => root.classList.remove('is-down'));

  function burst(x, y) {
    for (let i = 0; i < 7; i++) {
      const s = document.createElement('i');
      s.className = 'cur__spark';
      const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
      const d = 18 + Math.random() * 22;
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      s.style.setProperty('--dy', `${Math.sin(a) * d}px`);
      root.appendChild(s);
      setTimeout(() => s.remove(), 650);
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const follow = 1 - Math.pow(0.0005, dt);   // ring lag
    const morph = 1 - Math.pow(0.00002, dt);   // shape change

    const cx = tx ?? mx;
    const cy = ty ?? my;
    rx += (cx - rx) * (tx != null ? morph : follow);
    ry += (cy - ry) * (ty != null ? morph : follow);
    rw += (tw - rw) * morph;
    rh += (th - rh) * morph;
    rr += (tr - rr) * morph;

    ring.style.transform = `translate(${rx - rw / 2}px, ${ry - rh / 2}px)`;
    ring.style.width = `${rw}px`;
    ring.style.height = `${rh}px`;
    ring.style.borderRadius = `${rr}px`;
    star.style.transform = `translate(${mx}px, ${my}px)`;
    label.style.transform = `translate(${mx + 18}px, ${my + 16}px)`;

    // Comet tail from recent positions, only when moving fast
    history.unshift([mx, my]);
    if (history.length > TRAIL * 2) history.length = TRAIL * 2;
    const [ax, ay] = history[0];
    const [bx, by] = history[Math.min(4, history.length - 1)];
    const speed = Math.hypot(ax - bx, ay - by);
    const show = Math.min(1, Math.max(0, (speed - 6) / 30));
    trail.forEach((t, i) => {
      const p = history[Math.min(i * 2 + 1, history.length - 1)];
      t.style.transform = `translate(${p[0]}px, ${p[1]}px)`;
      t.style.opacity = String(show * (1 - i / TRAIL));
    });

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
