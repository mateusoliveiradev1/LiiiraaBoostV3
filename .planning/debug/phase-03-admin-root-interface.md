---
status: resolved
trigger: 'Phase 03 UAT admin visual/routing gap: localized admin root at localhost:3002/pt-BR exposes raw access-denied JSON; user said `nao gostei de nenhum dos 3 viu`.'
created: 2026-07-31T19:30:00-03:00
updated: 2026-08-01T07:46:14-03:00
---

## Current Focus

hypothesis: Resolved — Plan 03-40 aligned the exact dedicated origin and localized HTML/JSON denial behavior; Plan 03-51 closed the remaining role/task shell, mobile navigation, language switching, and operational workspace gaps without broadening authority.
test: Full admin unit/type/build/security gates, focused Playwright W14-W16 at 1440/390, W18 axe/reflow at 320, Impeccable detector, and manual inspection of fresh 1440/390/320 captures.
expecting: Admitted exact-origin routes render one role-scoped current task, preserve canonical workspace and validated role across locale changes, collapse mobile navigation, and keep high-risk authority unavailable.
next_action: Plan another cross-surface quality round; do not treat technical resolution or stable goldens as visual approval.

## Plan 03-45 Follow-up Rejection

reported: "navegaçao ruim na troca de idioma tem q ser a bandeira e tals na area logada tbm tem q ser melhor e tals"
verdict: Rejected after the clean 03-45 preflight. The earlier origin/access-state diagnosis no longer describes the whole remaining gap: the rendered admin surface still needs a stronger premium application identity, task hierarchy, useful density, and substantially better compact mobile navigation.
locale_constraint: Switching languages must preserve the active admin workspace and visibly combine a flag with the language label; an explicit accessible language name remains mandatory.
impact: The admin visual gap remains failed and Plan 03-46 stays blocked.

## Plan 03-45 Post-03-52 Rejection

reported: "gostei ainda nao olha https://app.bravoboost.com.br/ como e bem mais bonito td"
verdict: Rejected after the post-03-52 preflight. None of W01-W18 or G01-G07 is human-approved.
qualitative_reference: `https://app.bravoboost.com.br/` is the user-named reference for a materially stronger level of overall beauty, finish, and composition. Use it only to calibrate the quality bar; do not copy its layout, branding, assets, wording, or proprietary expression.
impact: The admin visual gap remains failed and Plan 03-46 remains blocked despite deterministic tests and stable captures.

## Symptoms

expected: The admin origin renders a designed, localized premium administration shell or authored access state. Public/account/admin goldens share coherent branding, hierarchy/readability, and distinctive non-template quality.
actual: User said verbatim `nao gostei de nenhum dos 3 viu`. Screenshot `C:/Users/Liiiraa/AppData/Local/Temp/codex-clipboard-9c63cbc6-e939-4e52-8fb8-a87753777d01.png` shows raw `{"authoritativeAccessConnected":false,"code":"ADMIN_PREVIEW_ACCESS_DENIED"}` JSON at `localhost:3002/pt-BR`, not an interface.
errors: HTTP response body is raw JSON with code `ADMIN_PREVIEW_ACCESS_DENIED`; no authored visual access state is rendered.
reproduction: Run Test 1 in `.planning/phases/03-complete-web-experience/03-UAT.md` and visit the localized admin origin at `localhost:3002/pt-BR`.
started: Observed during Phase 03 UAT; earlier working behavior is not established.

## Eliminated

- hypothesis: The catch-all Next page or localized React layout serializes the access object as JSON.
  evidence: The live response is `application/json` with the exact object constructed by `apps/admin/proxy.ts`; the proxy returns before `NextResponse.next()`, so route and layout execution never begins.
  timestamp: 2026-07-31T19:32:15-03:00

- hypothesis: `pt-BR` is rejected as an invalid locale.
  evidence: `pt-BR` is a supported generated locale, is used by the official readiness path and visual tests, and the same denial occurs at a canonical `/pt-BR/admin` path when served from the unadmitted origin.
  timestamp: 2026-07-31T19:32:30-03:00

## Evidence

- timestamp: 2026-07-31T19:30:30-03:00
  checked: Phase 03 UAT, UI specification, DESIGN.md, and supplied screenshot
  found: The UI contract requires a separate admin origin with authored localized 403/404/410/500 states and a dense role-specific product shell; the screenshot visibly contains only the JSON access code at `localhost:3002/pt-BR`.
  implication: The observed response is outside the authored React error-state contract and must originate before the route layout renders.

- timestamp: 2026-07-31T19:31:00-03:00
  checked: `apps/admin/proxy.ts`, `apps/admin/src/admin-runtime.ts`, and `apps/admin/package.json`
  found: `AdminAccessBoundary` requires exact equality between `request.nextUrl.origin` and `resolveAdminOrigin()`. The default is `https://admin.localhost`; every non-preview result is converted directly into a 403 `NextResponse.json({ authoritativeAccessConnected: false, code: 'ADMIN_PREVIEW_ACCESS_DENIED' })`. The ordinary `dev` script supplies neither hostname/port nor `LIIIRAA_ADMIN_ORIGIN`.
  implication: A manual server at `http://localhost:3002` is deterministically classified as a foreign origin and short-circuited to raw transport JSON before Next renders a layout, localized route, or authored failure.

