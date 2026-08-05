---
phase: 04-identity-commerce-devices-and-administration
plan: "21"
subsystem: desktop-premium-authority
tags: [offline-entitlement, ed25519, exact-byte, capability-policy, tauri, playwright, tdd]

requires:
  - phase: 04-07
    provides: Exact-byte seven-day TypeScript and Rust entitlement verification
  - phase: 04-20
    provides: Native system-browser identity and Windows Credential Manager custody
  - phase: 04-27
    provides: Authenticated signed entitlement issuance, renewal, revocation, and key rotation
  - phase: 04-31
    provides: Owner-bound domain Premium safety RED witnesses
  - phase: 04-34
    provides: Owner-bound desktop entitlement and post-Premium browser RED witnesses
provides:
  - Shared start, continue, and safety capability policy with non-accusatory bilingual notices
  - Native exact-byte PremiumAuthority renewal and authorization boundary
  - Desktop route gate that blocks only new Premium work while retaining continuation and safety access
  - Browser evidence for verified offline admission, approaching expiry, expiry, continuity, and post-Premium safety
affects: [04-23, 04-35, phase-05, phase-06, phase-07, phase-08]

tech-stack:
  added: []
  patterns:
    - Explicit start/continue/safety authorization instead of one Premium boolean
    - Exact received envelope bytes retained only after Ed25519 and contract verification
    - Native authority remains the execution gate while renderer policy controls truthful presentation

key-files:
  created:
    - packages/control-plane-domain/src/entitlements/paid-action-policy.ts
    - apps/desktop/src-tauri/src/premium_authority.rs
    - apps/desktop/src-tauri/tests/premium_authority.rs
  modified:
    - packages/control-plane-domain/src/entitlements/paid-action-policy.test.ts
    - packages/control-plane-domain/src/index.ts
    - packages/control-plane-domain/package.json
    - apps/desktop/src-tauri/src/offline_entitlement.rs
    - apps/desktop/src-tauri/src/main.rs
    - apps/desktop/src/app.tsx
    - apps/desktop/src/app.css
    - apps/desktop/src/index.ts
    - apps/desktop/tests/browser/fixtures.ts
    - apps/desktop/tests/browser/entitlement-expiry.spec.ts
    - apps/desktop/tests/browser/post-premium-safety.spec.ts
    - apps/desktop/package.json
    - pnpm-lock.yaml
    - tooling/architecture-tests/src/check-workspace.test.ts

key-decisions:
  - "Authorize new paid work, continuation, and safety capabilities independently; entitlement loss never implies automatic reversion or interruption."
  - "Retain the exact received envelope bytes only after the existing exact-byte verifier admits signature, schema, account, device, version, time, and key state."
  - "Treat generic renderer offline state as stale; only an explicit native-verified offline-valid verdict may admit a new Premium action."
  - "Keep native authorization authoritative even though the renderer consumes the same browser-neutral domain policy for presentation and interaction gating."

requirements-completed: [IDEN-06, IDEN-07, IDEN-08]

metrics:
  duration: 23 min
  completed: 2026-08-05
  tasks: 1
  files: 17
status: complete
---

# Phase 04 Plan 21: Seven-Day Offline Premium Boundary Summary

**Seven-day exact-byte Premium authority now admits verified offline starts, renews silently on authenticated contact, and blocks only the next new paid action after expiry, revocation, or contradiction while active work and recovery remain available.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-08-05T16:19:55Z
- **Completed:** 2026-08-05T16:42:24Z
- **Tasks:** 1 TDD feature
- **Files modified:** 17

## Accomplishments

- Replaced the four inherited owner-bound domain sentinels with a 28-row policy matrix spanning valid, verified-offline, approaching-expiry, stale, expired, revoked, tampered, clock-rollback, and contradictory authority.
- Added native `PremiumAuthority`, `renew_offline_entitlement`, and `authorize_capability` behavior over the existing exact-byte Ed25519 verifier, retaining the exact received envelope bytes only after complete admission.
- Preserved active-game and in-flight continuation plus diagnostic history, warnings, diagnostics, existing-change review, restoration, and account access independently from new-work authorization.
- Promoted all five Plan 04-34 browser witnesses and added verified-offline and approaching-expiry journeys, producing seven passing browser boundary cases.
- Centralized renderer entry-point gating on the public domain policy while keeping unavailable Phase 5-8 operations inert and native authorization authoritative.

## TDD Gates

### RED

