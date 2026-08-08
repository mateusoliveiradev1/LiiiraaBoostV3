---
status: resolved
trigger: "Após instalar o build 0.0.1 de staging gerado em 2026-08-08, o app abre somente a barra superior e uma área preta vazia."
created: 2026-08-08T21:00:00Z
updated: 2026-08-08T21:00:00Z
---

# Debug: packaged desktop blank content regression

## Symptoms

- expected: O instalador 0.0.1 abre a interface completa do Liiiraa Boost.
- actual: A janela Tauri abre com titlebar e controles, mas toda a área de conteúdo permanece preta e vazia.
- error: Nenhuma mensagem visível; screenshot fornecido pelo owner.
- timeline: Primeiro launch do instalador de staging reconstruído após a formatação do Windows.
- reproduction: Instalar e iniciar `target/release/bundle/nsis/Liiiraa Boost_0.0.1_x64-setup.exe`.
- screenshot: `C:\Users\Liiiraa\AppData\Local\Temp\codex-clipboard-bc60ddf4-8594-4951-bce2-b47c4c7c1cbf.png`

## Current Focus

- hypothesis: Regressão na geometria CSS do shell de primeira abertura, com conteúdo montado mas altura zero.
- test: Reproduzir o release por WebView2 CDP e inspecionar DOM, erros de página, console e retângulos do shell.
- expecting: Se CSS, o root terá markup sem pageerror e o conteúdo terá altura zero; se bootstrap, root estará vazio ou haverá erro JavaScript/CSP.
- next_action: Capturar o estado real do release empacotado por CDP.
- reasoning_checkpoint: A titlebar renderizada prova que WebView, documento, CSS base e ao menos parte do React carregaram; o histórico `first-run-content-zero-height.md` tem a mesma assinatura visual.
- tdd_checkpoint: pending

## Evidence

- timestamp: 2026-08-08T21:00:00Z
  checked: Screenshot humano do instalador 0.0.1.
  found: Titlebar personalizada, título e controles renderizam; a área abaixo mantém apenas o fundo.
  implication: Falha total de asset/index.html é improvável; geometria ou bootstrap de rota continuam candidatos.

### CDP confirmation (2026-08-08T21:24:00Z)

- The packaged release loaded the complete React DOM at `http://tauri.localhost/` with 7,409 characters under `#root`.
- `.desktop-app-shell` measured 1280x800 with computed rows `52px 0px 0px 748px`.
- `.desktop-goal-region` and `.desktop-work-canvas` both measured 0px tall.
- The validated shell in `app.tsx` wraps these regions in `.desktop-shell-body`; `production-app.tsx` omitted that wrapper and placed both regions into the zero-height rows.
- Confirmed root cause: production-only shell composition regression, not JavaScript, CSP, assets, bootstrap, or the formatted PC.
- TDD next action: require the production composition to include `.desktop-shell-body`, observe RED, then apply the minimal structural fix.

## Eliminated

- Missing frontend assets: the production DOM and localized text are present.
- CSP or JavaScript bootstrap failure: React rendered the complete content tree.
- Docker or machine setup: the defect reproduces directly in the packaged executable and is explained by computed CSS geometry.

## Resolution

- root_cause: Commit `edb2418` redirected the packaged desktop from the complete `DesktopApp` entry to a reduced `ProductionDesktopApp`. That reduced shell also omitted `.desktop-shell-body`, placing all content into zero-height grid rows. The complete application, auth, routes, and visual system were never deleted.
- fix: Restore `production-index.tsx` to render the complete, production-hardened `DesktopApp`. Keep the separate production entry file and production-safe operations adapter, so browser scenario composition remains isolated while the actual app shell is packaged.
- verification: The rebuilt executable rendered the 1280x800 premium first-run experience with heading `Tudo pronto para sua primeira sessão.` and no page errors. Continuing opened the complete auth screen with `data-auth-mode="system-browser"` and heading `Seu PC, otimizado com provas.`. The silently installed executable was inspected separately and showed the same real auth composition. Focused desktop tests passed 36/36, TypeScript passed, and the production fixture/authority gate passed 13/13 when Cargo was added to PATH.
- files_changed: `apps/desktop/src/production-index.tsx`, `apps/desktop/src/production-entrypoint.test.tsx`, `.planning/debug/packaged-blank-content-regression.md`
