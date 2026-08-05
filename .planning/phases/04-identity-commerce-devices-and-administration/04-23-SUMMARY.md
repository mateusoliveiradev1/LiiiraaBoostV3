---
phase: 04-identity-commerce-devices-and-administration
plan: '23'
subsystem: staging-deployment
tags: [vercel, tauri, staging, oauth, playwright, release-channel]

requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: Invitation-only staging API, account/admin production authority adapters, offline entitlement, and desktop account authority from Plans 04-18, 04-19, 04-21, 04-22, and 04-35
provides:
  - Three isolated noindex Vercel staging project contracts on one exact staging API authority
  - Protected origin, session, consent, and broader-beta promotion workflow gates
  - Closed numbered Internal desktop manifest with exact staging authority and immutable rollback identity
  - Shared runtime and CI admission that forbids public release and trusted-installer claims
affects: [04-24, 04-25, 04-26, staging, closed-beta, desktop-release]

tech-stack:
  added: []
  patterns:
    - Same-origin Vercel API proxy with host-only session isolation per surface
    - One closed Internal manifest admitted by both runtime and CI

key-files:
  created:
    - apps/web/vercel.json
    - apps/account/vercel.json
    - apps/admin/vercel.json
    - apps/desktop/src/staging-runtime.ts
    - apps/desktop/src-tauri/tauri.staging.conf.json
    - apps/desktop/staging/internal-channel.schema.json
    - apps/desktop/staging/internal-channel.json
    - apps/desktop/staging/CHANGE-NOTES.md
    - apps/desktop/scripts/validate-internal-channel.mjs
  modified:
    - .github/workflows/phase-4-surfaces.yml
    - tooling/web-evidence/playwright.config.ts
    - tooling/web-evidence/src/playwright-config.test.ts
    - tooling/web-evidence/tests/security-artifacts.spec.ts
    - apps/desktop/src/internal-channel.test.ts

key-decisions:
  - 'Keep public, account, and admin on distinct Vercel project identities while routing only same-origin /v1 traffic to the exact staging API.'
  - 'Treat provider preview URLs as bounded early-test identities; broader closed beta requires owned origins, callbacks, and email identity.'
  - 'Admit only the numbered Internal desktop channel with invited-PC access, exact staging authority, older immutable rollback, and every public trust claim false.'

patterns-established:
  - 'Origin isolation: every staging surface owns its deployment, security headers, and host-only session boundary.'
  - 'Restricted channel admission: schema, runtime, overlay, checked-in manifest, and CI must agree on one immutable non-production identity.'

requirements-completed: [WEB-04, WEB-05, WEB-06, WEB-07, IDEN-01, IDEN-06]

duration: 12min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 23: Isolated Staging Surfaces and Restricted Internal Channel Summary

**Three origin-isolated Vercel staging surfaces and a closed `Internal #023001` desktop channel with exact authority, rollback, and non-public trust admission**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-05T17:25:43Z
- **Completed:** 2026-08-05T17:37:43Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Defined distinct public, account, and admin Vercel projects with noindex behavior, surface-appropriate cache policy, exact same-origin `/v1` staging API proxying, and host-only session isolation.
- Added protected CI environments for isolated deployments, live cross-origin/session/consent probes, and a fail-closed owned-identity gate before broader closed beta.
- Added a closed Internal manifest/schema, production-distinct Tauri overlay, change notes, shared runtime admission, and CI validator for numbered build `internal-023001` with rollback to `internal-023000`.
- Rejected Stable, Beta, Experimental, public access/download, trusted publisher, production readiness, mutable rollback, non-monotonic numbering, and mismatched API/contract/entitlement authority.

## Task Commits

1. **Task 04-23-01: isolated Vercel staging origins** - `5177045` (feat)
2. **Task 04-23-02 RED: Internal channel behavioral contract** - `6e43e34` (test)
3. **Task 04-23-02 GREEN: restricted Internal channel** - `c202a72` (feat)
4. **Task 04-23-02 audit fix: exact source commit identity** - `f42b33e` (fix)

## Files Created/Modified

- `apps/{web,account,admin}/vercel.json` - Independent project identity, headers, and exact staging API proxy contracts.
- `.github/workflows/phase-4-surfaces.yml` - Protected deployment, isolation smoke, broader-beta identity, and desktop Internal admission jobs.
- `tooling/web-evidence/playwright.config.ts` - Daemon-free staging-origin verification mode.
- `tooling/web-evidence/src/playwright-config.test.ts` - Static staging config coverage.
- `tooling/web-evidence/tests/security-artifacts.spec.ts` - Static and hosted origin/session/consent fail-closed probes.
- `apps/desktop/src/internal-channel.test.ts` - TDD contract for manifest, runtime, rollback, overlay, and CI identity.
- `apps/desktop/src/staging-runtime.ts` - Closed manifest, exact staging authority, immutable identity, and rollback admission.
- `apps/desktop/src-tauri/tauri.staging.conf.json` - Production-distinct `Internal #023001` overlay with updater publication disabled.
- `apps/desktop/staging/internal-channel.schema.json` - Closed JSON Schema for the restricted manifest.
- `apps/desktop/staging/internal-channel.json` - Exact numbered Internal channel identity and non-public trust record.
- `apps/desktop/staging/CHANGE-NOTES.md` - Invited-PC scope, limitations, and rollback truth.
- `apps/desktop/scripts/validate-internal-channel.mjs` - CI projection using the runtime admission function.

