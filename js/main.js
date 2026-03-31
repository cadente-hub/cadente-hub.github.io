/**
 * Cadente - Main JavaScript
 * Handles: theme toggle, navigation, scroll animations, navbar behavior
 */

// ---------- Theme Toggle ----------
const THEME_KEY = 'catarina-theme';

function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return 'dark'; // dark by default
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function initThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  // Apply stored/default theme
  setTheme(getPreferredTheme());

  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });
}

// ---------- Mobile Menu ----------
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });

  // Close menu on link click
  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  });
}

// ---------- Scroll Animations ----------
// Handled by animations.js (staggered, GPU-accelerated)

// ---------- Navbar Scroll Effect ----------
function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  let lastScrollY = 0;

  window.addEventListener(
    'scroll',
    () => {
      const scrollY = window.scrollY;

      // Add a slight background change when scrolled
      if (scrollY > 10) {
        navbar.style.borderBottomColor =
          'var(--color-border-hover)';
      } else {
        navbar.style.borderBottomColor = 'var(--color-border)';
      }

      lastScrollY = scrollY;
    },
    { passive: true }
  );
}

// ---------- Smooth Scroll for Hash Links ----------
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const offset = 80; // navbar height + padding
        const top =
          target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initMobileMenu();
  initNavbarScroll();
  initSmoothScroll();
});
