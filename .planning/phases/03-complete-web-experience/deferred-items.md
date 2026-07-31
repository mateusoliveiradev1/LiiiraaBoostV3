# Deferred Items

## Resolved in 03-11

- Updated live workspace root set, desktop workspace dependency parity, and the exact `@types/node@24.13.3` packaged-harness approval link. The full architecture gate then passed all 46 tests.

## 03-11

- `pnpm verify:foundation:quick` reaches the unchanged root lint gate and fails on a pre-existing `packages/contracts-ts/src/validation.ts:220` `@typescript-eslint/restrict-template-expressions` error introduced before Plan 03-11. Phase 3 web architecture, type-check, test, and build gates pass; the unrelated contract-validation lint issue remains deferred to its owning contract plan.

## 03-18

- `pnpm test:architecture` reports two pre-existing Phase 3 parity mismatches outside Plan 03-18 ownership: the live `apps/web` manifest includes `@liiiraa/design-tokens` while the architecture fixture does not, and the root `web:verify:quick` script now invokes `tooling/web-evidence/run-web-verify.mjs` while its earlier architecture fixture still expects `pnpm web:check && pnpm web:test`. Plan 03-18 does not modify the module manifest, root script, or architecture fixtures; package lint, type, test, build, `pnpm web:check`, and `pnpm web:test` pass.
