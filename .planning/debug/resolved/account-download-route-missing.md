---
status: resolved
trigger: 'A rota de downloads funciona por URL direta, mas desaparece da navegação da área logada depois que o usuário troca de rota.'
created: 2026-08-08
updated: 2026-08-08
---

# Symptoms

- Expected: a área autenticada mantém uma entrada direta e permanente para Downloads.
- Actual: o instalador baixa corretamente pela URL direta, mas o menu lateral não oferece caminho de volta após navegar para outra tela.
- Errors: nenhum erro exibido; era uma lacuna de navegação.
- Timeline: observado imediatamente após a primeira validação humana do download privado do Plano 04-63.
- Reproduction: abrir `/pt-BR/account/downloads`, navegar para outra responsabilidade da conta e procurar Downloads no menu persistente.

# Current Focus

- hypothesis: confirmed
- test: a projeção de objetivos deve manter `account-downloads` como destino principal próprio.
- expecting: Downloads permanece visível no menu desktop e mobile e seleciona sua própria rota.
- next_action: none

# Evidence

- timestamp: 2026-08-08
  observation: `NAVIGATION_GROUPS` continha `account-downloads`, mas `AccountNavigation` renderizava apenas `goalItems` derivados de `getAccountGoalNavigation`.
- timestamp: 2026-08-08
  observation: `accountGoalForRoute('account-downloads')` retornava `account-device`, descartando o link direto da lista agregada.
- timestamp: 2026-08-08
  observation: o teste de regressão falhou antes da correção porque a projeção tinha cinco objetivos e não incluía `account-downloads`.
- timestamp: 2026-08-08
  observation: a verificação completa do Account passou com 106 testes, TypeScript e build Next.js.
- timestamp: 2026-08-08
  observation: o pipeline remoto `31282644644` publicou a revisão `1d6ce175e3a3d4df2e57f0b0a587d17f1454636c` e concluiu todos os probes com sucesso.

# Eliminated

- hypothesis: a rota canônica de Downloads não existe.
  reason: a rota funciona por URL direta e está presente em `projectNavigation('account')`.
- hypothesis: o problema está na autenticação ou na entrega do Blob privado.
  reason: a validação humana confirmou o download correto; somente o caminho persistente de retorno estava ausente.

# Resolution

- root_cause: `account-downloads` era tratado como rota contextual de `account-device`; a navegação persistente projetava apenas os objetivos principais e eliminava Downloads.
- fix: promoveu `account-downloads` a objetivo principal bilíngue nos modelos de preview e produção, preservando seu ícone, href canônico e seleção própria em desktop e mobile.
- verification: teste vermelho/verde, 106 testes do Account, TypeScript, build Next.js, Prettier, diff check e pipeline remoto completo.
- files_changed: apps/account/src/account-preview-model.ts, apps/account/src/account-production-model.ts, apps/account/src/account-shell.test.ts
