// Creator mode, told in the v4 look: a Chat writes a plugin, `cadente plugin dev` runs it, /publish ships it.
// Three examples play in turn, each with its own way to earn: Cadu Tamagotchi, a plugin of the floating layer
// (once it runs, Cadu floats over the panes and the visitor can drag, feed and wash him), a sales dashboard sold
// by subscription and a status page of outside services sold once. Panes use the prototype's line classes.
import { REDUCED } from './stage.js';
import { Tama } from './tama.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ln = (cls, g, html, meta = '') => `<div class="ln ${cls}"><i class="g">${g}</i><span class="tx">${html}</span>${meta ? `<span class="mt">${meta}</span>` : ''}</div>`;
// One service of the status page: the dot and, when something is wrong, the note take its colour.
const status = (tone, name, meta) => `<div class="ln row"><i class="g ${tone}">●</i><span class="tx">${name}</span><span class="mt${tone === 'ok' ? '' : ` ${tone}`}">${meta}</span></div>`;
const CANCEL = Symbol('cancel');
// The examples play at TEMPO of their written waits, like the theater, so three plugins fit in a short look.
const TEMPO = 0.7;
const str = t => `<span class="s">"${t}"</span>`;
const head = (id, name) => [['k', '[plugin]'], ['', `id = ${str(id)}`], ['', `name = ${str(name)}`], ['', `version = ${str('0.1.0')}`], ['', ''], ['k', '[engines]'], ['', `cadente = ${str('&gt;=1.2')}`], ['', '']];
const dev = (id, perms, where) => [['cmd', '$', 'cadente plugin dev'], ['out', '', 'compilando para webassembly · 0,8 s'], ['out', '', `permissões: ${perms}`], ['ok', '✓', `${id} 0.1.0 rodando`], ['out', '', `${where} · em desenvolvimento`]];

const EXAMPLES = [
  {
    tab: '◕ Cadu de estimação', id: 'ana.cadu-tamagotchi', dir: '~/dev/cadu-tamagotchi', pet: true,
    ask: 'crie um tamagotchi do Cadu que flutua no app, sente fome e fica sujo',
    toml: [...head('ana.cadu-tamagotchi', 'Cadu Tamagotchi'), ['k', '[overlay]'], ['', `slot = ${str('shell.overlay')}`], ['', 'draggable = <span class="k">true</span>'], ['', ''], ['k', '[keys]'], ['', `f = ${str('alimentar')}`], ['', `b = ${str('dar banho')}`]],
    plan: 'Vou criar o pacote ana.cadu-tamagotchi na camada flutuante: ele voa pela tela, sente fome e se suja com o tempo; f dá comida e b dá banho.',
    files: ['escreveu src/lib.rs · o Cadu em ANSI, a fome e o banho', 'testes ok · 5 passaram'],
    dev: dev('ana.cadu-tamagotchi', 'nenhuma além do Core', 'camada flutuante'),
    ready: 'Pronto. O Cadu está solto no app, com fome e sujo. Arraste ele, f dá comida e b dá banho.',
    hint: 'f alimenta · b dá banho · arraste o Cadu',
    price: 'preço: grátis com doação · você recebe 90%',
  },
  {
    tab: '$ Vendas do dia', id: 'leo.vendas-do-dia', dir: '~/dev/vendas-do-dia', glyph: '$', title: 'Vendas do dia',
    ask: 'crie um plugin que mostra as vendas de hoje da minha loja, com um gráfico por hora',
    toml: [...head('leo.vendas-do-dia', 'Vendas do dia'), ['k', '[permissions]'], ['', `net = [${str('api.stripe.com')}]`], ['', ''], ['k', '[views]'], ['', `hoje = ${str('total, gráfico e pedidos')}`], ['', `semana = ${str('comparação com a semana passada')}`]],
    plan: 'Vou criar o leo.vendas-do-dia: uma folha com o total de hoje, um gráfico por hora e os últimos pedidos. Ele só fala com api.stripe.com.',
    files: ['escreveu src/lib.rs · o total, o gráfico e os pedidos', 'testes ok · 4 passaram'],
    dev: dev('leo.vendas-do-dia', 'api.stripe.com', 'folha nova'),
    view: [ln('h', '', 'hoje', 'R$ 3.482,90 · 27 pedidos'), `<div class="ln spark"><span class="lb">por hora</span><span class="sk">▁▁▂▃▅▇█▆▅▄▃▂</span><span class="mt">pico às 11h</span></div>`,
      ln('h', '', 'últimos pedidos'), ln('row', '●', '#1042 · Marina', 'R$ 129,90 · pago'), ln('row', '●', '#1041 · Kenji', 'R$ 49,00 · pago'), ln('row', '○', '#1040 · Sofia', 'R$ 310,00 · aguardando')],
    ready: 'Pronto. A folha mostra as vendas de hoje e se atualiza sozinha a cada minuto.',
    hint: '⇥ semana · ↵ abre o pedido',
    price: 'preço: US$ 4 por mês · você recebe 70% de cada renovação',
  },
  {
    tab: '↯ Status page', id: 'orbita.status-page', dir: '~/dev/status-page', glyph: '↯', title: 'Status page',
    ask: 'crie uma status page que mostra quando o GitHub, a Cloudflare, a AWS e outros serviços caem',
    toml: [...head('orbita.status-page', 'Status page'), ['k', '[permissions]'], ['', `net = [${str('githubstatus.com')}, ${str('cloudflarestatus.com')},`], ['', `       ${str('health.aws.amazon.com')}, …]`], ['', ''], ['k', '[schedule]'], ['', `every = ${str('1m')}`], ['', ''], ['k', '[notify]'], ['', `when = ${str('um serviço cair ou voltar')}`]],
    plan: 'Vou criar o orbita.status-page: uma folha com o GitHub, a Cloudflare, a AWS e outros serviços, lidos das páginas de status oficiais a cada minuto. Quando um cai, o cabeçalho da folha fica vermelho e você recebe um aviso.',
    files: ['escreveu src/lib.rs · leitura das páginas de status e os avisos', 'testes ok · 6 passaram'],
    dev: dev('orbita.status-page', 'rede · 7 páginas de status', 'folha nova'),
    signal: '<span class="err">● 1 fora do ar</span>',
    view: [ln('h', '', 'agora', '1 fora · 1 instável · 5 ok'), status('err', 'AWS · CloudFront', 'fora · us-east-1 · 4 min'), status('warn', 'GitHub · Actions', 'lento · filas com atraso'),
      status('ok', 'Cloudflare', 'operacional'), status('ok', 'Vercel', 'operacional'), status('ok', 'OpenAI', 'operacional'), status('ok', 'Anthropic', 'operacional'), status('ok', 'Stripe', 'operacional'),
      `<div class="ln spark"><span class="lb">24 horas</span><span class="sk">▁▁▁▁▁▁▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▆█</span><span class="mt">2 incidentes</span></div>`],
    ready: 'Pronto. A folha checa as páginas de status a cada minuto. Neste exemplo, o CloudFront da AWS aparece fora em us-east-1 e o GitHub Actions está lento.',
    hint: '↵ abre o incidente · ⇥ histórico',
    price: 'preço: US$ 12, compra única · você recebe 70%',
  },
];