- timestamp: 2026-07-31T19:31:20-03:00
  checked: Canonical route manifest, admin catch-all page, and Playwright server configuration
  found: The canonical role landing is `/[locale]/admin`; Playwright starts the app at `http://admin.localhost:3102`, injects that exact `LIIIRAA_ADMIN_ORIGIN`, and uses `/pt-BR/admin` as readiness. Visual tests never exercise `http://localhost:3002/pt-BR`.
  implication: The certified test launch and UAT/manual launch disagree on both origin and entry path, so passing golden tests cannot protect this localized-root workflow.

- timestamp: 2026-07-31T19:31:40-03:00
  checked: Existing W14/W15 admin goldens, `admin-shell.css`, `packages/web-features/src/web.css`, and admin presentation components
  found: Once reached, the shell is a flat header/preview rail/sidebar/main scaffold with mostly text, borders, generic rows, and long definition-list content. W14/W15 show weak brand presence, large uninterrupted empty regions, raw fixture/provenance language repeated as primary chrome, minimally authored controls, and sparse data arranged as long vertical text rather than a deliberately dense operational workspace.
  implication: Correcting routing alone would reveal a functional but visually under-authored, template-like administration shell that still misses the UI contract's premium, role-specific, restrained operational quality and the user's broader visual rejection.

- timestamp: 2026-07-31T19:32:00-03:00
  checked: Live server at port 3002 and its process tree
  found: `GET http://localhost:3002/pt-BR` reproduces HTTP 403, `Content-Type: application/json`, and the exact screenshot body. The listening Next process was launched as `next dev --webpack --port 3002`, with no dedicated hostname argument; requesting `http://admin.localhost:3002/pt-BR/admin` also returns the same JSON denial.
  implication: The failure is reproducible and independent of the localized path: the running UAT server is outside the exact origin admission contract, so proxy rejection precedes routing.

- timestamp: 2026-07-31T19:32:45-03:00
  checked: Admin role landing implementation and visual-test capture procedure
  found: `RoleLanding` is only a `FixtureHeader`, a preview-boundary paragraph that exposes canonical-route-manifest language, and a plain list of responsibilities. No admin-role golden exists. The screenshot helper tabs once to expose focus and then captures without clearing focus, so W14/W15 baselines visibly preserve the expanded skip link over the brand area. Tests assert accessibility, content, and equality to those same baselines, not qualitative conformance or comparison with the approved desktop captures.
  implication: The visual gate can remain green while the default entry is unreviewed and the reviewed workflow captures are compositionally sparse, internally worded, and visually contaminated by an accessibility focus state.

- timestamp: 2026-07-31T19:33:25-03:00
  checked: Focused `apps/admin/src/admin-security.test.ts` suite
  found: All 6 tests pass while explicitly admitting `https://admin.localhost` or injected `http://admin.localhost:3102`; none exercises the actual `http://localhost:3002` UAT launch contract.
  implication: The security implementation behaves as tested, but the tests validate a different runtime origin from the manual UAT environment and therefore do not detect this integration gap.

## Resolution

root_cause: The localized UAT request is intercepted by the admin proxy before React because the running server (`next dev --webpack --port 3002`) serves `http://localhost:3002`, while the proxy admits only exact equality with `LIIIRAA_ADMIN_ORIGIN` (default `https://admin.localhost`). Every origin rejection is deliberately emitted as raw 403 JSON. The requested `/pt-BR` path is also not the canonical admin landing (`/pt-BR/admin`), but that route mismatch is masked by the earlier proxy rejection. Once launch origin and path are corrected, the remaining interface still fails the visual truth: the role landing is a minimal header/boundary/plain-list composition with internal fixture/manifest copy; existing goldens cover only support/security/operations workflows, capture an expanded skip-link focus state, and enforce pixel stability/accessibility rather than premium qualitative conformance, allowing a sparse template-like shell to pass.
fix: Plan 03-40 bound ordinary development to `http://admin.localhost:3002` and authored localized HTML denials while preserving bounded JSON. Plan 03-51 then introduced the canonical resolver-backed flag/language switch, validated role retention, role/current-task topbar, compact sub-960px disclosure, semantic assigned queue, and decision-first support, operations, security, diagnostics, and audit workspaces. Diagnostic consent, redaction, immutable audit fields, disabled authority, and `remoteStateChanged=false` remain unchanged at consequence boundaries.
verification: Admin tests pass 46/46; focused security passes 16/16; TypeScript and production build pass; W14/W15 wide and W16 mobile Playwright flows pass; W18 320px axe/reflow passes; Impeccable reports zero findings; manual 1440/390/320 inspection confirmed the premium operational hierarchy and responsive audit disclosure.
files_changed: [apps/admin/src/app/[locale]/layout.tsx, apps/admin/src/admin-navigation.tsx, apps/admin/src/app/admin-shell.css, apps/admin/src/features/admin-preview.tsx, apps/admin/src/content/admin.pt-BR.json, apps/admin/src/content/admin.en.json]
