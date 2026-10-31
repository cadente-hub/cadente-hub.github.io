import test from 'node:test';
import assert from 'node:assert/strict';
import { createT } from '../js/i18n-core.mjs';
import { loadCatalog } from '../scripts/i18n/catalog.mjs';
import { storeApps, storeCategories, filterApps, peopleAt, earnings, usersOf, rackLog, serviceNote } from '../js/home-logic.mjs';
import { APPS } from '../js/store-data.js';

// The js.* part of a catalog, the way the page hands it to the scripts.
const tFor = (code, intl = code) => {
  const all = loadCatalog(code);
  return createT(Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('js.')).map(([k, v]) => [k.slice(3), v])), intl);
};
const LANGS = [['pt-BR', 'pt-BR'], ['en', 'en']];
const usd = intl => n => new Intl.NumberFormat(intl, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const list = intl => xs => new Intl.ListFormat(intl, { type: 'conjunction' }).format(xs);

for (const [code, intl] of LANGS) {
  const t = tFor(code, intl);
  test(`${code}: every store plugin has a name, a description, a category and a price`, () => {
    const apps = storeApps(t, usd(intl));
    assert.equal(apps.length, APPS.length);
    for (const a of apps) for (const f of ['name', 'desc', 'catLabel', 'price']) assert.ok(a[f] && !a[f].includes('{'), `${a.id}.${f}`);
    assert.equal(storeCategories(t)[0].id, 'all');
  });
  test(`${code}: the searches the store types on its own find plugins`, () => {
    const apps = storeApps(t, usd(intl));
    for (const term of t('store.demoSearches')) assert.ok(filterApps(apps, { query: term }).length > 0, `"${term}" acha algo`);
    assert.equal(filterApps(apps, { cat: 'themes' }).every(a => a.cat === 'themes'), true);
    assert.equal(filterApps(apps, { query: 'zzzz' }).length, 0);
    assert.ok(filterApps(apps).length <= 9);
  });
  test(`${code}: the rack log fills names and lists`, () => {
    const L = list(intl);
    assert.match(rackLog(t, L, { type: 'off', name: 'Chat' }), /<b>Chat<\/b>/);
    const swap = rackLog(t, L, { type: 'swap', service: 'x', from: 'a', to: 'b', users: ['Chat', 'PR Reviews'] });
    assert.ok(swap.includes('a → b') && swap.includes(L(['Chat', 'PR Reviews'])));
    assert.ok(!rackLog(t, L, { type: 'noAi', users: ['Chat'] }).includes('{'));
    assert.equal(serviceNote(t, L, { noAi: false, users: [] }), t('rack.svc.nobody'));
    assert.equal(t('rack.count', { count: 7 }).includes('7'), true);
  });
}

test('the calculator keeps the share of each model and a log scale of people', () => {
  assert.equal(peopleAt(0), 10);
  assert.equal(peopleAt(100), 100000);
  assert.equal(earnings('subscription', 5, 100), 350);
  assert.equal(earnings('donation', 5, 100), 450);
});

test('the rack lists only the plugins that are on and use the service', () => {
  const rack = { plugins: [{ name: 'Chat', on: true, uses: ['ai'] }, { name: 'PR', on: false, uses: ['ai'] }, { name: 'Terminal', on: true, uses: ['pty'] }] };
  assert.deepEqual(usersOf(rack, 'ai'), ['Chat']);
});
