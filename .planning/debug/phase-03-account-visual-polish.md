---
status: diagnosed
trigger: "Phase 03 UAT account visual gap: user said verbatim `nao gostei de nenhum dos 3 viu`; account screenshot resembles an unfinished wireframe with tiny typography, weak hierarchy, excessive unused space, and simulation/provenance messaging dominating the task."
created: 2026-07-31T19:29:11.6816453-03:00
updated: 2026-07-31T19:34:39.4901020-03:00
---

## Current Focus

hypothesis: CONFIRMED — the account applies correct low-level tokens and truthful preview semantics to a missing account-specific composition: an unconstrained wide canvas, skeletal route markup, absent active navigation/task grouping, and duplicated provenance copy create the wireframe; the visual pipeline snapshots only overview and validates stability/accessibility rather than polish, leaving profile unreviewed.
test: completed static differential trace from UI-SPEC and approved Phase 2 account capture through account layout/components/CSS and W11 Playwright/visual-manifest coverage
expecting: confirmed by direct source, checked-in golden, user screenshot, and test assertions
next_action: return the root-cause report to the parent orchestrator; do not modify production code in diagnose-only mode

## Symptoms

expected: Public/account/admin goldens share coherent branding, hierarchy/readability, and distinctive non-template quality.
actual: User said verbatim `nao gostei de nenhum dos 3 viu`. Account screenshot resembles an unfinished wireframe: tiny typography, weak hierarchy, excessive unused space, and simulation/provenance messaging dominating the task.
errors: Visual UAT rejection; no runtime error reported.
reproduction: Test 1 in `.planning/phases/03-complete-web-experience/03-UAT.md`; inspect `C:/Users/Liiiraa/AppData/Local/Temp/codex-clipboard-8308072b-b750-485d-8af0-aa165bfbe3a2.png`.
started: Observed during Phase 03 UAT; whether an earlier account design was accepted is not reported.

## Eliminated

- hypothesis: The account is unstyled because `web.css` is not loaded.
  evidence: `packages/web-features/src/index.ts` imports `./web.css`, the account imports the package root, and the screenshot visibly contains the route-header, provenance, table, status, and boundary styles.
  timestamp: 2026-07-31T19:33:42-03:00

- hypothesis: The failure is only a 1920px user-capture or browser-zoom artifact.
  evidence: The checked-in 1440x900 W11 golden reproduces the flat, low-hierarchy account shell and excessive empty regions; the same mechanisms are present at both widths.
  timestamp: 2026-07-31T19:33:57-03:00

## Evidence

- timestamp: 2026-07-31T19:31:04-03:00
  checked: User-provided account profile screenshot and checked-in W11 account golden
  found: Both render a 272px navigation rail beside a nearly full-viewport main region. The user profile capture leaves most of the 1920px-wide canvas empty while a single text field expands across roughly the entire main column; the W11 overview golden is similarly flat and sparse compared with the approved Phase 2 desktop account capture.
  implication: The reported result is reproducible in repository-owned visual evidence and is a composition/layout problem, not an isolated browser artifact.

- timestamp: 2026-07-31T19:31:36-03:00
  checked: `apps/account/src/app/account-shell.css` and `packages/web-features/src/web.css`
  found: `.account-workspace` defines only sidebar plus `minmax(0, 1fr)`; `#account-main` has padding but no max width, internal grid, focal column, or wide-layout cap. `.lb-input` is globally `inline-size: 100%`. `.lb-web-route-header` puts copy and provenance in `1fr auto`, driving provenance to the far edge of the unconstrained main region.
  implication: At wide viewports the compact 13/15/20/28px type scale is distributed across a roughly 1600px content plane, producing weak relative hierarchy, an excessively long field, and unused space.

- timestamp: 2026-07-31T19:32:02-03:00
  checked: `apps/account/src/features/account-preview.tsx` profile composition
  found: `ProfilePreview` is an unclassed article containing only `FixtureHeader`, one full-width `LbTextField`, a bare `dl`, and one button. There is no authored account-specific identity summary, grouped task region, contextual status, responsive content grid, or progressive detail composition.
  implication: Shared tokens and accessible controls supply mechanics but no premium account task composition; the rendered result necessarily resembles a wireframe.

