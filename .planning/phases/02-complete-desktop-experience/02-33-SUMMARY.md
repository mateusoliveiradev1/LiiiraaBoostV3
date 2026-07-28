---
phase: 02-complete-desktop-experience
plan: '33'
subsystem: desktop-packaging-signing
tags: [tauri, authenticode, cng, windows, evidence, zero-cost]
requires:
  - phase: 02-complete-desktop-experience
    provides: Approved free development-signing decision from Plan 02-01
  - phase: 02-complete-desktop-experience
    provides: Packaged Windows evidence verifier from Plan 02-16
  - phase: 02-complete-desktop-experience
    provides: Pinned non-elevated Tauri shell from Plan 02-25
provides:
  - Exact self-signed development artifact schema and fail-closed packaging workflow
  - Local CurrentUser CNG Authenticode certificate with non-exportable private key
  - Two hash-bound development-signed staged artifacts
  - Separate unsigned and non-promotable CI build record
  - Honest unresolved Windows 10 and Windows 11 packaged-environment records
affects: [02-26, 02-27, packaged-windows-acceptance, phase-10-signing]
tech-stack:
  added: []
  patterns:
    - Free local Authenticode signing with explicit self-signed untrusted-root classification
    - Exact reviewed-or-unresolved Windows image records without fabricated provenance
    - Clean unsigned CI build isolation before local development signing
key-files:
  created:
    - architecture/signed-desktop-artifact.schema.json
    - quality/evidence/phase-02/environment/windows-10-image.json
    - quality/evidence/phase-02/environment/windows-11-image.json
    - quality/evidence/phase-02/environment/signing-access.json
    - quality/evidence/phase-02/artifacts/signed-desktop-package.json
    - quality/evidence/phase-02/artifacts/unsigned-ci-build.json
    - quality/evidence/phase-02/staged/Liiiraa Boost_0.0.0_x64-setup.exe
    - quality/evidence/phase-02/staged/liiiraa-desktop.exe
  modified:
    - tooling/desktop-evidence/package-signed-desktop.mjs
    - tooling/desktop-evidence/package-signed-desktop.test.mjs
    - tooling/desktop-evidence/verify-packaged-wave-zero.mjs
    - tooling/desktop-evidence/verify-packaged-wave-zero.test.mjs
key-decisions:
  - 'Keep Windows 10 and Windows 11 packaged environments explicitly unresolved because no clean resettable environments are available; do not invent image, build, runner, WebView2, reset, support, or provenance facts.'
  - 'Use only the free self-signed CurrentUser CNG development certificate; public trust, SmartScreen reputation, production readiness, distribution permission, and timestamp claims remain false or not-applicable.'
  - 'CI receives no private key and produces a separately classified unsigned, unstaged, unpublished, non-promotable build.'
patterns-established:
  - 'Image-only review reads exactly windows-10-image.json and windows-11-image.json and never loads signing-access.json.'
  - 'Authenticode tamper proof changes a hashed PE byte instead of appending an unauthenticated overlay byte.'
  - 'Unsigned CI builds clean generated Cargo outputs before compilation so signed hardlinks cannot survive incremental reuse.'
requirements-completed: [UX-01, UX-09, UX-10, UX-11, UX-12]
duration: 5h37 elapsed across checkpoint continuation
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 33: Free Development-Signed Desktop Artifact Summary

**A zero-cost CurrentUser CNG identity now Authenticode-signs and hash-binds the exact local Tauri installer and executable while Windows-image availability and CI output remain explicitly non-promotable.**

## Performance

