---
phase: 04-identity-commerce-devices-and-administration
plan: '20'
subsystem: desktop-identity
tags: [rust, tauri, oauth, pkce, keyring, windows-credential-manager]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: API-owned PKCE and independently revocable session authority from Plan 04-11
  - phase: 04-identity-commerce-devices-and-administration
    provides: Generated session contracts and validators from Plan 04-03
  - phase: 04-identity-commerce-devices-and-administration
    provides: Account authority and recovery boundaries from Plans 04-12 and 04-17
provides:
  - Validated system-browser launch for API-issued S256 desktop authorization challenges
  - Exact ephemeral loopback callback listener with one-shot state, issuer, redirect, and peer binding
  - Provider-neutral desktop exchange handoff that never contains a verifier, provider secret, or provider token endpoint
  - API-issued rotated credential custody through Windows Credential Manager with revocation cleanup
affects: [04-21, 04-35, desktop-account-authority, native-session-sync]
tech-stack:
  added: [keyring@4.1.5, windows@0.62.2]
  patterns:
    - Keep provider PKCE verifier and provider exchange authority in the API while Rust validates one-shot callback evidence
    - Return only generated session projections to renderer-facing callers after native credential custody succeeds
    - Collapse native browser, callback, exchange, and credential failures into redacted stable errors
key-files:
  created:
    - apps/desktop/src-tauri/src/identity.rs
    - apps/desktop/src-tauri/src/credential_store.rs
  modified:
    - apps/desktop/src-tauri/Cargo.toml
    - Cargo.lock
    - apps/desktop/src-tauri/src/main.rs
    - apps/desktop/src-tauri/tests/identity.rs
key-decisions:
  - 'Preserve Plan 04-11 authority: the API owns provider PKCE verifier/state generation and provider exchange; Rust validates the API challenge and never gains provider-session authority.'
  - 'Consume the loopback listener before callback validation so a rejected first request cannot be retried as a state-guessing oracle.'
  - 'Treat revoked and expired next-contact session states identically for native credential deletion while leaving local safety history outside the identity boundary.'
requirements-completed: [IDEN-01, IDEN-02]
duration: 16 min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 20: Native Desktop Identity and Credential Custody Summary

**System-browser desktop authentication now validates an API-owned S256 challenge through a one-shot loopback callback, hands provider-neutral evidence only to the API exchange route, and stores the resulting local credential exclusively in Windows Credential Manager.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-05T07:39:00Z
- **Completed:** 2026-08-05T07:55:00Z
- **Tasks:** 1 TDD task
- **Files modified:** 6

## Accomplishments

- Added a validated Windows system-browser launcher that opens only an API-issued HTTPS authorization URL containing the public desktop client, S256 challenge, and exact state.
- Added an ephemeral `127.0.0.1` listener that accepts one bounded callback request, validates exact path/query/peer evidence, and becomes permanently consumed before any state decision.
- Added the exact `/v1/identity/desktop/exchanges` handoff document with challenge ID, authorization code, state, issuer, and redirect URI while intentionally excluding a client secret, provider endpoint, and client-side code verifier.
- Added native `CredentialStore` custody through keyring 4.1.5's Windows store, including idempotent read/delete behavior, rotated writes, redacted errors, and real write/read/delete smoke coverage.
- Added next-contact revoked/expired cleanup that signs the desktop out without touching safety history, diagnostics, recovery, or other local data.
- Registered the identity and credential modules in the packaged desktop host so production builds compile the same boundary proven by integration tests.

## TDD Gates

- **RED — `65571f2`:** Added the native identity, callback, API handoff, custody, revocation, source-scan, pin, and Credential Manager matrix. The focused suite failed because `credential_store.rs` did not exist.
- **GREEN — `e34e0a2`:** Added exact dependency pins, API-owned challenge validation, one-shot callback handling, generated session parsing, native credential custody, and live Windows Credential Manager smoke. The focused matrix passed 8/8.
- **REFACTOR — `b328d22`:** Registered both native identity modules in the desktop host using the existing packaged-core boundary pattern; focused and build gates remained green.
- **Security correction — `60c8909`:** Replaced passive URL return with validated Windows system-browser launch through `ShellExecuteW`, retaining an injected recorder for deterministic tests.

## Task Commits

1. **Task 04-20-01 RED: Add failing native identity custody matrix** — `65571f2` (`test`)
2. **Task 04-20-01 GREEN: Activate native desktop identity custody** — `e34e0a2` (`feat`)
3. **Task 04-20-01 REFACTOR: Wire identity core into desktop host** — `b328d22` (`refactor`)
4. **Task 04-20-01 security correction: Open identity in the system browser** — `60c8909` (`fix`)

## Files Created/Modified

- `apps/desktop/src-tauri/src/identity.rs` — System-browser launch, API challenge validation, one-shot loopback callback lifecycle, API exchange request, credential admission, and revocation contact policy.
- `apps/desktop/src-tauri/src/credential_store.rs` — Redacted `CredentialStore` contract and Windows Credential Manager implementation.
- `apps/desktop/src-tauri/tests/identity.rs` — Eight callback, boundary, custody, revocation, source-scan, pin, and live Windows smoke cases.
- `apps/desktop/src-tauri/Cargo.toml` — Exact `keyring@4.1.5` and `windows@0.62.2` pins with the narrow system-browser Win32 features.
- `Cargo.lock` — Deterministic dependency resolution for the approved native custody stack.
- `apps/desktop/src-tauri/src/main.rs` — Production compile registration for both native identity modules.

## Decisions Made

