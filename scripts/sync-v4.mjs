#!/usr/bin/env node
// Copies the frozen Cadente v4 prototype into the site and adapts it for a public web page:
// - slash commands in English (the app's decision of 2026-10-30), with a guard against clashes;
// - the private checkout name replaced by a neutral path;
// - no internal capability census (the palette lists actions and plugins only);
// - shell.css scoped under `.v4`, so the prototype never styles the rest of the page.
// Usage: node scripts/sync-v4.mjs [path/to/design/prototypes/cadente-warp-slint/v4]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(process.argv[2] ?? path.join(root, '../catarina-claude/design/prototypes/cadente-warp-slint/v4'));
const out = path.join(root, 'js/v4');
const cssOut = path.join(root, 'css/v4.css');

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
// The public page shows no personal names: the prototype's sample account becomes a neutral one.
const neutral = text => text.replaceAll('catarina-claude', 'cadente').replaceAll('jeancatarina', 'voce').replace(/\bjean(?=[@/])/g, 'voce');

const changes = [];
// The site's copy of the prototype gets three small additions for the demo. The Terminal follows two agent CLIs,
// claude and codex; the site shows more of them side by side,
// so the copy learns agy, gemini and opencode with the same step script format ('?' asks you, '✓' finishes).
const EXTRA_AGENTS = {
  agy: { model: 'gemini 3 pro', steps: ['lendo src/auth/login.ts', 'escrevendo login.test.ts  +48', '?rodar `npm test`', 'rodando npm test', '✓12 testes novos · todos passam'] },
  gemini: { model: 'gemini 2.5 pro', steps: ['lendo docs/', 'resumindo 14 arquivos', '✓resumo salvo em RESUMO.md'] },
  opencode: { model: 'qwen3 coder · ollama', steps: ['indexando o repositório', 'refatorando cache.rs  +21 −14', 'rodando cargo check', '✓refatoração pronta · build ok'] },
};
function moreAgents(text) {
  const swaps = [
    [/^(const AGENTS = \{\n)/m, `$1${Object.entries(EXTRA_AGENTS).map(([k, v]) => `  ${k}: ${JSON.stringify(v.steps)},\n`).join('')}`],
    [/^const MODEL = \{ claude: 'opus 4.6', codex: 'gpt-5 codex' \};$/m, `const MODEL = { claude: 'opus 4.6', codex: 'gpt-5 codex', ${Object.entries(EXTRA_AGENTS).map(([k, v]) => `${k}: '${v.model}'`).join(', ')} };`],
    ['cmd.match(/^(claude|codex)\\b', `cmd.match(/^(claude|codex|${Object.keys(EXTRA_AGENTS).join('|')})\\b`],
    // A database query in the Terminal: psql answers with the projects table after the POST and DELETE of Requests.
    [/^(const SHELL = \{\n)/m, `$1  psql: () => [${PSQL.map(l => JSON.stringify(l)).join(', ')}],\n`],
  ];
  return swapAll('dev.mjs', text, swaps);
}
const PSQL = ['   id    |  nome   | paineis', '---------+---------+---------', ' proj_01 | cadente |       4', ' proj_03 | nora    |       0', '(2 linhas)'];
// Requests answers each method the way an API would: 201 with the new item for POST, 204 for DELETE.
function restfulRequests(text) {
  return swapAll('apis.mjs', text, [
    ["status: 200, ms: 184, size: '1,2 KB', headers: r.headers", "status: { POST: 201, DELETE: 204 }[d.method] ?? 200, ms: { POST: 212, DELETE: 96 }[d.method] ?? 184, size: { POST: '64 B', DELETE: '0 B' }[d.method] ?? '1,2 KB', headers: r.headers"],
    ["status: last.error ? 'erro' : 200, url: r.url", 'status: last.error ? \'erro\' : last.status, url: r.url'],
    [": leaf.data.raw ? [BODY.join('').replace(/\\s+/g, ' ')] : BODY;", ": leaf.data.raw ? [BODY.join('').replace(/\\s+/g, ' ')] : { POST: ['{ \"id\": \"proj_03\", \"name\": \"nora\", \"panes\": 0 }'], DELETE: [] }[last.method] ?? BODY;"],
    ['`${last.status} OK · ${last.ms} ms', "`${last.status} ${{ 201: 'Created', 204: 'No Content' }[last.status] ?? 'OK'} · ${last.ms} ms"],
  ]);
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
  fs.writeFileSync(path.join(out, `${m}.mjs`), `// Generated by scripts/sync-v4.mjs from the Cadente v4 prototype. Do not edit.\n${adapt(`${m}.mjs`, text)}`);
}
fs.writeFileSync(path.join(out, 'capability-map.json'), `${JSON.stringify({ commands: [] })}\n`);

for (const f of fs.readdirSync(path.join(src, 'manifests')).filter(f => f.endsWith('.json'))) {
  const m = JSON.parse(adapt(`manifests/${f}`, fs.readFileSync(path.join(src, 'manifests', f), 'utf8')));
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

console.log(`v4 synced from ${path.relative(root, src)}: ${MODULES.length} modules, manifests and css/v4.css`);
console.log(`${changes.length} adapted lines:\n${changes.join('\n')}`);
