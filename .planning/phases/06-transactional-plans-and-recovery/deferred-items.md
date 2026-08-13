# Deferred Items

## 2026-08-13 — Plan 06-02

- `crates/contracts-rust/tests/transactional_plans_corpus.rs`: workspace-wide `cargo fmt --all -- --check` reports formatting drift introduced before Plan 06-02. It is outside this plan's ownership; `cargo fmt -p liiiraa-plan-engine -- --check` passes.

## 2026-08-13 — Plan 06-08

- `crates/plan-engine/tests/risk_policy.rs`: the full-crate sweep found the pre-existing property `every_exact_proof_binding_dimension_rejects_mismatch` fails for `drift_index = 3, suffix = "1"` (introduced before 06-08). The generated `risk_policy.proptest-regressions` artifact was removed; focused reconciliation, formatting, check, clippy, and architecture gates pass.

## 2026-08-13 — Plan 06-18

- `pnpm verify:foundation` is currently blocked by pre-existing lint failures outside Plan 06-18 ownership: `packages/desktop-client/src/plans.ts:1` (`@typescript-eslint/no-import-type-side-effects`) and `tooling/architecture-tests/src/check-cargo.ts:106` (`@typescript-eslint/no-unsafe-assignment`). Neither file was modified by Plan 06-18.
