---
quick_id: 260728-m84
status: passed
verified: 2026-07-28
---

# Verificação — conceito dark aprovado

## Must haves

| Critério                                          | Resultado | Evidência                                                     |
| ------------------------------------------------- | --------- | ------------------------------------------------------------- |
| Reconhecível como o conceito aprovado             | Passou    | `home-1440.png` e `packaged-home.png`                         |
| Não repetir o layout rejeitado de cards genéricos | Passou    | Hero + telemetria, faixa de métricas e plano em linhas        |
| Métricas não se apresentarem como medição real    | Passou    | “Cenário simulado” visível e contratos de fixture preservados |
| Teclado, 150%, texto 200% e forced colors         | Passou    | Matriz Playwright e baselines responsivos                     |
| Rotas e CTA funcionarem                           | Passou    | 58 rotas; CTA `/home` → `/improve` observado no executável    |
| Instalador conter a nova Home                     | Passou    | WebView2/CDP no executável assinado, PT-BR, sem erros         |

## Comandos aprovados

- `pnpm --filter @liiiraa/design-tokens test`
- `pnpm --filter @liiiraa/design-system test`
- `pnpm --filter @liiiraa/feature-shell check`
- `pnpm --filter @liiiraa/feature-shell test`
- `pnpm --filter @liiiraa/desktop check`
- `pnpm --filter @liiiraa/desktop test`
- `pnpm --filter @liiiraa/desktop test:e2e`
- `node tooling/desktop-evidence/package-signed-desktop.mjs --execute-local-development ...`
- `node tooling/desktop-evidence/verify-packaged-wave-zero.mjs --require-reviewed`

## Limites honestos

- A Fase 2 ainda usa adaptadores determinísticos; não existe motor real de
  otimização conectado.
- O instalador é apropriado para teste local do usuário, mas ainda não é uma
  versão pública de produção.
- Windows 10 e Windows 11 em imagens limpas continuam como aceitação não
  resolvida para a fase de distribuição.
