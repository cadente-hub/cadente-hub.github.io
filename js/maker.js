// Creator mode, told in the v4 look: a Chat writes a plugin, `cadente plugin dev` runs it, /publish ships it.
// The example is Cadu Tamagotchi, a plugin of the floating layer: once it runs, Cadu floats over the panes,
// hungry and dirty, and the visitor can drag, feed and wash him. Panes use the prototype's line classes.
import { REDUCED } from './stage.js';
import { Tama } from './tama.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ln = (cls, g, html, meta = '') => `<div class="ln ${cls}"><i class="g">${g}</i><span class="tx">${html}</span>${meta ? `<span class="mt">${meta}</span>` : ''}</div>`;
const CANCEL = Symbol('cancel');
const str = t => `<span class="s">"${t}"</span>`;

const ASK = 'crie um tamagotchi do Cadu que flutua no app, sente fome e fica sujo';
const TOML = [
  ['k', '[plugin]'], ['', `id = ${str('ana.cadu-tamagotchi')}`], ['', `name = ${str('Cadu Tamagotchi')}`], ['', `version = ${str('0.1.0')}`],
  ['', ''], ['k', '[engines]'], ['', `cadente = ${str('&gt;=1.2')}`], ['', ''], ['k', '[overlay]'], ['', `slot = ${str('shell.overlay')}`], ['', 'draggable = <span class="k">true</span>'],
  ['', ''], ['k', '[keys]'], ['', `f = ${str('alimentar')}`], ['', `b = ${str('dar banho')}`],
];
const DEV = [
  ['cmd', '$', 'cadente plugin dev'], ['out', '', 'compilando para webassembly · 0,8 s'], ['out', '', 'permissões: nenhuma além do Core'],
  ['ok', '✓', 'ana.cadu-tamagotchi 0.1.0 rodando'], ['out', '', 'camada flutuante · em desenvolvimento'],
];

