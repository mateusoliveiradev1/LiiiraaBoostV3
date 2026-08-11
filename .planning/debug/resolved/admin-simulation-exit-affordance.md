---
status: resolved
trigger: 'controle Sair da simulação parece texto solto e não um botão'
created: 2026-08-11T05:12:35.393Z
updated: 2026-08-11T05:16:06.234Z
---

## Symptoms

- expected: A saída da simulação deve ser reconhecível imediatamente como uma ação clicável.
- actual: `Sair da simulação` é renderizado como controle `quiet`, quebra para a linha seguinte e parece texto solto.
- errors: Não há erro técnico; a falha é de affordance, hierarquia e alinhamento responsivo.
- timeline: Observado no reteste publicado do Admin em 2026-08-11.
- reproduction: Em Pessoas, abrir um membro, simular outra função e observar a faixa amarela no inspetor.

## Current Focus

- hypothesis: Confirmada. O variante `quiet` remove a aparência de botão e o flex wrapping deixa a ação isolada à esquerda.
- test: Exigir variante secundário, ícone explícito de saída e agrupamento dedicado da mensagem da simulação.
- expecting: Um botão contornado e estável deve aparecer à direita da faixa, com adaptação clara em larguras menores.
- next_action: Publicar e solicitar o reteste humano no Admin staging.

## Evidence

- timestamp: 2026-08-11T05:12:35.393Z
  checked: Captura do proprietário e implementação de `MemberInspector`.
  found: A ação segura existe e limpa apenas `simulatedFunction`, mas usa `variant="quiet"`; o banner mistura mensagem, função e ação no mesmo flex com quebra.
  implication: A segurança do fluxo está preservada, porém o operador não consegue reconhecer a saída como botão.
- timestamp: 2026-08-11T05:16:06.234Z
  checked: Teste focado, validação completa do Admin, ESLint, Prettier e diff check.
  found: O botão secundário com ícone passou; 15 arquivos e 181 testes, TypeScript e o build Next.js 16.3 passaram.
  implication: A correção está pronta para publicação e confirmação visual do proprietário.

## Eliminated

- Ausência funcional da ação: o callback `exit-simulation` já existe e não altera a função administrativa real.

## Resolution

- root_cause: O variante `quiet` removia a affordance de botão e o flex compartilhado deixava a ação quebrar como texto solto.
- fix: Agrupar a mensagem, usar grid para separar conteúdo e ação, renderizar um botão secundário contornado com ícone e fazê-lo ocupar a largura disponível em telas estreitas.
- verification: Teste RED reproduziu o contrato visual ausente; depois da correção, 181/181 testes, TypeScript, ESLint, Prettier e build de produção passaram.
- files_changed: apps/admin/src/admin-governance-ui.test.ts, apps/admin/src/features/admin-access-governance.tsx, apps/admin/src/features/admin-access-governance.module.css
