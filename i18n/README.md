# Traduções do site

pt-BR é o original. Cada idioma tem dois catálogos:

- `site.json`: os textos das páginas e dos scripts do site (`js.*`), na mesma estrutura do `pt-BR/site.json`.
- `demo.json`: os textos que a janela do Cadente mostra no site. É um objeto `{ "texto em pt-BR": "tradução" }`, com uma
  entrada para cada texto de `demo-strings.json`.

`locales.json` lista os 15 idiomas do app. Só os marcados `ready` viram páginas, e o build para se um deles não tiver
uma chave que a página usa.

## Atualizar

- Texto novo numa página ou num script: entre em `pt-BR/site.json` e em todos os idiomas prontos.
- Mudou o que a janela mostra (protótipo sincronizado, capítulo novo): com `npm run dev` rodando, rode
  `node scripts/i18n/harvest-demo.mjs`, que regrava `demo-strings.json`, traduza o que entrou e confira com
  `node scripts/i18n/check.mjs <código>`.

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

## Traduzir um idioma inteiro

Um idioma fica pronto com quatro arquivos, e `node scripts/i18n/check.mjs <código>` diz o que ainda falta:

1. `i18n/<código>/site.json`: a mesma estrutura e as mesmas chaves do `pt-BR/site.json`. Traduza a partir do pt-BR
   e use o `en/site.json` como referência de sentido.
2. `i18n/<código>/demo.json`: uma entrada para cada texto de `demo-strings.json`.
3. `i18n/<código>/terms.html`: tradução de `en/terms.html` (o original), com as mesmas tags.
4. `content/blog/<código>/bem-vindo-ao-blog.md`: tradução do post, com o mesmo `slug` e as datas iguais.

Cuidados no `site.json`:

- `hero.before`, `hero.hub` e `hero.after` formam a frase do topo ("Cadente é" + "um hub" + "."). Cada item de
  `js.hero.words` entra no lugar de `hero.hub`, riscado, então tem que fazer sentido na mesma frase. `js.hero.stars`
  tem um nome curto para cada item de `js.hero.words`, na mesma ordem e com o mesmo número de itens.
- `lang.notice` e `lang.go` aparecem para quem tem o navegador nesse idioma: escreva "Esta página também está em
  <idioma>" e "Ver em <idioma>" no próprio idioma.
- `terms.notice` avisa que é uma tradução e que vale o texto em inglês, com o link `/en/terms-and-conditions.html`.
- Cada termo de `js.store.demoSearches` precisa aparecer no nome, na descrição ou na categoria de algum plugin de
  `js.store.app` do mesmo idioma, porque a loja da home digita esses termos sozinha.
- Plurais: use as categorias do idioma em `Intl.PluralRules` (o russo tem `one`, `few`, `many`, `other`; o japonês,
  o coreano, o chinês, o vietnamita e o indonésio só `other`), e cada forma mantém o `{count}`.
- Os nomes dos plugins de fábrica (`js.plugins.title`) e os rótulos da janela devem bater com o `demo.json` do idioma.

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
