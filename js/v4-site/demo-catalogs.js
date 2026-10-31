// The window catalogs of every language (i18n/<code>/demo.json), each loaded only when a page asks for it.
// pt-BR is the source and has no catalog.
import { createTranslator } from './translate.mjs';

const FILES = import.meta.glob('../../i18n/*/demo.json', { import: 'default' });
const cache = new Map();

export async function demoTranslator(code) {
  if (code === 'pt-BR') return null;
  if (!cache.has(code)) {
    const load = FILES[`../../i18n/${code}/demo.json`];
    cache.set(code, load ? load().then(createTranslator) : Promise.resolve(null));
  }
  return cache.get(code);
}
