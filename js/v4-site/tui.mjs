// The interactive screens of the agent CLIs inside the site's Terminal. Typing `claude` opens the CLI; the next line
// typed is the task. Claude Code, Codex and agy play real screen recordings (recordings.json, made with
// scripts/capture-cli.py and scripts/import-cli-recordings.mjs): every character, colour and attribute as the CLI drew
// it. A CLI without a recording falls back to a drawn approximation (STYLE below).
import REC from './recordings.json' with { type: 'json' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const span = (cls, t) => `<span class="${cls}">${t}</span>`;
const dim = t => span('t-dim', t), acc = t => span('t-acc', t), bold = t => span('t-b', t), ok = t => span('t-ok', t);
const took = s => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);

// Portuguese step lines of the demo agents, read as tool calls.
function tool(text) {
  const t = text.trim();
  let m;
  if ((m = t.match(/^lendo (.+)$/))) return { name: 'Read', arg: m[1], note: 'Read 182 lines' };
  if ((m = t.match(/^editando (\S+)\s+\+(\d+)\s+−(\d+)$/))) return { name: 'Update', arg: m[1], note: `Updated ${m[1]} with ${m[2]} additions and ${m[3]} removals`, add: m[2], del: m[3] };
  if ((m = t.match(/^escrevendo (\S+)\s+\+(\d+)$/))) return { name: 'Write', arg: m[1], note: `Wrote ${m[2]} lines to ${m[1]}`, add: m[2], del: '0' };
  if ((m = t.match(/^aplicando patch em (\S+)\s+\+(\d+)\s+−(\d+)$/))) return { name: 'Edit', arg: m[1], note: `+${m[2]} −${m[3]}`, add: m[2], del: m[3] };
  if ((m = t.match(/^refatorando (\S+)\s+\+(\d+)\s+−(\d+)$/))) return { name: 'Edit', arg: m[1], note: `+${m[2]} −${m[3]}`, add: m[2], del: m[3] };
  if ((m = t.match(/^rodando (.+)$/))) return { name: 'Bash', arg: m[1], note: 'Running…' };
  if ((m = t.match(/^planejando (.+)$/))) return { name: 'Plan', arg: m[1], note: m[1] };
  if ((m = t.match(/^indexando (.+)$/))) return { name: 'List', arg: '.', note: 'Listed 214 paths' };
  if ((m = t.match(/^resumindo (.+)$/))) return { name: 'Read', arg: 'docs/', note: m[1] };
  return { name: 'Task', arg: t, note: '' };
}

