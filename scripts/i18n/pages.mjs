// Writes each page of the site in each ready language, from a template in pages/ and the catalogs in i18n/.
// pt-BR stays at the root (/, /downloads.html); the other languages live under their own folder (/en/, /ja/…).
//
// Template tokens:
//   {{key}}         the catalog text, as HTML (catalogs are part of the repository, so they may hold <kbd>, <br>…)
//   {{key|attr}}    the same text escaped for an attribute
//   {{@lang}} {{@dir}} {{@base}}   the language code, the text direction and the folder of the language
//   {{@href:id}}    a link to another page in this language, or to the root page while it has no translation
//   {{@head}}       canonical, hreflang alternates, og:url and og:locale
//   {{@i18n}}       the js.* part of the catalog, for the scripts of the page
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SOURCE, readyLocales, loadCatalog } from './catalog.mjs';
import { createT } from '../../js/i18n-core.mjs';

export const ORIGIN = 'https://cadente-hub.github.io';

// Pages made from a template. `file` is where the page lands inside the language folder; `url` is its public path.
export const PAGES = [
  { id: 'index', template: 'pages/index.html', file: 'index.html', url: '' },
  { id: 'downloads', template: 'pages/downloads.html', file: 'downloads.html', url: 'downloads.html' },
  { id: 'release-notes', template: 'pages/release-notes.html', file: 'release-notes.html', url: 'release-notes.html' },
  { id: 'terms', template: 'pages/terms.html', file: 'terms-and-conditions.html', url: 'terms-and-conditions.html' },
];
// The blog of a language: /blog/ for pt-BR, /blog/<language>/ for the others.
export const blogBase = locale => (locale.path === '/' ? '/blog/' : `/blog${locale.path}`);

// A page lives at its language's folder plus its own path, unless it says otherwise (the blog keeps /blog/ first,
// because the launcher only opens /blog/ links).
export const pathOf = (locale, page) => (page.pathOf ? page.pathOf(locale) : `${locale.path}${page.url}`);
export const outFile = (locale, page) => (page.out ?? `${locale.path.slice(1)}${page.file}`);
export const pageUrl = (locale, page, origin = ORIGIN) => `${origin}${pathOf(locale, page)}`;

const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// JSON inside <script>: nothing in it may close the tag or open a comment.
const scriptJson = v => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

function head(locale, page, locales, origin) {
  if (page.locales) locales = locales.filter(l => page.locales.includes(l.code));
  const alt = locales.map(l => `  <link rel="alternate" hreflang="${l.code}" href="${pageUrl(l, page, origin)}" />`);
  const source = locales.find(l => l.code === SOURCE) ?? locale;
  return [
    `<link rel="canonical" href="${pageUrl(locale, page, origin)}" />`,
    ...alt.map(s => s.trim()),
    `<link rel="alternate" hreflang="x-default" href="${pageUrl(source, page, origin)}" />`,
    `<meta property="og:url" content="${pageUrl(locale, page, origin)}" />`,
    `<meta property="og:locale" content="${locale.og}" />`,
    ...locales.filter(l => l.code !== locale.code).map(l => `<meta property="og:locale:alternate" content="${l.og}" />`),
  ].join('\n  ');
}

// Cadu, the logo, inline so it shows before any script runs. scripts/brand-assets.mjs draws assets/logo-symbol.svg.
let brandBody = null;
function brand(root) {
  brandBody ??= fs.readFileSync(path.join(root, 'assets/logo-symbol.svg'), 'utf8').replace(/^[\s\S]*?<\/title>/, '').replace(/<\/svg>\s*$/, '');
  return `<svg class="brand__mark" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${brandBody}</svg>`;
}

// The FAQ for search engines, from the same faq.q<n> / faq.a<n> keys the page shows.
const plain = html => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
export function faqItems(messages) {
  return Object.keys(messages).map(k => k.match(/^faq\.q(\d+)$/)?.[1]).filter(Boolean).sort((a, b) => a - b)
    .map(n => ({ q: plain(messages[`faq.q${n}`]), a: plain(messages[`faq.a${n}`]) }));
}
function faqJsonLd(messages) {
  const data = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems(messages).map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return `<script type="application/ld+json">${scriptJson(data)}</script>`;
}

