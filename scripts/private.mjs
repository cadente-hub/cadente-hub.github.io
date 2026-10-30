#!/usr/bin/env node
// Private names (internal projects, private checkouts, personal handles) must never reach the public site.
// The names live only in private-names.json at the repo root, which git ignores:
//   { "replace": [["private", "public"], …], "forbid": ["word", …] }
// "replace" pairs are applied in order, whole words only, by scripts/sync-v4.mjs; "forbid" words fail the check.
// Usage: node scripts/private.mjs   checks every tracked text file and dist/, and exits 1 on a leak.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(root, 'private-names.json');
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole words: a name glued to other letters ("ignora") is a different word.
const word = s => new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`, 'gu');

export function loadPrivate() {
  if (!fs.existsSync(FILE)) throw new Error(`${path.relative(root, FILE)} is missing: it lists the private names to keep off the site`);
  const { replace = [], forbid = [] } = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  return {
    neutral: text => replace.reduce((t, [from, to]) => t.replace(word(from), to), text),
    leaks: (text, where) => forbid.flatMap(f => [...text.matchAll(new RegExp(word(f).source, 'giu'))].map(m => `${where}: “${text.slice(Math.max(0, m.index - 30), m.index + f.length + 30).replace(/\s+/g, ' ')}”`)),
  };
}

const TEXT = /\.(html|css|js|mjs|cjs|json|md|txt|svg|xml|yml|yaml|toml)$/;
function files() {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  const walk = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.relative(root, path.join(dir, e.name))]) : [];
  return [...new Set([...tracked, ...walk(path.join(root, 'dist'))])].filter(f => TEXT.test(f) && !f.startsWith('.github/') && fs.existsSync(path.join(root, f)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { leaks } = loadPrivate();
  const found = files().flatMap(f => leaks(fs.readFileSync(path.join(root, f), 'utf8'), f));
  if (found.length) { console.error(`${found.length} private names on the site:\n${found.slice(0, 40).join('\n')}`); process.exit(1); }
  console.log('no private names in the tracked files or dist/');
}
