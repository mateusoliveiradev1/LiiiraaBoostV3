# Phase 6: Transactional Plans and Recovery - Pattern Map

**Mapped:** 2026-08-13  
**Files classified:** 36 new/modified files  
**Primary analog families:** 5  
**Analogs found:** 28 / 36

## Scope Interpretation

The file set below comes from `06-RESEARCH.md`'s recommended structure and Wave 0 list, plus the integration files implied by the Cargo workspace, TypeSpec root, desktop-client barrel, Tauri host, and module-boundary registry. Generated TypeScript/Rust contract artifacts are outputs of the contract pipeline and must not be hand-edited.

The five reusable families are:

1. `packages/contracts-source/src/hardware-evidence.tsp` for closed TypeSpec documents.
2. `packages/desktop-client/src/evidence.ts` for a typed client port, runtime validation, immutable projections, cancellation, and production fixture refusal.
3. `apps/desktop/src-tauri/src/evidence_store.rs` plus its migration/test companion for migrated SQLite authority and fail-closed persistence.
4. `apps/desktop/src-tauri/src/main.rs` for narrow Tauri commands, managed native state, startup initialization, and close-to-tray continuity.
5. `packages/feature-shell/src/features/preview-workflows.tsx` plus the Phase 5 browser tests for deterministic workflow projection and accessible state rendering.

There is no existing production analog for a dependency-aware transaction reducer or authenticated privileged Windows service. Those files must use the concrete architecture in `06-RESEARCH.md`, not stretch a read-only collector into a mutation pattern.

## File Classification

