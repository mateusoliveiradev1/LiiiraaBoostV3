---
status: diagnosed
trigger: "Phase 03 UAT public visual gap: user said `nao gostei de nenhum dos 3 viu`; public Home exposes boundary/evidence metadata and has an oversized, awkward hero with weak pacing."
created: 2026-07-31T19:28:32.0992839-03:00
updated: 2026-08-01T00:52:41-03:00
---

## Current Focus

hypothesis: CONFIRMED — app-local public composition/copy bypasses the design contract and automated coverage institutionalizes the rejected hierarchy.
test: Existing Home/public-shell and shared visual-contract tests were run unchanged against the current source.
expecting: Confirmation requires the tests to stay green while the checked source and golden retain the rejected off-token hierarchy, boundary rail, and raw provenance.
next_action: Plan another gap-closure round for authored cross-surface identity, navigation, and route-preserving locale controls; do not treat stable goldens as approval.

## Plan 03-45 Follow-up Rejection

reported: "ainda nao ficou legal nao nao tem cara de web app forte navegaçao ruim na troca de idioma tem q ser a bandeira e tals"
verdict: Rejected after the clean 03-45 preflight. The public shell still lacks a strong authored web-app identity, navigation remains weak, and the locale control must preserve the current route while showing a visible flag plus language label with an explicit accessible text name.
impact: The visual gap remains failed, no W01-W18/G01-G07 approval exists, and Plan 03-46 stays blocked.

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
fix: Not applied (diagnose-only). Redesign the public shell/Home on canonical tokens; restore the approved brand lockup; keep origin/provenance truth contextual or progressively disclosed rather than persistent primary copy; make the desktop artifact visually dominant; and expand tests to scan app CSS plus require named human approval for golden baselines.
verification: Root cause confirmed by direct source/golden comparison, correct capture admission, and 64 focused tests passing unchanged despite the observed contract violations. No fix verification performed.
files_changed: []
