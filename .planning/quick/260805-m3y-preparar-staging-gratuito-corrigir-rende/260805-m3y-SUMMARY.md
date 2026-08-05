---
phase: quick-260805-m3y
plan: "01"
subsystem: staging-deployment
tags: [render, github-actions, ghcr, staging, deployment]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: immutable staging API artifact and isolated deployment workflows
provides:
  - Render Free staging manifest bound to the real GHCR repository owner
  - GitHub main branch aligned with the deployment workflows
affects: [phase-04-staging-uat, neon-staging, render-deployment, vercel-surfaces]
tech-stack:
  added: []
  patterns: [immutable image digest, manual staging promotion, CI-only container build]
key-files:
  created: []
  modified:
    - apps/api/staging.render.yaml
    - apps/api/src/staging/container-contract.test.ts
key-decisions:
  - "Use Render plan free for the current staging tests; any paid compute requires fresh explicit approval."
  - "Build OCI images only in GitHub Actions; Docker remains unused locally."
  - "Publish main with CI skipped until Neon, Render, Vercel, and GitHub environment secrets are ready."
patterns-established:
  - "The checked-in Render manifest must name the real GHCR owner and retain digest-only manual deployment."
requirements-completed: []
duration: 8min
completed: 2026-08-05
status: complete
---

# Quick 260805-m3y: Preparação do staging gratuito

O contrato do Render agora usa o compute gratuito e a imagem imutável do proprietário real do repositório. A branch `main` foi criada, publicada e configurada como padrão no GitHub, enquanto `master` permanece intacta.

## Accomplishments

- Alterado `plan: starter` para `plan: free` em `apps/api/staging.render.yaml`.
- Alterada a imagem para `ghcr.io/mateusoliveiradev1/liiiraa-boost-api@${STAGING_IMAGE_DIGEST}`.
- Atualizado o teste daemon-free para exigir o plano gratuito e o proprietário correto.
- Criada e publicada `main` no commit `a61b4a5`; configurada como branch padrão do repositório público.
- Preservada `master` no commit `3b8d050` e preservados todos os arquivos não rastreados preexistentes.
- Publicação inicial marcada com `[skip ci]`; a consulta de execuções confirmou zero workflows disparados.

## Verification

- `rtk pnpm --filter @liiiraa/api test -- --run container-contract` — 1 arquivo e 5 testes aprovados.
- `rtk pnpm --filter @liiiraa/api exec prettier --check src/staging/container-contract.test.ts staging.render.yaml` — aprovado.
- `rtk git diff --check` — aprovado.
- `rtk gh repo view mateusoliveiradev1/LiiiraaBoostV3 --json defaultBranchRef,url` — branch padrão `main`.
- `rtk git ls-remote --heads origin main master` — ambas as branches presentes.
- `rtk gh run list --repo mateusoliveiradev1/LiiiraaBoostV3 --limit 5` — nenhuma execução iniciada.

## Commits

- `a61b4a5` — `fix(staging): configure free Render service [skip ci]`

## Safety

- Docker local não foi iniciado, consultado ou utilizado.
- Nenhum serviço pago foi provisionado.
- Nenhum segredo foi adicionado ao repositório.

## Next Step

Conectar o Render por OAuth e criar/configurar o serviço gratuito; depois criar o projeto Neon de staging, aplicar migrations com consentimento explícito e configurar os ambientes do GitHub/Vercel antes de acionar os workflows manualmente.

