---
phase: 02-complete-desktop-experience
plan: "01"
subsystem: supply-chain
tags: [dependency-approval, authenticode, windows-cng, signing]
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Versioned supply-chain verification and modular desktop foundation
provides:
  - Human approval bound to the exact 31 Phase 2 dependency identities
  - Free local development-only Authenticode signing contract
  - Explicit Phase 10 gate for publicly trusted production signing
affects: [02-12, 02-14, 02-31, 02-33, phase-10]
tech-stack:
  added: []
  patterns:
    - Exact dependency approval is bound to an immutable evidence commit and report blob
    - Development signing keys remain non-exportable in the maintainer CurrentUser CNG store
key-files:
  created:
    - .planning/phases/02-complete-desktop-experience/02-SIGNING-DECISION.md
  modified: []
key-decisions:
  - "Phase 2 signing remains free and local: self-signed SHA-256 Authenticode with a non-exportable CurrentUser CNG key."
  - "CI receives no private key and may produce only unsigned, non-distributable development builds."
  - "Publicly trusted commercial signing and release claims remain blocked until Phase 10."
patterns-established:
  - "Approval binding: dependency consumers must match the exact identities approved against commit d43fd0e and report blob 1dccd8497123814bc522364d455aa6e91a56ec83."
  - "Trust labels: development artifacts explicitly deny public trust, SmartScreen reputation, production readiness, and distribution authorization."
requirements-completed: [UX-01, UX-10, UX-11, UX-12]
duration: 7min
completed: 2026-07-27
status: complete
---

# Phase 2 Plan 01: Dependency Approval and Development Signing Summary

**Exact Phase 2 dependencies remain bound to immutable registry evidence, while Windows packaging gains a zero-cost local signing contract that cannot be mistaken for public release trust.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-27T23:03:00Z
- **Completed:** 2026-07-27T23:09:17Z
- **Tasks:** 1 resumed task completed; prior dependency-evidence task verified
- **Files modified:** 1

## Accomplishments

- Verified that commit `d43fd0e` still owns the generated Phase 2 dependency
  evidence and that the current report remains byte-identical to its approved
  blob `1dccd8497123814bc522364d455aa6e91a56ec83`.
- Preserved the human approval for all 31 exact dependency identities, both
  explicit exclusions, and the prohibition on substitutions or additions.
- Recorded a free local Authenticode development contract using Windows CNG,
  SHA-256, code-signing EKU `1.3.6.1.5.5.7.3.3`, and a non-exportable key in
  `Cert:\CurrentUser\My`.
- Denied CI private-key access and all public-trust, SmartScreen, production,
  staging, publication, and distribution claims until the Phase 10 gate.

## Task Commits

Each task outcome was committed atomically:

1. **Completed dependency evidence gate (preserved, not replayed)** —
   `d43fd0e` (`feat`)
2. **Resume task: record free development signing contract** — `b6d1e99`
   (`docs`)

## Files Created/Modified

- `.planning/phases/02-complete-desktop-experience/02-SIGNING-DECISION.md` —
  Defines the zero-cost development certificate, custody, CI, timestamp, trust,
  and Phase 10 release boundaries.
- `.planning/phases/02-complete-desktop-experience/02-DEPENDENCY-APPROVAL.md` —
  Verified unchanged as the non-generated approval record for the exact 31
  identities.
- `architecture/dependency-review.md` — Verified unchanged and still bound to
  its approved git blob.

## Decisions Made

- Everything in Phase 2 remains free; no provider, commercial certificate,
  HSM, timestamp service, or paid runner is selected.
- Plan 02-33 owns local certificate creation and may record only non-secret
  certificate identifiers and access evidence.
- Timestamping is `not-applicable` unless execution verifies an official,
  free, compatible authority; no timestamp claim may be fabricated.
- Trusted commercial signing is mandatory in Phase 10 before public
  distribution or release-ready claims.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected stale human-readable progress values**

- **Found during:** Final GSD tracking update
- **Issue:** The state SDK updated frontmatter and returned 42% progress, but
  left the human-readable progress line at 57% and its completed-plan total at
  22.
- **Fix:** Synchronized the human-readable values to 42% and 23 completed plans
  after the new summary was present.
- **Files modified:** `.planning/STATE.md`
- **Verification:** Frontmatter, current position, progress, and completed-plan
  count now agree with the 23 summaries across 55 plans.

---

**Total deviations:** 1 auto-fixed bug.

## Issues Encountered

The state SDK left two stale display values after successfully returning the
new progress calculation; they were synchronized as documented above.

## User Setup Required

None for this plan. No package was installed and no certificate was created.
Plan 02-33 will create the local development certificate when its execution
gate is reached.

## Known Stubs

None.

## Next Phase Readiness

- Plans 02-14 and 02-31 may consume only the 31 exact identities in the
  approval artifact.
- Plans 02-12 and 02-33 may consume the development-signing contract without
  requiring a paid service.
- Public distribution remains intentionally blocked until Phase 10 verifies a
  trusted signing and timestamp chain.

## Self-Check: PASSED

- Required approval, signing-decision, and summary artifacts exist.
- Commits `d43fd0e` and `b6d1e99` are present in repository history.
- The approved dependency report remains at blob
  `1dccd8497123814bc522364d455aa6e91a56ec83`.
- `verify-pins.mjs --check` verified all 57 repository pins, including all 31
  Phase 2 identities.

---

*Phase: 02-complete-desktop-experience*
*Completed: 2026-07-27*