| New/Modified File                                                  | Role       | Data Flow                       | Closest Analog                                                      | Match Quality |
| ------------------------------------------------------------------ | ---------- | ------------------------------- | ------------------------------------------------------------------- | ------------- |
| `packages/contracts-source/src/main.tsp`                           | config     | transform                       | existing imports in the same file / `hardware-evidence.tsp`         | exact         |
| `packages/contracts-source/src/transactional-plans.tsp`            | model      | event-driven                    | `packages/contracts-source/src/hardware-evidence.tsp`               | exact         |
| `packages/desktop-client/src/index.ts`                             | config     | transform                       | existing barrel exports / `packages/desktop-client/src/evidence.ts` | exact         |
| `packages/desktop-client/src/plans.ts`                             | service    | request-response + event-driven | `packages/desktop-client/src/evidence.ts`                           | exact         |
| `packages/desktop-client/src/plans.test.ts`                        | test       | request-response + event-driven | `packages/desktop-client/src/evidence.test.ts`                      | exact         |
| `Cargo.toml`                                                       | config     | transform                       | existing workspace member list                                      | exact         |
| `architecture/module-boundaries.json`                              | config     | transform                       | existing module records in the same file                            | exact         |
| `crates/plan-engine/Cargo.toml`                                    | config     | transform                       | `crates/contracts-rust/Cargo.toml`                                  | role-match    |
| `crates/plan-engine/src/lib.rs`                                    | config     | transform                       | `crates/contracts-rust/src/lib.rs`                                  | role-match    |
| `crates/plan-engine/src/domain.rs`                                 | model      | transform                       | none                                                                | none          |
| `crates/plan-engine/src/executor.rs`                               | service    | event-driven                    | none                                                                | none          |
| `crates/plan-engine/src/reconcile.rs`                              | utility    | transform                       | none                                                                | none          |
| `crates/plan-engine/tests/plan_revision.rs`                        | test       | transform                       | `apps/desktop/src-tauri/tests/evidence_store.rs`                    | role-match    |
| `crates/plan-engine/tests/risk_policy.rs`                          | test       | transform                       | `crates/contracts-rust/tests/provenance_properties.rs`              | role-match    |
| `crates/plan-engine/tests/dependency_rollback.rs`                  | test       | transform                       | `crates/contracts-rust/tests/provenance_properties.rs`              | role-match    |
| `crates/plan-engine/tests/reconcile.rs`                            | test       | transform                       | `apps/desktop/src-tauri/tests/evidence_store.rs`                    | role-match    |
| `apps/optimizer-service/Cargo.toml`                                | config     | transform                       | workspace crate manifests                                           | role-match    |
| `apps/optimizer-service/src/main.rs`                               | service    | event-driven                    | none                                                                | none          |
| `apps/optimizer-service/src/ipc.rs`                                | middleware | request-response                | none                                                                | none          |
| `apps/optimizer-service/src/operations/mod.rs`                     | route      | request-response                | none                                                                | none          |
| `apps/optimizer-service/src/operations/power_scheme.rs`            | service    | CRUD + request-response         | none                                                                | none          |
| `apps/optimizer-service/src/restore_point.rs`                      | service    | request-response                | none                                                                | none          |
| `apps/desktop/src-tauri/Cargo.toml`                                | config     | transform                       | existing dependency sections                                        | exact         |
| `apps/desktop/src-tauri/src/main.rs`                               | controller | request-response + event-driven | existing command/setup sections in the same file                    | exact         |
| `apps/desktop/src-tauri/src/plan_commands.rs`                      | controller | request-response + event-driven | `apps/desktop/src-tauri/src/main.rs`                                | exact         |
| `apps/desktop/src-tauri/src/plan_executor.rs`                      | service    | event-driven                    | `apps/desktop/src-tauri/src/main.rs` native authority wiring        | role-match    |
| `apps/desktop/src-tauri/src/recovery_store/mod.rs`                 | store      | CRUD + batch                    | `apps/desktop/src-tauri/src/evidence_store.rs`                      | exact         |
| `apps/desktop/src-tauri/src/recovery_store/migrations.rs`          | migration  | batch                           | `apps/desktop/src-tauri/src/evidence_store/migrations.rs`           | exact         |
| `apps/desktop/src-tauri/tests/recovery_store.rs`                   | test       | CRUD + batch                    | `apps/desktop/src-tauri/tests/evidence_store.rs`                    | exact         |
| `apps/desktop/src-tauri/tests/recovery_executor.rs`                | test       | event-driven                    | `apps/desktop/src-tauri/tests/evidence_commands.rs`                 | role-match    |
| `apps/desktop/src-tauri/tests/broker_protocol.rs`                  | test       | request-response                | `apps/desktop/src-tauri/tests/shell_contract.rs`                    | role-match    |
| `packages/feature-shell/src/features/improve.tsx`                  | component  | event-driven                    | `packages/feature-shell/src/features/preview-workflows.tsx`         | exact         |
| `packages/feature-shell/src/features/recover.tsx`                  | component  | event-driven                    | `packages/feature-shell/src/features/preview-workflows.tsx`         | exact         |
| `packages/feature-shell/src/features/transactional-plans.test.tsx` | test       | event-driven                    | existing feature-shell component tests                              | exact         |
| `apps/desktop/tests/browser/transactional-plans.spec.ts`           | test       | request-response + event-driven | `apps/desktop/tests/browser/measurement-authority.spec.ts`          | exact         |
| `apps/desktop/tests/packaged/transactional-plans.ts`               | test       | request-response + event-driven | `apps/desktop/tests/packaged/journeys.ts`                           | role-match    |

## Pattern Assignments

### Contract source: `transactional-plans.tsp` and `main.tsp`

**Analog:** `packages/contracts-source/src/hardware-evidence.tsp`

**Imports, namespace, constrained scalars** (lines 1-16):

```typespec
using TypeSpec.JsonSchema;

namespace Liiiraa.Contracts.Desktop.V1;

@minLength(1)
@maxLength(128)
scalar EvidenceIdentifier extends string;

@minLength(71)
@maxLength(71)
@pattern("^sha256:[0-9a-f]{64}$")
scalar EvidenceHash extends string;
```

Copy this structure for bounded transaction IDs, operation-version IDs, audit IDs, fingerprints, and hashes. Keep Phase 6 in `Liiiraa.Contracts.Desktop.V1`; import the new file once from `main.tsp` rather than duplicating definitions.

**Closed truthful-state union** (lines 119-155):

```typespec
model ObservedHardwareFact {
  state: "observed";
  value: EvidenceText;
  source: EvidenceText;
  observedAt: utcDateTime;
  stableDerivedId?: EvidenceIdentifier;
}

model UnavailableHardwareFact {
  state: "unavailable";
  reasonCode: HardwareUnavailableReason;
  detail: EvidenceText;
}

@oneOf
union HardwareFact {
  observed: ObservedHardwareFact,
  unavailable: UnavailableHardwareFact,
}
```

