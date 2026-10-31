// What every page shares: the menu on small screens, the bar that darkens once the page scrolls, the language
// picker and notice (js/langs.js), and the install command of the visitor's system wherever a page shows one.
import { t } from './i18n.js';
import { initLanguages } from './langs.js';

export function installCommand(platform = '') {
  return /win/i.test(platform) ? 'irm https://cadente-hub.github.io/install.ps1 | iex' : 'curl -fsSL https://cadente-hub.github.io/install.sh | bash';
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function initPage() {
  initLanguages();
  const nav = document.getElementById('nav'), menu = document.getElementById('nav-menu'), sheet = document.getElementById('nav-sheet');
  menu?.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', open); sheet.hidden = !open; });
  sheet?.addEventListener('click', e => { if (e.target.closest('a')) { menu.setAttribute('aria-expanded', 'false'); sheet.hidden = true; } });
  const scrolled = () => nav?.classList.toggle('is-scrolled', scrollY > 8);
  addEventListener('scroll', scrolled, { passive: true });
  scrolled();
  // [data-install] shows the command; [data-copy] copies it, or its own data-copy text when it has one.
  const command = installCommand(navigator.userAgentData?.platform ?? navigator.platform ?? '');
  document.querySelectorAll('[data-install]').forEach(el => { el.textContent = command; });
  document.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    const ok = await copyText(btn.dataset.copy || command);
    btn.textContent = t(ok ? 'oneliner.copied' : 'oneliner.select');
    setTimeout(() => { btn.textContent = t('oneliner.copy'); }, 1600);
  }));
}
