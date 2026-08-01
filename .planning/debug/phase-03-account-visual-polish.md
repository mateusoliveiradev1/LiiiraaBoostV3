---
status: resolved
trigger: "Phase 03 UAT account visual gap: user said verbatim `nao gostei de nenhum dos 3 viu`; account screenshot resembles an unfinished wireframe with tiny typography, weak hierarchy, excessive unused space, and simulation/provenance messaging dominating the task."
created: 2026-07-31T19:29:11.6816453-03:00
updated: 2026-08-01T07:46:14-03:00
---

## Current Focus

hypothesis: RESOLVED — Plan 03-50 replaced the unconstrained route-list shell with a constrained application frame, canonical active-route navigation, a compact native mobile disclosure, route-preserving flag-plus-language switching, quiet persistent preview truth, and task-specific semantic workspaces.
test: account Vitest suite, TypeScript check, optimized Next build, Impeccable detector, and direct 1440px/390px/320px browser captures of Overview and Profile
expecting: achieved — desktop presents one active responsibility and useful authored density; mobile keeps the route inventory collapsed while naming the current task; preview authority remains visibly disconnected without dominating ordinary controls
next_action: Plan another cross-surface quality round; do not treat technical resolution or stable goldens as visual approval.

## Plan 03-45 Follow-up Rejection

reported: "navegaçao ruim na troca de idioma tem q ser a bandeira e tals na area logada tbm tem q ser melhor e tals"
verdict: Rejected after the clean 03-45 preflight. The account shell still lacks premium hierarchy and useful density; navigation is weak, the mobile route list is especially poor/overlong, and language switching must preserve the active responsibility route while showing a visible flag plus textual language label.
accessibility_constraint: A flag alone is insufficient. The control must keep an explicit accessible language name in both locales.
impact: The account visual gap remains failed and Plan 03-46 stays blocked.

## Plan 03-45 Post-03-52 Rejection

reported: "gostei ainda nao olha https://app.bravoboost.com.br/ como e bem mais bonito td"
verdict: Rejected after the post-03-52 preflight. None of W01-W18 or G01-G07 is human-approved.
qualitative_reference: `https://app.bravoboost.com.br/` is the user-named reference for a materially stronger level of overall beauty, finish, and composition. Use it only to calibrate the quality bar; do not copy its layout, branding, assets, wording, or proprietary expression.
impact: The account visual gap remains failed and Plan 03-46 remains blocked despite deterministic tests and stable captures.

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
fix: Plan 03-50 made one pathname-aware client owner resolve canonical account routes, current responsibility, and alternate-locale hrefs. The server layout now supplies a familiar topbar identity and one quiet disconnected-preview note. Below 960px the full rail is replaced by a closed native details disclosure. Account routes now use bounded focal regions, semantic rows, tables, definition lists, and consequence-specific review regions instead of interchangeable primitive panels. A 320px follow-up removed the redundant truncated topbar task while retaining the full task name in the disclosure.
verification: PASS — `rtk pnpm --filter @liiiraa/account test -- --run` (30/30), `rtk pnpm --filter @liiiraa/account check`, `rtk pnpm --filter @liiiraa/account build`, Impeccable detector (0 findings), and direct Playwright captures at 1440x900, 390x844, and 320x800. The captures showed one active desktop responsibility, visible flag-plus-language control, collapsed mobile navigation, bounded Profile controls, and readable 320px reflow.
files_changed:
  - apps/account/src/app/[locale]/layout.tsx
  - apps/account/src/account-navigation.tsx
  - apps/account/src/app/account-shell.css
  - apps/account/src/account-shell.test.ts
  - apps/account/src/features/account-preview.tsx
  - apps/account/src/features/account-preview.test.tsx
