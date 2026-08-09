---
status: diagnosed
trigger: 'o vinculo no pc fala q e pq ainda e beta'
created: 2026-08-09T14:05:00-03:00
updated: 2026-08-09T14:05:00-03:00
---

## Symptoms

- expected: Free explica que o vinculo acompanha Premium; Premium pode vincular um PC real com confirmacao e persistencia PostgreSQL.
- actual: Toda conta sem dispositivo recebe apenas Aguardando beta e nenhuma acao de vinculo.
- reproduction: Entrar com uma conta Free ou Premium sem dispositivo e abrir Conta > Dispositivo.

## Current Focus

- hypothesis: Confirmed. A composicao de producao foi deliberadamente deixada read-only embora o dominio e as rotas de dispositivo ja existam.
- test: Rastreio da UI ate DesktopAccountAuthority, Tauri, device_identity, /v1/devices/bind e decideDeviceBinding.
- expecting: O plano deve preservar o gate Premium, confirmacoes de uma licenca e evidencia sem identificadores crus.
- next_action: Planejar a fronteira de evidencia, o comando nativo e a UI Free/Premium antes de implementar.

## Evidence

- timestamp: 2026-08-09T14:05:00-03:00
  checked: apps/desktop/src/features/account-experience.tsx.
  found: O texto Aguardando beta e hardcoded e nao existe botao ou mutacao na rota Device de producao.
  implication: O comportamento visto pelo owner corresponde exatamente ao codigo, nao a uma falha de configuracao.

- timestamp: 2026-08-09T14:05:00-03:00
  checked: apps/api/src/modules/devices/routes.ts e packages/control-plane-application/src/use-cases/bind-device.ts.
  found: A API ja oferece bind transacional, idempotencia, auditoria e um-PC; o dominio nega premium-not-active e exige confirmacoes explicitas.
  implication: Free nao deve vincular; Premium pode, desde que o cliente atravesse a fronteira segura.

- timestamp: 2026-08-09T14:05:00-03:00
  checked: apps/desktop/src-tauri/src/device_identity.rs e account_sync.rs.
  found: Existe apenas a derivacao de evidencias a partir de observacoes fornecidas; nenhuma producao coleta observacoes Windows ou envia bind, e a forma local diverge da evidencia protegida esperada pelo servidor.
  implication: Ligar a UI diretamente ao endpoint criaria uma solucao falsa ou vazaria identidade de hardware; a fronteira precisa ser implementada conscientemente.

## Diagnosis

- root_cause: O cliente de producao nunca implementou o fluxo de vinculo. Restaram somente a UI provisoria, um derivador Rust isolado e a autoridade de servidor sem consumidor desktop.
- suggested_fix: Separar Free/Premium na UX; implementar coleta Windows allowlisted, protecao sem dados crus, comando Tauri e mutacao autoritativa; admitir na UI apenas a projecao PostgreSQL confirmada.
- files_involved:
  - apps/desktop/src/features/account-experience.tsx
  - apps/desktop/src/account-authority.ts
  - apps/desktop/src-tauri/src/device_identity.rs
  - apps/desktop/src-tauri/src/account_sync.rs
  - apps/desktop/src-tauri/src/main.rs
  - apps/api/src/modules/devices/routes.ts
  - packages/control-plane-domain/src/devices/device-evidence.ts
