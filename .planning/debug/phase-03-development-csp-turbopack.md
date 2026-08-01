---
status: reported
trigger: "Plan 03-45 human review reported a Next.js 16.2.12 Turbopack console error because React development debugging requires eval while the active CSP rejects it."
created: 2026-08-01T00:52:41-03:00
updated: 2026-08-01T00:52:41-03:00
---

## Current Focus

hypothesis: The Next development environment receives the same strict no-eval script policy intended for production, conflicting with React/Turbopack's development-only debugging path.
test: Pending the next gap-planning/debug round; this checkpoint continuation records the reported defect without changing runtime policy.
expecting: Reproduction should identify the affected public/account/admin surfaces and confirm that a development-only `unsafe-eval` allowance clears the console error while production responses continue to omit it.
next_action: Reproduce by surface, implement an explicit environment split, and add independent development/production CSP tests. Never add `unsafe-eval` to production.

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

## Resolution

root_cause: Pending direct reproduction. The leading evidence points to production-strength no-eval CSP being applied to a React/Next Turbopack development path that requires eval for debugging.
fix: Not applied at the rejected human-verification checkpoint. The permitted direction is an explicit development-only allowance, with production remaining strict.
verification: Pending. Required proof is a clean Turbopack development console plus tests demonstrating `unsafe-eval` is present only in development and absent in production for every affected surface.
files_changed: []
