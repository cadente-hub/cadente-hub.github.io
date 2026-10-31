// Serves and builds the translated pages without writing them into the repository: each page of each ready
// language is a virtual HTML entry (root/en/index.html…) whose source comes from scripts/i18n/pages.mjs.
import path from 'node:path';
import { pageEntries, ORIGIN } from './pages.mjs';
import { ROOT } from './catalog.mjs';

// The rollup inputs for vite.config.js: one per page and language.
export function pageInputs(root = ROOT) {
  return Object.fromEntries(pageEntries(root).map(e => [`${e.locale.code}/${e.page.id}`, path.join(root, e.file)]));
}

export default function cadentePages({ root = ROOT, origin = ORIGIN } = {}) {
  const byPath = () => new Map(pageEntries(root, origin).map(e => [path.join(root, e.file), e]));
  let entries = new Map();
  return {
    name: 'cadente-pages',
    enforce: 'pre',
    buildStart() { entries = byPath(); },
    resolveId(id) {
      const abs = path.isAbsolute(id) ? id : path.join(root, id);
      return entries.has(abs) ? abs : null;
    },
    load(id) {
      return entries.get(id)?.html() ?? null;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '/').split('?')[0];
        // /en → /en/, like the static host does.
        const bare = byPath();
        if (!url.endsWith('/') && !path.extname(url) && bare.has(path.join(root, url.slice(1), 'index.html'))) {
          res.statusCode = 301; res.setHeader('Location', `${url}/`); return res.end();
        }
        const file = url.endsWith('/') ? `${url.slice(1)}index.html` : url.slice(1);
        const entry = bare.get(path.join(root, file));
        if (!entry) return next();
        try {
          const html = await server.transformIndexHtml(url, entry.html());
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (e) { next(e); }
      });
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(path.join(root, 'i18n')) || file.startsWith(path.join(root, 'pages'))) server.ws.send({ type: 'full-reload' });
    },
  };
}