- `ed8af3c` — `test(04-21): add failing Premium authority matrix`
- TypeScript: 28/28 policy cases failed only at `EXPECTED_RED[04-21-01]` after the focused test runner was corrected to collect entitlements.
- Rust: 7/7 initial authority cases failed only at the 04-21 renewal or capability sentinel.
- Browser: the inherited five journeys failed only at their Plan 04-34 owner-bound 04-21 sentinels.

### GREEN

- `24d9fb7` — `feat(04-21): enforce offline Premium capability boundary`
- Domain, Rust, browser, type, build, lockfile, and architecture gates passed with the centralized implementation.

### REFACTOR / HARDEN

- No behavior-neutral refactor commit was necessary.
- `f5599d3` — `fix(04-21): require verified offline authority in renderer`
- Generic offline presentation can no longer self-grant Premium; an explicit verified offline verdict is required, with additional browser evidence for valid offline admission and approaching-expiry warning.

## Task Commits

1. **RED — executable Premium capability matrix** — `ed8af3c` (`test`)
2. **GREEN — shared and native Premium authority** — `24d9fb7` (`feat`)
3. **Security hardening — verified renderer offline authority** — `f5599d3` (`fix`)

## Files Created/Modified

- `packages/control-plane-domain/src/entitlements/paid-action-policy.ts` — browser-neutral capability states, decisions, and bilingual non-accusatory notice mapping.
- `packages/control-plane-domain/src/entitlements/paid-action-policy.test.ts` — full start/continue/safety matrix across nine authority states.
- `apps/desktop/src-tauri/src/premium_authority.rs` — exact-envelope renewal, revocation, expiry/rollback classification, approaching-expiry warning, and safety-preserving authorization.
- `apps/desktop/src-tauri/tests/premium_authority.rs` — eight native exact-byte renewal and capability tests.
- `apps/desktop/src/app.tsx` and `apps/desktop/src/app.css` — centralized route classification, inert new-work surfaces, retained safety controls, and localized authority guidance.
- `apps/desktop/tests/browser/entitlement-expiry.spec.ts` and `post-premium-safety.spec.ts` — seven green end-to-end boundary journeys with the original coverage retained.
- Desktop/domain public roots, manifests, lockfile, fixture bootstrap, and architecture snapshot — explicit public dependency and typed verified-authority composition.

## Decisions Made

- New paid starts require valid authority; continuation and safety capability decisions never consult one shared deny boolean.
- Authenticated renewal stores the received envelope byte sequence unchanged only after exact payload bytes pass signature, generated-schema, binding, version, key-window, expiry, and monotonic-time verification.
- Revocation and contradictory renewal clear cached start authority but do not remove local evidence or safety capability access.
- A renderer's generic connectivity state is not licensing authority. `offline-valid` must be supplied from a verified native result; absent that proof, new paid work fails closed as stale.
- Approaching expiry warns without blocking; normal valid online renewal and valid offline use remain silent.

## Verification Results

- `rtk pnpm --filter @liiiraa/control-plane-domain test -- --run paid-action-policy`: **PASS** — 53/53 package tests, including all 28 policy cases.
- `rtk cargo test -p liiiraa-desktop premium_authority`: **PASS** — 8/8 focused native authority tests.
- `rtk cargo test -p liiiraa-desktop offline_entitlement`: **PASS** — 16/16 exact-byte verifier tests.
- `rtk pnpm --filter @liiiraa/desktop exec playwright test ... --project=chromium`: **PASS** — 7/7 expiry, verified-offline, warning, continuation, history, security-warning, and restoration journeys in 4.6 seconds.
- `rtk cargo build -p liiiraa-desktop`: **PASS** — packaged host compiled in 0.24 seconds.
- Domain and desktop strict TypeScript checks: **PASS**.
- Desktop focused unit suite: **PASS** — 10/10 app tests.
- `rtk pnpm install --frozen-lockfile --offline --ignore-scripts`: **PASS** — workspace dependency and lockfile remain consistent without network or lifecycle scripts.
- `rtk pnpm run test:architecture`: **PASS** — both live adapters and 46/46 architecture tests passed.
- Rustfmt, Prettier, diff, deletion, owner-sentinel, and stub scans: **PASS**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected false-green focused test collection**

- **Found during:** RED baseline
- **Issue:** The domain script excluded `src/entitlements`, and the Rust filter initially matched zero authority tests, so both planned commands could exit successfully without exercising Plan 04-21.
- **Fix:** Added the entitlement directory to the domain test script and named every Rust witness with the `premium_authority` filter identity.
- **Files modified:** `packages/control-plane-domain/package.json`, `apps/desktop/src-tauri/tests/premium_authority.rs`
- **Verification:** The RED run produced 28 TypeScript and 7 Rust owner-tagged failures; GREEN now produces 53/53 TypeScript and 8/8 Rust passes.
- **Committed in:** `ed8af3c`

