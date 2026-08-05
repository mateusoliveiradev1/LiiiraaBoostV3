# Deferred Items

## Plan 04-30 regression context

- The full API replay retains six intentional `EXPECTED_RED` failures owned by Plans 04-16 and 04-17.
- The full control-plane-domain replay retains four intentional `EXPECTED_RED` failures owned by Plan 04-21.
- Plan 04-30 focused audit-anchor, audit privilege, adapter, and audit-chain suites pass; these future-plan witnesses were not changed.

## Plan 04-28 typecheck context

- Repository package-level `tsc` invocations currently fail before reaching Plan 04-28 code because the existing TypeScript projects reference `node:crypto` and `Buffer` without an installed Node ambient type library. Plan 04-28 changed no dependency or TypeScript configuration; its type-aware ESLint, focused Vitest, formatting, architecture, and supply-chain gates pass.
