---
status: resolved
trigger: 'quebrado sem scroll'
created: 2026-07-30
updated: 2026-07-30
---

# Debug Session: profile-scroll-blocked

## Symptoms

- Expected: a rota de perfil deve permitir rolar até todas as seções inferiores.
- Actual: o conteúdo continua abaixo da janela instalada, mas fica cortado e sem barra de rolagem utilizável.
- Errors: nenhuma mensagem de erro visível.
- Timeline: observado após instalar a versão com a nova rota premium de perfil.
- Reproduction: abrir Perfil em uma janela com altura semelhante ao print enviado.

## Current Focus

- hypothesis: confirmada e corrigida — uma regra global de `premium-operations.css` aplicava `overflow: hidden` ao canvas de todas as rotas.
- next_action: nenhum; correção verificada e instalador reconstruído.

## Evidence

- Screenshot do usuário mostra “Atividade local recente” cortada na borda inferior e ausência de scrollbar.
- Reprodução em 1680×856: `.desktop-work-canvas` possui `clientHeight: 804`, `scrollHeight: 1746` e `overflowY: hidden`.
- Após `mouse.wheel(0, 700)`, `scrollTop` permanece `0`.
- A última regra casada vem de `premium-operations.css:214` e sobrescreve três regras anteriores com `overflow: auto`.

## Root Cause

`premium-operations.css` configurava `.desktop-app-shell .desktop-work-canvas` com `overflow: hidden` sem limitar a regra às superfícies `.premium-operations`. Como esse stylesheet é carregado depois dos estilos base, o perfil e outras rotas normais perdiam a rolagem vertical.

## Fix

- Rotas normais agora usam `overflow-x: hidden` e `overflow-y: auto`.
- Somente canvases que contêm diretamente `.premium-operations` mantêm `overflow: hidden`, pois essas telas possuem rolagem interna própria.
- Foi adicionado um teste de roda do mouse que confirma alteração de `scrollTop` e acesso a “Conta e dados locais”.

## Verification

- TypeScript do desktop: aprovado.
- ESLint do teste alterado: aprovado.
- Detector Impeccable: zero findings.
- Vitest desktop: 92 testes aprovados.
- Playwright específico do perfil: 4 testes aprovados.
- Playwright Chromium completo: 41 testes aprovados.
- Instalador NSIS reconstruído e assinado localmente.
- SHA-256: `08F1B5D33A85270DF0450A0C4491253073D9DE8645DD77530DAFB5E0F5A1F567`.

## Resolution

resolved: 2026-07-30
