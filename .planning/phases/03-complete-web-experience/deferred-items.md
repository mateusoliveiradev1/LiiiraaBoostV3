# Deferred Items

## Resolved in 03-11

- Updated live workspace root set, desktop workspace dependency parity, and the exact `@types/node@24.13.3` packaged-harness approval link. The full architecture gate then passed all 46 tests.

## 03-11

- `pnpm verify:foundation:quick` reaches the unchanged root lint gate and fails on a pre-existing `packages/contracts-ts/src/validation.ts:220` `@typescript-eslint/restrict-template-expressions` error introduced before Plan 03-11. Phase 3 web architecture, type-check, test, and build gates pass; the unrelated contract-validation lint issue remains deferred to its owning contract plan.

## 03-18

- `pnpm test:architecture` reports two pre-existing Phase 3 parity mismatches outside Plan 03-18 ownership: the live `apps/web` manifest includes `@liiiraa/design-tokens` while the architecture fixture does not, and the root `web:verify:quick` script now invokes `tooling/web-evidence/run-web-verify.mjs` while its earlier architecture fixture still expects `pnpm web:check && pnpm web:test`. Plan 03-18 does not modify the module manifest, root script, or architecture fixtures; package lint, type, test, build, `pnpm web:check`, and `pnpm web:test` pass.

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

- `pnpm test:architecture` still reports the two parity mismatches already deferred in Plan 03-18: the live `apps/web` manifest includes `@liiiraa/design-tokens` while the architecture fixture does not, and the root `web:verify:quick` command now uses `tooling/web-evidence/run-web-verify.mjs` while the fixture expects the former check/test chain.
- `pnpm test:runtime-truth` reaches the unchanged fixture guard and times out after five seconds while inspecting the live workspace graph. Plan 03-25 does not own the fixture guard or architecture expectations; its scoped release checks, tests, production build, artifact scan, and browser verification pass.

## 03-32

- `pnpm verify` passes the workspace toolchain contract and formatting gate, then stops in the unchanged root ESLint gate with 68 pre-existing errors across prior-plan account, admin, public-web, contract, and web-evidence files before the root graph reaches the web phase verifier. The failures include typed-ESLint project-service coverage gaps and rule violations outside Plan 03-32 acceptance ownership. The complete web-evidence unit suite passes 100 tests with one intentional Playwright-owned skip, all three web production builds pass, live public/account/admin development routes return HTTP 200, and `pnpm web:verify:phase -- --mode final` passes independently. The unrelated repository-wide lint backlog remains deferred to the owning plans.
