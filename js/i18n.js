// The language of the page, read from the JSON that the page generator writes into it (scripts/i18n/pages.mjs):
// the js.* part of the catalog, the language code, the Intl locale, the text direction and the folder of the language.
import { createT } from './i18n-core.mjs';

const el = typeof document !== 'undefined' ? document.getElementById('i18n') : null;
const data = el ? JSON.parse(el.textContent) : { locale: 'pt-BR', intl: 'pt-BR', dir: 'ltr', base: '/', messages: {} };

export const LOCALE = data.locale;
export const INTL = data.intl;
export const DIR = data.dir;
export const BASE = data.base;
export const t = createT(data.messages, INTL);

export const number = (n, opts) => new Intl.NumberFormat(INTL, opts).format(n);
// Prices on the site are in US dollars, written the way each language writes money.
export const usd = (n, opts) => new Intl.NumberFormat(INTL, { style: 'currency', currency: 'USD', maximumFractionDigits: 0, ...opts }).format(n);
export const list = xs => new Intl.ListFormat(INTL, { type: 'conjunction' }).format(xs);
