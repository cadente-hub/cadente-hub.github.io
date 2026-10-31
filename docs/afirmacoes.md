# O que o site afirma, e onde está a prova

Cada afirmação da home tem que estar no código do app (`cadente-app`) ou numa decisão escrita (ADR). Afirmação sem
prova sai do site. Conferido em 31/10/2026, com o app na versão 1.1.0 (beta 1.1.0-beta.2; o canal estável ainda é o
app Tauri 0.2.93).

| Afirmação no site | Estado | Prova |
|---|---|---|
| Grátis, sem plano pago | decidido, Pro sai na 1.1.0 | `docs/adr/0077-plataforma-de-plugins-loja-e-monetizacao.md`, linhas 444-450 e 556 |
| Mac, Windows e Linux | sim (x64 no Linux e no Windows; Apple Silicon e Intel no Mac) | `cadente-hub.github.io/.github/workflows/native-release.yml`, linhas 87-90 |
| Feito em Rust, desenhado pela GPU | sim (Slint com `renderer-skia`) | `crates/app/Cargo.toml`, linha 36 |
| 15 idiomas, troca sem reiniciar | sim | `crates/app/src/live/i18n.rs`; `crates/app/src/live/mod.rs`, linhas 446-459 |
| Algumas telas novas chegam antes em pt-BR e inglês | sim, dito no FAQ | revisões do legado, `docs/conformance/adr-0050/p04-02-review.md:10` (tag `legacy-final`) |
| Reconhece Claude Code, Codex, Gemini CLI e OpenCode | sim | `crates/core/src/services/terminal_cli_detect.rs`, linha 9 |
| Qualquer outro CLI roda no terminal | sim (terminal com pty nativo) | `crates/core/src/terminal.rs` |
| Um worktree por tarefa | sim (criar, listar e remover worktrees) | `crates/native-workspace/src/repository_service.rs`, linhas 197-204, 229, 266 |
| Quem trabalha e quem espera por você, num lugar só (⌘⇧A) | sim | `crates/app/src/shell/model.rs`, linhas 1338-1340; `crates/app/ui/ds/status.slint`, linha 17 |
| Use a assinatura do Claude e do ChatGPT, chaves de API ou modelo local | sim | `crates/core/src/state.rs`, linhas 287-291; `crates/core/src/services/oauth_openai.rs`; `crates/native-models/src/providers/` |
| As chamadas vão direto ao provedor, sem servidor do Cadente no meio | sim; o backend guarda só conta e cobrança | `supabase/migrations/20261002120000_lock_profile_billing.sql` (não há funções que repassem chamadas de modelo) |
| Dados na sua máquina | sim (`core.db` em SQLite no diretório de dados) | `crates/launcher/src/paths.rs`, linha 176 |
| Tudo é plugin, com provider trocável | sim (Registry com ciclo de ativação) | `docs/ARCHITECTURE.md`, princípio 3; `crates/core/src/services/native_profile.rs`, linhas 449-559 |
| Instalar plugin sem reiniciar | sim para pacotes `.cdb` | `crates/plugin-host-wasm/src/lib.rs`, linhas 1-5 |
| Funciona sem IA | sim (o Chat tem o estado "sem modelo"; os outros plugins não dependem de IA) | `crates/app/src/live/faces/chat.rs`, linhas 1283 e 1633 |
| Loja aberta, indexada pelo topic `cadente-plugin` | em breve (1.3.0) | ADR 0077, linhas 407-412 e 626-628 |
| Plugin malicioso bloqueado em todas as máquinas | em breve (1.3.0) | ADR 0077, linhas 426-429 |
| Plugins da comunidade em WebAssembly, com permissões | em breve (1.2.0); hoje há um host inicial sem imports | ADR 0077, linhas 181 e 213-232; `crates/plugin-host-wasm/src/lib.rs`, linhas 1-33 |
| Creator mode: 70% das vendas e renovações, 90% das doações | decidido, em breve (1.4.0) | ADR 0077, linhas 444-450 e 645-648 |

## O que saiu do site

- "Milhões de plugins": a loja ainda não abriu.
- "18 plugins de fábrica": o app registra 21 plugins, alguns de infraestrutura, e nem todos os da janela de
  demonstração existem no app nativo (a revisão de PR, por exemplo).
- Permissões mostradas antes de instalar: chegam com os plugins WebAssembly da 1.2.0.

## A janela de demonstração

A janela que toca no site é o protótipo v4 (`js/v4`, gerado por `scripts/sync-v4.mjs`), o desenho para onde o app
vai. Ela mostra o dia de trabalho completo, incluindo plugins que ainda chegam ao app nativo.
