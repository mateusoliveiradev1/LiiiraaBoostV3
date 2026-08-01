---
phase: 03-complete-web-experience
plan: '62'
subsystem: testing
tags: [playwright, screenshots, visual-evidence, sha256, accessibility]

requires:
  - phase: 03-61
    provides: Exact candidate-aware browser, motion, accessibility, and dry-list contracts
  - phase: 03-52
    provides: Rejected G01, G04, and G06 baseline pixels
provides:
  - Immutable rejected post-03-52 G01/G04/G06 archive with SHA-256 identity
  - Exactly 25 mechanically refreshed W01-W18/G01-G07 candidate screenshots
  - Candidate pixels with no human approval or publication authority
affects: [03-63, 03-64, 03-65, visual-review, web-evidence]

tech-stack:
  added: []
  patterns:
    - Archive rejected evidence before any bounded snapshot update
    - Prove exact candidate/project closure with a permanent dry-list gate before update mode

key-files:
  created:
    - .planning/phases/03-complete-web-experience/visuals/rejected-post-03-52/G01-public-final-wide-1440.png
    - .planning/phases/03-complete-web-experience/visuals/rejected-post-03-52/G04-account-final-wide-1440.png
    - .planning/phases/03-complete-web-experience/visuals/rejected-post-03-52/G06-admin-final-wide-1440.png
    - .planning/phases/03-complete-web-experience/visuals/rejected-post-03-52/SHA256SUMS.json
  modified:
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/

key-decisions:
  - 'Rejected post-03-52 G01/G04/G06 remain immutable and independently retrievable after candidate capture.'
  - 'Mechanical capture changes pixels only; all 25 records remain candidate, unapproved, unpublished, and non-authoritative.'
  - 'Update mode runs only after the permanent dry list proves exactly one owning project for every W01-W18/G01-G07 identity.'

patterns-established:
  - 'Capture safety: immutable rejected bytes and candidate bytes are separate durable evidence sets.'
  - 'Bounded update: one explicitly authorized command follows dry-list, browser, motion, archive, and status gates.'

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 1h 52m
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 62: Rejected Archive and Candidate Capture Summary

**Immutable rejected-reference archive plus one exact 25-record Playwright candidate refresh, without qualitative approval or publication promotion**

## Performance

- **Duration:** 1h 52m
- **Started:** 2026-08-01T19:34:10Z
- **Completed:** 2026-08-01T21:26:28Z
- **Tasks:** 2
- **Files modified:** 29

## Accomplishments

- Preserved the rejected post-03-52 G01, G04, and G06 bytes before candidate overwrite, including byte size, lowercase SHA-256, owner, rejection status, and source revision `0823833cf3584a16eed5b30e5dd74aa2912724bf`.
- Passed the permanent 25-pair dry-list gate, the candidate-aware browser matrix, and the unfiltered Section 17 motion contract before entering update mode.
- Ran one user-authorized mechanical update that regenerated exactly W01-W18 and G01-G07 with no extra file, source, harness, manifest, approval, UAT, report, or publication changes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Archive rejected G01, G04, and G06 immutably** - `21f41d8` (chore)
2. **Task 2: Perform one mechanical closed-matrix candidate update** - `ee3c1ce` (test)

## Files Created/Modified

- `.planning/phases/03-complete-web-experience/visuals/rejected-post-03-52/` - Independent rejected G01/G04/G06 PNGs and immutable identity metadata.
- `tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/` - Exact mechanically refreshed 18 canonical and 7 qualitative-review candidate PNGs.

## Decisions Made

- Kept evidence states separate: archived pixels are rejected references, while refreshed pixels are candidates only.
- Required exact pre-enumeration ownership before update mode; runtime skips alone are not accepted as proof of a bounded writer set.
- Made no visual judgment. Plans 03-63 through 03-65 retain qualitative inspection ownership, and human/publication gates remain closed.

## Deviations from Plan

### Resolved Blocking Issues

**1. [Rule 3 - Blocking] Routed missing update-only capture path to the Plan 03-61 harness owner**

- **Found during:** Task 2 preflight
- **Issue:** Commit `2350137` had removed every screenshot assertion, so the planned update command could not write candidate pixels.
- **Fix:** Stopped before consuming update mode; the owning plan restored a bounded, default-off capture path in `ee9b2d9` and documented it in `979f4c1`.
- **Files modified by owner:** `tooling/web-evidence/tests/accessibility-responsive.spec.ts`, `tooling/web-evidence/playwright.config.ts`
- **Verification:** Candidate mode remained inactive during ordinary runs and activated only with the explicit update flag.

**2. [Rule 3 - Blocking] Routed zero-candidate project selection to the Plan 03-61 harness owner**

- **Found during:** Task 2 first authorized update attempt
- **Issue:** Candidate title tags did not match final-project grep, so the command passed ordinary checks while selecting zero screenshot writers.
- **Fix:** Stopped without retrying; the owner bound every candidate to one exact project and added a permanent dry-list contract in `922ea82`, documented by `a28aa00`.
- **Files modified by owner:** `tooling/web-evidence/playwright.config.ts`, `tooling/web-evidence/tests/accessibility-responsive.spec.ts`, `tooling/web-evidence/src/candidate-capture-selection.test.ts`
- **Verification:** Dry-list test passed 1/1 with exactly 25 unique project/ID pairs; ordinary matrix executed all candidate routes with capture disabled.

---

**Total deviations:** 2 blocking issues routed to their owning dependency and resolved before the final authorized attempt.
**Impact on plan:** Execution remained bounded. No second update was run automatically, no source ownership was crossed, and the final attempt wrote exactly the planned 25 candidates.

## Issues Encountered

