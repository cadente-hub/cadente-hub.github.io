// The story told by the Cadente window: one working day. The morning opens on the agenda, the Claude gets a test to
// write while two more agents help, the CI of another branch breaks, then the feature of the day: an API that
// creates projects, checked in the database (installed from the store), seen in the app, drawn for the meeting,
// noted in the meeting minutes, followed by focus time, accounts, plugins, and the agents still waiting at the end. Each chapter is a script of real keystrokes played on the v4 prototype; played in
// order they build one session.
import { createState, leaves, activeTab, jumpLabels } from './v4/model.mjs';
import { t } from './i18n.js';

// The words of each chapter (js.theater.chapters.<id>) and of the keycaps under the window (js.theater.hud.<key>).
const chapter = id => ({ id, step: t(`theater.chapters.${id}.step`), title: t(`theater.chapters.${id}.title`), text: t(`theater.chapters.${id}.text`) });
const L = key => t(`theater.hud.${key}`);

// Accounts shown in Configurações › contas: subscriptions, an API key and a local model.
const ACCOUNTS = [
  { id: 'acc-1', name: 'Claude Max', provider: 'assinatura · Claude CLI', model: 'opus 4.6', status: 'válida', active: true },
  { id: 'acc-2', name: 'ChatGPT Plus', provider: 'assinatura · Codex CLI', model: 'gpt-5 codex', status: 'válida', active: false },
  { id: 'acc-3', name: 'Gemini', provider: 'chave de API · Google', model: 'gemini 2.5 pro', status: 'válida', active: false },
  { id: 'acc-4', name: 'OpenRouter', provider: 'chave de API', model: 'deepseek v3', status: 'válida', active: false },
  { id: 'acc-5', name: 'Ollama', provider: 'local · neste computador', model: 'qwen3 coder', status: 'pronta', active: false },
];

export function initial() {
  const S = createState();
  S.store.accounts = structuredClone(ACCOUNTS);
  return S;
}

// Opens a plugin in the pane the picker is showing: type a few letters, then ↵.
async function pick(s, id, letters, label) {
  await s.wait(450, id);
  await s.type(letters, id);
  await s.wait(250, id);
  await s.key('↵', id, { label });
}
// Opens an agent CLI in the focused Terminal and gives it a task inside its own screen.
async function cli(s, id, name, label, task) {
  await s.wait(300, id);
  await s.type(name, id, { speed: 1.4 });
  await s.key('↵', id, { label });
  await s.wait(700, id);
  await s.type(task, id, { speed: 3.2 });
  await s.key('↵', id, { label: L('mandarATarefa') });
}

// Pacing: every wait, keystroke and tick of the scripts below is played at TEMPO of its written length, so the
// story moves like a cut film while each step stays on screen long enough to read. Each chapter opens with a title
// interlude (CARD ms of script time) where the camera pulls back under its title, and leaves PAUSE ms at its end. `secs` is how long a chapter lasts on screen
// with this pacing; the step bars above the window fill over it.
export const TEMPO = 0.72, CARD = 2400, PAUSE = 0;

// How long each chapter lasts on screen, in ms, from its script alone: a stand-in for the Stage adds up the waits.
export async function durations() {
  const out = [];
  for (const c of CHAPTERS) {
    let t = 0;
    const s = { S: initial(), boot() {}, setState() {}, wide() {}, shot() {}, async fade() {}, async whenVisible() {}, async interlude() {},
      async wait(ms) { t += ms; }, async key(k, id, { hold = 520 } = {}) { t += hold; },
      async type(text, id, { speed = 1 } = {}) { t += (text.length * 62.5) / speed; }, async ticks(n) { t += n * 1000 + 250; } };
    await c.run(s);
    out.push((t + CARD + PAUSE) * TEMPO);
  }
  return out;
}

