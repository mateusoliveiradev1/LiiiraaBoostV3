---
status: resolved
trigger: "Ao voltar da área autenticada para o site público, o cabeçalho volta a mostrar Entrar/Criar conta; depois de configurar o autenticador, a área da conta ainda mostra MFA não configurada."
created: 2026-08-08
updated: 2026-08-08
resolved: 2026-08-08
---

# Symptoms

- Expected: voltar ao site público não deve fazer uma sessão válida parecer perdida, e a área da conta deve refletir o TOTP confirmado.
- Actual: o site público mostrava Entrar/Criar conta mesmo com sessão válida no Account; o Account mostrava MFA não configurada depois da configuração pelo autenticador.
- Errors: nenhum erro explícito nas telas.
- Reproduction: entrar no Account, configurar o autenticador, voltar ao site público e consultar o resumo de segurança no Account.

# Root cause

1. A sessão do Account usa o cookie host-only `__Host-liiiraa_session`. Isso preserva o isolamento entre as origens pública, Account e Admin, mas impede o site público de ler a sessão diretamente. O cabeçalho público era estático e sempre exibia Entrar/Criar conta, criando a falsa impressão de logout.
2. O TOTP confirmado era persistido corretamente em `security_factors`, porém `/v1/account` projetava `securityMethods` como uma lista vazia fixa. A interface só podia mostrar MFA não configurada.

# Fix

- O cabeçalho público agora apresenta um destino neutro e permanente, Minha conta/My account, para a rota protegida canônica do Account. Uma sessão válida entra direto; uma sessão expirada segue para autenticação.
- A autoridade de strong auth passou a consultar o fator TOTP confirmado e `/v1/account` agora projeta esse método persistido.
- GET e PATCH da conta usam a mesma projeção autoritativa.
- O smoke test do staging passou a exigir o novo handoff Minha conta e rejeitar os antigos links estáticos de login/cadastro no cabeçalho.

# Verification

- Regressões TDD reproduziram os dois defeitos antes da correção.
- Web: 129 testes aprovados, TypeScript aprovado e build Next.js aprovado.
- API: 219 testes aprovados e TypeScript aprovado.
- ESLint e verificação de formatação aprovados nos arquivos alterados.
- Deploy das superfícies da Fase 4: GitHub Actions `31283430666` concluído com sucesso, incluindo probes reais de isolamento de origem, sessão e consentimento.
- Deploy protegido da API: GitHub Actions `31283209451` concluído com sucesso, incluindo migrações, imagem imutável, SBOM, scan, deploy no Render e health/readiness.
- Readiness vivo respondeu HTTP 200 com build `96410d09a6dc1f80eeb7bb46041b69b14e56e07e` e capacidade `totp-strong-auth`.
- Site público vivo respondeu HTTP 200 e contém Minha conta.

# Files changed

- `apps/web/src/public-navigation.tsx`
- `apps/web/src/app/[locale]/layout.tsx`
- `apps/web/src/public-boundary.ts`
- `apps/web/src/public-shell.test.ts`
- `apps/api/src/modules/identity/real-routes.ts`
- `apps/api/src/staging/strong-auth.ts`
- `apps/api/src/staging/runtime.ts`
- `apps/api/src/staging/real-auth.test.ts`
- `tooling/web-evidence/tests/security-artifacts.spec.ts`
