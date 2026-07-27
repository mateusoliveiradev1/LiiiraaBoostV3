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
