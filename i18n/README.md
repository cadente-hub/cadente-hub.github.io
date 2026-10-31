# Traduções do site

pt-BR é o original. Cada idioma tem dois catálogos:

- `site.json`: os textos das páginas e dos scripts do site (`js.*`), na mesma estrutura do `pt-BR/site.json`.
- `demo.json`: os textos que a janela do Cadente mostra no site. É um objeto `{ "texto em pt-BR": "tradução" }`, com uma
  entrada para cada texto de `demo-strings.json`.

`locales.json` lista os 15 idiomas do app. Só os marcados `ready` viram páginas, e um idioma `ready` precisa ter todas
as chaves e os mesmos placeholders do pt-BR (`npm test`).

## Atualizar

- Texto novo numa página ou num script: entre em `pt-BR/site.json` e em todos os idiomas prontos.
- Mudou o que a janela mostra (protótipo sincronizado, capítulo novo): com `npm run dev` rodando, rode
  `node scripts/i18n/harvest-demo.mjs`, que regrava `demo-strings.json`, e traduza o que entrou.

## Regras para traduzir

- Mantenha os placeholders iguais: `{0}`, `{1}` são números; `{name}`, `{count}` e afins são valores.
- Mantenha o HTML (`<kbd>`, `<code>`, `<b>`, `<br />`, `<span class="…">`), os símbolos de tecla (`⌘ ⇧ ⌥ ↵ ⇥ ⌫ ↑ ↓ ← →`)
  e os glifos no começo do texto (`» Chat`, `↵ abre`).
- Não traduza: código, JSON, SQL, comandos (`cargo test`, `/publish`), caminhos, nomes de arquivo, branches, URLs,
  handles (`@ana`), nomes de pessoas, marcas e produtos (Claude Code, Codex, Postgres, GitHub, Kanban), ids de plugin
  (`cadente.ai.ollama`).
- A janela é uma interface de teclado em letras minúsculas: mantenha o estilo curto e as minúsculas do original.
- Um plural vira um objeto `{ "one": "…", "other": "…" }` com as categorias do idioma (`Intl.PluralRules`), e cada
  forma mantém o `{count}`.

## Termos

| pt-BR | en | sentido |
|---|---|---|
| folha | pane | uma área da janela onde um plugin abre |
| página, aba | page, tab | um conjunto de folhas, como as abas de um navegador |
| plugin de fábrica | built-in plugin | vem com o app |
| Loja | Store | a loja de plugins |
| Início, Calendário, Sistema, Uso, Foco, Automações, Projetos, Recursos, Ferramentas, Configurações | Home, Calendar, System, Usage, Focus, Automations, Projects, Resources, Tools, Settings | plugins de fábrica |
| Quadro, Documentos, Navegador | Board, Documents, Browser | plugins da comunidade |
| provider | provider | quem fornece um serviço (o modelo de IA, o terminal) |
| vista | view | cada modo de um plugin, trocado com ⇥ |
| vitrine, mapa | showcase, map | projetos de exemplo |
| ata | meeting notes | a nota da reunião |
