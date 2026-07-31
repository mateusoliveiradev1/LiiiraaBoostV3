---
phase: 03-complete-web-experience
plan: "10"
subsystem: contract-validation
tags: [ajv, jsonschema, typescript, rust, runtime-validation, redaction]
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Bounded structural validation errors and generated TypeScript/Rust transports
  - phase: 03-complete-web-experience
    provides: Plan 03-09 generated sealed web document schema and matching transports
provides:
  - Cached public TypeScript validateWebDocument boundary
  - Cached Rust validate_web_document boundary returning generated transport variants
  - Cross-language valid/invalid parity matrix with value-free structural errors
affects: [03-11, 03-12, 03-13, 03-14, web-core, web-features, web-preview]
tech-stack:
  added: []
  patterns:
    - Generated schema validation precedes transport trust
    - Lazy one-time Ajv compilation preserves CSP-safe package initialization
    - Semantic HTTPS evidence URI checks supplement the generated bounded string schema
key-files:
  created: []
  modified:
    - packages/contracts-ts/src/validation.ts
    - packages/contracts-ts/src/validation.test.ts
    - packages/contracts-ts/src/index.ts
    - crates/contracts-rust/src/validation.rs
key-decisions:
  - "Use the generated schema URI as the shared web document runtime schema identifier."
  - "Compile Ajv lazily once so importing the shared contracts package remains compatible with the desktop no-dynamic-code CSP gate."
  - "Accept web evidence sources only as credential-free HTTPS URIs in both runtimes."
  - "Wrap generated Rust variants in ValidatedWebDocument without duplicating generated DTO fields."
patterns-established:
  - "Untrusted web JSON is schema-validated before TypeScript narrowing or Rust deserialization."
  - "Validation failures expose only bounded path and keyword structure, never rejected values."
requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]
duration: 14m
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 10: Web Document Runtime Validation Summary

**Fail-closed TypeScript and Rust web-document boundaries backed by the same generated schema, generated transports, and redacted parity tests**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-31T03:14:21Z
- **Completed:** 2026-07-31T03:28:39Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Added `validateWebDocument` with one cached Ajv 2020 validator and public generated `WebDocument` result typing.
- Added `validate_web_document` with one cached `jsonschema` validator and post-schema deserialization into generated Rust transport variants.
- Proved identical acceptance and rejection for route, content, release, no-change receipt, screenshot provenance, and admin audit documents.
- Rejected unknown fields, invalid literals, missing approval or integrity, remote mutation claims, unsafe evidence URIs, oversized identifiers, and fixture provenance relabeled as measured.
- Preserved bounded deterministic error shapes without reflecting payload values in either runtime.

## Task Commits

Task 1 used the required RED-GREEN-REFACTOR sequence:

1. **RED: Add failing web document validation parity tests** - `26f8b3b` (test)
2. **GREEN: Implement cached generated-schema validation boundaries** - `be7fe9f` (feat)
3. **REFACTOR: Share redacted deserialization failure construction** - `90e2ace` (refactor)

## Files Created/Modified

- `packages/contracts-ts/src/validation.ts` - Cached Ajv validator, semantic URI guard, bounded public validation result.
- `packages/contracts-ts/src/validation.test.ts` - Closed valid/invalid matrix and stable redaction assertions.
- `packages/contracts-ts/src/index.ts` - Public web schema ID, validator, result, and error exports.
- `crates/contracts-rust/src/validation.rs` - Cached generated schema, validated transport enum, post-schema deserialization, URI guard, and parity tests.

## Decisions Made

- The canonical generated `$id`, `https://schemas.liiiraa.dev/web/v1/web-document.schema.json`, is the shared runtime schema identifier.
- Ajv compilation is lazy and cached. This retains one-time compilation while preserving the existing contract package import under the desktop no-dynamic-code CSP test.
- `WebUri` remains generated as a bounded string, while the trust boundary adds equivalent credential-free HTTPS semantics in TypeScript and Rust.
- Rust returns a `ValidatedWebDocument` enum containing generated transport variants; it introduces no duplicate DTO fields.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved CSP-safe contracts package initialization**

- **Found during:** Task 1 GREEN verification
- **Issue:** Eager Ajv schema compilation used dynamic JavaScript generation during module import and failed the existing desktop CSP test.
- **Fix:** Moved Ajv construction and compilation behind a cached lazy getter invoked only by the web validation boundary.
- **Files modified:** `packages/contracts-ts/src/validation.ts`
- **Verification:** Contracts TypeScript suite passes all 37 tests, including `validation.csp.test.ts`.
- **Commit:** `be7fe9f`

**Total deviations:** 1 auto-fixed bug.

**Impact:** The web validator still compiles exactly once while existing desktop validator initialization behavior remains unchanged.

## TDD Gate Compliance

- **RED:** `26f8b3b` introduced the matrix and failed because both public web validation functions were absent.
- **GREEN:** `be7fe9f` made the complete matrix pass in both runtimes.
- **REFACTOR:** `90e2ace` consolidated value-free deserialization errors and retained green tests.

## Verification

- `rtk pnpm --filter @liiiraa/contracts-ts test -- --run -t "web document"` - 37 passed, including CSP and web-document tests.
- `rtk cargo test -p liiiraa-contracts-rust web_document` - 3 passed.
- `rtk pnpm --filter @liiiraa/contracts-ts check` - passed.
- `rtk pnpm test:contracts` - generation drift, compatibility, all TypeScript contract tests, and all Rust contract tests passed.
- `rtk cargo fmt --all -- --check` - passed.
- `rtk git diff --check` - passed.

## Issues Encountered

- The generated 2020-12 schema treats `format` as annotation in both pinned validators, so parity remains aligned without adding an unapproved formats dependency.
- Workspace `pnpm` lifecycle refreshes the intentionally deferred Plan 03-11 lockfile graph during filtered commands; those unrelated lockfile changes were discarded and no dependency files were committed.

## Threat Review

- T-03-02 is mitigated by closed generated schema validation before trusted narrowing/deserialization and the cross-language invalid matrix.
- T-03-04 is mitigated by stable bounded path/keyword diagnostics that never serialize rejected values.
- T-03-SC is mitigated because no dependency or package installation was added.
- No new endpoint, authentication path, filesystem trust boundary, schema mutation, or remote execution surface was introduced.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-11 through 03-14 can consume one public fail-closed boundary before mapping route, content, release, or preview data.
- No blockers remain for the generated web contract consumers.

## Self-Check: PASSED

- All four modified implementation/test files and this summary exist on disk.
- RED `26f8b3b`, GREEN `be7fe9f`, and REFACTOR `90e2ace` commits exist in repository history in order.
- Public TypeScript/Rust exports and schema-before-deserialization ordering are present.
- Focused and full contract verification gates pass.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
