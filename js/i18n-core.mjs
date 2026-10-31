// Translation core shared by the page generator (Node) and the pages (browser). A catalog is nested JSON with the
// pt-BR text as the source. A leaf is a string, a list of strings, or a plural ({ one, other, … }) chosen with
// Intl.PluralRules from `count`. `{name}` in a string is filled from the variables.
const PLURAL = ['zero', 'one', 'two', 'few', 'many', 'other'];

export const isPlural = v => !!v && typeof v === 'object' && !Array.isArray(v) && 'other' in v && Object.keys(v).every(k => PLURAL.includes(k));

// Nested catalog → { 'a.b.c': leaf }.
export function flatten(tree, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || isPlural(v)) out[key] = v;
    else if (Array.isArray(v)) {
      if (!v.every(x => typeof x === 'string')) throw new Error(`catálogo: lista com item que não é texto em ${key}`);
      out[key] = v;
    } else if (v && typeof v === 'object') flatten(v, key, out);
    else throw new Error(`catálogo: valor inválido em ${key}`);
  }
  return out;
}

export const format = (text, vars = {}) => text.replace(/\{(\w+)\}/g, (all, name) => (name in vars ? String(vars[name]) : all));

// t(key, vars) for one language. A key the catalog does not have is an error: a page never falls back to pt-BR
// in silence.
export function createT(map, locale) {
  const rules = new Intl.PluralRules(locale);
  function t(key, vars = {}) {
    if (!Object.hasOwn(map, key)) throw new Error(`i18n: a chave ${key} não existe em ${locale}`);
    const v = map[key];
    if (Array.isArray(v)) return v;
    if (isPlural(v)) {
      if (!('count' in vars)) throw new Error(`i18n: ${key} é plural e precisa de count`);
      return format(v[rules.select(Number(vars.count))] ?? v.other, vars);
    }
    return format(v, vars);
  }
  t.has = key => Object.hasOwn(map, key);
  return t;
}
