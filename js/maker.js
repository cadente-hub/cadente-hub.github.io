// Creator mode, told in the v4 look: a Chat writes a plugin, `cadente plugin dev` runs it, /publish ships it.
// Three examples play in turn, each with its own way to earn: Cadu Tamagotchi, a plugin of the floating layer
// (once it runs, Cadu floats over the panes and the visitor can drag, feed and wash him), a sales dashboard sold
// by subscription and a status page of outside services sold once. Panes use the prototype's line classes.
import { REDUCED } from './stage.js';
import { Tama } from './tama.js';
import { t } from './i18n.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ln = (cls, g, html, meta = '') => `<div class="ln ${cls}"><i class="g">${g}</i><span class="tx">${html}</span>${meta ? `<span class="mt">${meta}</span>` : ''}</div>`;
// One service of the status page: the dot and, when something is wrong, the note take its colour.
const status = (tone, name, meta) => `<div class="ln row"><i class="g ${tone}">●</i><span class="tx">${name}</span><span class="mt${tone === 'ok' ? '' : ` ${tone}`}">${meta}</span></div>`;
const CANCEL = Symbol('cancel');
// The examples play at TEMPO of their written waits, like the theater, so three plugins fit in a short look.
const TEMPO = 0.7;
const str = s => `<span class="s">"${s}"</span>`;
const M = (key, vars) => esc(t(`maker.${key}`, vars));
const head = (id, name) => [['k', '[plugin]'], ['', `id = ${str(id)}`], ['', `name = ${str(name)}`], ['', `version = ${str('0.1.0')}`], ['', ''], ['k', '[engines]'], ['', `cadente = ${str('&gt;=1.2')}`], ['', '']];
const dev = (id, perms, where) => [['cmd', '$', 'cadente plugin dev'], ['out', '', M('compiling')], ['out', '', M('permissions', { perms })], ['ok', '✓', M('devRunning', { id })], ['out', '', M('inDevAt', { where })]];
const X = (ex, key, vars) => M(`ex.${ex}.${key}`, vars);

