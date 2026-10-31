// The plugin store in a pane, for the site's demo: the graphic look of a store (cards, thumbnails, screenshots)
// drawn with the terminal grammar of the Cadente (mono text, one cursor, the keyboard for everything).
// Typing searches, ↑↓ walk the cards and ↵ opens the plugin's page: its README with screenshots (← → flip them),
// what it does, its shortcuts and what it asks to access. ↵ on "instalar" downloads it, checks the signature and
// the same pane opens the new plugin.
import { fromManifest, registerFn } from '../v4/engine.mjs';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const item = (S, id) => S.store.shop.find(x => x.id === id);
const back = { data: { mode: null, view: 'descobrir', pick: null, shot: 0, log: null }, cursor: 0 };
const free = x => /grátis/.test(x.label);
// The package id shown by the install, as the author publishes it: @leo's Postgres is leo.postgres.
const slug = x => `${x.author}.${x.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
// Each plugin gets its own shade of the site's purple, so the cards differ without leaving the palette.
const hue = x => [...x.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
const thumb = (x, big) => `<div class="sh-thumb sh-h${hue(x)}${big ? ' big' : ''}"><b>${esc(x.glyph)}</b></div>`;

// ── Screenshots: small mock-ups of each plugin at work ─────────────────
const win = (body, title) => `<div class="mk"><div class="mk-bar"><i></i><i></i><i></i><span>${esc(title)}</span></div>${body}</div>`;
const sql = l => esc(l).replace(/\b(select|from|where|order|by|limit|desc|count)\b/g, '<b>$1</b>');
const dbShot = (side, code, grid) => win(`<div class="mk-db"><div class="mk-side">${side.map(t => `<span>${esc(t)}</span>`).join('')}</div><div class="mk-main"><div class="mk-code">${code.map((l, i) => `<span${l[0] ? ' class="on"' : ''}><i>${i + 1}</i>${sql(l[1])}</span>`).join('')}</div>`
  + `<table>${grid.map((r, i) => `<tr>${r.map(c => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>`).join('')}</table></div></div>`, 'Postgres · consultas.sql');
const box = (x, y, w, h, t, round) => `${round ? `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`}<text x="${x + w / 2}" y="${y + h / 2 + 4}">${esc(t)}</text>`;
const drawShot = shapes => win(`<svg class="mk-draw" viewBox="0 0 300 150">${shapes}</svg>`, 'Quadro · diagrama');
const SHOTS = {
  banco: [
    ['o script e o resultado, lado a lado', dbShot(['▾ cadente', '  ▾ public', '    ▦ projetos', '    ▦ usuarios', '    ▦ sessoes'], [[0, '-- projetos'], [1, 'select id, nome, paineis'], [1, 'from projetos'], [1, 'order by paineis desc;'], [0, ''], [0, '-- sessões por agente']], [['id', 'nome', 'paineis'], ['proj_01', 'cadente', '4'], ['proj_02', 'mapa', '1'], ['proj_03', 'vitrine', '0']])],
    ['as tabelas no navegador', dbShot(['▾ cadente', '  ▾ public', '    ▦ projetos', '  ❯ ▦ sessoes', '    ▦ pedidos'], [[0, 'select *'], [0, 'from sessoes'], [0, 'limit 200;']], [['id', 'agente', 'projeto'], ['901', 'claude', 'cadente'], ['902', 'codex', 'cadente'], ['903', 'agy', 'mapa']])],
    ['⌘↵ roda só o select do cursor', dbShot(['▾ cadente', '  ▾ public', '    ▦ turnos'], [[0, '-- usuários ativos hoje'], [1, 'select count(*)'], [1, 'from usuarios;']], [['count'], ['128']])],
  ],
  draw: [
    ['um diagrama em segundos', drawShot(`${box(14, 52, 74, 40, 'app web')}${box(114, 52, 74, 40, 'API')}${box(214, 50, 74, 44, 'Postgres', true)}<path d="M90 72 L110 72 M104 67 L110 72 L104 77 M190 72 L210 72 M204 67 L210 72 L204 77"/>`)],
    ['setas que seguem as formas', drawShot(`${box(30, 20, 90, 40, 'ideia')}${box(170, 20, 100, 40, 'protótipo')}${box(100, 96, 100, 40, 'lançamento', true)}<path d="M122 40 L166 40 M160 35 L166 40 L160 45 M220 62 L180 94 M182 86 L180 94 L188 92"/>`)],
  ],
};
const generic = x => [[`${x.name} numa folha`, win(`<div class="mk-gen">${thumb(x)}<div>${[78, 92, 64, 84, 50].map(w => `<i style="width:${w}%"></i>`).join('')}</div></div>`, x.name)]];
const shotsOf = x => SHOTS[x.plugin] ?? generic(x);

// ── README: a tiny markdown, cut into sections the cursor can walk ─────
const inline = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>');
function readme(x) {
  const md = x.readme ?? [x.desc, '## Permissões', ...(x.perms.length ? x.perms.map(p => `- ${p}`) : ['- nada além do Core'])];
  const parts = [{ title: 'Sobre', lines: [] }];
  for (const l of md) l.startsWith('## ') ? parts.push({ title: l.slice(3), lines: [] }) : parts.at(-1).lines.push(l);
  if (x.readme) parts.push({ title: 'Pede acesso a', lines: x.perms.length ? x.perms.map(p => `- ${p}`) : ['- nada além do Core'] });
  return parts.map(p => {
    let html = '', list = '', table = '';
    const flush = () => { if (list) html += `<ul>${list}</ul>`; if (table) html += `<table>${table}</table>`; list = table = ''; };
    for (const l of p.lines) {
      if (l.startsWith('- ')) { if (table) flush(); list += `<li>${inline(l.slice(2))}</li>`; }
      else if (l.startsWith('|')) { if (list) flush(); table += `<tr>${l.split('|').slice(1, -1).map(c => `<td>${inline(c.trim())}</td>`).join('')}</tr>`; }
      else { flush(); html += `<p>${inline(l)}</p>`; }
    }
    flush();
    return { title: p.title, html };
  });
}

function storefront(leaf, S) {
  const d = leaf.data, inp = leaf.input, typing = !inp.text.startsWith('/');
  const q = typing ? inp.text.toLowerCase() : '';
  let xs = S.store.shop.filter(x => d.view !== 'instalados' || x.installed);
  if (q) xs = xs.filter(x => `${x.name} ${x.author} ${x.desc} ${x.cat}`.toLowerCase().includes(q));
  const focused = S.tabs.find(t => t.id === S.active)?.focus === leaf.id;
  const field = inp.text && typing ? `${esc(inp.text.slice(0, inp.caret))}<b class="cur">${esc(inp.text[inp.caret] ?? ' ')}</b>${esc(inp.text.slice(inp.caret + 1))}` : `${focused ? '<b class="cur"> </b>' : ''}<span class="dim">buscar plugins</span>`;
  const cats = [...new Set(S.store.shop.map(x => x.cat))];
  const lines = [{ t: 'tui', html: `<div class="sh-hero"><p class="sh-kick">✦ loja da comunidade</p><p class="sh-title">Feitos pela comunidade.<br/><span>Todos grátis para instalar.</span></p>`
    + `<p class="sh-search"><i>›</i>${field}</p><p class="sh-cats">${cats.map(c => `<span>${esc(c)}</span>`).join('')}</p></div>` }];
  let cat = null;
  for (const x of xs) {
    if (x.cat !== cat) lines.push({ t: 'tui', html: `<div class="sh-sec">${esc(cat = x.cat)}<span>${xs.filter(y => y.cat === cat).length}</span></div>` });
    lines.push({ t: 'tui', id: `shop:${x.id}`, ref: { list: 'shop', id: x.id }, html: `<div class="sh-card${x.installed ? ' done' : ''}">${thumb(x)}<div class="sh-body"><b>${esc(x.name)}</b><i>@${esc(x.author)}</i><p>${esc(x.desc)}</p>`
      + `<span class="sh-foot"><em class="${free(x) ? 'free' : ''}">${x.installed ? '✓ instalado' : esc(x.label)}</em>v${esc(x.version)}</span></div></div>` });
  }
  if (!xs.length) lines.push({ t: 'tui', html: `<div class="sh-sec">${q ? `nada com “${esc(inp.text)}” ainda · que tal criar o seu?` : 'nada da loja instalado ainda'}</div>` });
  return { lines, status: q ? `${xs.length} de ${S.store.shop.length}` : undefined };
}

function page(leaf, S) {
  const d = leaf.data, x = item(S, d.pick);
  if (!x) return { lines: [{ t: 'tui', html: '<div class="sh-sec">plugin removido da loja</div>' }] };
  const shots = shotsOf(x), at = Math.min(d.shot ?? 0, shots.length - 1), busy = d.busy;
  const button = busy ? `<span class="pg-btn busy"><i class="wb-load"></i>${esc(busy.label)}</span>` : x.installed ? '<span class="pg-btn">▶ abrir nesta folha</span>' : `<span class="pg-btn">↓ instalar · ${esc(x.label)}</span>`;
  const log = d.log?.length ? `<div class="pg-log"><div><b>$ cadente plugin install ${esc(slug(x))}</b></div>${d.log.map(t => `<div${t.startsWith('✓') ? ' class="ok"' : ''}>${esc(t)}</div>`).join('')}</div>` : '';
  const lines = [
    { t: 'tui', id: 'loja:go', kind: 'install', html: `<div class="pg-top"><div class="pg-head">${thumb(x, true)}<div class="pg-id"><b>${esc(x.name)}</b><i>@${esc(x.author)} · v${esc(x.version)} · ${esc(x.size)} · código aberto · assinado</i></div>${button}</div>${log}</div>` },
    { t: 'tui', id: 'loja:shots', kind: 'shots', html: `<div class="pg-shots"><div class="pg-track" style="transform:translateX(-${at * 100}%)">${shots.map(([, art]) => `<div class="pg-shot">${art}</div>`).join('')}</div>`
      + `<p class="pg-cap"><span>${shots.map((s, i) => `<i class="${i === at ? 'on' : ''}"></i>`).join('')}</span>${esc(shots[at][0])}<em>${at + 1}/${shots.length} · ← →</em></p></div>` },
    ...readme(x).map((s, i) => ({ t: 'tui', id: `loja:doc:${i}`, kind: 'doc', html: `<section class="pg-doc"><h4>${esc(s.title)}</h4>${s.html}</section>` })),
    { t: 'tui', id: 'loja:back', kind: 'back', html: '<div class="pg-back">← voltar à loja <span>esc</span></div>' },
  ];
  return { subject: x.name, lines };
}

const base = fromManifest({
  id: 'loja', title: 'Loja', short: 'LOJA', glyph: '✦', store: true,
  keywords: 'loja store plugins comunidade instalar baixar descobrir',
  hint: 'digite para buscar · ↵ abre a página · ← → fotos · ↵ instala',
  init: () => ({ mode: null, pick: null, shot: 0 }),
  view: (leaf, S) => (leaf.data.view === 'plugin' ? page(leaf, S) : storefront(leaf, S)),
  keys: leaf => (leaf.data.mode === 'detail' ? ['ArrowLeft', 'ArrowRight'] : []),
  key(leaf, key, line, S) {
    const x = item(S, leaf.data.pick), n = x ? shotsOf(x).length : 1;
    if (key === 'ArrowLeft' || key === 'ArrowRight') return { data: { shot: (leaf.data.shot + (key === 'ArrowLeft' ? -1 : 1) + n) % n } };
    return null;
  },
  activate(leaf, line, S) {
    if (line.kind === 'back') return back;
    if (line.kind === 'shots') return base.key(leaf, 'ArrowRight', line, S);
    if (line.kind !== 'install') return null;
    const x = item(S, leaf.data.pick);
    if (!x || leaf.data.busy) return null;
    if (x.installed) return x.plugin ? { actions: [{ type: 'OPEN', pane: leaf.id, plugin: x.plugin }] } : { toast: `${x.name} já está instalado` };
    leaf.data.busy = { label: `baixando · ${x.size}`, then: { op: 'fn', name: 'lojaCheck', id: x.id } };
    leaf.data.log = [`↓ baixando ${x.name} ${x.version} · ${x.size}`];
    return {};
  },
  escape: leaf => (leaf.data.mode === 'detail' ? back : null),
  signal: leaf => (leaf.data.busy ? 'instalando' : leaf.data.mode === 'detail' ? 'página do plugin' : 'comunidade'),
});
export const loja = base;

registerFn({
  lojaOpen: (S, leaf, { item: x }) => ({ data: { mode: 'detail', view: 'plugin', pick: x.id, shot: 0, log: null }, cursor: 0 }),
  lojaCheck(S, leaf, ctx, op) {
    const x = item(S, op.id);
    leaf.data.busy = { label: 'conferindo a assinatura', then: { op: 'fn', name: 'lojaDone', id: op.id } };
    leaf.data.log = [...leaf.data.log, '✓ sha256 confere', `… conferindo a assinatura de @${x.author}`];
    return {};
  },
  lojaDone(S, leaf, ctx, op) {
    const x = item(S, op.id);
    Object.assign(x, { installed: true });
    const toast = `${x.name} da @${x.author} instalado`;
    return x.plugin ? { toast, actions: [{ type: 'OPEN', pane: leaf.id, plugin: x.plugin }] } : { toast, ...back };
  },
});
