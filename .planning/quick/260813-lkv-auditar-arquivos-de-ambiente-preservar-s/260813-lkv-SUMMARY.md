---
quick_id: 260813-lkv
status: complete
commit: 6bcdeed
---

# Summary

Os arquivos `apps/*/.env.local` não foram commitados porque contêm credenciais reais geradas ou fornecidas pela Vercel. Eles permanecem intactos e ignorados.

## Changes

- Normalizados os `.gitignore` de `apps/web`, `apps/account` e `apps/admin`.
- Mantido `.env*` fora do Git, com exceção explícita para `.env.example`.
- Adicionados exemplos seguros sem valores secretos.
- Documentado `BLOB_READ_WRITE_TOKEN` vazio no exemplo do app de conta.

## Verification

- Nenhum `.env.local` foi staged.
- O scan dos exemplos não encontrou credenciais preenchidas nem valores de alta entropia.
- `git diff --cached --check` passou antes do commit.
