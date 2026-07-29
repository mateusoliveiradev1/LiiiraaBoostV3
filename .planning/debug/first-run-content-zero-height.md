---
status: resolved
trigger: 'agora nao abriu mais kk'
created: 2026-07-29
updated: 2026-07-29
---

# Debug: conteúdo da primeira abertura com altura zero

## Symptoms

- Expected: a primeira abertura mostra barra da janela e conteúdo completo do onboarding.
- Actual: somente a barra da janela aparece; toda a área abaixo fica vazia.
- Error messages: nenhum erro visível.
- Timeline: começou no instalador gerado após o commit `1acbaa9`.
- Reproduction: instalar/abrir a nova build e aguardar a primeira tela.

## Current Focus

- hypothesis: confirmada — a regra global `.desktop-app-shell:not([data-route-path='/home'])` vencia a regra do shell de primeira abertura e colocava seus dois filhos em linhas de grid com altura zero.
- test: estrutura real montada com as folhas CSS na ordem de produção e geometria medida em três viewports.
- expecting: confirmado — o teste recebeu `0 px` antes da correção e mais de `viewport - 80 px` depois.
- next_action: resolvido; reconstruir o instalador.
- reasoning_checkpoint: a captura mostra a titlebar renderizada e o fundo do shell, descartando falha de carregamento do WebView.
- tdd_checkpoint: GREEN — regressão falhou com altura `0 px` e passou após a correção de especificidade.

## Evidence

- timestamp: 2026-07-29T18:45:00-03:00
  observation: titlebar está visível, mas nenhum elemento do onboarding aparece.
  implication: React e CSS base carregaram; o defeito está na geometria do conteúdo recém-encapsulado.

## Eliminated

- hypothesis: o aplicativo ou WebView não iniciou.
  reason: logotipo e controles nativos personalizados estão renderizados e responsivos.

## Resolution

- root_cause: `premium-operations.css`, carregado depois, aplicava quatro linhas ao shell de primeira abertura; titlebar e conteúdo caíam nas duas linhas intermediárias de altura zero.
- fix: o shell recebeu a rota semântica `/first-run` e uma regra com especificidade suficiente para preservar `52px minmax(0, 1fr)`.
- verification: 27/27 testes E2E, 78/78 unitários, TypeScript, lint direcionado e teste responsivo em 1280×800, 960×700 e 760×600.
- files_changed: `premium-installer-handoff.tsx`, `premium-experience.css`, `first-run-responsive.spec.ts`.
