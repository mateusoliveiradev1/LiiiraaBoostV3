# ADR 0004: Truth provenance and fixture boundary

- Status: Accepted
- Date: 2026-07-27
- Owners: architecture, desktop
- Requirements: FOUND-03, FOUND-04

## Decision

Every diagnostic value crossing a product boundary carries exactly one of five
closed provenance kinds generated from the canonical TypeSpec source:

| Kind            | Meaning                                                            |
| --------------- | ------------------------------------------------------------------ |
| `measured`      | Collected from an identified real boundary by a production adapter |
| `simulated`     | Deterministic fixture data for development or test                 |
| `derived`       | Computed from other values whose provenance remains explicit       |
| `user-provided` | Entered or selected by a person and not independently measured     |
| `unavailable`   | No defensible value is available; no placeholder value is supplied |

Unknown kinds, missing discriminators, mismatched variants, fabricated values,
and unavailable values carrying data fail runtime schema validation. Generated
transports are mapped into native frozen truth values only after validation.

The current production reference is inspection-only and fail-closed. Until a
real native transport exists, it returns `unavailable`; it never falls back to
the simulator.

## Five production defenses

Fixture separation is enforced by five independent defenses:

1. **Compile-time boundary:** production-facing types cannot accept fixture
   provenance where production truth is required.
2. **Static graph boundary:** architecture rules reject production-to-fixture
   dependencies and simulator deep imports.
3. **Runtime identity boundary:** production composition refuses fixture-backed
   adapter identities even if wiring evades a static check.
4. **Artifact boundary:** built production output is recursively scanned for
   fixture sentinels and fixture identities.
5. **Process-truth boundary:** a clean subprocess executes only the emitted
   default production package export and proves it returns unavailable truth
   without loading fixtures.

`pnpm test:runtime-truth` exercises the type, static, and runtime defenses.
`pnpm test:production-truth` exercises the artifact and subprocess defenses.
Both are included in the root verification graph.

## Fixture policy

Fixtures use visibly synthetic sentinels and a frozen clock. Shared valid and
invalid corpora prove contract behavior; they are not telemetry, benchmarks, or
customer evidence. Adapter conformance requires the same request/result/error
contract for simulator and production implementations but never equates their
truth sources.

No simulated, derived, or user-provided value may be relabeled `measured`.
`unavailable` is the safe result when collection, validation, identity, or
capability evidence is absent.

## Phase 1 claim boundary

Phase 1 contains no real hardware measurement, optimizer, Windows mutation, or
before/after benchmark. Therefore it supports no performance-gain claim. It
also contains no Defender removal or bypass, Tamper Protection bypass, arbitrary
script execution, or anti-cheat interference.

The deterministic simulator demonstrates UI-facing contract states for later
phases only. It is not evidence that the future Windows capability works.

## Consequences

Truth remains explicit across processes and languages, while five separate
controls make accidental fixture leakage difficult to hide. The fail-closed
production adapter is less visually impressive than substituting fixture data,
but preserves the product's central rule: unknown evidence must stay unknown.