## Decisions Made

- Each web surface keeps its own deployment identity and host-only session cookie; sharing a parent-domain cookie is not permitted.
- Vercel and Render provider URLs are allowed only for bounded early testing. Promotion rejects provider/example identities until owned origin, callback, and email identities exist.
- The Internal manifest is the immutable source for channel, build, source commit, staging authority, entitlement key, trust, and rollback. Neither CI nor the runtime may widen it.
- Phase 4 records development-only signing truth and disables updater artifacts; no trusted public installer, production readiness, or distribution authority is claimed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added a shared CI manifest validator**

- **Found during:** Task 04-23-02 GREEN
- **Issue:** The plan required runtime/CI projection deduplication but did not list a validator file capable of executing the shared admission boundary.
- **Fix:** Added `validate-internal-channel.mjs` and invoked it with exact channel/build/rollback flags in the protected desktop job.
- **Verification:** Static validator and 18 focused tests pass.
- **Committed in:** `c202a72`

**2. [Rule 1 - Bug] Corrected invalid workflow scalar syntax**

- **Found during:** Task 04-23-02 formatting
- **Issue:** Task 1's inline JavaScript `run:` values contained YAML mapping-sensitive colons and failed the YAML formatter/parser.
- **Fix:** Converted all affected commands to folded YAML scalars without changing command behavior.
- **Verification:** Prettier parses and validates the complete workflow.
- **Committed in:** `c202a72`

**3. [Rule 1 - Bug] Bound the manifest to the exact source commit**

- **Found during:** Final immutable-identity audit
- **Issue:** The initial 40-character commit value was well-formed but did not equal Task 1's authoritative full Git hash.
- **Fix:** Recorded `51770454aa1d17647c4fe734ae1e57f3e0b403b0` and added a regression assertion.
- **Verification:** 18 focused tests and the shared CI validator pass.
- **Committed in:** `f42b33e`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical function).
**Impact on plan:** All changes were required for executable syntax and an honest, shared immutable admission boundary. No external provider, deployment, publication, Docker, or signing state was mutated.

## Issues Encountered

- Adding global Node types to the desktop test program changed browser timer types. The contract instead uses a local expected Node-import diagnostic, preserving the renderer's browser-only type boundary.
- Hosted deployment and live smoke were not invoked because external mutation was outside this execution's authority; they remain protected workflow and user-setup actions.

## User Setup Required

External staging activation remains manual. See [04-USER-SETUP.md](./04-USER-SETUP.md) for separate Vercel projects/environments, sandbox Google/Discord identities, protected desktop admission, and broader-beta owned-identity requirements.

## Verification

- Internal channel focused suite: 18/18 passed.
- Desktop strict TypeScript check: passed.
- Shared checked-in manifest validator: passed.
- Static staging-origin Playwright smoke: 1/1 passed.
- Web evidence suite: 183 passed, 1 skipped.
- Account suite: 76/76 passed.
- Admin suite: 81/81 passed.
- Prettier across all Plan 04-23 implementation artifacts: passed.
- Hosted Vercel deployment, live origin smoke, OAuth configuration, installer publication, Docker, and external signing: intentionally not run.

## Known Stubs

None. `artifact.availability: not-published`, empty updater endpoints, and false trust/provenance claims are deliberate Phase 4 safety truth, not future-value fallbacks.

## Next Phase Readiness

- Plans 04-24 through 04-26 can consume exact isolated staging origins and `internal-023001` evidence for release-readiness gates.
- Actual hosted reachability requires the protected environment and sandbox-provider setup in `04-USER-SETUP.md` plus an authorized workflow run.

## Self-Check: PASSED

- All 12 key implementation, manifest, workflow, setup, and summary artifacts exist.
- Task commits `5177045`, `6e43e34`, `c202a72`, and `f42b33e` are present in order; the TDD RED commit precedes GREEN.
- Focused acceptance, TypeScript, validator, cross-surface, and formatting gates pass.
- No tracked files were deleted; `.impeccable/` and `apps/desktop/src-tauri/gen/` remain untouched and unstaged.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
