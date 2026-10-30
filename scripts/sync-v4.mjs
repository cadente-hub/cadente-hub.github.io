#!/usr/bin/env node
// Copies the frozen Cadente v4 prototype into the site and adapts it for a public web page:
// - slash commands in English (the app's decision of 2026-10-30), with a guard against clashes;
// - private names (projects, checkouts, handles) replaced by neutral ones from a list kept outside the repo, and
//   the sync fails if any of them is left in what it writes (scripts/private.mjs);
// - no internal capability census (the palette lists actions and plugins only);
// - shell.css scoped under `.v4`, so the prototype never styles the rest of the page.
// Usage: node scripts/sync-v4.mjs <path to the v4 prototype>   (or set CADENTE_V4)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPrivate } from './private.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const given = process.argv[2] ?? process.env.CADENTE_V4;
if (!given) throw new Error('usage: node scripts/sync-v4.mjs <path to the v4 prototype> (or set CADENTE_V4)');
const src = path.resolve(given);
const out = path.join(root, 'js/v4');
const cssOut = path.join(root, 'css/v4.css');
const PRIVATE = loadPrivate();

const MODULES = ['model', 'keys', 'view', 'engine', 'plugins', 'dev', 'talk', 'apis', 'life', 'sys', 'data', 'scenes', 'capabilities'];

const COMMANDS = {
  acompanhar: 'track', adicionar: 'add', agrupar: 'group', aplicar: 'apply', atualizar: 'refresh', baixar: 'download',
  buscar: 'search', catalogo: 'catalog', checar: 'check-updates', cidade: 'city', clonar: 'clone', comentar: 'comment',
  compactar: 'compact', conectar: 'connect', 'conectar-github': 'connect-github', 'configuracao-inicial': 'setup',
  contexto: 'context', converter: 'convert', 'corrigir-ci': 'fix-ci', desconectar: 'disconnect',
  'desconectar-github': 'disconnect-github', detectar: 'detect', diagnostico: 'diagnose', entrar: 'login', 'esforço': 'effort',
  exportar: 'export', formatar: 'format', hoje: 'today', idioma: 'language', importar: 'import', 'importar-cli': 'import-cli',
  'importar-config': 'import-config', 'importar-feriados': 'import-holidays', instalar: 'install', liberar: 'free',
  'limpar-historico': 'clear-history', melhorar: 'improve', minificar: 'minify', modelo: 'model', nova: 'new',
  'nova-aba': 'new-tab', 'nova-colecao': 'new-collection', 'nova-conta': 'new-account', 'nova-data': 'new-date',
  'nova-nota': 'new-note', 'nova-pasta': 'new-folder', 'nova-request': 'new-request', 'nova-sessao': 'new-session',
  'nova-tag': 'new-tag', novo: 'new', 'novo-ambiente': 'new-environment', 'novo-diagrama': 'new-diagram',
  'novo-perfil': 'new-profile', 'novo-template': 'new-template', 'ollama-remover': 'ollama-remove', ordenar: 'sort',
  origem: 'source', padrao: 'allow', plano: 'plan', previa: 'preview', pular: 'skip', raiz: 'root', recuperar: 'recover',
  recursos: 'resources', reiniciar: 'restart', 'remover-template': 'remove-template', reparar: 'repair', restaurar: 'restore',
  revisar: 'review', sair: 'logout', saude: 'health', 'simular-commit': 'simulate-commit', sincronizar: 'sync',
  'time-adicionar': 'team-add', zerar: 'reset', abrir: 'open',
};

const WORD = '[a-zçãõéáíóúê][a-zçãõéáíóúê-]*';
// "/compactar", "/ adicionar, clonar": every listed name after a slash becomes the English one.
const slashLists = new RegExp(`(^|[\\s"'(·])(\\/ ?)(${WORD}(?:, ?${WORD})*)`, 'g');
const english = text => text.replace(slashLists, (all, lead, slash, list) =>
  lead + slash + list.split(/(, ?)/).map(t => COMMANDS[t] ?? t).join(''));
// The public page shows no private names: projects, checkouts and the sample account become neutral ones.
const neutral = text => PRIVATE.neutral(text);

