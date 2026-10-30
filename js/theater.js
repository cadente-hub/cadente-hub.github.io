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
// Starts an agent CLI in the focused Terminal.
async function agent(s, id, cmd, label) {
  await s.wait(300, id);
  await s.type(cmd, id, { speed: 2.4 });
  await s.key('↵', id, { label });
}

export const CHAPTERS = [
  {
    step: 'Abrir',
    title: 'Abra o Cadente.',
    text: 'Uma janela preta, uma folha e o teclado. O Início mostra o seu dia: agenda, tarefas, notas e o que ficou aberto. <kbd>⇥</kbd> troca de vista.',
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
    title: 'Escolha um plugin.',
    text: '<kbd>⌘O</kbd> abre o seletor. Três letras e <kbd>↵</kbd>, e a folha vira o que você precisa. Aqui, um Terminal com o Claude Code trabalhando.',
    async run(s, id) {
      await s.key('⌘O', id);
      await pick(s, id, 'term', 'abrir o Terminal');
      await agent(s, id, 'claude "feche a folha sem perder o foco"', 'o Claude Code começa');
      await s.ticks(2, id);
    },
  },
  {
    step: 'Agentes',
    title: 'Todos os agentes juntos.',
    text: '<kbd>⌘D</kbd> divide à direita e <kbd>⌘⇧D</kbd> divide abaixo. Claude Code, Codex, agy e OpenCode rodam lado a lado, e qualquer outra CLI também.',
    async run(s, id) {
      await s.key('⌘D', id);
      await pick(s, id, 'term', 'outro Terminal');
      await agent(s, id, 'codex "migre a tabela de sessões"', 'o Codex começa');
      await s.key('⌘⇧D', id);
      await pick(s, id, 'term', 'mais um Terminal');
      await agent(s, id, 'agy "escreva os testes do login"', 'o agy começa');
      await s.key('⌘⌥←', id);
      await s.key('⌘⇧D', id);
      await pick(s, id, 'term', 'e mais um');
      await agent(s, id, 'opencode "refatore o cache"', 'o OpenCode começa, com um modelo local');
      await s.ticks(2, id);
    },
  },
  {
    step: 'Nova página',
    title: 'Abra outra página.',
    text: '<kbd>⌘T</kbd> abre uma aba nova, e os agentes da primeira continuam trabalhando. Aqui, o Requests faz um GET, um DELETE e um POST, e o histórico guarda tudo.',
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'req', 'abrir o Requests');
      for (const [req, label] of [['GET https://api.example.test/v1/projects', 'listar projetos'], ['DELETE https://api.example.test/v1/projects/proj_02', 'apagar um projeto'], ['POST https://api.example.test/v1/projects', 'criar um projeto']]) {
        await s.wait(300, id);
        await s.type(req, id, { speed: 2.6 });
        await s.key('↵', id, { label });
        await s.wait(900, id);
      }
      for (let i = 0; i < 4; i++) await s.key('⇥', id, { hold: 200, label: 'histórico' });
      await s.wait(1200, id);
      for (let i = 0; i < 4; i++) await s.key('⇧⇥', id, { hold: 120, label: 'de volta à resposta' });
    },
  },
  {
    step: 'Banco',
    title: 'O banco na folha de baixo.',
    text: 'Um Terminal abaixo consulta o Postgres com o <code>psql</code> e mostra o projeto que o POST criou. <kbd>⌘J</kbd> abre um Chat ao lado que já sabe de qual request você fala.',
    async run(s, id) {
      await s.key('⌘⇧D', id);
      await pick(s, id, 'term', 'abrir um Terminal');
      await s.wait(300, id);
      await s.type('psql -c "select id, nome, paineis from projetos"', id, { speed: 2.4 });
      await s.key('↵', id, { label: 'consultar o banco' });
      await s.wait(1300, id);
      await s.key('⌘⌥↑', id);
      await s.key('⌘J', id);
      await s.wait(500, id);
      await s.type('o POST salvou no banco?', id, { speed: 1.6 });
      await s.key('↵', id, { label: 'perguntar sobre o request' });
      await s.ticks(2, id);
    },
  },
  {
    step: 'Mais uma',
    title: 'Uma página para cada coisa.',
    text: 'Mais uma aba, agora para o dia: Calendário, Sistema ao vivo e o Uso das suas contas. <kbd>⌘1</kbd>, <kbd>⌘2</kbd> e <kbd>⌘3</kbd> trocam de página.',
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'cal', 'abrir o Calendário');
      await s.key('⌘D', id);
      await pick(s, id, 'sis', 'abrir o Sistema');
      await s.key('⌘⇧D', id);
      await pick(s, id, 'uso', 'abrir o Uso');
      await s.wait(900, id);
      await s.key('⌘1', id, { label: 'página 1: os agentes' });
      await s.wait(1300, id);
      await s.key('⌘2', id, { label: 'página 2: a API e o banco' });
      await s.wait(1100, id);
      await s.key('⌘3', id, { label: 'página 3: o dia' });
      await s.wait(500, id);
    },
  },
  {
    step: 'Qualquer conta',
    title: 'Qualquer assinatura.',
    text: 'Traga qualquer agente e qualquer conta: o plano do Claude ou do ChatGPT que você já paga, uma chave de API ou um modelo no seu computador.',
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
    step: 'Você é o dono',
    title: 'Você é o dono.',
    text: 'Tudo é plugin, até o que vem de fábrica. Desligue o que não usa com <kbd>espaço</kbd> e troque o provider de IA, o terminal ou a compactação, com prévia antes de aplicar.',
    async run(s, id) {
      await s.key('⌘O', id);
      await pick(s, id, 'plug', 'abrir Plugins');
      await s.wait(500, id);
      for (let i = 0; i < 9; i++) await s.key('↓', id, { hold: 80, label: 'próximo item' });
      await s.key('espaço', id, { label: 'desligar o Foco' });
      await s.key('↓', id, { label: 'próximo item' });
      await s.key('espaço', id, { label: 'desligar Automações' });
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
    title: 'Tudo a um atalho.',
    text: '<kbd>⌘⇧A</kbd> lista os agentes de todas as páginas, do mais urgente ao mais calmo. <kbd>↵</kbd> leva até ele e <kbd>y</kbd> responde. <kbd>⌘;</kbd> põe uma letra em cada folha.',
    async run(s, id) {
      await s.key('⌘⇧A', id);
      await s.wait(1600, id);
      await s.key('↵', id, { label: 'ir ao agente que espera' });
      await s.wait(600, id);
      await s.key('y', id, { label: 'permitir' });
      await s.wait(900, id);
      await s.key('⌘;', id);
      await s.wait(1100, id);
      const cal = jumpLabels(s.S).find(l => s.S.tabs.find(t => t.id === l.tab) && leaves(s.S.tabs.find(t => t.id === l.tab).tree).find(x => x.id === l.leaf)?.plugin === 'calendario');
      if (cal) await s.key(cal.label, id, { label: 'saltar para o Calendário, em outra página' });
      else await s.key('esc', id);
      await s.wait(800, id);
    },
  },
];

export const paneCount = S => leaves(activeTab(S).tree).length;
