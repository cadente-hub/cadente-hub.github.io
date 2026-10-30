// Navegador, a community plugin used in the site's demo: a web page inside a pane, driven by the keyboard.
// ⌘L edits the address in place, ↵ loads it, ↑↓ walk the links of the page, ↵ follows one and ⌫ goes back.
// The pages are small mock-ups: the app being built at localhost:5173 and the Cadente blog.
import { fromManifest, registerFn } from '../v4/engine.mjs';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const PROJECTS = [['cadente', 4, 'o hub de tudo'], ['mapa', 1, 'mapa de calor dos cliques'], ['vitrine', 0, 'criado agora pelo POST']];
const PAGES = {
  '': { title: 'Nova página', blocks: [{ t: 'h1', text: 'Para onde?' }, { t: 'p', text: '⌘L e digite um endereço, ou escolha um daqui.' },
    { t: 'a', text: 'localhost:5173', href: 'localhost:5173', meta: 'o app que você está fazendo' }, { t: 'a', text: 'cadente-hub.github.io/blog', href: 'cadente-hub.github.io/blog', meta: 'blog do Cadente' }] },
  'localhost:5173': { title: 'painel · projetos', brand: 'painel', blocks: [{ t: 'h1', text: 'Projetos' }, { t: 'p', text: '3 projetos · lidos de GET /v1/projects' },
    ...PROJECTS.map(([n, p, d]) => ({ t: 'card', text: n, href: `localhost:5173/projetos/${n}`, meta: `${p} ${p === 1 ? 'painel' : 'painéis'} · ${d}` }))] },
  'cadente-hub.github.io/blog': { title: 'Blog do Cadente', brand: 'cadente', blocks: [{ t: 'h1', text: 'Blog' }, { t: 'p', text: 'Notas de produto, engenharia e ideias para trabalhar melhor.' },
    { t: 'card', text: 'Bem-vindo ao blog do Cadente', href: 'cadente-hub.github.io/blog/bem-vindo', meta: '12 de setembro de 2026 · Equipe Cadente' }] },
  'cadente-hub.github.io/blog/bem-vindo': { title: 'Bem-vindo ao blog do Cadente', brand: 'cadente', blocks: [{ t: 'h1', text: 'Bem-vindo ao blog do Cadente' },
    { t: 'p', text: 'Este é o espaço onde vamos registrar o que estamos construindo e as decisões que orientam o produto.' },
    { t: 'p', text: 'O Cadente reúne conversas, código, terminal, Git e ferramentas de foco numa experiência nativa.' }, { t: 'a', text: '← voltar ao blog', href: 'cadente-hub.github.io/blog' }] },
};
for (const [n, p, d] of PROJECTS) PAGES[`localhost:5173/projetos/${n}`] = { title: `projeto ${n}`, brand: 'painel', blocks: [{ t: 'h1', text: n }, { t: 'p', text: d },
  { t: 'p', text: `${p} ${p === 1 ? 'painel' : 'painéis'} · id proj_0${PROJECTS.findIndex(x => x[0] === n) + 1}` }, { t: 'a', text: '← todos os projetos', href: 'localhost:5173' }] };
const page = url => PAGES[url] ?? { title: 'não encontrado', blocks: [{ t: 'h1', text: '404' }, { t: 'p', text: `Nada em ${url}.` }, { t: 'a', text: '← voltar', href: '' }] };
const linksOf = url => page(url).blocks.filter(b => b.href !== undefined);
const go = url => ({ op: 'fn', name: 'webLoad', url });

export const web = fromManifest({
  id: 'web', title: 'Navegador', short: 'WEB', glyph: '◍', community: true, author: 'orbita', cursorless: true,
  keywords: 'navegador browser site web página url internet',
  hint: '⌘L endereço · ↑↓ links · ↵ abre · ⌫ volta',
  init: () => ({ url: '', link: 0, back: [] }),
  view(leaf, S) {
    const d = leaf.data, p = page(d.url), inp = leaf.input, editing = !!d.editing;
    const address = editing ? `${esc(inp.text.slice(0, inp.caret))}<b class="cur">${esc(inp.text[inp.caret] ?? ' ')}</b>${esc(inp.text.slice(inp.caret + 1))}` : d.url ? `<span class="dim">https://</span>${esc(d.url)}` : '<span class="dim">digite um endereço</span>';
    let k = -1;
    const body = p.blocks.map(b => {
      if (b.href === undefined) return b.t === 'h1' ? `<h1>${esc(b.text)}</h1>` : `<p>${esc(b.text)}</p>`;
      const on = ++k === d.link && !editing && !d.busy;
      return `<div class="wb-${b.t}${on ? ' on' : ''}"${on ? ' data-at' : ''}><b>${esc(b.text)}</b>${b.meta ? `<span>${esc(b.meta)}</span>` : ''}</div>`;
    }).join('');
    const html = `<div class="wbv"><div class="wb-bar"><span class="wb-nav">‹ › ⟳</span><span class="wb-url${editing ? ' on' : ''}">${d.busy ? '<i class="wb-load"></i>' : '<span class="dim">⌕</span>'}${address}</span></div>`
      + `<div class="wb-page" data-scrollbox>${p.brand ? `<div class="wb-top"><b>${esc(p.brand)}</b><span>projetos · docs · conta</span></div>` : ''}<div class="wb-body">${body}</div></div>`
      + `<footer class="dbv-st"><span>${d.busy ? `carregando ${esc(d.busy.url)}…` : esc(p.title)}</span><span>${editing ? '↵ abre · esc cancela' : '⌘L endereço · ↑↓ links · ↵ abre · ⌫ volta'}</span></footer></div>`;
    return { subject: p.title, lines: [{ t: 'tui', html }] };
  },
  keys: () => ['ArrowUp', 'ArrowDown', 'Enter', 'Backspace', '⌘L'],
  key(leaf, key, item, S) {
    const d = leaf.data, ls = linksOf(d.url);
    if (key === '⌘L') return { data: { editing: { path: 'data.draft', label: 'endereço', then: { op: 'fn', name: 'webGo' } } }, input: d.url || '' };
    if (key === 'ArrowUp' || key === 'ArrowDown') return ls.length ? { data: { link: (d.link + (key === 'ArrowUp' ? -1 : 1) + ls.length) % ls.length } } : null;
    if (key === 'Enter' && ls[d.link]) { d.busy = { label: 'carregando', url: ls[d.link].href || 'nova página', then: go(ls[d.link].href) }; d.back = [...d.back, d.url]; return {}; }
    if (key === 'Backspace' && d.back.length) { const prev = d.back.at(-1); d.back = d.back.slice(0, -1); d.busy = { label: 'carregando', url: prev || 'nova página', then: go(prev) }; return {}; }
    return null;
  },
  signal: leaf => (leaf.data.busy ? 'carregando' : leaf.data.url ? 'https' : 'nova página'),
});

registerFn({
  webGo(S, leaf) {
    const url = String(leaf.data.draft ?? '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    leaf.data.draft = null;
    leaf.data.back = [...leaf.data.back, leaf.data.url];
    leaf.data.busy = { label: 'carregando', url, then: go(url) };
    return {};
  },
  webLoad(S, leaf, ctx, op) {
    Object.assign(leaf.data, { url: op.url, link: 0 });
    return { ctx: { subject: page(op.url).title } };
  },
});
