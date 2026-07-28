---
phase: 02-complete-desktop-experience
plan: "36"
subsystem: desktop-ui
tags: [react, playwright, accessibility, localization, visual-regression]
requires: [02-35]
provides:
  - 58 rotas canônicas navegáveis e sem vazamentos conhecidos de copy inglesa em PT-BR
  - interações observáveis para navegação, central de comandos e calibração
  - baselines visuais inspecionadas para os cinco eixos canônicos
affects: [02-26, 02-27, 02-28, 02-29, 02-30]
tech-stack:
  added: []
  patterns:
    - localização propagada até os componentes de evidência
    - testes de interação no navegador sobre a composição real
key-files:
  created: []
  modified:
    - apps/desktop/tests/browser/routes.spec.ts
    - apps/desktop/tests/browser/__screenshots__/visual.spec.ts
    - apps/desktop/src/app.tsx
    - packages/design-system/src
    - packages/feature-shell/src/features
key-decisions:
  - Baselines só foram substituídas após inspeção individual das cinco imagens atuais.
  - Rótulos de estado são localizados no componente compartilhado, sem duplicar a verdade operacional.
requirements-completed: [UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12]
completed: 2026-07-28
---

# Plano 02-36 — rotas, interações e baselines visuais

## Resultado

- As 58 rotas canônicas renderizam pela composição real do desktop e a
  verificação PT-BR não encontrou nenhuma das copies inglesas proibidas.
- A navegação principal atualiza rota e seleção ativa de forma observável.
- A central de comandos abre com foco real no campo de busca e fecha pelo
  teclado.
- A calibração deixa o estado inicial quando a ação principal é acionada,
  mesmo quando a rota começou com um cenário visual determinístico.
- Marcadores de procedência, qualidade, validade e estado operacional recebem o
  idioma da superfície consumidora.
- Reinicialização, medição e recuperação tiveram os últimos rótulos e registros
  visíveis localizados.
- O registro de alterações agora localiza legenda, colunas e resultados.
- As superfícies continuam declarando dados simulados e não alegam medições ou
  efeitos reais sobre o PC.

## Revisão visual

As cinco imagens foram inspecionadas antes da substituição das baselines:

- 1440 × 900, PT-BR, escala 100%.
- 1280 × 800, inglês, escala 125% e movimento reduzido.
- 960 × 700, pseudo-localização.
- 760 × 600, PT-BR, escala do app 150% e texto 200%.
- 760 × 600, inglês, escala 150%, movimento reduzido e cores forçadas.

Não foi observado overflow horizontal, clipping de controles ou dependência
exclusiva de cor. Em larguras mínimas, o conteúdo cresce verticalmente e
permanece navegável.

## Verificação

- Typecheck de design system, feature shell e desktop: aprovado.
- Design system: 11 testes aprovados.
- Feature shell: 88 testes aprovados.
- Desktop unitário: 66 testes aprovados.
- Chromium completo: 14 testes aprovados.
- Axe: 59 pares rota/estado sem achados sérios ou críticos.
- Navegação, teclado, cenários S01–S24 e decisões D-01–D-20: aprovados.
- As cinco comparações visuais passaram novamente sem modo de atualização.

## Commits

- `86f4e84` — rotas localizadas e operáveis.
- `4ad0de8` — baselines visuais inspecionadas e aprovadas.

## Deviations from Plan

Foi necessário ampliar `MetricReadout` para propagar o idioma também aos
marcadores internos e aos rótulos de fonte/amostra. A ausência dessa propagação
foi detectada pela nova varredura das 58 rotas e corrigida antes da atualização
visual.

## Limites preservados

- Nenhum serviço, biblioteca ou recurso pago foi introduzido.
- Nenhum dado real do hardware é fabricado.
- A autoridade privilegiada permanece fora da Fase 2.
- O instalador não foi reconstruído durante a aprovação das baselines.

## Self-Check: PASSED

