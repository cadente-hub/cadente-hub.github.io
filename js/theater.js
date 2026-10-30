// The story told by the pinned window: open, pick a plugin, split, pick another, split again, own it, jump.
// Each chapter is a script of real keystrokes played on the v4 prototype. Played in order they build one session;
// a chapter reached by scrolling fast is rebuilt by running the earlier ones without delays.
import { createState, leaves, activeTab } from './v4/model.mjs';

const terminalWaiting = S => {
  const leaf = S.tabs.flatMap(t => leaves(t.tree)).find(l => l.plugin === 'terminal');
  return leaf?.data.blocks?.some(b => b.agent && b.state === 'precisa de você') ? leaf : null;
};

export const initial = () => createState();

export const CHAPTERS = [
  {
    step: 'Abrir',
    title: 'Abra o Cadente.',
    text: 'Uma janela preta, uma folha e o teclado. O Início mostra o seu dia: agenda, tarefas, notas e o que ficou aberto. <kbd>⇥</kbd> troca de vista.',
    async run(s, id) {
      s.boot();
      await s.wait(1500, id);
      await s.key('⇥', id, { label: 'próxima vista' });
      await s.wait(700, id);
      await s.key('⇥', id, { label: 'próxima vista' });
      await s.wait(700, id);
      await s.key('⇧⇥', id, { label: 'vista anterior' });
      await s.key('⇧⇥', id, { label: 'vista anterior' });
      await s.wait(400, id);
      await s.key('↓', id, { label: 'próximo item' });
      await s.key('↓', id, { label: 'próximo item' });
    },
  },
  {
    step: 'Escolher',
    title: 'Escolha um plugin.',
    text: '<kbd>⌘O</kbd> abre o seletor. Três letras e <kbd>↵</kbd>, e a folha vira o que você precisa. Aqui, um Terminal que reconhece o Claude Code trabalhando.',
    async run(s, id) {
      await s.key('⌘O', id);
      await s.wait(600, id);
      await s.type('term', id);
      await s.wait(350, id);
      await s.key('↵', id, { label: 'abrir o Terminal' });
      await s.wait(500, id);
      await s.type('git status', id, { speed: 1.4 });
      await s.key('↵', id, { label: 'executar' });
      await s.wait(700, id);
      await s.type('claude "feche a folha sem perder o foco"', id, { speed: 2.2 });
      await s.key('↵', id, { label: 'o agente começa' });
      await s.ticks(3, id);
    },
  },
  {
    step: 'Dividir',
    title: 'Divida a tela.',
    text: '<kbd>⌘D</kbd> divide à direita e <kbd>⌘⇧D</kbd> divide abaixo. A folha nova nasce com o seletor aberto e herda a pasta e a branch de onde veio.',
    async run(s, id) {
      await s.key('⌘D', id);
      await s.wait(900, id);
      await s.type('chat', id);
      await s.wait(300, id);
      await s.key('↵', id, { label: 'abrir o Chat' });
      await s.wait(500, id);
      await s.type('o que o claude está mudando?', id, { speed: 1.6 });
      await s.key('↵', id, { label: 'enviar' });
      await s.ticks(2, id);
    },
  },
  {
    step: 'De novo',
    title: 'Escolha outro. E outro.',
    text: 'PR Reviews embaixo do Terminal, Uso do Claude embaixo do Chat. Quatro plugins, quatro folhas e nenhuma janela a mais.',
    async run(s, id) {
      await s.key('⌘⌥←', id);
      await s.key('⌘⇧D', id);
      await s.wait(700, id);
      await s.type('pr', id);
      await s.wait(300, id);
      await s.key('↵', id, { label: 'abrir PR Reviews' });
      await s.wait(700, id);
      await s.key('⌘⌥→', id);
      await s.key('⌘⇧D', id);
      await s.wait(700, id);
      await s.type('uso', id);
      await s.wait(300, id);
      await s.key('↵', id, { label: 'abrir Uso' });
      await s.wait(600, id);
    },
  },
  {
    step: 'Seis folhas',
    title: 'Seis folhas, todas legíveis.',
    text: 'Todo plugin foi desenhado para caber numa folha pequena. Calendário e Sistema entram ao vivo, ao lado do resto.',
    async run(s, id) {
      await s.key('⌘⌥←', id);
      await s.key('⌘D', id);
      await s.wait(600, id);
      await s.type('cal', id);
      await s.key('↵', id, { label: 'abrir o Calendário' });
      await s.wait(700, id);
      await s.key('⌘⌥→', id);
      await s.key('⌘D', id);
      await s.wait(600, id);
      await s.type('sis', id);
      await s.key('↵', id, { label: 'abrir o Sistema' });
      await s.ticks(2, id);
    },
  },
  {
    step: 'Você é o dono',
    title: 'Você é o dono.',
    text: 'Tudo é plugin, até o que vem de fábrica. Desligue o que não usa com <kbd>espaço</kbd> e troque o provider de IA, o terminal ou a compactação, com prévia antes de aplicar.',
    async run(s, id) {
      await s.key('⌘O', id);
      await s.wait(500, id);
      await s.type('plug', id);
      await s.key('↵', id, { label: 'abrir Plugins' });
      await s.wait(400, id);
      await s.key('⌘⇧↵', id);
      await s.wait(600, id);
      for (let i = 0; i < 9; i++) await s.key('↓', id, { hold: 90, label: 'próximo item' });
      await s.key('espaço', id, { label: 'desligar o Foco' });
      await s.wait(500, id);
      await s.key('↓', id, { label: 'próximo item' });
      await s.key('espaço', id, { label: 'desligar Automações' });
      await s.wait(700, id);
      await s.key('End', id, { label: 'último item' });
      await s.key('↑', id, { label: 'provider de IA' });
      await s.wait(300, id);
      await s.key('↵', id, { label: 'trocar provider' });
      await s.wait(700, id);
      await s.key('↓', id, { label: 'Ollama, no seu computador' });
      await s.key('↵', id, { label: 'ver a prévia' });
      await s.wait(1300, id);
      await s.key('y', id, { label: 'aplicar' });
      await s.wait(1400, id);
      await s.key('⌘⇧↵', id);
    },
  },
  {
    step: 'Atalhos',
    title: 'Tudo a um atalho.',
    text: '<kbd>⌘P</kbd> acha ações, plugins e comandos. <kbd>⌘;</kbd> põe uma letra em cada folha: uma tecla e você está lá. Quando o agente pede algo, <kbd>y</kbd> responde.',
    async run(s, id) {
      await s.key('⌘P', id);
      await s.wait(500, id);
      await s.type('dividir', id);
      await s.wait(900, id);
      await s.key('esc', id, { label: 'fechar' });
      await s.wait(300, id);
      await s.key('⌘;', id);
      await s.wait(1200, id);
      await s.key('a', id, { label: 'saltar para o Terminal' });
      await s.wait(500, id);
      if (terminalWaiting(s.S)) {
        await s.key('y', id, { label: 'permitir ao Claude' });
        await s.ticks(2, id);
      }
    },
  },
];

export const paneCount = S => leaves(activeTab(S).tree).length;