// The transcript, from the block's output lines.
function transcript(b) {
  const items = [];
  for (const o of b.out) {
    const text = typeof o === 'string' ? o : o.text, tone = typeof o === 'string' ? '' : o.tone;
    if (tone === 'you') items.push({ k: 'you', text });
    else if (tone === 'warn') items.push({ k: 'ask', text: text.replace(/^\? /, '').replace(/ · y permite · n nega$/, '') });
    else if (tone === 'ok') items.push({ k: 'done', text: text.replace(/^✓ /, '') });
    else if (tone === 'dim') { const m = text.match(/trabalhou (.+?) ·/); if (m) items.push({ k: 'took', text: m[1] }); }
    else if (/^● /.test(text)) items.push({ k: 'step', text: text.slice(2) });
    else if (/^✓ permitido/.test(text)) items.push({ k: 'yes' });
    else if (/^✗ negado/.test(text)) items.push({ k: 'no' });
    else if (/interrompido/.test(text)) items.push({ k: 'stop' });
  }
  // The last step is the one running while the agent works.
  const live = b.state === 'trabalhando' ? items.findLastIndex(x => x.k === 'step') : -1;
  const asking = b.state === 'precisa de você' ? items.findLastIndex(x => x.k === 'ask') : -1;
  return { items, live, asking };
}
const command = text => text.match(/`([^`]+)`/)?.[1] ?? text;

const STYLE = {
  claude: {
    header: (b, o) => `<div class="tui-box"><div>${acc('✻')} ${bold('Welcome to Claude Code!')}</div><div>&nbsp;</div><div>${dim('  /help for help, /status for your current setup')}</div><div>&nbsp;</div><div>${dim(`  cwd: ${esc(o.ctx.cwd)}`)}</div></div>`,
    you: t => `<div class="tui-you">${dim('&gt;')} ${esc(t)}</div>`,
    step: (s, live) => { const x = tool(s); return `<div>${live ? acc('⏺') : ok('⏺')} ${bold(x.name)}(${esc(x.arg)})</div><div>${dim(`  ⎿  ${live && x.name === 'Bash' ? 'Running…' : esc(x.note)}`)}</div>`; },
    ask: (t, open) => (open ? `<div class="tui-box tui-ask"><div>${bold('Bash command')}</div><div>&nbsp;&nbsp;${esc(command(t))}</div><div>Do you want to proceed?</div><div>${acc('❯ 1. Yes')}</div><div>&nbsp;&nbsp;2. Yes, and don't ask again this session</div><div>&nbsp;&nbsp;3. No, and tell Claude what to do differently ${dim('(esc)')}</div></div>` : ''),
    done: t => `<div>${ok('⏺')} ${esc(t)}</div>`,
    took: t => `<div>${dim(`✻ Worked for ${esc(t)}`)}</div>`,
    spin: s => `<div>${span('t-acc', '<i class="spin"></i>')} ${acc('Pondering…')} ${dim(`(${took(s)} · esc to interrupt)`)}</div>`,
    input: (o, caret) => `<div class="tui-box tui-in"><span class="t-dim">&gt;</span> ${caret || dim('Try "refactor &lt;filepath&gt;"')}</div><div class="tui-foot">${dim('? for shortcuts')}<span>${dim(esc(o.model))}</span></div>`,
  },
  codex: {
    header: (b, o) => `<div class="tui-box"><div>${dim('&gt;_')} ${bold('OpenAI Codex')} ${dim('(v0.50.0)')}</div><div>&nbsp;</div><div>${dim('model:    ')} ${esc(o.model)}   ${dim('/model to change')}</div><div>${dim('directory:')} ${esc(o.ctx.cwd)}</div></div><div>${dim('  To get started, describe a task or try one of these commands:')}</div><div>${dim('  /init · /status · /approvals · /model')}</div>`,
    you: t => `<div class="tui-you">${acc('›')} ${esc(t)}</div>`,
    step: (s, live) => { const x = tool(s); const verb = { Read: 'Explored', Update: 'Edited', Write: 'Added', Edit: 'Edited', Bash: live ? 'Running' : 'Ran', Plan: 'Updated Plan', List: 'Explored' }[x.name] ?? x.name; return `<div>${live ? dim('•') : ok('•')} ${bold(verb)} ${esc(x.name === 'Bash' ? x.arg : x.arg)}${x.add ? ` ${ok(`(+${x.add}`)} ${span('t-red', `-${x.del})`)}` : ''}</div>`; },
    ask: (t, open) => (open ? `<div class="tui-box tui-ask"><div>${bold('Would you like to run the following command?')}</div><div>&nbsp;&nbsp;${dim('$')} ${esc(command(t))}</div><div>${acc('› 1. Yes, proceed')}</div><div>&nbsp;&nbsp;2. Yes, and don't ask again for this command</div><div>&nbsp;&nbsp;3. No, and tell Codex what to do differently ${dim('esc')}</div></div>` : ''),
    done: t => `<div>${ok('•')} ${esc(t)}</div>`,
    took: t => `<div class="tui-rule">${dim(`─ Worked for ${esc(t)} ─`)}</div>`,
    spin: s => `<div>${span('t-dim', '<i class="spin"></i>')} ${bold('Working')} ${dim(`(${took(s)} • esc to interrupt)`)}</div>`,
    input: (o, caret) => `<div class="tui-in tui-in--bar">${acc('›')} ${caret || dim('Ask Codex to do anything')}</div><div class="tui-foot">${dim('⏎ send   ⌃J newline   ⌃T transcript')}<span>${dim('100% context left')}</span></div>`,
  },
  agy: {
    header: (b, o) => `<div class="tui-logo">${acc('◢◣')} ${bold('agy')} ${dim('· agent')}</div><div>${dim(`${o.model} · ${o.ctx.cwd} · ${o.ctx.branch}`)}</div><div>${dim('digite a tarefa · @ arquivos · / comandos')}</div>`,
    you: t => `<div class="tui-you">${acc('✦')} ${esc(t)}</div>`,
    step: (s, live) => { const x = tool(s); return `<div>${live ? acc('●') : ok('●')} ${bold(x.name.toLowerCase())} ${esc(x.arg)}${x.add ? ` ${ok(`+${x.add}`)}` : ''}</div>`; },
    ask: (t, open) => (open ? `<div class="tui-box tui-ask"><div>${bold('permitir comando?')}</div><div>&nbsp;&nbsp;${esc(command(t))}</div><div>${acc('[y] sim')}   [a] sempre   [n] não</div></div>` : ''),
    done: t => `<div>${ok('✓')} ${esc(t)}</div>`,
    took: t => `<div>${dim(`concluído em ${esc(t)}`)}</div>`,
    spin: s => `<div>${span('t-acc', '<i class="spin"></i>')} ${dim(`trabalhando · ${took(s)} · esc para`)}</div>`,
    input: (o, caret) => `<div class="tui-box tui-in">${acc('›')} ${caret || dim('o que vamos fazer?')}</div>`,
  },
  opencode: {
    header: (b, o) => `<div class="tui-logo tui-logo--big">${bold('open')}${dim('code')}</div><div>${dim('v0.15.0')}</div><div>&nbsp;</div><div>${dim('/new     nova sessão')}</div><div>${dim('/models  trocar o modelo')}</div><div>${dim('tab      trocar de agente')}</div>`,
    you: t => `<div class="tui-you tui-you--bar">${esc(t)}</div>`,
    step: (s, live) => { const x = tool(s); return `<div class="tui-tool">${live ? acc('⬝') : dim('│')} ${bold(x.name)} ${dim(esc(x.arg))}${x.add ? ` ${ok(`+${x.add}`)} ${span('t-red', `−${x.del}`)}` : ''}</div>`; },
    ask: () => '',
    done: t => `<div>${esc(t)}</div>`,
    took: t => `<div>${dim(`${esc(t)}`)}</div>`,
    spin: s => `<div>${span('t-acc', '<i class="spin"></i>')} ${dim(`gerando · ${took(s)}`)}</div>`,
    input: (o, caret) => `<div class="tui-box tui-in tui-in--bar">${caret || dim('pergunte qualquer coisa…')}</div><div class="tui-foot">${acc('BUILD')} ${dim('agent · tab')}<span>${dim(esc(o.model))}</span></div>`,
  },
};