- timestamp: 2026-07-31T19:32:24-03:00
  checked: Account shell, `FixtureHeader`, profile field description, UI-SPEC preview workflow, and account copy
  found: Before the profile action, simulation is communicated through the header origin note, a global rail containing a provenance mark plus repeated deterministic-preview label plus a long disconnected-authority paragraph, a route-level `ProvenanceLabel`, and the profile field description `Fixture sintética da conta`. The UI-SPEC requires one persistent global rail and repetition inside sensitive reviews/receipts, not duplicate metadata on every nonsensitive task primitive.
  implication: Safety truth is correct but its repetition and placement make internal provenance/Phase terminology the dominant story instead of a quiet persistent boundary around the user's task.

- timestamp: 2026-07-31T19:32:51-03:00
  checked: Account navigation layout and CSS
  found: Navigation anchors have hover/focus styling only; the layout does not receive the current route or emit `aria-current`, selected styling, icons, or a strong local task cue. The Phase 2 approved account capture has clear selected tabs, icon-supported navigation, a focal identity region, and structured responsibility panels.
  implication: Token sharing alone did not create cross-surface branding or task hierarchy; the account shell omits key compositional signals present in the approved desktop product.

- timestamp: 2026-07-31T19:33:36-03:00
  checked: `tooling/web-evidence/visual-manifest.json`, canonical W11 scenario, and account/accessibility Playwright suites
  found: W11 declares nine required account routes, but the visual manifest contains exactly one W11 golden for `account-overview`. The route traversal visits profile and the other routes but asserts only locale, one H1, deterministic route ID, visible preview rail, and non-dead links. It does not screenshot those routes or assert selected navigation, content measure, density, hierarchy, copy proportion, or desktop coherence.
  implication: The rejected `account-profile` composition never passed a route-specific visual baseline; automated green status could not falsify the UAT complaint.

- timestamp: 2026-07-31T19:33:58-03:00
  checked: Golden capture setup in `accessibility-responsive.spec.ts`
  found: `expectAccessibleResponsivePage` presses Tab to test focus, then `toHaveScreenshot` runs without clearing focus. The checked-in W11 golden therefore captures the skip link open over the brand header instead of a neutral final/default state.
  implication: Even the sole account overview baseline is a technical accessibility-state snapshot, not a clean product-polish reference.

- timestamp: 2026-07-31T19:34:13-03:00
  checked: UI-SPEC account direction and checker sign-off
  found: The contract strongly specifies public Home composition but describes account primarily through navigation, component inventory, and workflow semantics; it provides no equally concrete wide-screen account composition or reference frame. Its checker sign-off marks Visuals/Typography/Spacing PASS before implementation, while the final verifier explicitly leaves brand/product-register quality UNCERTAIN pending human review.
  implication: Semantic compliance and token compliance were able to substitute for authored visual composition until the intended human UAT gate rejected the result.

## Resolution

root_cause: The account surface has no authored account-specific visual composition. The custom shell gives the main column unlimited width and the route implementation renders generic primitives (header, full-width field/table, bare definition list/button) with no focal workspace, useful grouped density, current-route state, or desktop-derived visual hierarchy. The compact shared type tokens (13/15/20/28px) and 100%-width inputs are technically compliant but become visually tiny and sparse across a roughly 1600px content plane. Preview truth is then duplicated in the origin note, global rail, route provenance, field descriptions, sensitive boundaries, and footer, making internal fixture/authority language more prominent than the task. Tests allowed it because W11 has only an overview golden; profile and the other required routes receive semantic traversal only, screenshots test pixel stability/accessibility rather than visual quality, the sole golden is captured with the skip link focused, and no assertion/reviewer gate measures hierarchy, density, active state, copy dominance, or coherence with the approved Phase 2 account capture.
fix:
verification: Diagnose-only. Root cause confirmed by direct comparison of the user capture, checked-in W11 1440x900 golden, approved Phase 2 account capture, implementation/CSS/token trace, canonical scenario manifest, and exact Playwright assertions.
files_changed: []