Use separate models for `prepared`, `dispatch-returned`, `observed`, `verified`, `not-applied`, `unknown`, `drift`, `conflict`, `restore-prepared`, and `restored`. Do not model transaction truth as optional fields on one mutable status object.

**Root JSON Schema document** (lines 386-394):

```typespec
@jsonSchema
@oneOf
union HardwareEvidenceDocument {
  inventory: InventorySnapshot,
  session: MeasurementSession,
  comparison: EvidenceComparison,
  report: EvidenceReport,
  claim: ClaimAdmission,
}
```

Create one closed Phase 6 document union covering plan revisions, approvals, transactions, journal events, checkpoints, receipts, progress snapshots/events, broker requests/responses, promotion evidence, revocation, and diagnostic export. Generated TS/Rust validators are the boundary authority.

**Validation rule:** bind approval to immutable revision fingerprint, evidence hashes/freshness, exact operation versions, risk, compatibility, recovery readiness, action, device, and proof expiry. There must be no executable `extreme` broker mutation variant.

---

### Desktop client: `plans.ts`, `plans.test.ts`, and `index.ts`

**Analog:** `packages/desktop-client/src/evidence.ts`

**Generated imports and narrow command registry** (lines 1-34):

```typescript
import {
  hardwareEvidenceDocumentValidator,
  type HardwareEvidenceDocumentJson,
} from '@liiiraa/contracts-ts';

import type { Result } from './errors.js';

export const EVIDENCE_COMMANDS = Object.freeze({
  refreshInventory: 'refresh_hardware_inventory',
  readInventory: 'read_hardware_inventory',
  // ...closed command names...
} as const);

export type EvidenceInvokeCommand = (typeof EVIDENCE_COMMANDS)[keyof typeof EVIDENCE_COMMANDS];
```

Define `PLAN_COMMANDS` as a closed constant and derive its type. Commands should express plan intent (`compose`, `approve`, `apply`, `restoreOperation`, `restorePlan`, `restoreCheckpoint`, `readExecution`, `subscribeExecution`) rather than generic native primitives.

**Port and authoritative snapshot** (lines 58-72, 208-232):

```typescript
export interface EvidenceAuthoritySnapshot {
  readonly revision: number;
  readonly origin: EvidenceAuthorityOrigin;
  readonly status: EvidenceAuthorityStatus;
  readonly error: EvidenceClientError | null;
}

export interface EvidenceAuthority {
  readonly origin: EvidenceAuthorityOrigin;
  snapshot(): EvidenceAuthoritySnapshot;
  subscribe(listener: EvidenceListener): () => void;
  // typed operations return Result<GeneratedDocument, ClosedError>
  dispose(): void;
}
```

Use the same port shape for `PlanAuthority`. Add authoritative `transactionId` and monotonic `sequence`. Subscription events update a projection only when contiguous; a gap marks it stale and triggers `readExecution`.

**Runtime validation and production fixture refusal** (lines 326-344):

```typescript
const validateDocument = <Kind extends HardwareEvidenceDocumentJson['kind']>(
  input: unknown,
  expectedKind: Kind,
  refuseFixtures: boolean,
): Result<ExpectedDocument<Kind>, EvidenceClientError> => {
  if (refuseFixtures) {
    const fixturePath = findFixturePath(input);
    if (fixturePath !== undefined) {
      return errorResult({ code: 'FIXTURE_PROVENANCE_REFUSED', path: fixturePath });
    }
  }
  if (!hardwareEvidenceDocumentValidator(input) || input.kind !== expectedKind) {
    return errorResult({ code: 'CONTRACT_INVALID', expectedKind, issues: validationIssues() });
  }
  return successResult(immutableClone(input as ExpectedDocument<Kind>));
};
```

Preserve the split between deterministic and native authority. Native production must reject scenario/fixture provenance; it must never catch a native failure and return simulated success.

**Cancellation/error pattern** (lines 347-377, 481-495): cancellation races the invoke without claiming that an already-dispatched mutation was cancelled. Phase 6 must distinguish `cancel-requested`, `safe-boundary-stop`, and `unknown-needs-reconciliation`; do not reuse a generic `CANCELLED` result after mutation dispatch.

---

### Recovery authority: `recovery_store/mod.rs`, `migrations.rs`, and store/executor tests

