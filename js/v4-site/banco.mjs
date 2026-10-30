// Postgres, a community plugin from the store, used in the site's demo. The database navigator is on the
// left, a .sql script with every saved query in the middle and the result grid below. ↑↓ walk the
// script, ⌘↵ runs the statement under the caret, End edits the line in place, ⇥ moves to the navigator, where ↵
// opens a table's data. Nothing goes through the prompt bar.
import { fromManifest, registerFn } from '../v4/engine.mjs';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const PROJECTS = [['proj_01', 'cadente', 4], ['proj_02', 'mapa', 1], ['proj_03', 'vitrine', 0]];
// Each saved query answers from its SQL, so a rewritten query gives a different result.
const RESULTS = {
  q1: () => ({ cols: ['count'], rows: [['128']] }),
  q2: sql => {
    const rows = [...PROJECTS];
    if (/order by paineis desc/i.test(sql)) rows.sort((a, b) => b[2] - a[2]);
    const limit = Number(sql.match(/limit (\d+)/i)?.[1] ?? rows.length);
    return { cols: ['id', 'nome', 'paineis'], rows: rows.slice(0, limit).map(r => r.map(String)) };
  },
  q3: () => ({ cols: ['agente', 'sessoes'], rows: [['claude', '41'], ['codex', '27'], ['agy', '12'], ['opencode', '9']] }),
  q4: () => ({ cols: ['id', 'status', 'erro'], rows: [] }),
  q5: () => ({ cols: ['dia', 'sum'], rows: [['2026-10-28', '412880'], ['2026-10-29', '388204'], ['2026-10-30', '97315']] }),
};
// The first rows of each table, for "open the data" in the navigator.
const DATA = {
  projetos: PROJECTS.map(([id, n, p], i) => [id, n, String(p), `2026-0${7 + i}-1${i} 09:3${i}`]),
  usuarios: [['1', 'ana@exemplo.com', '2026-10-30 10:41'], ['2', 'leo@exemplo.com', '2026-10-30 09:12'], ['3', 'kenji@exemplo.com', '2026-10-29 22:05'], ['4', 'sofia@exemplo.com', '2026-10-29 18:30']],
  sessoes: [['901', 'claude', 'cadente', '2026-10-30 10:02'], ['902', 'codex', 'cadente', '2026-10-30 10:03'], ['903', 'agy', 'mapa', '2026-10-30 10:05'], ['904', 'claude', 'vitrine', '2026-10-30 10:11'], ['905', 'opencode', 'cadente', '2026-10-30 10:20']],
  pedidos: [['7001', 'pago', '', '129,90'], ['7002', 'pago', '', '49,00'], ['7003', 'enviado', '', '310,00'], ['7004', 'pago', '', '18,50']],
  turnos: [['1', '901', '1840', '2026-10-30 10:02'], ['2', '901', '2210', '2026-10-30 10:04'], ['3', '902', '960', '2026-10-30 10:05']],
};

