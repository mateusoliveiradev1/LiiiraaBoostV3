---
status: awaiting_human_verify
trigger: "Phase 03 UAT public visual gap: user said `nao gostei de nenhum dos 3 viu`; public Home exposes boundary/evidence metadata and has an oversized, awkward hero with weak pacing."
created: 2026-07-31T19:28:32.0992839-03:00
updated: 2026-08-02T02:19:50-03:00
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "Route-level `public.css` delivery and the absence of effective-style/current-pixel assertions let a dev/HMR runtime render current Home markup against a stale CSS generation while shell selectors continued to apply, and let Plan 03-66 accept it."
  confirming_evidence:
    - "The exact dev process started 23 seconds before the reviewer captures; those pixels show stable shell selectors plus unbound Home and locale-projection selectors."
    - "A retained stale `.next/dev` chunk contains `.public-header*` but zero `.home-ignition-*`/`.public-mobile-locale` rules, while a fresh navigation loads the current chunk and passes geometry."
    - "The deliberate stale-selector browser test reproduces the mechanism and the current aggregate helper resolves, yielding the expected RED failure: `Received promise resolved instead of rejected`."
  falsification_test: "If co-locating `public.css` at `[locale]/layout.tsx`, adding computed/box sentinels, and making no-update capture compare current pixels still allows the stale-selector negative fixture to resolve or changes public CSS scope outside `apps/web`, the hypothesis is wrong."
  fix_rationale: "One layout-owned CSS boundary ties shell and authored public composition to the same route lifecycle; runtime computed/geometry assertions catch missing or non-binding selectors; unconditional screenshot comparison proves current pixels rather than manifest/history only."
  blind_spots: "The original browser cache/HMR event log is unavailable, so the precise browser cache transition cannot be replayed bit-for-bit; the fix therefore targets the directly observed stale effective-style state rather than one browser-internal trigger."
tdd_checkpoint:
  test_file: "tooling/web-evidence/tests/accessibility-responsive.spec.ts"
  test_name: "@final @public authored style parity rejects stale Home selector bindings"
  status: "green"
  failure_output: "RED proved the helper resolved; GREEN now rejects stale bindings through `PUBLIC_HOME_AUTHORING_PARITY`."
next_action: Ask the reviewer to open the public Home from a fresh development startup, navigate/scroll the page, and confirm that the authored composition remains intact; archive only after they reply `confirmed fixed`.

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

- hypothesis: Current mobile CSS exposes two actually visible locale controls.
  evidence: The initial sentinel counted a box-bearing anchor inside a closed native `details`; excluding `details:not([open])` descendants makes W02, G02, reflow-320, and text-200 pass, including exact current-pixel comparison for both mobile candidates. The duplicate was a measurement error, not a current visual delta.
  timestamp: 2026-08-02T02:14:52-03:00

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

- timestamp: 2026-08-02T01:32:18-03:00
  checked: Plan 03-66 commands, `accessibility-responsive.spec.ts`, `public.spec.ts`, and checked-in W01 candidate pixels.
  found: The no-update candidate function returns before `toHaveScreenshot`, the generic replay asserts no authored surface styles/boxes, and the dedicated Home geometry test was omitted from Plan 03-66. Yet the checked-in W01 PNG is fully styled with centered hero, dominant product stage, authored sequence/compatibility/distribution sections, and one non-overlapping header.
  implication: The 03-66 PASS is incapable of proving pixel parity, but the admitted W01 file itself is not the catastrophic reviewer image. The remaining cause is a reviewer-runtime/artifact identity mismatch, not corruption of the current checked-in W01 bytes.

- timestamp: 2026-08-02T01:36:44-03:00
  checked: Exact five `codex-clipboard-*.png` reviewer images from 01:07:49–01:08:23 and current production public geometry test.
  found: All five reviewer images are 1920px-wide sequential viewport captures while scrolling the same PT-BR Home. The sticky shell remains styled at the viewport top, but Home hero/sequence/compatibility/release content uses fallback block flow and the real desktop image expands nearly raw/full-width. In contrast, the fresh optimized production run passes header=72px, heading=52–76px, centered stage >=1000px, and above-fold placement.
  implication: The post-03-66 defect is reproducible in concrete pixels as a runtime-specific loss of Home authoring CSS, not a defect in current production source or the checked-in W01 candidate. The apparent repeated header comes from sequential scrolled viewports plus sticky overlap, not duplicate header DOM proven within one image.

- timestamp: 2026-08-02T01:43:12-03:00
  checked: Live `public.localhost:3000` process identity and computed stylesheet/geometry probe.
  found: The exact reviewer-like Next dev process started at 01:07:26, immediately before the 01:07:49 screenshot. The same still-running process is now healthy: one header, one visible locale control, current Home rule present, 76px centered H1, 1280px hero container, and 1120px stage. Selectively emptying the combined Home/shell chunk produces fallback 32px/left-aligned/full-width Home but also removes shell styling, so a total current chunk outage is too broad.
  implication: The failure was transient and recovered without product-source edits. The matching mechanism is a stale/partial CSS generation or selector-binding mismatch during dev startup/HMR, not a permanent current import omission. A correct gate must validate effective selectors/geometry, not merely resource success or source imports.

- timestamp: 2026-08-02T01:50:31-03:00
  checked: Retained `.next/dev` generations and deliberate stale-selector Playwright negative test.
  found: `_04m7i_l._.css` retains `.public-header*` styling but has no `.home-ignition-*` or `.public-mobile-locale` rules. The controlled fixture preserves shell CSS while renaming only current Home selector bindings; `expectAccessibleResponsivePage` still resolves and the negative test fails RED with `Received promise resolved instead of rejected`.
  implication: The stale effective-style failure is reproduced and the false-negative gate mechanism is proven. Root cause is sufficiently confirmed to fix without guessing at pixels.

