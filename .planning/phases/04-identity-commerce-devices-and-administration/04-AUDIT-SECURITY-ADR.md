---
status: accepted-for-non-production
date: 2026-08-05
decision_ids: [D-46, D-47]
owners: [security, audit]
promotion_gate: external-legal-and-security-review
---

# Audit security, anchoring, and retention decision

## Decision

Administrative and security evidence is an append-only, sequence-addressed hash chain. Every event is encoded from an allowlisted generated `AuditEvent` projection plus stream, sequence, authentication context, and optional correction reference. Encoding uses ordered UTF-8 NFC fields with unsigned 32-bit big-endian byte-length prefixes. The event hash is SHA-256 over those canonical bytes, and the next event commits to that hash.

Application credentials receive only serialized-head append and bounded read authority. They receive no update, delete, or truncate authority over `audit_events`. PostgreSQL locks the chain head, rejects non-contiguous sequence or previous-hash values, rejects row mutation and truncation with triggers, and revokes mutation privileges from `PUBLIC`. A correction is a new event whose `correctionOf` field names the prior event; it never changes the prior row.

## Segments and anchor cadence

Each stream is divided into reviewable segments. The anchor scheduler closes or checkpoints the active segment every 15 minutes or after 1,000 appended events, whichever happens first. An anchor commits to stream, segment, sequence, event hash, segment start, anchor time, and event count.

The API may request an anchor but cannot sign one, delete one, overwrite one, shorten its retention, or report it healthy before write/read/checksum/signature/retention verification succeeds. The object key is derived from stream, zero-padded sequence, and head hash and is written with `If-None-Match: *`.

## External custody

Anchors are stored in a versioned S3 bucket with Object Lock compliance retention. Object bytes use S3 SHA-256 checksum verification and SSE-KMS with a storage key scoped to the audit storage role. A different, separately scoped audit role controls the asymmetric KMS signing key. API application credentials hold neither key authority nor Object Lock administration permissions.

The adapter accepts a signer port so the asymmetric KMS role can sign and verify the anchor digest without exposing private key material to application code. Provider exceptions, SDK error bodies, diagnostic bytes, commerce payloads, credentials, and raw sensitive targets are never copied into audit evidence or returned in verification results.

## Verification and drills

- On every anchor: write, read back, recompute object checksum, recompute evidence checksum, verify the asymmetric signature and key identity, and prove Object Lock compliance retention is not shorter than the anchor record.
- Daily: verify the newest checkpoint for every active audit stream against the database chain head and immutable object.
- Monthly: select and verify a complete closed segment from its first database event through every contiguous hash to the retained external anchor.
- Incident or promotion: run mutation, sequence, previous-hash, fork, truncation, checksum, signature, read, write, and retention failure probes. No failed or incomplete probe may be represented as healthy.

Stable verification report codes are `AUDIT_SEQUENCE_GAP`, `AUDIT_PREVIOUS_HASH_MISMATCH`, `AUDIT_EVENT_HASH_MISMATCH`, `AUDIT_FORK_DETECTED`, `AUDIT_TRUNCATED`, `AUDIT_ANCHOR_MISMATCH`, `ANCHOR_WRITE_FAILED`, `ANCHOR_READ_FAILED`, `ANCHOR_CHECKSUM_MISMATCH`, `ANCHOR_SIGNATURE_MISMATCH`, and `ANCHOR_RETENTION_MISMATCH`. Messages remain provider-neutral.

## Retention

Default retention is bounded by evidence purpose:

| Evidence class                                         | Retention                     |
| ------------------------------------------------------ | ----------------------------- |
| Billing, invoice, and tax evidence                     | 5 years after the transaction |
| Antifraud and dispute evidence                         | 5 years after case closure    |
| Security and recovery events                           | 2 years after closure         |
| Administrative/audit-chain events and external anchors | 5 years after append          |

Legal hold is a separately authorized extension. Every hold records an audit-role authorizer, a bounded purpose, and an explicit future expiry. An absent expiry is rejected. Legal hold never changes the bounded default into indefinite retention, and release/expiry is itself appended as audit evidence.

## Promotion boundary

These durations and controls are executable non-production product policy, not unset runtime configuration. External legal and security review remains mandatory before production promotion and may require a new reviewed decision. Such review does not authorize mutating existing history; any correction or policy transition appends new evidence.
