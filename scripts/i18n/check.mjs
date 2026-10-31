// For whoever translates: lists what one language still lacks before it can be marked "ready".
//   site.json    every key of pt-BR, with the same {placeholders} and the same kind of value (text, list, plural)
//   demo.json    every text of demo-strings.json, with the same {0} placeholders
//   terms.html   the same HTML tags as the English original
//   blog         a translation of every pt-BR post, with the same slug
// Usage: node scripts/i18n/check.mjs <code>
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { ROOT, loadCatalog } from './catalog.mjs';
import { isPlural } from '../../js/i18n-core.mjs';

const code = process.argv[2];
if (!code) { console.error('usage: node scripts/i18n/check.mjs <code>'); process.exit(2); }
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const has = f => fs.existsSync(path.join(ROOT, f));
const problems = [];

const marks = v => [...new Set((typeof v === 'string' ? [v] : Array.isArray(v) ? v : Object.values(v)).flatMap(s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1])))].sort().join();
const kind = v => (Array.isArray(v) ? `list ${v.length}` : isPlural(v) ? 'plural' : 'text');
if (!has(`i18n/${code}/site.json`)) problems.push('site.json não existe');
else {
  let target;
  try { target = loadCatalog(code); } catch (e) { problems.push(`site.json inválido: ${e.message}`); }
  if (target) {
    const source = loadCatalog('pt-BR');
    for (const [k, v] of Object.entries(source)) {
      if (!Object.hasOwn(target, k)) { problems.push(`site: falta ${k}`); continue; }
      const w = target[k];
      if (kind(v) !== kind(w) && !(isPlural(v) || isPlural(w))) problems.push(`site: ${k} é ${kind(v)} no pt-BR e ${kind(w)} aqui`);
      else if (marks(v) !== marks(w)) problems.push(`site: ${k} tem {${marks(w)}} em vez de {${marks(v)}}`);
    }
    for (const k of Object.keys(target)) if (!Object.hasOwn(source, k)) problems.push(`site: sobra ${k}`);
  }
}

if (code !== 'pt-BR') {
  const strings = JSON.parse(read('i18n/demo-strings.json'));
  if (!has(`i18n/${code}/demo.json`)) problems.push('demo.json não existe');
  else {
    const dict = JSON.parse(read(`i18n/${code}/demo.json`)), ph = s => (s.match(/\{\d+\}/g) ?? []).sort().join();
    for (const s of strings) {
      if (!Object.hasOwn(dict, s)) problems.push(`demo: falta ${JSON.stringify(s)}`);
      else if (typeof dict[s] !== 'string' || !dict[s].trim()) problems.push(`demo: vazio ${JSON.stringify(s)}`);
      else if (ph(dict[s]) !== ph(s)) problems.push(`demo: placeholders em ${JSON.stringify(s)}`);
    }
  }
}

const tags = html => (html.match(/<[a-z0-9]+/gi) ?? []).join(' ');
if (!has(`i18n/${code}/terms.html`)) problems.push('terms.html não existe');
else if (tags(read(`i18n/${code}/terms.html`)) !== tags(read('i18n/en/terms.html'))) problems.push('terms.html: as tags não batem com i18n/en/terms.html');

if (code !== 'pt-BR') {
  const slugs = dir => (has(dir) ? fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.md')).map(f => matter(read(`${dir}/${f}`)).data.slug) : []);
  const mine = slugs(`content/blog/${code}`);
  for (const s of slugs('content/blog')) if (!mine.includes(s)) problems.push(`blog: falta content/blog/${code}/ com o slug ${s}`);
}

console.log(problems.length ? `${problems.slice(0, 80).join('\n')}\n${problems.length} problemas em ${code}` : `${code}: ok`);
process.exit(problems.length ? 1 : 0);