**Analog:** `apps/desktop/src-tauri/src/evidence_store.rs`; schema companion `apps/desktop/src-tauri/src/evidence_store/migrations.rs`

**Imports and closed error enum** (store lines 1-76):

```rust
#[path = "evidence_store/migrations.rs"]
mod migrations;

use rusqlite::{
    Connection, Error as SqliteError, ErrorCode, OptionalExtension, Transaction, params,
};
use serde_json::Value;
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EvidenceStoreError {
    Busy,
    ContractRejected,
    HashMismatch,
    ForeignKeyRejected,
    NotFound,
    InvalidTransition,
    Migration,
    Storage,
}
```

Create a Phase 6-specific closed error enum. Preserve actionable distinctions such as busy, disk-full/I/O, contract rejection, chain mismatch, invalid transition, conflict, and migration failure. Never reduce these to strings before the UI projection boundary.

**Connection and integrity pattern** (store lines 92-116):

```rust
let mut connection = Connection::open(path).map_err(map_sqlite_error)?;
connection.busy_timeout(BUSY_TIMEOUT).map_err(map_sqlite_error)?;
connection.execute_batch(
    "PRAGMA foreign_keys = ON;\n\
     PRAGMA journal_mode = WAL;\n\
     PRAGMA synchronous = NORMAL;",
).map_err(map_sqlite_error)?;
migrations::migrations().to_latest(&mut connection).map_err(map_migration_error)?;
connection.execute_batch("BEGIN IMMEDIATE; ROLLBACK;").map_err(map_sqlite_error)?;
let integrity: String = connection.query_row("PRAGMA quick_check", [], |row| row.get(0))?;
```

Copy the open/migrate/write-probe/integrity sequence, but Phase 6 must deliberately change the dedicated recovery database to `synchronous = FULL` and verify `foreign_keys`, `journal_mode`, and `synchronous` after setting them. Add a Phase 6-specific integrity-anchor port: HMAC-SHA-256 key epochs and the independent `{database_id, epoch, sequence, head_mac}` live under Windows Credential Manager custody, outside SQLite. Unkeyed content hashes remain useful identifiers but are not tamper authority. Do not change the Phase 5 evidence database policy globally.

**Validate/canonicalize/hash before append** (store lines 126-157 and 461-493):

```rust
validate_hardware_evidence_document(document)
    .map_err(|_| EvidenceStoreError::ContractRejected)?;
let canonical_json = canonical_json(document)?;
let content_hash = hash_bytes(&canonical_json);
self.connection.execute(
    "INSERT INTO evidence_documents (...) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    params![/* canonical values */],
)?;
```

```rust
fn canonicalize(value: &Value) -> Value {
    match value {
        Value::Array(values) => Value::Array(values.iter().map(canonicalize).collect()),
        Value::Object(values) => {
            let mut keys = values.keys().collect::<Vec<_>>();
            keys.sort_unstable();
            // insert recursively in sorted order
        }
        _ => value.clone(),
    }
}
```

Append the `prepared` event and commit before broker dispatch. Release the SQLite transaction across every OS/IPC call. Re-observe, reconcile, then append the observation/verdict. A receipt is a new immutable projection bound to the journal head, never an UPDATE from pending to success.

**STRICT migration pattern** (migration lines 3-21, 32-59):

```rust
pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(
        r#"
        CREATE TABLE evidence_documents (
          evidence_id TEXT PRIMARY KEY NOT NULL,
          lifecycle TEXT NOT NULL CHECK (...),
          canonical_json BLOB NOT NULL,
          content_hash TEXT NOT NULL CHECK (length(content_hash) = 71)
        ) STRICT;
        "#,
    )])
}
```

Use `STRICT`, foreign keys, CHECK constraints, unique IDs/sequences, and indexes. Authoritative tables are append-only: `plan_revisions`, `plan_operations`, `approval_events`, `recovery_checkpoints`, `transactions`, `journal_events`, `receipts`, `operation_promotions`; `executor_projection` is explicitly rebuildable. Add DB/API protections against update/delete of journal/receipt history.

**Test pattern** (`apps/desktop/src-tauri/tests/evidence_store.rs` lines 152-266):

