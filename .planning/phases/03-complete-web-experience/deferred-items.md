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
