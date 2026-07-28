---
phase: 02-complete-desktop-experience
plan: "34"
completed: 2026-07-28
requirements: [UX-01, UX-02, UX-10, UX-11]
---

# Plano 02-34 — PT-BR e copy visível

## Resultado

- Preferências passaram para o formato v3 e agora registram se o idioma foi
  detectado automaticamente ou escolhido explicitamente.
- Instalações com preferências v1/v2 em inglês migram uma única vez para PT-BR,
  preservando escala, movimento, densidade, contraste e comportamento da bandeja.
- Uma escolha explícita feita no formato atual nunca é sobrescrita.
- Quando o host nativo ainda não informa o idioma, o primeiro carregamento usa
  PT-BR em vez de inglês.
- O handoff do instalador não exibe mais o identificador cru do canal nem o
  motivo técnico de incompatibilidade em inglês.
- A copy PT-BR do handoff foi simplificada e recebeu proteção contra regressões
  conhecidas de texto em inglês.

## Verificação

- `@liiiraa/desktop test:localization`: 66 testes aprovados.
- `@liiiraa/desktop check`: aprovado.
- `@liiiraa/feature-shell` preferences: 88 testes aprovados.
- `@liiiraa/feature-shell check`: aprovado.

## Limites preservados

- O publicador técnico exato continua visível para verificação de identidade.
- A compilação segue marcada como desenvolvimento, sem confiança pública.
- Nenhuma otimização real ou efeito no Windows foi alegado.