export function tui(b, o) {
  if (hasRecording(b.agent)) return recordingScreen(b, o);
  const st = STYLE[b.agent] ?? STYLE.agy, { items, live, asking } = transcript(b);
  const body = items.map((x, i) => x.k === 'you' ? st.you(x.text) : x.k === 'step' ? st.step(x.text, i === live) : x.k === 'ask' ? st.ask(x.text, i === asking) : x.k === 'done' ? st.done(x.text) : x.k === 'took' ? st.took(x.text) : x.k === 'stop' ? `<div>${span('t-red', '■ Interrupted')}</div>` : '').join('');
  const spin = b.state === 'trabalhando' ? st.spin(Math.max(0, (o.clock ?? 0) - (b.started ?? 0))) : '';
  const t = o.input?.text ?? '', at = o.input?.caret ?? t.length;
  const caret = o.focused ? `${esc(t.slice(0, at))}<b class="cur">${esc(t[at] ?? ' ')}</b>${esc(t.slice(at + 1))}` : esc(t);
  return `<div class="tui tui--${esc(b.agent)}">${st.header(b, o)}<div class="tui-log">${body}${spin}</div><div class="tui-grow"></div>${asking >= 0 ? '' : st.input(o, t || o.focused ? caret : '')}</div>`;
}

// ── Recorded screens ──────────────────────────────────────────────────
// Recordings play at twice their real speed, so a 40 s task fits a chapter.
const SPEED = 2;
const NAMED = { black: '#1e1e1e', red: '#ff8272', green: '#b4fa72', brown: '#fefdc2', yellow: '#fefdc2', blue: '#6aa9ff', magenta: '#ff8ffd', cyan: '#5fd7ff', white: '#e6e6e6' };
const tone = c => (c === 'default' ? null : NAMED[c] ?? NAMED[c.replace(/^bright/, '')] ?? (/^[0-9a-f]{6}$/i.test(c) ? `#${c}` : null));
export const hasRecording = agent => !!REC[agent];
const phase = (rec, kind) => rec.frames.filter(f => f.kind === kind);

// Each recorded screen is drawn as an SVG on the terminal's own grid: every run starts at its exact column and is
// stretched to its exact width, block characters become pixel rectangles and rules become lines. The SVG scales to
// the pane, so the screen keeps its layout at any pane size and with any font the visitor has.
const CW = 8.4, CH = 17, BASE = 12.5;
const QUAD = { '▘': 1, '▝': 2, '▖': 4, '▗': 8, '▀': 3, '▄': 12, '▌': 5, '▐': 10, '▚': 9, '▞': 6, '▛': 7, '▜': 11, '▙': 13, '▟': 14, '█': 15 };
const PLAIN = ['default', 'default', false, false, false, false];
const n = v => Math.round(v * 10) / 10;
function colors([fg, bg, , , , reverse]) {
  let f = tone(fg) ?? '#e6e6e6', b = tone(bg);
  if (reverse) [f, b] = [b ?? '#000', tone(fg) ?? '#e6e6e6'];
  return [f, b];
}
function svgRows(rec, rows, extra = '') {
  let back = '', front = '';
  rows.forEach((runs, y) => {
    let x = 0;
    for (const [t, si] of runs) {
      const st = Array.isArray(si) ? si : rec.styles[si], [f, b] = colors(st), chars = [...t];
      if (b) back += `<rect x="${n(x * CW)}" y="${y * CH}" width="${n(chars.length * CW)}" height="${CH}" fill="${b}"/>`;
      let seg = '', sx = x;
      const flush = () => {
        if (seg.trim()) front += `<text x="${n(sx * CW)}" y="${n(y * CH + BASE)}" textLength="${n([...seg].length * CW)}" lengthAdjust="spacingAndGlyphs" fill="${f}"${st[2] ? ' font-weight="700"' : ''}${st[3] ? ' font-style="italic"' : ''}>${esc(seg)}</text>`;
        seg = '';
      };
      chars.forEach((ch, i) => {
        const cx = x + i;
        if (QUAD[ch]) {
          flush();
          for (let q = 0; q < 4; q++) if (QUAD[ch] & (1 << q)) front += `<rect x="${n((cx + (q % 2) / 2) * CW)}" y="${n((y + (q > 1 ? 0.5 : 0)) * CH)}" width="${n(CW / 2 + 0.2)}" height="${n(CH / 2 + 0.2)}" fill="${f}"/>`;
          return;
        }
        if (ch === '─' || ch === '━') { flush(); front += `<rect x="${n(cx * CW)}" y="${n(y * CH + CH / 2 - 0.6)}" width="${n(CW + 0.2)}" height="1.2" fill="${f}"/>`; return; }
        if (ch === '│' || ch === '┃') { flush(); front += `<rect x="${n(cx * CW + CW / 2 - 0.6)}" y="${y * CH}" width="1.2" height="${CH}" fill="${f}"/>`; return; }
        if (ch === '└' || ch === '⎿') { flush(); front += `<rect x="${n(cx * CW + CW / 2 - 0.6)}" y="${y * CH}" width="1.2" height="${n(CH / 2 + 0.6)}" fill="${f}"/><rect x="${n(cx * CW + CW / 2 - 0.6)}" y="${n(y * CH + CH / 2 - 0.6)}" width="${n(CW / 2 + 0.8)}" height="1.2" fill="${f}"/>`; return; }
        // Spaces end a word: each word is its own <text> at its own column, so a browser that collapses spaces
        // cannot shift or stretch the words after it.
        if (ch === ' ' || ch === '\u00a0') { flush(); return; }
        if (!seg) sx = cx;
        seg += ch;
      });
      flush();
      x += chars.length;
    }
  });
  return `<svg class="tui-svg" viewBox="0 0 ${n(rec.cols * CW)} ${rec.rows * CH}" preserveAspectRatio="xMinYMin meet" font-family="Hack, ui-monospace, Menlo, monospace" font-size="13.6" xml:space="preserve">${back}${front}${extra}</svg>`;
}
// The empty prompt row of the welcome screen, with what is being typed in place of the placeholder, and the caret.
function typedRuns(rec, li, text) {
  const out = [], col = rec.input.col;
  let x = 0;
  for (const [t, si] of rec.lines[li]) {
    if (x >= col) break;
    out.push([t.slice(0, col - x), si]);
    x += t.length;
  }
  if (x < col) out.push([' '.repeat(col - x), PLAIN]);
  out.push([text, PLAIN]);
  return out;
}
function frameFor(rec, b, clock) {
  if (b.state === 'ocioso') return phase(rec, 'welcome')[0];
  if (b.state === 'precisa de você') return phase(rec, 'ask')[0];
  if (b.state === 'pronto' || b.state === 'interrompido') return phase(rec, 'done')[0] ?? rec.frames.at(-1);
  const fs = phase(rec, b.phase ?? 'work');
  if (!fs.length) return phase(rec, 'done')[0];
  const at = fs[0].t + Math.max(0, clock - (b.started ?? clock)) * SPEED;
  return fs.findLast(f => f.t <= at) ?? fs[0];
}
function recordingScreen(b, o) {
  const rec = REC[b.agent], f = frameFor(rec, b, o.clock ?? 0);
  const typing = f.kind === 'welcome' && rec.input && (o.input?.text || o.focused);
  const t = o.input?.text ?? '', at = o.input?.caret ?? t.length;
  const rows = f.rows.map((li, y) => (typing && y === rec.input.row ? typedRuns(rec, li, t) : rec.lines[li]));
  const caret = typing && o.focused ? `<rect class="tui-caret" x="${n((rec.input.col + at) * CW)}" y="${rec.input.row * CH + 1}" width="${CW}" height="${CH - 2}"/>` : '';
  return `<div class="tui-rec">${svgRows(rec, rows, caret)}</div>`;
}
// One tick of time: the recording moves on, asks for permission where the real CLI asked, and finishes.
export function recordingTick(b, S) {
  const rec = REC[b.agent], clock = S?.clock ?? 0;
  const fs = phase(rec, b.phase ?? 'work');
  const end = fs.length ? (fs.at(-1).t - fs[0].t) / SPEED + 1 : 0;
  if (clock - (b.started ?? clock) < end) return { ...b };
  if ((b.phase ?? 'work') === 'work' && phase(rec, 'ask').length) return { ...b, state: 'precisa de você', out: [...b.out, { text: '? pede permissão · y permite · n nega', tone: 'warn' }] };
  const spent = clock - (b.started0 ?? b.started ?? clock);
  return { ...b, state: 'pronto', running: true, ok: true, ms: took(spent), out: [...b.out, { text: '✓ concluído', tone: 'ok' }] };
}
export function recordingAnswer(b, key, S) {
  return { ...b, state: 'trabalhando', phase: 'after', started0: b.started0 ?? b.started, started: S?.clock ?? 0, out: [...b.out, key === 'n' ? '● seguindo sem isso' : '● trabalhando'] };
}
