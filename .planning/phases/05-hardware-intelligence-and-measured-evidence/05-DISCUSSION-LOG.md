# Phase 5: Hardware Intelligence and Measured Evidence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 05-hardware-intelligence-and-measured-evidence
**Areas discussed:** Native collector boundary, Evidence persistence and retention, Measurement scheduling and sources, Desktop authority transition, Comparison and report authority, Verification matrix

---

`[--auto] Selected all gray areas: Native collector boundary, Evidence persistence and retention, Measurement scheduling and sources, Desktop authority transition, Comparison and report authority, Verification matrix.`

## Native collector boundary

| Option                                                  | Description                                                                        | Selected |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| Unprivileged collector with narrow privilege escalation | Read-only collector runs unelevated; only a proven source can use a narrow broker. | ✓        |
| Always-on privileged service                            | All collection runs elevated.                                                      |          |
| WebView-side collection                                 | Browser-side APIs attempt inventory and measurement.                               |          |

**User's choice:** `[auto]` Recommended default selected.
**Notes:** Maintains least privilege and the existing native trust boundary.

## Evidence persistence and retention

| Option                                        | Description                                                                       | Selected |
| --------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| Append-oriented SQLite with bounded retention | Durable local authority with incomplete states, hashes, and protected references. | ✓        |
| Flat JSON files                               | Independent documents without transactional authority.                            |          |
| Cloud-first storage                           | Upload raw measurement evidence as the primary record.                            |          |

**User's choice:** `[auto]` Recommended default selected.
**Notes:** Matches the project constraint that diagnostics and evidence are local-first.

## Measurement scheduling and sources

| Option                                  | Description                                                                   | Selected |
| --------------------------------------- | ----------------------------------------------------------------------------- | -------- |
| Hybrid event-driven and bounded polling | Event-driven frames plus capped sensor sampling, deadlines, and cancellation. | ✓        |
| High-frequency polling for every source | Poll every metric continuously.                                               |          |
| Manual snapshots only                   | Avoid continuous supported-session capture.                                   |          |

**User's choice:** `[auto]` Recommended default selected.
**Notes:** Satisfies fidelity and explicit overhead budgets without fabricated gaps.

## Desktop authority transition

| Option                                  | Description                                                      | Selected |
| --------------------------------------- | ---------------------------------------------------------------- | -------- |
| Adapter-by-adapter authority transition | Preserve authored UI while replacing the typed fixture provider. | ✓        |
| Rewrite the measurement UI              | Replace the completed routes and components.                     |          |
| Keep fixtures as fallback values        | Show fixture numbers when real collection is unavailable.        |          |

**User's choice:** `[auto]` Recommended default selected.
**Notes:** Production must display unavailable evidence, never fixture fallback values.

## Comparison and report authority

| Option                                     | Description                                                              | Selected |
| ------------------------------------------ | ------------------------------------------------------------------------ | -------- |
| Single authoritative comparison projection | All views and exports share the same ID, metrics, limitations, and hash. | ✓        |
| Independent projections per view           | Each screen/export calculates its own values.                            |          |
| HTML-only export                           | No machine-readable portable evidence.                                   |          |

**User's choice:** `[auto]` Recommended default selected.
**Notes:** Prevents drift between summary, diff, timeline, HTML, and JSON.

## Verification matrix

| Option                                                | Description                                                               | Selected |
| ----------------------------------------------------- | ------------------------------------------------------------------------- | -------- |
| Deterministic CI plus explicit physical Windows gates | Automate repeatable logic and retain honest packaged hardware validation. | ✓        |
| Physical testing only                                 | Depend on manual testing for all coverage.                                |          |
| CI fixtures treated as physical evidence              | Record simulation as real machine proof.                                  |          |

**User's choice:** `[auto]` Recommended default selected.
**Notes:** Automates everything reproducible without falsifying physical resource measurements.

## the agent's Discretion

- Internal crate and package boundaries.
- SQLite table and chunk encoding details.
- Native source priority order and retention defaults within the locked budgets.
- Exact UI component composition where the existing authored system supports the state.

## Deferred Ideas

- Optimization execution and rollback (Phase 6).
- Optimization domains (Phase 7).
- Broad game and launcher automation (Phase 8).
- Cloud AI interpretation (Phase 9).
- Public release and full signing/rollout gates (Phase 10).
