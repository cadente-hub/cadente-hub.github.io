/**
 * Cadente — Home choreography
 * Split-text entrances, scramble labels, the wish → PR demo,
 * cursor spotlights, 3D tilt, magnetic buttons, counters and the finale shower.
 * Only transform/opacity/filter are animated; everything degrades to static
 * content when the visitor prefers reduced motion.
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

// ---------- Split text into characters ----------
function initSplitText() {
  let delay = 0.15;
  document.querySelectorAll('[data-split] .hero__line').forEach((line, li) => {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const step = li === 0 ? 0.055 : 0.018;
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(' '));
          delay += step * 0.5;
          return;
        }
        const word = document.createElement('span');
        word.className = 'word';
        for (const ch of part) {
          const span = document.createElement('span');
          span.className = 'ch';
          span.textContent = ch;
          span.style.setProperty('--d', `${delay.toFixed(3)}s`);
          delay += step;
          word.appendChild(span);
        }
        frag.appendChild(word);
      });
      node.replaceWith(frag);
    }
    delay += 0.15;
  });
  document.querySelectorAll('[data-split]').forEach((el) => el.classList.add('split-done'));
  // stagger the rest of the hero after the title has landed
  document.querySelectorAll('.hero .reveal').forEach((el, i) => {
    el.style.setProperty('--delay', `${(i === 0 ? 0 : delay * 0.55 + i * 0.12).toFixed(2)}s`);
  });
}

// ---------- Scramble (decode) labels ----------
const GLYPHS = '✦✧⋆·+*×01<>/\\{}[]#';
function scramble(el) {
  if (el.dataset.scrambled) return;
  el.dataset.scrambled = '1';
  const target = el.textContent;
  const len = target.length;
  const start = performance.now();
  const dur = 900 + len * 18;
  function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    const revealed = Math.floor(p * len);
    let html = '';
    for (let i = 0; i < len; i++) {
      const c = target[i];
      if (i < revealed || c === ' ') html += c;
      else html += `<span class="scr">${GLYPHS[(Math.random() * GLYPHS.length) | 0]}</span>`;
    }
    el.innerHTML = html;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}

// ---------- Reveal on scroll ----------
function initReveal() {
  const targets = document.querySelectorAll('.reveal, .constellation, .ledger, .tile, .animate-on-scroll');
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      el.classList.add('in', 'visible');
      el.querySelectorAll('[data-scramble]').forEach(scramble);
      if (el.matches('[data-scramble]')) scramble(el);
      el.querySelectorAll('[data-count]').forEach(countUp);
      io.unobserve(el);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  targets.forEach((el) => io.observe(el));

  document.querySelectorAll('.card__pricing-features li').forEach((li, i, all) => {
    li.style.setProperty('--li', [...li.parentElement.children].indexOf(li));
  });

  // stagger siblings inside the same grid
  document.querySelectorAll('.bento, .pricing__grid').forEach((grid) => {
    [...grid.children].forEach((child, i) => child.style.setProperty('--delay', `${i * 0.1}s`));
  });
}

// ---------- Counters ----------
function countUp(el) {
  const end = parseFloat(el.dataset.count);
  if (Number.isNaN(end)) return;
  const prefix = el.dataset.countPrefix || '';
  const suffix = el.dataset.countSuffix || '';
  if (end === 0) {
    // count down from noise to zero, for "0 telemetry"
    let n = 99;
    const iv = setInterval(() => {
      n = Math.max(0, Math.floor(n * 0.72));
      el.textContent = prefix + n + suffix;
      if (n === 0) clearInterval(iv);
    }, 60);
    return;
  }
  const start = performance.now();
  const dur = 1600;
  function step(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = prefix + Math.round(end + (2250 - end) * (1 - eased)) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---------- Wish demo: type the wish, then play the steps ----------
function initDemo() {
  const demo = document.getElementById('wish-demo');
  if (!demo) return;
  const typeEl = demo.querySelector('.demo__type');
  const steps = [...demo.querySelectorAll('[data-step]')].sort((a, b) => a.dataset.step - b.dataset.step);
  const full = typeEl.dataset.type;
  let timers = [];
  let started = false;

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function play() {
    timers.forEach(clearTimeout);
    timers = [];
    demo.classList.add('is-playing');
    steps.forEach((s) => s.classList.remove('on'));
    typeEl.textContent = '';
    typeEl.classList.add('typing');

    let i = 0;
    const typeNext = () => {
      typeEl.textContent = full.slice(0, ++i);
      if (i < full.length) later(typeNext, 28 + Math.random() * 45);
      else {
        typeEl.classList.remove('typing');
        const rect = typeEl.getBoundingClientRect();
        window.cadenteSky?.burst(rect.right, rect.top + rect.height / 2, 16, 0.6);
        let t = 450;
        for (const s of steps) {
          if (s.dataset.step === '1') { s.classList.add('on'); continue; }
          const gap = s.dataset.step === '6' ? 700 : s.dataset.step === '7' ? 650 : s.dataset.step === '8' ? 900 : 380;
          t += gap;
          later(() => {
            s.classList.add('on');
            if (s.dataset.step === '8') {
              const r = s.getBoundingClientRect();
              window.cadenteSky?.burst(r.left + r.width / 2, r.top + 10, 40, 1);
              window.cadenteSky?.meteor(r.right + 300, r.top - 240, { angle: Math.PI * 0.77, speed: 1500, life: 0.5, width: 2.4 });
            }
          }, t);
        }
        later(play, t + 6000);
      }
    };
    later(typeNext, 600);
  }

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !started) {
      started = true;
      play();
    }
  }, { threshold: 0.35 }).observe(demo);
}

// ---------- Cursor spotlight on cards ----------
function initSpotlight() {
  document.querySelectorAll('.spot').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

// ---------- 3D tilt (tiles + demo window, which also unfolds on scroll) ----------
function initTilt() {
  const demoWin = document.querySelector('.demo__window');
  let pointerRX = 0, pointerRY = 0;

  function demoTransform() {
    if (!demoWin) return;
    const r = demoWin.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 when the window's top sits at the bottom of the viewport, 1 when centred
    const p = Math.min(Math.max((vh - r.top) / (vh * 0.75), 0), 1);
    const unfold = (1 - p) * 22;
    demoWin.style.transform =
      `rotateX(${(unfold + pointerRX).toFixed(2)}deg) rotateY(${pointerRY.toFixed(2)}deg) scale(${(0.92 + p * 0.08).toFixed(3)})`;
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => { demoTransform(); ticking = false; });
    }
  }, { passive: true });
  demoTransform();

  if (!finePointer) return;

  if (demoWin) {
    demoWin.addEventListener('pointermove', (e) => {
      const r = demoWin.getBoundingClientRect();
      pointerRY = ((e.clientX - r.left) / r.width - 0.5) * 6;
      pointerRX = -((e.clientY - r.top) / r.height - 0.5) * 5;
      demoTransform();
    });
    demoWin.addEventListener('pointerleave', () => { pointerRX = pointerRY = 0; demoTransform(); });
  }

  document.querySelectorAll('.tile, .home .card--pricing').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1000px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-4px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

// ---------- Magnetic buttons ----------
function initMagnetic() {
  if (!finePointer) return;
  document.querySelectorAll('.magnetic').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    btn.addEventListener('click', (e) => {
      window.cadenteSky?.burst(e.clientX, e.clientY, 24, 0.8);
    });
  });
}

// ---------- Finale: meteor shower when the last section arrives ----------
function initFinale() {
  const finale = document.getElementById('finale');
  if (!finale) return;
  let last = 0;
  new IntersectionObserver(([entry]) => {
    const now = performance.now();
    if (entry.isIntersecting && now - last > 8000) {
      last = now;
      window.cadenteSky?.shower(14, 2600);
    }
  }, { threshold: 0.4 }).observe(finale);
}

// ---------- Navbar state ----------
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  const update = () => navbar.classList.toggle('navbar--scrolled', window.scrollY > 10);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// ---------- Init ----------
function init() {
  initNavbar();
  if (reduceMotion) return;
  document.documentElement.classList.add('js-motion');
  initSplitText();
  initReveal();
  initDemo();
  initSpotlight();
  initTilt();
  initMagnetic();
  initFinale();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
