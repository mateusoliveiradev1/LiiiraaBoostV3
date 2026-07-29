---
status: resolved
trigger: "Download concluído aparece como 'Pronto 100%' com botão 'Preparar novamente'; desinstalador usa 'Revisar desinstalação' sem explicar ou executar uma confirmação real."
created: 2026-07-29
updated: 2026-07-29
---

# Debug: estados finais de download e desinstalação

## Symptoms

- Expected: download concluído deve oferecer instalação; seleção no desinstalador deve levar a uma confirmação clara e funcional.
- Actual: download concluído oferece “Preparar novamente”; desinstalador apenas mostra “Revisar desinstalação” e um toast dizendo que o item foi preparado.
- Error messages: nenhum erro técnico visível.
- Timeline: observado no instalador atual da Fase 2.
- Reproduction: concluir um download simulado; selecionar um aplicativo removível e clicar na ação principal do desinstalador.

## Current Focus

- hypothesis: confirmada — os componentes modelavam apenas progresso/conclusão superficial e não possuíam estados explícitos para “pronto para instalar” nem para confirmação/resultado da desinstalação.
- test: contratos Playwright cobrem download → instalação, revisão/cancelamento/confirmação da remoção, seleção em massa, proteção de componentes e PT-BR/inglês.
- expecting: atendido — retry aparece somente em erro; conclusão oferece instalação; desinstalador exige confirmação antes do resultado simulado.
- next_action: nenhuma; correção verificada e instalador regenerado.
- reasoning_checkpoint: a simulação continua segura, mas agora representa fielmente os estados e decisões do produto final.
- tdd_checkpoint: GREEN — 4 testes específicos e 31 testes Playwright completos passaram.

## Evidence

- timestamp: 2026-07-29
  observation: o card de Brave mostra simultaneamente “Pronto”, “100%” e “Preparar novamente”.
  implication: ação e estado contradizem um ao outro.
- timestamp: 2026-07-29
  observation: o botão do desinstalador dispara apenas um toast “item preparado para revisão”.
  implication: a revisão anunciada não existe como superfície funcional.
- timestamp: 2026-07-29
  observation: seleção em massa marca os 6 aplicativos removíveis e mantém AMD Chipset e WebView2 protegidos.
  implication: remoção em lote é possível sem incluir componentes críticos.
- timestamp: 2026-07-29
  observation: validação visual em 1280×800 e 760×600 não apresentou overflow horizontal.
  implication: os novos estados e o modal permanecem utilizáveis na janela compacta.

## Eliminated

## Resolution

- root_cause: o estado `complete` do download apontava de volta para a preparação e a ação do desinstalador não possuía estado, diálogo ou execução associados.
- fix: máquina de estados de download ampliada até `installed`; diálogo funcional de desinstalação com resumo, espaço estimado, aviso, fechamento externo/Escape, confirmação simulada e seleção de todos os itens removíveis.
- verification: TypeScript; ESLint dos arquivos alterados; 79 testes unitários; 31 testes Playwright; 35 testes Rust; detector Impeccable sem achados; build Tauri/NSIS concluído.
- files_changed: `premium-downloads.tsx`, `premium-operations.tsx`, `premium-operations.css`, novo spec Playwright e inclusão do spec na configuração ESLint.
