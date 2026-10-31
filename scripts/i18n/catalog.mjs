// Loads the languages and their catalogs from i18n/. pt-BR is the source; only languages marked "ready" become
// pages, and a ready language must have every key of the source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flatten } from '../../js/i18n-core.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SOURCE = 'pt-BR';

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
