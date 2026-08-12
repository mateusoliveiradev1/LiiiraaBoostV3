---
phase: 05-hardware-intelligence-and-measured-evidence
plan: '04'
subsystem: evidence-policy
tags: [rust, policy, capabilities, freshness, lifecycle, claims, proptest]
requires:
  - phase: 05-01
    provides: Generated evidence and quality vocabulary
provides:
  - Pure capability and lifecycle actionability evaluator
  - Stable localized blocker reasons with exact evidence references
  - Fail-closed metric quality and claim admission policy
  - Revocable claim authority without evidence-history deletion
affects: [05-03, 05-05, 05-06, 05-07, 05-08, 05-09]
tech-stack:
  added: [proptest-1.11.0-dev]
  patterns: [pure-policy-core, capability-not-marketing-name, stable-all-blockers]
key-files:
  created:
    - apps/desktop/src-tauri/src/evidence_policy.rs
    - apps/desktop/src-tauri/tests/evidence_policy.rs
key-decisions:
  - 'Marketing labels are presentation-only and are never read by capability eligibility.'
  - 'Corrupt, contradictory, stale, unavailable, unknown, or forbidden evidence always removes actionability.'
  - 'Lifecycle warnings require acknowledgement of the exact warning identity.'
  - 'Claim revocation removes admission while retaining the immutable evidence reference.'
requirements-completed: []
duration: 7 min
completed: 2026-08-12
status: complete
---

# Phase 05 Plan 04: Fail-Closed Evidence Policy Summary

**Validated observations now become deterministic, explainable verdicts through one pure Rust policy that cannot grant authority from product names or optimistic fallbacks.**

## Accomplishments

- Added capability, freshness, lifecycle, metric-quality, and claim-admission evaluators without
  filesystem, network, clock, Tauri, or Windows side effects.
- Returned every blocker in stable order with localization keys and exact versioned evidence
  references.
- Made unsupported, hidden, experimental, and compatible presentation tiers subordinate to
  actionability: only fully available, current, valid evidence can be actionable.
- Preserved comparison history when claim approval is revoked.
- Added property coverage proving capability order and marketing names cannot change results.

## Task Commits

1. `d95978c` — add failing policy matrices and property tests.
2. `19051bd` — implement the pure fail-closed policy core.

## Verification

- Evidence policy suite passed twice: 10/10 each run.
- Desktop Rust compilation passed across 299 crates.
- The new policy source and tests are rustfmt-clean. The workspace-wide formatting check still
  reports the pre-existing one-line formatting drift in `tests/startup_config.rs`; that unrelated
  user-owned line was not changed by this plan.

## Safety Boundaries Preserved

- No hardware marketing name can grant compatibility.
- Invalid evidence never becomes an actionable recommendation or admitted claim.
- Acknowledgements are bound to the exact lifecycle warning identity.
- No Docker or external service is required.

## Self-Check: PASSED

---

_Phase: 05-hardware-intelligence-and-measured-evidence_
_Completed: 2026-08-12_
