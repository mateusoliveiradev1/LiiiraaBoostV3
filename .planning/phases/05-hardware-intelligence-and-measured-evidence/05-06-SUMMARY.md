---
phase: 05-hardware-intelligence-and-measured-evidence
plan: '06'
subsystem: comparison-reporting
tags: [rust, comparison, reports, sha256, accessibility, claims]
requires:
  - phase: 05-04
    provides: Fail-closed claim and evidence policy
  - phase: 05-05
    provides: Bounded completed measurement evidence
provides:
  - Pure all-dimensions comparison admission
  - One immutable projection shared by UI, JSON, and offline HTML
  - Hash-verifiable accessible offline reports
  - Approval and revocation-gated claim admission
affects: [05-07, 05-08, 05-09, desktop-results]
tech-stack:
  added: []
  patterns: [canonical-projection, all-blockers, tamper-evident-export, history-preserving-revocation]
key-files:
  created:
    - apps/desktop/src-tauri/src/comparison.rs
    - apps/desktop/src-tauri/src/evidence_report.rs
    - apps/desktop/src-tauri/tests/comparison_report.rs
  modified:
    - apps/desktop/src-tauri/src/main.rs
key-decisions:
  - 'A comparison exposes no delta until hardware, workload, methodology, duration, coverage, source health, quality, metric, and unit all agree.'
  - 'HTML and JSON are rendered from one immutable projection and independently hash-verified when reopened.'
  - 'Revocation removes claim admission without removing the comparison history reference.'
requirements-completed: [DIAG-05, MEAS-03, MEAS-04, MEAS-05, MEAS-06]
duration: 14 min
completed: 2026-08-12
status: complete
---

# Phase 05 Plan 06: Canonical Comparison and Reports Summary

**Completed measurements can now produce defensible before/after results, while mismatched or unreliable evidence fails closed and never exposes a misleading delta.**

## Accomplishments

- Added a pure validator that returns every comparison blocker in stable order.
- Prevented absent optional metrics from becoming zero or another numeric placeholder.
- Generated schema-valid accepted and rejected comparison documents.
- Rendered summary, metric diff, provenance timeline, JSON, and accessible self-contained HTML from
  one canonical projection.
- Added SHA-256 verification for JSON and HTML reopen, including tamper rejection.
- Added immutable-approval claim admission whose revocation preserves the audit reference.
- Kept protected serials, MAC addresses, remote resources, and executable content out of reports.

## Task Commits

1. `cd6eb95` — add failing comparison and report invariants.
2. `c63bd2d` — add canonical comparison and offline reports.

## Verification

- Comparison/report suite: 6/6 passed.
- Comparison, measurement, evidence store, and policy integration: 31/31 passed.
- `cargo check -p liiiraa-desktop` passed with zero errors.
- Generated HTML includes language, landmarks, skip link, caption, scoped table headers, responsive
  layout, and reduced-motion handling without external dependencies.

## Safety Boundaries Preserved

- Rejected comparisons contain blockers only, never a delta.
- Degraded, mismatched, missing, or unhealthy evidence cannot support a claim.
- Report HTML and JSON cannot silently diverge or be changed without hash failure.
- Claim revocation does not erase evidence history.
- No Docker or network service is required.

## Self-Check: PASSED

---

_Phase: 05-hardware-intelligence-and-measured-evidence_
_Completed: 2026-08-12_
