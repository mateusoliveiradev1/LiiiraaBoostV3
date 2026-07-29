---
quick_id: 260729-sip
status: complete
description: Transformar verificação de atualizações em fluxo premium simulado
created: 2026-07-29
---

# Quick Task 260729-sip: Fluxo premium de atualização

## Objetivo

Substituir o toast instantâneo de “Verificar atualizações” por uma experiência determinística e honesta que represente consulta, validação, download e preparação de instalação sem executar uma atualização real nesta fase.

## Tarefas

### 1. Modelar o adaptador simulado

- **Arquivos:** `apps/desktop/src/features/premium-updater.ts`, teste unitário correspondente.
- **Ação:** criar um adaptador cancelável com etapas de verificação, manifesto assinado simulado, progresso de download e preparação da instalação.
- **Verificação:** Vitest cobre sequência, progresso, cancelamento e erro.
- **Concluído quando:** o fluxo é determinístico, testável e não toca em rede, arquivos ou instalador real.

### 2. Construir a experiência visual

- **Arquivos:** `apps/desktop/src/features/premium-operations.tsx`, `apps/desktop/src/premium-operations.css`, Playwright.
- **Ação:** implementar estados `idle`, `checking`, `available`, `downloading`, `ready`, `scheduled`, `up-to-date` e `error`, com progresso, notas da versão, ações e cópia PT-BR/inglês.
- **Verificação:** Playwright valida o percurso completo, cancelamento, ausência de overflow e semântica acessível.
- **Concluído quando:** o usuário entende exatamente o que está acontecendo e que a operação ainda é demonstrativa.

### 3. Validar, empacotar e registrar

- **Ação:** executar TypeScript, ESLint, Impeccable, Vitest, Playwright, Rust e build NSIS.
- **Concluído quando:** checks aprovados, instalador atualizado, hash calculado e commits atômicos criados.

## Conclusão

- Adaptador determinístico e cancelável implementado.
- Fluxo visual completo integrado à rota “Sobre” em PT-BR e inglês.
- Vitest, Playwright, TypeScript, ESLint, Rust e supply chain aprovados.
- Detector Impeccable sem achados.
- Instalador NSIS atualizado gerado com sucesso.
