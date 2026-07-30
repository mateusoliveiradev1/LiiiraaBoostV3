---
phase: 02-complete-desktop-experience
plan: "27"
subsystem: packaged-desktop
tags: [tauri-driver, authenticode, windows-11, performance, webdriver]
requires: [02-16, 02-25, 02-33]
provides:
  - verificação reproduzível da assinatura e dos hashes do artefato assinado
  - doze jornadas nativas no executável Tauri empacotado
  - medição observada de inicialização, resposta e working set no Windows 11
  - separação explícita entre UAT da estação de desenvolvimento e certificação de lançamento
affects: [02-26, 02-28, 02-29, 02-30, phase-10]
tech-stack:
  added: ["@types/node@24.13.3", "tauri-driver@2.0.6 (local tool)"]
patterns:
  - WebDriver W3C sem cliente externo adicional
  - Authenticode validado por hash, thumbprint e classe de confiança
key-files:
  created:
    - apps/desktop/tests/packaged/journeys.ts
    - apps/desktop/tests/packaged/signature.ts
    - apps/desktop/tests/packaged/performance.ts
    - quality/evidence/phase-02/artifacts/windows-11-development-run.json
    - quality/evidence/phase-02/environment/windows-11-development-workstation.json
  modified:
    - apps/desktop/tests/packaged/driver.ts
    - apps/desktop/tests/packaged/windows-matrix.json
key-decisions:
  - A estação Windows 11 disponível comprova o UAT empacotado da Fase 2, mas não é apresentada como imagem limpa ou certificação pública.
  - A certificação em imagem limpa Windows 10 foi adiada para a Fase 10 com aprovação explícita do usuário.
completed: 2026-07-30
---

# Plano 02-27 — aceite empacotado no Windows 11 disponível

## Resultado

- O artefato exato de `signed-desktop-package.json` foi aberto por `tauri-driver` 2.0.6 com Microsoft Edge Driver 150.0.4078.105 assinado.
- Os hashes do instalador e do executável, o thumbprint do certificado e a classificação self-signed de desenvolvimento foram recomputados e conferidos.
- Doze jornadas nativas chegaram à Home e observaram navegação, comando, atividade, perfil, configurações, jogo, recuperação e o aviso de simulação.
- Inicialização observada: 1645,7794 ms.
- Resposta DOM observada: 2,7618 ms.
- Working set do processo Tauri observado: 32.669.696 bytes.

## Verificação

- TypeScript estrito do harness empacotado: aprovado.
- ESLint do harness empacotado: aprovado.
- Desktop unitário: 92 testes aprovados.
- Chromium: 41 testes aprovados, incluindo axe em 59 pares canônicos.
- Jornada Tauri empacotada: 12/12 aprovadas.
- Cadeia de fornecimento: 60 pins exatos aprovados.

## Desvio aprovado

A máquina disponível é uma estação Windows 11 Pro build 26200, não uma imagem limpa e resetável. O usuário aprovou adiar a certificação em Windows 10 para a Fase 10. As evidências mantêm `publicTrust`, `productionReady` e `distributionAllowed` como `false`; nenhuma prontidão pública é alegada.

## Self-Check: PASSED — DEVELOPMENT WORKSTATION UAT
