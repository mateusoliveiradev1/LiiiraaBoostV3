---
quick_id: 260808-sbv
mode: quick-full
status: complete
date: 2026-08-08
must_haves:
  truths:
    - Todas as rotas autenticadas deixam de renderizar pilhas de texto cru e passam a ter hierarquia, estados e ações claras.
    - A composição usa somente dados admitidos pela autoridade real da conta.
    - O shell permanece utilizável em desktop, tablet, celular, zoom e movimento reduzido.
  artifacts:
    - apps/account/src/features/account-authority.tsx
    - apps/account/src/account-navigation.tsx
    - apps/account/src/app/account-shell.css
    - apps/account/src/features/account-authority.test.tsx
  key_links:
    - AccountAuthorityPage continua recebendo AccountAuthorityProjection do adaptador real.
    - AccountAuthorityInspector deriva plano, dispositivo e segurança da mesma projeção.
    - A navegação preserva rotas canônicas, locale e isolamento entre origens.
---

# Quick Task 260808-sbv: recuperação visual do portal autenticado

## Task 1 — Recuperar o shell e a hierarquia compartilhada ✅

**Files:** `apps/account/src/account-navigation.tsx`, `apps/account/src/features/account-auth.tsx`, `apps/account/src/app/account-shell.css`

**Action:** Compactar o handoff administrativo, reequilibrar navegação/workspace/resumo contextual e criar cabeçalho/status compartilhados sem alterar auth ou rotas.

**Verify:** Shell mantém landmarks, foco, labels, links canônicos e breakpoints sem overflow de página.

**Done:** Área principal domina visualmente, o painel direito vira resumo compacto e o banner administrativo não compete com a página.

## Task 2 — Compor as seis rotas com dados reais ✅

**Files:** `apps/account/src/features/account-authority.tsx`, `apps/account/src/features/account-subscription-authority.tsx`, `apps/account/src/app/account-shell.css`

**Action:** Construir overview, dispositivo, downloads, assinatura, segurança e suporte com cartões de trabalho, estados traduzidos, iconografia, ações coerentes e conteúdo da projeção real.

**Verify:** Testes de autoridade confirmam dados reais e ausência de valores crus/fixtures; TypeScript e lint passam.

**Done:** Nenhuma rota mostrada nas capturas permanece como texto solto ou região visualmente vazia.

## Task 3 — Cobrir regressões e validar a experiência ✅

**Files:** `apps/account/src/features/account-authority.test.tsx`, `apps/account/src/account-shell.test.ts`, testes Playwright relevantes do portal.

**Action:** Adicionar expectativas estruturais, executar testes/build e fazer inspeção visual responsiva do staging/local sem expor segredos.

**Verify:** Unitários, TypeScript, lint, build e smoke visual aprovados; estados de loading/erro preservados.

**Done:** A implementação satisfaz o addendum do `04-UI-SPEC.md` e está pronta para deploy da fase 4.
