# Phase 02 Deferred Items

## Architecture test filter forwarding

- **Discovered during:** Plan 02-02 verification
- **Observation:** `pnpm test:architecture -- --run -t "<name>"` forwards an extra
  `--` through the root script, so Vitest runs the complete architecture suite
  instead of selecting only the named tests.
- **Current evidence:** The required root command still passes the complete suite.
  Focused Plan 02-02 evidence was additionally produced with
  `pnpm --filter @liiiraa/architecture-tests exec vitest --run -t "<name>"`.
- **Deferred scope:** Correct root-script argument forwarding in a tooling plan;
  no production or architecture-policy behavior is affected.

## Pre-existing architecture-test lint debt

- **Discovered during:** Plan 02-03 overall verification
- **Observation:** The global `pnpm check` gate reports six lint errors in
  `tooling/architecture-tests/src/check-workspace.test.ts`: two legacy
  `ReadonlyArray<T>` forms and four unused destructured fields.
- **Current evidence:** Plan 02-03 package lint, typechecks, 24 simulator/client
  tests, adapter conformance, 34 architecture tests, and contract drift checks
  all pass. The failing file was not modified by Plan 02-03.
- **Deferred scope:** Normalize the architecture-test fixture typing in its
  owning tooling plan; the errors do not affect scenario behavior or runtime
  truth boundaries.