const EXAMPLES = [
  {
    tab: `◕ ${t('maker.ex.pet.tab')}`, id: 'ana.cadu-tamagotchi', dir: '~/dev/cadu-tamagotchi', pet: true,
    ask: t('maker.ex.pet.ask'),
    toml: [...head('ana.cadu-tamagotchi', 'Cadu Tamagotchi'), ['k', '[overlay]'], ['', `slot = ${str('shell.overlay')}`], ['', 'draggable = <span class="k">true</span>'], ['', ''], ['k', '[keys]'], ['', `f = ${str(X('pet', 'keyFeed'))}`], ['', `b = ${str(X('pet', 'keyBath'))}`]],
    plan: t('maker.ex.pet.plan'),
    files: [X('pet', 'file'), M('testsOk', { count: 5 })],
    dev: dev('ana.cadu-tamagotchi', X('pet', 'perms'), M('floatingLayer')),
    ready: t('maker.ex.pet.ready'),
    hint: X('pet', 'hint'),
    price: t('maker.ex.pet.price'),
  },
  {
    tab: `$ ${t('maker.ex.sales.title')}`, id: 'leo.vendas-do-dia', dir: '~/dev/vendas-do-dia', glyph: '$', title: X('sales', 'title'),
    ask: t('maker.ex.sales.ask'),
    toml: [...head('leo.vendas-do-dia', X('sales', 'title')), ['k', '[permissions]'], ['', `net = [${str('api.stripe.com')}]`], ['', ''], ['k', '[views]'], ['', `${X('sales', 'viewToday')} = ${str(X('sales', 'viewTodayText'))}`], ['', `${X('sales', 'viewWeek')} = ${str(X('sales', 'viewWeekText'))}`]],
    plan: t('maker.ex.sales.plan'),
    files: [X('sales', 'file'), M('testsOk', { count: 4 })],
    dev: dev('leo.vendas-do-dia', 'api.stripe.com', M('newPane')),
    view: [ln('h', '', X('sales', 'today'), X('sales', 'todayMeta')), `<div class="ln spark"><span class="lb">${X('sales', 'perHour')}</span><span class="sk">▁▁▂▃▅▇█▆▅▄▃▂</span><span class="mt">${X('sales', 'peak')}</span></div>`,
      ln('h', '', X('sales', 'latest')), ln('row', '●', '#1042 · Marina', X('sales', 'order1')), ln('row', '●', '#1041 · Kenji', X('sales', 'order2')), ln('row', '○', '#1040 · Sofia', X('sales', 'order3'))],
    ready: t('maker.ex.sales.ready'),
    hint: X('sales', 'hint'),
    price: t('maker.ex.sales.price'),
  },
  {
    tab: `↯ ${t('maker.ex.status.title')}`, id: 'orbita.status-page', dir: '~/dev/status-page', glyph: '↯', title: X('status', 'title'),
    ask: t('maker.ex.status.ask'),
    toml: [...head('orbita.status-page', 'Status page'), ['k', '[permissions]'], ['', `net = [${str('githubstatus.com')}, ${str('cloudflarestatus.com')},`], ['', `       ${str('health.aws.amazon.com')}, …]`], ['', ''], ['k', '[schedule]'], ['', `every = ${str('1m')}`], ['', ''], ['k', '[notify]'], ['', `when = ${str(X('status', 'when'))}`]],
    plan: t('maker.ex.status.plan'),
    files: [X('status', 'file'), M('testsOk', { count: 6 })],
    dev: dev('orbita.status-page', X('status', 'perms'), M('newPane')),
    signal: `<span class="err">● ${X('status', 'signal')}</span>`,
    view: [ln('h', '', X('status', 'now'), X('status', 'nowMeta')), status('err', 'AWS · CloudFront', X('status', 'aws')), status('warn', 'GitHub · Actions', X('status', 'github')),
      ...['Cloudflare', 'Vercel', 'OpenAI', 'Anthropic', 'Stripe'].map(n => status('ok', n, X('status', 'operational'))),
      `<div class="ln spark"><span class="lb">${X('status', 'day')}</span><span class="sk">▁▁▁▁▁▁▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▆█</span><span class="mt">${X('status', 'incidents')}</span></div>`],
    ready: t('maker.ex.status.ready'),
    hint: X('status', 'hint'),
    price: t('maker.ex.status.price'),
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
    this.a = { lines: [ln('note dim', '◆', M('intro')), ln('note dim', '└', M('nothingSent'))], input: '', cmp: '', signal: '', status: 'creator mode' };
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
    if (b.mode === 'empty') return { g: '+', title: M('newPane'), signal: '', status: '', hint: M('waiting'), body: ln('note dim', '', M('codeHere')) };
    const code = x.toml.slice(0, b.code).map(([k, t]) => `<div class="ln note code"><span class="tx">${k ? `<span class="k">${t}</span>` : t || ' '}</span></div>`).join('');
    if (b.mode === 'code') return { g: '#', title: 'cadente-plugin.toml', signal: M('lines', { count: b.code }), status: M('writing'), hint: '', body: code };
    if (b.mode === 'run') return { g: x.glyph, title: x.title, signal: x.signal ?? M('inDev'), status: 'cadente plugin dev', hint: x.hint, body: x.view.join('') };
    const out = x.dev.slice(0, b.dev).map(([k, g, t]) => (k === 'cmd' ? ln('cmd', g, t) : k === 'ok' ? ln('out ok', '', `${g} ${t}`) : ln('out', '', t))).join('');
    return { g: '$', title: M('terminalTitle'), signal: b.dev >= 4 ? M('running') : '', status: 'cadente plugin dev', hint: x.pet ? x.hint : '', body: `<div class="blk">${out}</div>` };
  }
  draw() {
    const a = this.a, b = this.paneB(), dir = this.x.dir;
    const caretA = `${esc(a.input)}<b class="cur"> </b>${a.input ? '' : `<span class="hint">${M('placeholder')}</span>`}`;
    this.win.innerHTML = `<div class="win"><span class="tl float"><i></i><i></i><i></i></span><main class="tree"><div class="split row" style="flex-grow:1">`
      + `<div class="cell" style="flex-grow:.54"><section class="pane" data-focused="true"><header class="ph inset"><span class="pl">»</span><span class="pt">${M('chatTitle')}</span><span class="ps">${a.signal}</span></header>`
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
        this.a.signal = M('writing');
        this.say('msg agent', '◆', esc(x.plan));
        this.b.mode = 'code';
        const files = [[M('writingToml'), 'note dim', '└', M('wroteToml')], [M('writingLib'), 'note dim', '└', x.files[0]], [M('runningTests'), 'note ok', '✓', x.files[1]]];
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
        this.a.cmp = `<div class="cmp"><div class="ln row" data-sel="true"><i class="g">/</i><span class="tx">publish</span><span class="mt">${M('publishDesc')}</span></div></div>`;
        this.draw();
        await w(500);
        await type('lish');
        await w(400);
        this.a.input = ''; this.a.cmp = ''; this.a.status = M('publishing');
        this.a.lines.push(`<div class="blk">${ln('cmd', '$', '/publish')}${ln('out', '', M('released'))}${ln('out', '', M('manifestOk'))}</div>`);
        this.draw();
        await w(1100);
        this.a.lines.push(ln('note ok', '✓', M('published')), ln('note dim', '└', esc(x.price)));
        this.a.status = M('inStore');
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
