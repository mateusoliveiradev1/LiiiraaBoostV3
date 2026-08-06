---
status: investigating
trigger: 'User reports that the deployed Admin is an unacceptable raw technical panel, the desktop remains mocked and has no new authenticated EXE, invite links are not available for future friends, and the account creation screen is visually poor with weak validation and an opaque missing-invite error.'
created: 2026-08-06T01:30:00-03:00
updated: 2026-08-06T01:46:00-03:00
---

## Symptoms

expected: A finished role-scoped Admin product, a packaged desktop using real system-browser authentication and persistence, protected per-person invitation links for later testers, and a polished account creation flow with immediate visible validation and clear invitation recovery.
actual: Production Admin renders raw session UUID rows and a native gray break-glass button; no new real-auth desktop installer exists; direct signup without a token shows a generic blocking alert; signup hierarchy and validation feedback look unfinished.
errors: Account creation shows “Abra o link completo do convite para criar esta conta.” without explaining where the invitation comes from or preventing users from entering an unusable form.
timeline: Present in the current Phase 4 staging deployment; the production adapters were connected after the earlier simulated visual milestone.
reproduction: Sign into /pt-BR/admin with the Security account; open /pt-BR/cadastro without an invitation token; launch the current desktop build.

## Current Focus

hypothesis: Production composition bypasses the previously polished preview shells, exposes generic adapter records directly, and the desktop package still gates real auth behind a production Tauri transport/build path that has not been rebuilt for the current staging revision.
test: Run the focused account, admin, desktop renderer, and packaged-runtime regression tests.
expecting: Each test fails on the observed unfinished production behavior before implementation changes.
next_action: Implement the invitation gate and role gateway, then rebuild the Admin shell and packaged desktop runtime configuration.

## Evidence

- timestamp: 2026-08-06T01:30:00-03:00
  observation: User screenshots show raw production authority rows/buttons and a signup form that remains interactive despite a missing invitation token.
  implication: Authentication authority works, but productization and state design are incomplete.
- timestamp: 2026-08-06T01:46:00-03:00
  observation: Focused RED tests fail because the invitation-required state, account-to-admin gateway, production Admin shell, real-only desktop login, and packaged account origin do not exist.
  implication: The reported problem is reproducible in composition and packaging, not only visual preference.

## Eliminated

None yet.

## Resolution

root_cause: pending
fix: pending
verification: pending
files_changed: pending
