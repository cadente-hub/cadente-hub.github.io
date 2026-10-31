// Example plugins for the store mock-up. The store opens with the plugin platform; these names show its shape.
// Names and descriptions live in the catalog (js.store.app.<id>), categories in js.store.cat.<id>.
export const CATEGORIES = ['all', 'dev', 'ai', 'productivity', 'data', 'themes', 'fun'];

// glyph, id, author, category
export const APPS = [
  ['▦', 'kanban', 'ana', 'productivity'],
  ['✎', 'board', 'bitcraft', 'productivity'],
  ['⛁', 'postgres', 'leo', 'data'],
  ['❖', 'docs', 'sofia', 'productivity'],
  ['◍', 'browser', 'orbita', 'dev'],
  ['◆', 'testWriter', 'ana', 'ai'],
  ['◑', 'neon', 'bitcraft', 'themes'],
  ['⎈', 'kubernetes', 'nuvem', 'dev'],
  ['✳', 'meetingSummary', 'lumen', 'ai'],
  ['♪', 'radio', 'marina', 'fun'],
  ['.*', 'regex', 'sofia', 'dev'],
  ['▤', 'sheets', 'leo', 'data'],
  ['⌕', 'rag', 'kenji', 'ai'],
  ['✓', 'habits', 'devrafa', 'productivity'],
  ['◇', 'sqlite', 'kenji', 'data'],
  ['⟳', 'cron', 'marina', 'dev'],
  ['◐', 'contrast', 'lumen', 'themes'],
  ['⚖', 'promptJudge', 'marina', 'ai'],
  ['▣', 'compose', 'devrafa', 'dev'],
  ['✐', 'journal', 'ana', 'productivity'],
  ['♞', 'chess', 'leo', 'fun'],
  ['{}', 'jsonSchema', 'bitcraft', 'dev'],
  ['✎', 'commitWriter', 'leo', 'ai'],
  ['¤', 'exchange', 'devrafa', 'data'],
  ['◒', 'sepia', 'nuvem', 'themes'],
  ['≋', 'logs', 'lumen', 'dev'],
  ['$', 'finance', 'bitcraft', 'productivity'],
  ['◈', 'graphql', 'orbita', 'dev'],
  ['⟡', 'explainer', 'sofia', 'ai'],
  ['☄', 'stars', 'orbita', 'fun'],
  ['⑂', 'gitGraph', 'kenji', 'dev'],
  ['☷', 'rss', 'kenji', 'productivity'],
  ['▁', 'charts', 'orbita', 'data'],
  ['◓', 'retro', 'kenji', 'themes'],
  ['⚑', 'flags', 'marina', 'dev'],
  ['◎', 'translator', 'orbita', 'ai'],
  ['⌚', 'timesheet', 'nuvem', 'productivity'],
  ['⇅', 'migrations', 'devrafa', 'data'],
  ['◕', 'mascot', 'sofia', 'fun'],
  ['◔', 'coverage', 'leo', 'dev'],
  ['✉', 'email', 'lumen', 'productivity'],
  ['☁', 'weather', 'ana', 'data'],
  ['⚿', 'secrets', 'nuvem', 'dev'],
  ['◫', 'mindMap', 'sofia', 'productivity'],
  ['⌨', 'typing', 'devrafa', 'fun'],
  ['↯', 'uptime', 'orbita', 'dev'],
  ['⏱', 'benchmarks', 'bitcraft', 'dev'],
  ['≡', 'changelog', 'sofia', 'dev'],
  ['⌘', 'snippets', 'marina', 'productivity'],
];

// Most plugins are free; the author picks the model. [kind, catalog key under js.store.price, price in US$]
const PRICES = [
  ['free', 'free'], ['free', 'free'], ['donation', 'donation'], ['free', 'free'], ['subscription', 'perMonth', 4],
  ['free', 'free'], ['trial', 'trial', 7], ['free', 'free'], ['once', 'once', 12], ['donation', 'donation'],
];
export const priceOf = i => PRICES[(i * 7 + 3) % PRICES.length];
