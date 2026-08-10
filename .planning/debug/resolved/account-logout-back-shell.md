---
status: resolved
trigger: 'apertei no botao voltar mais parece meio estranho nao sei'
created: 2026-08-10T10:52:59-03:00
updated: 2026-08-10T10:58:42-03:00
---

## Symptoms

- expected: Depois do logout, voltar no histórico não deve reconstruir o shell autenticado; a pessoa deve permanecer em uma experiência clara de entrada.
- actual: O histórico volta para `/account/profile` e renderiza sidebar, cabeçalho, avatar e botão Sair com placeholders de sessão necessária.
- errors: Nenhum erro visível; a autoridade privada permanece bloqueada.
- timeline: Observado durante o UAT real de logout da Fase 4 em 2026-08-10.
- reproduction: Entrar na conta web, sair, pressionar o botão Voltar do navegador.

## Current Focus

- hypothesis: Confirmed. O logout revogava o cookie, mas não publicava imediatamente a indisponibilidade no singleton de autoridade; o shell decidia sua composição apenas pela rota.
- test: Testes RED de snapshot de logout e shell restaurado pelo histórico, seguidos pelo gate completo `@liiiraa/account verify`.
- expecting: O logout publica `unauthorized`, a navegação troca imediatamente para o auth shell e substitui a rota protegida pela entrada.
- next_action: Publicar no staging e repetir o logout seguido pelo botão Voltar.

## Evidence

- timestamp: 2026-08-10T10:52:59-03:00
  checked: Captura do proprietário após logout e retorno pelo histórico.
  found: Nenhum dado privado reapareceu, mas o chrome autenticado continuou visível com identidade e ações substitutas.
  implication: A revogação funciona; a falha está na composição visual e navegação do estado sem sessão.

- timestamp: 2026-08-10T10:58:42-03:00
  checked: `LiveAccountAuthority`, `SignInForm`, `AccountNavigation` e layout de Account.
  found: O logout não invalidava o snapshot compartilhado e `AccountNavigation` selecionava o shell apenas pela identidade da rota.
  implication: Uma rota protegida restaurada pelo histórico podia exibir chrome autenticado com placeholders até a próxima leitura negar a sessão.

- timestamp: 2026-08-10T10:58:42-03:00
  checked: `pnpm --filter @liiiraa/account verify`.
  found: TypeScript, 111 testes e o build de produção Next.js passaram.
  implication: A transição imediata e o auth shell protegido estão cobertos antes da publicação.

## Eliminated

## Resolution

- root_cause: A revogação HTTP não atualizava o singleton de autoridade e o shell autenticado era escolhido somente pela rota atual.
- fix: Publicar um snapshot `unauthorized` no sucesso do logout, consumir esse snapshot na navegação, renderizar o auth shell e substituir a rota protegida pela entrada.
- verification: Dois testes RED reproduziram o problema; depois da correção, 111 testes, TypeScript e build Next.js passaram.
- files_changed:
  - apps/account/src/live-account-authority.ts
  - apps/account/src/live-account-authority.test.ts
  - apps/account/src/features/account-auth.tsx
  - apps/account/src/account-navigation.tsx
  - apps/account/src/account-shell.test.ts
  - apps/account/src/app/[locale]/layout.tsx
