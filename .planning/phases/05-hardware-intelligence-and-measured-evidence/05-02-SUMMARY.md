---
phase: 05-hardware-intelligence-and-measured-evidence
plan: '02'
subsystem: evidence-store
tags: [rust, sqlite, wal, migrations, sha256, integrity, retention]
requires:
  - phase: 05-01
    provides: Generated hardware evidence documents and schema
provides:
  - Append-oriented SQLite authority for durable hardware evidence
  - Atomic measurement-session completion with bounded ordered chunks
  - Canonical SHA-256 integrity verification across restart
  - Reference-protected evidence retention and stable fail-closed errors
affects: [05-03, 05-05, 05-06, 05-07, 05-08, 05-09]
tech-stack:
  added: [rusqlite-0.40.1, rusqlite_migration-2.6.0]
  patterns: [sqlite-wal-authority, canonical-json-hashing, atomic-lifecycle-transition]
key-files:
  created:
    - apps/desktop/src-tauri/src/evidence_store.rs
    - apps/desktop/src-tauri/src/evidence_store/migrations.rs
    - apps/desktop/src-tauri/tests/evidence_store.rs
  modified:
    - apps/desktop/src-tauri/Cargo.toml
    - crates/contracts-rust/src/validation.rs
key-decisions:
  - 'Only generated and runtime-validated hardware evidence documents may enter SQLite.'
  - 'A measurement session becomes admissible only after its document and every bounded chunk commit in one transaction.'
  - 'Canonical JSON bytes and SHA-256 hashes are verified on every authoritative read.'
  - 'Retention cannot delete either side of an evidence reference.'
requirements-completed: []
duration: 10 min
completed: 2026-08-12
status: complete
---

# Phase 05 Plan 02: Durable Evidence Store Summary

**Hardware evidence now has a transactional local authority that survives restart, detects tampering, and never admits interrupted or malformed sessions.**

## Accomplishments

- Added an embedded strict SQLite schema with WAL, foreign keys, bounded lock waits, evidence
  documents, sample chunks, durable references, retention leases, and supporting indexes.
- Added a repository that validates generated contracts before persistence, canonicalizes JSON,
  hashes every authoritative document and chunk, and verifies integrity again on reads.
- Made session completion atomic: an incomplete session remains inspectable until its final document
  and ordered bounded chunks commit together.
- Added reference-aware retention so comparison, report, and claim evidence cannot be silently
  removed.
- Added the missing generated hardware-evidence runtime validator to the Rust contracts package.

## Task Commits

1. `212659c` — add failing migration, restart, interruption, integrity, retention, and lock tests.
2. `1706198` — implement the transactional evidence authority and generated validation boundary.

## Verification

- Evidence store suite: 7/7 passed.
- Fail-closed evidence policy suite: 10/10 passed.
- Rust contract suites: 11/11 passed.
- Desktop Rust compilation passed.

## Safety Boundaries Preserved

- SQLite is the sole durable authority; browser storage and flat JSON are not evidence stores.
- Interrupted and corrupt sessions remain non-admissible.
- Lock contention fails with a bounded stable error instead of hanging.
- No Docker or external service is required.

## Self-Check: PASSED

---

_Phase: 05-hardware-intelligence-and-measured-evidence_
_Completed: 2026-08-12_
