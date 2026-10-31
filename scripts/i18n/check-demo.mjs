// Checks one language's window catalog against i18n/demo-strings.json: every string translated, the same {0}
// placeholders, nothing extra. Usage: node scripts/i18n/check-demo.mjs <code>
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './catalog.mjs';

export function demoProblems(code, root = ROOT) {
  const source = JSON.parse(fs.readFileSync(path.join(root, 'i18n/demo-strings.json'), 'utf8'));
  const file = path.join(root, 'i18n', code, 'demo.json');
  if (!fs.existsSync(file)) return [`${code}/demo.json não existe`];
  let dict;
  try { dict = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return [`${code}/demo.json não é JSON válido: ${e.message}`]; }
  const ph = s => (s.match(/\{\d+\}/g) ?? []).sort().join();
  const problems = [];
  for (const s of source) {
    if (!Object.hasOwn(dict, s)) problems.push(`falta: ${s}`);
    else if (typeof dict[s] !== 'string' || !dict[s].trim()) problems.push(`vazio: ${s}`);
    else if (ph(dict[s]) !== ph(s)) problems.push(`placeholders: ${s} → ${dict[s]}`);
  }
  const known = new Set(source);
  for (const k of Object.keys(dict)) if (!known.has(k)) problems.push(`sobra: ${k}`);
  return problems;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const code = process.argv[2];
  const problems = demoProblems(code);
  console.log(problems.length ? problems.slice(0, 60).join('\n') : `${code}: ok`);
  if (problems.length) { console.log(`${problems.length} problemas`); process.exit(1); }
}
