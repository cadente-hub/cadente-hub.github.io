import fs from 'node:fs';
import path from 'node:path';

import { buildFeed, escapeHtml, loadPosts, renderMarkdown } from './content.mjs';

const DEFAULT_ORIGIN = 'https://cadente-hub.github.io';

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function blogStyles(root) {
  const base = fs.readFileSync(path.resolve(root, 'css/style.css'), 'utf8');
  const blog = fs.readFileSync(path.resolve(root, 'css/blog.css'), 'utf8');
  return { base, blog };
}

function blogAssets(root) {
  return ['favicon-32.png', 'logo-symbol.svg'].map((fileName) => ({
    fileName,
    source: fs.readFileSync(path.resolve(root, 'assets', fileName)),
  }));
}

function pageShell({ title, description, canonical, body, rootClass = 'blog-page' }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeHtml(canonical);
  return `<!doctype html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} — Cadente</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${safeCanonical}">
  <meta property="og:title" content="${safeTitle} — Cadente">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${safeCanonical}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/blog-base.css">
  <link rel="stylesheet" href="/assets/blog.css">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
</head>
<body class="${rootClass}">
  <header class="navbar" id="navbar">
    <nav class="navbar__inner container" aria-label="Navegação principal">
      <a href="/" class="navbar__logo" aria-label="Cadente — início">
        <img class="blog-brand-mark" src="/assets/logo-symbol.svg" alt="" width="24" height="24">
        Cadente
      </a>
      <ul class="navbar__links">
        <li><a href="/#features">Recursos</a></li>
        <li><a href="/downloads.html">Downloads</a></li>
        <li><a href="/release-notes.html">Release notes</a></li>
        <li><a href="/blog/" class="active" aria-current="page">Blog</a></li>
      </ul>
      <a href="/downloads.html" class="btn btn--sm btn--primary navbar__cta">Baixar</a>
    </nav>
  </header>
  <main>${body}</main>
  <footer class="footer blog-footer">
    <div class="container footer__inner">
      <div class="footer__brand"><a href="/" class="footer__logo">Cadente</a><p class="footer__tagline">make a wish</p></div>
      <div class="footer__links">
        <div class="footer__col"><h4 class="footer__col-title">Produto</h4><a href="/#features">Recursos</a><a href="/downloads.html">Downloads</a><a href="/release-notes.html">Release notes</a></div>
        <div class="footer__col"><h4 class="footer__col-title">Recursos</h4><a href="/blog/">Blog</a><a href="https://github.com/cadente-hub/cadente-hub.github.io" rel="noopener noreferrer">GitHub</a></div>
      </div>
      <div class="footer__bottom"><p class="footer__copy">© 2026 Cadente. Todos os direitos reservados.</p><p class="footer__tech">Construído com Rust. Privacidade em primeiro lugar.</p></div>
    </div>
  </footer>
</body>
</html>`;
}

function renderIndex(posts, origin) {
  const cards = posts.filter((post) => !post.draft).map((post) => `
    <article class="blog-card">
      <div class="blog-card__meta"><time datetime="${escapeHtml(post.publishedAt)}">${escapeHtml(formatDate(post.publishedAt))}</time>${post.tags.length ? `<span aria-hidden="true">·</span><span>${escapeHtml(post.tags[0])}</span>` : ''}</div>
      <h2 class="blog-card__title"><a href="/blog/${escapeHtml(post.slug)}/">${escapeHtml(post.title)}</a></h2>
      <p class="blog-card__summary">${escapeHtml(post.summary)}</p>
      <a class="blog-card__link" href="/blog/${escapeHtml(post.slug)}/">Ler publicação <span aria-hidden="true">→</span></a>
    </article>`).join('');
  const body = `<section class="blog-hero"><div class="container blog-hero__inner"><p class="section-label">Diário do Cadente</p><h1 class="section-title">Ideias para <span class="gradient-text">trabalhar melhor</span></h1><p class="section-subtitle">Notas de produto, engenharia e práticas para usar IA com mais clareza, controle e velocidade.</p><a class="blog-feed-link" href="/blog/feed.json">Assinar feed JSON <span aria-hidden="true">↗</span></a></div></section>
  <section class="blog-index"><div class="container"><div class="blog-index__header"><p class="section-label">Publicações</p><p class="blog-index__count">${posts.filter((post) => !post.draft).length} publicação${posts.filter((post) => !post.draft).length === 1 ? '' : 'ões'}</p></div><div class="blog-grid">${cards || '<p class="blog-empty">Novas publicações em breve.</p>'}</div></div></section>`;
  return pageShell({ title: 'Blog', description: 'Notas de produto, engenharia e práticas do Cadente.', canonical: `${origin}/blog/`, body, rootClass: 'blog-page blog-index-page' });
}

