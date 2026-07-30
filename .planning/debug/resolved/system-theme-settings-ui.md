---
status: resolved
trigger: 'Sistema (Windows) não acompanha o tema; configurações precisam ser 100% funcionais; ícones de energia e rede parecem genéricos.'
created: 2026-07-29
updated: 2026-07-29
---

# Debug: tema do sistema e acabamento das configurações

## Symptoms

- **Expected:** ao escolher “Sistema (Windows)”, o app deve acompanhar imediatamente o tema claro/escuro do Windows e continuar sincronizado.
- **Actual:** a seleção aparece, mas a aparência não acompanha o sistema de forma confiável.
- **Errors:** nenhum erro visível; o problema é comportamental.
- **Timeline:** observado no instalador atual da Fase 2.
- **Reproduction:** abrir Configurações → Aparência → Tema do aplicativo → Sistema (Windows).

## Current Focus

- **hypothesis:** confirmada — a janela nativa recebia o tema já resolvido (`light`/`dark`) mesmo quando a preferência persistida era `system`.
- **test:** teste de regressão unitário e Playwright alternando `prefers-color-scheme` em tempo real.
- **expecting:** o tema visual e a janela nativa voltam a seguir o Windows sem exigir reinicialização.
- **next_action:** concluída; correção validada e empacotamento liberado.
- **reasoning_checkpoint:** sintomas suficientes fornecidos pelo usuário; investigação será executada inline devido à restrição atual de subagentes.
- **tdd_checkpoint:** RED/GREEN concluído.

## Evidence

- `preferences.test.tsx`: 9 testes aprovados, incluindo o contrato nativo de `system -> null`.
- Playwright: troca dinâmica claro → escuro aprovada e 34/34 testes Chromium aprovados.
- Inspeção visual: 1440×900, 1280×800, 960×700 e 760×600 sem rolagem horizontal.
- Detector Impeccable: nenhuma ocorrência nos arquivos de UI alterados.

## Eliminated

- O listener de `matchMedia` não era a causa; a UI React já reagia corretamente às mudanças do sistema.
- Persistência da preferência também não era a causa; `system` era salvo corretamente.

## Resolution

- **root_cause:** `getCurrentWindow().setTheme(resolvedTheme)` fixava a janela Tauri em `light` ou `dark`, anulando o comportamento nativo de “seguir o Windows”.
- **fix:** a janela recebe `null` quando a preferência é `system`; as configurações também foram completadas com controles funcionais, ações de dados/recuperação, traduções, ícones semânticos e layout responsivo.
- **verification:** TypeScript aprovado; ESLint dos arquivos alterados aprovado; Prettier aprovado; Vitest 89/89; Playwright Chromium 34/34; Cargo 35/35; supply-chain 59 pins; auditoria visual manual e detector Impeccable aprovados.
- **files_changed:** `preferences.tsx`, `preferences.test.tsx`, `premium-settings.tsx`, `premium-operations.tsx`, `premium-operations.css`, `premium-localization.ts`, `control-center-data.ts`, ícones do design system, testes de navegador e snapshots visuais.
