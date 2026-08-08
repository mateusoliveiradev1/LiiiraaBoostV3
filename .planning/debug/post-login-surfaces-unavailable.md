---
status: resolved
trigger: "tela de sucesso parece local la a url e a logo errada app loga mais nao funciona"
created: 2026-08-08T21:35:00Z
updated: 2026-08-08T21:42:00Z
---

# Debug: post-login surfaces unavailable

## Symptoms

- expected: Real desktop OAuth completes, returns control to the desktop, and opens the complete functional visual experience with the approved Liiiraa Boost brand.
- actual: The browser ends on a loopback callback success page with the wrong product mark; the authenticated desktop shows the complete navigation but every product route resolves to a generic `Ainda não disponível` native-authority placeholder.
- error: No crash or visible JavaScript error. The desktop explicitly reports that no validated native authority exists for the selected route.
- timeline: Observed immediately after the complete desktop entrypoint and real OAuth flow were restored on the freshly formatted PC.
- reproduction: Enter an email, complete system-browser login, return to the desktop, then open `Visão geral` or another optimization route.
- screenshots: `C:\Users\Liiiraa\AppData\Local\Temp\codex-clipboard-c54ff970-5e75-4ed9-877c-a6bb418a9720.png`, `C:\Users\Liiiraa\AppData\Local\Temp\codex-clipboard-635a4995-d8c4-4b96-9d87-c79c7cf762db.png`

## Current Focus

- hypothesis: The Phase 04 production-hardening commit replaced the complete premium route implementation with `premium-operations-production.tsx`, a deliberately minimal fail-closed adapter, while the OAuth loopback server embeds a separate obsolete logo asset.
- test: Compare the current production module graph and callback HTML against the pre-hardening commit and current approved brand components; identify a production-safe way to render complete route surfaces without fabricating PC authority.
- expecting: The complete visual modules still exist and are used by browser-test composition, while packaged production statically selects the unavailable-only adapter.
- next_action: Complete. The corrected internal installer is built, installed, launched, and verified through its live WebView.
- reasoning_checkpoint: The authenticated identity in the titlebar proves the OAuth/account projection succeeded; the unavailable card is a deliberate presentation branch rather than failed authentication.
- tdd_checkpoint: RED confirmed for both regressions; GREEN with 21 TypeScript composition tests and the Rust loopback callback test passing.

## Evidence

- `edb2418` changed the desktop import to `premium-operations-production.tsx`; that module intentionally renders `UnavailableSurface` for every operational route except settings/about.
- Browser tests replaced that module with the complete `premium-operations.tsx`, but the internal Tauri bundle used ordinary Vite production mode and therefore packaged the unavailable-only adapter.
- The OAuth loopback response embedded an obsolete `ϟ` text glyph instead of the canonical two-path Liiiraa Boost SVG.
- The installed WebView at `http://tauri.localhost/account/overview` retained the real authenticated account (`Mateus Oliveira`, `PREMIUM`). Live navigation verified `home`, `competitive`, `toggles`, and `downloads` with `Demonstração segura` present and `Ainda não disponível` absent.
- The internal NSIS package completed successfully at `target/release/bundle/nsis/Liiiraa Boost_0.0.1_x64-setup.exe` and was installed silently with exit code 0.

## Eliminated

## Resolution

- root_cause: The internal/staging bundle was not compositionally distinct from a public production artifact, so Phase 04's fail-closed production adapter replaced the complete visual milestone. The separate Rust callback HTML also carried an obsolete text mark.
- fix: Added an explicit Vite `internal` build mode selected by the Tauri staging overlay. That mode aliases only the internal artifact to the complete deterministic visual foundation, which remains visibly labeled and performs no privileged Windows changes. Public production continues to use the fail-closed adapter. Replaced the callback glyph with the canonical SVG mark.
- verification: TypeScript check passed; 21 focused desktop tests passed; Rust callback test passed; production truth gate passed; stable and internal Vite builds passed; NSIS staging bundle passed; installed authenticated WebView passed live route inspection.
- files_changed: `apps/desktop/package.json`, `apps/desktop/vite.config.ts`, `apps/desktop/src/features/premium-operations.tsx`, `apps/desktop/src/internal-channel.test.ts`, `apps/desktop/src-tauri/tauri.staging.conf.json`, `apps/desktop/src-tauri/src/identity.rs`, `apps/desktop/src-tauri/tests/identity.rs`.
