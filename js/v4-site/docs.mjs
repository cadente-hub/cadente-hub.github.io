// Documentos, a community plugin in the spirit of Obsidian, used in the site's demo: a vault of .md notes with the
// file tree on the left, the note in live preview in the middle (the line under the caret shows its markdown) and the
// links on the right. ↑↓ walk the lines, End edits one in place, ↵ opens a new line that continues the list, espaço
// ticks a task, ⇥ moves between the tree and the note. Nothing goes through the prompt bar.
import { fromManifest, registerFn } from '../v4/engine.mjs';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const inline = t => esc(t)
  .replace(/\[\[([^\]]+)\]\]/g, '<span class="wl">$1</span>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/(^|\s)#([a-zà-ú][\wà-ú-]*)/gi, '$1<span class="tag">#$2</span>')
  .replace(/(^|\s)@(\w+)/g, '$1<span class="at">@$2</span>');
function md(t) {
  let m;
  if ((m = t.match(/^(#{1,3}) (.*)$/))) return [`h${m[1].length}`, inline(m[2])];
  if ((m = t.match(/^- \[( |x)\] (.*)$/))) return [m[1] === 'x' ? 'task done' : 'task', `<b class="cb">${m[1] === 'x' ? '✓' : ''}</b><span>${inline(m[2])}</span>`];
  if ((m = t.match(/^- (.*)$/))) return ['li', `<b class="dot">•</b><span>${inline(m[1])}</span>`];
  return ['', inline(t)];
}
// The line under the caret shows its markdown, with the markers dimmed, as in Obsidian's live preview.
const raw = t => { const m = t.match(/^(#{1,3} |- \[[ x]\] |- )?(.*)$/); return `${m[1] ? `<span class="mk">${esc(m[1])}</span>` : ''}${esc(m[2])}`; };
const prefix = t => (/^- \[[ x]\] /.test(t) ? '- [ ] ' : /^- /.test(t) ? '- ' : '');
const edit = at => ({ path: 'data.draft', label: `linha ${at + 1}`, then: { op: 'fn', name: 'docLine', at } });
const opened = (S, leaf) => S.store.docs.find(x => x.id === leaf.data.open);
const links = d => [...d.lines.join('\n').matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);

export const docs = fromManifest({
  id: 'docs', title: 'Documentos', short: 'MD', glyph: '❖', community: true, author: 'sofia', cursorless: true,
  keywords: 'documentos notas markdown md obsidian cofre wiki',
  hint: '↵ nova linha · End edita · espaço marca a tarefa · ⇥ arquivos',
  init: () => ({ open: null, nav: 0, at: 0, focus: 'files' }),
  view(leaf, S) {
    const d = leaf.data, all = S.store.docs, doc = opened(S, leaf), inp = leaf.input;
    const focused = S.tabs.find(t => t.id === S.active)?.focus === leaf.id;
    let dir = null;
    const tree = all.map((x, i) => {
      const head = x.dir !== dir ? `<div class="tr t1">▾ ${esc(dir = x.dir)}</div>` : '';
      const on = d.focus === 'files' && i === d.nav;
      return `${head}<div class="tr t2${on ? ' on' : ''}${x.id === d.open ? ' open' : ''}"${on ? ' data-at' : ''}>${esc(x.name)}</div>`;
    }).join('');
    let note = '<div class="mdv-empty">↵ abre a nota</div>', side = '', words = 0, open = 0;
    if (doc) {
      note = doc.lines.map((t, i) => {
        const cur = d.focus === 'doc' && i === d.at, editing = cur && d.editing && d.edAt === i;
        if (editing) return `<div class="ml on raw" data-at>${esc(inp.text.slice(0, inp.caret))}<b class="cur">${esc(inp.text[inp.caret] ?? ' ')}</b>${esc(inp.text.slice(inp.caret + 1))}</div>`;
        if (cur) return `<div class="ml on raw" data-at>${raw(t)}${focused ? '<b class="caret"></b>' : ''}</div>`;
        const [cls, html] = md(t);
        return `<div class="ml ${cls}">${html || ' '}</div>`;
      }).join('');
      const back = all.filter(x => x !== doc && links(x).includes(doc.name));
      const out = [...new Set(links(doc))], tags = [...new Set(doc.lines.join(' ').match(/(?:^|\s)#[a-zà-ú][\wà-ú-]*/gi)?.map(s => s.trim()) ?? [])];
      side = `<div class="dbv-h">Links para cá<span>${back.length}</span></div>${back.map(x => `<div class="tr">${esc(x.name)}</div>`).join('') || '<div class="tr dim">nenhum</div>'}`
        + `<div class="dbv-h">Nesta nota<span>${out.length}</span></div>${out.map(n => `<div class="tr wl">${esc(n)}</div>`).join('') || '<div class="tr dim">nenhum link</div>'}`
        + (tags.length ? `<div class="dbv-h">Tags</div>${tags.map(t => `<div class="tr tag">${esc(t)}</div>`).join('')}` : '');
      words = doc.lines.join(' ').split(/\s+/).filter(w => /\w/.test(w) && !/^(#+|-|\[.?\]?)$/.test(w)).length;
      open = doc.lines.filter(t => /^- \[ \] /.test(t)).length;
    }
    const html = `<div class="mdv" data-focus="${d.focus}">`
      + `<aside class="mdv-files"><div class="dbv-h">Arquivos<span>${all.length}</span></div><div class="dbv-tree" data-scrollbox><div class="tr">▾ notas</div>${tree}</div></aside>`
      + `<section class="mdv-note"><div class="dbv-tabs"><span class="on">${doc ? `${esc(doc.dir)} / ${esc(doc.name)}` : 'nenhuma nota aberta'}</span><span>${d.editing ? 'editando' : 'visualização ao vivo'}</span></div><div class="mdv-text" data-scrollbox>${note}</div></section>`
      + `<aside class="mdv-side">${side}</aside>`
      + `<footer class="dbv-st"><span>${doc ? `${words} palavras · ${open} ${open === 1 ? 'tarefa aberta' : 'tarefas abertas'} · salvo em notas/${esc(doc.dir)}/${esc(doc.name)}.md` : 'cofre notas · arquivos .md na sua pasta'}</span><span>${d.editing ? '↵ próxima linha · esc termina' : d.focus === 'files' ? '↵ abre · ⇥ vai para a nota' : '↵ nova linha · End edita · espaço marca'}</span></footer></div>`;
    return { subject: doc?.name, lines: [{ t: 'tui', html }] };
  },
  keys: () => ['ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'End'],
  key(leaf, key, item, S) {
    const d = leaf.data, all = S.store.docs, doc = opened(S, leaf);
    const move = (v, n) => Math.max(0, Math.min(n - 1, v + (key === 'ArrowUp' ? -1 : 1)));
    if (key === 'Tab') return doc ? { data: { focus: d.focus === 'files' ? 'doc' : 'files' } } : null;
    if (d.focus === 'files') {
      if (key === 'ArrowUp' || key === 'ArrowDown') return { data: { nav: move(d.nav, all.length) } };
      if (key === 'Enter') return { data: { open: all[d.nav].id, focus: 'doc', at: 0 } };
      return null;
    }
    if (!doc) return null;
    if (key === 'ArrowUp' || key === 'ArrowDown') return { data: { at: move(d.at, doc.lines.length) } };
    if (key === 'End') return { data: { editing: edit(d.at), edAt: d.at }, input: doc.lines[d.at] };
    if (key === 'Enter') {
      const pre = prefix(doc.lines[d.at]), at = d.at + 1;
      doc.lines.splice(at, 0, pre);
      return { data: { editing: edit(at), edAt: at, at }, input: pre };
    }
    if (key === ' ') {
      const t = doc.lines[d.at];
      if (!/^- \[[ x]\] /.test(t)) return null;
      doc.lines[d.at] = t.startsWith('- [ ]') ? t.replace('- [ ]', '- [x]') : t.replace('- [x]', '- [ ]');
      return {};
    }
    return null;
  },
  signal: leaf => (leaf.data.editing ? 'editando' : 'salvo'),
});

registerFn({
  // ↵ while writing: keep the line and, inside a list, open the next item; ↵ on an empty item ends the list.
  docLine(S, leaf, ctx, op) {
    const doc = opened(S, leaf), text = leaf.data.draft ?? '', pre = prefix(text);
    leaf.data.draft = null;
    if (!doc) return {};
    // The prompt trims what it submits, so an empty item arrives as "- [ ]" or "-".
    if (/^(- \[[ x]\]|-)$/.test(text.trim())) { doc.lines[op.at] = ''; return {}; }
    doc.lines[op.at] = text;
    if (!pre) return {};
    const at = op.at + 1;
    doc.lines.splice(at, 0, pre);
    return { data: { editing: edit(at), edAt: at, at }, input: pre };
  },
});
