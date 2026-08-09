---
status: diagnosed
trigger: 'preciso apertar duas vezes em sair no app mais dps q sai e pass'
created: 2026-08-09T14:05:00-03:00
updated: 2026-08-09T14:05:00-03:00
---

## Symptoms

- expected: Um clique em Sair revoga a sessao, apaga a credencial local e mantem o desktop na tela de login.
- actual: O primeiro clique conclui o logout, mas a UI continua ou retorna para a conta; o segundo clique finalmente deixa o app na tela de entrada.
- reproduction: Entrar no desktop conectado, abrir Conta e pressionar Sair com seguranca uma vez.

## Current Focus

- hypothesis: Confirmed. O snapshot singleton da autoridade permanece online depois do logout nativo, e a guarda de /login redireciona imediatamente para a conta.
- test: Revisao do fluxo desktopAuth.signOut, do evento ACCOUNT_AUTHORITY_REVOKED_EVENT e da guarda resolveDesktopLoginState.
- expecting: Uma transicao local explicita para revoked antes da navegacao impede o redirecionamento de retorno.
- next_action: Planejar e implementar a transicao idempotente com teste de concorrencia.

## Evidence

- timestamp: 2026-08-09T14:05:00-03:00
  checked: apps/desktop/src-tauri/src/identity.rs e o endpoint real de sign-out.
  found: O host aceita 204/401/403 e remove a credencial depois da revogacao; o endpoint real retorna 204.
  implication: O segundo clique nao e causado por contrato HTTP divergente.

- timestamp: 2026-08-09T14:05:00-03:00
  checked: apps/desktop/src/features/account-experience.tsx e apps/desktop/src/account-authority.ts.
  found: O sucesso navega para /login e emite um evento, mas a autoridade continua com projection online; a guarda de login redireciona contas autenticadas para /account/overview.
  implication: A credencial saiu, mas o estado em memoria contradiz o logout ate a proxima sincronizacao.

## Diagnosis

- root_cause: A autoridade de conta nao possui uma transicao de logout confirmado; o evento atual limpa apenas dados de chrome e nao o snapshot que controla a rota.
- suggested_fix: Publicar revoked idempotente na autoridade imediatamente apos o host confirmar signed-out, invalidar sincronizacoes anteriores e entao navegar para login.
- files_involved:
  - apps/desktop/src/account-authority.ts
  - apps/desktop/src/account-authority.test.ts
  - apps/desktop/src/features/account-experience.tsx
  - apps/desktop/src/features/account-experience.test.ts
