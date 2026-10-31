// Shows the Cadente window in the language of the page. The prototype keeps its state in pt-BR: many visible words
// are also values the code compares ("trabalhando", the view ids, "sim"). So nothing in the state is translated;
// the HTML that render(S) returns is, just before it reaches the page (js/stage.js), from a catalog of the strings the
// window shows (i18n/<code>/demo.json, harvested by scripts/i18n/harvest-demo.mjs).
//
// A text is looked up whole; numbers are a placeholder ("{0} testes novos"); a text made of parts joined by " · "
// is looked up part by part. What the visitor watches being typed, code, paths and the recorded CLI screens are
// never translated.
const NUMBER = /\d+(?:[.,:]\d+)*/g;
const LETTER = /\p{L}/u;
const SEP = ' · ';
// Text inside KEEP is never touched. Inside TYPING, where the visitor watches text being typed, only the
// placeholder (HINT) is.
const KEEP = '.ln.ctx .cwd, .ln.ctx .br, .ln.diff, .blk .ln.cmd .tx, kbd, .kbd, .tui-rec, .tui-svg, .dbv-code, .cl, code, .code, .xd-svg text:not(.xhint), [translate="no"]';
const TYPING = '.ln.in, .ln.q, .tui-in, .sh-search, .wb-url.on, .ml.raw:has(.cur)';
const HINT = '.hint, .t-dim, .dim';
const ATTRS = ['title', 'aria-label', 'placeholder'];

// "3 de 12 · 4 min" → { key: "{0} de {1} · {2} min", nums: ['3', '12', '4'] }
export function generalize(text) {
  const nums = text.match(NUMBER) ?? [];
  let i = 0;
  return { key: nums.length ? text.replace(NUMBER, () => `{${i++}}`) : text, nums };
}

// The keys a text contributes to the catalog: the whole text, or its parts when it has " · ". Paths, files, URLs,
// handles, commands, identifiers and single letters are the same in every language and are left out.
const SAME = [
  /^.$/u, /^[@#/~]/, /^https?:/, /^[\w.{}-]+\/[\w./{}-]*$/, /^[\w.{}-]+\.(rs|ts|tsx|js|mjs|json|md|toml|db|sql|ya?ml|css|html|py|lock|sh|env)$/,
  /^[a-z0-9{}]+(?:[-_.][a-z0-9{}]+)+$/, /^[A-Z]+(?:[ _][A-Z]+)*$/, /^[a-z]+[A-Z]\w*$/,
];
export const sameEverywhere = key => SAME.some(re => re.test(key));
export function keysOf(text) {
  const core = text.trim();
  if (!core || !LETTER.test(core)) return [];
  const parts = core.includes(SEP) ? core.split(SEP) : [core];
  return parts.map(p => p.trim()).filter(p => LETTER.test(p)).map(p => generalize(p).key).filter(k => !sameEverywhere(k));
}

export function createTranslator(dict) {
  const map = new Map(Object.entries(dict ?? {}));
  const one = s => {
    if (map.has(s)) return map.get(s);
    const { key, nums } = generalize(s);
    if (!nums.length || !map.has(key)) return null;
    return map.get(key).replace(/\{(\d+)\}/g, (all, k) => nums[k] ?? all);
  };
  // A text in the page language, or null when the catalog does not know it.
  function text(s) {
    const core = s.trim();
    if (!core || !LETTER.test(core)) return null;
    let out = one(core);
    if (out == null && core.includes(SEP)) {
      const parts = core.split(SEP), done = parts.map(p => one(p.trim()) ?? p);
      if (done.some((p, i) => p !== parts[i])) out = done.join(SEP);
    }
    if (out == null || out === core) return null;
    const lead = s.slice(0, s.indexOf(core)), tail = s.slice(s.indexOf(core) + core.length);
    return lead + out + tail;
  }
  text.size = map.size;
  return text;
}

// Visits every text node and attribute that may be translated, under `root` (an element or a fragment).
export function visit(root, onText, onAttr) {
  const doc = root.ownerDocument ?? root;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest(KEEP) || (el.closest(TYPING) && !el.closest(HINT))) continue;
    onText(n);
  }
  if (!onAttr) return;
  for (const el of root.querySelectorAll(ATTRS.map(a => `[${a}]`).join(','))) {
    if (el.closest('.tui-rec, .tui-svg, [translate="no"]')) continue;
    for (const a of ATTRS) if (el.hasAttribute(a)) onAttr(el, a);
  }
}

// Translates `root` in place. Idempotent: a translated text is not in the catalog's source, so it stays.
export function translateTree(root, tr) {
  if (!tr) return root;
  visit(root, n => { const v = tr(n.data); if (v != null) n.data = v; }, (el, a) => { const v = tr(el.getAttribute(a)); if (v != null) el.setAttribute(a, v); });
  return root;
}

// Adds to `set` every catalog key that `root` shows.
export function collectTree(root, set) {
  visit(root, n => keysOf(n.data).forEach(k => set.add(k)), (el, a) => keysOf(el.getAttribute(a)).forEach(k => set.add(k)));
  return set;
}
