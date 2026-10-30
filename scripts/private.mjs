#!/usr/bin/env node
// Private names (internal projects, private checkouts, personal handles) must never reach the public site, and the
// site does not cite other products (BRANDS below).
// The names live only outside the repo, in ~/.config/cadente-site/private-names.json (or $CADENTE_PRIVATE_NAMES):
//   { "replace": [["private", "public"], …], "forbid": ["word", …] }
// "replace" pairs are applied in order, whole words only, by scripts/sync-v4.mjs; "forbid" words fail the check.
// Usage: node scripts/private.mjs   checks every tracked text file and dist/, and exits 1 on a leak.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.env.CADENTE_PRIVATE_NAMES ?? path.join(os.homedir(), '.config/cadente-site/private-names.json');
// Other products the site does not cite: the Cadente is described on its own terms. Not secret, so kept here and
// merged with the private list. The prototype's sample data that names them is replaced on sync.
const BRANDS = {
  replace: [
    ['Zed — UI density', 'Densidade da interface'], ['zed.dev/docs/configuring-zed#ui-density', 'cadente-hub.github.io/blog'],
    ['Dracula', 'Noturno'], ['curl · postman · insomnia', 'curl · coleções exportadas'], ['rest postman insomnia', 'rest coleções'],
  ],
  forbid: ['obsidian', 'dbeaver', 'warp', 'bruno', 'excalidraw', 'zed', 'electron', 'dracula', 'postman', 'insomnia'],
};
const SELF = path.relative(root, fileURLToPath(import.meta.url));
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole words: a name glued to other letters ("ignora") is a different word.
const word = s => new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`, 'gu');

export function loadPrivate() {
  if (!fs.existsSync(FILE)) throw new Error(`${FILE} is missing: it lists the private names to keep off the site`);
  const own = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const replace = [...(own.replace ?? []), ...BRANDS.replace], forbid = [...(own.forbid ?? []), ...BRANDS.forbid];
  return {
    neutral: text => replace.reduce((t, [from, to]) => t.replace(word(from), to), text),
    leaks: (text, where) => forbid.flatMap(f => [...text.matchAll(new RegExp(word(f).source, 'giu'))].map(m => `${where}: “${text.slice(Math.max(0, m.index - 30), m.index + f.length + 30).replace(/\s+/g, ' ')}”`)),
  };
}

const TEXT = /\.(html|css|js|mjs|cjs|json|md|txt|svg|xml|yml|yaml|toml)$/;
function files() {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  const walk = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.relative(root, path.join(dir, e.name))]) : [];
  return [...new Set([...tracked, ...walk(path.join(root, 'dist'))])].filter(f => TEXT.test(f) && !f.startsWith('.github/') && f !== SELF && fs.existsSync(path.join(root, f)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { leaks } = loadPrivate();
  const found = files().flatMap(f => leaks(fs.readFileSync(path.join(root, f), 'utf8'), f));
  if (found.length) { console.error(`${found.length} private names or other brands on the site:\n${found.slice(0, 40).join('\n')}`); process.exit(1); }
  console.log('no private names or other brands in the tracked files or dist/');
}
