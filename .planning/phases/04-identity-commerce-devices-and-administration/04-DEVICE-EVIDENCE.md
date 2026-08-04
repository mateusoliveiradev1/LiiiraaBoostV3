# Phase 04 Device Evidence Protocol

## Boundary

Device identity is derived evidence, not a permanent hardware fingerprint. The desktop collector accepts hardware observations only long enough to normalize and digest each component. Its raw observation type is neither serializable nor debug-printable. Only lowercase 64-character per-component digests may leave the collector. The control-plane policy then replaces each local digest with a server-wrapped HMAC value that is scoped to the account, component class, key version, and server secret.

No implementation in this plan persists or logs collector inputs. The TypeScript result omits `localDigest` and `rawValue`; the Rust serialized result omits every raw field. The synthetic raw markers used by the privacy test exist only in `apps/desktop/src-tauri/tests/device_identity.rs`, the local collector test boundary.

## Canonical Component Matrix

| Component class            | Weight | Canonical normalization                                                      | Stability expectation                                  |
| -------------------------- | -----: | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| Platform trust / baseboard |     40 | ASCII alphanumeric, lowercase, separators and surrounding whitespace removed | Stable across reinstall; a change is substantial       |
| CPU                        |     25 | ASCII alphanumeric, lowercase, separators and surrounding whitespace removed | Stable across reinstall; a change is substantial       |
| System storage controller  |     15 | ASCII alphanumeric, lowercase, separators and surrounding whitespace removed | An ordinary replacement remains tolerable alone        |
| GPU                        |     10 | ASCII alphanumeric, lowercase, separators and surrounding whitespace removed | An ordinary replacement remains tolerable alone        |
| Memory topology            |     10 | ASCII alphanumeric, lowercase, separators and surrounding whitespace removed | An ordinary replacement remains tolerable alone        |
| Virtual platform           |     40 | Same normalization, explicit class distinct from physical platform trust     | Never compares as the same device as physical evidence |

Blank and known placeholder inventory values are rejected rather than digested. Admission requires at least three distinct classes and at least one anchor among platform trust, virtual platform, or CPU. Duplicate classes are contradictory even if one value would otherwise match.

## Tolerance Outcomes

| Matched score | Outcome                 | Meaning                                                                                                             |
| ------------: | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
|        65–100 | `same-pc`               | Reinstall and one ordinary minor GPU, storage, or memory change stay on the active PC                               |
|         40–64 | `revalidation-required` | Online revalidation is required with the changed component classes reported                                         |
|          0–39 | `replacement`           | Evidence indicates substantial replacement; no transfer is silently granted                                         |
|       invalid | `rejected`              | Empty, sparse, contradictory, malformed, key-version-mismatched, or physical/virtual-crossing evidence fails closed |

The canonical TypeScript and Rust matrices prove scores of 100 for unchanged evidence, 90 for a GPU-only change, 60 for a platform-only change, and 35 for platform-plus-CPU change. Both runtimes order changed component classes deterministically for explainable revalidation.

## Privacy and Key Separation

1. Rust normalizes one component at a time and calculates `SHA-256(domain || accountSalt || componentClass || normalizedValue)` locally.
2. The raw observation is dropped; only its per-account local digest can cross the desktop boundary.
3. TypeScript uses Web Crypto HMAC-SHA-256 to calculate `HMAC(serverKey, domain || keyVersion || accountSalt || componentClass || localDigest)`.
4. A different account salt or key version changes every protected digest, preventing cross-account or cross-version linkage.
5. Comparison accepts only protected digests with the same declared key version. Rotation therefore requires explicit re-derivation rather than ambiguous mixed-key matching.

The exact audited Cargo pins are `hmac 0.13.0`, `hkdf 0.13.0`, `sha2 0.10.9`, and `subtle 2.6.1`. The local collector uses the approved `sha2 0.10.9` and `subtle 2.6.1` surfaces. Server wrapping uses the platform Web Crypto HMAC implementation. The RustCrypto `hmac/hkdf 0.13` line depends on `digest 0.11`, while the mandated `sha2 0.10.9` pin implements `digest 0.10`; the collector therefore does not compose those incompatible generic versions or hand-roll HMAC/HKDF.

## Threat Analysis

| Threat                             | Control                                                                                                     | Executable proof                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Raw identifier disclosure          | Non-serializable raw observation type, local digest boundary, no logging calls                              | Rust serialization test and changed-file sentinel scan              |
| Cross-account correlation          | Account salt participates in every local and server digest                                                  | TypeScript and Rust salt-rotation tests                             |
| Key-version correlation            | Key version participates in the server HMAC input and comparison rejects mixed versions                     | TypeScript key-version rotation test                                |
| Brittle reinstall/upgrade matching | Operating-system installation contributes no component; weighted threshold tolerates ordinary minor changes | TypeScript and Rust 100/90 score cases                              |
| Spoofed sparse evidence            | Minimum three classes plus anchor requirement                                                               | TypeScript derivation/comparison and Rust collector rejection tests |
| Contradictory component claims     | Duplicate component classes fail before persistence or comparison                                           | TypeScript wrapping test and Rust collector test                    |
| VM/physical confusion              | Virtual platform is explicit and physical/virtual evidence never matches                                    | TypeScript comparison and Rust class-admission tests                |

## Measured Verification

Measured on 2026-08-04 in the repository Windows development environment:

| Gate                                                                            | Result                               | Wall time |
| ------------------------------------------------------------------------------- | ------------------------------------ | --------: |
| `rtk pnpm --filter @liiiraa/control-plane-domain test -- --run device-evidence` | 5/5 TypeScript tests passed          |     4.7 s |
| `rtk cargo test -p liiiraa-desktop device_identity`                             | 5/5 Rust tests passed                |     3.6 s |
| `rtk cargo build -p liiiraa-desktop`                                            | Desktop crate built without warnings |     3.5 s |
| `rtk pnpm supply-chain:check`                                                   | 60 exact pins verified               |    21.4 s |

The focused TypeScript task check is below the required 30-second ceiling. The raw-marker scan over `packages/control-plane-domain` and `apps/desktop/src-tauri/src` returns no matches; the only raw synthetic inventory values remain inside the Rust collector test boundary.

## Deletion and Logging Proof

- Raw observations have borrowed lifetimes, are never cloned into protected evidence, and implement neither `Serialize` nor `Debug`.
- Protected Rust serialization contains only `deviceClass`, `componentClass`, and `localDigest`.
- Server-wrapped TypeScript values contain only `deviceClass`, `keyVersion`, `componentClass`, and `protectedDigest`; local digests are discarded from the returned object.
- Neither implementation contains logging, snapshot, database, filesystem, telemetry, or network writes.
- Deleting a binding can therefore delete only protected digests and version metadata; there is no raw identifier record to retain.