- **Duration:** 5h37 elapsed across the human decision checkpoint and continuation
- **Started:** 2026-07-28T09:56:14Z
- **Completed:** 2026-07-28T15:33:32Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Defined a closed schema and mutation-tested workflow for development-signed artifacts and unsigned CI builds.
- Recorded the user's zero-cost choice as two unavailable, unresolved Windows image records without fabricated machine facts.
- Added a narrow image review mode that validates only the Windows 10 and Windows 11 files and does not read signing access.
- Created one reusable SHA-256 code-signing certificate in `Cert:\CurrentUser\My` using the Microsoft Software Key Storage Provider.
- Verified the certificate has code-signing EKU `1.3.6.1.5.5.7.3.3`, CNG custody, and no export policy.
- Built, signed, tamper-tested, staged, and independently rehashed the exact installer and shipped executable.
- Generated a separate real unsigned-CI record after a clean build and rejected all staging, publishing, promotion, production, release-ready, and distribution claims.

## Task Commits

Each completed task was committed atomically:

1. **Task 1 RED: Specify development signing artifact contract** — `28849cd` (`test`)
2. **Task 1 GREEN: Enforce free development signing workflow** — `4dfd7ed` (`feat`)
3. **Task 2: Record unresolved free Windows environments** — `3e23941` (`feat`)
4. **Task 3: Stage free development-signed desktop artifacts** — `0277cc2` (`feat`)

## Decisions Made

- Windows 10 and Windows 11 packaged acceptance remains unresolved because no clean resettable environments are available.
- Unresolved records contain no image identity, build, runner, WebView2 baseline, reset method, support status, observer, timestamp, or provenance claim.
- The retained certificate thumbprint is `55D6403DE15473B2A50AE82B7831C457629CC298`; this is a non-secret local identifier, not a production identity.
- Timestamping is `not-applicable`; no timestamp authority or receipt is claimed.
- The signed artifacts are suitable only for local development integrity checks and are not suitable for public distribution.
- Commercial trusted signing remains deferred to Phase 10.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed incompatible legacy KeySpec from CNG certificate creation**

- **Found during:** Task 3 certificate creation
- **Issue:** `New-SelfSignedCertificate` returned `NTE_PROV_TYPE_NOT_DEF` when a CNG provider was combined with the legacy `-KeySpec Signature` parameter.
- **Fix:** Removed the legacy parameter and added direct inspection of the certificate's actual code-signing EKU before use.
- **Files modified:** `tooling/desktop-evidence/package-signed-desktop.mjs`
- **Verification:** The retained private key is `RSACng`, provider is Microsoft Software Key Storage Provider, export policy is `None`, and EKU is the code-signing OID.
- **Committed in:** `0277cc2`

**2. [Rule 3 - Blocking] Launched pnpm.cmd through the Windows command processor**

- **Found during:** Task 3 desktop build
- **Issue:** Node returned `spawnSync pnpm.cmd EINVAL` because Windows command scripts cannot be executed directly with this spawn configuration.
- **Fix:** Used the Windows command launcher `cmd.exe` with flags `/d /c` to invoke `pnpm.cmd` while retaining argument-array execution.
- **Files modified:** `tooling/desktop-evidence/package-signed-desktop.mjs`
- **Verification:** Pinned Tauri builds completed in both local and CI modes.
- **Committed in:** `0277cc2`

**3. [Rule 1 - Bug] Made the Authenticode tamper test mutate authenticated PE bytes**

- **Found during:** Task 3 signature integrity verification
- **Issue:** Appending a byte can land outside the Authenticode-hashed region and did not reliably produce `HashMismatch`.
- **Fix:** Mutated byte 2 in an isolated copy, preserving the original while changing a hashed PE region.
- **Files modified:** `tooling/desktop-evidence/package-signed-desktop.mjs`
- **Verification:** Both installer and executable tamper copies now fail with `HashMismatch`.
- **Committed in:** `0277cc2`

**4. [Rule 1 - Bug] Prevented signed Cargo hardlinks from contaminating unsigned CI output**

- **Found during:** Task 3 unsigned CI record creation
- **Issue:** Incremental Cargo output retained Authenticode signatures through hardlinked artifacts, so CI correctly rejected the supposedly unsigned executable.
- **Fix:** Cleaned generated workspace build artifacts before CI compilation, then rebuilt and inspected both outputs as `NotSigned`.
- **Files modified:** `tooling/desktop-evidence/package-signed-desktop.mjs`
- **Verification:** The actual CI record contains two `NotSigned` artifacts and all promotion booleans remain false.
- **Committed in:** `0277cc2`

