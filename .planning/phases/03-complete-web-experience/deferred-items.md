# Deferred Items

## Resolved in 03-11

- Updated the live workspace root set, desktop workspace dependency parity, and the exact `@types/node@24.13.3` packaged-harness approval link. The full architecture gate now passes all 46 tests.

## 03-11

- `pnpm verify:foundation:quick` reaches the unchanged root lint gate and then fails on the pre-existing `packages/contracts-ts/src/validation.ts:220` `@typescript-eslint/restrict-template-expressions` error introduced before Plan 03-11. The Phase 3 web architecture, type-check, test, and build gates pass; this unrelated contract-validation lint issue remains deferred to its owning contract plan.
