# Deferred Items

## 03-41

- Local visual QA at the admitted admin origin confirmed that `/fonts/manrope-variable.woff2` and `/fonts/jetbrains-mono-variable.woff2` return HTTP 404 because no web app currently publishes the token-declared font files. The responsive compositions remain usable with the declared fallbacks, but self-hosted font publication is a pre-existing cross-surface asset concern outside the Plan 03-41 shell/workspace scope.

## Resolved in 03-32 regression recovery

- Resolved the Phase 03-18 architecture parity mismatches by refreshing the live `apps/web` dependency and `web:verify:quick` script expectations. The architecture suite now passes in the recursive root graph.
- Resolved the Phase 03-25 fixture-guard timeout by using a bounded Windows integration timeout appropriate for the live workspace scan, and serialized fixture-guard after desktop tests so its distributable rebuild cannot race active imports. The fixture-guard package test and complete 49-task root test graph now pass.

## Resolved in 03-11

- Updated live workspace root set, desktop workspace dependency parity, and the exact `@types/node@24.13.3` packaged-harness approval link. The full architecture gate then passed all 46 tests.

## 03-11

- `pnpm verify:foundation:quick` reaches the unchanged root lint gate and fails on a pre-existing `packages/contracts-ts/src/validation.ts:220` `@typescript-eslint/restrict-template-expressions` error introduced before Plan 03-11. Phase 3 web architecture, type-check, test, and build gates pass; the unrelated contract-validation lint issue remains deferred to its owning contract plan.

## 03-18

- Resolved in Plan 03-32 regression recovery: the live `apps/web` dependency and root `web:verify:quick` script expectations now match the architecture fixtures, and the architecture suite passes in the recursive root graph.

## 03-21

- `pnpm web:verify:quick -- --requirement WEB-01 --grep "catalog|search|plans|policies|status"` passes workspace checks and tests, then reaches the same planned readiness boundary: the public build root, `public-routes.json`, `content-publication.json`, and `visual-report.json` remain owned by Plan 03-32.
- The generated standalone server currently omits `ajv/dist/runtime/ucs2length`, so direct standalone startup fails before route rendering. The supported webpack production build passes, and the complete route/axe/responsive browser pass ran against webpack development output. Standalone trace completeness remains an application-packaging concern outside Plan 03-21.

## 03-20 (continued)

- `pnpm web:verify:quick -- --requirement WEB-01` reaches the Phase 3 readiness gate and reports the still-planned public build root plus `public-routes.json`, `content-publication.json`, and `visual-report.json`. Plan 03-32 owns final evidence promotion; Plan 03-20 proves its Home through focused content/render tests, a production Next build, and live 1440/390/320 viewport checks without fabricating those final evidence artifacts.

## 03-23

- Both Plan 03-23 `web:verify:quick` commands pass workspace checks and tests, then stop at the planned Plan 03-32 readiness boundary: `quality/evidence/phase-03/web/docs-routes.json` and `docs-publication.json` do not exist yet.
- The existing public client bundle exposes generated Ajv standalone-validator `require("ajv/dist/runtime/ucs2length")` through `contracts-ts`/`web-core`; browser hydration falls into the shared error boundary although production SSR, webpack build, script-blocked Axe checks, and 320/390px reflow pass. Correcting generated validator module format or client entry isolation crosses the contracts/package boundary and remains deferred to the owning packaging/evidence plan.

## 03-27

- `pnpm web:verify:quick -- --requirement WEB-08 --grep "account|W11|W12|W13"` passes all 20 workspace check/test tasks, including the complete account suite, then reaches the planned final readiness boundary: public/account/admin standalone build roots plus `quality/evidence/phase-03/web/security-boundaries.json` and `preview-boundaries.json` remain owned by Plan 03-32. Plan 03-27 proves its account production build independently and does not fabricate phase-wide evidence.

## 03-25

- Resolved in Plan 03-32 regression recovery: the architecture parity expectations now match the live workspace, the fixture guard uses a bounded Windows integration timeout appropriate for the repository scan, and Turbo orders its destructive rebuild after desktop tests. Both scoped packages and the complete 49-task root test graph pass.

## 03-32

- `pnpm verify` passes the workspace toolchain contract and formatting gate, then stops in the unchanged root ESLint gate with 68 pre-existing errors across prior-plan account, admin, public-web, contract, and web-evidence files before the root graph reaches the web phase verifier. The failures include typed-ESLint project-service coverage gaps and rule violations outside Plan 03-32 acceptance ownership. The complete 49-task root test graph passes, the web-evidence unit suite passes 102 tests with one intentional Playwright-owned skip, all three web production builds pass, live public/account/admin development routes return HTTP 200, and `pnpm web:verify:phase -- --mode final` passes independently. The unrelated repository-wide lint backlog remains deferred to the owning plans.