**2. [Rule 2 - Missing Critical] Wired the shared policy into every desktop Premium route boundary**

- **Found during:** GREEN integration
- **Issue:** The planned domain and Rust files alone could not make every renderer Premium entry point consume the centralized start/continue/safety decision or promote the browser witnesses.
- **Fix:** Added the public workspace dependency, route classifier, inert new-work boundary, retained continuation/safety surfaces, typed test composition, styling, and browser-sentinel promotion.
- **Files modified:** Desktop manifest/lockfile, `app.tsx`, `app.css`, `index.ts`, browser fixtures/specs, domain public root
- **Verification:** Seven browser journeys, desktop typecheck/build, and architecture gates pass.
- **Committed in:** `24d9fb7`, `f5599d3`

**3. [Rule 3 - Blocking] Updated the executable architecture dependency snapshot**

- **Found during:** Overall architecture verification
- **Issue:** The live graph correctly discovered desktop's new public domain dependency, but the Phase 2 manifest snapshot still expected the earlier dependency set.
- **Fix:** Added `@liiiraa/control-plane-domain` to the desktop-app expected public workspace dependencies.
- **Files modified:** `tooling/architecture-tests/src/check-workspace.test.ts`
- **Verification:** Both live architecture adapters and all 46 tests pass.
- **Committed in:** `24d9fb7`

**4. [Rule 1 - Security Bug] Prevented generic offline UI state from self-granting Premium**

- **Found during:** Post-GREEN security review
- **Issue:** Treating a generic connectivity-offline state as `offline-valid` would let renderer state imply licensing authority without a verified signed envelope.
- **Fix:** Generic offline now fails closed as stale. Only an explicit typed `offline-valid` result may admit new work, while native `PremiumAuthority` remains the actual execution boundary.
- **Files modified:** `apps/desktop/src/app.tsx`, `apps/desktop/src/index.ts`, browser fixtures and entitlement spec
- **Verification:** The seven browser journeys prove stale/expired denial, verified offline admission, approaching warning, continuation, and safety behavior.
- **Committed in:** `f5599d3`

**5. [Rule 1 - Tooling Drift] Restored byte-minimal lockfile changes after formatter expansion**

- **Found during:** GREEN formatting
- **Issue:** A broad formatter invocation rewrote thousands of unchanged lockfile lines while adding one workspace link.
- **Fix:** Restored the specific lockfile and reapplied only the three-line desktop importer entry.
- **Files modified:** `pnpm-lock.yaml`
- **Verification:** The final diff is three added lines and frozen offline install passes.
- **Committed in:** `24d9fb7`

---

**Total deviations:** 5 auto-fixed (2 blocking integration issues, 2 correctness/security bugs, 1 tooling-drift correction).
**Impact on plan:** Every adjustment was required to execute the intended witnesses, connect the planned central policy, preserve fail-closed authority, or keep the lockfile reviewable. No provider, network endpoint, Docker service, or Phase 5-8 native operation was added.

## Known Stubs

None. All Plan 04-31 and 04-34 `EXPECTED_RED[04-21-01]` sentinels were promoted and removed after their full behavior assertions turned green.

## Issues Encountered

- The initial planned focused commands were false green because their filters did not collect the new authority suites; the RED gate was repaired before implementation.
- The first architecture snapshot edit matched the adjacent feature-shell dependency list instead of desktop-app; the exact entry was corrected and the full gate rerun to green.
- Existing Vite font-resolution, dynamic-import, and chunk-size messages remained warnings only and did not affect the focused browser result.

## Authentication Gates

None.

## User Setup Required

None. All evidence was deterministic and daemon-free. Docker, Docker Desktop, Testcontainers, provider credentials, external services, and network provisioning were not used.

## Next Phase Readiness

- Plan 04-35 can project verified native Premium authority into synchronized account state without granting renderer custody over credentials or signed-envelope execution authority.
- Phase 5-8 operations can call the native start/continue/safety gate; unavailable operations remain inert rather than fabricated.
- No blocker remains for Plan 04-21.

## Self-Check: PASSED

- The summary and all three declared created implementation/test artifacts exist on disk.
- RED `ed8af3c`, GREEN `24d9fb7`, and security hardening `f5599d3` exist in repository history in order.
- Focused TypeScript, Rust, browser, build, type, unit, lockfile, architecture, formatting, sentinel, stub, and deletion gates pass.
- No tracked files were deleted; `.impeccable/` and `apps/desktop/src-tauri/gen/` remain untouched, untracked, and unstaged.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
