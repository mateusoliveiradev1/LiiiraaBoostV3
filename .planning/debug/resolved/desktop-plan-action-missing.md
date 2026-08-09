---
status: resolved
trigger: 'criou logou e tals mais cade dar para podeer trocar de plano e tals'
created: 2026-08-09T06:00:00-03:00
updated: 2026-08-09T06:45:00-03:00
---

## Symptoms

- expected: A signed-in Free user can clearly choose Premium or manage the current subscription from the desktop Plan area.
- actual: The authoritative desktop Plan area only displays the current plan, entitlements, and server facts; it has no actionable plan-management control.
- errors: No runtime error is shown; the product action is absent.
- reproduction: Create and sign in to a real invited Free account, open the desktop profile, and select the Plan tab.

## Current Focus

- hypothesis: Confirmed. The simulated desktop plan view retained illustrative plan controls, while the production authoritative branch was intentionally reduced to a read-only projection and never received a secure handoff to the real Account/Stripe subscription route.
- test: Focused TypeScript and Rust unit tests, desktop TypeScript/ESLint/format gates, internal Vite build, Playwright authority/viewport checks, and a staging Tauri bundle.
- expecting: Free users see a clear action to view plans and subscribe; Stripe subscribers see a manage-subscription action; the desktop opens only the configured HTTPS Account subscription route in the system browser.
- next_action: None. The owner confirmed the installed Free-to-plan-management flow is correct.

## Evidence

- timestamp: 2026-08-09T06:00:00-03:00
  checked: User screenshot after successful real invited signup and desktop login.
  found: The account projection is online and correctly reports Free, but the Plan route contains no checkout or plan-management action.
  implication: Identity and subscription projection work; the missing behavior is in production desktop presentation/handoff.

- timestamp: 2026-08-09T06:00:00-03:00
  checked: Desktop and Account subscription implementations.
  found: The simulated desktop view contains illustrative plan cards, the production authoritative branch is read-only, and the Account web surface already owns real Stripe checkout and billing-portal flows.
  implication: Do not duplicate payment inside Tauri; add a narrowly allowlisted system-browser handoff to the live Account subscription route.

- timestamp: 2026-08-09T06:38:00-03:00
  checked: TDD and security-boundary regression suite.
  found: The new tests first failed because the method and CTA did not exist, then passed after implementation. Rust rejects HTTP, configured origins containing paths or userinfo, unsupported locales, and any renderer-supplied destination.
  implication: The WebView can request only the configured Account subscription route for the current supported locale.

- timestamp: 2026-08-09T06:38:00-03:00
  checked: Desktop typecheck, ESLint, formatting, 23 focused TypeScript tests, 12 Rust identity tests, two Playwright authority checks, internal Vite build, viewport screenshots, and staging NSIS packaging.
  found: All checks pass and the revised Plan composition remains within the supported viewport. One staging x64 installer was produced.
  implication: The change is ready for exact-package human verification.

- timestamp: 2026-08-09T06:45:00-03:00
  checked: Owner verification on the installed package built from commit f1ae8b1.
  found: The owner reported that the plan-management flow is now correct.
  implication: The missing production action is resolved end to end.

## Resolution

- root_cause: The production authoritative desktop Plan branch rendered subscription truth but omitted the secure browser handoff already used by the real Account Stripe surface.
- fix: Add a locale-bound native command that constructs the canonical Account subscription URL from trusted runtime configuration, expose it through the account authority, and render a responsive Free/Premium plan-management callout with failure feedback.
- verification: Automated TypeScript, Rust, Playwright, build, and packaging checks pass; the owner confirmed the exact installed flow.
- files_changed:
  - apps/desktop/src/account-authority.ts
  - apps/desktop/src/account-authority.test.ts
  - apps/desktop/src/features/account-experience.tsx
  - apps/desktop/src/features/account-experience.test.ts
  - apps/desktop/src/profile-experience.css
  - apps/desktop/tests/browser/account-authority.spec.ts
  - apps/desktop/src-tauri/src/identity.rs
  - apps/desktop/src-tauri/src/main.rs
  - apps/desktop/src-tauri/tests/identity.rs