const changes = [];
// The site's copy of the prototype gets a few additions for the demo, all applied here so a new sync keeps them:
// - Terminal: `claude`, `codex`, `agy`, `gemini` and `opencode` open the CLI's own interactive screen
//   (js/v4-site/tui.mjs); the next line typed is the task, and the steps below fill the transcript.
// - Requests: a "▶ enviar" row in the request, and collection items that set the method.
// - Postgres: a community plugin with navigator, script and result grid (js/v4-site/banco.*), shown apart from the first-party ones.
// - Documentos, Navegador and Quadro: community plugins for markdown notes, web pages and
//   hand-drawn diagrams (js/v4-site/docs.*, web.*, draw.*).
// - Loja: the plugin store in a pane (js/v4-site/loja.*), where the demo installs Postgres and Quadro.
// - Workspaces: four worktrees at once, with the state of each pull request or agent.
const EXTRA_AGENTS = {
  agy: { model: 'gemini 3 pro', steps: ['lendo src/auth/login.ts', 'escrevendo login.test.ts  +48', '?rodar `npm test`', 'rodando npm test', '✓12 testes novos · todos passam'] },
  gemini: { model: 'gemini 2.5 pro', steps: ['lendo docs/', 'resumindo 14 arquivos', '✓resumo salvo em RESUMO.md'] },
  opencode: { model: 'qwen3 coder · ollama', steps: ['indexando o repositório', 'refatorando cache.rs  +21 −14', 'rodando cargo check', '✓refatoração pronta · build ok'] },
};
const AGENT_RE = `claude|codex|${Object.keys(EXTRA_AGENTS).join('|')}`;
function moreAgents(text) {
  return swapAll('dev.mjs', text, [
    ["import { fromManifest, registerFn, h, row, note } from './engine.mjs';", "import { fromManifest, registerFn, h, row, note } from './engine.mjs';\nimport { tui, hasRecording, recordingTick, recordingAnswer } from '../v4-site/tui.mjs';"],
    [/^(const AGENTS = \{\n)/m, `$1${Object.entries(EXTRA_AGENTS).map(([k, v]) => `  ${k}: ${JSON.stringify(v.steps)},\n`).join('')}`],
    [/^const MODEL = \{ claude: 'opus 4.6', codex: 'gpt-5 codex' \};$/m, `const MODEL = { claude: 'opus 4.6', codex: 'gpt-5 codex', ${Object.entries(EXTRA_AGENTS).map(([k, v]) => `${k}: '${v.model}'`).join(', ')} };`],
    // While a CLI is open, the pane shows its screen instead of the blocks.
    ['  view(leaf) {\n    const { blocks, folded } = leaf.data;', `  view(leaf, S) {
    const open = lastAgent(leaf);
    if (open?.b.tui && open.i === leaf.data.blocks.length - 1) return { subject: open.b.task || open.b.agent, lines: [{ t: 'tui', html: tui(open.b, { model: MODEL[open.b.agent], ctx: leaf.ctx, input: leaf.input, clock: S?.clock ?? 0, focused: !!S && S.tabs.find(t => t.id === S.active)?.focus === leaf.id }) }] };
    const { blocks, folded } = leaf.data;`],
    ['  activity(leaf, S) {\n    const a = lastAgent(leaf), b = leaf.data.blocks.at(-1);', "  activity(leaf, S) {\n    const a = lastAgent(leaf), b = leaf.data.blocks.at(-1);\n    if (a?.b.tui && a.b.state === 'ocioso') return null;"],
    // Recorded CLIs (js/v4-site/recordings.json) move through their real screens; the others use the steps above.
    ["    if (a?.b.state !== 'trabalhando') return null;\n    const next = stepAgent(a.b, S);", "    if (a?.b.state !== 'trabalhando') return null;\n    const next = a.b.tui && hasRecording(a.b.agent) ? recordingTick(a.b, S) : stepAgent(a.b, S);\n    if (!next) return null;"],
    ["    const next = stepAgent(answered, S, key === 'n' ? 1 : 0);", "    const next = a.b.tui && hasRecording(a.b.agent) ? recordingAnswer(answered, key, S) : stepAgent(answered, S, key === 'n' ? 1 : 0);"],
    // A line typed into an open CLI is its next task.
    ["    if (cmd === 'clear') return", `    const open = lastAgent(leaf);
    if (open?.b.tui && open.i === d.blocks.length - 1 && open.b.running) {
      if (['trabalhando', 'precisa de você'].includes(open.b.state)) return { toast: \`\${open.b.agent} ainda está trabalhando\` };
      const next = { ...open.b, task: cmd, step: 0, phase: 'work', state: 'trabalhando', started: S?.clock ?? 0, out: [...open.b.out, { text: cmd, tone: 'you' }, \`● \${hasRecording(open.b.agent) ? 'trabalhando' : AGENTS[open.b.agent][0]}\`] };
      return { data: { blocks: d.blocks.map((b, i) => (i === open.i ? next : b)) } };
    }
    if (cmd === 'clear') return`],
    [/const ag = cmd\.match\(\/\^\(claude\|codex\)\\b\\s\*\["'\]\?\(\.\*\?\)\["'\]\?\$\/\);\n    if \(ag\) return push\(.*\n/, `const ag = cmd.match(/^(${AGENT_RE})\\b\\s*["']?(.*?)["']?$/);
    if (ag) {
      const fx = ag[2]
        ? push([{ text: ag[2], tone: 'you' }, \`● \${AGENTS[ag[1]][0]}\`], null, { agent: ag[1], task: ag[2], tui: true, step: 0, state: 'trabalhando', running: true, ms: '', started: S?.clock ?? 0 })
        : push([], null, { agent: ag[1], task: '', tui: true, step: -1, state: 'ocioso', running: true, ms: '', started: S?.clock ?? 0 });
      fx.data.view = 'tui';
      return fx;
    }
`],
  ]);
}
// Requests answers each method the way an API would (201 with the new item for POST, 204 for DELETE), and the
// request view starts with a row that sends it, reached with the arrows.
function restfulRequests(text) {
  return swapAll('apis.mjs', text, [
    ["status: 200, ms: 184, size: '1,2 KB', headers: r.headers", "status: { POST: 201, DELETE: 204 }[d.method] ?? 200, ms: { POST: 212, DELETE: 96 }[d.method] ?? 184, size: { POST: '64 B', DELETE: '0 B' }[d.method] ?? '1,2 KB', headers: r.headers"],
    ["status: last.error ? 'erro' : 200, url: r.url", 'status: last.error ? \'erro\' : last.status, url: r.url'],
    [": leaf.data.raw ? [BODY.join('').replace(/\\s+/g, ' ')] : BODY;", ": leaf.data.raw ? [BODY.join('').replace(/\\s+/g, ' ')] : { POST: ['{ \"id\": \"proj_03\", \"name\": \"vitrine\", \"panes\": 0 }'], DELETE: [] }[last.method] ?? BODY;"],
    ['`${last.status} OK · ${last.ms} ms', "`${last.status} ${{ 201: 'Created', 204: 'No Content' }[last.status] ?? 'OK'} · ${last.ms} ms"],
    ["if (v === 'requisição') return { lines: [", "if (v === 'requisição') return { lines: [row('rq-go', '▶', `enviar ${d.method}`, resolve(S, d).url, null, { kind: 'go' }),"],
    ["  activate(leaf, item, S) {\n    if (item.kind === 'rq')", "  activate(leaf, item, S) {\n    if (item.kind === 'go') return send(S, leaf);\n    if (item.kind === 'rq')"],
  ]);
}
// The site's plugins (js/v4-site): Postgres, Documentos and Navegador from the community, and the store. They join the
// engine, the plugin list and the catalog (community ones under "comunidade"); the store stays out of the catalog,
// since in the app it is part of Plugins.
const SITE = ['banco', 'docs', 'web', 'draw', 'loja'];
const communityPlugins = {
  engine: text => swapAll('engine.mjs', text, [
    ["import plugins from './manifests/plugins.json' with { type: 'json' };", `import plugins from './manifests/plugins.json' with { type: 'json' };\n${SITE.map(p => `import ${p} from '../v4-site/${p}.json' with { type: 'json' };`).join('\n')}`],
    ['config, plugins].map(m => [m.plugin, m])', `config, plugins, ${SITE.join(', ')}].map(m => [m.plugin, m])`],
  ]),
  plugins: text => swapAll('plugins.mjs', text, [
    ["import { sistema, config, plugins } from './sys.mjs';", `import { sistema, config, plugins } from './sys.mjs';\n${SITE.map(p => `import { ${p} } from '../v4-site/${p}.mjs';`).join('\n')}`],
    ['ferramentas, config, plugins];', `ferramentas, config, plugins, ${SITE.join(', ')}];`],
  ]),
  // A plugin can claim a ⌘ shortcut the window does not use, such as ⌘↵ to run a query or ⌘L for an address.
  keys: text => swapAll('keys.mjs', text, [["    const g = lookup(S, ev, 'global');\n    if (g) return g;\n", "    const g = lookup(S, ev, 'global');\n    if (g) return g;\n    const own = !S.ui.side && !S.overlay && keyLabel(ev);\n    if (own && (plugin(focused(S).plugin)?.keys?.(focused(S), S) ?? []).includes(own)) return { type: 'PKEY', key: own };\n"]]),
  sys: text => swapAll('sys.mjs', text, [
    ['const ps = PLUGINS.filter(p => hit(`${p.title} ${p.keywords}`))', 'const ps = PLUGINS.filter(p => !p.community && !p.store && hit(`${p.title} ${p.keywords}`)), cs = PLUGINS.filter(p => p.community && hit(`${p.title} ${p.keywords}`))'],
    ['`${ps.length + sv.length} de', '`${ps.length + cs.length + sv.length} de'],
    ["}), h('serviços', String(sv.length)),", "}), ...(cs.length ? [h('comunidade', String(cs.length)), ...cs.map(p => { const off = S.disabled.includes(p.id); return row(p.id, off ? '○' : '●', `${p.glyph} ${p.title}`, `@${p.author} · ${off ? 'desligado' : 'ligado'}`, off ? 'dim' : null, { kind: 'plugin' }); })] : []), h('serviços', String(sv.length)),"],
  ]),
  // ⌘J opens the Chat beside the pane whenever it is wider than tall, so the Chat lands in the middle of the page.
  model: text => swapAll('model.mjs', text, [["const axis = r.w * S.ui.vw >= 1.6 * r.h * S.ui.vh ? 'row' : 'col';", "const axis = r.w * S.ui.vw >= r.h * S.ui.vh ? 'row' : 'col';"]]),
  // A plugin can draw a line as its own HTML; a line with an id still takes the cursor (the store's cards).
  view: text => swapAll('view.mjs', text, [["    case 'hr': return '<div class=\"hr\"></div>';", "    case 'hr': return '<div class=\"hr\"></div>';\n    case 'tui': return cur ? l.html.replace(/^<([\\w-]+)/, `<$1${c}`) : l.html;"]]),
};
// Four workspaces running at once, each with the state of its pull request or its agent.
function liveWorkspaces(m) {
  m.seed.workspaces = [
    { id: 'ws1', name: 'login', branch: 'feature/login', path: '~/dev/cadente/.worktrees/login', archived: false, g: '●', tone: 'err', status: 'PR #251 · CI falhou em cargo test' },
    { id: 'ws2', name: 'painéis', branch: 'feature/universal-panes', path: '~/dev/cadente/.worktrees/panes', archived: false, g: '●', tone: 'ok', status: 'PR #248 · aprovado, pronto para merge' },
    { id: 'ws3', name: 'busca', branch: 'feature/sidebar-search', path: '~/dev/cadente/.worktrees/search', archived: false, g: '●', tone: 'accent', status: 'claude trabalhando · 3 min' },
    { id: 'ws4', name: 'tema', branch: 'feature/high-contrast', path: '~/dev/cadente/.worktrees/theme', archived: false, g: '●', tone: 'warn', status: 'PR #253 · esperando revisão' },
    ...m.seed.workspaces.filter(w => w.archived),
  ];
  Object.assign(m.lists.workspaces.row, { g: '${g}', meta: '${status}', tone: '${tone}' });
  return m;
}
// Collection items carry their method, and opening one sets it.
function brunoCollections(m) {
  for (const c of m.seed.collections) if (c.kind === 'request') c.method = c.name.split(' ')[0];
  m.lists.collections.enter.ops.unshift({ op: 'set', path: 'store.reqDraft.method', value: '${method}' });
  return m;
}
function swapAll(file, text, swaps) {
  for (const [from, to] of swaps) {
    const next = text.replace(from, to);
    if (next === text) throw new Error(`${file} changed upstream: could not apply ${from}`);
    text = next;
  }
  return text;
}
function adapt(file, text) {
  const next = neutral(english(text));
  const a = text.split('\n'), b = next.split('\n');
  a.forEach((line, i) => { if (line !== b[i]) changes.push(`${file}:${i + 1}: ${b[i].trim().slice(0, 140)}`); });
  return next;
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'manifests'), { recursive: true });

for (const m of MODULES) {
  let text = fs.readFileSync(path.join(src, `${m}.mjs`), 'utf8');
  if (m === 'life') text = text.replace("name: 'abrir'", "name: 'open'");
  if (m === 'dev') text = moreAgents(text);
  if (m === 'apis') text = restfulRequests(text);
  if (communityPlugins[m]) text = communityPlugins[m](text);
  fs.writeFileSync(path.join(out, `${m}.mjs`), `// Generated by scripts/sync-v4.mjs from the Cadente v4 prototype. Do not edit.\n${adapt(`${m}.mjs`, text)}`);
}
fs.writeFileSync(path.join(out, 'capability-map.json'), `${JSON.stringify({ commands: [] })}\n`);

for (const f of fs.readdirSync(path.join(src, 'manifests')).filter(f => f.endsWith('.json'))) {
  let m = JSON.parse(adapt(`manifests/${f}`, fs.readFileSync(path.join(src, 'manifests', f), 'utf8')));
  if (f === 'requests.json') m = brunoCollections(m);
  if (f === 'workspaces.json') m = liveWorkspaces(m);
  const seen = new Set();
  for (const c of m.commands ?? []) {
    c.name = COMMANDS[c.name] ?? c.name;
    if (seen.has(c.name)) throw new Error(`${f}: two commands became /${c.name}`);
    seen.add(c.name);
  }
  fs.writeFileSync(path.join(out, 'manifests', f), `${JSON.stringify(m, null, 1)}\n`);
}

// shell.css → css/v4.css: every selector under `.v4`; keyframes renamed so they cannot clash with the page.
function scope(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0, res = '';
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const prelude = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (depth && j < css.length) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const body = css.slice(open, j);
    if (prelude.startsWith('@keyframes')) res += `${prelude.replace(/@keyframes\s+(\S+)/, '@keyframes v4-$1')} ${body}\n`;
    else {
      const sel = prelude.split(',').map(s => s.trim()).map(s => /^(html|body|#app)$/.test(s) ? null : s === '*' ? '.v4 *' : `.v4 ${s}`).filter(Boolean);
      const unique = [...new Set(sel.length ? sel : ['.v4'])];
      res += `${prelude.split(',').some(s => /^(html|body|#app)$/.test(s.trim())) ? '.v4' : unique.join(', ')} ${body.replace(/animation:\s*(\w+)/g, 'animation: v4-$1')}\n`;
    }
    i = j;
  }
  return res;
}
const shell = scope(fs.readFileSync(path.join(src, 'shell.css'), 'utf8'))
  .replace('.v4 { height: 100%; overflow: hidden;', '.v4 { height: 100%; overflow: hidden; position: relative;');
fs.writeFileSync(cssOut, `/* Generated by scripts/sync-v4.mjs from the Cadente v4 prototype (shell.css). Do not edit. */\n${shell}`);

// Nothing private may be left in what was written.
const written = [cssOut, ...fs.readdirSync(out, { recursive: true }).map(f => path.join(out, f)).filter(f => fs.statSync(f).isFile())];
const leaks = written.flatMap(f => PRIVATE.leaks(fs.readFileSync(f, 'utf8'), path.relative(root, f)));
if (leaks.length) throw new Error(`private names left after the sync:\n${leaks.join('\n')}`);

console.log(`v4 synced: ${MODULES.length} modules, manifests and css/v4.css, no private names`);
console.log(`${changes.length} adapted lines:\n${changes.join('\n')}`);
