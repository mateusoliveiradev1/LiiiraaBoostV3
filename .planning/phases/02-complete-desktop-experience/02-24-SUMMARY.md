---
phase: 02-complete-desktop-experience
plan: "24"
subsystem: contracts
tags: [typespec, json-schema, typescript, rust, tauri-shell]
requires:
  - phase: 01-foundation
    provides: Deterministic TypeSpec-to-JSON-Schema/TypeScript/Rust generation pipeline
  - phase: 02-complete-desktop-experience
    provides: Plan 02-02 workspace ownership and Plan 02-14 active package manifests
provides:
  - Canonical bounded renderer/native shell protocol in TypeSpec
  - Deterministic shell JSON Schema plus generated TypeScript and Rust transports
  - Exact-output and handwritten-shell-DTO drift enforcement
affects: [02-32, desktop-shell, tauri-host, runtime-validation]
tech-stack:
  added: []
  patterns:
    - Direction-specific closed MessageEnvelope unions
    - Combined transport generation with byte-stable legacy schema isolation
key-files:
  created:
    - packages/contracts-source/src/shell.tsp
    - contracts/generated/desktop/v1/shell-message.schema.json
  modified:
    - packages/contracts-source/src/main.tsp
    - tooling/contract-generation/src/generate.ts
    - tooling/contract-generation/src/check-drift.ts
    - tooling/contract-generation/src/check-drift.test.ts
    - packages/contracts-ts/src/generated/models.ts
    - crates/contracts-rust/src/generated.rs
key-decisions:
  - "Keep established inspection and HTTP artifacts byte-stable by isolating shell definitions from their generation roots."
  - "Encode ordinary and recovery close resolutions as separate closed variants so recovery can never validate a terminate-interface decision."
  - "Generate TypeScript and Rust from one combined transport root while exposing shell runtime validation through its dedicated schema."
patterns-established:
  - "Shell boundary values are authored only in shell.tsp and generated for every consumer."
  - "Generated shell declaration names participate in the handwritten transport rejection scan."
requirements-completed: [UX-01, UX-09, UX-10, UX-11, UX-12]
duration: 12min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 24: Bounded Desktop Shell Protocol Summary

**Closed TypeSpec shell messages now generate byte-stable JSON Schema, TypeScript, and Rust transports with exact-path and handwritten-DTO drift protection.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-28T00:10:59.000Z
- **Completed:** 2026-07-28T00:22:43.000Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Defined publisher, release channel, Windows compatibility, startup, benign navigation, locale, tray, close, notification, and window-state values in one bounded TypeSpec source.
- Generated matching closed `HostToRendererShellEvent` and `RendererToHostShellCommand` transports for JSON Schema, TypeScript, and Rust.
- Extended exact-output generation and handwritten declaration checks so missing, changed, extra, or independently authored shell transports fail deterministically.
- Preserved the bytes and integrity digests of established diagnostic, inspection, and HTTP artifacts.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Specify the canonical bounded shell message protocol** — `370ef0b` (`test`)
2. **Task 2 GREEN: Generate exact schema, TypeScript, and Rust transports** — `87362c0` (`feat`)

## TDD Gate Compliance

- **RED:** `370ef0b` added the executable TypeSpec protocol specification; the drift check then failed on changed generated artifacts as expected.
- **GREEN:** `87362c0` extended the generator and regenerated all three shell transports; targeted tests, drift checks, TypeScript compilation, and Rust tests passed.
- **REFACTOR:** No separate refactor commit was necessary.

## Files Created/Modified

- `packages/contracts-source/src/main.tsp` — Imports the canonical shell protocol.
- `packages/contracts-source/src/shell.tsp` — Owns every bounded shell value and both message directions.
- `tooling/contract-generation/src/generate.ts` — Adds the shell output, required definitions, schema roots, and combined language-generation root.
- `tooling/contract-generation/src/check-drift.ts` — Rejects handwritten declarations for canonical shell transport names.
- `tooling/contract-generation/src/check-drift.test.ts` — Covers missing shell output and handwritten shell DTO diagnostics.
- `contracts/generated/desktop/v1/shell-message.schema.json` — Runtime schema for both shell message directions.
- `packages/contracts-ts/src/generated/models.ts` — Generated TypeScript shell transports.
- `crates/contracts-rust/src/generated.rs` — Generated Rust shell transports.

## Decisions Made

- Kept legacy inspection/OpenAPI generation roots isolated from shell definitions so existing corpus hashes remain stable.
- Used benign, goal-oriented navigation variants instead of accepting arbitrary or privileged route strings.
- Modeled recovery close resolution separately so `close-interface` is structurally impossible while recovery is active.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved established corpus schema digests**

- **Found during:** Task 2 targeted generator verification
- **Issue:** Adding shell definitions to every legacy runtime schema changed the diagnostic schema digest and failed the corpus integrity gate.
- **Fix:** Added deterministic inspection-definition isolation while retaining the full combined root for TypeScript/Rust and the dedicated shell schema.
- **Files modified:** `tooling/contract-generation/src/generate.ts`
- **Verification:** Corpus integrity passed with 5 valid and 6 invalid vectors; contract drift passed with 8 artifacts.
- **Commit:** `87362c0`

**2. [Rule 2 - Missing Critical] Closed unsafe recovery close combinations**

- **Found during:** Task 2 generated-schema review
- **Issue:** Independent close context and decision fields could validate `close-interface` during an active recovery workflow.
- **Fix:** Split ordinary and recovery resolutions into a closed discriminated union; recovery accepts only `keep-running-in-tray` or `stay-here`.
- **Files modified:** `packages/contracts-source/src/shell.tsp` and generated transports
- **Verification:** Generated schema assertion confirms the recovery variant cannot contain `close-interface`; TypeScript and Rust compile.
- **Commit:** `87362c0`

**3. [Rule 2 - Missing Critical] Extended duplicate-authority detection to shell DTOs**

- **Found during:** Task 2 drift protection review
- **Issue:** The existing handwritten transport scan did not know the new canonical shell declaration names.
- **Fix:** Added all required shell symbols to the scan and mutation-tested representative TypeScript declarations.
- **Files modified:** `tooling/contract-generation/src/check-drift.ts`, `tooling/contract-generation/src/check-drift.test.ts`
- **Verification:** Contract drift comparison tests passed.
- **Commit:** `87362c0`

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking).

**Impact:** The fixes narrowed accepted behavior and preserved existing integrity guarantees without adding dependencies, services, or infrastructure.

## Verification

- TypeSpec 1.14 compilation passed.
- Bounded path policy, corpus integrity, and deterministic drift tests passed.
- Consecutive generation runs produced identical SHA-256 hashes for shell schema, TypeScript, and Rust outputs.
- Manual TypeScript and Rust drift probes were each rejected by `contracts:check`.
- TypeScript validator suite passed 12 tests.
- Rust workspace suite passed 8 tests.
- Required shell symbols and closed direction roots were present in schema, TypeScript, and Rust.

## Known Stubs

None.

## Issues Encountered

The first generation attempt changed the pinned diagnostic schema digest; this was resolved by preserving the established inspection schema root as described in Deviations.

## User Setup Required

None — no external service, paid infrastructure, secret, or certificate is required.

## Next Phase Readiness

Plan 02-32 can add bounded, redacted runtime validators directly over `shell-message.schema.json` without handwritten renderer/native DTOs.

## Self-Check: PASSED

All declared artifacts exist, both task commits are reachable, every required shell symbol is present in JSON Schema/TypeScript/Rust, and the final drift check passes.

---

*Phase: 02-complete-desktop-experience*
*Completed: 2026-07-28*