```rust
#[test]
fn completed_evidence_reopens_with_identical_bytes_and_hash() { /* open, append, drop, reopen */ }

#[test]
fn interrupted_session_remains_inspectable_but_is_not_admissible() { /* restart gate */ }

#[test]
fn malformed_generated_document_and_missing_foreign_keys_fail_closed() { /* contract + FK */ }

#[test]
fn hash_mismatch_is_reported_as_corrupt_after_restart() { /* raw tamper, reopen, reject */ }
```

Add migration-upgrade, `SQLITE_BUSY/FULL/IOERR`, crash-boundary, HMAC-chain/external-anchor, whole-history rewrite with recomputed unkeyed hashes, key rotation/loss, projection-rebuild, and prepare-before-dispatch tests. Missing key/anchor custody keeps recovery evidence readable but blocks every new mutation. Do not use Docker.

---

### Tauri host: `plan_commands.rs`, `plan_executor.rs`, and `main.rs`

**Analog:** `apps/desktop/src-tauri/src/main.rs`

**Validate before dispatch and use closed native errors** (lines 128-160):

```rust
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ShellDispatchError {
    ContractRejected,
    FixtureAdapterForbidden,
    HostOperationFailed,
    WindowUnavailable,
}

pub fn dispatch_renderer_command(message: &Value) -> Result<RendererToHostShellCommand, ShellDispatchError> {
    validate_renderer_to_host_shell_command(..., message)
        .map_err(|_| ShellDispatchError::ContractRejected)
}
```

Renderer input is intent only. The Rust core revalidates generated contracts and recomputes risk, compatibility, recovery readiness, evidence fingerprint, and trusted proof references.

**Narrow command with managed authority** (lines 168-238):

```rust
#[tauri::command]
fn dispatch_shell_command(
    app: AppHandle,
    lifecycle: State<'_, Mutex<WindowLifecycle>>,
    message: Value,
) -> Result<RendererToHostShellCommand, ShellDispatchError> {
    let command = ShellContract::dispatch_renderer_command(&message)?;
    let dispatch = lifecycle.lock()
        .map_err(|_| ShellDispatchError::HostOperationFailed)?
        .dispatch_renderer_message(&message, &current_work_area(&app)?)?;
    apply_window_effects(&app, dispatch.effects)?;
    Ok(dispatch.command)
}
```

Put Phase 6 commands in `plan_commands.rs`; keep orchestration in `plan_executor.rs`. Mutation serialization belongs in native managed state, not React. Use `tauri::ipc::Channel` for ordered progress (`transactionId`, `sequence`, state, bounded display payload); authoritative reconnect reads come from SQLite.

**Startup integration** (lines 858-947):

```rust
tauri::Builder::default()
    .manage(Mutex::new(WindowLifecycle::default()))
    .setup(|app| {
        let evidence_authority = EvidenceAuthority::open(evidence_root)?;
        app.manage(Mutex::new(evidence_authority));
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![/* narrow commands */])
```

Initialize and verify the recovery authority during startup, reconcile incomplete transactions/checkpoints before admitting new mutation, then register only named commands. Update Tauri capabilities so only the trusted main webview may call them.

**Close-to-tray continuity** (lines 976-1008): preserve the existing `CloseRequested` behavior. The executor is native managed state and must continue while the renderer/window is hidden. Windows shutdown stops admission and relies on the durable journal plus next-boot observation; it does not extend shutdown indefinitely.

---

### Review and Recovery UI: `improve.tsx`, `recover.tsx`, and component tests

**Analog:** `packages/feature-shell/src/features/preview-workflows.tsx`

**Design-system imports and pure transition oracle** (lines 1-93):

```typescript
import {
  ChangeLedger,
  LbButton,
  RecoveryCheckpoint,
  RestartPlanner,
  RiskClass,
  RouteHeader,
  VerificationReceipt,
} from '@liiiraa/design-system';

const TRANSITIONS: Readonly<
  Record<PreviewWorkflowState, Partial<Record<PreviewWorkflowEvent, PreviewWorkflowState>>>
> = Object.freeze({
  review: Object.freeze({ VALIDATE: 'validating' }),
  validating: Object.freeze({ VALID: 'ready', FAIL: 'partial-failure' }),
  // ...
});

export const advancePreviewWorkflow = (state, event) => TRANSITIONS[state][event] ?? state;
```

Retain these components and state labels as the deterministic UI oracle, but feed them authoritative `PlanAuthoritySnapshot` data. UI transitions request actions; they do not declare applied/restored/verified state.

