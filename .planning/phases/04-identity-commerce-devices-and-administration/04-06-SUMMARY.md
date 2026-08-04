---
phase: 04-identity-commerce-devices-and-administration
plan: '06'
subsystem: device-identity
tags: [device-evidence, privacy, hmac, sha256, rust, typescript, tdd]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: Generated control-plane transports from Plan 04-03 and domain RED witnesses from Plan 04-31
  - phase: 04-identity-commerce-devices-and-administration
    provides: Research-resolved device weights, thresholds, privacy boundary, and approved exact Rust pins
provides:
  - Account-scoped local component digests with raw-observation non-serialization
  - Versioned server HMAC wrapping and deterministic tolerant device comparison
  - Cross-runtime 100/90/60/35 score matrix with explainable revalidation
  - Executable empty, sparse, contradictory, VM-crossing, salt-rotation, and key-rotation defenses
affects: [04-07, 04-18, 04-19, 04-21]
tech-stack:
  added: [hmac-0.13.0, hkdf-0.13.0, sha2-0.10.9, subtle-2.6.1]
  patterns:
    - Raw hardware observations are borrowed, non-serializable collector inputs
    - Per-account local digests are replaced by key-versioned server HMAC values
    - Component-class weights and thresholds are identical across TypeScript and Rust
key-files:
  created:
    - packages/control-plane-domain/src/devices/device-evidence.ts
    - packages/control-plane-domain/src/index.ts
    - packages/control-plane-domain/tsconfig.json
    - apps/desktop/src-tauri/src/device_identity.rs
    - apps/desktop/src-tauri/tests/device_identity.rs
    - .planning/phases/04-identity-commerce-devices-and-administration/04-DEVICE-EVIDENCE.md
  modified:
    - packages/control-plane-domain/src/devices/device-evidence.test.ts
    - packages/control-plane-domain/package.json
    - apps/desktop/src-tauri/Cargo.toml
    - apps/desktop/src-tauri/src/main.rs
    - Cargo.lock
key-decisions:
  - 'Score platform trust/virtual platform at 40, CPU at 25, storage at 15, GPU at 10, and memory topology at 10; 65 is same-PC and 40 is online revalidation.'
  - 'Keep local collection on domain-separated account-salted SHA-256 and perform server wrapping through Web Crypto HMAC-SHA-256 because the mandated RustCrypto 0.13 and sha2 0.10 generic digest lines are incompatible.'
  - 'Reject invalid evidence both before wrapping and again during comparison so malformed evidence cannot enter server-side values or bypass a downstream caller.'
requirements-completed: [IDEN-05]
metrics:
  duration: 20 min
  completed: 2026-08-04
  tasks: 1
  files: 11
status: complete
---

# Phase 04 Plan 06: Protected Device Evidence Summary

**Privacy-preserving device evidence now normalizes and digests raw observations locally, replaces local digests with versioned account-scoped HMAC values, and applies an explainable 40/25/15/10/10 tolerance policy identically in TypeScript and Rust.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-04T22:52:27Z
- **Completed:** 2026-08-04T23:12:48Z
- **Tasks:** 1 TDD feature
- **Files modified:** 11

## Accomplishments

- Replaced the Wave 1 RED sentinel with executable TypeScript and Rust matrices covering reinstall stability, minor component tolerance, explainable revalidation, substantial replacement, sparse/contradictory evidence, and physical/virtual separation.
- Added a Rust collector whose raw observation type implements neither serialization nor debug output, normalizes one component at a time, rejects placeholders and contradictions, and emits only account-scoped lowercase SHA-256 digests.
- Added server-side Web Crypto HMAC wrapping whose protected values are unlinkable across account salts and key versions and contain neither raw observations nor local digests.
- Proved deterministic parity at scores 100, 90, 60, and 35, with same-PC at 65+, revalidation at 40–64, and replacement below 40.
- Published the canonical component, threshold, VM, deletion, logging, key-rotation, and STRIDE evidence in `04-DEVICE-EVIDENCE.md`.

## TDD Gates

### RED

- Commit `4c16a14` expanded the TypeScript witness and added the Rust collector boundary suite.
- TypeScript failed because `device-evidence.js` did not exist.
- Rust failed because `device_identity.rs` did not exist.
- Both failures were the intended missing-policy/collector failures rather than collection or syntax failures.

### GREEN

- Commit `3f4f8d7` implemented the TypeScript policy, Rust collector/comparator, exact dependency pins, generated public package seam, and focused verification scripts.
- Five TypeScript and five Rust tests passed with matching threshold outcomes.
- Commit `ddea756` closed the review-discovered pre-wrap admission gap while keeping comparison independently defensive.

