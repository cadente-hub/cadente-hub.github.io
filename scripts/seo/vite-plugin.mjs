// Writes dist/sitemap.xml after the build, from the pages themselves: each page's canonical URL and its hreflang
// alternates come from the <head> that scripts/i18n/pages.mjs wrote, so the sitemap cannot disagree with the pages.
import fs from 'node:fs';
import path from 'node:path';

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const escXml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// One <url> per page with a canonical link, with its alternates. Pages marked noindex stay out.
export function sitemap(htmlPages) {
  const urls = new Map();
  for (const html of htmlPages) {
    if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) continue;
    const links = html.match(/<link\b[^>]*>/g) ?? [];
    const canonical = links.map(l => /rel="canonical"/.test(l) && attr(l, 'href')).find(Boolean);
    if (!canonical) continue;
    const alternates = links.filter(l => /rel="alternate"/.test(l) && attr(l, 'hreflang')).map(l => [attr(l, 'hreflang'), attr(l, 'href')]);
    urls.set(canonical, alternates);
  }
  const body = [...urls].sort(([a], [b]) => a.localeCompare(b)).map(([loc, alts]) => [
    '  <url>',
    `    <loc>${escXml(loc)}</loc>`,
    ...alts.map(([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${escXml(lang)}" href="${escXml(href)}" />`),
    '  </url>',
  ].join('\n')).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

export default function cadenteSitemap() {
  return {
    name: 'cadente-sitemap',
    apply: 'build',
    writeBundle(options, bundle) {
      const pages = Object.values(bundle).filter(f => f.type === 'asset' && f.fileName.endsWith('.html')).map(f => String(f.source));
      fs.writeFileSync(path.join(options.dir, 'sitemap.xml'), sitemap(pages));
    },
  };
}
