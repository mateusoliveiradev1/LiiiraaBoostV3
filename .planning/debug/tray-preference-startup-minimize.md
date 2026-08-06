---
status: resolved
trigger: 'bugou de uma forma muito grande q ate o botao de minimizar na bandeija bugou ta ativo e ele nao minimiza na bandeija'
created: 2026-08-06
updated: 2026-08-06
---

# Debug: preferência ativa não minimiza para a bandeja

## Symptoms

- Expected: com “Manter na bandeja” ativo, minimizar ou fechar deve ocultar a janela na bandeja e permitir restaurá-la pelo ícone.
- Actual: a preferência aparece ativa, mas o botão de minimizar mantém o aplicativo na barra de tarefas e o host pode continuar tratando o fechamento como saída.
- Error messages: nenhum erro visível.
- Timeline: regressão observada no instalador staging 0.0.1 após restaurar preferências persistidas.
- Reproduction: abrir o aplicativo com a preferência de bandeja já ativa e clicar em minimizar.

## Current Focus

- hypothesis: confirmada — a preferência restaurada existia apenas no React, o primeiro comando era descartado antes do bridge iniciar e o host ignorava a minimização.
- test: contratos para sincronização inicial, fila de comandos antes do bridge estar pronto e ocultação em `WindowEvent::Resized` quando a janela estiver minimizada.
- expecting: confirmado — os três testes falharam antes da correção e passaram depois da ligação completa.
- next_action: resolvido; validar minimizar, fechar e restaurar no instalador 0.0.1 de 2026-08-06.
- reasoning_checkpoint: o código confirma `WindowLifecycle::default()` com bandeja falsa, efeito de envio apenas dentro de `dispatch`, e handler nativo limitado a `CloseRequested`.
- tdd_checkpoint: GREEN — 120 testes desktop e 69 testes Rust passaram.

## Evidence

- timestamp: 2026-08-06T00:00:00-03:00
  observation: `DesktopPreferencesProvider` restaura `trayEnabled`, mas não envia comando no mount.
  implication: interface e host ficam com valores diferentes até o usuário alternar a opção.
- timestamp: 2026-08-06T00:00:00-03:00
  observation: `NativeDesktopApp.sendHostCommand` descarta silenciosamente comandos enquanto `bridgeRef.current` é nulo.
  implication: um sync inicial disparado por efeito também seria perdido sem uma fila até o bridge iniciar.
- timestamp: 2026-08-06T00:00:00-03:00
  observation: `on_window_event` retorna para qualquer evento que não seja `CloseRequested`.
  implication: minimizar nunca pode ocultar a janela na bandeja.
- timestamp: 2026-08-06T05:39:00-03:00
  observation: o novo NSIS foi gerado após 120 testes desktop, 69 testes Rust, TypeScript, Cargo fmt e build release.
  implication: a correção está empacotada para o reteste humano no Windows.

## Eliminated

- hypothesis: o ícone da bandeja não existe.
  reason: `ensure_native_tray` e a restauração por duplo clique já existem e foram validados anteriormente.

## Resolution

- root_cause: a preferência persistida não era sincronizada no mount; o bridge descartava comandos antes de iniciar; e `on_window_event` só tratava fechamento, nunca minimização.
- fix: sincronização inicial de locale/bandeja, relay limitado de comandos até o bridge ficar pronto e ocultação nativa ao receber `Resized` com janela minimizada e bandeja ativa.
- verification: testes RED/GREEN direcionados, suíte desktop 120/120, Rust 69/69 e bundle NSIS concluído.
- files_changed: `apps/desktop/src/preferences.tsx`, `apps/desktop/src/app.tsx`, `apps/desktop/src-tauri/src/window.rs`, `apps/desktop/src-tauri/src/main.rs` e testes correspondentes.
