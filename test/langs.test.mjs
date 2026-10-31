import test from 'node:test';
import assert from 'node:assert/strict';
import { pickLocale, storedChoice, storeChoice, STORE_KEY } from '../js/langs.mjs';
import { pageEntries } from '../scripts/i18n/pages.mjs';
import { loadLocales, readyLocales } from '../scripts/i18n/catalog.mjs';

const ALL = loadLocales().map(l => l.code);

test('the browser language picks the closest language of the site', () => {
  assert.equal(pickLocale(['zh-Hans-CN'], ALL), 'zh-CN');
  assert.equal(pickLocale(['zh'], ALL), 'zh-CN');
  assert.equal(pickLocale(['zh-TW', 'en-US'], ALL), 'en', 'Traditional Chinese is not zh-CN');
  assert.equal(pickLocale(['es-419'], ALL), 'es');
  assert.equal(pickLocale(['pt-PT'], ALL), 'pt-BR');
  assert.equal(pickLocale(['pt'], ALL), 'pt-BR');
  assert.equal(pickLocale(['en-GB'], ALL), 'en');
  assert.equal(pickLocale(['ar-EG'], ALL), 'ar');
  assert.equal(pickLocale(['nl-NL', 'de-AT'], ALL), 'de');
  assert.equal(pickLocale(['nl-NL'], ALL), null);
  assert.equal(pickLocale(['ja-JP'], ['pt-BR', 'en']), null, 'only the languages offered');
});

test('the stored choice survives storage that throws', () => {
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  storeChoice(storage, 'en');
  assert.equal(mem.get(STORE_KEY), 'en');
  assert.equal(storedChoice(storage), 'en');
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(storedChoice(broken), null);
  assert.doesNotThrow(() => storeChoice(broken, 'en'));
});

test('the picker lists only the ready languages, each pointing at the same page', () => {
  const ready = readyLocales();
  for (const e of pageEntries()) {
    const html = e.html();
    const links = [...html.matchAll(/<a href="([^"]+)" hreflang="([^"]+)" lang="[^"]+" data-lang="[^"]+"( aria-current="true")?>/g)];
    const picker = links.slice(0, ready.length);
    assert.deepEqual(picker.map(m => m[2]), ready.map(l => l.code), e.file);
    assert.deepEqual(picker.map(m => m[1]), ready.map(l => `${l.path}${e.page.url}`));
    assert.equal(picker.filter(m => m[3]).map(m => m[2])[0], e.locale.code);
    const data = JSON.parse(html.match(/<script type="application\/json" id="i18n">([\s\S]*?)<\/script>/)[1]);
    for (const [code, o] of Object.entries(data.others)) assert.ok(o.notice && o.go && o.close && o.href, `${e.file} → ${code}`);
  }
});
