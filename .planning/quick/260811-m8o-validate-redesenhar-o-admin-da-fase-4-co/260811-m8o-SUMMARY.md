---
status: complete
quick_id: 260811-m8o
completed: 2026-08-11T16:20:00-03:00
implementation_commits:
  - c3c90537b0e5f357e492b514b65526af27d3f4bb
  - 44eed222630c07e2f9d68a9440c4ae8502abded2
---

# Summary: recuperar a experiência visual do Admin

- A visão geral passou a começar por uma prioridade operacional derivada apenas dos registros admitidos pela API.
- Sessões ativas e mudanças de estado agora têm leitura imediata, enquanto validade e postura da sessão permanecem visíveis sem repetição.
- O histórico foi convertido em ledger secundário, limitado a seis registros na visão geral e marcado por estado semântico.
- A navegação lateral expandida comunica a ação de compactar e preserva o alvo acessível no modo compacto.
- Pessoas traduz funções, estados dos membros e estado da autoridade sem alterar os valores enviados ao servidor.
- Nenhuma fixture, autoridade de URL, métrica inventada, Docker ou dependência visual genérica foi introduzida.

## Publicação

- Projeto: `liiiraa-boost-admin-staging`
- Domínio: `https://admin.liiiraaboost.com.br`
- Primeiro deployment observado: `dpl_CrwfBe4tPZV1DouxVR7nvTj7qYhY` (`READY`)
- Deployment final: `dpl_5iVA1sa89deSKDk54XgKmP8jep2m` (`READY`), commit `44eed22`, incluindo o acabamento de localização observado durante o UAT.

## Gates

- `pnpm lint`: passou.
- `pnpm --filter @liiiraa/admin typecheck`: passou.
- `pnpm --filter @liiiraa/admin test -- --run`: 191 testes passaram.
- `pnpm --filter @liiiraa/admin build`: passou com Next.js 16.3.0.
- `git diff --check`: passou.
