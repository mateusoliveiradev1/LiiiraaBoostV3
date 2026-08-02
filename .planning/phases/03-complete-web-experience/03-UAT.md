---
status: diagnosed
phase: 03-complete-web-experience
source: [03-VERIFICATION.md]
started: 2026-07-31T15:22:13-03:00
updated: 2026-08-02T01:13:09-03:00
---

# Phase 03 UAT

## Current Test

[testing complete — Plan 03-45 rejected; gaps remain open]

## Plan 03-45 Preflight

date: 2026-08-01T00:44:03-03:00
result: passed — automated stability only; human approval remains pending and every existing gap stays open.

| Command | Result |
| --- | --- |
| `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/accessibility-responsive.spec.ts` | PASS — 39 applicable tests passed, 312 project-matrix skips were expected; W01-W18 and G01-G07 replayed without update mode. |
| `rtk pnpm --filter @liiiraa/web build` | PASS — optimized Next.js webpack build and TypeScript completed. |
| `rtk pnpm --filter @liiiraa/account build` | PASS — isolated account build and TypeScript completed. |
| `rtk pnpm --filter @liiiraa/admin build` | PASS — isolated admin build and TypeScript completed. |
| `rtk pnpm test` | PASS — Turbo completed 49/49 workspace tasks. |
| `rtk pnpm --filter @liiiraa/admin exec vitest run src/admin-security.test.ts` | PASS — 13/13 admin boundary tests; document navigation remains localized HTML while bounded JSON is reserved for programmatic requests. |

## Plan 03-45 Preflight — Post-03-52

date: 2026-08-01T03:59:33-03:00
result: passed — automated stability only; human approval remains pending and every existing gap stays open.

| Command | Result |
| --- | --- |
| `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/accessibility-responsive.spec.ts` | PASS — 41 applicable tests passed and 328 project-matrix skips were expected; no update mode was used, and all 25 W01-W18/G01-G07 PNGs were confirmed present and non-empty. |
| `rtk pnpm --filter @liiiraa/web build` | PASS — optimized Next.js webpack build and TypeScript completed. |
| `rtk pnpm --filter @liiiraa/account build` | PASS — isolated account build and TypeScript completed. |
| `rtk pnpm --filter @liiiraa/admin build` | PASS — isolated admin build and TypeScript completed. |
| `rtk pnpm test` | PASS — Turbo completed 49/49 workspace tasks; 46 were served from cache. |

## Plan 03-45 Human Review Verdict

date: 2026-08-01T00:52:41-03:00
verdict: rejected — no W01-W18 or G01-G07 visual approval was granted; Plan 03-46 remains blocked.
reported: "ainda nao ficou legal nao nao tem cara de web app forte navegaçao ruim na troca de idioma tem q ser a bandeira e tals na area logada tbm tem q ser melhor e tals"
runtime_reported: "Console Error: eval() is not supported in this environment... React requires eval() in development mode... Next.js 16.2.12 (Turbopack)"

The clean preflight proves deterministic rendering and regression stability only. The reviewer explicitly rejected the qualitative result and reported these unresolved defects:

1. Public, account, and admin still lack one strong, authored Liiiraa Boost web-application identity.
2. Navigation is weak across the three surfaces; account/admin mobile navigation is especially poor and overlong instead of collapsing into a task-oriented pattern.
3. The locale switcher must preserve the current route and visibly combine a flag with the language label. The accessible name must contain language text because a flag alone is insufficient.
4. Logged-in account/admin surfaces need a stronger premium application shell, clearer hierarchy, useful density, and task-oriented navigation.
5. Development CSP conflicts with React/Next 16 Turbopack's eval-based debugging. Any `unsafe-eval` allowance must be development-only; production CSP must remain strict, and automated tests must prove the split.

## Plan 03-45 Human Review Verdict — Post-03-52

date: 2026-08-01T07:46:14-03:00
verdict: rejected — none of W01-W18 or G01-G07 received human visual approval; Plan 03-46 remains blocked and every existing visual gap stays failed.
reported: "gostei ainda nao olha https://app.bravoboost.com.br/ como e bem mais bonito td"
qualitative_reference: `https://app.bravoboost.com.br/` is a user-named reference for stronger overall beauty, finish, and composition only. It must inform the quality bar without copying its layout, branding, assets, wording, or proprietary expression.

