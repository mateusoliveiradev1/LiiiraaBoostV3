---
status: verifying
trigger: 'Owner UAT reports desktop login state is lost after app restart, logout fails, Account/Admin navigation flashes and temporarily loses session, desktop browser callback is unfinished, and Premium/Free entitlement labels conflict.'
created: 2026-08-06T03:00:00-03:00
updated: 2026-08-06T05:40:00-03:00
---

## Symptoms

expected: Desktop remains authenticated after closing and reopening; logout reliably revokes the correct surface; Account/Admin navigation preserves valid session state without full-page flashes; desktop callback shows a polished success handoff; the owner account has one authoritative permanent Premium entitlement everywhere.
actual: Reopening the desktop returns to login; Admin logout reports failure; opening Portal da conta initially renders Sessão necessária before later showing the account; interactions visibly reload; loopback callback shows raw English text; desktop header says Premium while Account and desktop account details say Free.
errors: Admin displays “Não foi possível encerrar a sessão administrativa. Tente novamente.” No explicit desktop persistence error is shown.
timeline: Reproduced in owner UAT immediately after the 2026-08-06 staging authentication deployment; authentication succeeds during the initial process lifetime.
reproduction: Authenticate from the desktop through the system browser, return to the app, close and reopen it; use Admin logout and Portal da conta; navigate desktop account tabs and compare entitlement labels.

## Current Focus

hypothesis: Confirmed: the 0.0.1 installer supplied to owner UAT was built from tauri.conf.json without tauri.staging.conf.json, so DesktopRuntimeConfig had no API or Account origins and sync_account deterministically returned network-unavailable before making a request.
test: Package through the explicit staging overlay, prove the release binary embeds the exact Render and Account origins, then repeat owner UAT with the Internal #023001 installer.
expecting: The connected build restores the saved credential against Render or presents real system-browser sign-in instead of the connection-unavailable dead end.
next_action: Owner installs `Liiiraa Boost_0.0.1_x64-setup.exe` (SHA-256 `17CA0F5D6BAE0BB7C21823060A616E8B5DD3116C7DA1CAB29564A40120B924E8`) and retests profile persistence, About identity and tray behavior.

## Evidence

- timestamp: 2026-08-06T03:00:00-03:00
  observation: Owner screenshots show authenticated desktop state followed by the login screen after process restart.
  implication: Browser authorization and token exchange work, but durable credential restoration does not.
- timestamp: 2026-08-06T03:00:00-03:00
  observation: Admin logout renders a server-facing failure banner, and Portal da conta first renders an unauthenticated Account shell before later resolving to the authenticated account.
  implication: Session lifecycle and inter-surface handoff are not transactionally represented in the UI.
- timestamp: 2026-08-06T03:00:00-03:00
  observation: Desktop chrome displays Premium while Account authority and desktop account projection display Free.
  implication: At least one surface is rendering non-authoritative entitlement state.
- timestamp: 2026-08-06T03:35:00-03:00
  observation: RED regression tests failed for desktop startup restoration, Admin CSRF retention, authoritative Premium projection, and title-bar tier rendering.
  implication: Each reported symptom was reproduced at its owning boundary before implementation.
- timestamp: 2026-08-06T03:43:00-03:00
  observation: Targeted desktop, Account, Admin, API, design-system, and Rust callback tests pass after the fixes.
  implication: Startup now distinguishes restoring/revoked/unavailable states, logout reuses or renews CSRF, internal navigation uses Next transitions, and callback HTML is productized.
- timestamp: 2026-08-06T03:45:33-03:00
  observation: Neon staging contains an active promotion entitlement for the owner identity with valid_until NULL and role security.
  implication: The owner account now has a permanent authoritative Premium grant instead of a presentation-only label.
- timestamp: 2026-08-06T03:49:00-03:00
  observation: Account production check/build (91 tests), Admin production check/build (95 tests), API suite (170 tests), desktop unit suite (115 tests), Rust identity/account-sync tests, and the staging-origin contract all pass.
  implication: The corrected flows compile and pass focused regression gates across every affected deployable surface.
- timestamp: 2026-08-06T03:50:00-03:00
  observation: Tauri produced a new NSIS installer at target/release/bundle/nsis/Liiiraa Boost_0.0.0_x64-setup.exe.
  implication: Owner UAT can exercise the corrected native startup and callback behavior in a packaged Windows build.
- timestamp: 2026-08-06T04:39:00-03:00
  observation: Account (92), Admin (95), Web (129), API (170), desktop (116), generated-contract (51), and Rust contract suites pass; all four production builds and contract compatibility pass.
  implication: The browser handoff, persistent Admin provider, database-backed administrative role, responsive menu, and desktop account redesign are covered across their owning deployables.
