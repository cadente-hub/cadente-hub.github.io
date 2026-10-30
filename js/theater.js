// The story told by the Cadente window: open, pick a plugin, run several agents side by side, open more pages,
// bring any account, own every part, then reach everything from the keyboard. Each chapter is a script of real
// keystrokes played on the v4 prototype; played in order they build one session.
import { createState, leaves, activeTab, jumpLabels } from './v4/model.mjs';

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
  await s.wait(900, id);
  await s.type(task, id, { speed: 2 });
  await s.key('↵', id, { label: 'mandar a tarefa' });
}

export const CHAPTERS = [
  {
    step: 'Abrir',
    title: 'Abra e comece.',
    text: 'Começa com uma folha só e o seu dia nela: agenda, tarefas e o que ficou aberto ontem. <kbd>⇥</kbd> troca de vista.',
    async run(s, id) {
      s.boot();
      await s.wait(1300, id);
      await s.key('⇥', id, { label: 'próxima vista' });
      await s.wait(700, id);
      await s.key('⇥', id, { label: 'próxima vista' });
      await s.wait(700, id);
      await s.key('⇧⇥', id, { label: 'vista anterior' });
      await s.key('⇧⇥', id, { label: 'vista anterior' });
    },
  },
  {
    step: 'Escolher',
    title: 'Chame quem você precisa.',
    text: 'Aperte <kbd>⌘O</kbd>, digite três letras e a folha vira um Terminal. Daí é só abrir o Claude Code e pedir.',
    async run(s, id) {
      await s.key('⌘O', id);
      await pick(s, id, 'term', 'abrir o Terminal');
      await cli(s, id, 'claude', 'abrir o Claude Code', 'feche a folha sem perder o foco');
      await s.ticks(2, id);
    },
  },
  {
    step: 'Agentes',
    title: 'Todos os agentes juntos.',
    text: '<kbd>⌘D</kbd> divide para o lado e <kbd>⌘⇧D</kbd> para baixo. Codex, agy e OpenCode trabalham ao lado do Claude, cada um com a cara de sempre.',
    async run(s, id) {
      await s.key('⌘D', id);
      await pick(s, id, 'term', 'outro Terminal');
      await cli(s, id, 'codex', 'abrir o Codex', 'migre a tabela de sessões');
      await s.key('⌘⇧D', id);
      await pick(s, id, 'term', 'mais um');
      await cli(s, id, 'agy', 'abrir o agy', 'escreva os testes do login');
      await s.key('⌘⌥←', id);
      await s.key('⌘⇧D', id);
      await pick(s, id, 'term', 'e mais um');
      await cli(s, id, 'opencode', 'abrir o OpenCode, com um modelo local', 'refatore o cache');
      await s.ticks(2, id);
    },
  },
  {
    step: 'API',
    title: 'Uma página para a API.',
    text: '<kbd>⌘T</kbd> abre outra aba, e os agentes seguem trabalhando na primeira. No Requests você anda pela coleção, troca o <code>limit</code> e manda o GET, como no Bruno, sem tirar a mão do teclado.',
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'req', 'abrir o Requests');
      await s.key('⇥', id, { hold: 300, label: 'requisição' });
      await s.key('⇥', id, { label: 'coleções' });
      await s.key('↓', id, { hold: 300, label: 'coleção projetos' });
      await s.key('↓', id, { label: 'GET /v1/projects' });
      await s.key('↵', id, { label: 'abrir o request' });
      for (let i = 0; i < 3; i++) await s.key('↓', id, { hold: 260, label: 'descer até o limit' });
      await s.key('↵', id, { label: 'editar o limit' });
      await s.key('⌘⌫', id, { label: 'apagar o valor' });
      await s.type('5', id);
      await s.key('↵', id, { label: 'gravar' });
      await s.key('Home', id, { label: 'voltar ao enviar' });
      await s.key('↵', id, { label: 'enviar o GET' });
      await s.wait(1300, id);
      await s.key('⇥', id, { hold: 260, label: 'requisição' });
      await s.key('⇥', id, { label: 'coleções' });
      for (let i = 0; i < 2; i++) await s.key('↓', id, { hold: 260, label: 'descer' });
      await s.key('↓', id, { label: 'POST /v1/projects' });
      await s.key('↵', id, { label: 'abrir o request' });
      await s.key('↵', id, { label: 'enviar o POST' });
      await s.wait(1200, id);
    },
  },
  {
    step: 'Banco',
    title: 'E o banco logo abaixo.',
    text: 'O Postgres, instalado da loja, mostra as suas consultas salvas. Você passa por elas e roda só a que interessa. <kbd>⌘J</kbd> abre um Chat que já sabe de qual request você está falando.',
    async run(s, id) {
      await s.key('⌘⇧D', id);
      await pick(s, id, 'post', 'abrir o Postgres');
      await s.wait(500, id);
      for (let i = 0; i < 3; i++) await s.key('↓', id, { hold: 420, label: 'próxima consulta' });
      for (let i = 0; i < 2; i++) await s.key('↑', id, { hold: 360, label: 'voltar' });
      await s.key('↵', id, { label: 'rodar só esta' });
      await s.ticks(1, id);
      await s.wait(700, id);
      await s.key('⌘⌥↑', id);
      await s.key('⌘J', id);
      await s.wait(400, id);
      await s.type('o POST salvou no banco?', id, { speed: 1.6 });
      await s.key('↵', id, { label: 'perguntar' });
      await s.ticks(2, id);
    },
  },
  {
    step: 'Seu dia',
    title: 'Uma página para o seu dia.',
    text: 'Calendário, o pomodoro do Foco, o Sistema e quanto você já usou do Claude. <kbd>⌘1</kbd>, <kbd>⌘2</kbd> e <kbd>⌘3</kbd> pulam de uma página para outra.',
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'cal', 'abrir o Calendário');
      await s.key('⌘D', id);
      await pick(s, id, 'foco', 'abrir o Foco');
      await s.key('espaço', id, { label: 'começar um pomodoro' });
      await s.key('⌘⇧D', id);
      await pick(s, id, 'sis', 'abrir o Sistema');
      await s.key('⌘⌥←', id);
      await s.key('⌘⇧D', id);
      await pick(s, id, 'uso', 'abrir o Uso');
      await s.wait(900, id);
      await s.key('⌘1', id, { label: 'página 1: os agentes' });
      await s.wait(1300, id);
      await s.key('⌘2', id, { label: 'página 2: a API e o banco' });
      await s.wait(1100, id);
      await s.key('⌘3', id, { label: 'página 3: o seu dia' });
      await s.wait(500, id);
    },
  },
  {
    step: 'Assinaturas',
    title: 'Use a assinatura que você já tem.',
    text: 'Claude Max, ChatGPT Plus, uma chave do Gemini ou um modelo rodando no seu notebook. Cada conversa escolhe a sua.',
    async run(s, id) {
      await s.key('⌘,', id);
      await s.wait(400, id);
      await s.key('⌘⇧↵', id);
      for (let i = 0; i < 4; i++) await s.key('⇥', id, { hold: 260, label: 'próxima vista' });
      await s.wait(700, id);
      for (let i = 0; i < 4; i++) await s.key('↓', id, { hold: 420, label: 'próxima conta' });
      await s.wait(600, id);
    },
  },
  {
    step: 'Você manda',
    title: 'Quem manda aqui é você.',
    text: 'Tudo é plugin, até o que vem de fábrica. Desligue o que não usa com <kbd>espaço</kbd> e troque o provider de IA vendo antes o que vai mudar.',
    async run(s, id) {
      await s.key('⌘O', id);
      await pick(s, id, 'plug', 'abrir Plugins');
      await s.wait(500, id);
      for (let i = 0; i < 14; i++) await s.key('↓', id, { hold: 60, label: 'descer' });
      await s.key('espaço', id, { label: 'desligar Links' });
      await s.key('↓', id, { label: 'descer' });
      await s.key('espaço', id, { label: 'desligar Ferramentas' });
      await s.wait(500, id);
      await s.key('End', id, { label: 'último item' });
      await s.key('↑', id, { label: 'provider de IA' });
      await s.key('↵', id, { label: 'trocar provider' });
      await s.wait(500, id);
      await s.key('↓', id, { label: 'Ollama, no seu computador' });
      await s.key('↵', id, { label: 'ver a prévia' });
      await s.wait(1200, id);
      await s.key('y', id, { label: 'aplicar' });
      await s.wait(1200, id);
      await s.key('⌘⇧↵', id);
    },
  },
  {
    step: 'Atalhos',
    title: 'Nada fica escondido.',
    text: '<kbd>⌘⇧A</kbd> mostra os agentes de todas as páginas, quem precisa de você primeiro. <kbd>↵</kbd> leva até lá e <kbd>y</kbd> responde. <kbd>⌘;</kbd> põe uma letra em cada folha.',
    async run(s, id) {
      await s.key('⌘⇧A', id);
      await s.wait(1600, id);
      await s.key('↵', id, { label: 'ir até quem espera' });
      await s.wait(600, id);
      await s.key('y', id, { label: 'permitir' });
      await s.wait(900, id);
      await s.key('⌘;', id);
      await s.wait(1100, id);
      const cal = jumpLabels(s.S).find(l => leaves(s.S.tabs.find(t => t.id === l.tab)?.tree ?? { kind: 'leaf' }).find(x => x.id === l.leaf)?.plugin === 'calendario');
      if (cal) await s.key(cal.label, id, { label: 'saltar para o Calendário, em outra página' });
      else await s.key('esc', id);
      await s.wait(800, id);
    },
  },
];

export const paneCount = S => leaves(activeTab(S).tree).length;
