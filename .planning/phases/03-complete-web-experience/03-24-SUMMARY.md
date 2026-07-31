---
phase: 03-complete-web-experience
plan: "24"
subsystem: web-release-safety
tags: [typescript, vitest, releases, integrity, fail-closed]
requires:
  - phase: 03-10
    provides: generated web document contracts and runtime validation
  - phase: 03-12
    provides: canonical web routes and controlled origins
  - phase: 03-14
    provides: deterministic published web scenario authority
  - phase: 03-19
    provides: public shell trust language and failure states
  - phase: 03-22
    provides: repository-admitted public content boundaries
provides:
  - generated-contract-first release eligibility decisions
  - exhaustive channel consent and historical release classifications
  - redacted manifest-to-artifact integrity comparison
  - categorical rejection of Phase 2 development artifacts
affects: [03-25, 03-29, 03-32, phase-10-distribution]
tech-stack:
  added: []
  patterns:
    - generated validation before release policy evaluation
    - redacted disagreement classes instead of untrusted values
    - symbolic official origins without invented artifact URLs
key-files:
  created:
    - packages/web-core/src/releases.ts
    - packages/web-core/src/releases.test.ts
  modified:
    - packages/web-core/src/index.ts
key-decisions:
  - "decideDownload validates the unknown record and derives channel selection internally so callers cannot forge a validated or consented state."
  - "Official distribution remains represented by generated origin identifiers; Phase 3 does not invent a host, URL, installer, or artifact."
  - "The available union branch is forward-compatible but unreachable while the generated ReleaseRecord schema requires false approval and an unavailable official artifact."
patterns-established:
  - "Release decisions expose stable reason codes and never echo compared manifest or artifact values."
  - "Blocked decisions carry no download reference, verification steps, post-download guidance, downgrade suggestion, or continue-anyway branch."
requirements-completed: [WEB-03]
duration: 13min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 24: Fail-Closed Release Decision Summary

**Generated-contract-gated download decisions with exhaustive integrity agreement, development-artifact rejection, and no public artifact exposure in Phase 3**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-31T09:19:55.347Z
- **Completed:** 2026-07-31T09:33:08.871Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Added stable-by-default release channel selection with explicit Beta opt-in and a fully separated Experimental risk, audience, support, and update policy.
- Added redacted agreement checks across manifest identity, artifact identity, channel, version, architecture, Windows lifecycle, compatibility, publisher, SHA-256, size, signature, controlled origin, provenance, availability, and approval.
- Ensured the published Phase 3 `ReleaseRecord` resolves to `distribution-not-approved`, while schema mutations, missing evidence, development identities, unsafe history, and consent bypasses remain blocked.
- Defined independent Authenticode, SHA-256, size, version, compatibility, and canonical-manifest verification steps that are returned only by the future available decision branch.

## Task Commits

1. **Task 1: Decide channel, integrity, and public availability without bypass**
   - `db59127` (`test`) — RED contract for release selection, integrity, and no-bypass behavior
   - `8c2c273` (`feat`) — GREEN fail-closed decision engine and public package exports

## Files Created/Modified

- `packages/web-core/src/releases.ts` — Release channel, integrity, history, verification, and download decision engine.
- `packages/web-core/src/releases.test.ts` — Exhaustive mismatch, absence, development identity, approval mutation, history, and consent tests.
- `packages/web-core/src/index.ts` — Public exports for the release decision contract.

## Decisions Made

- `decideDownload` accepts an unknown record and invokes the generated `validateWebDocument` boundary itself; it does not trust a caller-supplied validation result.
- Channel consent is derived inside `decideDownload` from the validated record and direct request input, preventing a forged selection result from bypassing Beta or Experimental policy.
- Controlled origins remain the generated symbolic identifiers `liiiraa-download-origin` and `liiiraa-release-origin`; no artifact host or downloadable object is claimed.
- The current canonical schema is authoritative: attempts to change approval to `true` or the official artifact to `available` fail generated validation before decision logic.

## Verification

- `rtk pnpm --filter @liiiraa/web-core test -- --run -t "fail-closed release decision"` — passed; 97 package tests.
- `rtk pnpm --filter @liiiraa/web-core check` — passed strict TypeScript compilation.
- `rtk pnpm exec prettier --check packages/web-core/src/releases.ts packages/web-core/src/releases.test.ts packages/web-core/src/index.ts` — passed.
- TDD gate — RED `db59127` precedes GREEN `8c2c273`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Strict TypeScript initially required bracket notation for fields inspected through a generic record index. The access was corrected before the GREEN commit, and the complete check passed.

## Known Stubs

None. Empty verification and guidance arrays on blocked decisions are deliberate safety semantics, not placeholders.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The web layer can now render W07/W08 from stable, non-sensitive reason codes without exposing an installer.
- A future distribution phase must first evolve the canonical generated `ReleaseRecord` contract and provide real public-trust evidence; no Phase 3 code or fixture can self-approve.

## Self-Check: PASSED

- All three implementation/test/export files and this summary exist.
- RED `db59127` and GREEN `8c2c273` are present in repository history.
- The final targeted test, strict TypeScript, formatting, and TDD sequence checks passed.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
