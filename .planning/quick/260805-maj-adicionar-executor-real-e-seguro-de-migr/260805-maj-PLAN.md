---
quick_id: 260805-maj
slug: adicionar-executor-real-e-seguro-de-migr
status: planned
mode: quick
phase: quick-260805-maj
plan: "01"
type: execute
wave: 1
depends_on: []
autonomous: true
created: 2026-08-05
files_modified:
  - packages/control-plane-adapters/src/postgres/staging-migration.ts
  - packages/control-plane-adapters/src/postgres/staging-migration.test.ts
  - apps/api/package.json
  - apps/api/src/staging/container-contract.test.ts
  - .github/workflows/phase-4-staging-api.yml
  - .planning/STATE.md
---

# Adicionar executor real e seguro de migrations para o Neon staging

<objective>
Substituir o falso passo de migration do workflow — que apenas executava testes — por um comando real que aplica a migration revisada ao banco Neon explicitamente identificado como staging.

Purpose: garantir que a API nunca seja promovida contra um banco vazio e que uma URL de produção ou sem identidade de staging seja recusada antes de qualquer SQL.
Output: comando de migration executável, validação fail-closed, testes e workflow corrigido.
</objective>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Criar comando fail-closed de migration</name>
  <files>packages/control-plane-adapters/src/postgres/staging-migration.ts, packages/control-plane-adapters/src/postgres/staging-migration.test.ts, apps/api/package.json</files>
  <action>Criar um entrypoint Node/TypeScript que aceite somente `STAGING_DATABASE_URL` PostgreSQL Neon com TLS obrigatório, identidade contendo `staging` ou `synthetic` e sem marcadores de produção. O comando deve reutilizar `createControlPlaneDatabase`, `migrateControlPlane` e `inspectControlPlaneSchema`, fechar o pool em `finally` e emitir apenas metadados não sensíveis. Adicionar `db:migrate` e incluir os testes do comando em `db:migrate:test`. Não executar o comando real nesta tarefa.</action>
  <verify>
    <automated>rtk pnpm --dir packages/control-plane-adapters exec vitest --run src/postgres/staging-migration.test.ts src/postgres/migrations.test.ts</automated>
  </verify>
  <done>URLs inseguras são recusadas; uma URL Neon staging é admitida; aplicação, inspeção e fechamento são cobertos sem conexão externa.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fazer o workflow aplicar migrations reais</name>
  <files>.github/workflows/phase-4-staging-api.yml, apps/api/src/staging/container-contract.test.ts</files>
  <action>Trocar o passo de promoção para executar `pnpm --filter @liiiraa/api db:migrate` depois da instalação verificada. Manter os testes de migration no job de build e reforçar o contrato para impedir que `db:migrate:test` seja confundido com aplicação real. Docker continua restrito ao runner remoto do GitHub Actions.</action>
  <verify>
    <automated>rtk pnpm --filter @liiiraa/api test -- --run container-contract</automated>
  </verify>
  <done>O job de deploy aplica o schema real antes da promoção do digest e o teste falha se voltar a executar somente a suíte de testes.</done>
</task>

</tasks>

<success_criteria>
- Existe um comando `db:migrate` real, idempotente e baseado no runner revisado.
- O comando recusa URL não-Neon, sem TLS, sem identidade staging/synthetic ou com identidade de produção.
- O workflow usa `db:migrate` antes do PATCH no Render.
- Testes focados e formatação passam sem conectar ao Neon nem usar Docker local.
</success_criteria>

<output>
Criar `260805-maj-SUMMARY.md`, atualizar `.planning/STATE.md` e registrar os commits e resultados.
</output>