export const CHAPTERS = [
  {
    ...chapter('morning'),
    async run(s, id) {
      s.boot();
      await s.wait(900, id);
      await s.key('⇥', id, { label: L('proximaVista') });
      await s.wait(500, id);
      await s.key('⇥', id, { label: L('proximaVista') });
      await s.wait(500, id);
      await s.key('⇧⇥', id, { hold: 300, label: L('vistaAnterior') });
      await s.key('⇧⇥', id, { label: L('vistaAnterior') });
    },
  },
  {
    ...chapter('claude'),
    async run(s, id) {
      await s.key('⌘O', id);
      await pick(s, id, 'term', L('abrirOTerminal'));
      await cli(s, id, 'claude', L('abrirOClaudeCode'), t('theater.typed.claude'));
      await s.ticks(2, id);
    },
  },
  {
    ...chapter('agents'),
    async run(s, id) {
      await s.key('⌘D', id);
      await pick(s, id, 'term', L('outroTerminal'));
      await cli(s, id, 'codex', L('abrirOCodex'), t('theater.typed.codex'));
      await s.key('⌘⇧D', id);
      await pick(s, id, 'term', L('maisUm'));
      await cli(s, id, 'agy', L('abrirOAgy'), t('theater.typed.agy'));
      await s.key('⌘⌥←', id);
      await s.key('⌘⇧D', id);
      await pick(s, id, 'term', L('umTerminalParaVoce'));
      await s.wait(200, id);
      await s.type('cargo test', id, { speed: 1.8 });
      await s.key('↵', id, { label: L('rodarOsTestes') });
      await s.ticks(2, id);
    },
  },
  {
    ...chapter('ci'),
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'work', L('abrirWorkspaces'));
      await s.wait(500, id);
      for (const label of [L('loginOCiFalhou'), L('paineisProntoParaOMerge'), L('buscaOClaudeTrabalhando'), L('temaEsperandoRevisao')]) await s.key('↓', id, { hold: 560, label });
      await s.key('Home', id, { label: L('voltarAoLogin') });
      await s.key('↵', id, { label: L('abrirOWorkspaceLogin') });
      await s.key('⌘J', id, { label: L('chatAoLadoLigadoAoWorkspace') });
      await s.wait(250, id);
      await s.type(t('theater.typed.ciQuestion'), id, { speed: 2.4 });
      await s.key('↵', id, { label: L('perguntar') });
      await s.key('⌘D', id, { label: L('abrirODiffDoLado') });
      await pick(s, id, 'work', L('workspacesNasAlteracoes'));
      await s.key('⇥', id, { label: L('alteracoes') });
      await s.key('↓', id, { hold: 300, label: L('descer') });
      await s.key('↵', id, { label: L('abrirODiff') });
      await s.ticks(1, id);
    },
  },
  {
    ...chapter('api'),
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'req', L('abrirORequests'));
      await s.key('⇥', id, { hold: 300, label: L('requisicao') });
      await s.key('⇥', id, { label: L('colecoes') });
      await s.key('↓', id, { hold: 300, label: L('colecaoProjetos') });
      await s.key('↓', id, { label: 'GET /v1/projects' });
      await s.key('↵', id, { label: L('abrirORequest') });
      for (let i = 0; i < 3; i++) await s.key('↓', id, { hold: 260, label: L('descerAteOLimit') });
      await s.key('↵', id, { label: L('editarOLimit') });
      await s.key('⌘⌫', id, { label: L('apagarOValor') });
      await s.type('5', id);
      await s.key('↵', id, { label: L('gravar') });
      await s.key('Home', id, { label: L('voltarAoEnviar') });
      await s.key('↵', id, { label: L('enviarOGet') });
      await s.wait(1000, id);
      await s.key('⇥', id, { hold: 260, label: L('requisicao') });
      await s.key('⇥', id, { label: L('colecoes') });
      for (let i = 0; i < 2; i++) await s.key('↓', id, { hold: 260, label: L('descer') });
      await s.key('↓', id, { label: 'POST /v1/projects' });
      await s.key('↵', id, { label: L('abrirORequest') });
      await s.key('↵', id, { label: L('enviarOPost') });
      await s.wait(900, id);
    },
  },
  {
    ...chapter('store'),
    async run(s, id) {
      await s.key('⌘⇧D', id);
      await pick(s, id, 'loja', L('abrirALoja'));
      await s.key('⌘⇧↵', id, { label: L('ampliarAFolha') });
      await s.wait(700, id);
      for (const label of [L('quadro'), 'Kanban', L('radioLoFi')]) await s.key('↓', id, { hold: 380, label });
      await s.type('postgres', id, { speed: 2 });
      await s.wait(300, id);
      await s.key('↵', id, { label: L('abrirAPaginaDoPostgres') });
      await s.wait(500, id);
      s.shot('.pg-shots', 1.22);
      await s.wait(300, id);
      for (const label of [L('proximaFoto'), L('maisUma')]) await s.key('→', id, { hold: 950, label });
      for (const label of [L('asFotos'), L('sobre'), L('oQueEleFaz'), L('atalhos')]) await s.key('↓', id, { hold: 480, label });
      await s.key('Home', id, { label: L('voltarAoTopo') });
      s.shot('.pg-top', 1.35);
      await s.key('↵', id, { label: L('instalarGratis') });
      await s.ticks(2, id);
      s.wide();
      await s.wait(700, id);
    },
  },
  {
    ...chapter('db'),
    async run(s, id) {
      await s.wait(500, id);
      await s.key('⌘↵', id, { label: L('rodarOSelectDoCursor') });
      await s.ticks(1, id);
      await s.wait(500, id);
      for (let i = 0; i < 5; i++) await s.key('↓', id, { hold: 180, label: L('descerPeloScript') });
      await s.key('⌘↵', id, { label: L('rodarEsteSelect') });
      await s.ticks(1, id);
      await s.wait(500, id);
      for (let i = 0; i < 2; i++) await s.key('↓', id, { hold: 300, label: L('ateOOrderBy') });
      s.shot('.dbv-ed', 1.35);
      await s.key('End', id, { label: L('editarALinhaAliMesmo') });
      await s.key('⌥⌫', id, { label: L('apagarAUltimaPalavra') });
      await s.type('paineis desc;', id, { speed: 1.8 });
      await s.key('⌘↵', id, { label: L('gravarERodar') });
      s.shot('.dbv-res', 1.35);
      await s.ticks(1, id);
      await s.wait(500, id);
      s.shot('.dbv-nav', 1.4);
      await s.key('⇥', id, { label: L('navegadorDoBanco') });
      for (const label of ['usuarios', 'sessoes']) await s.key('↓', id, { hold: 320, label });
      await s.key('↵', id, { label: L('verOsDadosDaTabela') });
      s.shot('.dbv-res', 1.35);
      await s.ticks(1, id);
      await s.wait(700, id);
      await s.key('⌘⇧↵', id, { label: L('voltarAsDuasFolhas') });
    },
  },
  {
    ...chapter('app'),
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'naveg', L('abrirONavegador'));
      await s.wait(500, id);
      await s.key('⌘L', id, { label: L('irAoEndereco') });
      await s.type('localhost:5173', id, { speed: 2 });
      await s.key('↵', id, { label: L('abrirOSite') });
      await s.ticks(1, id);
      s.shot('.wb-body', 1.3);
      await s.wait(600, id);
      for (const label of [L('mapa'), L('vitrine')]) await s.key('↓', id, { hold: 420, label });
      await s.key('↵', id, { label: L('abrirOProjetoVitrine') });
      await s.ticks(1, id);
      await s.wait(700, id);
      await s.key('⌫', id, { label: L('voltar') });
      await s.ticks(1, id);
      await s.wait(300, id);
    },
  },
  {
    ...chapter('diagram'),
    async run(s, id) {
      await s.key('⌘D', id);
      await pick(s, id, 'loja', L('abrirALoja'));
      await s.type('quadro', id, { speed: 2 });
      await s.wait(250, id);
      await s.key('↵', id, { label: L('abrirAPaginaDoQuadro') });
      await s.wait(500, id);
      await s.key('→', id, { hold: 900, label: L('proximaFoto') });
      await s.key('↵', id, { label: L('instalarGratis') });
      await s.ticks(2, id);
      s.shot('.xd-svg', 1.2);
      await s.wait(400, id);
      for (const [key, label, text] of [['r', L('retangulo'), t('theater.typed.boardWeb')], ['r', L('outroRetangulo'), 'API /v1/projects']]) {
        await s.key(key, id, { label });
        await s.type(text, id, { speed: 2.3 });
        await s.key('↵', id, { hold: 300, label: L('guardarOTexto') });
      }
      await s.key('a', id, { label: L('ligarComUmaSeta') });
      await s.key('o', id, { label: L('elipse') });
      await s.type('Postgres', id, { speed: 2.3 });
      await s.key('↵', id, { hold: 300, label: L('guardarOTexto') });
      await s.key('a', id, { label: L('maisUmaSeta') });
      await s.wait(1100, id);
    },
  },
  {
    ...chapter('meeting'),
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'doc', L('abrirDocumentos'));
      await s.wait(600, id);
      for (const label of ['2026-10-30', L('lancamento'), 'Site', 'Design 30-10']) await s.key('↓', id, { hold: 340, label });
      await s.key('↵', id, { label: L('abrirANota') });
      s.shot('.mdv-note', 1.3);
      await s.wait(450, id);
      for (let i = 0; i < 9; i++) await s.key('↓', id, { hold: 110, label: L('descerPelaNota') });
      await s.key('↵', id, { label: L('novaTarefa') });
      await s.type(t('theater.typed.task1'), id, { speed: 2.6 });
      await s.key('↵', id, { label: L('aListaContinua') });
      await s.type(t('theater.typed.task2'), id, { speed: 2.6 });
      await s.key('↵', id, { hold: 300, label: L('aListaContinua') });
      await s.key('↵', id, { label: L('fecharALista') });
      for (let i = 0; i < 4; i++) await s.key('↑', id, { hold: 160, label: L('subir') });
      await s.key('espaço', id, { label: L('marcarComoFeita') });
      await s.wait(700, id);
    },
  },
  {
    ...chapter('focus'),
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'cal', L('abrirOCalendario'));
      await s.key('⌘D', id);
      await pick(s, id, 'foco', L('abrirOFoco'));
      await s.key('espaço', id, { label: L('comecarUmPomodoro') });
      await s.key('⌘⇧D', id);
      await pick(s, id, 'sis', L('abrirOSistema'));
      await s.key('⌘⌥←', id);
      await s.key('⌘⇧D', id);
      await pick(s, id, 'uso', L('abrirOUso'));
      await s.wait(600, id);
      await s.key('⌘1', id, { hold: 850, label: L('pagina1OsAgentes') });
      await s.key('⌘3', id, { hold: 850, label: L('pagina3AApiEO') });
      await s.key('⌘5', id, { hold: 850, label: L('pagina5AAta') });
      await s.key('⌘6', id, { label: L('pagina6DeVoltaAoSeu') });
    },
  },
  {
    ...chapter('accounts'),
    async run(s, id) {
      await s.key('⌘,', id);
      await s.wait(250, id);
      await s.key('⌘⇧↵', id);
      for (let i = 0; i < 4; i++) await s.key('⇥', id, { hold: 200, label: L('proximaVista') });
      await s.wait(400, id);
      for (let i = 0; i < 4; i++) await s.key('↓', id, { hold: 380, label: L('proximaConta') });
      await s.wait(300, id);
    },
  },
  {
    ...chapter('plugins'),
    async run(s, id) {
      await s.key('⌘O', id);
      await pick(s, id, 'plug', L('abrirPlugins'));
      await s.wait(500, id);
      for (let i = 0; i < 14; i++) await s.key('↓', id, { hold: 60, label: L('descer') });
      await s.key('espaço', id, { label: L('desligarLinks') });
      await s.key('↓', id, { label: L('descer') });
      await s.key('espaço', id, { label: L('desligarFerramentas') });
      await s.wait(300, id);
      await s.key('End', id, { label: L('ultimoItem') });
      await s.key('↑', id, { label: L('providerDeIa') });
      await s.key('↵', id, { label: L('trocarProvider') });
      await s.wait(500, id);
      await s.key('↓', id, { label: L('ollamaNoSeuComputador') });
      await s.key('↵', id, { label: L('verAPrevia') });
      await s.wait(900, id);
      await s.key('y', id, { label: L('aplicar') });
      await s.wait(800, id);
      await s.key('⌘⇧↵', id);
    },
  },
  {
    ...chapter('end'),
    async run(s, id) {
      await s.key('⌘⇧A', id);
      await s.wait(1200, id);
      await s.key('↵', id, { label: L('irAteQuemEspera') });
      await s.wait(600, id);
      await s.key('y', id, { label: L('permitir') });
      await s.wait(900, id);
      await s.key('⌘;', id);
      await s.wait(1100, id);
      const cal = jumpLabels(s.S).find(l => leaves(s.S.tabs.find(t => t.id === l.tab)?.tree ?? { kind: 'leaf' }).find(x => x.id === l.leaf)?.plugin === 'calendario');
      if (cal) await s.key(cal.label, id, { label: L('saltarParaOCalendarioNaPagina') });
      else await s.key('esc', id);
      await s.wait(800, id);
    },
  },
];

export const paneCount = S => leaves(activeTab(S).tree).length;