## Plan 03-45 Human Review Verdict — Post-03-66

date: 2026-08-02T01:13:09-03:00
verdict: rejected — the reviewer supplied five screenshots and explicitly rejected the packet. None of W01-W18 or G01-G07 is approved; no publication authority exists and Plan 03-46 remains blocked.
scope: all 25 candidates are rejected as one review set. The screenshots specifically expose a catastrophic public landing failure, and that false-negative is sufficient to invalidate confidence in the shared visual/capture gate even though the reviewer did not cite individual account or admin pixels.
approval_boundary: `humanApproved`, `publicationApproved`, manifest approval state, screenshot bytes, and publication artifacts remain unchanged.

### Failure Classes

| Class | Severity | Human evidence |
| --- | --- | --- |
| Public stylesheet/composition parity | blocking | The shared header remains visibly styled while the authored landing composition appears absent or collapsed. The hero reads as raw, left-aligned, default-sized content without the intended measure, spacing, or focal geometry. |
| Header/full-page capture contamination | blocking | The sticky header duplicates or overlaps content during the long capture instead of remaining one stable, non-obstructing shell. |
| Product staging and narrative hierarchy | blocking | The desktop screenshot is pasted nearly full-viewport as a raw artifact, repeats later, and does not behave as one authored proof stage inside a coherent landing narrative. |
| Rhythm, disclosure, and content formatting | major | Long sparse ruled sections, very large dead regions, raw disclosure markers, collapsed label/value pairs such as `CompatívelA análise...`, and a plain unfinished footer/content treatment make the page read as broken documentation rather than a finished product. |
| Locale-control coherence | major | English locale UI is duplicated in `us English`-style output instead of one clear route-preserving flag-plus-language control. |
| Qualitative gate false negative | blocking | Plans 03-63 through 03-66 passed the same set that the human screenshots expose as systemically broken. Pixel stability, hashes, accessibility, and agent inspection did not prove runtime stylesheet parity or finished visual composition. |
| Cross-surface approval integrity | blocking | Because the shared review gate missed the public failure, account and admin cannot inherit approval from their prior non-human PASS records; all 25 identities require renewed human review after gate repair. |

### Mandatory Correction Route Before Any Re-capture

1. **Public source/style owner (`apps/web`)** — reproduce every reviewer screenshot at the same route, viewport, runtime mode, and source revision. Compare loaded CSS chunks, import order, DOM class bindings, computed styles, and bounding boxes for `public-header`, `home-ignition-hero`, `home-prepare-band`, `home-context-stage`, `home-compatibility-field`, and `home-release-ribbon`. Distinguish a source composition defect from stylesheet delivery/hydration/capture mismatch before changing pixels.
2. **Public composition owner (`apps/web/src/features/home.tsx`, `apps/web/src/app/public-shell.css`, `apps/web/src/styles/public.css`)** — correct hero measure/alignment/spacing, product-stage scale and repetition, section rhythm, label/value gaps, disclosure treatment, footer finish, and full-page sticky-header behavior. The product artifact must be staged as proof, not pasted as an uncontrolled raw viewport.
3. **Locale/shared-control owner (`apps/web/src/public-navigation.tsx`, `@liiiraa/web-features`)** — reproduce and remove duplicate `us English`-style output while preserving one visible flag-plus-language label, an explicit accessible language name, and the current route.
4. **Capture-parity owner (`tooling/web-evidence`)** — add fail-closed computed-style and geometry sentinels that fail if the authored landing stylesheet is absent, selectors fall back, header instances overlap, labels collapse, locale text duplicates, or the product stage becomes uncontrolled. Prove these sentinels fail against an intentionally missing/disabled authorial stylesheet.
5. **Inspection owners (03-63/64/65 and 03-66)** — treat their prior PASS records as non-human historical results only. After source and gate repair, inspect public/account/admin at original resolution again and confirm runtime/capture parity; do not infer an account/admin pixel defect that the reviewer did not name.
6. **Sequence owner** — do not run Plan 03-62 capture yet. First complete the root-cause investigation and gate-hardening work, then run the full `03-61 -> 03-62 -> 03-63/64/65 -> 03-66 -> 03-45` chain. Plan 03-46 stays blocked until a later literal `approved` response covers all 25 identities.

## Tests

### 1. Cross-surface visual polish and desktop consistency

expected: Public, account, and admin goldens in both locales have coherent branding, clear hierarchy/readability, and distinctive non-template visual quality when compared with the approved Phase 2 desktop captures.
result: issue
reported: "nao gostei de nenhum dos 3 viu"; follow-up: "ainda nao ficou legal nao nao tem cara de web app forte"
severity: major

### 2. Cross-surface navigation, locale switching, and authenticated shells

expected: Public, account, and admin provide clear current-location and task-oriented navigation; mobile account/admin navigation collapses without an overlong route list; locale switching preserves the current route and exposes a visible flag plus language label with an accessible textual name; logged-in shells feel like premium applications with deliberate hierarchy and useful density.
result: issue
reported: "navegaçao ruim na troca de idioma tem q ser a bandeira e tals na area logada tbm tem q ser melhor e tals"
severity: major

### 3. React/Next development CSP compatibility

expected: Next.js 16.2.12 development under Turbopack supports React's eval-based debugging without console failures, while production responses never allow `unsafe-eval`; tests prove the environment-specific CSP split.
result: issue
reported: "Console Error: eval() is not supported in this environment... React requires eval() in development mode... Next.js 16.2.12 (Turbopack)"
severity: major

## Summary

total: 3
passed: 0
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The public Home presents a premium, focused Liiiraa Boost story coherent with the approved desktop product, without exposing internal boundary or evidence metadata as primary interface copy."
  status: failed
  reason: "The reviewer first reported `nao gostei de nenhum dos 3 viu` and, after the 03-38 through 03-44 gap work, explicitly rejected the refreshed result again: `ainda nao ficou legal nao nao tem cara de web app forte`. The public surface still lacks a strong authored web-app identity and its navigation/locale control do not provide the expected product-grade orientation."
  severity: major
  test: 1
  root_cause: "The refreshed public composition is deterministic but still fails the human quality contract: shell, hierarchy, and navigation read as a collection of web pages rather than one authored Liiiraa Boost application. The locale affordance changes language without the required route-preserving, visible flag-plus-label control, and pixel stability cannot certify identity or navigation quality."
  artifacts:
    - path: "apps/web/src/styles/public.css"
      issue: "Off-scale hero typography, oversized spacing, and excessive vertical rhythm create the sparse composition."
    - path: "apps/web/src/app/[locale]/layout.tsx"
      issue: "The shell permanently exposes the internal PUBLIC boundary and placeholder LB branding."
    - path: "apps/web/src/features/home.tsx"
      issue: "The Home duplicates trust messaging and prints raw capture provenance beside the hero artifact."
    - path: "tooling/web-evidence/tests/accessibility-responsive.spec.ts"
      issue: "Screenshot stability is checked against the rejected composition without an explicit quality approval gate."
  missing:
    - "Recompose the public Home around canonical scale, tighter pacing, the approved brand lockup, and a dominant real desktop artifact."
    - "Move origin and capture metadata into contextual disclosure while keeping truthful evidence accessible."
    - "Extend visual gates to app-local CSS and require named human approval for refreshed goldens."
    - "Create a strong authored public application shell with clear current-location and task-oriented navigation."
    - "Replace the locale link with a current-route-preserving control that shows a flag plus language label and retains an explicit accessible text name."
  debug_session: ".planning/debug/phase-03-public-visual-polish.md"

- truth: "The account surface feels like a finished premium product shell with strong task hierarchy, useful density, and a quiet but persistent simulated-authority boundary."
  status: failed
  reason: "The reviewer first reported `nao gostei de nenhum dos 3 viu` and explicitly rejected the refreshed account result again: `navegaçao ruim ... na area logada tbm tem q ser melhor`. The logged-in shell still lacks premium application hierarchy and useful density; navigation remains weak, and the mobile route list is especially poor and overlong."
  severity: major
  test: 1
  root_cause: "The account shell remains route-list-first instead of task-first. At narrow widths its navigation expands into a long wrapped/full-width list rather than a compact disclosure pattern, while the locale link targets a surface default instead of preserving the active responsibility route. The content shell still lacks enough hierarchy, density, and task context to read as a premium logged-in application."
  artifacts:
    - path: "apps/account/src/features/account-preview.tsx"
      issue: "Route compositions are skeletal and repeat provenance at route and field level."
    - path: "apps/account/src/app/[locale]/layout.tsx"
      issue: "Authority messaging is repeated and navigation lacks an explicit current-route cue."
    - path: "apps/account/src/app/account-shell.css"
      issue: "The main workspace is unconstrained and lacks authored wide-screen grouping."
    - path: "tooling/web-evidence/visual-manifest.json"
      issue: "Visual coverage represents only account overview and does not gate Profile or responsibility-route polish."
  missing:
    - "Create a constrained, authored product workspace with active navigation, focal identity/task regions, and route-specific density."
    - "Consolidate preview messaging into one quiet persistent boundary, repeated only for sensitive review and receipts."
    - "Add neutral-state goldens for Profile and representative responsibility routes with hierarchy and density review gates."
    - "Replace the overlong mobile route list with a compact accessible navigation disclosure that preserves current-location context."
    - "Make the locale control preserve the active account route and show a flag plus language label with explicit accessible text."
  debug_session: ".planning/debug/phase-03-account-visual-polish.md"

- truth: "The admin origin renders a designed, localized premium administration shell or authored access state instead of exposing raw transport data."
  status: failed
  reason: "The reviewer first reported `nao gostei de nenhum dos 3 viu` and explicitly rejected the refreshed admin result again: `navegaçao ruim ... na area logada tbm tem q ser melhor`. Even after the origin/access-state corrections, the authenticated admin shell still lacks a strong premium application identity, task hierarchy, useful density, and compact mobile navigation."
  severity: major
  test: 1
  root_cause: "The origin/access-state defect was addressed by the preceding gap plans, but the qualitative shell remains unresolved. Admin navigation is still presented as a broad route inventory instead of a role/task-oriented workflow, its narrow-screen form becomes overlong, and locale switching returns to a role landing rather than preserving the active workspace. Automated goldens prove stability, not premium operational coherence."
  artifacts:
    - path: "apps/admin/proxy.ts"
      issue: "Exact origin enforcement rejects the generic localhost UAT origin before the authored application route can render."
    - path: "apps/admin/src/admin-runtime.ts"
      issue: "The default dedicated admin origin is not aligned with the generic local launch used for visual review."
    - path: "apps/admin/package.json"
      issue: "The ordinary dev command does not configure the dedicated UAT hostname/origin contract."
    - path: "apps/admin/src/features/admin-preview.tsx"
      issue: "The role landing and operational workspaces are sparse and expose internal route-manifest language."
  missing:
    - "Align local/UAT launch and navigation with one declared dedicated admin origin and the canonical /[locale]/admin route."
    - "Preserve fail-closed security while rendering an authored localized access-denied document for browser navigation."
    - "Redesign and re-baseline the role landing and representative workspaces against the approved desktop visual contract."
    - "Replace the overlong mobile admin route list with a compact accessible role/task navigation pattern."
    - "Make the locale control preserve the active admin workspace and show a flag plus language label with explicit accessible text."
  debug_session: ".planning/debug/phase-03-admin-root-interface.md"

- truth: "Development CSP supports React and Next.js 16.2.12 Turbopack debugging without weakening the production security boundary."
  status: failed
  reason: "The reviewer reported `Console Error: eval() is not supported in this environment... React requires eval() in development mode... Next.js 16.2.12 (Turbopack)`. The current development policy blocks React's eval-based debugging path, so the review environment is not clean even though production must continue to reject eval."
  severity: major
  test: 3
  root_cause: "CSP construction is not split by runtime mode for the Next development toolchain. Public headers and the account/admin nonce policies omit `unsafe-eval` unconditionally, which is appropriate for production but conflicts with the reported React/Turbopack development behavior."
  artifacts:
    - path: "apps/web/next.config.ts"
      issue: "Public CSP directives do not expose a tested development-only script policy."
    - path: "apps/account/proxy.ts"
      issue: "Account nonce CSP is strict in every mode and needs an explicit, tested development-only branch if this surface reproduces the error."
    - path: "apps/admin/proxy.ts"
      issue: "Admin nonce CSP is strict in every mode and needs an explicit, tested development-only branch if this surface reproduces the error."
  missing:
    - "Reproduce and identify every affected Next development surface under Turbopack."
    - "Allow `unsafe-eval` only in development CSP where React debugging requires it; never emit it in production."
    - "Add tests that assert the development allowance and the production prohibition independently for public, account, and admin."
  debug_session: ".planning/debug/phase-03-development-csp-turbopack.md"
