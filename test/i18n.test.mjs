import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createT, flatten, compareCatalogs } from '../js/i18n-core.mjs';
import { ROOT, loadLocales, readyLocales, loadCatalog, catalogProblems } from '../scripts/i18n/catalog.mjs';
import { PAGES, renderPage, pageEntries, pageUrl } from '../scripts/i18n/pages.mjs';
import { pageInputs } from '../scripts/i18n/vite-plugin.mjs';

test('t fills placeholders and picks the plural of each language', () => {
  const pt = createT(flatten({ a: 'Olá, {nome}', n: { one: '{count} plugin', other: '{count} plugins' } }), 'pt-BR');
  assert.equal(pt('a', { nome: 'Ana' }), 'Olá, Ana');
  assert.equal(pt('n', { count: 1 }), '1 plugin');
  assert.equal(pt('n', { count: 2 }), '2 plugins');
  const ru = createT({ n: { one: '{count} плагин', few: '{count} плагина', many: '{count} плагинов', other: '{count} плагина' } }, 'ru');
  assert.equal(ru('n', { count: 3 }), '3 плагина');
  assert.equal(ru('n', { count: 5 }), '5 плагинов');
});

test('a missing key or a plural without count is an error, never pt-BR in silence', () => {
  const t = createT({ a: 'x', n: { one: 'um', other: 'vários' } }, 'en');
  assert.throws(() => t('b'), /b não existe em en/);
  assert.throws(() => t('n'), /precisa de count/);
});

test('compareCatalogs finds missing keys, extra keys and changed placeholders', () => {
  const r = compareCatalogs({ a: '{n} x', b: 'y', l: ['1', '2'] }, { a: '{m} x', c: 'z', l: ['1'] });
  assert.deepEqual(r.missing, ['b']);
  assert.deepEqual(r.extra, ['c']);
  assert.equal(r.mismatched.length, 2);
});

test('the 15 languages of the app are listed, with pt-BR at the root', () => {
  const codes = loadLocales().map(l => l.code);
  assert.deepEqual([...codes].sort(), ['ar', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'pt-BR', 'ru', 'tr', 'vi', 'zh-CN'].sort());
  assert.equal(loadLocales().find(l => l.code === 'ar').dir, 'rtl');
});

test('every ready language has every key of pt-BR, with the same placeholders', () => {
  assert.deepEqual(catalogProblems(), []);
});

test('each page has its language, direction, canonical and the alternates of every ready language', () => {
  const ready = readyLocales();
  for (const e of pageEntries()) {
    const html = e.html();
    assert.ok(!html.includes('{{'), `${e.file}: sobrou um token`);
    assert.match(html, new RegExp(`<html lang="${e.locale.code}" dir="${e.locale.dir}">`));
    assert.ok(html.includes(`<link rel="canonical" href="${pageUrl(e.locale, e.page)}" />`), `${e.file}: canonical`);
    for (const l of ready) assert.ok(html.includes(`hreflang="${l.code}" href="${pageUrl(l, e.page)}"`), `${e.file}: falta ${l.code}`);
    assert.ok(html.includes('hreflang="x-default" href="https://cadente-hub.github.io/"'), `${e.file}: x-default`);
    assert.ok(html.includes(`<meta property="og:locale" content="${e.locale.og}" />`));
  }
});

test('a right-to-left language gets dir="rtl"', () => {
  const page = PAGES[0], ar = { ...loadLocales().find(l => l.code === 'ar') };
  const html = renderPage({ template: fs.readFileSync(path.join(ROOT, page.template), 'utf8'), page, locale: ar, locales: [loadLocales()[0], ar], messages: loadCatalog('pt-BR') });
  assert.match(html, /<html lang="ar" dir="rtl">/);
});

test('the pt-BR home stays at /index.html and English lands in /en/', () => {
  const inputs = pageInputs();
  assert.equal(inputs['pt-BR/index'], path.join(ROOT, 'index.html'));
  assert.equal(inputs['en/index'], path.join(ROOT, 'en/index.html'));
});