- Plan 04-11 remains authoritative for D-10: the API owns the PKCE verifier and provider exchange. Rust validates the API-issued S256 challenge and exact callback evidence but never receives or reconstructs provider authority.
- Browser launch occurs only after issuer, loopback redirect, state, S256 challenge, public client, and authorization URL validation pass.
- The loopback listener is taken before reading the first request. Malformed, mismatched, and valid first callbacks all close the replay window.
- API credential custody must name `windows-credential-manager`, match the generated session expiry, contain a bounded non-control value, and represent an active/challenge-required session before writing.
- Renderer-safe completion returns only the generated `SessionProjection`; the credential envelope is consumed within Rust and has no serialization path to renderer storage.

## Verification Results

- `rtk cargo test -p liiiraa-desktop identity`: **PASS** — 8 passed, 45 filtered; measured test runtime 0.02 s and command wall time 1.4 s, below 30 seconds.
- `rtk cargo test -p liiiraa-desktop --test identity`: **PASS** — 8/8 packaged-compatible cases, including real ephemeral loopback and Windows Credential Manager write/read/delete; measured test runtime 0.01 s.
- `rtk cargo build -p liiiraa-desktop`: **PASS** — packaged host compiled in 0.22–0.24 s after native module registration.
- `rtk cargo fmt --all -- --check`: **PASS**.
- `rtk pnpm supply-chain:check`: **PASS** — 72 exact dependency pins verified; 45 review-marked identities remain tracked by the existing policy.
- Boundary source scan: **PASS** — no provider token endpoint, provider/client secret, bearer channel, SQLite, `localStorage`, or `sessionStorage` surface exists in the Rust identity or credential files.
- TDD history: **PASS** — RED precedes GREEN, followed by packaged-host refactor and the final system-browser security correction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Preserved the locked API-owned PKCE authority instead of moving the verifier into Rust**

- **Found during:** Task 04-20-01 read-first and GREEN boundary design
- **Issue:** The plan action's client-verifier wording conflicts with dependency Plan 04-11's locked decision that the API alone owns provider PKCE verifier/state generation, callback validation, provider exchange, and local credential issuance.
- **Fix:** Rust validates the API-issued S256 challenge and exact one-shot callback, then forwards only the existing API exchange route's accepted evidence. It never generates, receives, persists, or forwards a provider verifier or secret.
- **Files modified:** `apps/desktop/src-tauri/src/identity.rs`, `apps/desktop/src-tauri/tests/identity.rs`
- **Verification:** Exchange JSON has no `codeVerifier` or secret field; source scans contain no provider endpoint; all API-boundary tests pass.
- **Committed in:** `e34e0a2`

**2. [Rule 2 - Missing Critical] Registered native identity modules in the packaged desktop host**

- **Found during:** Post-GREEN production wiring review
- **Issue:** Integration tests compiled the new modules, but the desktop binary did not yet include them.
- **Fix:** Registered `credential_store` and `identity` beside the existing device/offline native cores so the production host build compiles the proven boundary.
- **Files modified:** `apps/desktop/src-tauri/src/main.rs`
- **Verification:** Focused integration tests and packaged desktop build pass after registration.
- **Committed in:** `b328d22`

**3. [Rule 2 - Missing Critical] Opened validated authorization URLs in the real Windows system browser**

- **Found during:** Final security review
- **Issue:** The initial GREEN result exposed the validated browser URL but did not itself invoke the system browser.
- **Fix:** Added a narrow injectable launcher backed by documented `ShellExecuteW`; tests inject a recorder and verify exactly one validated URL without opening an interactive browser.
- **Files modified:** `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/src/identity.rs`, `apps/desktop/src-tauri/tests/identity.rs`
- **Verification:** Focused suite, packaged host build, formatting, and supply-chain gates pass.
- **Committed in:** `60c8909`

---

**Total deviations:** 3 auto-fixed missing-critical security/production-boundary issues.
**Impact on plan:** The adjustments preserve the upstream API authority, make the core part of the packaged host, and fulfill real system-browser launch without adding renderer token custody, provider exchange, Docker, or an external service.

## Known Stubs

None. Plan 04-35 owns the downstream desktop account synchronization/composition that consumes this credential/session boundary; the native browser, callback, exchange document, custody, and revocation primitives required from this plan are implemented and executable.

## Issues Encountered

- Context7 MCP was unavailable and the documented `ctx7` CLI fallback was not installed. The exact downloaded keyring 4.1.5 README, feature manifest, and source declarations were inspected before relying on `Entry::new`, `set_password`, `get_password`, and `delete_credential`.
- The plan's client-verifier wording was superseded by the locked Plan 04-11 API-owned PKCE decision. Preserving that decision prevents provider authority from leaking into the Windows client.

## Authentication Gates

None.

## User Setup Required

None. Verification used the current Windows user's Credential Manager with a process-scoped synthetic smoke entry that was deleted before and after the test. No provider account, client secret, Docker daemon, Testcontainers instance, or external credential was used.

## Next Phase Readiness

- Plan 04-21 can consume the authenticated contact disposition when applying offline Premium policy.
- Plan 04-35 can build account synchronization over `CredentialStore`, generated session authority, and next-contact revocation without exposing the credential to React or browser storage.
- The API route remains the sole provider exchange and local session issuance authority established by Plan 04-11.

## Self-Check: PASSED

- Both created source files and the focused identity test exist on disk.
- RED `65571f2`, GREEN `e34e0a2`, REFACTOR `b328d22`, and security correction `60c8909` exist in repository history in order.
- Focused Rust, packaged-compatible Windows smoke, desktop build, formatting, supply-chain, source-scan, and no-deletion gates pass.
- No tracked files were deleted; unrelated `.impeccable/` and `apps/desktop/src-tauri/gen/` remain untouched, untracked, and unstaged.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
