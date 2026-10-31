// The decisions of the home page that do not touch the page, so they can be tested in Node in every language.
// Each takes `t` (js/i18n-core.mjs) for the words and returns plain data or text.
import { APPS, CATEGORIES, priceOf } from './store-data.js';

const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// The store mock-up in one language: [{ i, glyph, id, name, author, desc, cat, catLabel, kind, price }].
export function storeApps(t, money) {
  return APPS.map(([glyph, id, author, cat], i) => {
    const [kind, key, value] = priceOf(i);
    return { i, glyph, id, author, cat, name: t(`store.app.${id}.name`), desc: t(`store.app.${id}.desc`), catLabel: t(`store.cat.${cat}`), kind, price: t(`store.price.${key}`, { price: value === undefined ? '' : money(value), days: value }) };
  });
}
export const storeCategories = t => CATEGORIES.map(id => ({ id, label: t(`store.cat.${id}`) }));

// The search of the store: by name, description, category and author, without accents, at most `limit` hits.
export function filterApps(apps, { cat = 'all', query = '', limit = 9 } = {}) {
  const q = norm(query.trim());
  return apps.filter(a => (cat === 'all' || a.cat === cat) && (!q || norm(`${a.name} ${a.desc} ${a.catLabel} ${a.author}`).includes(q))).slice(0, limit);
}

// Earnings calculator. The crowd slider moves on a log scale, rounded to two significant digits.
export const SHARES = { subscription: 0.7, once: 0.7, donation: 0.9 };
export function peopleAt(v) {
  const n = 10 * 10 ** (v / 25), p = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / p) * p;
}
export const earnings = (model, price, people) => price * people * SHARES[model];

// The plugin rack: which plugins use a service, and what the log says after each action.
export const NO_AI = 'none';
export function usersOf(rack, service) {
  return rack.plugins.filter(p => p.on && p.uses.includes(service)).map(p => p.name);
}
export function rackLog(t, list, action) {
  const users = action.users ?? [];
  switch (action.type) {
    case 'on': return t('rack.log.on', { name: action.name });
    case 'off': return t('rack.log.off', { name: action.name });
    case 'noAi': return t('rack.log.noAi', { users: list(users) });
    case 'swap': return users.length ? t('rack.log.swapUsers', { service: action.service, from: action.from, to: action.to, users: list(users) }) : t('rack.log.swap', { service: action.service, from: action.from, to: action.to });
    case 'install': return t('rack.log.install');
    case 'remove': return t('rack.log.remove');
    default: return t('rack.log.hint');
  }
}
export function serviceNote(t, list, { noAi, users }) {
  if (noAi) return t('rack.svc.again');
  return users.length ? t('rack.svc.usedBy', { users: list(users) }) : t('rack.svc.nobody');
}