### REFACTOR

- The canonical fixture semantics, component ordering, weights, thresholds, normalization, VM class, and privacy protocol were consolidated in `04-DEVICE-EVIDENCE.md`.
- No behavior-neutral source refactor was required after the fail-closed correction; format, lint, type, architecture, and build gates remained green.

## Task Commits

1. **Task 04-06-01 RED: executable protected-evidence witnesses** — `4c16a14` (`test`)
2. **Task 04-06-01 GREEN: protected device evidence implementation** — `3f4f8d7` (`feat`)
3. **Task 04-06-01 hardening: reject invalid evidence before wrapping** — `ddea756` (`fix`)
4. **Task 04-06-01 evidence: publish canonical privacy/tolerance protocol** — `807b917` (`docs`)

## Files Created/Modified

- `packages/control-plane-domain/src/devices/device-evidence.ts` — pure protected-evidence derivation, validation, scoring, outcomes, and component-class explanations.
- `packages/control-plane-domain/src/devices/device-evidence.test.ts` — executable tolerance, privacy, unlinkability, and fail-closed matrix.
- `packages/control-plane-domain/src/index.ts`, `tsconfig.json`, and `package.json` — architecture public root plus strict type, lint, and focused test participation.
- `apps/desktop/src-tauri/src/device_identity.rs` — raw collector boundary, normalization, account-scoped digest derivation, constant-time comparisons, admission policy, and Rust parity scoring.
- `apps/desktop/src-tauri/tests/device_identity.rs` — synthetic raw-marker, normalization, salt rotation, contradiction, VM, and threshold evidence.
- `apps/desktop/src-tauri/Cargo.toml` and `Cargo.lock` — exact audited Rust dependency pins and resolved lock graph.
- `apps/desktop/src-tauri/src/main.rs` — compiles the collector module in the real desktop crate while the later binding plan retains invocation authority.
- `.planning/phases/04-identity-commerce-devices-and-administration/04-DEVICE-EVIDENCE.md` — canonical protocol and measured security evidence.

## Decisions Made

- Kept operating-system installation out of identity evidence. Reinstall is therefore score-neutral, while one ordinary GPU, storage, or memory change remains above the same-PC threshold.
- Used explicit `virtual-platform` evidence with no physical comparison path. A VM can derive protected evidence but cannot silently match a physical device.
- Required three distinct component classes plus platform/virtual/CPU anchoring. Duplicate components are contradictions, and malformed values cannot reach wrapped server output.
- Included key version in the HMAC input rather than treating it as metadata only, making rotation unlinkable and mixed-version comparison explicit.
- Preserved all four approved exact Rust pins. Because `hmac/hkdf 0.13` require `digest 0.11` while the mandated `sha2 0.10.9` implements `digest 0.10`, the collector uses domain-separated account-salted SHA-256 and the server uses platform Web Crypto HMAC instead of composing incompatible generics or implementing cryptography manually.

## Verification Results

- `rtk pnpm --filter @liiiraa/control-plane-domain test -- --run device-evidence`: **PASS** — 5/5 TypeScript tests, 4.7 seconds wall time, below the 30-second ceiling.
- `rtk cargo test -p liiiraa-desktop device_identity`: **PASS** — 5/5 Rust tests executed; no name-filter false positive.
- `rtk proxy pnpm --filter @liiiraa/control-plane-domain typecheck`: **PASS** — strict project type check.
- Focused ESLint and Prettier checks: **PASS**.
- `rtk cargo fmt --all -- --check`: **PASS**.
- `rtk cargo build -p liiiraa-desktop`: **PASS** — warning-free desktop build.
- `rtk pnpm supply-chain:check`: **PASS** — 60 exact pins verified.
- `rtk pnpm test:architecture`: **PASS** — both live adapters executed and 46/46 architecture tests passed.
- Changed-source raw-marker scan: **PASS** — exact synthetic raw values occur only in the Rust collector test boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the package test/type/public-root seam**

- **Found during:** Task 04-06-01 RED/GREEN
- **Issue:** The plan's focused pnpm command initially exited successfully without collecting the device test because `@liiiraa/control-plane-domain` had no test script. The package also lacked a TypeScript project and its declared architecture public root, leaving new security policy outside type-aware lint.
- **Fix:** Added the exact focused Vitest script, strict package `tsconfig.json`, `typecheck` script, and `src/index.ts` public export.
- **Files modified:** `packages/control-plane-domain/package.json`, `packages/control-plane-domain/tsconfig.json`, `packages/control-plane-domain/src/index.ts`
- **Verification:** The exact plan command runs only 5 owned tests; package typecheck, ESLint, and architecture tests pass.
- **Committed in:** `3f4f8d7`