- timestamp: 2026-08-06T04:39:00-03:00
  observation: Tauri produced target/release/bundle/nsis/Liiiraa Boost_0.0.1_x64-setup.exe from the verified source.
  implication: Native UAT can now verify Windows Credential Manager persistence, restart behavior, browser return, and the real account projection on version 0.0.1.
- timestamp: 2026-08-06T04:55:00-03:00
  observation: Owner UAT opened the supplied 0.0.1 package directly into Conexao indisponivel / Sua sessao salva continua protegida, with no sign-in path.
  implication: The packaged native runtime did not have usable hosted origins even though the hosted API itself was healthy.
- timestamp: 2026-08-06T04:57:00-03:00
  observation: The failed installer was named Liiiraa Boost_0.0.1_x64-setup.exe, while tauri.staging.conf.json requires productName Liiiraa Boost Internal #023001 and contains the only packaged apiOrigin/accountOrigin values.
  implication: The UAT artifact was produced from the base Tauri config and could only return the runtime-origins unavailable response.
- timestamp: 2026-08-06T04:58:00-03:00
  observation: A RED regression test proved there was no bounded staging bundle script; after adding bundle:staging with --config src-tauri/tauri.staging.conf.json, all 19 internal-channel tests passed.
  implication: Invited-staging packaging now has one explicit command that cannot silently omit the connected overlay.
- timestamp: 2026-08-06T04:59:00-03:00
  observation: The rebuilt Internal #023001 executable contains both exact hosted origins, reports product version 0.0.1, and passed 117 desktop tests, TypeScript, ESLint, Prettier, 67 Rust tests, Cargo fmt, Vite, Rust release compilation, and NSIS bundling.
  implication: Automated evidence closes the packaging/configuration defect; only owner installation UAT remains.
- timestamp: 2026-08-06T05:38:00-03:00
  observation: RED/GREEN coverage proves native Bearer PATCH is admitted without browser CSRF, hostile Origin remains rejected, `If-Match` is sent, and a mutation `403` preserves credential, projection and local draft.
  implication: editing the desktop profile no longer converts an authorization-policy response into a destructive logout.
- timestamp: 2026-08-06T05:39:00-03:00
  observation: Native About renders version 0.0.1 and the development channel from `ShellInstallerIdentityJson`, hides all Phase 2/demo updater copy, and the staging product name is now `Liiiraa Boost`.
  implication: the installed app no longer advertises 0.0.0, a stable channel or a simulated update flow.
- timestamp: 2026-08-06T05:40:00-03:00
  observation: API 171/171, desktop 120/120, Rust 69/69, desktop TypeScript, Prettier, Cargo fmt, Vite and NSIS passed; the release binary contains both exact hosted origins.
  implication: the replacement installer contains the complete regression fix set and is ready for owner UAT.

## Eliminated

- hypothesis: The browser authorization itself is wholly broken.
  reason: The owner successfully completed browser login and reached an authenticated desktop state during the same process lifetime.
- hypothesis: Render or the published account endpoint was unavailable during the failed desktop launch.
  reason: External checks returned health ok, ready true at build 384a51097a373b1cc191b8a94cb8edd8cf32b1da, and /v1/account returned the expected live 401 without a credential.

## Resolution

root_cause: The first owner artifact omitted the staging overlay. Separately, native profile PATCH was subjected to browser Origin/CSRF policy, omitted `If-Match`, and treated both 401 and 403 as credential revocation. The About surface still rendered Phase 2 constants instead of native installer identity.
fix: Added the guarded staging bundle command; admitted Bearer-authenticated native account mutation only when Origin is absent while preserving browser CSRF; sent `If-Match`; restricted credential deletion to 401; preserved drafts on mutation failure; and rendered native About from the host identity without the simulated updater.
verification: API 171/171, desktop 120/120, Rust 69/69, desktop TypeScript, formatting, Vite release and NSIS pass. The release binary embeds the exact Render and Account origins. Owner retest remains pending.
files_changed: apps/api/src/modules/identity/real-routes.ts, apps/api/src/staging/real-auth.test.ts, apps/desktop/package.json, apps/desktop/src/internal-channel.test.ts, apps/desktop/src/preferences.tsx, apps/desktop/src/app.tsx, apps/desktop/src/features/premium-operations.tsx, apps/desktop/src-tauri/src/account_sync.rs, apps/desktop/src-tauri/src/window.rs, apps/desktop/src-tauri/src/main.rs, apps/desktop/src-tauri/tauri.staging.conf.json, tests, and Phase 4 UAT artifacts.
