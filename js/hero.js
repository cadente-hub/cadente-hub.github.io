// The hero: "Cadente is ~~an agent harness~~ ~~a terminal~~ … a hub." Each word the catalog lists (js.hero.words)
// rises into the slot, is struck through and falls away; then the hub stays, and the line below it appears.
// The page's own HTML already says the final sentence, so without scripts or with reduced motion nothing moves.
// `onFall(word, rect)` is called as each word falls, for the sky to catch it (js/sky).
import { t } from './i18n.js';

export const HERO_TIMING = { enter: 140, strike: 520, fall: 360, next: 760, settle: 420 };
const wait = ms => new Promise(r => setTimeout(r, ms));

export async function playHero({ slot, sub, reduced, onFall = () => {}, timing = HERO_TIMING }) {
  const words = t('hero.words');
  const hub = slot.querySelector('.hero__hub');
  if (reduced || !words.length) { slot.classList.add('is-done'); sub?.classList.add('is-in'); return; }
  const layer = document.createElement('span');
  layer.className = 'hero__words';
  layer.setAttribute('aria-hidden', 'true');
  const spans = words.map(w => { const s = document.createElement('span'); s.className = 'hero__word'; s.textContent = w; layer.append(s); return s; });
  slot.prepend(layer);
  // A long word ("a worktree manager") shrinks to fit the title's width instead of running off the screen.
  const room = (slot.closest('h1') ?? slot).clientWidth * 0.96;
  for (const s of spans) if (s.offsetWidth > room) s.style.fontSize = `${(room / s.offsetWidth).toFixed(3)}em`;
  slot.classList.add('is-playing');
  for (const [i, span] of spans.entries()) {
    span.classList.add('is-in');
    await wait(timing.strike);
    span.classList.add('is-struck');
    await wait(timing.fall);
    onFall(span, span.getBoundingClientRect(), i);
    span.classList.add('is-out');
    if (i < spans.length - 1) await wait(timing.next - timing.strike - timing.fall);
  }
  await wait(timing.settle);
  slot.classList.remove('is-playing');
  slot.classList.add('is-done');
  sub?.classList.add('is-in');
  setTimeout(() => layer.remove(), 1200);
  return hub;
}

// The install command of the visitor's system.
export function installCommand(platform = '') {
  return /win/i.test(platform) ? 'irm https://cadente-hub.github.io/install.ps1 | iex' : 'curl -fsSL https://cadente-hub.github.io/install.sh | bash';
}
