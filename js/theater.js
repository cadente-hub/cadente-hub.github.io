// The story told by the Cadente window: open, pick a plugin, run several agents side by side, open more pages,
// install from the store, work the database, notes and the web, bring any account, own every part, then reach
// everything from the keyboard. Each chapter is a script of real keystrokes played on the v4 prototype; played in
// order they build one session.
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
      await cli(s, id, 'claude', 'abrir o Claude Code', 'adicione um teste para focus_neighbor no fim de layout.rs, sem rodar nada');
      await s.ticks(2, id);
    },
  },
  {
    step: 'Agentes',
    title: 'Todos os agentes juntos.',
    text: '<kbd>⌘D</kbd> divide para o lado e <kbd>⌘⇧D</kbd> para baixo. Codex e agy trabalham ao lado do Claude, cada um com a própria tela, e o Terminal de baixo segue sendo seu.',
    async run(s, id) {
      await s.key('⌘D', id);
      await pick(s, id, 'term', 'outro Terminal');
      await cli(s, id, 'codex', 'abrir o Codex', 'rode cargo test e me diga o resultado');
      await s.key('⌘⇧D', id);
      await pick(s, id, 'term', 'mais um');
      await cli(s, id, 'agy', 'abrir o agy', 'explique em uma frase o que layout.rs faz');
      await s.key('⌘⌥←', id);
      await s.key('⌘⇧D', id);
      await pick(s, id, 'term', 'um Terminal para você');
      await s.wait(300, id);
      await s.type('git status', id, { speed: 1.4 });
      await s.key('↵', id, { label: 'rodar' });
      await s.wait(600, id);
      await s.type('cargo test', id, { speed: 1.4 });
      await s.key('↵', id, { label: 'rodar os testes' });
      await s.ticks(2, id);
    },
  },
  {
    step: 'Workspaces',
    title: 'Quatro workspaces, um olhar.',
    text: 'Cada branch roda no seu worktree: uma com o CI quebrado, outra pronta para o merge, outra com o Claude trabalhando. Você abre a quebrada, <kbd>⌘J</kbd> abre o Chat dela e o diff abre do lado.',
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'work', 'abrir Workspaces');
      await s.wait(900, id);
      for (const label of ['login · o CI falhou', 'painéis · pronto para o merge', 'busca · o Claude trabalhando', 'tema · esperando revisão']) await s.key('↓', id, { hold: 650, label });
      await s.key('Home', id, { label: 'voltar ao login' });
      await s.key('↵', id, { label: 'abrir o workspace login' });
      await s.key('⌘J', id, { label: 'Chat ao lado, ligado ao workspace' });
      await s.wait(400, id);
      await s.type('por que o CI falhou?', id, { speed: 1.6 });
      await s.key('↵', id, { label: 'perguntar' });
      await s.key('⌘D', id, { label: 'abrir o diff do lado' });
      await pick(s, id, 'work', 'Workspaces, nas alterações');
      await s.key('⇥', id, { label: 'alterações' });
      await s.key('↓', id, { hold: 300, label: 'descer' });
      await s.key('↵', id, { label: 'abrir o diff' });
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
    step: 'Loja',
    title: 'Faltou algo? Tem na loja.',
    text: '<kbd>⌘⇧D</kbd> abre uma folha nova com a Loja, onde ficam os plugins da comunidade. Você busca o Postgres, vê o que ele pede para acessar e instala com <kbd>↵</kbd>, de graça. A mesma folha já vira o Postgres.',
    async run(s, id) {
      await s.key('⌘⇧D', id);
      await pick(s, id, 'loja', 'abrir a Loja');
      await s.wait(700, id);
      for (const label of ['Excalidraw', 'Kanban', 'Rádio lo-fi', 'Tema Neon', 'Kubernetes']) await s.key('↓', id, { hold: 380, label });
      await s.wait(300, id);
      await s.type('postgres', id, { speed: 1.4 });
      await s.wait(300, id);
      await s.key('↵', id, { label: 'ver o Postgres da @leo' });
      await s.wait(1400, id);
      await s.key('↵', id, { label: 'instalar, grátis' });
      await s.wait(800, id);
      await s.ticks(1, id);
      await s.wait(900, id);
      await s.ticks(1, id);
      await s.wait(900, id);
    },
  },
  {
    step: 'Banco',
    title: 'E o banco, como no DBeaver.',
    text: 'Navegador à esquerda, o script no meio, o resultado embaixo. Você desce pelos selects e <kbd>⌘↵</kbd> roda o que está no cursor. <kbd>End</kbd> edita a linha ali mesmo, sem barra de comando. <kbd>⇥</kbd> vai às tabelas e <kbd>↵</kbd> abre os dados.',
    async run(s, id) {
      await s.key('⌘⇧↵', id, { label: 'ampliar a folha' });
      await s.wait(500, id);
      await s.key('⌘↵', id, { label: 'rodar o select do cursor' });
      await s.ticks(1, id);
      await s.wait(500, id);
      for (let i = 0; i < 5; i++) await s.key('↓', id, { hold: 240, label: 'descer pelo script' });
      await s.key('⌘↵', id, { label: 'rodar este select' });
      await s.ticks(1, id);
      await s.wait(500, id);
      for (let i = 0; i < 2; i++) await s.key('↓', id, { hold: 300, label: 'até o order by' });
      await s.key('End', id, { label: 'editar a linha, ali mesmo' });
      await s.key('⌥⌫', id, { label: 'apagar a última palavra' });
      await s.type('paineis desc;', id, { speed: 1.3 });
      await s.key('⌘↵', id, { label: 'gravar e rodar' });
      await s.ticks(1, id);
      await s.wait(700, id);
      for (let i = 0; i < 3; i++) await s.key('↓', id, { hold: 240, label: 'o select de baixo' });
      await s.key('⌘↵', id, { label: 'rodar' });
      await s.ticks(1, id);
      await s.wait(600, id);
      await s.key('⇥', id, { label: 'navegador do banco' });
      for (const label of ['usuarios', 'sessoes']) await s.key('↓', id, { hold: 320, label });
      await s.key('↵', id, { label: 'ver os dados da tabela' });
      await s.ticks(1, id);
      await s.wait(900, id);
      await s.key('⇥', id, { label: 'voltar ao script' });
      await s.key('⌘⇧↵', id, { label: 'voltar às duas folhas' });
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
    text: 'Calendário, o pomodoro do Foco, o Sistema e quanto você já usou do Claude. <kbd>⌘1</kbd> a <kbd>⌘4</kbd> pulam de uma página para outra.',
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
      await s.wait(1200, id);
      await s.key('⌘2', id, { label: 'página 2: os workspaces' });
      await s.wait(1100, id);
      await s.key('⌘3', id, { label: 'página 3: a API e o banco' });
      await s.wait(1000, id);
      await s.key('⌘4', id, { label: 'página 4: o seu dia' });
      await s.wait(500, id);
    },
  },
  {
    step: 'Notas',
    title: 'Suas notas, como no Obsidian.',
    text: 'O Documentos, da comunidade, guarda cada nota como um arquivo .md na sua pasta. Você abre a ata da reunião e escreve direto no texto: <kbd>↵</kbd> puxa a próxima tarefa e <kbd>espaço</kbd> marca como feita. Nada disso precisa de IA.',
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'doc', 'abrir Documentos');
      await s.wait(600, id);
      for (const label of ['2026-10-30', 'Lançamento', 'Site', 'Produto 30-10']) await s.key('↓', id, { hold: 340, label });
      await s.key('↵', id, { label: 'abrir a nota' });
      await s.wait(700, id);
      for (let i = 0; i < 9; i++) await s.key('↓', id, { hold: 150, label: 'descer pela nota' });
      await s.key('↵', id, { label: 'nova tarefa' });
      await s.type('mandar o changelog para o time', id, { speed: 1.6 });
      await s.key('↵', id, { label: 'a lista continua' });
      await s.type('revisar o [[Lançamento]]', id, { speed: 1.6 });
      await s.key('↵', id, { hold: 300, label: 'a lista continua' });
      await s.key('↵', id, { label: 'fechar a lista' });
      for (let i = 0; i < 4; i++) await s.key('↑', id, { hold: 200, label: 'subir' });
      await s.key('espaço', id, { label: 'marcar como feita' });
      await s.wait(900, id);
    },
  },
  {
    step: 'Web',
    title: 'Um site em outra aba.',
    text: '<kbd>⌘T</kbd> e o Navegador abre o app que você está fazendo, em localhost. <kbd>⌘L</kbd> vai ao endereço, <kbd>↓</kbd> anda pelos links e <kbd>⌫</kbd> volta. O projeto vitrine, criado pelo POST lá atrás, já está na lista.',
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'naveg', 'abrir o Navegador');
      await s.wait(500, id);
      await s.key('⌘L', id, { label: 'ir ao endereço' });
      await s.type('localhost:5173', id, { speed: 1.3 });
      await s.key('↵', id, { label: 'abrir o site' });
      await s.ticks(1, id);
      await s.wait(600, id);
      for (const label of ['mapa', 'vitrine']) await s.key('↓', id, { hold: 420, label });
      await s.key('↵', id, { label: 'abrir o projeto vitrine' });
      await s.ticks(1, id);
      await s.wait(1000, id);
      await s.key('⌫', id, { label: 'voltar' });
      await s.ticks(1, id);
      await s.wait(600, id);
    },
  },
  {
    step: 'Desenho',
    title: 'E o que mais você imaginar.',
    text: 'Quer desenhar a arquitetura? <kbd>⌘D</kbd>, abra a Loja e instale o Excalidraw. A folha vira um quadro ao lado do site: <kbd>r</kbd> faz um retângulo, <kbd>o</kbd> uma elipse e <kbd>a</kbd> liga as duas com uma seta. Tudo pelo teclado.',
    async run(s, id) {
      await s.key('⌘D', id);
      await pick(s, id, 'loja', 'abrir a Loja');
      await s.wait(500, id);
      await s.type('excali', id, { speed: 1.4 });
      await s.wait(300, id);
      await s.key('↵', id, { label: 'ver o Excalidraw' });
      await s.wait(1100, id);
      await s.key('↵', id, { label: 'instalar, grátis' });
      await s.ticks(2, id);
      await s.wait(600, id);
      for (const [key, label, text] of [['r', 'retângulo', 'app web'], ['r', 'outro retângulo', 'API /v1/projects']]) {
        await s.key(key, id, { label });
        await s.type(text, id, { speed: 1.5 });
        await s.key('↵', id, { hold: 300, label: 'guardar o texto' });
      }
      await s.key('a', id, { label: 'ligar com uma seta' });
      await s.key('o', id, { label: 'elipse' });
      await s.type('Postgres', id, { speed: 1.5 });
      await s.key('↵', id, { hold: 300, label: 'guardar o texto' });
      await s.key('a', id, { label: 'mais uma seta' });
      await s.wait(1400, id);
    },
  },
  {
    step: 'Contas',
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
    text: 'Tudo é plugin, até o que vem de fábrica. Desligue o que não usa com <kbd>espaço</kbd>, inclusive a IA, se quiser o Cadente só para produtividade. Ou troque o provider de IA, vendo antes o que vai mudar.',
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