**Accessible state surfaces** (lines 252-350):

```tsx
<section aria-labelledby="preview-request-title" data-lb-region>...</section>

<section aria-live="assertive" data-lb-region role="alert">
  <h2>Partial failure</h2>
</section>

<RecoveryCheckpoint detail={...} locale={locale} title={...} />
<VerificationReceipt detail={...} locale={locale} receiptId={...} />
```

Extend `ImproveFeature`; do not replace its review/operation inspector. Evolve `RecoverFeature` into the single Recovery Center using the same design-system primitives. Every requested/prior/observed/verified/conflicting value must have text/semantics, not color-only communication. Respect keyboard operation, PT-BR/English, 320 px reflow, 200% scale, and reduced motion.

**Critical UI rule:** `Extremo` is visible/explained but not confirmable. The existing preview phrase for Extreme is a simulation artifact and must not become a production execution path. Experimental may use typed phrase only in addition to trusted strong-auth and proven recovery.

---

### Browser and packaged journeys

**Analog:** `apps/desktop/tests/browser/measurement-authority.spec.ts`

**Truthfulness and accessibility assertions** (lines 231-260):

```typescript
test('measurement authority renders observed and unavailable facts without invented values', async ({
  page,
}) => {
  await openMeasurementAuthority(page);
  const unavailableAudio = page.locator('#evidence-audio');
  await expect(unavailableAudio).toHaveAttribute('data-evidence-state', 'unavailable');
  await expect(unavailableAudio).not.toContainText(/\b\d+(?:[.,]\d+)?\s*(?:%|ms|Hz|GB)\b/u);
  await expectNoAxeViolations(page, ['.lb-native-measure']);
});
```

Phase 6 journeys must assert exact prior/requested/observed values, drift/conflict copy, unavailable recovery layers, no fabricated success, axe results, keyboard focus/order, both locales, reflow, scale, and reduced motion.

**Keyboard workflow pattern** (lines 262-316): focus each action, press Enter, assert busy/state transitions, and verify user inputs survive refresh/reconnect. Add reopen-from-tray and missed-sequence refetch scenarios.

Packaged/VM journeys use the same logical assertions, but the four promotion stages are sequential evidence gates: deterministic simulation -> clean VM -> owner PC -> friends' PCs. A failure blocks that exact operation version and creates a new version starting again at simulation.

---

### Workspace and boundary configuration

**Analog:** `architecture/module-boundaries.json` lines 54-105 and existing workspace manifests.

```json
{
  "id": "optimizer-domain",
  "owner": "optimizer",
  "layer": "domain",
  "roots": ["crates/optimizer-domain"],
  "publicRoots": ["crates/optimizer-domain/src/lib.rs"],
  "runtimeClass": "production",
  "status": "reserved"
}
```

Add/activate explicit records for the pure plan engine and privileged broker before their source files. The plan engine is domain; desktop orchestration is application; the broker is a production adapter/service. The broker may depend on generated contracts and the narrow operation implementation, never feature-shell/renderer packages. Add Cargo workspace membership in the same task as boundary ownership.

## Shared Patterns

### Generated validation at every trust boundary

**Sources:** `hardware-evidence.tsp` lines 119-155, `evidence.ts` lines 326-344, `main.rs` lines 137-153.  
**Apply to:** renderer -> Tauri, Tauri -> broker, downloaded revocation/promotion documents, journal reopen, and diagnostic import/export.

TypeSpec is canonical. Validate unknown JSON before mapping to generated transport types. The renderer never supplies authoritative compatibility, risk, authentication, prior state, or success.

### Fail-closed production/fixture separation

**Sources:** `evidence.ts` lines 286-344; `main.rs` lines 155-165 and 1060-1080.  
**Apply to:** `plans.ts`, `plan_commands.rs`, broker registry, deterministic adapters, packaged tests.

Production exposes only admitted operation versions. For Phase 6 that is the dedicated power-scheme operation after gates pass. A native error produces an unavailable/unknown/recovery state, never fixture fallback.

### Error handling

**Sources:** `evidence_store.rs` lines 66-76 and 499-517; `evidence.ts` lines 41-55 and 469-495.  
**Apply to:** stores, executor, client, broker boundary.