**2. [Rule 1 - Bug] Resolved incompatible approved RustCrypto digest generations**

- **Found during:** Task 04-06-01 GREEN
- **Issue:** `hmac/hkdf 0.13` use `digest 0.11`, while the mandated `sha2 0.10.9` pin uses `digest 0.10`; generic composition produced compile-time trait failures.
- **Fix:** Preserved every approved exact pin, used compatible domain-separated account-salted SHA-256 for the local digest, and used Web Crypto HMAC-SHA-256 for server wrapping. No version substitution or hand-rolled cryptography was introduced.
- **Files modified:** `apps/desktop/src-tauri/src/device_identity.rs`, `packages/control-plane-domain/src/devices/device-evidence.ts`
- **Verification:** Rust parity tests, TypeScript privacy tests, warning-free Cargo build, and supply-chain gate pass.
- **Committed in:** `3f4f8d7`

**3. [Rule 2 - Missing Critical] Added real Rust scoring parity and production module compilation**

- **Found during:** Task 04-06-01 GREEN
- **Issue:** Collector-only Rust tests could prove hashing but not the acceptance criterion that TypeScript and Rust synthetic tolerance matrices agree; compiling the file only through `#[path]` also would not prove the real desktop crate owns it.
- **Fix:** Added the same component weights/outcomes in Rust, parity cases for 100/90/60/35, and registered the module in the desktop binary.
- **Files modified:** `apps/desktop/src-tauri/src/device_identity.rs`, `apps/desktop/src-tauri/tests/device_identity.rs`, `apps/desktop/src-tauri/src/main.rs`
- **Verification:** The filtered Rust command executes 5 tests, and the desktop crate builds without warnings.
- **Committed in:** `3f4f8d7`

**4. [Rule 2 - Missing Critical] Rejected invalid evidence before wrapping**

- **Found during:** Post-GREEN security review
- **Issue:** Empty, sparse, duplicate, or physical/virtual-contradictory local evidence could be wrapped and would only fail during later comparison, allowing invalid protected values to reach an intermediate server object.
- **Fix:** Applied the admission policy before HMAC wrapping while retaining independent comparison validation.
- **Files modified:** `packages/control-plane-domain/src/devices/device-evidence.ts`, `packages/control-plane-domain/src/devices/device-evidence.test.ts`
- **Verification:** Derivation rejection tests, comparison rejection tests, strict typecheck, lint, and focused suite pass.
- **Committed in:** `ddea756`

---

**Total deviations:** 4 auto-fixed (1 blocking seam, 1 compatibility bug, 2 missing critical security/parity seams).
**Impact on plan:** All changes were the minimum required to make the exact command, cross-runtime parity, real desktop compilation, and fail-closed privacy claims truthful. No provider, persistence, network endpoint, device binding, transfer, or entitlement authority was added.

## Known Stubs

None. The pure evidence derivation, comparison, collector boundary, test matrix, and package/module integration are complete. Real Windows inventory acquisition and account device binding remain explicitly owned by their later plans rather than represented by placeholder behavior here.

## Threat Flags

No unplanned trust boundary was introduced. The new raw hardware observation boundary and protected server-wrapping surface are the exact surfaces registered as `T-04-DEVICE-PRIVACY` and `T-04-DEVICE-SPOOF` in the plan threat model, with executable mitigations recorded above.

## Issues Encountered

- The initial plan command was a false green because the new domain package had no test script; the final command is executable and focused.
- The exact research pins span incompatible RustCrypto digest trait generations. The resolved protocol preserves the approved pins and cryptographic properties without a package substitution.

## User Setup Required

None. The plan uses synthetic inputs and local deterministic tooling; no hardware identifiers, secrets, credentials, provider accounts, or external services are required.

## Next Phase Readiness

- Later device-binding plans can consume only protected component evidence and explain revalidation by component class.
- Offline entitlement/device-binding work can bind to the protected evidence key version without accessing raw inventory.
- Real Windows inventory acquisition must preserve the non-serializable raw collector boundary and must not add logging, persistence, or transport fields for raw SMBIOS, TPM, disk, CPU, GPU, or memory identifiers.

## Self-Check: PASSED

- All six declared created artifacts and the canonical summary exist on disk.
- TDD/implementation/evidence commits `4c16a14`, `3f4f8d7`, `ddea756`, and `807b917` exist in repository history.
- The final focused TypeScript/Rust matrices, strict type/lint/format gates, warning-free Cargo build, supply-chain check, architecture suite, and raw-marker boundary scan pass.
