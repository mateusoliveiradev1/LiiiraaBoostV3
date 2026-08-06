---
status: resolved
trigger: 'Owner UAT reports desktop login state is lost after app restart, logout fails, Account/Admin navigation flashes and temporarily loses session, desktop browser callback is unfinished, and Premium/Free entitlement labels conflict.'
created: 2026-08-06T03:00:00-03:00
updated: 2026-08-06T14:40:00-03:00
---

## Symptoms

expected: Desktop remains authenticated after closing and reopening; logout reliably revokes the correct surface; Account/Admin navigation preserves valid session state without full-page flashes; desktop callback shows a polished success handoff; the owner account has one authoritative permanent Premium entitlement everywhere.
actual: Reopening the desktop returns to login; Admin logout reports failure; opening Portal da conta initially renders Sessão necessária before later showing the account; interactions visibly reload; loopback callback shows raw English text; desktop header says Premium while Account and desktop account details say Free.
errors: Admin displays “Não foi possível encerrar a sessão administrativa. Tente novamente.” No explicit desktop persistence error is shown.
timeline: Reproduced in owner UAT immediately after the 2026-08-06 staging authentication deployment; authentication succeeds during the initial process lifetime.
reproduction: Authenticate from the desktop through the system browser, return to the app, close and reopen it; use Admin logout and Portal da conta; navigate desktop account tabs and compare entitlement labels.

## Current Focus

hypothesis: Confirmed: desktop-to-web persistence works. The reverse flow exposed two independent defects: a committed web PATCH could lose or reject its response and report a false authority failure instead of reconciling the newer PostgreSQL projection; the desktop authority lifetime was scoped to Account routes, so the overview title bar stopped observing remote identity changes.
test: Simulate a response lost after a committed web PATCH and require a confirming GET; keep one live authority shared by web chrome/page/inspector and one process-lifetime desktop authority; exercise periodic, focus, visibility, reconnection and mutation synchronization without concurrent reads or dropped triggers.
expecting: A successful web save never reports a false failure, and both open surfaces converge on the newest account projection automatically within five seconds or immediately when focused.
next_action: None. Owner live UAT passed and the debug session is resolved.

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
- timestamp: 2026-08-06T06:04:00-03:00
  observation: RED tests reproduced both defects: the renderer returned no committed result when a resume read overtook profile save, and native sync returned `Mateus Oliveira` after PATCH had returned `Mateus Winchester` because the follow-up GET replaced it.
  implication: the reported non-persistence was a deterministic authority-ordering defect, not a cosmetic delay.
- timestamp: 2026-08-06T06:22:00-03:00
  observation: Desktop 123/123, Rust 70/70 and five Playwright authority tests pass; visual checks cover Profile, Plan, Device and Security at the standard and 800 px minimum viewports with exactly one active tab and no horizontal overflow.
  implication: committed identity now updates every desktop identity surface, failure keeps the draft, and all four real account routes have final responsive states without simulated device or security claims.
- timestamp: 2026-08-06T06:24:00-03:00
  observation: The staging NSIS bundle rebuilt successfully at version 0.0.1 with SHA-256 `1C1B6FF3A09AF2FC71CA527365E5786EA4EDAD34D82FC55C6CB82A97E1BB156B`.
  implication: owner UAT can now validate database persistence across a real process restart using the corrected mutation authority.
- timestamp: 2026-08-06T06:40:00-03:00
  observation: Owner UAT still received “O perfil não foi salvo”; RED tests reproduced API 400 for the desktop's exact `If-Match: "2"` and the UI replacing `Mateus Winchester` with the confirmed remote name after failure.
  implication: The remaining defect was at the HTTP precondition parser and local-draft rendering boundary, before any PostgreSQL mutation.
- timestamp: 2026-08-06T06:40:00-03:00
  observation: The strict parser now accepts numeric quoted/unquoted versions and full account ETags while rejecting wildcard, lists, negatives and malformed tags; API 171/171, desktop 123/123, Rust 70/70 and browser authority 6/6 pass.
  implication: Automated coverage now exercises the exact packaged request and preserves the user's input on a real failure; deployment and replacement-installer UAT remain.
- timestamp: 2026-08-06T06:55:00-03:00
  observation: Protected workflow 31090501973 completed successfully and the hosted `/ready` endpoint reports `ready: true`, `authorityConnected: true` and build `7e13ef3a35f5f03aef7a685857b608f5239d22d1`.
  implication: Render is serving the corrected API against the staging PostgreSQL authority.
- timestamp: 2026-08-06T06:55:00-03:00
  observation: The staging NSIS bundle rebuilt successfully at version 0.0.1 with SHA-256 `91A785BCE849438B6961030FC1BAE326B02417CA8E366966CD925A748F7B3817`.
  implication: Owner UAT can now exercise the matching corrected desktop and hosted API.
- timestamp: 2026-08-06T14:20:00-03:00
  observation: Owner UAT confirmed desktop save, immediate desktop rendering, PostgreSQL persistence across restart, and matching web projection. A subsequent web save committed version 4 but displayed “A autoridade da conta está indisponível”; after reload the web showed the committed value, while an already-open desktop overview retained the previous name.
  implication: Persistence is authoritative in both directions, but ambiguous mutation reconciliation and process-lifetime live observation were missing.
- timestamp: 2026-08-06T14:20:00-03:00
  observation: RED/GREEN coverage now reconciles a lost committed PATCH response, shares one live web projection across chrome/page/inspector, keeps the desktop authority active outside Account routes, refreshes every five seconds and on lifecycle signals, serializes overlapping refresh triggers, and preserves mutation ordering.
  implication: Both surfaces converge automatically without restart while PostgreSQL remains the only source of truth.
- timestamp: 2026-08-06T14:20:00-03:00
  observation: Account verify passes 94 tests, TypeScript and Next production build; desktop passes 124 tests, seven browser authority/visual tests and 70 Rust tests.
  implication: The bidirectional synchronization implementation is ready for deployment and packaged UAT.
- timestamp: 2026-08-06T14:34:00-03:00
  observation: Vercel deployment `dpl_8r9XcVFujtt4sfyUv8QRdcgZUmYp` is READY and the production Account alias returns revision `1cc544d3450c88532d8737d0182fe3ee7b2db7c3` from its deployment evidence endpoint.
  implication: The public Account surface is serving the exact bidirectional synchronization implementation rather than a stale deployment.
- timestamp: 2026-08-06T14:34:00-03:00
  observation: GitHub run 31122970413 passed contract verification and desktop admission for the exact revision; its redundant Account deployment probe remains queued without a runner while Vercel independently reports the same revision READY.
  implication: No executed admission gate failed, and exact-revision Vercel evidence is sufficient to begin owner UAT without waiting on runner allocation.
- timestamp: 2026-08-06T14:34:00-03:00
  observation: The replacement staging installer `Liiiraa Boost_0.0.1_x64-setup.exe` was rebuilt with SHA-256 `74CEC05177C0C5D02E5E9788757369582992804B106FC255802E2B29D3484C70` and size 5,515,590 bytes.
  implication: Owner UAT has one immutable artifact matching the published synchronization revision.
- timestamp: 2026-08-06T14:40:00-03:00
  observation: Owner live UAT confirmed that the published web and installed desktop now synchronize profile changes automatically in both directions and that the complete account flow is functioning.
  implication: The final user-observable acceptance criterion passed in the real staging environment, so the account persistence and synchronization debug session can be closed.

## Eliminated

- hypothesis: The browser authorization itself is wholly broken.
  reason: The owner successfully completed browser login and reached an authenticated desktop state during the same process lifetime.
- hypothesis: Render or the published account endpoint was unavailable during the failed desktop launch.
  reason: External checks returned health ok, ready true at build 384a51097a373b1cc191b8a94cb8edd8cf32b1da, and /v1/account returned the expected live 401 without a credential.

## Resolution

root_cause: The first owner artifact omitted the staging overlay. Separately, native profile PATCH was subjected to browser Origin/CSRF policy, omitted `If-Match`, and treated both 401 and 403 as credential revocation. After those defects were fixed, a successful PATCH was still followed by an unnecessary GET capable of replacing the committed projection, while focus/resume synchronization could supersede the renderer mutation sequence. The packaged request then sent `If-Match: "2"`, which the API parser rejected. Finally, reverse UAT showed that web mutations did not reconcile ambiguous committed responses and that desktop authority observation existed only while an Account route was mounted.
fix: Added guarded staging packaging; corrected native authorization, preconditions, credential retention and mutation ordering; rebuilt the real account routes; accepted exact numeric/full ETags; preserved local drafts; reconciled ambiguous web mutations through a confirming authoritative GET; introduced one shared live web authority for chrome/page/inspector; moved desktop authority to process lifetime; and serialized automatic five-second plus lifecycle-triggered refreshes.
verification: API 171/171 remains deployed at build `7e13ef3a35f5f03aef7a685857b608f5239d22d1`. Account verify passes 94 tests, TypeScript and Next production build; desktop passes 124 tests, seven browser authority/visual tests, TypeScript and 70 Rust tests. Targeted ESLint and Prettier pass; `apps/desktop/src/app.tsx` retains five unrelated pre-existing lint findings. Vercel serves exact revision `1cc544d3450c88532d8737d0182fe3ee7b2db7c3`, and the matching installer hash is `74CEC05177C0C5D02E5E9788757369582992804B106FC255802E2B29D3484C70`. Owner live UAT passed bidirectional automatic synchronization in the real web and desktop surfaces.
files_changed: apps/api/src/modules/identity/real-routes.ts, apps/api/src/staging/real-auth.test.ts, apps/desktop/package.json, apps/desktop/src/internal-channel.test.ts, apps/desktop/src/preferences.tsx, apps/desktop/src/app.tsx, apps/desktop/src/account-authority.ts, apps/desktop/src/features/account-experience.tsx, apps/desktop/src/profile-experience.css, apps/desktop/src/features/premium-operations.tsx, apps/desktop/src-tauri/src/account_sync.rs, apps/desktop/src-tauri/src/window.rs, apps/desktop/src-tauri/src/main.rs, apps/desktop/src-tauri/tauri.staging.conf.json, tests, and Phase 4 UAT artifacts.
