---
phase: 04-identity-commerce-devices-and-administration
plan: '18'
subsystem: account
tags: [react, nextjs, generated-contracts, optimistic-concurrency, playwright, accessibility]

requires:
  - phase: 04-17
    provides: Atomic owner-authorized account projection and versioned mutation routes
  - phase: 04-34
    provides: Account browser authority witnesses and canonical Playwright axis
provides:
  - Generated-contract account authority adapter with owner-consistent projection admission
  - Production account runtime with truthful online, offline, stale, pending, and conflict observations
  - Bilingual browser evidence for identity, security, commerce, device, support, consent, and sign-out journeys
  - Production fixture-isolation and byte-stable Phase 3 visual evidence
affects: [04-19, 04-20, 04-21, account-ui, web-evidence, production-composition]

tech-stack:
  added: []
  patterns:
    - Generated control-plane validation before account projection use
    - ETag and expectedVersion optimistic concurrency on account mutation
    - Explicit production and preview runtime separation

key-files:
  created:
    - apps/account/src/account-authority.ts
    - apps/account/src/account-runtime-server.ts
    - apps/account/src/account-runtime.ts
    - apps/account/src/features/account-authority.tsx
  modified:
    - apps/account/src/app/[locale]/[[...responsibility]]/page.tsx
    - apps/account/src/app/[locale]/layout.tsx
    - apps/account/src/features/account-authority.test.tsx
    - tooling/web-evidence/tests/account-authority.spec.ts
    - tooling/architecture-tests/src/check-workspace.test.ts

key-decisions:
  - 'Validate every generated account component and require one account owner before exposing a production projection.'
  - 'Bind profile PATCH requests to the same optimistic-concurrency claim through If-Match and command expectedVersion.'
  - 'Default deployable account composition to production while keeping preview authority explicit and absent from emitted production code.'

patterns-established:
  - 'Conflict continuity: retain remote authority and a bounded local draft so the user can review rather than lose work.'
  - 'Observation fidelity: model online, offline, stale, pending, and conflict independently from mutation workflow phases.'

requirements-completed: [WEB-04, WEB-05, IDEN-01, IDEN-02, IDEN-04]

duration: 31min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 18: Account Authority Activation Summary

**Generated-contract account authority with versioned profile mutation, conflict-safe drafts, complete bilingual journeys, and production fixture isolation**

## Performance

- **Duration:** 31 min
- **Started:** 2026-08-05T06:33:27Z
- **Completed:** 2026-08-05T07:04:28Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Activated the account application against server-owned identity, security, session, subscription, invoice, device, and support projections.
- Added validated same-origin reads and CSRF-protected profile PATCH commands bound to both ETag and aggregate version.
- Preserved server truth and a bounded local draft during conflicts while distinguishing pending, offline, stale, and error outcomes.
- Proved bilingual security, commerce, device, support, consent, conflict, offline, and sign-out journeys with accessibility-first browser locators.
- Kept preview composition deterministic for visual evidence while emitted production JavaScript contains no preview-authority import or symbol.

## Task Commits

Each task was committed atomically:

1. **Task 04-18-01: Add production account authority composition**
   - `0d0ade3` — RED account authority witness
   - `c28b1b7` — RED runtime and interruption-state witness
   - `47de8ad` — GREEN versioned account authority implementation
   - `c09b218` — test matrix normalization and strict type hardening
2. **Task 04-18-02: Prove full account journeys and accessibility**
   - `71d1772` — complete browser authority journey evidence

Additional scoped correction:

- `eb8dc31` — align the architecture dependency witness with generated-contract account ownership

## Files Created/Modified

- `apps/account/src/account-authority.ts` — validates and transports canonical account projections and mutations.
- `apps/account/src/account-runtime.ts` — selects production or explicit preview composition and maps authoritative projections.
- `apps/account/src/account-runtime-server.ts` — resolves server-only runtime configuration.
- `apps/account/src/features/account-authority.tsx` — renders production responsibilities and truthful workflow states.
- `apps/account/src/features/account-authority.test.tsx` — exercises authority, mutation, conflict, degraded observations, and fixture isolation.
- `apps/account/src/app/[locale]/[[...responsibility]]/page.tsx` — composes production account routes.
- `apps/account/src/app/[locale]/layout.tsx` — exposes the runtime class for browser verification.
- `tooling/web-evidence/tests/account-authority.spec.ts` — proves complete bilingual production-account journeys.
- `tooling/web-evidence/playwright.config.ts` — supports the canonical account authority evidence axis.
- `tooling/architecture-tests/src/check-workspace.test.ts` — records the account package's generated-contract dependency.

## Decisions Made

- Admit a projection only after generated document validation and cross-component account ownership agree.
- Send profile mutations with cookies, CSRF, correlation identity, `If-Match`, and the same generated command `expectedVersion`.
- Keep the preview package as test/development authority only; production composition defaults to the real adapter and production output is scanned for leakage.
- Keep remote truth authoritative on conflict while retaining only the bounded local profile draft needed for user review.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added an accessible name to the profile conflict alert**

- **Found during:** Task 04-18-02 browser verification
- **Issue:** The conflict alert exposed correct content but had no stable accessible name for the accessibility-first journey.
- **Fix:** Added localized `Profile update conflict` / `Conflito na atualização do perfil` labeling.
- **Files modified:** `apps/account/src/features/account-authority.tsx`
- **Verification:** Authority smoke passed 4/4 and W18 accessibility passed 4/4.
- **Committed in:** `71d1772`

**2. [Rule 3 - Blocking] Updated architecture dependency parity for generated account contracts**

- **Found during:** Overall architecture verification
- **Issue:** The account manifest correctly gained `@liiiraa/contracts-ts`, but the architecture witness still expected the earlier Phase 3 dependency set.
- **Fix:** Added the generated-contract dependency to the canonical account workspace expectation.
- **Files modified:** `tooling/architecture-tests/src/check-workspace.test.ts`
- **Verification:** Architecture suite passed 46/46 with both workspace and Cargo adapters executed.
- **Committed in:** `eb8dc31`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking issue)
**Impact on plan:** Both corrections were required for accessibility and architecture correctness; no feature scope was added.

## Issues Encountered

- The production leak scan initially reported stale `.next/dev` hot-update artifacts and standalone package manifests. The authoritative scan was narrowed to emitted production JavaScript under `.next/server`, `.next/static`, and `.next/standalone`; it found no preview-authority imports or symbols.

## Verification

- Account authority unit matrix: 76 passed.
- Account authority browser smoke: 4 passed.
- Existing Phase 3 account journey suite: 11 passed.
- W18 accessibility axes: 4 passed.
- Byte-stability account matrix: 134 passed, 48 intentionally skipped by project-axis selection.
- Architecture suite: 46 passed.
- Runtime fixture guard: 13 passed.
- Production fixture guard: 13 passed.
- Account strict TypeScript, web-evidence strict TypeScript, focused ESLint, Prettier, and Next production build: passed.
- Production emitted JavaScript preview scan: no matches.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Account routes now consume canonical control-plane authority without losing Phase 3 UX or deterministic preview evidence.
- Identity, commerce, device, support, and consent flows have reusable browser journey IDs for downstream account work.
- No blocker remains for dependent Phase 04 plans.

## Self-Check: PASSED

All declared key files exist and commits `0d0ade3`, `c28b1b7`, `47de8ad`, `c09b218`, `71d1772`, and `eb8dc31` are present in repository history.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
