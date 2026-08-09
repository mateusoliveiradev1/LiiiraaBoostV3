---
status: resolved
trigger: 'Perfil autenticado ainda está abaixo do nível visual das outras rotas e salvar a edição do nome retorna erro no staging real.'
created: 2026-08-08
updated: 2026-08-08
---

# Debug Session: account-profile-edit-error

## Symptoms

- Expected: a rota Perfil deve ter a mesma qualidade visual das demais rotas e salvar um novo nome de exibição na autoridade real, exibindo confirmação persistida.
- Actual: o perfil ainda parece uma ficha simples e a tentativa de editar/salvar retorna erro.
- Errors: a mensagem exata não aparece na captura; a interface entra no estado genérico de erro da mutação.
- Timeline: observado imediatamente após o redesign autenticado publicado no staging em 2026-08-08.
- Reproduction: entrar no Account real, abrir Perfil, clicar em Editar perfil, alterar o nome e salvar.

## Current Focus

- hypothesis: confirmed and fixed.
- test: regressions now cover the browser version header at the client, API, wide E2E, and compact E2E boundaries.
- expecting: the deployed account mutation reaches Fastify instead of being rejected by the edge.
- next_action: publish staging and verify the deployed revisions.
- reasoning_checkpoint: root cause confirmed by real Vercel request logs.
- tdd_checkpoint: red tests observed before implementation; all affected suites now pass.

## Evidence

- A fronteira Vercel -> API aceita o `Origin` e o token CSRF: um PATCH anônimo com token válido chegou à autenticação e retornou 401, não 403.
- Os logs reais da Vercel registraram o PATCH do usuário em `/v1/account` com HTTP 412, enquanto a rota Fastify não possui nenhuma resposta 412.
- O cliente envia o header HTTP padrão `If-Match` através de uma rewrite externa. A Vercel aplica a precondição na camada de edge/cache antes de encaminhar a mutação à API.

## Eliminated

- CSRF ausente ou `Origin` incorreto no rewrite.
- Sessão expirada: leituras GET adjacentes da mesma conta continuaram retornando 200.

## Resolution

- root_cause: the account client sent the standard `If-Match` header through an external Vercel rewrite. Vercel treated it as an edge/cache precondition and returned HTTP 412 before Fastify received the profile mutation.
- fix: the browser client now sends `x-liiiraa-expected-version`; the API accepts the application header while preserving compatible `If-Match` support for native bearer clients and rejects ambiguous mismatches. The profile route was redesigned with a live identity preview, aligned validation, cancel/retry states, protected failure copy, and an authoritative account record.
- verification: 108 account tests, 220 API tests, focused ESLint, account TypeScript/build, wide Playwright profile mutation, compact Playwright validation/reflow, and a local browser load/error-overlay check all pass.
- files_changed: `apps/account/src/account-authority.ts`, `apps/account/src/features/account-authority.tsx`, `apps/account/src/app/account-shell.css`, their tests, `apps/api/src/modules/identity/real-routes.ts`, `apps/api/src/staging/real-auth.test.ts`, and `tooling/web-evidence/tests/account-authority.spec.ts`.