Use closed enums/unions and translate once per boundary. Preserve ambiguity (`unknown`), drift, conflict, disk-full, contract failure, proof failure, and replay rejection. A transport success is not an operation receipt.

### Durable intent before external effect

**Source:** closest repository pattern is `evidence_store.rs` lines 126-157; the exact Phase 6 sequence is research-led.  
**Apply to:** every apply, retry, individual restore, plan restore, checkpoint restore, power-plan effect, and restore-point preparation.

Sequence: validate/admit -> observe prior -> append+commit prepared -> release DB transaction -> dispatch exact command -> observe Windows -> reconcile -> append verdict/receipt. Never hold SQLite across IPC/Win32 and never blind-retry mutation.

### Authentication and authorization

No complete in-repo analog exists for fresh action-scoped desktop proof. Recovery remains callable without Premium or strong-auth. Apply approval must reference a trusted one-use proof bound to action, device, plan fingerprint, operation-version set, and expiry. Advanced/Experimental real execution remains blocked until that spike succeeds; never accept `strongAuth: true` from React.

### Logging and diagnostics

Receipts retain local technical detail and immutable audit IDs. Export packages are local, redacted, previewable, and consented. Do not store credentials, typed confirmation phrases, raw IPC secrets, or unnecessary raw hardware data in SQLite/logs.

## No Analog Found

| File                                                    | Role       | Data Flow               | Reason / Planner Direction                                                                                     |
| ------------------------------------------------------- | ---------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `crates/plan-engine/src/domain.rs`                      | model      | transform               | No existing immutable plan/DAG/risk domain. Use Research Patterns 1 and 4 with TDD/property tests.             |
| `crates/plan-engine/src/executor.rs`                    | service    | event-driven            | No native transaction reducer exists. Implement durable states from Research Patterns 2-4.                     |
| `crates/plan-engine/src/reconcile.rs`                   | utility    | transform               | No observation-first prior/requested/conflict reducer exists. Use the three-way research example exhaustively. |
| `apps/optimizer-service/src/main.rs`                    | service    | event-driven            | No privileged service exists. Require the `windows-service` legitimacy checkpoint first.                       |
| `apps/optimizer-service/src/ipc.rs`                     | middleware | request-response        | No authenticated/replay-resistant named-pipe protocol exists. Security spike blocks mutation.                  |
| `apps/optimizer-service/src/operations/mod.rs`          | route      | request-response        | No privileged closed mutation registry exists. Use a compiled enum with no generic/Extreme variant.            |
| `apps/optimizer-service/src/operations/power_scheme.rs` | service    | CRUD + request-response | Existing Windows collection is read-only. Use documented PowrProf APIs and the research operation sequence.    |
| `apps/optimizer-service/src/restore_point.rs`           | service    | request-response        | No System Restore wrapper exists. Dynamically resolve `SRSetRestorePointW`; verify status/sequence.            |

## Planner Guardrails

- Treat the broker IPC identity/replay design, interactive-user PowrProf context, fresh action-scoped authentication, `synchronous=FULL` durability/fault behavior, and `windows-service` legitimacy as blocking spikes/checkpoints.
- Do not plan performance-setting changes in Phase 6. Clone/name/activate/verify/restore `Liiiraa Verificado`; make no performance-gain claim.
- Do not use `powercfg`, PowerShell, generic registry/file/service RPC, arbitrary JSON operations, remote rollback, or Docker.
- Apply/restore are new transactions. Never edit old journal/receipt rows.
- On partial failure, reverse only the affected dependency closure; preserve independently verified groups.
- On crash/timeout/abandoned mutex, observe first. Prior = not applied/no retry; requested = applied/receipt; anything else = conflict/user choice.
- Restore Point is complementary. The Liiiraa manifest and exact prior state remain primary.
- Window close hides to tray while native execution continues; startup recovery preempts new mutation.

## Metadata

**Analog search scope:** `packages/contracts-source`, `packages/desktop-client`, `packages/feature-shell`, `apps/desktop/src-tauri`, `apps/desktop/tests`, `crates`, `architecture`  
**Primary source files read:** 11 (including migration and test companions)  
**Primary analog families retained:** 5  
**Pattern extraction date:** 2026-08-13  
**Unrelated worktree changes preserved:** `.planning/STATE.md`, app `.gitignore` files, and `turbo.json`
