---
phase: 03-complete-web-experience
gate: package-legitimacy
status: approved
approved_at: 2026-07-31T01:34:59.7270349Z
evidence_file: architecture/web-dependency-review.md
evidence_sha256: a842a37dfdfcc8ec0c917b956fae4b42d24f340045b17fd16998725e5ced1b48
evidence_commit: e5f5946b79b432e051a155034ccaa344e03c269c
---

# Phase 3 Web Dependency Approval

## Human approval

The user replied `ok` immediately after the orchestrator recommended approval
and presented this exact package, version, and plan scope. That contextual
affirmative is the explicit human approval required by Plan 03-01.

Approval grants installation authority only for:

| Package | Exact version | Official repository | Installation scope |
| --- | --- | --- | --- |
| `next` | `16.2.12` | `https://github.com/vercel/next.js` | Plans 03-06 through 03-11 only |
| `@next/mdx` | `16.2.12` | `https://github.com/vercel/next.js`, directory `packages/next-mdx` | Plans 03-06 through 03-11 only |
| `next-intl` | `4.13.4` | `https://github.com/amannn/next-intl` | Plans 03-06 through 03-11 only |

Canonical approved identities:

- `next@16.2.12`
- `@next/mdx@16.2.12`
- `next-intl@4.13.4`

## Evidence binding

- Evidence file: `architecture/web-dependency-review.md`
- Evidence SHA-256:
  `a842a37dfdfcc8ec0c917b956fae4b42d24f340045b17fd16998725e5ced1b48`
- Evidence commit:
  `e5f5946b79b432e051a155034ccaa344e03c269c`

The approval is bound to the exact registry, repository, license, lifecycle,
integrity, and recency evidence recorded by that file at that commit.

## Scope restrictions

- No version substitution is approved.
- No similarly named or additional package is approved.
- No installation outside Plans 03-06 through 03-11 is approved.
- Any version, repository, lifecycle-script, integrity, package-name, or scope
  change requires a new legitimacy audit and explicit human approval.
- This record does not itself install, resolve, or execute any package.

`minisearch@7.2.0` remains audit-OK from the Phase 3 research review and is not
part of this newly granted approval.
