// Which of the site's languages fits the visitor best, from navigator.languages. Pure, so it can be tested in Node.
// "zh", "zh-Hans" and "zh-SG" are Simplified Chinese; any "pt" is pt-BR; a region falls back to its language.
const ALIAS = { zh: 'zh-CN', 'zh-hans': 'zh-CN', 'zh-cn': 'zh-CN', 'zh-sg': 'zh-CN', pt: 'pt-BR', iw: 'he', in: 'id' };

export function pickLocale(languages = [], codes = []) {
  const known = new Map(codes.map(c => [c.toLowerCase(), c]));
  for (const raw of languages) {
    const tag = String(raw).toLowerCase().replace(/_/g, '-');
    if (/^zh-(hant|tw|hk|mo)/.test(tag)) continue;
    const parts = tag.split('-');
    const tries = [tag, parts.slice(0, 2).join('-'), parts[0]].flatMap(t => [t, ALIAS[t]?.toLowerCase()]).filter(Boolean);
    for (const t of tries) if (known.has(t)) return known.get(t);
  }
  return null;
}

// The language a visitor chose on this site, kept between visits.
export const STORE_KEY = 'cadente.lang';
export function storedChoice(storage) {
  try { return storage?.getItem(STORE_KEY) ?? null; } catch { return null; }
}
export function storeChoice(storage, code) {
  try { storage?.setItem(STORE_KEY, code); } catch { /* private mode */ }
}
