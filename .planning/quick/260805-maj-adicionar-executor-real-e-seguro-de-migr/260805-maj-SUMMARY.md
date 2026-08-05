---
phase: quick-260805-maj
plan: "01"
subsystem: staging-database
tags: [neon, postgres, migrations, github-actions, fail-closed]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: reviewed control-plane migration and immutable staging workflow
provides:
  - real idempotent staging migration command
  - fail-closed Neon staging database admission
  - migration-before-promotion GitHub Actions ordering
affects: [phase-04-staging-uat, render-api, neon-staging]
tech-stack:
  added: []
  patterns: [advisory-locked migration, checksum admission, bounded deployment output]
key-files:
  created:
    - packages/control-plane-adapters/src/postgres/staging-migration.ts
    - packages/control-plane-adapters/src/postgres/staging-migration.test.ts
  modified:
    - apps/api/package.json
    - apps/api/src/staging/container-contract.test.ts
    - .github/workflows/phase-4-staging-api.yml
key-decisions:
  - "A staging promotion must execute the reviewed migration, not merely its test suite."
  - "Migration URLs must be Neon, require TLS, identify staging or synthetic data, and reject production authority markers."
  - "Migration output is limited to version, hash, applied state, and table count; connection data is never logged."
patterns-established:
  - "Database application precedes Render digest promotion and always closes the pool."
requirements-completed: []
duration: 9min
completed: 2026-08-05
status: complete
---

# Quick 260805-maj: Executor real de migrations do Neon staging

O workflow de staging agora aplica a migration revisada e idempotente antes de promover a imagem no Render. O comando recusa conexões sem identidade explícita de staging e nunca imprime a URL do banco.

## Accomplishments

- Criado `runStagingMigration`, reutilizando o runner com advisory lock, transação serializable e checksum já implementado.
- Adicionada admissão fail-closed para URL Neon PostgreSQL, `sslmode=require`, identidade `staging`/`synthetic` e ausência de marcadores de produção.
- Garantido fechamento do pool em sucesso e falha.
- Adicionados scripts `db:migrate` e `db:migrate:test` à API.
- Corrigido o job de deploy para executar `db:migrate` antes do PATCH do digest no Render.
- Reforçado o teste do artefato para distinguir aplicação real de `db:migrate:test`.

## Verification

- Migrations/runner: 13 testes aprovados e 3 integrações live corretamente ignoradas sem URL explícita.
- Contrato do container/workflow: 5 testes aprovados.
- TypeScript da API: aprovado.
- ESLint do contrato do workflow: aprovado.
- Prettier e `git diff --check`: aprovados.
- Execução sem `STAGING_DATABASE_URL`: recusada com apenas `STAGING_MIGRATION_FAILED`, sem conexão ou vazamento.
- Nenhum Docker local foi iniciado ou consultado.

## Commit

- `5cc6bb5` — `fix(staging): apply Neon migrations before deploy [skip ci]`

## Deferred operational action

O projeto Neon existe, mas o SQL real ainda não foi executado. É necessária aprovação explícita para criar o banco `liiiraa_staging` e aplicar a migration `0001_control_plane`, que cria o ledger e 17 tabelas com índices, constraints, funções e triggers de auditoria.

