// Postgres, a community plugin from the store, used in the site's demo. The saved queries are a list and the last
// result sits right below it, so the cursor stays where it was: ↵ runs only the query under the cursor, `. e`
// rewrites its SQL in the prompt, ⇥ shows the tables. Same grammar as every v4 plugin.
import { fromManifest, registerFn, h, row, note } from '../v4/engine.mjs';

const PROJECTS = [['proj_01', 'cadente', 4], ['proj_02', 'warp', 1], ['proj_03', 'nora', 0]];
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
  q5: () => ({ cols: ['dia', 'tokens'], rows: [['28/10', '412.880'], ['29/10', '388.204'], ['30/10', '97.315']] }),
  q6: () => ({ cols: ['tabela', 'tamanho'], rows: [['pedidos', '1,1 MB'], ['usuarios', '312 KB'], ['sessoes', '48 KB']] }),
  q7: () => ({ cols: ['servico', 'deploys'], rows: [['api', '6'], ['site', '3'], ['worker', '2']] }),
  q8: () => ({ cols: ['pid', 'tabela', 'modo'], rows: [] }),
};

// psql's aligned output: header, rule and rows padded to the widest cell.
function table({ cols, rows }) {
  const w = cols.map((c, i) => Math.max(c.length, ...rows.map(r => r[i].length)));
  const line = cells => ` ${cells.map((c, i) => c.padEnd(w[i])).join(' | ')}`;
  return [line(cols), `-${w.map(n => '-'.repeat(n)).join('-+-')}-`, ...rows.map(line)];
}

export const banco = fromManifest({
  id: 'banco', title: 'Postgres', short: 'SQL', glyph: '⛁', community: true, author: 'leo',
  keywords: 'postgres banco database sql consultas select tabelas',
  hint: '↵ executa só esta · . e reescreve o SQL · ⇥ tabelas',
  init: () => ({ last: null }),
  view(leaf, S) {
    if (leaf.data.view !== 'consultas') return null;
    const qs = S.store.queries, r = leaf.data.last;
    const lines = [h('consultas salvas', String(qs.length)),
      ...qs.map(q => row(`queries:${q.id}`, r?.id === q.id ? '●' : '▶', q.name, q.sql, r?.id === q.id ? 'ok' : null, { ref: { list: 'queries', id: q.id } }))];
    if (leaf.data.busy) lines.push({ t: 'hr' }, note(`${leaf.data.busy.label}…`, 'accent', '◌'));
    else if (r) lines.push({ t: 'hr' }, { t: 'blk', cmd: r.sql, meta: `${r.rows.length} ${r.rows.length === 1 ? 'linha' : 'linhas'} · ${r.ms} ms`, ok: true,
      out: [...table(r), { text: `(${r.rows.length} ${r.rows.length === 1 ? 'linha' : 'linhas'})`, tone: 'dim' }] });
    else lines.push({ t: 'hr' }, note('↵ numa consulta executa só ela', 'dim'));
    return { lines, subject: r?.name };
  },
  signal: leaf => (leaf.data.busy ? 'executando' : leaf.data.last ? `${leaf.data.last.rows.length} linhas` : 'local'),
});

registerFn({
  dbRun(S, leaf, { item }) {
    leaf.data.busy = { label: `executando ${item.name}`, then: { op: 'fn', name: 'dbDone', id: item.id } };
    return {};
  },
  dbDone(S, leaf, ctx, op) {
    const q = S.store.queries.find(x => x.id === op.id);
    if (!q) return {};
    leaf.data.last = { id: q.id, name: q.name, sql: q.sql, ms: 3 + (q.sql.length % 5), ...(RESULTS[q.id]?.(q.sql) ?? { cols: ['?column?'], rows: [] }) };
    return { ctx: { subject: q.name } };
  },
});