function renderArticle(post, origin) {
  const canonical = `${origin}/blog/${post.slug}/`;
  const tags = post.tags.map((tag) => `<span class="blog-tag">${escapeHtml(tag)}</span>`).join('');
  const body = `<article class="blog-article container"><a class="blog-back" href="/blog/">← Todas as publicações</a><header class="blog-article__header"><div class="blog-card__meta"><time datetime="${escapeHtml(post.publishedAt)}">${escapeHtml(formatDate(post.publishedAt))}</time><span aria-hidden="true">·</span><span>${escapeHtml(post.author)}</span></div><h1>${escapeHtml(post.title)}</h1><p class="blog-article__summary">${escapeHtml(post.summary)}</p>${tags ? `<div class="blog-tags" aria-label="Tags">${tags}</div>` : ''}</header><div class="blog-article__body">${renderMarkdown(post.body)}</div><footer class="blog-article__footer"><span>Atualizado em ${escapeHtml(formatDate(post.updatedAt))}</span><a href="/blog/feed.json">Feed JSON ↗</a></footer></article>`;
  return pageShell({ title: post.title, description: post.summary, canonical, body, rootClass: 'blog-page blog-article-page' });
}

function emitAsset(pluginContext, fileName, source) {
  pluginContext.emitFile({ type: 'asset', fileName, source });
}

export function cadenteBlogPlugin({ contentDir, origin = DEFAULT_ORIGIN } = {}) {
  const siteOrigin = String(origin).replace(/\/+$/, '');
  const absoluteContentDir = path.resolve(contentDir || 'content/blog');
  let projectRoot = process.cwd();

  function currentPosts() {
    return loadPosts(absoluteContentDir);
  }

  function renderPath(requestPath) {
    const cleanPath = requestPath.split('?')[0].replace(/\/+$/, '/') || '/';
    const posts = currentPosts();
    if (cleanPath === '/blog/feed.json') {
      return { type: 'json', body: JSON.stringify(buildFeed(posts, siteOrigin), null, 2) };
    }
    if (cleanPath === '/blog/' || cleanPath === '/blog') {
      return { type: 'html', body: renderIndex(posts, siteOrigin) };
    }
    const match = cleanPath.match(/^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/);
    if (match) {
      const post = posts.find((candidate) => candidate.slug === match[1] && !candidate.draft);
      if (post) return { type: 'html', body: renderArticle(post, siteOrigin) };
    }
    return null;
  }

  return {
    name: 'cadente-blog',
    configResolved(config) {
      projectRoot = config.root;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestPath = (request.url || '/').split('?')[0];
        const devAssets = {
          '/assets/blog-base.css': { type: 'text/css; charset=utf-8', file: 'css/style.css' },
          '/assets/blog.css': { type: 'text/css; charset=utf-8', file: 'css/blog.css' },
          '/assets/favicon-32.png': { type: 'image/png', file: 'assets/favicon-32.png' },
          '/assets/logo-symbol.svg': { type: 'image/svg+xml', file: 'assets/logo-symbol.svg' },
        };
        const devAsset = Object.hasOwn(devAssets, requestPath) ? devAssets[requestPath] : null;
        if (devAsset) {
          response.statusCode = 200;
          response.setHeader('Content-Type', devAsset.type);
          response.end(fs.readFileSync(path.resolve(projectRoot, devAsset.file)));
          return;
        }
        const rendered = renderPath(request.url || '/');
        if (!rendered) return next();
        response.statusCode = 200;
        response.setHeader('Content-Type', rendered.type === 'json' ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8');
        response.end(rendered.body);
      });
    },
    generateBundle() {
      const posts = currentPosts();
      const styles = blogStyles(projectRoot);
      for (const asset of blogAssets(projectRoot)) {
        emitAsset(this, `assets/${asset.fileName}`, asset.source);
      }
      emitAsset(this, 'assets/blog-base.css', styles.base);
      emitAsset(this, 'assets/blog.css', styles.blog);
      emitAsset(this, 'blog/feed.json', JSON.stringify(buildFeed(posts, siteOrigin), null, 2));
      emitAsset(this, 'blog/index.html', renderIndex(posts, siteOrigin));
      for (const post of posts.filter((candidate) => !candidate.draft)) {
        emitAsset(this, `blog/${post.slug}/index.html`, renderArticle(post, siteOrigin));
      }
    },
  };
}

export default cadenteBlogPlugin;
