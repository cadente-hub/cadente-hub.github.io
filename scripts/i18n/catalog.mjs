// Loads the languages and their catalogs from i18n/. pt-BR is the source; only languages marked "ready" become
// pages, and a ready language must have every key of the source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flatten, compareCatalogs } from '../../js/i18n-core.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SOURCE = 'pt-BR';
export const CATALOGS = ['site'];

export function loadLocales(root = ROOT) {
  const list = JSON.parse(fs.readFileSync(path.join(root, 'i18n/locales.json'), 'utf8'));
  for (const l of list) {
    if (!/^\/([a-z]{2}(-[a-z]{2})?\/)?$/.test(l.path)) throw new Error(`locales.json: caminho inválido para ${l.code}: ${l.path}`);
    if (!['ltr', 'rtl'].includes(l.dir)) throw new Error(`locales.json: direção inválida para ${l.code}`);
  }
  if (list[0]?.code !== SOURCE || list[0].path !== '/') throw new Error('locales.json: o pt-BR vem primeiro, na raiz');
  return list;
}

export const readyLocales = (root = ROOT) => loadLocales(root).filter(l => l.status === 'ready');

export function catalogFile(code, name, root = ROOT) {
  return path.join(root, 'i18n', code, `${name}.json`);
}

export function loadCatalog(code, name = 'site', root = ROOT) {
  const file = catalogFile(code, name, root);
  if (!fs.existsSync(file)) return null;
  return flatten(JSON.parse(fs.readFileSync(file, 'utf8')));
}

// Every problem of the ready languages against the source, as one list of lines (empty = all good).
export function catalogProblems(root = ROOT) {
  const problems = [];
  for (const name of CATALOGS) {
    const source = loadCatalog(SOURCE, name, root);
    if (!source) { problems.push(`${SOURCE}/${name}.json não existe`); continue; }
    for (const l of readyLocales(root).filter(x => x.code !== SOURCE)) {
      const target = loadCatalog(l.code, name, root);
      if (!target) { problems.push(`${l.code}/${name}.json não existe`); continue; }
      const { missing, extra, mismatched } = compareCatalogs(source, target);
      problems.push(...missing.map(k => `${l.code}/${name}: falta ${k}`), ...extra.map(k => `${l.code}/${name}: sobra ${k}`), ...mismatched.map(k => `${l.code}/${name}: ${k}`));
    }
  }
  return problems;
}