export class Maker {
  constructor(win, steps) {
    this.win = win; this.steps = steps; this.run_ = 0; this.visible = false;
    this.tama = new Tama(win.parentElement);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible && !this.started) { this.started = true; this.play(0); } }, { threshold: 0.35 }).observe(win);
    steps.addEventListener('click', e => { const li = e.target.closest('[data-step]'); if (li) this.play(Number(li.dataset.step)); });
    this.reset();
    this.draw();
  }
  reset() {
    this.a = { lines: [ln('note dim', '◆', 'creator mode · o agente usa o SDK'), ln('note dim', '└', 'nada sai sem você apertar ↵')], input: '', cmp: '', signal: '', status: 'creator mode' };
    this.b = { mode: 'empty', code: 0, dev: 0 };
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
    if (b.mode === 'empty') return { g: '+', title: 'folha nova', signal: '', status: '', hint: 'aguardando o agente', body: ln('note dim', '', 'o código aparece aqui') };
    const code = TOML.slice(0, b.code).map(([k, t]) => `<div class="ln note code"><span class="tx">${k ? `<span class="k">${t}</span>` : t || ' '}</span></div>`).join('');
    if (b.mode === 'code') return { g: '#', title: 'cadente-plugin.toml', signal: `${b.code} linhas`, status: 'escrevendo', hint: '', body: code };
    const dev = DEV.slice(0, b.dev).map(([k, g, t]) => (k === 'cmd' ? ln('cmd', g, t) : k === 'ok' ? ln('out ok', '', `${g} ${t}`) : ln('out', '', t))).join('');
    return { g: '$', title: 'Terminal · cadente plugin dev', signal: b.dev >= 4 ? 'rodando' : '', status: 'cadente plugin dev', hint: 'f alimenta · b dá banho · arraste o Cadu', body: `<div class="blk">${dev}</div>` };
  }
  draw() {
    const a = this.a, b = this.paneB();
    const caretA = `${esc(a.input)}<b class="cur"> </b>${a.input ? '' : '<span class="hint">mensagem · @ anexos · / comandos</span>'}`;
    this.win.innerHTML = `<div class="win"><span class="tl float"><i></i><i></i><i></i></span><main class="tree"><div class="split row" style="flex-grow:1">`
      + `<div class="cell" style="flex-grow:.54"><section class="pane" data-focused="true"><header class="ph inset"><span class="pl">»</span><span class="pt">Chat · creator mode</span><span class="ps">${a.signal}</span></header>`
      + `<div class="pc">${a.lines.join('')}</div><footer class="pp">${a.cmp}<div class="ln ctx"><span class="cwd">~/dev/cadu-tamagotchi</span><span class="br"> main</span><span class="mt">${a.status}</span></div><div class="ln in"><i class="g">›</i><span class="tx">${caretA}</span></div></footer></section></div>`
      + `<div class="sp"></div>`
      + `<div class="cell" style="flex-grow:.46"><section class="pane" data-focused="false"><header class="ph"><span class="pl">${b.g}</span><span class="pt">${b.title}</span><span class="ps">${b.signal}</span></header>`
      + `<div class="pc">${b.body}</div><footer class="pp"><div class="ln ctx"><span class="cwd">~/dev/cadu-tamagotchi</span><span class="br"> main</span><span class="mt">${b.status}</span></div><div class="ln in"><i class="g">›</i><span class="tx"><span class="hint">${b.hint}</span></span></div></footer></section></div>`
      + `</div></main></div>`;
    for (const pc of this.win.querySelectorAll('.pc')) pc.scrollTop = pc.scrollHeight;
  }
  wait(ms, id) {
    return new Promise((resolve, reject) => setTimeout(() => (id === this.run_ ? resolve() : reject(CANCEL)), REDUCED ? Math.min(ms, 120) : ms));
  }
  async type(text, id) {
    for (const ch of text) { this.a.input += ch; this.draw(); await this.wait(28 + Math.random() * 40, id); }
  }
  say(cls, g, html) { this.a.lines.push(ln(cls, g, html)); this.draw(); }
  replaceLast(cls, g, html) { this.a.lines[this.a.lines.length - 1] = ln(cls, g, html); this.draw(); }

  // Plays the four steps once, from `from`; earlier steps are drawn at once. Cadu, once out, stays out.
  async play(from) {
    const id = ++this.run_;
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
        this.say('msg agent', '◆', 'Vou criar o pacote ana.cadu-tamagotchi na camada flutuante: ele voa pela tela, sente fome e se suja com o tempo; f dá comida e b dá banho.');
        this.b.mode = 'code';
        const files = [['escrevendo cadente-plugin.toml', 'note dim', '└', 'escreveu cadente-plugin.toml'], ['escrevendo src/lib.rs', 'note dim', '└', 'escreveu src/lib.rs · o Cadu em ANSI, a fome e o banho'],
          ['rodando cargo test', 'note ok', '✓', 'testes ok · 5 passaram']];
        for (const [i, [doing, cls, g, done]] of files.entries()) {
          this.say('note', '<i class="spin"></i>', doing);
          if (i === 0) for (let n = 1; n <= TOML.length; n++) { this.b.code = n; this.draw(); await w(90); }
          else await w(650);
          this.replaceLast(cls, g, done);
        }
        this.a.signal = '';
      },
      async w => {
        await w(400);
        this.b.mode = 'dev';
        for (let i = 1; i <= DEV.length; i++) { this.b.dev = i; this.draw(); await w(i === 2 ? 700 : 300); }
        this.tama.show();
        this.say('msg agent', '◆', 'Pronto. O Cadu está solto no app, com fome e sujo. Arraste ele, f dá comida e b dá banho.');
      },
      async (w, type) => {
        await w(2200);
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
        this.a.lines.push(ln('note ok', '✓', 'publicado · entra na loja no próximo índice'), ln('note dim', '└', 'preço: grátis com doação · você recebe 90%'));
        this.a.status = 'na loja';
        this.draw();
      },
    ];
    try {
      for (const [k, phase] of phases.entries()) {
        const fast = k < from;
        const w = ms => (fast ? Promise.resolve() : this.wait(ms, id));
        const type = async t => { if (fast) { this.a.input += t; this.draw(); } else await this.type(t, id); };
        this.setStep(k);
        await phase(w, type);
      }
    } catch (e) { if (e !== CANCEL) throw e; }
  }
}
