// Postgres, a community plugin from the store, used in the site's demo: saved queries in a list, and ↵ runs only
// the one under the cursor. Same grammar as every v4 plugin: ⇥ changes view, . opens the item's actions.
import { fromManifest, registerFn, note } from '../v4/engine.mjs';

const RESULTS = {
  q1: { cols: ['count'], rows: [['128']], ms: 6 },
  q2: { cols: ['id', 'nome', 'paineis'], rows: [['proj_01', 'cadente', '4'], ['proj_02', 'warp', '1'], ['proj_03', 'nora', '0']], ms: 4 },
  q3: { cols: ['agente', 'count'], rows: [['claude', '41'], ['codex', '27'], ['agy', '12'], ['opencode', '9']], ms: 5 },
  q4: { cols: ['id', 'status', 'erro'], rows: [], ms: 3 },
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
  hint: '↵ executa só esta · . ações · digite para filtrar',
  init: () => ({ last: null }),
  view(leaf) {
    if (leaf.data.view !== 'resultado') return null;
    const r = leaf.data.last;
    if (!r) return { lines: [note('nenhuma consulta executada ainda', 'dim'), note('↵ numa consulta executa só ela', 'dim')] };
    return { subject: r.name, status: `${r.rows.length} linhas · ${r.ms} ms`, lines: [{ t: 'blk', id: 'res', kind: 'res', cmd: r.sql, meta: `${r.ms} ms`, ok: true,
      out: [...table(r), { text: `(${r.rows.length} ${r.rows.length === 1 ? 'linha' : 'linhas'})`, tone: 'dim' }] }] };
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
    leaf.data.last = { name: q.name, sql: q.sql, ...(RESULTS[q.id] ?? { cols: ['?column?'], rows: [], ms: 2 }) };
    leaf.data.view = 'resultado';
    return { cursor: -1, ctx: { subject: q.name } };
  },
});
