---
phase: 1
slug: product-truth-and-modular-contracts
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-26
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for fast feedback while establishing the product truth and modular-contract foundation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | Vitest 4.x, Cargo nextest, Playwright 1.x, TypeSpec compiler checks, dependency-cruiser |
| **Config files** | None yet — Wave 0 scaffolds the root, TypeScript, Rust, contract, and E2E configurations |
| **Quick run command** | `pnpm verify:quick` |
| **Full suite command** | `pnpm verify` |
| **Estimated runtime** | Quick target ≤ 30 seconds; full local target ≤ 5 minutes |

The root commands are stable orchestration contracts. Package-level scripts may evolve, but plans must not require contributors to memorize implementation-specific command sequences.

---

## Sampling Rate

- **After every task commit:** Run the task's narrowest affected package/crate test plus `pnpm verify:quick`.
- **After every plan wave:** Run `pnpm verify`.
- **Before `$gsd-verify-work`:** The full suite, clean regeneration check, production fixture-leak gate, architecture gate, and required E2E scenarios must be green.
- **Max feedback latency:** 30 seconds for the quick loop; split slow suites from the quick path rather than weakening assertions.
- **No watch mode:** Every CI and plan verification command must terminate with a meaningful exit code.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Assigned by planner | TBD | 0 | FOUND-01..06 | T-01 contract drift | Generated TS/Rust validators agree on one golden corpus | contract | `pnpm test:contracts` | ❌ W0 | ⬜ pending |
| Assigned by planner | TBD | 0 | FOUND-02 | T-02 adapter divergence | Simulator and production-safe adapter satisfy identical conformance tests | integration | `pnpm test:adapters` | ❌ W0 | ⬜ pending |
| Assigned by planner | TBD | 0 | FOUND-03 | T-03 provenance loss | Values without an explicit provenance variant fail validation | unit + property | `pnpm test:provenance` | ❌ W0 | ⬜ pending |
| Assigned by planner | TBD | 0 | FOUND-04 | T-04 fixture deception | Production artifact and runtime reject fixture provenance on real-device paths | artifact + E2E | `pnpm test:production-truth` | ❌ W0 | ⬜ pending |
| Assigned by planner | TBD | 0 | FOUND-05 | T-05 boundary erosion | Forbidden imports and dependency cycles fail deterministically | architecture | `pnpm test:architecture` | ❌ W0 | ⬜ pending |
| Assigned by planner | TBD | 0 | FOUND-06 | T-06 quality-gate omission | Affected features cannot pass without all applicable quality dimensions | policy test | `pnpm test:acceptance-policy` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

The planner must replace every `Assigned by planner`/`TBD` entry with exact plan and task IDs once the plan set is generated.

---

## Wave 0 Requirements

- [ ] Root pnpm/Turborepo and Cargo workspace scaffolding with pinned toolchains and deterministic installs.
- [ ] Vitest configuration and golden-corpus contract test harness.
- [ ] Rust test harness runnable through Cargo nextest.
- [ ] TypeSpec compile/generate/check scripts with drift detection.
- [ ] Adapter conformance harness shared by simulator and production-safe unavailable adapter.
- [ ] Dependency graph rules and deliberately failing architecture fixtures.
- [ ] Acceptance-policy schema and negative fixtures for each omitted quality dimension.
- [ ] Production-build fixture-leak inspection and Playwright smoke path.
- [ ] Stable `verify:quick` and `verify` root commands.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Generated contract diff is understandable during review | FOUND-01 | Review ergonomics cannot be fully proven by pass/fail automation | Make a temporary contract change, run generation, confirm the diff identifies transport and validator changes clearly, then revert the temporary change |
| Provenance language is understandable to a non-technical user | FOUND-03 | Comprehension requires human UX judgment | Inspect fixture, unavailable, observed, measured, and modeled examples against PRODUCT.md and DESIGN.md copy principles |

Manual checks supplement automation and never replace the production truth gate, conformance suite, architecture gate, or acceptance-policy gate.

---

## Validation Sign-Off

- [ ] Every task has a terminating automated verification command.
- [ ] Sampling continuity has no three consecutive tasks without automated verification.
- [ ] Wave 0 creates every currently missing harness or fixture.
- [ ] FOUND-01 through FOUND-06 each have positive and negative test evidence.
- [ ] TypeScript and Rust validate the same golden corpus.
- [ ] Production truth is checked statically, at runtime, in the built artifact, and through E2E.
- [ ] Security, privacy, accessibility, performance, and recovery obligations are machine-checkable where applicable.
- [ ] No watch-mode flag appears in verification commands.
- [ ] Quick feedback target remains below 30 seconds.
- [ ] `nyquist_compliant: true` remains justified after planner mapping.

**Approval:** pending plan-checker verification