- timestamp: 2026-08-02T01:58:24-03:00
  checked: Stale-selector negative test after layout/style and shared-helper changes.
  found: The same test now passes: selective Home selector neutralization is rejected by `PUBLIC_HOME_AUTHORING_PARITY` while the public header remains visible.
  implication: The missing/non-binding stylesheet negative gate is GREEN and detects the exact shell-survives/Home-collapses failure class.

- timestamp: 2026-08-02T02:05:47-03:00
  checked: Ordinary no-update W01 candidate path and development CSP/parity route.
  found: W01 passed live computed geometry and full-page `toHaveScreenshot` comparison with update mode disabled; no screenshot changed. The development-origin test also passed after moving its public probe to `/en` and applying the same Home parity sentinels. Optimized production builds passed as part of both runs.
  implication: Current-pixel proof is active rather than a no-op, and both current dev and optimized production bind the layout-owned public composition correctly.

- timestamp: 2026-08-02T02:14:52-03:00
  checked: First complete three-origin replay and focused responsive rerun.
  found: The complete run reached 40 passed/161 skipped with four parity-sentinel failures caused solely by counting the locale anchor inside closed `details` as visible; no screenshot delta was reported. After correcting semantic visibility, W02 and G02 live pixels plus reflow-320 and text-200 parity passed (4 passed, 4 intentional skips).
  implication: Responsive current pixels remain unchanged; the gate now distinguishes an actually exposed stale locale projection from a native closed-menu descendant.

- timestamp: 2026-08-02T02:18:37-03:00
  checked: Fresh isolated development startup after terminating the exact 01:07 reviewer process tree.
  found: With port 3000 absent, the browser test started isolated public/account/admin development origins, loaded public Home from the new layout-owned CSS boundary, passed `PUBLIC_HOME_AUTHORING_PARITY`, and shut down cleanly (1 passed).
  implication: The runtime fix survives a clean dev restart and does not depend on the healed long-lived reviewer process or browser/server cache state.

- timestamp: 2026-08-02T02:19:00-03:00
  checked: Final complete three-surface no-update evidence replay after the locale-visibility correction.
  found: The replay completed with 44 passed, 161 intentional skips, and zero failures in about 3.5 minutes. All 25 live W/G candidate pixel comparisons passed and no snapshot update was performed.
  implication: The strengthened parity gates accept every current public/account/admin candidate without changing the approved pixels, while the dedicated stale-selector negative still fails closed.

- timestamp: 2026-08-02T02:19:30-03:00
  checked: Independent SHA-256 and byte-count audit of the 25 candidates recorded by the public, account, and admin inspection files.
  found: All 25 filesystem PNGs exactly match their recorded lowercase SHA-256 values and byte counts; the audit reported `AUDIT_OK candidates=25 mismatches=0`.
  implication: The no-update replay and parity fix did not mutate, replace, or silently recapture any admitted visual candidate.

- timestamp: 2026-08-02T02:19:40-03:00
  checked: Final worktree status, whitespace check, protected visual-artifact diff, and complete scoped source/test diff.
  found: `git diff --check` is clean; screenshots, visual manifest, and Phase 03 visual records have no diff; only the seven intended source/test files and this debug session are modified. The unrelated untracked `apps/desktop/src-tauri/gen/` directory remains untouched.
  implication: The fix is ready for a scoped commit without recapture, baseline mutation, approval-state change, or unrelated workspace edits.

## Resolution

root_cause: After the earlier composition redesign, public styling remained split across layout-owned tokens/`public-shell.css` and route/component-owned `public.css`. The reviewer opened a fresh `next dev` process through a browser state that rendered current Home markup against a retained stale CSS generation: stable header selectors applied, while current Home and locale-projection selectors did not. Plan 03-66 could not detect this because its shared helper asserted only structure/accessibility/overflow, `captureCandidateIfUpdating` returned without comparing pixels in no-update mode, and the dedicated public geometry spec was not part of the replay. This combination allowed a shell-styled, composition-collapsed runtime to pass.
fix: `public.css` is now imported once at the public locale layout beside tokens and `public-shell.css`; redundant page/component imports are removed so dev/HMR cannot advance shell and composition through separate route lifecycles. The aggregate helper now enforces one header/locale projection plus authored Home computed display, position, type scale, centered measure, product-stage width, section grids, label/value gap, and initial non-overlap. Candidate tests always execute `toHaveScreenshot`, including no-update replay, so current pixels are compared instead of skipped. A deliberate stale-selector fixture preserves shell CSS and proves the helper fails closed.
verification: Stale-selector negative passed after first failing RED; W01 live geometry/current-pixel comparison passed with update mode disabled; fresh isolated development-origin Home parity and optimized production builds passed; responsive W02/G02/reflow/text-200 rerun passed; public unit suite passed 82/82; source/evidence TypeScript checks and formatting passed. The final complete three-surface no-update replay passed 44 tests with 161 intentional skips and zero failures; all 25 live W/G pixel comparisons matched and no snapshot was updated. A separate filesystem audit confirmed all 25 candidate SHA-256 values and byte counts exactly match the inspection records.
files_changed: [apps/web/src/app/[locale]/layout.tsx, apps/web/src/app/[locale]/(public)/[[...slug]]/page.tsx, apps/web/src/app/[locale]/releases/[[...release]]/page.tsx, apps/web/src/app/[locale]/download/[channel]/[version]/page.tsx, apps/web/src/features/documentation.tsx, apps/web/src/public-shell.test.ts, tooling/web-evidence/tests/accessibility-responsive.spec.ts]
