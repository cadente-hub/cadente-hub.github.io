// Creator mode, told in the v4 look: a Chat writes a plugin, the plugin runs in the next pane, /publish ships it.
// Drawn with the prototype's own line classes (css/v4.css), so it reads like the app.
import { REDUCED } from './stage.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ln = (cls, g, html, meta = '') => `<div class="ln ${cls}"><i class="g">${g}</i><span class="tx">${html}</span>${meta ? `<span class="mt">${meta}</span>` : ''}</div>`;
const CANCEL = Symbol('cancel');

const ASK = 'crie um plugin de kanban com as issues do repositório';
const TOML = [
  ['k', '[plugin]'], ['', 'id = <span class="s">"ana.kanban"</span>'], ['', 'name = <span class="s">"Kanban"</span>'], ['', 'version = <span class="s">"0.1.0"</span>'],
  ['', ''], ['k', '[engines]'], ['', 'cadente = <span class="s">"&gt;=1.2"</span>'], ['', ''], ['k', '[permissions]'], ['', 'network = [<span class="s">"api.github.com"</span>]'],
];
const BOARD = [
  ['a fazer', [['#212', 'atalho para fechar aba'], ['#219', 'tema alto contraste'], ['#224', 'exportar sessão']]],
  ['fazendo', [['#207', 'busca na sidebar'], ['#215', 'prévia do diff']]],
  ['feito', [['#198', 'seletor fzf'], ['#201', 'Chat ao lado'], ['#203', 'saltos ⌘;']]],
];

