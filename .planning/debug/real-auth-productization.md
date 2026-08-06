---
status: resolved
trigger: 'User reports that the deployed Admin is an unacceptable raw technical panel, the desktop remains mocked and has no new authenticated EXE, invite links are not available for future friends, and the account creation screen is visually poor with weak validation and an opaque missing-invite error.'
created: 2026-08-06T01:30:00-03:00
updated: 2026-08-06T02:24:00-03:00
---

## Symptoms

expected: A finished role-scoped Admin product, a packaged desktop using real system-browser authentication and persistence, protected per-person invitation links for later testers, and a polished account creation flow with immediate visible validation and clear invitation recovery.
actual: Production Admin renders raw session UUID rows and a native gray break-glass button; no new real-auth desktop installer exists; direct signup without a token shows a generic blocking alert; signup hierarchy and validation feedback look unfinished.
errors: Account creation shows “Abra o link completo do convite para criar esta conta.” without explaining where the invitation comes from or preventing users from entering an unusable form.
timeline: Present in the current Phase 4 staging deployment; the production adapters were connected after the earlier simulated visual milestone.
reproduction: Sign into /pt-BR/admin with the Security account; open /pt-BR/cadastro without an invitation token; launch the current desktop build.

## Current Focus

hypothesis: Confirmed. The production compositions exposed authority data without a finished product shell, registration admitted a missing invitation into the form, and the packaged desktop did not carry its real runtime origins.
test: Account/Admin/web suites, Rust suites, visual browser captures, route/evidence gates, production builds, and staging-configured NSIS packaging.
expecting: Real authentication remains fail-closed, public login lands in Account, administrative access is an explicit separate gateway, registration without an invitation has no form, and packaged desktop has no demonstration escape hatch.
next_action: Publish the reviewed commit to staging and execute human UAT without closing Phase 4.

## Evidence

- timestamp: 2026-08-06T01:30:00-03:00
  observation: User screenshots show raw production authority rows/buttons and a signup form that remains interactive despite a missing invitation token.
  implication: Authentication authority works, but productization and state design are incomplete.
- timestamp: 2026-08-06T01:46:00-03:00
  observation: Focused RED tests fail because the invitation-required state, account-to-admin gateway, production Admin shell, real-only desktop login, and packaged account origin do not exist.
  implication: The reported problem is reproducible in composition and packaging, not only visual preference.
- timestamp: 2026-08-06T02:24:00-03:00
  observation: Account and Admin each pass 90 tests; the web matrix passes 20 tasks including 183 evidence tests; Rust passes 67 tests; visual inspection confirms the closed-beta, login, and isolated-admin states; the staging NSIS bundle completes successfully.
  implication: The product behavior is implemented and buildable; staging publication and owner UAT remain the release gate.

## Eliminated

- A sleeping Render service was not the source of the mock identity: production renderer composition was substituting local content when transport was unavailable.
- The `/pt-BR/cadastro` failure was not a Vercel locale problem: the canonical route generator still emitted `/pt-BR/register`.
- Admin build failure without origins is intentional fail-closed behavior; a direct build with the real staging origins passes.

## Resolution

root_cause: Production auth routes inherited demonstrative presentation assumptions, PT-BR registration had no localized canonical path, Admin projected raw adapter records, and desktop runtime origins were read from the launching terminal instead of the packaged Tauri configuration.
fix: Added invitation-only registration UX and validation, localized `/pt-BR/cadastro`, explicit Account-to-Admin role gateway, finished role-scoped Admin shell/logout, real-only system-browser desktop auth with identity projection, and packaged staging origins.
verification: Account 90/90; Admin 90/90; web task matrix 20/20 with evidence 183/183 (one intentional skip); Rust 67/67; TypeScript checks pass; Account/Admin/Desktop production builds pass with required runtime config; Impeccable detector reports zero findings; NSIS staging bundle generated.
files_changed: Account auth/navigation/routing/styles; Admin authority shell/styles; desktop authority/runtime/Rust packaging; localized route contracts/tests; route evidence bindings.
