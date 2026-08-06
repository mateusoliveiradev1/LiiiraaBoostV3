---
status: investigating
trigger: 'Owner UAT reports desktop login state is lost after app restart, logout fails, Account/Admin navigation flashes and temporarily loses session, desktop browser callback is unfinished, and Premium/Free entitlement labels conflict.'
created: 2026-08-06T03:00:00-03:00
updated: 2026-08-06T04:39:00-03:00
---

## Symptoms

expected: Desktop remains authenticated after closing and reopening; logout reliably revokes the correct surface; Account/Admin navigation preserves valid session state without full-page flashes; desktop callback shows a polished success handoff; the owner account has one authoritative permanent Premium entitlement everywhere.
actual: Reopening the desktop returns to login; Admin logout reports failure; opening Portal da conta initially renders Sessão necessária before later showing the account; interactions visibly reload; loopback callback shows raw English text; desktop header says Premium while Account and desktop account details say Free.
errors: Admin displays “Não foi possível encerrar a sessão administrativa. Tente novamente.” No explicit desktop persistence error is shown.
timeline: Reproduced in owner UAT immediately after the 2026-08-06 staging authentication deployment; authentication succeeds during the initial process lifetime.
reproduction: Authenticate from the desktop through the system browser, return to the app, close and reopen it; use Admin logout and Portal da conta; navigate desktop account tabs and compare entitlement labels.

## Current Focus

hypothesis: The remaining UAT defects came from three missing boundaries: signup discarded the desktop authorization challenge, Admin session ownership lived in route pages instead of the persistent layout, and the shared account contract omitted the database-backed administrative role.
test: Preserve and approve desktop authorization through signup, render a success handoff, move Admin authority to a layout provider, project the administrative role through generated contracts, and run complete affected test/build/package gates.
expecting: Signup returns automatically to the authenticated desktop, Admin route changes retain the verified shell without a signed-out flash, and Premium/Administrator/Security render from the same PostgreSQL projection on every surface.
next_action: Push the verified commit, wait for Vercel and Render deployments, then repeat owner UAT with the 0.0.1 NSIS installer.

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

## Eliminated

- hypothesis: The browser authorization itself is wholly broken.
  reason: The owner successfully completed browser login and reached an authenticated desktop state during the same process lifetime.

## Resolution

root_cause:
fix:
verification:
files_changed:
