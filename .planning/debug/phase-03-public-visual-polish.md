---
status: investigating
trigger: "Phase 03 UAT public visual gap: user said `nao gostei de nenhum dos 3 viu`; public Home exposes boundary/evidence metadata and has an oversized, awkward hero with weak pacing."
created: 2026-07-31T19:28:32.0992839-03:00
updated: 2026-08-02T01:13:09-03:00
---

## Current Focus

hypothesis: INVESTIGATING — the reviewer runtime and the passing candidate pixels do not share the same effective authored landing composition. The differential may be stylesheet delivery/import order, selector/class binding, runtime hydration, or full-page capture behavior; it is not yet safe to call any one cause confirmed.
test: Reproduce the five reviewer screenshots at identical routes, viewports, runtime mode, and source revision; compare loaded CSS chunks, DOM classes, computed styles, and boxes for the header, hero, product stages, sequence, compatibility rows, disclosures, locale control, and footer.
expecting: The investigation must explain why shell styling can remain visible while the landing collapses, why the sticky header duplicates/overlaps in a long capture, and why the existing automated/inspection gates accepted the mismatched result.
next_action: Complete the public source/style and capture-parity investigation, harden computed-style/geometry gates with a deliberate missing-stylesheet negative test, and only then authorize a new 03-61 through 03-62 cycle.

## Plan 03-45 Follow-up Rejection

reported: "ainda nao ficou legal nao nao tem cara de web app forte navegaçao ruim na troca de idioma tem q ser a bandeira e tals"
verdict: Rejected after the clean 03-45 preflight. The public shell still lacks a strong authored web-app identity, navigation remains weak, and the locale control must preserve the current route while showing a visible flag plus language label with an explicit accessible text name.
impact: The visual gap remains failed, no W01-W18/G01-G07 approval exists, and Plan 03-46 stays blocked.

## Plan 03-45 Post-03-52 Rejection

reported: "gostei ainda nao olha https://app.bravoboost.com.br/ como e bem mais bonito td"
verdict: Rejected after the post-03-52 preflight. None of W01-W18 or G01-G07 is human-approved.
qualitative_reference: `https://app.bravoboost.com.br/` is the user-named reference for a materially stronger level of overall beauty, finish, and composition. Use it only to calibrate the quality bar; do not copy its layout, branding, assets, wording, or proprietary expression.
impact: The public visual gap remains failed and Plan 03-46 remains blocked despite deterministic tests and stable captures.

## Plan 03-45 Post-03-66 Human Rejection

verdict: REJECTED — five reviewer screenshots expose a catastrophically collapsed public landing. All W01-W18/G01-G07 remain unapproved and Plan 03-46 stays blocked.
observed: The header retains recognizable shell styling, but the authored landing appears absent/collapsed: raw left-aligned/default-sized hero, no coherent width or spacing, duplicated/overlapping sticky header in the long capture, uncontrolled and repeated desktop artifact, sparse ruled text with dead space, raw disclosure markers, collapsed label/value gaps, unfinished footer/content, and duplicated English locale output.
gate_failure: The 03-63 and 03-66 PASS records are historical non-human results only. They did not prove that the reviewer runtime and captured runtime loaded the same effective authorial CSS or that full-page capture preserved valid composition.
investigation_owners:
  - "apps/web: isolate stylesheet delivery/import/class/computed-style parity and repair composition only after the cause is reproducible."
  - "public shell and locale controls: remove sticky overlap and duplicated locale presentation while preserving accessibility and route state."
  - "tooling/web-evidence: add missing-style negative coverage plus computed-style, bounding-box, label-gap, locale uniqueness, and header-overlap sentinels."
recapture_gate: No Plan 03-62 capture before the investigations and negative gate proof pass.

## Symptoms

expected: Public/account/admin goldens share coherent branding, hierarchy/readability, and distinctive non-template quality. The public Home presents a premium, focused Liiiraa Boost story coherent with the approved desktop product, without exposing internal boundary or evidence metadata as primary interface copy.
actual: User said verbatim `nao gostei de nenhum dos 3 viu`. Screenshot `C:/Users/Liiiraa/AppData/Local/Temp/codex-clipboard-c29f633f-0107-4479-905e-64b6d406ff9f.png` shows oversized awkward hero, weak pacing/unused space, PUBLIC boundary rail, and raw capture provenance competing with product story.
errors: Visual UAT rejection; no runtime error reported.
reproduction: Test 1 in `.planning/phases/03-complete-web-experience/03-UAT.md`.
started: Observed during Phase 03 UAT; prior accepted state not reported.

## Eliminated

- hypothesis: The awkward result is caused by a missing, invalid, or wrong desktop capture.
  evidence: Both sidecars are approved S01 1440x900 full-frame records with matching admitted assets; `data-capture-state` is CAPTURE_ADMITTED, the checked-in W01 golden and supplied screenshot both render the correct approved desktop Home.
  timestamp: 2026-07-31T19:31:43.2585471-03:00

- hypothesis: The supplied screenshot is distorted by browser chrome or a one-off local viewport problem.
  evidence: The chrome-free checked-in W01 1440x900 golden reproduces the same oversized hero, sparse pacing, PUBLIC rail, and inline provenance, so the composition is deterministic and baseline-approved.
  timestamp: 2026-07-31T19:31:43.2585471-03:00

## Evidence

- timestamp: 2026-07-31T19:31:43.2585471-03:00
  checked: `.planning/phases/03-complete-web-experience/03-UI-SPEC.md` typography, spacing, hero, screenshot, and stop conditions.
  found: The contract fixes display at 28px, permits only 4/8/16/24/32/48/64 spacing, says scale comes from composition/product artifact rather than a fifth text size, requires a 5/7 hero with the screenshot dominant, and requires design review for any fifth text size or off-scale spacing.
  implication: Oversized responsive type and arbitrary large spacing are direct contract violations, not subjective preference alone.

- timestamp: 2026-07-31T19:31:43.2585471-03:00
  checked: `apps/web/src/styles/public.css` Home rules.
  found: The Home overrides shared 28px display with `clamp(44px, 6vw, 88px)` and adds multiple 52/64/68px headings plus 80/96/112/144px spacing; the hero reserves at least 780px and later chapters use up to 96px padding per side.
  implication: Type dominates the screenshot and the repeated off-scale vertical padding creates the observed long empty pacing.

- timestamp: 2026-07-31T19:31:43.2585471-03:00
  checked: `packages/web-features/src/web.css` and the approved desktop capture.
  found: Shared web primitives and the desktop system use the canonical 13/15/20/28 hierarchy, while the app-local public override inflates only the marketing surface. The approved desktop image uses compact, information-rich hierarchy and a cyan angular brand lockup.
  implication: Visual continuity was broken at the app-level override even though both surfaces technically import the same token package.

- timestamp: 2026-07-31T19:31:43.2585471-03:00
  checked: `apps/web/src/app/[locale]/layout.tsx` and `apps/web/src/app/public-shell.css`.
  found: Every public page unconditionally renders a 36px `PUBLIC` boundary rail with internal origin/session/administration language, and the header substitutes a plain boxed `LB` mark for the desktop angular Liiiraa Boost lockup.
  implication: Internal architecture becomes persistent product copy and the shell reads as a separate placeholder brand rather than the approved desktop identity.

- timestamp: 2026-07-31T19:31:43.2585471-03:00
  checked: `apps/web/src/features/home.tsx`, public Home content, and shared `RealProductStage`/`ProvenanceLabel`.
  found: The hero repeats a second trust-boundary block; `resolveHomeProductCapture` formats scenario, viewport, and commit into a visible string; `RealProductStage` always renders it inline; and the provenance locale defaults to English, producing `Measured` beside PT-BR capture detail.
  implication: Safety/evidence implementation details compete with the product promise twice and create the raw mixed-language caption visible in the screenshot.

- timestamp: 2026-07-31T19:31:43.2585471-03:00
  checked: `apps/web/src/home.test.tsx` and `tooling/web-evidence/tests/public.spec.ts`.
  found: Tests require copy -> action -> boundary -> media order, explicitly require the public-boundary note to be visible, require six evidence-heavy chapters, and require the complete-screenshot link; they do not assert artifact dominance, readable rhythm, secondary/disclosed metadata, or absence of internal UI copy.
  implication: The tests encode the rejected hierarchy as correctness rather than protecting the intended product story.

- timestamp: 2026-07-31T19:31:43.2585471-03:00
  checked: `packages/web-features/src/components.test.tsx` visual contract gate.
  found: The approved token/anti-template test reads only `packages/web-features/src/web.css`; it never scans `apps/web/src/styles/public.css` or `apps/web/src/app/public-shell.css`, where the fifth sizes and off-scale spacing live.
  implication: App-local CSS can bypass the phase's claimed token compliance while the visual contract test stays green.

- timestamp: 2026-07-31T19:31:43.2585471-03:00
  checked: Golden screenshot suite, visual manifest/report, and `03-VERIFICATION.md`.
  found: Playwright compares W01 to an already checked-in golden containing the rejected composition; the report records 18 stable goldens and no update mode, while verification explicitly marked brand/product-register polish UNCERTAIN and deferred it to human review because stability and automated gates cannot certify polish.
  implication: The automated pipeline proved deterministic rendering, accessibility, and regression stability—not that the chosen baseline was premium, coherent, or approved by a human.

- timestamp: 2026-07-31T19:33:30.3783989-03:00
  checked: Focused current-source tests: `@liiiraa/web` Home/content/public-shell and `@liiiraa/web-features` visual contract.
  found: All 64 tests passed (37 web, 27 web-features) without changing source, despite the deterministic W01 golden visibly containing the rejected composition and the app CSS violating the locked scale.
  implication: This directly confirms a verification-coverage defect: green tests certify structure, data, accessibility primitives, and shared CSS only, not the public app's design-contract compliance or subjective approval.

## Resolution

root_cause: A layered design-contract enforcement failure. `apps/web/src/styles/public.css` overrides the canonical 13/15/20/28 typography and 4/8/16/24/32/48/64 spacing with 44–88px hero type, multiple 52–68px headings, 80–144px whitespace, a 780px hero floor, and repeated 96px chapter padding, making copy dominate the real artifact and producing weak pacing. `apps/web/src/app/[locale]/layout.tsx` persistently exposes an internal `PUBLIC` origin rail and a placeholder boxed-LB brand, while `apps/web/src/features/home.tsx` repeats a hero trust boundary and serializes S01/viewport/commit provenance into an always-visible, English-defaulted caption. Tests explicitly require boundary-before-media and the public rail, scan only shared `web.css` for token compliance, and compare W01 against an already-rejected checked-in baseline. Thus deterministic/accessibility gates stayed green while the app-level hierarchy, branding, copy prioritization, and human visual approval were never enforced.
fix: Plan 03-49 replaced the static route row with a canonical pathname-aware public navigation, one active task pillar per desktop/mobile projection, a compact native mobile disclosure, and a route-preserving flag-plus-language LocaleSwitcher. Home now uses the locked 5/7 Command Runway, keeps copy and compatibility first semantically and on mobile, gives the admitted desktop artifact wide-screen dominance, and replaces the six always-open metadata chapters with a three-step authored sequence plus contextual evidence disclosures. Distribution remains fail closed.
verification: `rtk pnpm --filter @liiiraa/web test -- --run` passed 60 tests, `rtk pnpm --filter @liiiraa/web check` passed, `rtk pnpm --filter @liiiraa/web build` completed the optimized production build, and the Impeccable detector reported no banned patterns in the modified public interface files. Human visual approval remains owned by the later visual evidence/UAT plan.
files_changed: [apps/web/src/app/[locale]/layout.tsx, apps/web/src/public-navigation.tsx, apps/web/src/app/public-shell.css, apps/web/src/public-shell.test.ts, apps/web/src/features/home.tsx, apps/web/src/styles/public.css, apps/web/src/home.test.tsx, apps/web/src/content/public/home.en.json, apps/web/src/home-content.test.ts]
