// The plugin store in a pane, for the site's demo.
// Typing filters the community plugins, ↵ shows one with what it asks for, and ↵ on "instalar" installs it:
// download, signature check, and the same pane opens the new plugin.
import { fromManifest, registerFn, h, row, note } from '../v4/engine.mjs';

const item = (S, id) => S.store.shop.find(x => x.id === id);
const back = { data: { mode: null, view: 'descobrir', pick: null }, cursor: 0 };

const base = fromManifest({
  id: 'loja', title: 'Loja', short: 'LOJA', glyph: '✦', store: true,
  keywords: 'loja store plugins comunidade instalar baixar descobrir',
  hint: 'digite para buscar · ↵ abre o plugin · ↵ instala',
  init: () => ({ mode: null, pick: null }),
  view(leaf, S) {
    if (leaf.data.view !== 'plugin') return null;
    const x = item(S, leaf.data.pick);
    if (!x) return { lines: [note('plugin removido da loja', 'dim')] };
    const busy = leaf.data.busy;
    return { subject: x.name, lines: [
      h(`${x.glyph} ${x.name}`, `@${x.author} · v${x.version}`),
      note(x.desc),
      note(`${x.size} · código aberto · assinado pelo autor`, 'dim'),
      h('pede acesso a', String(x.perms.length)),
      ...(x.perms.length ? x.perms.map(p => note(p, null, '·')) : [note('nada além do Core', 'dim', '·')]),
      { t: 'hr' },
      busy ? note(`${busy.label}…`, 'accent', '◌')
        : row('loja:go', x.installed ? '▶' : '↓', x.installed ? `abrir ${x.name}` : `instalar · ${x.label}`, x.installed ? 'nesta folha' : 'sem reiniciar nada', 'accent', { kind: 'install' }),
      row('loja:back', '←', 'voltar à loja', 'esc', null, { kind: 'back' }),
    ] };
  },
  activate(leaf, line, S) {
    if (line.kind === 'back') return back;
    if (line.kind !== 'install') return null;
    const x = item(S, leaf.data.pick);
    if (!x) return null;
    if (x.installed) return x.plugin ? { actions: [{ type: 'OPEN', pane: leaf.id, plugin: x.plugin }] } : { toast: `${x.name} já está instalado` };
    leaf.data.busy = { label: `baixando ${x.name} · ${x.size}`, then: { op: 'fn', name: 'lojaCheck', id: x.id } };
    return {};
  },
  escape: leaf => (leaf.data.mode === 'detail' ? back : null),
  signal: leaf => (leaf.data.busy ? 'instalando' : 'comunidade'),
});

// The catalogue opens with the community's size: anyone publishes, and installing costs nothing.
export const loja = {
  ...base,
  view(leaf, S) {
    const v = base.view(leaf, S);
    if (leaf.data.view === 'descobrir' && !leaf.input.text) v.lines = [note('milhões de plugins feitos pela comunidade · todos instalam de graça', 'accent', '✦'), ...v.lines];
    return v;
  },
};

registerFn({
  lojaOpen: (S, leaf, { item: x }) => ({ data: { mode: 'detail', view: 'plugin', pick: x.id }, cursor: 0 }),
  lojaCheck(S, leaf, ctx, op) {
    const x = item(S, op.id);
    leaf.data.busy = { label: `conferindo a assinatura de @${x.author} e as permissões`, then: { op: 'fn', name: 'lojaDone', id: x.id } };
    return {};
  },
  lojaDone(S, leaf, ctx, op) {
    const x = item(S, op.id);
    Object.assign(x, { installed: true, label: 'instalado' });
    const toast = `${x.name} da @${x.author} instalado`;
    return x.plugin ? { toast, actions: [{ type: 'OPEN', pane: leaf.id, plugin: x.plugin }] } : { toast, ...back };
  },
});
