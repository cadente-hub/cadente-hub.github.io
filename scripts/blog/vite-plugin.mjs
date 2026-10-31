// The blog in each ready language. pt-BR posts live in content/blog/*.md and are served at /blog/<slug>/; a
// translation lives in content/blog/<code>/*.md, with the same slug, and is served at /blog/<code>/<slug>/. The
// launcher reads /blog/feed.json (pt-BR) and only opens links under /blog/, so both stay where they were; each other
// language gets its own /blog/<code>/feed.json.
import fs from 'node:fs';
import path from 'node:path';

import { buildFeed, escapeHtml, loadPosts, renderMarkdown } from './content.mjs';
import { readyLocales, loadCatalog } from '../i18n/catalog.mjs';
import { renderPage, blogBase } from '../i18n/pages.mjs';
import { createT } from '../../js/i18n-core.mjs';

const DEFAULT_ORIGIN = 'https://cadente-hub.github.io';

const postsDir = (contentDir, locale) => (locale.code === 'pt-BR' ? contentDir : path.join(contentDir, locale.code));
const formatDate = (value, intl) => new Intl.DateTimeFormat(intl, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value));

// Every file of the blog: { 'blog/index.html': { type, body }, 'blog/en/feed.json': … }.
export function blogFiles({ root, contentDir, origin = DEFAULT_ORIGIN }) {
  const locales = readyLocales(root);
  const template = fs.readFileSync(path.join(root, 'pages/blog.html'), 'utf8');
  const posts = new Map(locales.map(l => [l.code, loadPosts(postsDir(contentDir, l)).filter(p => !p.draft)]));
  for (const [code, list] of posts) for (const p of list) if (locales.some(l => l.code.toLowerCase() === p.slug)) throw new Error(`${code}: o slug ${p.slug} é igual a um código de idioma`);
  const withPost = slug => locales.filter(l => posts.get(l.code).some(p => p.slug === slug)).map(l => l.code);
  const files = {};
  for (const locale of locales) {
    const messages = loadCatalog(locale.code, 'site', root), t = createT(messages, locale.intl), base = blogBase(locale), list = posts.get(locale.code);
    const page = (id, pathOf, codes, vars) => renderPage({ template, page: { id, pathOf, locales: codes }, locale, locales, messages, origin, root, vars: { feed: `${base}feed.json`, ...vars } });
    const cards = list.map(p => `
      <article class="blog-card">
        <p class="blog-meta"><time datetime="${escapeHtml(p.publishedAt)}">${escapeHtml(formatDate(p.publishedAt, locale.intl))}</time>${p.tags[0] ? `<span aria-hidden="true">·</span><span>${escapeHtml(p.tags[0])}</span>` : ''}</p>
        <h2><a href="${base}${p.slug}/">${escapeHtml(p.title)}</a></h2>
        <p>${escapeHtml(p.summary)}</p>
        <a class="blog-card__more" href="${base}${p.slug}/">${escapeHtml(t('blog.read'))} →</a>
      </article>`).join('');
    const index = `
    <section class="page-hero">
      <div class="page-hero__glow" aria-hidden="true"></div>
      <div class="wrap">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span>${t('blog.eyebrow')}</p>
        <h1 class="title">${t('blog.title')}</h1>
        <p class="lede">${t('blog.lede')}</p>
        <a class="blog-feed" href="${base}feed.json">${t('blog.feed')} ↗</a>
      </div>
    </section>
    <section class="wrap blog-index">
      <p class="blog-count">${escapeHtml(t('blog.count', { count: list.length }))}</p>
      <div class="blog-grid">${cards || `<p class="blog-empty">${t('blog.empty')}</p>`}</div>
    </section>`;
    files[`${base.slice(1)}index.html`] = { type: 'html', body: page('blog', blogBase, locales.map(l => l.code), { title: escapeHtml(`${t('blog.metaTitle')} — Cadente`), description: escapeHtml(t('blog.metaDescription')), type: 'website', body: index }) };
    files[`${base.slice(1)}feed.json`] = { type: 'json', body: JSON.stringify(buildFeed(list, origin, base), null, 2) };
    for (const p of list) {
      const tags = p.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('');
      const body = `
    <article class="wrap blog-article">
      <a class="blog-back" href="${base}">← ${t('blog.back')}</a>
      <p class="blog-meta"><time datetime="${escapeHtml(p.publishedAt)}">${escapeHtml(formatDate(p.publishedAt, locale.intl))}</time><span aria-hidden="true">·</span><span>${escapeHtml(p.author)}</span></p>
      <h1>${escapeHtml(p.title)}</h1>
      <p class="blog-summary">${escapeHtml(p.summary)}</p>
      ${tags ? `<div class="blog-tags">${tags}</div>` : ''}
      <div class="blog-body">${renderMarkdown(p.body)}</div>
      <footer class="blog-foot"><span>${escapeHtml(t('blog.updated', { date: formatDate(p.updatedAt, locale.intl) }))}</span><a href="${base}feed.json">${t('blog.feed')} ↗</a></footer>
    </article>`;
      files[`${base.slice(1)}${p.slug}/index.html`] = { type: 'html', body: page(`blog-${p.slug}`, l => `${blogBase(l)}${p.slug}/`, withPost(p.slug), { title: escapeHtml(`${p.title} — Cadente`), description: escapeHtml(p.summary), type: 'article', body }) };
    }
  }
  return files;
}

// The site's styles, copied to fixed URLs because the blog pages are written outside Vite.
function blogAssets(root) {
  const read = f => fs.readFileSync(path.resolve(root, f));
  return {
    'assets/blog-base.css': { type: 'text/css; charset=utf-8', body: Buffer.concat([read('css/site.css'), Buffer.from('\n'), read('css/pages.css')]) },
    'assets/blog.css': { type: 'text/css; charset=utf-8', body: read('css/blog.css') },
    'assets/favicon-32.png': { type: 'image/png', body: read('assets/favicon-32.png') },
    'assets/logo-symbol.svg': { type: 'image/svg+xml', body: read('assets/logo-symbol.svg') },
  };
}

export function cadenteBlogPlugin({ contentDir, origin = DEFAULT_ORIGIN } = {}) {
  const siteOrigin = String(origin).replace(/\/+$/, '');
  const absoluteContentDir = path.resolve(contentDir || 'content/blog');
  let projectRoot = process.cwd();
  return {
    name: 'cadente-blog',
    configResolved(config) { projectRoot = config.root; },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        let file = (request.url || '/').split('?')[0].replace(/^\//, '');
        if (!file.startsWith('blog') && !file.startsWith('assets/blog') && !['assets/favicon-32.png', 'assets/logo-symbol.svg'].includes(file)) return next();
        if (file === 'blog') file = 'blog/';
        if (file.endsWith('/')) file += 'index.html';
        const asset = blogAssets(projectRoot)[file];
        const page = asset ? null : blogFiles({ root: projectRoot, contentDir: absoluteContentDir, origin: siteOrigin })[file];
        if (!asset && !page) return next();
        response.statusCode = 200;
        response.setHeader('Content-Type', asset ? asset.type : page.type === 'json' ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8');
        response.end(asset ? asset.body : page.body);
      });
    },
    generateBundle() {
      for (const [fileName, a] of Object.entries(blogAssets(projectRoot))) this.emitFile({ type: 'asset', fileName, source: a.body });
      for (const [fileName, f] of Object.entries(blogFiles({ root: projectRoot, contentDir: absoluteContentDir, origin: siteOrigin }))) this.emitFile({ type: 'asset', fileName, source: f.body });
    },
  };
}

export default cadenteBlogPlugin;
