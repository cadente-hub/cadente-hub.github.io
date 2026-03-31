/**
 * Cadente — Wow-Factor Animations (60 FPS)
 * GPU-accelerated: only touches transform/opacity
 */

// ---------- Floating Particles (Hero) ----------
function initParticles() {
  const canvas = document.getElementById('hero-particles');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];
  let raf;
  let w, h;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    w = canvas.width = rect.width;
    h = canvas.height = rect.height;
  }

  function createParticles() {
    particles = [];
    const count = Math.min(Math.floor(w * h / 12000), 80);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.1,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    const accent = [196, 149, 106]; // accent color

    for (const p of particles) {
      p.x += p.dx;
      p.y += p.dy;
      p.pulse += 0.015;

      // Wrap around
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      const alpha = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${accent[0]}, ${accent[1]}, ${accent[2]}, ${alpha})`;
      ctx.fill();
    }

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = dx * dx + dy * dy;
        if (dist < 18000) {
          const alpha = (1 - dist / 18000) * 0.08;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${accent[0]}, ${accent[1]}, ${accent[2]}, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    raf = requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });

  // Pause when out of viewport
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (!raf) draw();
    } else {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }, { threshold: 0 });
  observer.observe(canvas);
}

// ---------- Smooth Parallax ----------
function initParallax() {
  const elements = document.querySelectorAll('[data-parallax]');
  if (!elements.length) return;

  let ticking = false;

  function update() {
    const scrollY = window.scrollY;
    for (const el of elements) {
      const speed = parseFloat(el.dataset.parallax) || 0.1;
      const rect = el.getBoundingClientRect();
      const offset = (rect.top + scrollY - window.innerHeight / 2) * speed;
      el.style.transform = `translateY(${offset}px)`;
    }
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
}

// ---------- Magnetic Tilt on Feature Cards ----------
function initMagneticTilt() {
  const cards = document.querySelectorAll('.feature-visual-card');

  for (const card of cards) {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const rotateX = ((y - cy) / cy) * -6;
      const rotateY = ((x - cx) / cx) * 6;

      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale(1.02)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  }
}

// ---------- Staggered Scroll Animations ----------
function initStaggeredScrollAnimations() {
  const groups = document.querySelectorAll('.animate-on-scroll');
  if (!groups.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.08,
      rootMargin: '0px 0px -60px 0px',
    }
  );

  groups.forEach((el) => observer.observe(el));
}

// ---------- Smooth Counter Animation ----------
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = el.dataset.count;
          const suffix = el.dataset.countSuffix || '';
          const prefix = el.dataset.countPrefix || '';
          const isNumber = !isNaN(parseFloat(target));

          if (isNumber) {
            const end = parseFloat(target);
            const duration = 1500;
            const start = performance.now();

            function step(now) {
              const elapsed = now - start;
              const progress = Math.min(elapsed / duration, 1);
              // Ease out cubic
              const eased = 1 - Math.pow(1 - progress, 3);
              const current = Math.round(eased * end);
              el.textContent = prefix + current + suffix;
              if (progress < 1) requestAnimationFrame(step);
            }

            requestAnimationFrame(step);
          }

          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((el) => observer.observe(el));
}

// ---------- Smooth Navbar Background ----------
function initSmoothNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  let ticking = false;

  function update() {
    const scrollY = window.scrollY;
    const opacity = Math.min(scrollY / 200, 1);
    navbar.style.setProperty('--scroll-opacity', opacity);
    if (scrollY > 10) {
      navbar.classList.add('navbar--scrolled');
    } else {
      navbar.classList.remove('navbar--scrolled');
    }
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
}

// ---------- Mouse Glow Follow (Hero) ----------
function initMouseGlow() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const glow = document.createElement('div');
  glow.className = 'hero__mouse-glow';
  glow.style.cssText = `
    position: absolute;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(196, 149, 106, 0.06), transparent 70%);
    pointer-events: none;
    z-index: 0;
    transform: translate(-50%, -50%);
    transition: opacity 0.3s ease;
    opacity: 0;
  `;
  hero.appendChild(glow);

  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    glow.style.left = (e.clientX - rect.left) + 'px';
    glow.style.top = (e.clientY - rect.top) + 'px';
    glow.style.opacity = '1';
  });

  hero.addEventListener('mouseleave', () => {
    glow.style.opacity = '0';
  });
}

// ---------- Marquee Pause on Hover ----------
function initMarqueePause() {
  const marquees = document.querySelectorAll('.marquee');
  for (const marquee of marquees) {
    const track = marquee.querySelector('.marquee__track');
    if (!track) continue;

    marquee.addEventListener('mouseenter', () => {
      track.style.animationPlayState = 'paused';
    });
    marquee.addEventListener('mouseleave', () => {
      track.style.animationPlayState = 'running';
    });
  }
}

// ---------- Init All ----------
document.addEventListener('DOMContentLoaded', () => {
  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  initParticles();
  initParallax();
  initMagneticTilt();
  initStaggeredScrollAnimations();
  initCounters();
  initSmoothNavbar();
  initMouseGlow();
  initMarqueePause();
});