// The script: every saved query as a commented statement, as in a .sql file.
function script(S) {
  const out = [], qs = S.store.queries;
  qs.forEach((q, i) => {
    if (i) out.push({ q: qs[i - 1], k: -2, text: '' });
    out.push({ q, k: -1, text: `-- ${q.name}` });
    q.sql.split('\n').forEach((text, k) => out.push({ q, k, text }));
  });
  return out;
}
const KW = new Set(['select', 'from', 'where', 'and', 'or', 'not', 'order', 'by', 'group', 'limit', 'as', 'desc', 'asc', 'count', 'sum', 'date', 'now', 'interval', 'join', 'on', 'in', 'is', 'null']);
function hl(text) {
  if (text.startsWith('--')) return `<span class="c">${esc(text)}</span>`;
  return (text.match(/'[^']*'?|\d+|[a-z_][\w]*|\s+|./gi) ?? []).map(t =>
    t[0] === "'" ? `<span class="s">${esc(t)}</span>` : /^\d+$/.test(t) ? `<span class="n">${t}</span>` : KW.has(t.toLowerCase()) ? `<span class="k">${t}</span>` : esc(t)).join('');
}
const edit = at => ({ path: 'data.draft', label: `linha ${at + 1}`, then: { op: 'fn', name: 'dbLine', at } });
function writeLine(S, l, text) {
  if (!l || l.k === -2) return;
  if (l.k === -1) { l.q.name = text.replace(/^--\s?/, ''); return; }
  const lines = l.q.sql.split('\n');
  lines[l.k] = text;
  l.q.sql = lines.join('\n');
}
function grid(r) {
  if (!r) return '<div class="dbv-empty">⌘↵ executa a consulta onde está o cursor</div>';
  const head = `<tr><th></th>${r.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const body = r.rows.map((row, i) => `<tr><td class="no">${i + 1}</td>${row.map(c => `<td>${c ? esc(c) : '<i>[null]</i>'}</td>`).join('')}</tr>`).join('');
  return `<table>${head}${body}</table>${r.rows.length ? '' : '<div class="dbv-empty">nenhuma linha</div>'}`;
}

export const banco = fromManifest({
  id: 'banco', title: 'Postgres', short: 'SQL', glyph: '⛁', community: true, author: 'leo', cursorless: true,
  keywords: 'postgres banco database sql consultas select tabelas',
  hint: '⌘↵ executa · End edita a linha · ⇥ navegador',
  init: () => ({ at: 1, nav: 0, focus: 'sql', last: null }),
  view(leaf, S) {
    const d = leaf.data, lines = script(S), at = Math.min(d.at, lines.length - 1), here = lines[at], focused = S.tabs.find(t => t.id === S.active)?.focus === leaf.id;
    const editing = d.editing && d.edAt === at, inp = leaf.input;
    const code = lines.map((l, i) => {
      const cur = i === at && d.focus === 'sql';
      const text = cur && editing ? `${esc(inp.text.slice(0, inp.caret))}<b class="cur">${esc(inp.text[inp.caret] ?? ' ')}</b>${esc(inp.text.slice(inp.caret + 1))}` : `${hl(l.text)}${cur && focused ? '<b class="caret"></b>' : ''}`;
      return `<div class="cl${l.q === here.q && l.k !== -2 ? ' stmt' : ''}${cur ? ' on' : ''}"${cur ? ' data-at' : ''}><i>${i + 1}</i><span>${text || ' '}</span></div>`;
    }).join('');
    const tables = S.store.dbTables;
    const tree = tables.map((t, i) => `<div class="tr t3${d.focus === 'nav' && i === d.nav ? ' on' : ''}${d.last?.table === t.name ? ' open' : ''}"${d.focus === 'nav' && i === d.nav ? ' data-at' : ''}><b>▦</b>${esc(t.name)}<span>${t.rows}</span></div>`).join('');
    const r = d.last, col = editing ? inp.caret + 1 : here.text.length + 1;
    const res = d.busy ? `<div class="dbv-empty acc">${esc(d.busy.label)}…</div>` : grid(r);
    const html = `<div class="dbv" data-focus="${d.focus}">`
      + `<aside class="dbv-nav"><div class="dbv-h">Navegador</div><div class="dbv-tree" data-scrollbox><div class="tr">▾ <b>⛁</b>cadente<span>localhost:5432</span></div><div class="tr t1">▾ <b>▤</b>public</div><div class="tr t2">▾ Tabelas<span>${tables.length}</span></div>${tree}<div class="tr t2 dim">▸ Views</div><div class="tr t2 dim">▸ Funções</div></div></aside>`
      + `<section class="dbv-ed"><div class="dbv-tabs"><span class="on">consultas.sql</span><span>cadente@localhost</span></div><div class="dbv-code" data-scrollbox>${code}</div></section>`
      + `<section class="dbv-res"><div class="dbv-h">${r ? `<b>${esc(r.title)}</b><span>${r.rows.length} ${r.rows.length === 1 ? 'linha' : 'linhas'} · ${r.ms} ms</span>` : 'Resultado'}</div><div class="dbv-grid">${res}</div></section>`
      + `<footer class="dbv-st"><span>Postgres 16 · public · L${at + 1}:C${col}${editing ? ' · editando' : ''}</span><span>${editing ? '⌘↵ grava e executa · esc descarta' : d.focus === 'nav' ? '↵ abre os dados · ⇥ volta ao script' : '⌘↵ executa · End edita · ⇥ navegador'}</span></footer></div>`;
    return { subject: d.focus === 'nav' ? tables[d.nav]?.name : here.q.name, lines: [{ t: 'tui', html }] };
  },
  keys: () => ['ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'End', '⌘↵'],
  key(leaf, key, item, S) {
    const d = leaf.data, lines = script(S);
    if (key === 'Tab') return { data: { focus: d.focus === 'nav' ? 'sql' : 'nav' } };
    if (d.focus === 'nav') {
      const n = S.store.dbTables.length;
      if (key === 'ArrowUp' || key === 'ArrowDown') return { data: { nav: Math.max(0, Math.min(n - 1, d.nav + (key === 'ArrowUp' ? -1 : 1))) } };
      if (key === 'Enter' || key === '⌘↵') {
        const t = S.store.dbTables[d.nav];
        d.busy = { label: `abrindo ${t.name}`, then: { op: 'fn', name: 'dbDone', table: t.name } };
        return {};
      }
      return null;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') return { data: { at: Math.max(0, Math.min(lines.length - 1, d.at + (key === 'ArrowUp' ? -1 : 1))) } };
    if (key === 'End' || key === 'Enter') return { data: { editing: edit(d.at), edAt: d.at }, input: lines[d.at].text };
    if (key === '⌘↵') {
      const fx = {};
      if (d.editing) { writeLine(S, script(S)[d.edAt], leaf.input.text); Object.assign(fx, { data: { editing: null }, input: '' }); }
      const q = script(S)[d.at].q;
      d.busy = { label: `executando ${q.name}`, then: { op: 'fn', name: 'dbDone', id: q.id } };
      return fx;
    }
    return null;
  },
  signal: leaf => (leaf.data.busy ? 'executando' : leaf.data.last ? `${leaf.data.last.rows.length} linhas` : 'conectado'),
});

registerFn({
  dbLine(S, leaf, ctx, op) {
    writeLine(S, script(S)[op.at], leaf.data.draft);
    leaf.data.draft = null;
    return {};
  },
  dbDone(S, leaf, ctx, op) {
    if (op.table) {
      const t = S.store.dbTables.find(x => x.name === op.table);
      leaf.data.last = { title: `${t.name} · dados`, table: t.name, ms: 2, cols: t.cols, rows: DATA[t.name] ?? [] };
      return { ctx: { subject: t.name } };
    }
    const q = S.store.queries.find(x => x.id === op.id);
    if (!q) return {};
    leaf.data.last = { title: q.name, id: q.id, ms: 3 + (q.sql.length % 5), ...(RESULTS[q.id]?.(q.sql) ?? { cols: ['?column?'], rows: [] }) };
    return { ctx: { subject: q.name } };
  },
});