export class Maker {
  constructor(win, steps, tabs) {
    this.win = win; this.steps = steps; this.tabs = tabs; this.run_ = 0; this.visible = false; this.ex = 0;
    this.tama = new Tama(win.parentElement);
    tabs.innerHTML = EXAMPLES.map((x, i) => `<button role="tab" data-ex="${i}" aria-selected="${i === 0}">${esc(x.tab)}</button>`).join('');
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible && !this.started) { this.started = true; this.play(0); } }, { threshold: 0.35 }).observe(win);
    steps.addEventListener('click', e => { const li = e.target.closest('[data-step]'); if (li) this.play(Number(li.dataset.step)); });
    tabs.addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) { this.ex = Number(b.dataset.ex); this.play(0); } });
    this.reset();
    this.draw();
  }
  get x() { return EXAMPLES[this.ex]; }
  reset() {
    this.a = { lines: [ln('note dim', '◆', 'creator mode · o agente usa o SDK'), ln('note dim', '└', 'nada sai sem você apertar ↵')], input: '', cmp: '', signal: '', status: 'creator mode' };
    this.b = { mode: 'empty', code: 0, dev: 0 };
    this.step = -1;
    for (const b of this.tabs.children) b.setAttribute('aria-selected', String(Number(b.dataset.ex) === this.ex));
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
    const b = this.b, x = this.x;
    if (b.mode === 'empty') return { g: '+', title: 'folha nova', signal: '', status: '', hint: 'aguardando o agente', body: ln('note dim', '', 'o código aparece aqui') };
    const code = x.toml.slice(0, b.code).map(([k, t]) => `<div class="ln note code"><span class="tx">${k ? `<span class="k">${t}</span>` : t || ' '}</span></div>`).join('');
    if (b.mode === 'code') return { g: '#', title: 'cadente-plugin.toml', signal: `${b.code} linhas`, status: 'escrevendo', hint: '', body: code };
    if (b.mode === 'run') return { g: x.glyph, title: x.title, signal: x.signal ?? 'em desenvolvimento', status: 'cadente plugin dev', hint: x.hint, body: x.view.join('') };
    const out = x.dev.slice(0, b.dev).map(([k, g, t]) => (k === 'cmd' ? ln('cmd', g, t) : k === 'ok' ? ln('out ok', '', `${g} ${t}`) : ln('out', '', t))).join('');
    return { g: '$', title: 'Terminal · cadente plugin dev', signal: b.dev >= 4 ? 'rodando' : '', status: 'cadente plugin dev', hint: x.pet ? x.hint : '', body: `<div class="blk">${out}</div>` };
  }
  draw() {
    const a = this.a, b = this.paneB(), dir = this.x.dir;
    const caretA = `${esc(a.input)}<b class="cur"> </b>${a.input ? '' : '<span class="hint">mensagem · @ anexos · / comandos</span>'}`;
    this.win.innerHTML = `<div class="win"><span class="tl float"><i></i><i></i><i></i></span><main class="tree"><div class="split row" style="flex-grow:1">`
      + `<div class="cell" style="flex-grow:.54"><section class="pane" data-focused="true"><header class="ph inset"><span class="pl">»</span><span class="pt">Chat · creator mode</span><span class="ps">${a.signal}</span></header>`
      + `<div class="pc">${a.lines.join('')}</div><footer class="pp">${a.cmp}<div class="ln ctx"><span class="cwd">${dir}</span><span class="br"> main</span><span class="mt">${a.status}</span></div><div class="ln in"><i class="g">›</i><span class="tx">${caretA}</span></div></footer></section></div>`
      + `<div class="sp"></div>`
      + `<div class="cell" style="flex-grow:.46"><section class="pane" data-focused="false"><header class="ph"><span class="pl">${b.g}</span><span class="pt">${b.title}</span><span class="ps">${b.signal}</span></header>`
      + `<div class="pc">${b.body}</div><footer class="pp"><div class="ln ctx"><span class="cwd">${dir}</span><span class="br"> main</span><span class="mt">${b.status}</span></div><div class="ln in"><i class="g">›</i><span class="tx"><span class="hint">${b.hint}</span></span></div></footer></section></div>`
      + `</div></main></div>`;
    const [pa, pb] = this.win.querySelectorAll('.pc');
    pa.scrollTop = pa.scrollHeight;
    pb.scrollTop = this.b.mode === 'run' ? 0 : pb.scrollHeight;
  }
  wait(ms, id) {
    return new Promise((resolve, reject) => setTimeout(() => (id === this.run_ ? resolve() : reject(CANCEL)), REDUCED ? Math.min(ms, 120) : ms * TEMPO));
  }
  async type(text, id) {
    for (const ch of text) { this.a.input += ch; this.draw(); await this.wait(22 + Math.random() * 30, id); }
  }
  say(cls, g, html) { this.a.lines.push(ln(cls, g, html)); this.draw(); }
  replaceLast(cls, g, html) { this.a.lines[this.a.lines.length - 1] = ln(cls, g, html); this.draw(); }

  // Plays the four steps of the current example from `from` (earlier steps are drawn at once), then the next
  // example. Cadu, once out, stays out while his example is on; the other examples put him away.
  async play(from) {
    const id = ++this.run_;
    try {
      for (;;) {
        await this.playOne(from, id);
        await this.wait(3200, id);
        this.ex = (this.ex + 1) % EXAMPLES.length;
        from = 0;
      }
    } catch (e) { if (e !== CANCEL) throw e; }
  }
  async playOne(from, id) {
    const x = this.x;
    if (from < 2 || !x.pet) this.tama.hide();
    this.reset();
    this.draw();
    const phases = [
      async (w, type) => {
        await w(600);
        await type(x.ask);
        await w(450);
        this.a.input = '';
        this.say('msg you', '›', esc(x.ask));
      },
      async w => {
        await w(600);
        this.a.signal = 'escrevendo';
        this.say('msg agent', '◆', esc(x.plan));
        this.b.mode = 'code';
        const files = [['escrevendo cadente-plugin.toml', 'note dim', '└', 'escreveu cadente-plugin.toml'], ['escrevendo src/lib.rs', 'note dim', '└', x.files[0]], ['rodando cargo test', 'note ok', '✓', x.files[1]]];
        for (const [i, [doing, cls, g, done]] of files.entries()) {
          this.say('note', '<i class="spin"></i>', doing);
          if (i === 0) for (let n = 1; n <= x.toml.length; n++) { this.b.code = n; this.draw(); await w(90); }
          else await w(650);
          this.replaceLast(cls, g, done);
        }
        this.a.signal = '';
      },
      async w => {
        await w(400);
        this.b.mode = 'dev';
        for (let i = 1; i <= x.dev.length; i++) { this.b.dev = i; this.draw(); await w(i === 2 ? 700 : 300); }
        if (x.pet) this.tama.show();
        else { await w(500); this.b.mode = 'run'; this.draw(); }
        this.say('msg agent', '◆', esc(x.ready));
      },
      async (w, type) => {
        await w(1600);
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
        this.a.lines.push(ln('note ok', '✓', 'publicado · entra na loja no próximo índice'), ln('note dim', '└', esc(x.price)));
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
