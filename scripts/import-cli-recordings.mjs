#!/usr/bin/env node
// Turns screen recordings of the real agent CLIs into js/v4-site/recordings.json, played by the site's Terminal.
// The recordings come from scripts/capture-cli.py: snapshots of every cell (character, colour, attributes) while
// the CLI did a real task in a throwaway repository. This script only cleans them for a public page:
// - the temporary folder becomes ~/dev/cadente, and account e-mails and private tool names are removed;
// - agy's first screens drop the one-time "trust this folder" dialog left above its banner.
// When a recording has no permission step (Claude Code could not sign in from a background terminal), the missing
// screens are composed from that CLI's own recorded lines, colours and glyphs; record again to replace them.
// Usage: node scripts/import-cli-recordings.mjs [dir with claude.json, codex.json, agy.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2] ?? '/tmp/clicap';
const SWAPS = [
  [/\/private\/tmp\/cadente-demo/g, '~/dev/cadente'], [/\/tmp\/cadente-demo/g, '~/dev/cadente'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, 'voce@exemplo.com'], [/API Usage Billing/g, 'Claude Max'],
  [/RTK\.md/g, 'AGENTS.md'], [/`rtk\s*$/g, '`cargo '], [/^(\s+)cargo test` \(p\)/g, '$1test` (p)'], [/\brtk /g, ''],
];
const clean = t => SWAPS.reduce((s, [a, b]) => s.replace(a, b), t);
// The tasks typed during the recordings (scripts/cli-scripts), used to find each CLI's prompt.
const TASKS = { claude: 'adicione um teste', codex: 'rode cargo test', agy: 'explique em uma frase' };
const KIND = { welcome: 'welcome', typed: 'typed', work: 'work', ask: 'ask', after: 'after', done: 'done', end: 'done', tail: 'done' };

function load(name) {
  const file = path.join(dir, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
  // Rows as plain run lists [text, fg, bg, bold, italics, underscore, reverse], cleaned.
  // A private command prefix printed in a run of its own goes away with the space after it.
  for (const s of rec.snaps) s.rows = s.rows.map(row => row.map(([t, ...st]) => [t, ...st]).map((r, i, rs) => {
    if (r[0] === 'rtk') { if (rs[i + 1]?.[0].startsWith(' ')) rs[i + 1][0] = rs[i + 1][0].slice(1); return ['', ...r.slice(1)]; }
    return [clean(r[0]), ...r.slice(1)];
  }));
  if (name === 'agy') for (const s of rec.snaps) {
    const at = s.rows.findIndex(r => r.some(([t]) => /Antigravity CLI \d/.test(t)));
    if (at > 1) s.rows = [...s.rows.slice(at - 1), ...Array.from({ length: at - 1 }, () => [[' '.repeat(rec.cols), 'default', 'default', false, false, false, false]])];
  }
  return rec;
}

// Claude Code without a permission step: compose work, ask, after and done screens from its own recorded lines.
function composeClaude(rec) {
  const typed = rec.snaps.find(s => s.label === 'typed'), echo = rec.snaps.find(s => s.label.startsWith('work'));
  const blank = () => [[' ', 'default', 'default', false, false, false, false]];
  const run = (t, fg = 'default', bg = 'default', bold = false) => [t, fg, bg, bold, false, false, false];
  const header = typed.rows.slice(0, 4), you = echo.rows.slice(6, 8), foot = echo.rows.slice(18, 22);
  const ORANGE = 'd77757', GREY = '999999', OK = '4eba65', PERM = 'b1b9f9', ADD = '225c2b';
  const read = [[run('⏺ ', OK), run('Read', 'default', 'default', true), run('(crates/cadente-ui/src/layout.rs)')], [run('  ⎿  ', GREY), run('Read 34 lines', GREY)]];
  const update = done => [[run('⏺ ', done ? OK : GREY), run('Update', 'default', 'default', true), run('(crates/cadente-ui/src/layout.rs)')]];
  const spin = (g, s) => [[run(`${g} `, ORANGE), run('Pondering… ', ORANGE), run(`(${s}s · esc to interrupt)`, GREY)]];
  const diff = [[run('     35 ', GREY), run('+#[cfg(test)]', 'default', ADD)], [run('     36 ', GREY), run('+mod tests {', 'default', ADD)], [run('     37 ', GREY), run('+    use super::*;', 'default', ADD)]];
  const screen = (body, bottom = foot) => {
    const rows = [blank(), ...header.slice(1), blank(), ...you, blank(), ...body];
    while (rows.length < rec.rows - bottom.length) rows.push(blank());
    return [...rows.slice(0, rec.rows - bottom.length), ...bottom];
  };
  const ask = [[run('─'.repeat(rec.cols), PERM)], [run(' Edit file', PERM, 'default', true)], [run(' crates/cadente-ui/src/layout.rs', GREY)], ...diff,
    [run(' Do you want to make this edit to ', 'default'), run('layout.rs', 'default', 'default', true), run('?')],
    [run(' ❯ 1. Yes', PERM)], [run('   2. Yes, allow all edits during this session ', 'default'), run('(shift+tab)', GREY)], [run('   3. No, and tell Claude what to do differently ', 'default'), run('(esc)', GREY)]];
  const answer = 'Adicionei o teste focus_neighbor_vai_para_a_direita no fim de layout.rs: duas folhas lado a lado, e o foco sai da esquerda para a direita.';
  const words = answer.split(' '), wrapped = [''];
  for (const w of words) { if ((wrapped.at(-1) + w).length > rec.cols - 4) wrapped.push(''); wrapped[wrapped.length - 1] += `${w} `; }
  const reply = wrapped.map((l, i) => [run(i ? '  ' : '⏺ ', 'default'), run(l.trimEnd())]);
  const t0 = typed.t;
  const snap = (label, t, rows) => ({ label, t, rows });
  return [
    ...rec.snaps.filter(s => ['welcome', 'typed'].includes(s.label)),
    snap('work.0', t0 + 1, screen(spin('✻', 1))),
    snap('work.1', t0 + 3, screen(spin('✽', 3))),
    snap('work.2', t0 + 5, screen([...read, blank(), ...spin('✢', 5)])),
    snap('work.3', t0 + 8, screen([...read, blank(), ...spin('✶', 8)])),
    snap('work.4', t0 + 11, screen([...read, blank(), ...update(false)])),
    snap('ask', t0 + 13, screen([...read, blank(), ...update(false)], ask)),
    snap('after.0', t0 + 14, screen([...read, blank(), ...update(true), [run('  ⎿  ', GREY), run('Updated layout.rs with 14 additions', GREY)], ...diff, blank(), ...spin('✻', 15)])),
    snap('after.1', t0 + 17, screen([...read, blank(), ...update(true), [run('  ⎿  ', GREY), run('Updated layout.rs with 14 additions', GREY)], blank(), ...spin('✽', 18)])),
    snap('done', t0 + 20, screen([...read, blank(), ...update(true), [run('  ⎿  ', GREY), run('Updated layout.rs with 14 additions', GREY)], blank(), ...reply, blank(), [run('✻ ', GREY), run('Brewed for 21s · done 10:52 AM', GREY)]])),
  ];
}

const out = {};
for (const name of ['claude', 'codex', 'agy']) {
  const rec = load(name);
  if (!rec) { console.warn(`skip ${name}: no recording`); continue; }
  const composed = name === 'claude' && !rec.snaps.some(s => /Do you want/.test(s.rows.flat().map(r => r[0]).join('')));
  const snaps = composed ? composeClaude(rec) : rec.snaps;
  const styles = [], styleKey = new Map(), lines = [], lineKey = new Map();
  const style = st => { const k = JSON.stringify(st); if (!styleKey.has(k)) { styleKey.set(k, styles.length); styles.push(st); } return styleKey.get(k); };
  const plain = st => st[1] === 'default' && !st[5];
  const line = runs => {
    const merged = [];
    for (const [text, ...st] of runs) {
      const si = style(st), last = merged.at(-1);
      if (last && last[1] === si) last[0] += text; else merged.push([text, si]);
    }
    while (merged.length && plain(styles[merged.at(-1)[1]]) && !merged.at(-1)[0].trim()) merged.pop();
    if (merged.length && plain(styles[merged.at(-1)[1]])) merged[merged.length - 1][0] = merged.at(-1)[0].trimEnd();
    const k = JSON.stringify(merged);
    if (!lineKey.has(k)) { lineKey.set(k, lines.length); lines.push(merged); }
    return lineKey.get(k);
  };
  const frames = [];
  for (const s of snaps) {
    const kind = KIND[s.label.split('.')[0]];
    if (!kind) continue;
    const rows = s.rows.map(line), prev = frames.at(-1);
    if (prev && prev.kind === kind && prev.rows.join() === rows.join()) continue;
    frames.push({ kind, t: s.t, rows });
  }
  // Where the prompt is typed: the row of the typed screen that starts the task, matched in the empty screen by
  // the prompt glyph in front of it.
  const welcome = snaps.find(s => s.label === 'welcome'), typed = snaps.find(s => s.label === 'typed');
  let input = null;
  const text = r => r.map(x => x[0]).join('');
  const ty = typed ? typed.rows.findIndex(r => text(r).includes(TASKS[name])) : -1;
  if (ty >= 0) {
    const col = text(typed.rows[ty]).indexOf(TASKS[name]), lead = text(typed.rows[ty]).slice(0, col);
    const row = welcome.rows.findIndex(r => text(r).startsWith(lead));
    if (row >= 0) input = { row, col };
  }
  out[name] = { cols: rec.cols, rows: rec.rows, composed, styles, lines, frames, input };
  console.log(`${name}: ${frames.length} frames${composed ? ' (work and permission screens composed)' : ''}, ${lines.length} distinct lines, input at ${JSON.stringify(input)}`);
}
const leaks = JSON.stringify(out).match(/[\w.+-]+@gmail\.com|jeancatarina|\/private\/tmp|\brtk\b/g);
if (leaks) throw new Error(`recordings still contain private text: ${[...new Set(leaks)].join(', ')}`);
fs.writeFileSync(path.join(root, 'js/v4-site/recordings.json'), `${JSON.stringify(out)}\n`);
