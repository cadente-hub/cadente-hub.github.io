import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generalize, keysOf, createTranslator, sameEverywhere } from '../js/v4-site/translate.mjs';
import { ROOT, readyLocales, SOURCE } from '../scripts/i18n/catalog.mjs';
import { demoProblems } from '../scripts/i18n/check-demo.mjs';

const tr = createTranslator({ 'testes novos': 'new tests', '{0} testes novos': '{0} new tests', 'trabalhando': 'working', 'há {0} min': '{0} min ago', 'Terminal': 'Terminal' });

test('numbers become placeholders and come back in place', () => {
  assert.deepEqual(generalize('3 de 12 · 4 min'), { key: '{0} de {1} · {2} min', nums: ['3', '12', '4'] });
  assert.equal(tr('12 testes novos'), '12 new tests');
  assert.equal(tr('há 3 min'), '3 min ago');
});

test('a text with parts joined by " · " is translated part by part, keeping the unknown parts', () => {
  assert.equal(tr('claude · trabalhando · há 3 min'), 'claude · working · 3 min ago');
  assert.equal(tr('nada conhecido · aqui'), null);
});

test('spaces around the text stay, and a text already translated is left as it is', () => {
  assert.equal(tr('  trabalhando '), '  working ');
  assert.equal(tr('working'), null);
  assert.equal(tr(tr('trabalhando')), null);
  assert.equal(tr('Terminal'), null, 'the same word is not a change');
  assert.equal(tr('42'), null);
});

test('paths, files, handles, commands and identifiers never enter the catalog', () => {
  for (const s of ['src/lib.rs', 'layout.rs', '@ana', '/publish', 'https://x.test', 'cadente.ai.ollama', 'feature/login', 'x', 'GET', 'focusNeighbor']) assert.ok(sameEverywhere(s) || !keysOf(s).length, s);
  assert.deepEqual(keysOf('PR #251 · CI falhou em cargo test'), ['PR #{0}', 'CI falhou em cargo test']);
  assert.deepEqual(keysOf('   '), []);
});

test('every ready language translates every text the window shows, with the same placeholders', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'i18n/demo-strings.json')));
  for (const l of readyLocales().filter(x => x.code !== SOURCE)) assert.deepEqual(demoProblems(l.code), [], l.code);
});
