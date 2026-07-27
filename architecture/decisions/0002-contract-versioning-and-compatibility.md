# ADR 0002: Contract versioning and compatibility policy

- Status: Accepted
- Date: 2026-07-27
- Owners: architecture/contracts
- Requirement: FOUND-01

## Decision

All generated HTTP and desktop contracts follow SemVer at the contract-set level. The
approved baseline is the versioned, hash-verified manifest at
`tooling/contract-compat/fixtures/versioned-baseline.json`. It identifies an immutable
Git revision, the exact four owned JSON artifacts, and their SHA-256 digests. The
compatibility gate loads those bytes from Git, verifies every digest, and compares them
with current generated output. A mutable working-tree file is never its own baseline.

Generation drift and compatibility are independent terminating gates:

- `pnpm contracts:check` regenerates seven artifacts into an isolated temporary root
  and compares bytes and paths without modifying the checkout.
- `pnpm contracts:compat` compares the clean generated contract set with the approved
  baseline and rejects unapproved incompatible evolution.

Both commands run in root `pnpm verify`. A clean drift result does not approve a
breaking change, and an unchanged compatible baseline does not excuse stale generated
output.

## SemVer rules

- Patch releases may clarify descriptions or metadata without changing accepted
  instances or public operations.
- Minor releases may add optional closed-schema properties, new independent schemas,
  or additive HTTP operations that `oasdiff` classifies as non-breaking.
- Removing a schema or field, changing required members, changing a type/reference,
  changing a discriminator, changing an envelope, changing closure, or changing a
  numeric/string/collection bound is breaking.
- A breaking change requires a strictly higher major version and an explicit
  `majorTransitionApproval` naming `architecture/contracts` and `ADR-0002`.
- Version regression is always rejected. Changed artifacts with an unchanged version
  are rejected.

The desktop policy intentionally treats broader bounds as breaking even when some
consumer compatibility definitions would call them additive. Broader bounds weaken
the trust boundary by accepting values that the approved validator rejected.

## HTTP compatibility

HTTP operation changes are evaluated by `oasdiff` 1.26.0. The tool is required when
the OpenAPI document differs from the approved baseline; an unavailable executable
fails closed. Identical HTTP documents do not invoke the external binary. Desktop
JSON Schema compatibility is evaluated by the repository-owned closed-schema rules.

The current OpenAPI document contains no operations. Introducing the first operation
must therefore provision the already selected `oasdiff` 1.26.0 binary in the quality
environment before its baseline can be approved.

## Deprecation and transition window

A stable field, discriminator, message, or operation must remain available for at
least one full minor release and 90 calendar days after its replacement is published.
Deprecation metadata must name the replacement and removal target. The window informs
clients but does not make removal non-breaking; actual removal still requires a major
transition approval.

During a major transition, the previous major remains supported for the published
window. Producers must not silently emit the new envelope to consumers declaring the
old major. Migration adapters, when needed, live outside generated transport packages
and validate both sides at runtime.

## Approval mechanism

The contracts owner updates contract sources, advances SemVer, runs both compatibility
fixtures and root verification, and records the reviewed transition in this ADR or a
new superseding ADR. A major approval is valid only when:

1. `fromMajor` equals the approved baseline major.
2. `toMajor` equals the candidate major and is greater than `fromMajor`.
3. `approvedBy` is `architecture/contracts`.
4. `decision` is `ADR-0002` or a future superseding decision supported by an updated
   executable rule.

The baseline manifest is updated only after those checks pass and is committed with
the reviewed generated artifacts. Digest or artifact-count mismatch is tampering and
terminates the gate.

## Executable evidence

`accepted-change.json` contains exactly two cases:

1. An additive optional property under a minor version.
2. A breaking discriminator change with an explicit approved major transition.

`breaking-change.json` contains exactly four rejected cases:

1. Removed field.
2. Changed discriminator.
3. Bounds broadened beyond the trusted range.
4. Major envelope transition without approval.

`check-compat.test.ts` asserts both exact counts, executes every case, requires every
accepted case to pass, requires every breaking case to fail with diagnostics, and
checks the real approved baseline. The fixture labels cannot spoof compatibility
because verdicts are computed by the same engine used by `contracts:compat`.

## Consequences

The baseline is reviewable, tamper-evident, and independent of the current checkout.
Compatibility policy is stricter than generic consumer compatibility where safety
constraints demand it. Major transitions require visible architecture ownership
instead of an automatic version-number escape hatch. HTTP changes additionally depend
on the pinned external analyzer, while desktop contracts remain deterministic and
fully executable with repository tooling.
