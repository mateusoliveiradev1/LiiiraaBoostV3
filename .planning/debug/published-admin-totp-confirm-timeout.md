---
status: investigating
trigger: 'published Admin authority verifier times out while reading the TOTP confirmation response'
created: 2026-08-11T06:11:06.3361104Z
updated: 2026-08-11T06:11:06.3361104Z
---

## Sintomas

- O verificador sintético de autoridade publicada do Admin excede cinco minutos em
  `tooling/web-evidence/tests/admin-operations.spec.ts:260` ao executar
  `await confirmation.json()` após `POST /v1/identity/strong-auth/totp/confirm`.
- O comportamento repetiu-se sem variação nos runs `31463236495` e `31463656945`.

## Limite conhecido

- A revisão exata `cfef0c1` está saudável no Vercel e no Render.
- Sondas diretas não autenticadas no origin e no proxy Admin retornam imediatamente `403` com
  `REQUEST_DENIED`; não há evidência de indisponibilidade geral da rota ou do proxy.
- O defeito surgiu no fluxo sintético de ativação TOTP e é independente da autorização/navegação
  do workspace de convites corrigida em `cfef0c1`.

## Próxima investigação

- Instrumentar tempos e encerramento da requisição autenticada de confirmação TOTP no browser,
  proxy e API sem registrar segredo, sessão ou código TOTP.
- Confirmar se o runner fica aguardando corpo, conexão, transação PostgreSQL ou resposta do proxy.