- An early unfiltered motion preflight encountered a transient corrupted Playwright bundle containing an unexpected NUL byte. Runtime integrity was re-established and the exact unfiltered suite passed before update mode.
- Two prior bounded attempts produced zero candidate changes. Each stopped at the checkpoint as required; the final attempt proceeded only after explicit user authorization and permanent selection proof.

## Verification

- Permanent candidate dry-list: 1 passed; exactly 25 tests in one file and 25 unique manifest/project identities.
- Candidate-aware ordinary browser matrix: 55 passed, 263 intentional skips, 0 failed; update mode disabled.
- Unfiltered motion contract: 5 passed, 40 intentional skips, 0 failed.
- Authorized update command: 44 passed, 152 intentional skips, 0 failed; Playwright explicitly regenerated 25 candidates.
- Git diff before commit contained exactly the 25 manifest PNG paths and no other tracked file.
- Every PNG was nonempty, had a 64-character lowercase SHA-256, matched its declared viewport width, and had full-page height at least the declared viewport height.
- Rejected archive identity passed before and after update: G01 `45c2e171e9d9b2c296649eb6898cab3d1c1ccc50b10f54c9cd0fb6fec68809e2`, G04 `7699c77be6ed99f44f13c28dd653a918abca39a604daf6f4f0debb1fd92c134b`, G06 `83b2a631b06583d33d0f2961801c74a9292b46ef4603df1227ea678921309b6f`.

### Candidate Dimensions and SHA-256

| ID | Dimensions | SHA-256 |
|---|---:|---|
| W01 | 1440×3212 | `6e58fa2a9265949944a9c5162abbfa762847737e78877dfdd1633d8c148482f4` |
| W02 | 390×4329 | `910bbc21263189b2a90993b6c5002cd3d25ff2acd31dc3430c786c5db094d230` |
| W03 | 1280×1473 | `bda5e79c8782e0f726266ea5d16961c5a00857be57d29cae5a9abb7477316b34` |
| W04 | 1280×2336 | `65b714311f45d3a5506ce3cf0c025b9a0dd595292a906940e7f0f23593f0c6c7` |
| W05 | 1280×3215 | `4460e175bd9b55ca8f44819bde7c6380b022918de350472cb61c64e1b00e0062` |
| W06 | 960×1157 | `da9906f6e175964ec52ced96f91165d8eeed2a18892426c8f4f9f667e37eb119` |
| W07 | 1440×3897 | `ba2caf9287b546c1e2a7b436b7a9e1d8edf03e1edc9d297967c30678adcab2ac` |
| W08 | 1440×3723 | `7e4affd71fd29ac9af48d56e361089954b1887b6334ec48d970f834ad70b3279` |
| W09 | 1280×1452 | `fa0b57b6363823c30d540c88e7d14e8967755acec284f38b062ea487f5d3229b` |
| W10 | 960×974 | `1384b104f9b6519f684de38e24f2eba967cc84ede81d907ee93b2659831f9517` |
| W11 | 1440×1025 | `cde78133e64b7e5f1b34a57caca12e2ace9a436d8eba3e7e53df14ee5e256204` |
| W12 | 1280×1049 | `d551aed5d83b20b88aa5bcba717ee2d521cb5c445aa7333c413e65faf8b1000c` |
| W13 | 1280×999 | `9e4f8fd5947f147ad143990f33fbb75dccef365c6ee5d5332e1ce2ca94039261` |
| W14 | 1440×2445 | `ab0ed8139f0641a713c619cb7e15eeab6f92916a927a8fa7ef550e6c08aff77b` |
| W15 | 1440×2377 | `07383504a78494f15eb516c78e851cc6522d613ccf2d0c5c886c3dff7acc1d28` |
| W16 | 390×3588 | `a1ab2808371fc37aeef4e3e68e64c151181331c6df5eec01f672c4bc4e989fd0` |
| W17 | 960×932 | `485a9204561f7484640825d313e7bb45aee09eb599c5b38d686fed37cc4c4128` |
| W18 | 320×1625 | `e201a870d845a3a9dc12f94f4d0c3422563add276a52af3adfb27e5b490a59ce` |
| G01 | 1440×3212 | `6e58fa2a9265949944a9c5162abbfa762847737e78877dfdd1633d8c148482f4` |
| G02 | 390×4329 | `910bbc21263189b2a90993b6c5002cd3d25ff2acd31dc3430c786c5db094d230` |
| G03 | 390×1859 | `c045574413c3bd9a3be5b042af680bc1f5f79946c518250ec62e3f3ffe214862` |
| G04 | 1440×974 | `b50d8259433c245c6abb5939ca36ca27e420c6fd583487de0fc0f7adee5544e5` |
| G05 | 390×1560 | `8cdb7a5c4b110b8d15a8cd74a875fb38c2285a75774af9d371e566b3ec4bc0fa` |
| G06 | 1440×1113 | `01246eb7729d8c368684da68623039bf4536cc6f17bb035686052f7a089520dc` |
| G07 | 390×4028 | `c131485f71daa9c24d3eadae7eed9b825b010a319d41a80182b5901812a13a14` |

## Known Stubs

None - the plan changed only archive metadata and PNG evidence; no UI data source or placeholder was introduced.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-63 through 03-65 can inspect the mechanically refreshed public, account, and admin candidate sets against the immutable rejected references.
- Candidate status grants no qualitative, human, UAT, report, publication, or distribution approval.

## Self-Check: PASSED

- Confirmed the three archived PNGs exist, are nonempty, and match `SHA256SUMS.json`.
- Confirmed all 25 unique candidate PNGs from commit `ee3c1ce` exist.
- Confirmed task commits `21f41d8` and `ee3c1ce` exist in repository history.
- Confirmed this summary exists at the required phase path.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-08-01_
