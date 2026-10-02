/**
 * Cadente — Home choreography
 * One motion language: content fades up as it arrives, the hero title
 * rises word by word, and the product demo plays its story on a loop.
 * Everything stays still and fully visible when motion is reduced.
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Hero title: rise word by word ----------
function initSplitText() {
  let delay = 0.1;
  document.querySelectorAll('[data-split] .hero__line').forEach((line, li) => {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const step = li === 0 ? 0.11 : 0.05;
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(' '));
          return;
        }
        const word = document.createElement('span');
        word.className = 'word';
        word.textContent = part;
        word.style.setProperty('--d', `${delay.toFixed(2)}s`);
        delay += step;
        frag.appendChild(word);
      });
      node.replaceWith(frag);
    }
    delay += 0.1;
  });
  document.querySelectorAll('[data-split]').forEach((el) => el.classList.add('split-done'));

  // The rest of the hero follows once the title has settled
  document.querySelectorAll('.hero .reveal').forEach((el, i) => {
    el.style.setProperty('--delay', `${(i === 0 ? 0 : delay + (i - 1) * 0.08).toFixed(2)}s`);
  });
}

// ---------- Reveal on scroll ----------
function initReveal() {
  const targets = document.querySelectorAll('.reveal, .constellation, .ledger, .tile, .animate-on-scroll');
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      el.classList.add('in', 'visible');
      io.unobserve(el);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -48px 0px' });
  targets.forEach((el) => io.observe(el));

  // Siblings in a grid arrive 60ms apart
  document.querySelectorAll('.bento, .pricing__grid').forEach((grid) => {
    [...grid.children].forEach((child, i) => child.style.setProperty('--delay', `${i * 0.06}s`));
  });
}

// ---------- Product demo: the wish becomes a pull request ----------
function initDemo() {
  const demo = document.getElementById('wish-demo');
  if (!demo) return;
  const typeEl = demo.querySelector('.demo__type');
  const steps = [...demo.querySelectorAll('[data-step]')].sort((a, b) => a.dataset.step - b.dataset.step);
  const full = typeEl.dataset.type;
  const beats = { 2: 500, 3: 360, 4: 300, 5: 300, 6: 700, 7: 700, 8: 1000 };
  let timers = [];
  let started = false;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function play() {
    timers.forEach(clearTimeout);
    timers = [];
    demo.classList.add('is-playing');
    steps.forEach((s) => s.classList.toggle('on', s.dataset.step === '1'));
    typeEl.textContent = '';
    typeEl.classList.add('typing');

    let i = 0;
    const typeNext = () => {
      typeEl.textContent = full.slice(0, ++i);
      if (i < full.length) {
        // a human rhythm: quicker inside words, a breath after spaces
        later(typeNext, full[i - 1] === ' ' ? 90 : 34 + Math.random() * 30);
        return;
      }
      typeEl.classList.remove('typing');
      let t = 300;
      for (const s of steps) {
        if (s.dataset.step === '1') continue;
        t += beats[s.dataset.step] || 300;
        later(() => s.classList.add('on'), t);
      }
      later(play, t + 7000);
    };
    later(typeNext, 700);
  }

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !started) {
      started = true;
      play();
    }
  }, { threshold: 0.4 }).observe(demo);
}

// ---------- Focus tile: a timer that actually counts ----------
function initTimer() {
  const time = document.querySelector('.mini__timer-time');
  const ring = document.querySelector('.mini__timer-ring');
  if (!time || !ring) return;
  const total = 25 * 60;
  let left = 18 * 60 + 42;
  const C = 326.7;
  const render = () => {
    const m = String(Math.floor(left / 60)).padStart(2, '0');
    const s = String(left % 60).padStart(2, '0');
    time.textContent = `${m}:${s}`;
    ring.style.strokeDashoffset = String(C * (1 - left / total));
  };
  render();
  setInterval(() => { left = left > 0 ? left - 1 : total; render(); }, 1000);
}

// ---------- Soft pointer light on tiles ----------
function initSpotlight() {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  document.querySelectorAll('.tile').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

// ---------- Navbar hairline once the page moves ----------
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  const update = () => navbar.classList.toggle('navbar--scrolled', window.scrollY > 8);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function init() {
  initNavbar();
  if (reduceMotion) {
    document.documentElement.classList.remove('js-motion');
    document.querySelectorAll('.animate-on-scroll').forEach((el) => el.classList.add('visible'));
    return;
  }
  document.documentElement.classList.add('js-motion');
  initSplitText();
  initReveal();
  initDemo();
  initTimer();
  initSpotlight();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