// The page in one language. Throws on a key the catalog does not have, or on a token left in the result.
export function renderPage({ template, page, locale, locales, messages, catalogs = new Map(), origin = ORIGIN, root = ROOT, vars = {} }) {
  const t = createT(messages, locale.intl);
  const href = id => {
    const own = PAGES.find(p => p.id === id);
    if (own) return `${locale.path}${own.url}`;
    if (id === 'blog') return blogBase(locale);
    throw new Error(`página desconhecida em @href: ${id}`);
  };
  // The other ready languages, each with the words of its own notice ("this page is also in English").
  const others = () => Object.fromEntries(locales.filter(l => l.code !== locale.code).map(l => {
    const m = catalogs.get(l.code) ?? {};
    return [l.code, { name: l.name, dir: l.dir, href: pathOf(l, page), notice: m['lang.notice'] ?? '', go: m['lang.go'] ?? '', close: m['lang.close'] ?? '' }];
  }));
  const js = Object.fromEntries(Object.entries(messages).filter(([k]) => k.startsWith('js.')).map(([k, v]) => [k.slice(3), v]));
  // Shared pieces (pages/_nav.html, pages/_foot.html) go in first, so their tokens are filled like the page's.
  template = template.replace(/\{\{@include:([\w-]+)\}\}/g, (all, name) => fs.readFileSync(path.join(root, 'pages', `_${name}.html`), 'utf8'));
  const html = template.replace(/\{\{\s*([@$]?[\w.:-]+)\s*(?:\|\s*(\w+)\s*)?\}\}/g, (all, key, filter) => {
    let v;
    if (key === '@lang') v = locale.code;
    else if (key === '@dir') v = locale.dir;
    else if (key === '@base') v = locale.path;
    else if (key === '@head') v = head(locale, page, locales, origin);
    else if (key === '@brand') v = brand(root);
    // A script Geist does not cover gets its Noto font, on its own pages only, after Geist in the stack.
    else if (key === '@fonts') v = locale.font ? `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(locale.font).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap" rel="stylesheet" />\n  <style>:root { --sans: 'Geist', '${locale.font}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }</style>` : '';
    else if (key === '@jsonld:faq') v = faqJsonLd(messages);
    // The legal text of the language (i18n/<code>/terms.html); the English one is the original.
    else if (key === '@terms') v = fs.readFileSync(path.join(root, 'i18n', locale.code, 'terms.html'), 'utf8');
    else if (key.startsWith('$')) { if (!Object.hasOwn(vars, key.slice(1))) throw new Error(`falta a variável ${key}`); v = vars[key.slice(1)]; }
    else if (key === '@langlinks') v = (page.locales ? locales.filter(l => page.locales.includes(l.code)) : locales).map(l => `<a href="${pathOf(l, page)}" hreflang="${l.code}" lang="${l.code}" data-lang="${l.code}"${l.code === locale.code ? ' aria-current="true"' : ''}>${escAttr(l.name)}</a>`).join('');
    else if (key === '@i18n') v = `<script type="application/json" id="i18n">${scriptJson({ locale: locale.code, intl: locale.intl, dir: locale.dir, base: locale.path, messages: js, others: others() })}</script>`;
    else if (key.startsWith('@href:')) v = href(key.slice(6));
    else if (key.startsWith('@')) throw new Error(`token desconhecido: ${key}`);
    else {
      v = t(key);
      if (typeof v !== 'string') throw new Error(`${key} não é um texto simples e não cabe no HTML`);
    }
    if (filter === 'attr') return escAttr(v);
    if (filter) throw new Error(`filtro desconhecido: ${filter}`);
    return v;
  });
  const left = html.match(/\{\{[^}]*\}\}/);
  if (left) throw new Error(`${page.id} em ${locale.code}: sobrou ${left[0]}`);
  return html;
}

// Every page of every ready language: { file, page, locale, html() }.
export function pageEntries(root = ROOT, origin = ORIGIN) {
  const locales = readyLocales(root);
  const catalogs = new Map(locales.map(l => [l.code, loadCatalog(l.code, 'site', root)]));
  return locales.flatMap(locale => PAGES.map(page => ({
    file: outFile(locale, page),
    page,
    locale,
    html: () => {
      const messages = catalogs.get(locale.code);
      if (!messages) throw new Error(`falta i18n/${locale.code}/site.json`);
      return renderPage({ template: fs.readFileSync(path.join(root, page.template), 'utf8'), page, locale, locales, messages, catalogs, origin, root });
    },
  })));
}
