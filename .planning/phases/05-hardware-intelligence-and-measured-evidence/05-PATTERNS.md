# Phase 5 Pattern Map

## File Classification

| New/modified area                                     | Closest analog                                                                    | Pattern to preserve                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/contracts-source/src/hardware-evidence.tsp` | `packages/contracts-source/src/desktop-inspection.tsp`                            | versioned namespace, bounded scalars, envelope/schema generation                        |
| generated TS/Rust contracts                           | `packages/contracts-ts/src/generated/*`, `crates/contracts-rust/src/generated.rs` | generator-owned output and drift checks; no handwritten duplicates                      |
| native collector traits                               | `apps/desktop/src-tauri/src/device_identity.rs`                                   | source trait, sanitized public projection, explicit unavailable/error outcomes          |
| native collector tests                                | `apps/desktop/src-tauri/tests/device_identity.rs`                                 | synthetic source implementation, privacy assertions, platform-gated physical smoke      |
| local authority modules                               | `apps/desktop/src-tauri/src/offline_entitlement.rs`                               | fail-closed parsing, explicit state transitions, bounded durable authority              |
| Tauri command bridge                                  | command functions and `generate_handler!` in `apps/desktop/src-tauri/src/main.rs` | operation-specific commands, validated input, narrow serializable output                |
| desktop authority port                                | `packages/desktop-client/src/experience.ts`                                       | explicit state vocabulary, immutable readonly projections, conformance-first adapters   |
| client conformance tests                              | `packages/desktop-client/src/conformance.test.ts`                                 | deterministic and production adapters satisfy the same contract                         |
| measurement UI                                        | `packages/feature-shell/src/features/measure.tsx`                                 | preserve routes and evidence primitives; replace fixture constants with projection data |
| technical UI tests                                    | `packages/feature-shell/src/features/technical-surfaces.test.tsx`                 | semantic state, provenance, unavailable-value, navigation, and locale assertions        |
| evidence visuals                                      | `packages/design-system/src/evidence.tsx`, `packages/design-system/src/data.tsx`  | accessible text alternative, source/quality semantics, bounded chart rendering          |
| desktop composition                                   | `apps/desktop/src/composition.tsx`, `apps/desktop/src/app.tsx`                    | production fixture refusal and explicit test composition                                |
| browser evidence                                      | `apps/desktop/tests/browser/accessibility.spec.ts`, `visual.spec.ts`              | deterministic harness, axe, responsive/scale/reduced-motion screenshots                 |

## Shared Patterns

- Canonical cross-boundary types originate in TypeSpec.
- Rust owns raw Windows observations and strips protected identifiers before persistence or UI projection.
- Unavailable, stale, contradictory, and degraded are typed states, not falsy values or magic numbers.
- Production composition rejects fixture provenance recursively.
- Every async native operation has cancellation, bounded timeout, and a stable error/recovery code.
- User-visible technical claims include provenance, quality, freshness, methodology, and limitations.
- PT-BR and English use the same semantic structure and route identity.
- No Docker, generic scripts, shadcn, or dashboard templates.

## No Direct Analog

The append-oriented measurement store, reference-trace scheduler, comparison admission engine, and dual HTML/JSON report authority are new subsystems. Their implementation must follow `05-RESEARCH.md`, generated contracts, SQLite transactional integrity, and the trust-boundary rules in `05-CONTEXT.md` rather than copying a web/PostgreSQL repository.
