import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pageEntries, faqItems } from '../scripts/i18n/pages.mjs';
import { ROOT, loadCatalog, readyLocales } from '../scripts/i18n/catalog.mjs';
import { installCommand } from '../js/hero.js';

const homes = () => pageEntries().filter(e => e.page.id === 'index');
const text = html => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('the h1 says the final sentence in each language, with nothing struck in the HTML', () => {
  for (const e of homes()) {
    const m = loadCatalog(e.locale.code);
    const h1 = text(e.html().match(/<h1[\s\S]*?<\/h1>/)[0]).trim();
    assert.equal(h1.replace(/\s+([.!?。])/g, '$1'), `${m['hero.before']} ${m['hero.hub']}${m['hero.after']}`.replace(/\s+([.!?。])/g, '$1'), e.locale.code);
    assert.ok(Array.isArray(m['js.hero.words']) && m['js.hero.words'].length >= 4, `${e.locale.code}: hero.words`);
  }
});

test('no page claims millions of plugins', () => {
  const claim = /milh(õ|o)es|millions|millones|millions|Millionen|milioni|миллион|milyon|ملايين|लाखों|jutaan|hàng triệu|数百万|수백만|数百万/i;
  for (const e of homes()) assert.ok(!claim.test(text(e.html())), `${e.locale.code} ainda fala em milhões`);
  for (const f of ['js/v4-site/loja.mjs', 'js/v4-site/loja.json']) assert.ok(!/milh(õ|o)es/i.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f);
});

test('the FAQ JSON-LD is valid and asks the same questions the page shows', () => {
  for (const e of homes()) {
    const html = e.html();
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(ld['@type'], 'FAQPage');
    const visible = [...html.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map(m => text(m[1]).trim());
    assert.deepEqual(ld.mainEntity.map(q => q.name), visible, e.locale.code);
    for (const q of ld.mainEntity) assert.ok(q.acceptedAnswer.text.length > 20);
    assert.equal(faqItems(loadCatalog(e.locale.code)).length, visible.length);
  }
});

test('the install command follows the visitor system', () => {
  assert.match(installCommand('Win32'), /install\.ps1 \| iex$/);
  assert.match(installCommand('Windows'), /install\.ps1/);
  assert.match(installCommand('MacIntel'), /install\.sh \| bash$/);
  assert.match(installCommand('Linux x86_64'), /install\.sh/);
  for (const f of ['install.sh', 'install.ps1']) assert.ok(fs.existsSync(path.join(ROOT, 'public', f)));
});

test('every ready language says the app speaks 15 languages, as the app does', () => {
  for (const l of readyLocales()) assert.match(loadCatalog(l.code)['hero.eyebrow'], /15/);
});
