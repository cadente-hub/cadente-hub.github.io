// The story told by the Cadente window: one working day. The morning opens on the agenda, the Claude gets a test to
// write while two more agents help, the CI of another branch breaks, then the feature of the day: an API that
// creates projects, checked in the database (installed from the store), seen in the app, drawn for the meeting,
// noted in the meeting minutes, followed by focus time, accounts, plugins, and the agents still waiting at the end. Each chapter is a script of real keystrokes played on the v4 prototype; played in
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
  await s.wait(700, id);
  await s.type(task, id, { speed: 3.2 });
  await s.key('↵', id, { label: 'mandar a tarefa' });
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
    step: 'Manhã',
    title: '9h. O dia já está montado.',
    text: 'Você abre o Cadente e a primeira folha já mostra o dia: a daily às 9h30, a reunião de design às 14h e um conflito de merge esperando. Sem abrir cinco apps para saber por onde começar. <kbd>⇥</kbd> passa para os recentes e as tarefas.',
    async run(s, id) {
      s.boot();
      await s.wait(900, id);
      await s.key('⇥', id, { label: 'próxima vista' });
      await s.wait(500, id);
      await s.key('⇥', id, { label: 'próxima vista' });
      await s.wait(500, id);
      await s.key('⇧⇥', id, { hold: 300, label: 'vista anterior' });
      await s.key('⇧⇥', id, { label: 'vista anterior' });
    },
  },
  {
    step: 'Claude',
    title: 'Primeiro, um teste para o Claude.',
    text: '<kbd>⌘O</kbd> e quatro letras transformam a folha num Terminal. Você abre o Claude Code com a assinatura que já paga e pede um teste para <code>focus_neighbor</code>. Ele começa a escrever, e você segue para a próxima.',
    async run(s, id) {
      await s.key('⌘O', id);
      await pick(s, id, 'term', 'abrir o Terminal');
      await cli(s, id, 'claude', 'abrir o Claude Code', 'adicione um teste para focus_neighbor no fim de layout.rs, sem rodar nada');
      await s.ticks(2, id);
    },
  },
  {
    step: 'Agentes',
    title: 'Três agentes, nenhuma janela a mais.',
    text: '<kbd>⌘D</kbd> divide a tela para o lado e <kbd>⌘⇧D</kbd> para baixo. O Codex roda os testes, o agy explica o <code>layout.rs</code>, e embaixo do Claude ainda sobra um Terminal para você. Todos trabalhando, todos à vista.',
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
      await s.wait(200, id);
      await s.type('cargo test', id, { speed: 1.8 });
      await s.key('↵', id, { label: 'rodar os testes' });
      await s.ticks(2, id);
    },
  },
  {
    step: 'CI',
    title: 'Aí o CI do login quebra.',
    text: 'Numa página nova estão os quatro branches abertos e o estado de cada PR. O login está vermelho. Você abre o branch e <kbd>⌘J</kbd> chama um Chat que já sabe onde você está, então é só perguntar o motivo. O diff abre do lado.',
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'work', 'abrir Workspaces');
      await s.wait(500, id);
      for (const label of ['login · o CI falhou', 'painéis · pronto para o merge', 'busca · o Claude trabalhando', 'tema · esperando revisão']) await s.key('↓', id, { hold: 560, label });
      await s.key('Home', id, { label: 'voltar ao login' });
      await s.key('↵', id, { label: 'abrir o workspace login' });
      await s.key('⌘J', id, { label: 'Chat ao lado, ligado ao workspace' });
      await s.wait(250, id);
      await s.type('por que o CI falhou?', id, { speed: 2.4 });
      await s.key('↵', id, { label: 'perguntar' });
      await s.key('⌘D', id, { label: 'abrir o diff do lado' });
      await pick(s, id, 'work', 'Workspaces, nas alterações');
      await s.key('⇥', id, { label: 'alterações' });
      await s.key('↓', id, { hold: 300, label: 'descer' });
      await s.key('↵', id, { label: 'abrir o diff' });
      await s.ticks(1, id);
    },
  },
  {
    step: 'API',
    title: 'Agora, a feature do dia.',
    text: 'A tarefa de hoje é a API de projetos. No Requests você abre o <code>GET /v1/projects</code>, troca o <code>limit</code> para 5 e envia. Depois, o POST cria o projeto vitrine. Os agentes seguem na primeira página, e você não abriu outro programa.',
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
      await s.wait(1000, id);
      await s.key('⇥', id, { hold: 260, label: 'requisição' });
      await s.key('⇥', id, { label: 'coleções' });
      for (let i = 0; i < 2; i++) await s.key('↓', id, { hold: 260, label: 'descer' });
      await s.key('↓', id, { label: 'POST /v1/projects' });
      await s.key('↵', id, { label: 'abrir o request' });
      await s.key('↵', id, { label: 'enviar o POST' });
      await s.wait(900, id);
    },
  },
  {
    step: 'Loja',
    title: 'Falta um cliente de banco.',
    text: 'Para ver se o POST salvou, falta olhar o banco. A Loja abre logo abaixo: você acha o Postgres, passa as fotos, confere o que ele pede para acessar e instala com <kbd>↵</kbd>, de graça.',
    async run(s, id) {
      await s.key('⌘⇧D', id);
      await pick(s, id, 'loja', 'abrir a Loja');
      await s.key('⌘⇧↵', id, { label: 'ampliar a folha' });
      await s.wait(700, id);
      for (const label of ['Quadro', 'Kanban', 'Rádio lo-fi']) await s.key('↓', id, { hold: 380, label });
      await s.type('postgres', id, { speed: 2 });
      await s.wait(300, id);
      await s.key('↵', id, { label: 'abrir a página do Postgres' });
      await s.wait(500, id);
      s.shot('.pg-shots', 1.22);
      await s.wait(300, id);
      for (const label of ['próxima foto', 'mais uma']) await s.key('→', id, { hold: 950, label });
      for (const label of ['as fotos', 'sobre', 'o que ele faz', 'atalhos']) await s.key('↓', id, { hold: 480, label });
      await s.key('Home', id, { label: 'voltar ao topo' });
      s.shot('.pg-top', 1.35);
      await s.key('↵', id, { label: 'instalar, grátis' });
      await s.ticks(2, id);
      s.wide();
      await s.wait(700, id);
    },
  },
  {
    step: 'Banco',
    title: 'O banco confirma o POST.',
    text: '<kbd>⌘↵</kbd> roda o select do cursor. Na consulta dos projetos, o vitrine já aparece. Você troca a ordem ali mesmo na linha, roda de novo e abre a tabela de sessões pelo navegador do banco.',
    async run(s, id) {
      await s.wait(500, id);
      await s.key('⌘↵', id, { label: 'rodar o select do cursor' });
      await s.ticks(1, id);
      await s.wait(500, id);
      for (let i = 0; i < 5; i++) await s.key('↓', id, { hold: 180, label: 'descer pelo script' });
      await s.key('⌘↵', id, { label: 'rodar este select' });
      await s.ticks(1, id);
      await s.wait(500, id);
      for (let i = 0; i < 2; i++) await s.key('↓', id, { hold: 300, label: 'até o order by' });
      s.shot('.dbv-ed', 1.35);
      await s.key('End', id, { label: 'editar a linha, ali mesmo' });
      await s.key('⌥⌫', id, { label: 'apagar a última palavra' });
      await s.type('paineis desc;', id, { speed: 1.8 });
      await s.key('⌘↵', id, { label: 'gravar e rodar' });
      s.shot('.dbv-res', 1.35);
      await s.ticks(1, id);
      await s.wait(500, id);
      s.shot('.dbv-nav', 1.4);
      await s.key('⇥', id, { label: 'navegador do banco' });
      for (const label of ['usuarios', 'sessoes']) await s.key('↓', id, { hold: 320, label });
      await s.key('↵', id, { label: 'ver os dados da tabela' });
      s.shot('.dbv-res', 1.35);
      await s.ticks(1, id);
      await s.wait(700, id);
      await s.key('⌘⇧↵', id, { label: 'voltar às duas folhas' });
    },
  },
  {
    step: 'No app',
    title: 'E já aparece no app.',
    text: 'Numa nova página, o Navegador abre o app que você está fazendo, em <code>localhost:5173</code>. O vitrine está na lista. <kbd>↓</kbd> anda pelos links, <kbd>↵</kbd> abre o projeto e <kbd>⌫</kbd> volta.',
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'naveg', 'abrir o Navegador');
      await s.wait(500, id);
      await s.key('⌘L', id, { label: 'ir ao endereço' });
      await s.type('localhost:5173', id, { speed: 2 });
      await s.key('↵', id, { label: 'abrir o site' });
      await s.ticks(1, id);
      s.shot('.wb-body', 1.3);
      await s.wait(600, id);
      for (const label of ['mapa', 'vitrine']) await s.key('↓', id, { hold: 420, label });
      await s.key('↵', id, { label: 'abrir o projeto vitrine' });
      await s.ticks(1, id);
      await s.wait(700, id);
      await s.key('⌫', id, { label: 'voltar' });
      await s.ticks(1, id);
      await s.wait(300, id);
    },
  },
  {
    step: 'Diagrama',
    title: 'Um diagrama para a reunião.',
    text: 'Às 14h tem reunião de design. Do lado do site, você instala o Quadro pela Loja e desenha o caminho do dado, sem abrir outra ferramenta. <kbd>r</kbd> faz um retângulo, <kbd>o</kbd> uma elipse e <kbd>a</kbd> liga os dois.',
    async run(s, id) {
      await s.key('⌘D', id);
      await pick(s, id, 'loja', 'abrir a Loja');
      await s.type('quadro', id, { speed: 2 });
      await s.wait(250, id);
      await s.key('↵', id, { label: 'abrir a página do Quadro' });
      await s.wait(500, id);
      await s.key('→', id, { hold: 900, label: 'próxima foto' });
      await s.key('↵', id, { label: 'instalar, grátis' });
      await s.ticks(2, id);
      s.shot('.xd-svg', 1.2);
      await s.wait(400, id);
      for (const [key, label, text] of [['r', 'retângulo', 'app web'], ['r', 'outro retângulo', 'API /v1/projects']]) {
        await s.key(key, id, { label });
        await s.type(text, id, { speed: 2.3 });
        await s.key('↵', id, { hold: 300, label: 'guardar o texto' });
      }
      await s.key('a', id, { label: 'ligar com uma seta' });
      await s.key('o', id, { label: 'elipse' });
      await s.type('Postgres', id, { speed: 2.3 });
      await s.key('↵', id, { hold: 300, label: 'guardar o texto' });
      await s.key('a', id, { label: 'mais uma seta' });
      await s.wait(1100, id);
    },
  },
  {
    step: 'Reunião',
    title: 'Na reunião, a ata vira tarefa.',
    text: 'A ata fica no Documentos, como um arquivo .md na sua pasta. Você escreve as próximas tarefas direto no texto, <kbd>↵</kbd> puxa a seguinte e <kbd>espaço</kbd> marca a que já saiu: o anúncio no blog.',
    async run(s, id) {
      await s.key('⌘T', id);
      await pick(s, id, 'doc', 'abrir Documentos');
      await s.wait(600, id);
      for (const label of ['2026-10-30', 'Lançamento', 'Site', 'Design 30-10']) await s.key('↓', id, { hold: 340, label });
      await s.key('↵', id, { label: 'abrir a nota' });
      s.shot('.mdv-note', 1.3);
      await s.wait(450, id);
      for (let i = 0; i < 9; i++) await s.key('↓', id, { hold: 110, label: 'descer pela nota' });
      await s.key('↵', id, { label: 'nova tarefa' });
      await s.type('mandar o changelog para o time', id, { speed: 2.6 });
      await s.key('↵', id, { label: 'a lista continua' });
      await s.type('revisar o [[Lançamento]]', id, { speed: 2.6 });
      await s.key('↵', id, { hold: 300, label: 'a lista continua' });
      await s.key('↵', id, { label: 'fechar a lista' });
      for (let i = 0; i < 4; i++) await s.key('↑', id, { hold: 160, label: 'subir' });
      await s.key('espaço', id, { label: 'marcar como feita' });
      await s.wait(700, id);
    },
  },
  {
    step: 'Foco',
    title: 'Depois, 25 minutos de foco.',
    text: 'Uma página só sua: a agenda, um pomodoro de 25 minutos, a memória do computador e quanto você já usou do Claude. <kbd>⌘1</kbd> a <kbd>⌘6</kbd> pulam entre as seis páginas do dia.',
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
      await s.wait(600, id);
      await s.key('⌘1', id, { hold: 850, label: 'página 1: os agentes' });
      await s.key('⌘3', id, { hold: 850, label: 'página 3: a API e o banco' });
      await s.key('⌘5', id, { hold: 850, label: 'página 5: a ata' });
      await s.key('⌘6', id, { label: 'página 6: de volta ao seu dia' });
    },
  },
  {
    step: 'Contas',
    title: 'Use as assinaturas que você já paga.',
    text: 'O Uso mostrou o Claude em 58% do limite. Em Configurações estão as contas que você já tem: Claude Max, ChatGPT Plus, uma chave do Gemini, o OpenRouter e um modelo local no Ollama. Cada conversa escolhe a sua, e o Cadente não cobra nada por cima.',
    async run(s, id) {
      await s.key('⌘,', id);
      await s.wait(250, id);
      await s.key('⌘⇧↵', id);
      for (let i = 0; i < 4; i++) await s.key('⇥', id, { hold: 200, label: 'próxima vista' });
      await s.wait(400, id);
      for (let i = 0; i < 4; i++) await s.key('↓', id, { hold: 380, label: 'próxima conta' });
      await s.wait(300, id);
    },
  },
  {
    step: 'Plugins',
    title: 'O que você não usa, sai.',
    text: 'No Plugins, até o que vem de fábrica pode sair. <kbd>espaço</kbd> desliga o Links e as Ferramentas. O provider de IA também se troca: ele passa para o Ollama, no seu notebook, e você vê antes o que muda. Dá para desligar a IA inteira.',
    async run(s, id) {
      await s.key('⌘O', id);
      await pick(s, id, 'plug', 'abrir Plugins');
      await s.wait(500, id);
      for (let i = 0; i < 14; i++) await s.key('↓', id, { hold: 60, label: 'descer' });
      await s.key('espaço', id, { label: 'desligar Links' });
      await s.key('↓', id, { label: 'descer' });
      await s.key('espaço', id, { label: 'desligar Ferramentas' });
      await s.wait(300, id);
      await s.key('End', id, { label: 'último item' });
      await s.key('↑', id, { label: 'provider de IA' });
      await s.key('↵', id, { label: 'trocar provider' });
      await s.wait(500, id);
      await s.key('↓', id, { label: 'Ollama, no seu computador' });
      await s.key('↵', id, { label: 'ver a prévia' });
      await s.wait(900, id);
      await s.key('y', id, { label: 'aplicar' });
      await s.wait(800, id);
      await s.key('⌘⇧↵', id);
    },
  },
  {
    step: 'Fim do dia',
    title: 'Fim do dia. Quem ainda espera?',
    text: '<kbd>⌘⇧A</kbd> junta os agentes de todas as páginas, com quem espera no topo. O Claude ainda pede permissão para gravar o teste: <kbd>↵</kbd> leva até ele e <kbd>y</kbd> libera. Cada plugin que você usou hoje foi feito por alguém, e o próximo pode ser o seu.',
    async run(s, id) {
      await s.key('⌘⇧A', id);
      await s.wait(1200, id);
      await s.key('↵', id, { label: 'ir até quem espera' });
      await s.wait(600, id);
      await s.key('y', id, { label: 'permitir' });
      await s.wait(900, id);
      await s.key('⌘;', id);
      await s.wait(1100, id);
      const cal = jumpLabels(s.S).find(l => leaves(s.S.tabs.find(t => t.id === l.tab)?.tree ?? { kind: 'leaf' }).find(x => x.id === l.leaf)?.plugin === 'calendario');
      if (cal) await s.key(cal.label, id, { label: 'saltar para o Calendário, na página do dia' });
      else await s.key('esc', id);
      await s.wait(800, id);
    },
  },
];

export const paneCount = S => leaves(activeTab(S).tree).length;
