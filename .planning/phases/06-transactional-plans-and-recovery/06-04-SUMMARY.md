---
phase: 06-transactional-plans-and-recovery
plan: '04'
subsystem: security
tags: [supply-chain, rust, windows-service, crates-io, human-approval]
requires:
  - phase: 06-transactional-plans-and-recovery
    provides: Pure privileged-boundary dependency policy from Plan 06-02
provides:
  - Human-approved exact windows-service 0.8.1 registry and immutable source identity
  - Executable fail-closed validation of reviewer, checksum, license, source, and pre-install Cargo state
  - Persisted supply-chain evidence that gates privileged dependency admission in Plan 06-13
affects: [06-13, optimizer-service, privileged-broker, supply-chain]
tech-stack:
  added: []
  patterns: [pre-install-dependency-guard, immutable-source-approval, blocking-human-supply-chain-gate]
key-files:
  created:
    - tooling/supply-chain/phase6-windows-service-approval.mjs
    - .planning/phases/06-transactional-plans-and-recovery/06-04-SUPPLY-CHAIN-APPROVAL.md
  modified: []
key-decisions:
  - 'Admit only windows-service 0.8.1 from crates.io and the linked Mullvad source commit after exact human review.'
  - 'Keep Cargo manifests and Cargo.lock unchanged until the downstream privileged-service plan consumes the approved identity.'
patterns-established:
  - 'Privileged dependencies require deterministic pre-install evidence, an explicit non-auto-approvable human verdict, and post-checkpoint mechanical revalidation.'
  - 'Reviewer approval binds name, version, registry, immutable source, checksum, and SPDX license as one indivisible identity.'
requirements-completed: [PLAN-06]
duration: 6 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 04: windows-service Legitimacy Gate Summary

**A persisted human verdict now admits only `windows-service 0.8.1` with live crates.io, immutable Mullvad source, checksum, license, and unchanged pre-install Cargo evidence.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-13T06:37:38Z
- **Completed:** 2026-08-13T06:43:38Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Captured the exact crates.io record, dependency tree, checksum, publisher, SPDX license, source tag, immutable commit, and build/install behavior before any privileged dependency mutation.
- Received the blocking human response `APPROVED windows-service 0.8.1 — Reviewer: Liiiraa` and persisted it verbatim with reviewer identity and UTC timestamp.
- Mechanically revalidated the approved identity against the current official registry and source while proving every guarded Cargo manifest and `Cargo.lock` remains unchanged.

## Task Commits

Each executable task was committed atomically; the human checkpoint performed no repository mutation:

1. **Task 1: Capture the exact pre-install registry and source candidate** - `a3b3deef` (feat)
2. **Task 2: Review windows-service 0.8.1 legitimacy** - human checkpoint, no commit
3. **Task 3: Persist and mechanically validate the reviewer verdict** - `f783ae6a` (docs)

## Files Created/Modified

- `tooling/supply-chain/phase6-windows-service-approval.mjs` - Prepares deterministic PENDING evidence and validates exact PENDING or APPROVED states against official metadata and guarded Cargo hashes.
- `.planning/phases/06-transactional-plans-and-recovery/06-04-SUPPLY-CHAIN-APPROVAL.md` - Stores the exact reviewed package identity, immutable evidence, verbatim reviewer response, and approved verdict.

## Decisions Made

- Approved only `windows-service 0.8.1` from crates.io, checksum `857224b3b211c6f3616921f081ee54721ee3ad2ace2fac6a6337e032f7b4dcf2`, linked Mullvad source commit `aab40570b50c05b8e6f3c375171727e666ee42a0`, and license `MIT OR Apache-2.0`.
- Deferred all dependency and lockfile mutation to Plan 06-13; this plan establishes admission authority without installing privileged code.

## Verification

- `rtk node tooling/supply-chain/phase6-windows-service-approval.mjs validate-pending` passed before recording the verdict and proved all guarded Cargo files matched the prepared hashes.
- `rtk node tooling/supply-chain/phase6-windows-service-approval.mjs validate-approved` passed after recording the verdict and re-fetched the current official registry/source identity.
- A focused machine-record assertion passed for exact APPROVED status, reviewer `Liiiraa`, verbatim response, name, version, source commit, checksum, and license equality.
- `rtk git diff --check` passed, and scoped Cargo diffs remained empty.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Null reviewer fields exist only in the intentional PENDING-record constructor and are replaced by a complete reviewer record before APPROVED validation can succeed.

## Next Phase Readiness

- Plan 06-13 can consume only the exact approved crate identity after repeating this approval preflight.
- A stale, rejected, incomplete, differently named, different-version, source-mismatched, checksum-mismatched, or license-mismatched record remains fail-closed.
- No Cargo dependency or lockfile mutation occurred in this plan.

## Self-Check: PASSED

- Both key files exist.
- Task commits `a3b3deef` and `f783ae6a` exist in repository history.
- The exact APPROVED record passes live mechanical validation.
- All task acceptance criteria and plan-level verification requirements pass.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