**5. [Rule 3 - Blocking] Fixed standalone Node lint errors**

- **Found during:** Task 3 final verification
- **Issue:** `Buffer` was not explicitly imported and one test helper was unused.
- **Fix:** Imported `Buffer` from `node:buffer` and removed the unused helper.
- **Files modified:** `tooling/desktop-evidence/package-signed-desktop.mjs`, `tooling/desktop-evidence/package-signed-desktop.test.mjs`
- **Verification:** Focused ESLint passes with no warnings or errors.
- **Committed in:** `0277cc2`

---

**Total deviations:** 5 auto-fixed (2 bugs, 3 blocking execution issues)

**Impact on plan:** All fixes preserve the approved zero-cost trust boundary and make local signing, tamper detection, and unsigned CI separation executable on the maintainer's Windows host.

## Issues Encountered

- Three redundant self-signed certificates created by failed retry attempts were removed from `Cert:\CurrentUser\My`; those redundant keys are not recoverable. The single certificate referenced by all final evidence remains present and reusable.
- The Windows 10 and Windows 11 clean packaged environments remain unavailable, so `packagedAcceptance` stays `false` and environment acceptance reports `unresolved`.

## Known Stubs

- `quality/evidence/phase-02/environment/windows-10-image.json` intentionally keeps all unavailable machine facts `unresolved`.
- `quality/evidence/phase-02/environment/windows-11-image.json` intentionally keeps all unavailable machine facts `unresolved`.
- These are fail-closed prerequisite records, not product UI stubs. Plans 02-26 and 02-27 must not promote packaged Windows acceptance until real clean environments exist.

## Authentication Gates

None.

## User Setup Required

None for local development signing. Clean resettable Windows 10 and Windows 11 environments will be required before final packaged acceptance.

## Verification

- `rtk node --test tooling/desktop-evidence/package-signed-desktop.test.mjs tooling/desktop-evidence/verify-packaged-wave-zero.test.mjs` — passed, 87 tests.
- Image-only gate — passed with two explicit unresolved records and `signingAccessLoaded=false`.
- Full environment gate — passed with signing access reviewed, image acceptance unresolved, and `packagedAcceptance=false`.
- Local signing execution — passed for installer and executable with the retained thumbprint.
- Actual unsigned CI execution — passed after a clean build; both outputs inspected as `NotSigned`.
- Independent staged-file size and SHA-256 recomputation — passed for both signed artifacts.
- Authenticode inspection — both staged artifacts report the retained signer and expected self-signed untrusted-root status.
- Certificate custody inspection — provider, CNG key type, EKU, non-exportability, and CurrentUser store all passed.
- Secret-shaped field scan — passed for signing access, signed artifact, and unsigned CI records.
- Focused ESLint, Prettier, and `git diff --check` — passed.

## Next Phase Readiness

- Plans 02-26 and 02-27 can consume the exact two staged development-signed artifacts and their immutable hashes.
- Packaged Windows journeys must remain unresolved until clean Windows 10 and Windows 11 evidence replaces the current unavailable records.
- Phase 10 still owns publicly trusted signing, timestamping, SmartScreen reputation, distribution authorization, and release readiness.

## Self-Check: PASSED

- All declared schema, workflow, environment, artifact, staged binary, and summary files exist.
- Task commits `28849cd`, `4dfd7ed`, `3e23941`, and `0277cc2` exist in repository history.
- The retained certificate exists at the exact CurrentUser store thumbprint recorded in evidence.
- No unexpected deletion, untracked runtime output, paid dependency, secret material, or public-release claim remains.

---

_Phase: 02-complete-desktop-experience_
_Completed: 2026-07-28_
