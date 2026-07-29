---
status: resolved
trigger: 'funcionou mais estranho e em ingles e nao abre apertando duas vezes'
created: 2026-07-29
updated: 2026-07-29
---

# Debug: tray em inglês e duplo clique sem ação

## Symptoms

- Expected: menu do tray acompanha PT-BR/inglês do sistema e duplo clique restaura/foca o aplicativo.
- Actual: menu aparece com textos fixos em inglês; duplo clique no ícone não abre a janela.
- Error messages: nenhum erro visível.
- Timeline: observado após o botão minimizar passar a funcionar.
- Reproduction: minimizar o app, abrir o menu do tray ou clicar duas vezes no ícone.

## Current Focus

- hypothesis: confirmada — o modelo continha strings inglesas fixas, não havia `on_tray_icon_event` e o menu abria já no primeiro clique esquerdo.
- test: contratos unitários para menu PT-BR/EN, tooltip localizado e ligação do duplo clique esquerdo.
- expecting: confirmado — testes falharam antes e passaram após localização e registro do evento.
- next_action: resolvido; validar no instalador atualizado.
- reasoning_checkpoint: os prints confirmam que o tray existe e o menu abre; o defeito é de comportamento/conteúdo, não de criação do ícone.
- tdd_checkpoint: GREEN — 16 contratos do shell e 24 testes Rust passaram.

## Evidence

- timestamp: 2026-07-29T19:10:00-03:00
  observation: `tray.rs` contém todas as labels em inglês e `main.rs` não registra `on_tray_icon_event`.
  implication: ambos os sintomas possuem causas diretas e independentes no host Rust.

## Eliminated

- hypothesis: o tray não foi criado.
  reason: ícone e menu são visíveis nas capturas.

## Resolution

- root_cause: labels e defaults do tray estavam fixos em inglês; `TrayIconBuilder` só tratava eventos do menu e mantinha `show_menu_on_left_click(true)`.
- fix: locale do sistema via `sys-locale`, catálogos PT-BR/EN para menu e tooltip, menu apenas no clique direito e duplo clique esquerdo chamando `unminimize → show → focus`.
- verification: 24/24 testes Rust, 16/16 contratos do shell e build NSIS concluído; Clippy completo permanece bloqueado apenas por avisos anteriores fora deste escopo.
- files_changed: `Cargo.toml`, `Cargo.lock`, `main.rs`, `tray.rs`, `shell_contract.rs`.
