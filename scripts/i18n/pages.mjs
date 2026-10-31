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
];
// Pages that still exist only once, at the root.
const STATIC = { downloads: 'downloads.html', 'release-notes': 'release-notes.html', terms: 'terms-and-conditions.html', blog: 'blog/' };

export const outFile = (locale, page) => `${locale.path.slice(1)}${page.file}`;
export const pageUrl = (locale, page, origin = ORIGIN) => `${origin}${locale.path}${page.url}`;

const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// JSON inside <script>: nothing in it may close the tag or open a comment.
const scriptJson = v => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

function head(locale, page, locales, origin) {
  const alt = locales.map(l => `  <link rel="alternate" hreflang="${l.code}" href="${pageUrl(l, page, origin)}" />`);
  const source = locales.find(l => l.code === SOURCE);
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
export function renderPage({ template, page, locale, locales, messages, origin = ORIGIN, root = ROOT }) {
  const t = createT(messages, locale.intl);
  const href = id => {
    const own = PAGES.find(p => p.id === id);
    if (own) return `${locale.path}${own.url}`;
    if (STATIC[id]) return `/${STATIC[id]}`;
    throw new Error(`página desconhecida em @href: ${id}`);
  };
  const js = Object.fromEntries(Object.entries(messages).filter(([k]) => k.startsWith('js.')).map(([k, v]) => [k.slice(3), v]));
  const html = template.replace(/\{\{\s*(@?[\w.:-]+)\s*(?:\|\s*(\w+)\s*)?\}\}/g, (all, key, filter) => {
    let v;
    if (key === '@lang') v = locale.code;
    else if (key === '@dir') v = locale.dir;
    else if (key === '@base') v = locale.path;
    else if (key === '@head') v = head(locale, page, locales, origin);
    else if (key === '@brand') v = brand(root);
    else if (key === '@jsonld:faq') v = faqJsonLd(messages);
    else if (key === '@i18n') v = `<script type="application/json" id="i18n">${scriptJson({ locale: locale.code, intl: locale.intl, dir: locale.dir, base: locale.path, messages: js })}</script>`;
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
      return renderPage({ template: fs.readFileSync(path.join(root, page.template), 'utf8'), page, locale, locales, messages, origin, root });
    },
  })));
}
