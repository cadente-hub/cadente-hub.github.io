// Runs in the browser (scripts/i18n/harvest.html): plays every chapter of the theater, the plugin tour and every
// view of every plugin, fast, and collects each text the window shows. The page language is "harvest": the scripts'
// own words come from the pt-BR catalog, and the agent CLIs use their drawn screens, as in every other language.
import site from '../../i18n/pt-BR/site.json';
import { flatten } from '../../js/i18n-core.mjs';

const js = Object.fromEntries(Object.entries(flatten(site)).filter(([k]) => k.startsWith('js.')).map(([k, v]) => [k.slice(3), v]));
const data = document.createElement('script');
data.type = 'application/json';
data.id = 'i18n';
data.textContent = JSON.stringify({ locale: 'harvest', intl: 'pt-BR', dir: 'ltr', base: '/', messages: js });
document.head.append(data);

const { Stage, drawHooks } = await import('../../js/stage.js');
const { collectTree, keysOf } = await import('../../js/v4-site/translate.mjs');
const { CHAPTERS, initial } = await import('../../js/theater.js');
const { KEYMAP } = await import('../../js/v4/keys.mjs');
const { PLUGINS } = await import('../../js/v4/plugins.mjs');
const { scene } = await import('../../js/v4/scenes.mjs');
const { reduce, leaves, activeTab } = await import('../../js/v4/model.mjs');

const keys = new Set();
drawHooks.push(root => collectTree(root, keys));
for (const e of KEYMAP) keysOf(e.label ?? '').forEach(k => keys.add(k));
const host = document.getElementById('stage'), fit = document.getElementById('fit');
const log = [];
const TEMPO = 0.03;

// The theater, chapter after chapter, from a fresh window; the agents keep working between chapters.
async function theater() {
  const stage = new Stage(host, { width: 1240, height: 760, state: initial(), fitTo: fit, tempo: TEMPO, hud: true });
  await stage.play(async (s, id) => {
    for (const c of CHAPTERS) { log.push(c.id); await c.run(s, id); await s.wait(6000, id); }
  });
  stage.stop();
}

// Every view of every plugin, in the scene the plugin tour uses: open the plugin, walk its views with ⇥, open its
// actions (.) and its commands (/).
async function plugins() {
  let base = reduce(scene('quad'), { type: 'NEW_TAB' });
  const scratchTab = base.active, scratch = leaves(activeTab(base).tree)[0].id;
  base = reduce(base, { type: 'PATCH_SETTINGS', sidebar: true });
  const stage = new Stage(host, { width: 780, height: 560, state: base, fitTo: fit, tempo: TEMPO, hud: false });
  await stage.play(async (s, id) => {
    for (const p of PLUGINS) {
      let S = s.S;
      const own = S.tabs.filter(x => x.id !== scratchTab).flatMap(x => leaves(x.tree).map(l => ({ t: x, l }))).find(x => x.l.plugin === p.id);
      const tab = own ? own.t.id : scratchTab, target = own ? own.l.id : scratch;
      S = reduce(reduce(S, { type: 'SELECT_TAB', id: tab }), { type: 'FOCUS', id: target });
      if (!own) S = reduce(S, { type: 'OPEN', plugin: p.id, pane: scratch });
      s.setState({ ...S, overlay: null });
      for (let v = 0; v < 8; v++) { await s.key('⇥', id, { hold: 0 }); await s.wait(400, id); }
      await s.key('.', id, { hold: 0 }); await s.wait(200, id); await s.key('esc', id, { hold: 0 });
      await s.type('/', id); await s.wait(200, id); await s.key('⌫', id, { hold: 0 });
      log.push(p.id);
    }
    // The sidebar, the agents, the jump labels and the plugin picker.
    for (const k of ['⌘⇧A', 'esc', '⌘;', 'esc', '⌘O', 'esc', '⌘,', 'esc']) { await s.key(k, id, { hold: 0 }); await s.wait(300, id); }
  });
  stage.stop();
}

try {
  await theater();
  await plugins();
  window.__harvest = { keys: [...keys].sort((a, b) => a.localeCompare(b, 'pt-BR')), log };
} catch (e) {
  window.__harvest = { error: String(e?.stack ?? e), log };
}
