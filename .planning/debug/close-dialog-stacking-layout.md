---
status: resolved
trigger: 'Ao clicar para fechar, a confirmação aparece quebrada: a imagem do jogo atravessa o modal e os botões ficam espremidos/desalinhados.'
created: 2026-07-29
updated: 2026-07-29
---

# Debug: confirmação de fechamento atravessada pelo conteúdo

## Symptoms

- Expected: a confirmação de fechamento deve ficar centralizada, acima de toda a interface, com fundo bloqueado e ações organizadas.
- Actual: a capa de Counter-Strike aparece sobre o diálogo; o botão primário fica na mesma linha da descrição e o secundário fica isolado abaixo.
- Error messages: nenhum erro visível.
- Timeline: observado no instalador atual após as correções dos controles nativos.
- Reproduction: abrir a Visão geral e clicar no botão nativo de fechar a janela.

## Current Focus

- hypothesis: confirmada — faltavam isolamento/camada no overlay e rodapé de ações; além disso, o host enviava uma confirmação ordinária enquanto escondia a janela no tray, deixando o modal pendente até o duplo clique de restauração.
- test: contratos de CSS/componente, testes nativos do ciclo close/tray e inspeção visual em 1280×800 e 520×520.
- expecting: confirmado — overlay em camada 80, ações sem overflow, fechar para tray sem evento pendente e comando de saída aguardando decisão do renderer.
- next_action: resolvido; reconstruir o instalador e validar o pacote instalado.
- reasoning_checkpoint: o duplo clique não criava o modal; ele apenas revelava um `closeContext` ordinário que havia sido armazenado quando a janela foi escondida.
- tdd_checkpoint: GREEN — os testes falharam antes pela ausência do componente/camada e pelo `TrayEffect::ExitInterface`; passaram após a correção.

## Evidence

- timestamp: 2026-07-29
  observation: o print mostra somente a capa do jogo atravessando o diálogo, exatamente o descendente posicionado com `z-index`.
  implication: o overlay não isola a ordem de pintura acima dos descendentes posicionados da página.
- timestamp: 2026-07-29
  observation: `LbAlertDialog` renderiza `Heading`, `Text` e os dois botões como irmãos sem contêiner de ações.
  implication: a descrição e o primeiro botão participam do fluxo inline, causando o layout espremido.
- timestamp: 2026-07-29
  observation: `WindowLifecycle::begin_close` criava `desktop.shell.close-requested.event` até quando a ação era `HideToTray`, e o renderer preservava `closeContext` enquanto a janela estava escondida.
  implication: o duplo clique somente restaurava a janela e revelava a confirmação antiga.
- timestamp: 2026-07-29
  observation: `TrayAction::ExitInterface` emitia o pedido de confirmação e executava `app.exit(0)` na mesma sequência.
  implication: a confirmação real não tinha chance de receber uma escolha.

## Eliminated

- hypothesis: a capa do jogo está usando `position: fixed`.
  reason: `.premium-game-visual > img` usa `position: relative`; o problema é a ausência de uma camada do overlay.
- hypothesis: o duplo clique do tray é mapeado diretamente para “Encerrar interface”.
  reason: o handler do duplo clique chama somente `focus_main_window`; o modal era um estado pendente criado no fechamento anterior.

## Resolution

- root_cause: overlay sem stacking context, ações sem footer e evento ordinário de fechamento emitido simultaneamente ao hide/exit nativo.
- fix: escala semântica de camadas e footer responsivo; fechamento automático não emite diálogo pendente; saída pelo menu do tray foca a janela e aguarda confirmação.
- verification: 12/12 design-system, 7/7 design-tokens, 79/79 desktop, 27/27 Playwright e 24/24 Rust; inspeção visual sem sobreposição ou overflow.
- files_changed: `packages/design-tokens/src/tokens.css`, `packages/design-system/src/primitives.tsx`, `apps/desktop/src/app.tsx`, `apps/desktop/src-tauri/src/{main,tray,window}.rs` e testes correspondentes.
