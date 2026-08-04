---
phase: 04-identity-commerce-devices-and-administration
plan: "01"
subsystem: supply-chain
tags: [npm, dependency-legitimacy, provenance, human-approval]

requires: []
provides:
  - Human legitimacy approval for 11 exact Phase 4 npm identities and versions
  - Registry, repository, lifecycle-hook, and provenance evidence for the approved pins
affects: [04-04, 04-05, dependency-allowlist, supply-chain]

tech-stack:
  added: []
  patterns:
    - Exact package identity approval is separate from framework behavior and provider adoption
    - Recent-package legitimacy gates remain blocking before installation

key-files:
  created:
    - .planning/phases/04-identity-commerce-devices-and-administration/04-DEPENDENCY-APPROVAL.md
  modified: []

key-decisions:
  - "Approve only the 11 exact Phase 4 npm names and versions for supply-chain legitimacy; do not extend approval to behavior, credentials, provider accounts, commercial terms, production adoption, substitutions, or upgrades."
  - "Keep Better Auth conditional on the native OAuth 2.1/PKCE and security spike in Plan 04-05."

patterns-established:
  - "Exact-pin gate: a human verdict names every allowed package and version before any dependency installation."
  - "Approval separation: package legitimacy never implies product or provider acceptance."

requirements-completed: [WEB-04, WEB-06, IDEN-01, IDEN-09]

duration: 20 min
completed: 2026-08-04
status: complete
---

# Phase 04 Plan 01: Phase 4 npm Identity Approval Summary

**An immutable approval record now admits exactly 11 reviewed npm identities for later Phase 4 installation while preserving every behavioral, security, provider, commercial, and production gate.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-04T19:34:48Z
- **Completed:** 2026-08-04T19:54:48Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Recorded the user's `aprovado` response for all 11 exact package names and versions.
- Captured exact npm registry, official repository, license, consumer lifecycle-hook, integrity/signature, and advertised SLSA provenance evidence.
- Preserved the deny-by-default boundary: no dependency, manifest, lockfile, account, credential, or provider configuration changed.

## Task Commits

Each task was committed atomically:

1. **Task 04-01-01: Verify exact Phase 4 npm identities** - `1bc1458` (docs)

## Files Created/Modified

- `.planning/phases/04-identity-commerce-devices-and-administration/04-DEPENDENCY-APPROVAL.md` - Exact human verdict and evidence boundary for the 11 reviewed npm pins.

## Decisions Made

- The approval applies only to `fastify@5.10.0`, `@fastify/cors@11.3.0`, `@fastify/helmet@13.1.0`, `kysely@0.29.4`, `testcontainers@12.0.4`, `better-auth@1.6.25`, `@better-auth/passkey@1.6.25`, `@better-auth/oauth-provider@1.6.25`, `stripe@22.4.0`, `@aws-sdk/client-s3@3.1102.0`, and `@aws-sdk/client-sesv2@3.1102.0`.
- Package legitimacy does not approve runtime behavior, credentials, provider accounts, commercial terms, production adoption, substitutions, or upgrades.
- Better Auth remains a conditional candidate pending Plan 04-05.

## Verification

- `rtk node tooling/supply-chain/verify-pins.mjs --check` passed: `Verified 60 exact dependency pins, including 34 Phase 2 pins; 34 require explicit review.`
- An exact-content assertion passed for all 11 identities plus the `aprovado`, Plan 04-05, provider-account, and commercial-term boundaries.
- `git diff --name-only -- ":(glob)**/package.json" pnpm-lock.yaml` returned no changes.
- Stub scan returned no `TODO`, `FIXME`, placeholder, coming-soon, or not-available patterns.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The state progress handler correctly calculated 141/175 completed plans as 81% but did not rewrite the stale displayed percentage. The state file was synchronized to the handler's reported `81%` result before the metadata commit.

## User Setup Required

None - no dependency installation, external account, credential, or provider configuration was performed.

## Next Phase Readiness

- Plan 04-04 may later admit only the exact approved identities through the repository allowlist and frozen lockfile workflow.
- Plan 04-05 retains full authority over Better Auth behavioral and security acceptance.
- No blockers were introduced by this plan.

## Self-Check: PASSED

- Approval artifact exists and records 11/11 exact identities.
- Task commit `1bc1458` exists in Git history.
- Automated verifier and acceptance criteria pass.
- No package manifest or lockfile changed.

---

*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-04*
