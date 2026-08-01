---
status: resolved
trigger: "Plan 03-45 human review reported a Next.js 16.2.12 Turbopack console error because React development debugging requires eval while the active CSP rejects it."
created: 2026-08-01T00:52:41-03:00
updated: 2026-08-01T01:32:05-03:00
---

## Current Focus

hypothesis: Confirmed. Public, account, and admin applied production-strength no-eval CSP to React/Next development paths that require eval-based debugging under Turbopack.
test: Independent public, account, and admin mode matrices now construct development, production, and test CSP without mutating ambient module state.
expecting: Development contains `unsafe-eval` exactly once beside the existing script contract; production, test, report-only, and authored admin denial policies omit it.
next_action: Resolved. Retain the exact-development comparison and the three focused CSP suites as WEB-08 regression gates.

## Symptoms

expected: Next.js 16.2.12 development under Turbopack runs React debugging without CSP console errors; production remains strict and rejects eval.
actual: Reviewer reported: `Console Error: eval() is not supported in this environment... React requires eval() in development mode... Next.js 16.2.12 (Turbopack)`.
errors: Development console reports that eval is unavailable while React development mode requires it.
reproduction: Exact surface and route were not included in the reviewer report and must be established in the next debug round.
started: Reported during Plan 03-45 human visual review on 2026-08-01.

## Evidence

- timestamp: 2026-08-01T00:52:41-03:00
  checked: Reviewer signal at the Plan 03-45 blocking checkpoint.
  found: The console explicitly identifies the React development eval requirement and Next.js 16.2.12 Turbopack environment.
  implication: The review environment has a real runtime-policy incompatibility even though automated preflight remained green.

- timestamp: 2026-08-01T00:52:41-03:00
  checked: `apps/web/next.config.ts`, `apps/account/proxy.ts`, and `apps/admin/proxy.ts` CSP construction.
  found: Current script policies are strict and omit `unsafe-eval`; no tested development-only branch was found in the policy declarations.
  implication: A mode-insensitive CSP is the leading hypothesis, but each surface still requires direct reproduction before assigning the exact owner.

- timestamp: 2026-08-01T01:32:05-03:00
  checked: Independent RED/GREEN mode matrices in `public-shell.test.ts`, `account-security.test.ts`, and `admin-security.test.ts`.
  found: Each development assertion failed before its production change and passed afterward; production/test policies omit `unsafe-eval`, nonces and `strict-dynamic` remain intact, and admin denials remain strict.
  implication: The incompatibility was the shared mode-insensitive policy shape, not a need to weaken any production or denial response.

- timestamp: 2026-08-01T01:32:05-03:00
  checked: Focused security suites and optimized production builds for `@liiiraa/web`, `@liiiraa/account`, and `@liiiraa/admin`.
  found: All 27 focused CSP/security assertions passed and all three Next.js 16.2.12 production builds completed successfully.
  implication: Development compatibility is restored without changing the production no-eval, origin, cookie, framing, indexing, safe-context, or denial boundaries.

## Resolution

root_cause: Public, account, and admin CSP builders were mode-insensitive, so React/Next Turbopack development received the same no-eval policy intended for optimized production responses.
fix: Added explicit pure runtime-mode inputs to the three independent CSP/header builders. Exact `development` appends one `unsafe-eval` token; production and test remain strict, report-only stays unchanged, and authored admin denials always use the strict contract.
verification: Independent RED/GREEN suites passed for all three surfaces, followed by successful optimized builds for `@liiiraa/web`, `@liiiraa/account`, and `@liiiraa/admin`.
files_changed:
  - apps/web/next.config.ts
  - apps/web/src/public-shell.test.ts
  - apps/account/proxy.ts
  - apps/account/src/account-security.test.ts
  - apps/admin/proxy.ts
  - apps/admin/src/admin-security.test.ts
