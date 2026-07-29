---
status: resolved
trigger: "mais ai quebrou hue tem q poder redimencionar a tela ainda"
created: 2026-07-29
updated: 2026-07-29
---

# Debug: redimensionamento da janela e primeira abertura cortada

## Symptoms

- Expected: a tela inicial acompanha o redimensionamento da janela sem cortar conteúdo.
- Actual: a janela redimensiona, mas somente a tela inicial de instalação verificada mantém a composição larga e corta a coluna direita.
- Error messages: nenhum erro visível.
- Timeline: regressão introduzida no commit `0daa92f`, junto da titlebar customizada.
- Reproduction: abrir a primeira tela após instalar e reduzir a largura da janela.
- Additional evidence: na primeira abertura, conteúdo e ações da coluna direita ficam cortados em escala/DPI alta.
- Additional evidence: o seletor de jogos abre o popup nativo claro com texto quase branco no tema escuro.

## Current Focus

- hypothesis: confirmada — telas iniciais usavam caixas `content-box`, e o handoff nativo não montava a barra de janela.
- test: regressões de overflow em 1280×800, 960×700 e 760×600, controles da janela e temas do seletor.
- expecting: confirmado — as regressões falharam antes e passaram após a correção.
- next_action: resolvido; gerar e validar o novo instalador.
- reasoning_checkpoint: o segundo print confirma que as rotas normais respondem corretamente; a regressão é isolada na primeira abertura.
- tdd_checkpoint: GREEN confirmado — 20 testes de startup e 27 testes E2E passaram.

## Evidence

- timestamp: 2026-07-29T18:23:00-03:00
  observation: a rota normal aparece corretamente após a janela ser redimensionada.
  implication: não é necessário alterar o shell nem as áreas de resize; o reparo deve ser local à primeira abertura.
- timestamp: 2026-07-29T18:26:00-03:00
  observation: teste reproduziu `checkpointRight=1392` para `rootRight=1264`.
  implication: `inline-size` somada ao padding em content-box causa exatamente o corte observado.
- timestamp: 2026-07-29T18:26:00-03:00
  observation: seletor falhou a expectativa de `color-scheme: dark`.
  implication: o popup nativo escolhe fundo claro sem coordenar a cor herdada do app.

## Eliminated

- hypothesis: a falha afeta o layout global do aplicativo.
  reason: o usuário confirmou e demonstrou que as rotas normais respondem corretamente.

## Resolution

- root_cause: `inline-size` somada ao padding em `content-box` fazia onboarding e login excederem a viewport; a primeira verificação também era renderizada fora do shell com `WindowTitleBar`; o seletor nativo não recebia `color-scheme`.
- fix: caixas iniciais passaram a `border-box`, o overflow ficou somente vertical, ações empilham em largura reduzida, a primeira verificação passou a incluir a barra completa da janela e o seletor recebeu cores explícitas nos temas escuro e claro.
- verification: TypeScript passou; testes unitários de startup 20/20; Playwright completo 27/27, incluindo axe, teclado, clipping, escalas 100–150% e viewports de 760 a 1440 px.
- files_changed: `app.tsx`, `premium-installer-handoff.tsx`, `premium-experience.css`, temas do seletor e testes de regressão.
