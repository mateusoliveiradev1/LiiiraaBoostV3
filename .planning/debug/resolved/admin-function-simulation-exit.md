---
status: resolved
trigger: 'captura da simulação de função sem controle visível para sair'
created: 2026-08-10T15:15:00.000Z
updated: 2026-08-10T15:16:45.000Z
---

## Symptoms

- expected: A simulação administrativa deve ficar claramente identificada, não alterar a função real e oferecer uma saída explícita no próprio painel.
- actual: A faixa amarela identifica a simulação de `operations` e a função real continua `security`, mas nenhum controle permite sair da simulação.
- errors: Não há erro técnico exibido; a falha é de conclusão do fluxo e clareza de UI/UX.
- timeline: Observado durante o UAT real da Fase 4 em 2026-08-10.
- reproduction: Abrir Pessoas, selecionar um membro, escolher outra função e pressionar `Simular função`.

## Current Focus

- hypothesis: Confirmada. A tradução para sair existia, porém não era renderizada e o estado `simulatedFunction` não possuía uma ação de limpeza.
- test: Um contrato focado exige controle visível, ação tipada e limpeza explícita do estado simulado.
- expecting: O modo simulado deve encerrar no próprio painel sem mutação, recarga ou navegação.
- next_action: retestar o controle publicado no Admin staging.

## Evidence

- timestamp: 2026-08-10T15:15:00.000Z
  checked: Captura do proprietário e implementação de `MemberInspector`.
  found: `simulationExit` já existe em PT-BR e inglês, mas não é usado; a faixa só mostra ícone, mensagem e função simulada.
  implication: A simulação é segura, porém aprisiona visualmente o operador até navegação ou recarga.
- timestamp: 2026-08-10T15:16:45.000Z
  checked: Teste focado, suíte completa do Admin, TypeScript, ESLint, Prettier e build Next.js de produção.
  found: O contrato focado passou; 15 arquivos e 181 testes passaram; o build de produção foi concluído.
  implication: A correção está pronta para publicação e reteste humano no staging.

## Eliminated

- Alteração real de função: a captura mantém `Função ativa` como `security` enquanto a faixa informa `operations` apenas como simulação.

## Resolution

- root_cause: A cópia localizada `simulationExit` ficou órfã: a faixa de simulação não renderizava o controle e a união de ações não possuía uma transição para limpar `simulatedFunction`.
- fix: Adicionar a ação tipada `exit-simulation`, renderizar `Sair da simulação` na faixa, limpar somente o estado local simulado e permitir quebra responsiva da faixa.
- verification: Teste RED reproduziu quatro contratos ausentes; após a correção, teste focado 1/1, Admin 181/181, TypeScript, ESLint, Prettier e build Next.js 16.3.0 passaram.
- files_changed: apps/admin/src/admin-governance-ui.test.ts, apps/admin/src/features/admin-access-governance.tsx, apps/admin/src/features/admin-access-governance.module.css
