---
phase: 03-complete-web-experience
plan: "03"
subsystem: contracts
tags: [typespec, json-schema, web-routes, provenance, release-integrity]
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Canonical TypeSpec source, generated transport pipeline, and closed provenance vocabulary
  - phase: 02-complete-desktop-visual-experience
    provides: Closed shell locale, version, release-channel, compatibility, and fixture contracts
  - phase: 03-complete-web-experience
    provides: Approved dependency identities and reserved web module ownership from Plans 03-01 and 03-02
provides:
  - Closed language-neutral route, content, claim, screenshot, release, receipt, and admin-audit documents
  - Literal Phase 3 no-change and unavailable-distribution authority boundaries
  - Semantic mutation tests for provenance, route surface, official origin, approval, and remote-state widening
affects: [03-04, 03-05, 03-06, web-core, web-preview, web-evidence, apps-web, apps-account, apps-admin]
tech-stack:
  added: []
  patterns:
    - Canonical web documents reuse closed shell and provenance vocabulary
    - Source-level mutation probes guard semantic authority boundaries before generation
key-files:
  created:
    - packages/contracts-source/src/web.tsp
  modified:
    - packages/contracts-source/src/main.tsp
    - tooling/contract-generation/src/check-drift.test.ts
key-decisions:
  - "Reuse ShellLocale, ShellVersion, ShellReleaseChannel, and FixtureDiagnosticValue instead of creating duplicate web transport vocabulary."
  - "Keep Phase 3 publicDistributionApproved literal false, officialArtifact literal unavailable, and remoteStateChanged literal false."
  - "Represent SHA-256 with exact 64-character bounds because the pinned Rust schema normalizer rejects the JSON Schema pattern keyword."
patterns-established:
  - "Authority closure: preview receipts name future Phase 4 authority while proving no remote state changed."
  - "Release separation: human metadata, availability, evidence, controlled origin, and distribution approval remain distinct fields."
requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]
duration: 11min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 03: Closed Web Document Contract Summary

**TypeSpec route, content, evidence, release-integrity, audit, and no-change documents with literal Phase 3 authority limits and mutation-tested semantic closure**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-31T01:57:25Z
- **Completed:** 2026-07-31T02:08:28Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Added one canonical `web.tsp` library for route identity, compiled content evidence, screenshot provenance, release integrity, preview receipts, and administrative audit events.
- Reused the existing closed shell locale/version/channel types and fixture provenance instead of introducing handwritten or web-only duplicate DTO vocabulary.
- Locked Phase 3 authority with literal `false` mutation and distribution approval, an unavailable official artifact, controlled official origins, and explicit Phase 4 future authority.
- Added source-level semantic and mutation assertions that reject widened route surfaces, provenance, origins, approvals, or remote-state claims.

## Task Commits

The TDD task was committed atomically:

1. **Task 1 RED: Specify the closed web document contract** — `fa91ea9` (test)
2. **Task 1 GREEN: Author and import the canonical web contract** — `d47f18e` (feat)

## Files Created/Modified

- `packages/contracts-source/src/web.tsp` — Closed bounded Phase 3 web records and supporting literal unions.
- `packages/contracts-source/src/main.tsp` — Imports the canonical web library into the TypeSpec root.
- `tooling/contract-generation/src/check-drift.test.ts` — Semantic source diagnostics and five forbidden-widening mutation probes.

## Decisions Made

- Existing `ShellLocale`, `ShellVersion`, and `ShellReleaseChannel` remain the canonical locale/version/channel vocabulary for web documents.
- `FixtureDiagnosticValue` is the only accepted `NoChangeReceipt` provenance, preventing observed or measured values from legitimizing a simulated Phase 3 action.
- The release record can describe human metadata and availability, but public distribution approval and the official artifact remain literal-false/unavailable until later authority changes the contract.
- SHA-256 digests use fixed 64-character bounds; this preserves exact length while staying compatible with the pinned Rust schema normalizer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced unsupported JSON Schema pattern with fixed digest bounds**

- **Found during:** Task 1 GREEN full generation verification
- **Issue:** The pinned Rust schema normalizer rejects the JSON Schema `pattern` keyword emitted for a hexadecimal SHA-256 constraint.
- **Fix:** Expressed `Sha256Digest` with matching 64-character minimum and maximum bounds and generalized the semantic bound assertion to accept any positive closed range.
- **Files modified:** `packages/contracts-source/src/web.tsp`, `tooling/contract-generation/src/check-drift.test.ts`
- **Verification:** Full generator completed successfully; focused tests, TypeScript check, and TypeSpec warning-as-error compilation passed.
- **Committed in:** `d47f18e`

---

**Total deviations:** 1 auto-fixed (1 blocking)

## Known Stubs

None.

## Verification

- `pnpm --filter @liiiraa/contract-generation test -- --run -t "web contract source"` — PASS; path policy, corpus integrity, semantic source checks, and mutation probes passed.
- `pnpm --filter @liiiraa/contract-generation test` — PASS.
- `pnpm --filter @liiiraa/contract-generation check` — PASS; strict TypeScript compilation.
- `pnpm --filter @liiiraa/contracts-source check` — PASS; TypeSpec 1.14 compiled warning-free with `warn-as-error: true`.
- Full generation was exercised successfully during GREEN verification; generated transports remain the next explicit dependency and were not committed by this source-only plan.

## Threat Review

- T-03-01 is mitigated by literal `remoteStateChanged: false`, fixture-only provenance, named Phase 4 authority, correlation, and reviewed-input fields.
- T-03-08 is mitigated by separate release metadata, availability, artifact evidence, controlled origin, signature state, and literal-false public approval.
- No HTTP operation, authentication/session/payment/device mutation authority, generic script field, development artifact URL, or package installation was introduced.

## Issues Encountered

- A full generator run rewrote generated artifacts as expected while proving the new schema compiles. Those generated outputs were restored byte-for-byte because generation is explicitly owned by the next dependency rather than this source-only plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-04 and later web-evidence/scaffolding work can consume one canonical closed source for route, content, release, receipt, and audit documents.
- Generated TypeScript/Rust transports still need their owning generation plan; no authority or distribution blocker was hidden in this plan.

## Self-Check: PASSED

- `packages/contracts-source/src/web.tsp`, `packages/contracts-source/src/main.tsp`, and `tooling/contract-generation/src/check-drift.test.ts` exist.
- RED commit `fa91ea9` and GREEN commit `d47f18e` are present in repository history in the required order.
- Focused semantic tests, complete contract-generation tests, strict TypeScript check, and warning-free TypeSpec compilation all pass.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