export class Maker {
  constructor(win, steps) {
    this.win = win; this.steps = steps; this.run_ = 0; this.visible = false;
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible && !this.playing) this.loop(); }, { threshold: 0.25 }).observe(win);
    steps.addEventListener('click', e => { const li = e.target.closest('[data-step]'); if (li) this.loop(Number(li.dataset.step)); });
    this.reset();
    this.draw();
  }
  reset() {
    this.a = { lines: [ln('note dim', '◆', 'creator mode · o agente usa o SDK'), ln('note dim', '└', 'nada sai sem você apertar ↵')], input: '', cmp: '', signal: '', status: 'creator mode' };
    this.b = { mode: 'empty', code: 0, cards: 0, cursor: -1 };
    this.focus = 'a';
    this.step = -1;
  }
  setStep(n) {
    this.step = n;
    for (const li of this.steps.children) {
      const k = Number(li.dataset.step);
      li.classList.toggle('is-on', k === n);
      li.classList.toggle('is-done', k < n);
    }
  }
  paneB() {
    const b = this.b;
    if (b.mode === 'empty') return { g: '+', title: 'folha nova', signal: '', status: '', hint: 'aguardando o agente', body: ln('note dim', '', 'o plugin abre aqui') };
    if (b.mode === 'code') return { g: '#', title: 'cadente-plugin.toml', signal: `${b.code} linhas`, status: 'escrevendo', hint: '', body: TOML.slice(0, b.code).map(([k, t]) => `<div class="ln note code"><span class="tx">${k ? `<span class="k">${t}</span>` : t || ' '}</span></div>`).join('') };
    let n = 0;
    const cols = BOARD.map(([name, cards]) => `<div class="kb__col"><h5>${name} · ${cards.length}</h5>${cards.map(([id, t]) => {
      const i = n++;
      return i < b.cards ? `<div class="kb__card"${i === b.cursor ? ' data-cursor' : ''}><i>${id}</i> ${esc(t)}</div>` : '';
    }).join('')}</div>`).join('');
    return { g: '▦', title: 'Kanban · em desenvolvimento', signal: 'dev', status: 'cadente plugin dev', hint: '↵ abre o card · . ações · / sync',
      body: `<div class="ln tabs"><span class="vts"><span class="vt on">quadro</span><span class="vt">issues</span><span class="vt">ajustes</span></span><span class="mt">1/3 ⇥</span></div><div class="kb">${cols}</div>` };
  }
  draw() {
    const a = this.a, b = this.paneB(), fa = this.focus === 'a';
    const caretA = fa ? `${esc(a.input)}<b class="cur"> </b>${a.input ? '' : '<span class="hint">mensagem · @ anexos · / comandos</span>'}` : esc(a.input);
    const caretB = !fa ? `<b class="cur"> </b><span class="hint">${b.hint}</span>` : `<span class="hint">${b.hint}</span>`;
    this.win.innerHTML = `<div class="win"><span class="tl float"><i></i><i></i><i></i></span><main class="tree"><div class="split row" style="flex-grow:1">`
      + `<div class="cell" style="flex-grow:.54"><section class="pane" data-focused="${fa}"><header class="ph inset"><span class="pl">»</span><span class="pt">Chat · creator mode</span><span class="ps">${a.signal}</span></header>`
      + `<div class="pc">${a.lines.join('')}</div><footer class="pp">${a.cmp}<div class="ln ctx"><span class="cwd">~/dev/kanban</span><span class="br"> main</span><span class="mt">${a.status}</span></div><div class="ln in"><i class="g">›</i><span class="tx">${caretA}</span></div></footer></section></div>`
      + `<div class="sp"></div>`
      + `<div class="cell" style="flex-grow:.46"><section class="pane" data-focused="${!fa}"><header class="ph"><span class="pl">${b.g}</span><span class="pt">${b.title}</span><span class="ps">${b.signal}</span></header>`
      + `<div class="pc">${b.body}</div><footer class="pp"><div class="ln ctx"><span class="cwd">~/dev/kanban</span><span class="br"> main</span><span class="mt">${b.status}</span></div><div class="ln in"><i class="g">›</i><span class="tx">${caretB}</span></div></footer></section></div>`
      + `</div></main></div>`;
    const pc = this.win.querySelector('.pc');
    pc.scrollTop = pc.scrollHeight;
  }
  wait(ms, id) {
    return new Promise((resolve, reject) => setTimeout(() => (id === this.run_ ? resolve() : reject(CANCEL)), REDUCED ? Math.min(ms, 120) : ms));
  }
  async type(text, id) {
    for (const ch of text) { this.a.input += ch; this.draw(); await this.wait(28 + Math.random() * 50, id); }
  }
  say(cls, g, html) { this.a.lines.push(ln(cls, g, html)); this.draw(); }
  replaceLast(cls, g, html) { this.a.lines[this.a.lines.length - 1] = ln(cls, g, html); this.draw(); }

  async loop(from = 0) {
    const id = ++this.run_;
    this.playing = true;
    try {
      while (this.visible || from > 0) {
        await this.play(id, from);
        from = 0;
        await this.wait(4200, id);
      }
    } catch (e) { if (e !== CANCEL) throw e; return; }
    this.playing = false;
  }
  async play(id, from) {
    this.reset();
    this.draw();
    const phases = [
      async (w, type) => {
        await w(600);
        await type(ASK);
        await w(450);
        this.a.input = '';
        this.say('msg you', '›', esc(ASK));
      },
      async w => {
        await w(600);
        this.a.signal = 'escrevendo';
        this.say('msg agent', '◆', 'Vou criar o pacote ana.kanban: três colunas, as issues do GitHub e um atalho para mover os cards.');
        this.b.mode = 'code';
        const files = [['escrevendo cadente-plugin.toml', 'note dim', '└', 'escreveu cadente-plugin.toml'], ['escrevendo manifest.json', 'note dim', '└', 'escreveu manifest.json · 3 vistas'],
          ['escrevendo src/lib.rs', 'note dim', '└', 'escreveu src/lib.rs · 112 linhas'], ['rodando cargo test', 'note ok', '✓', 'testes ok · 6 passaram']];
        for (const [i, [doing, cls, g, done]] of files.entries()) {
          this.say('note', '<i class="spin"></i>', doing);
          if (i === 0) for (let n = 1; n <= TOML.length; n++) { this.b.code = n; this.draw(); await w(110); }
          else await w(650);
          this.replaceLast(cls, g, done);
        }
        this.a.signal = '';
      },
      async w => {
        await w(400);
        this.b = { mode: 'live', code: TOML.length, cards: 0, cursor: -1 };
        for (let i = 1; i <= 8; i++) { this.b.cards = i; this.draw(); await w(90); }
        this.say('msg agent', '◆', 'Pronto. O Kanban roda na folha ao lado, marcado como em desenvolvimento.');
        this.focus = 'b';
        for (const c of [0, 1, 3, 5]) { this.b.cursor = c; this.draw(); await w(520); }
        this.focus = 'a';
        this.b.cursor = -1;
        this.draw();
      },
      async (w, type) => {
        await w(500);
        await type('/pub');
        this.a.cmp = `<div class="cmp"><div class="ln row" data-sel="true"><i class="g">/</i><span class="tx">publish</span><span class="mt">release, sha256 e índice da loja</span></div></div>`;
        this.draw();
        await w(500);
        await type('lish');
        await w(400);
        this.a.input = ''; this.a.cmp = ''; this.a.status = 'publicando';
        this.a.lines.push(`<div class="blk">${ln('cmd', '$', '/publish')}${ln('out', '', 'release v0.1.0 · artefato e sha256 enviados')}${ln('out', '', 'manifesto válido · topic cadente-plugin')}</div>`);
        this.draw();
        await w(1100);
        this.a.lines.push(ln('note ok', '✓', 'publicado · entra na loja no próximo índice'), ln('note dim', '└', 'escolha o preço na área do autor: grátis, doação, assinatura ou compra única'));
        this.a.status = 'na loja';
        this.draw();
      },
    ];
    for (const [k, phase] of phases.entries()) {
      const fast = k < from;
      const w = ms => (fast ? Promise.resolve() : this.wait(ms, id));
      const type = async t => { if (fast) { this.a.input += t; this.draw(); } else await this.type(t, id); };
      this.setStep(k);
      await phase(w, type);
    }
  }
}
