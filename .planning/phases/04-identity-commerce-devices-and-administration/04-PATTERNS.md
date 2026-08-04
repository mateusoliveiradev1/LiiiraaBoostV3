# Phase 4: Identity, Commerce, Devices, and Administration - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 28 planned path groups
**Analogs found:** 18 / 28 assignments, using 5 primary in-repo analogs

## Scope Interpretation

Phase 4 activates production authority behind the Phase 3 account, admin, and desktop experiences. It is not a UI rebuild. The explicit existing files named by `04-CONTEXT.md` are:

- `packages/contracts-source/src/web.tsp`
- `architecture/module-boundaries.json`
- `apps/account/src/account-preview-model.ts`
- `apps/account/src/features/account-preview.tsx`
- `apps/admin/src/admin-preview-model.ts`
- `packages/web-features/src/preview-machine.ts`
- `apps/desktop/src/features/account-experience.tsx`
- `packages/feature-shell/src/features/account-settings.tsx`
- generated `packages/contracts-ts/src/index.ts` and `packages/contracts-rust/src/lib.rs`

`04-RESEARCH.md` additionally requires new API, domain, application, adapter, migration, contract-fixture, provider, desktop-native, deployment, and adversarial-test files. Paths below use the research blueprint where it is explicit and a planner-level proposed filename where the research names only a responsibility. Keep package names aligned with the repository's actual split (`contracts-source`, `contracts-ts`, and `contracts-rust`) rather than inventing a second handwritten contract package.

## File Classification

| New/Modified File or Path Group | Role | Data Flow | Closest Analog | Match Quality |
| --- | --- | --- | --- | --- |
| `packages/contracts-source/src/control-plane.tsp` | model | request-response + transform | `packages/contracts-source/src/web.tsp` | exact |
| `packages/contracts-source/src/main.tsp` | config | transform | `packages/contracts-source/src/web.tsp` | role-match |
| generated TS/Rust control-plane types and `fixtures/offline-entitlement/` | model + test fixture | transform | `packages/contracts-source/src/web.tsp` | data-flow match |
| `packages/control-plane-domain/src/{identity,commerce,devices,entitlements,support,consent,admin,audit}.ts` | model/service | transform + event-driven | `packages/web-features/src/preview-machine.ts` | data-flow match |
| `packages/control-plane-domain/src/**/*.test.ts` | test | transform + event-driven | `packages/web-features/src/preview-machine.ts` | data-flow match |
| `packages/control-plane-application/src/ports/*.ts` | service/port | request-response + event-driven | `packages/web-preview/src/no-change-adapter.ts` | exact |
| `packages/control-plane-application/src/use-cases/*.ts` | service | CRUD + event-driven | `packages/web-preview/src/no-change-adapter.ts`, `packages/web-features/src/preview-machine.ts` | role-match |
| `packages/control-plane-adapters/src/identity/*` and `better-auth.spike.test.ts` | provider + test | request-response + event-driven | none | no analog |
| `packages/control-plane-adapters/src/commerce/*` and `stripe-webhook.permutation.test.ts` | provider + test | event-driven + CRUD | none | no analog |
| `packages/control-plane-adapters/src/postgres/*` and SQL migrations | service + migration | CRUD + batch | none | no analog |
| `packages/control-plane-adapters/src/{email,storage}/*` | provider | event-driven + file-I/O | none | no analog |
| `apps/api/src/{app,server}.ts` | config/controller | request-response | none | no analog |
| `apps/api/src/modules/{identity,commerce,devices,support,admin,audit}/routes.ts` | route/controller | request-response + streaming | none | no analog |
| `apps/api/src/worker.ts` | service | event-driven + batch | none | no analog |
| `apps/api/vitest.config.ts` and `apps/api/src/testing/postgres.ts` | config + test utility | CRUD | none with PostgreSQL semantics | no analog |
| `apps/account/src/account-preview-model.ts` | model | transform | itself | exact |
| `apps/account/src/features/account-preview.tsx` plus production authority composition | component/provider | request-response | account model + shared workflow | role-match |
| `apps/admin/src/admin-preview-model.ts` | model | transform | itself | exact |
| `apps/admin/src/features/admin-preview.tsx` and `admin-runtime.ts` | component/provider | request-response + streaming | admin model + shared workflow | role-match |
| `packages/web-features/src/preview-machine.ts` | state machine/service | event-driven | itself | exact |
| `apps/desktop/src/features/account-experience.tsx` | component/provider | request-response + event-driven sync | account model + shared workflow | role-match |
| new Tauri identity, credential, device-evidence, and offline-entitlement modules | provider/utility | request-response + file-I/O | none | no analog |
| `packages/feature-shell/src/features/account-settings.tsx` | component | transform | `apps/account/src/account-preview-model.ts` | role-match |
| `architecture/module-boundaries.json` | config | transform | existing entries in the same file | role-match |
| `tooling/web-evidence/tests/account-authority.spec.ts` | test | request-response | `tooling/web-evidence/tests/account.spec.ts` | role-match |
| `tooling/web-evidence/tests/{admin-authority,admin-consent-revocation}.spec.ts` | test | request-response + streaming | `tooling/web-evidence/tests/admin.spec.ts` | role-match |
| `apps/desktop/tests/browser/{entitlement-expiry,post-premium-safety}.spec.ts` | test | event-driven | existing desktop browser specs | role-match |
| API `Dockerfile`, staging manifests/env validation, Vercel project config, and CI image/deploy jobs | config | batch | none | no analog |

## Pattern Assignments

### `packages/contracts-source/src/control-plane.tsp` and generated contract outputs

**Analog:** `packages/contracts-source/src/web.tsp`

**Bounded scalar and validation pattern** (lines 1-23):

```typespec
using TypeSpec.JsonSchema;

namespace Liiiraa.Contracts.Desktop.V1;

@minLength(1)
@maxLength(128)
scalar WebIdentifier extends string;

@minLength(64)
@maxLength(64)
scalar Sha256Digest extends string;
```

Copy the use of bounded scalars, closed unions, `@jsonSchema`, and array bounds. Extend the canonical TypeSpec source additively; do not define parallel handwritten DTOs in the API, web, or Rust crates.

**Compatibility seam to evolve additively** (lines 176-211):

```typespec
@jsonSchema
model FutureAuthorityCommand {
  phase: "Phase 4";
  surface: WebSurface;
  command: WebIdentifier;
  description: WebText;
}

@jsonSchema
model NoChangeReceipt {
  receiptVersion: ShellVersion;
  authority: FutureAuthorityCommand;
  requestedAction: WebIdentifier;
  @minItems(1)
  @maxItems(32)
  reviewedInputs: WebIdentifier[];
  reviewedAt: utcDateTime;
  correlationId: CorrelationId;
  provenance: FixtureDiagnosticValue;
  remoteStateChanged: false;
  nextPhase: "Phase 4";
}
```

Create separate authoritative command, projection, receipt, error, offline-entitlement envelope, and audit-event models. Keep `FutureAuthorityCommand`, `NoChangeReceipt`, and fixture-only `AdminAuditEvent` stable for preview/Storybook compatibility; production results must not masquerade as `remoteStateChanged: false`.

**Registration pattern:** `packages/contracts-source/src/main.tsp` lines 1-6 imports each bounded contract source exactly once. Add the new import there, then regenerate TS/Rust and run `pnpm contracts:check` plus compatibility gates. Generated files are outputs, not editing authorities.

---

### `packages/control-plane-application/src/ports/*.ts`

**Analog:** `packages/web-preview/src/no-change-adapter.ts`

**Port and result-algebra pattern** (lines 53-71):

```typescript
export type FutureAuthorityResult =
  | Readonly<{ kind: 'no-change'; receipt: NoChangeReceiptJson }>
  | Readonly<{ kind: 'cancelled'; receipt: CancelledReceipt }>
  | FutureAuthorityFailure;

export interface FutureAuthorityPort {
  execute(input: FutureAuthorityExecution): Promise<FutureAuthorityResult>;
}
```

Copy the structural interface and explicit discriminated result union. Define narrow ports for identity, sessions, commerce, clock/IDs, transactions, repositories, audit, outbox/inbox, email, and object storage. The domain/application packages must not import Fastify, Kysely, Better Auth, Stripe, AWS SDKs, React, or Tauri.

**Boundary admission pattern** (lines 111-142):

```typescript
const isFutureAuthorityCommand = (
  value: unknown,
): value is FutureAuthorityCommandJson => {
  const validation = validateWebDocument(value);
  return (
    validation.ok &&
    typeof validation.value === 'object' &&
    validation.value !== null &&
    'phase' in validation.value &&
    validation.value.phase === 'Phase 4'
  );
};

const validateReviewedInputs = (
  reviewedInputs: readonly string[],
): reviewedInputs is readonly [string, ...string[]] =>
  reviewedInputs.length >= 1 &&
  reviewedInputs.length <= 32 &&
  new Set(reviewedInputs).size === reviewedInputs.length;
```

Validate generated contracts at every untrusted boundary before converting to domain values. Preserve bounded collections and duplicate rejection. Provider SDK objects never cross the adapter boundary.

**Deterministic dependency injection pattern** (lines 182-228): inject clock/correlation sources, validate factory options before returning the port, check `AbortSignal` before and after asynchronous work, and return typed failures rather than provider exceptions.

---

### `packages/control-plane-domain/src/*` and transactional use cases

**Analog:** `packages/web-features/src/preview-machine.ts` for pure policy/state modeling only.

**Policy-as-data pattern** (lines 38-63):

```typescript
export interface PreviewActionPolicy {
  readonly authority: 'Phase 4';
  readonly confirmation: PreviewConfirmationMetadata;
  readonly requiresConsent: boolean;
  readonly requiresImpact: boolean;
  readonly requiresPurpose: boolean;
  readonly requiresReauthentication: boolean;
  readonly requiresRole: boolean;
}

const policy = (confirmation, requirements = {}): PreviewActionPolicy =>
  Object.freeze({
    authority: 'Phase 4',
    confirmation,
    requiresConsent: false,
    requiresImpact: false,
    requiresPurpose: false,
    requiresReauthentication: true,
    requiresRole: false,
    ...requirements,
  });
```

Model recovery holds, subscription/grace/refund/dispute transitions, one-PC binding/cooldown/exception rules, paid-action eligibility, consent, role assumption, and critical-command step-up as pure decisions over explicit inputs. Inject clocks, IDs, and cryptographic/provider ports.

**Validation pattern** (lines 420-465): accumulate field-addressed errors, validate freshness and consent expiry against an injected clock, and return immutable errors. Do not let the UI or provider plugin decide product policy.

**State-machine pattern** (lines 524-626): construct actors from injected ports, keep actions/guards pure, and represent offline, stale, expired-session, partial-failure, cancellation, and retry explicitly. The production workflow may retain the Phase 3 visual state vocabulary while changing the invoked port and authoritative receipt.

**Transactional pattern from research:** application use cases must lock the aggregate, reject an unexpected version, ask the pure domain policy for a decision, then persist aggregate + audit + outbox atomically. A partial unique index is defense-in-depth for the one-PC invariant, not a substitute for row locking and the domain decision.

---

### Account production projection and composition

**Analog:** `apps/account/src/account-preview-model.ts`

**Projection shape to preserve** (lines 82-98):

```typescript
export type AccountHomeScenarioId = 'essential' | 'premium-active' | 'premium-pending';

export type AccountHomeScenario = Readonly<{
  billing: Readonly<{ state: 'active' | 'none' | 'pending' }>;
  id: AccountHomeScenarioId;
  pc: Readonly<{ label?: string; state: 'linked' | 'unlinked' }>;
  plan: Readonly<{ kind: 'essential' | 'premium'; state: 'active' | 'pending' }>;
  remoteStateChanged: false;
  security: Readonly<{
    mfa: 'configured' | 'not-configured';
    passkey: 'configured' | 'not-configured';
  }>;
}>;
```

Map generated authoritative projections into the established view vocabulary rather than redesigning routes/components. Expand the production projection with aggregate version/ETag and explicit online/offline/stale/pending/conflict provenance. Keep fixture-only `remoteStateChanged: false` out of authoritative types.

**Contradiction/admission pattern** (lines 139-215):

```typescript
const contradiction = (reason: string): never => {
  throw new Error(`ACCOUNT_HOME_SCENARIO_CONTRADICTION:${reason}`);
};

export const admitAccountHomeScenario = (candidate: unknown): AccountHomeScenario => {
  // validate shape and closed states first
  // then reject cross-field contradictions
  return candidate as AccountHomeScenario;
};
```

Retain the two-stage check: validate shape/closed values, then reject contradictions such as pending Premium without pending billing or a linked PC with a link-PC recommendation. Production writes require `expectedVersion`; on conflict preserve both remote projection and local draft for review.

Apply this pattern to `apps/account/src/features/account-preview.tsx`, `apps/desktop/src/features/account-experience.tsx`, and `packages/feature-shell/src/features/account-settings.tsx`. Replace production fixture imports with a generated-client authority adapter, but keep deterministic fixture composition available to Storybook and browser tests.

---

### Admin authorization, queue projection, consent, and audit UI

**Analog:** `apps/admin/src/admin-preview-model.ts`

**Role-to-route admission pattern** (lines 45-53):

```typescript
export const ADMIN_ROLE_ROUTE_ACCESS = Object.freeze({
  support: ['admin-role', 'admin-support'],
  operations: ['admin-role', 'admin-operations', 'admin-audit'],
  security: ['admin-role', 'admin-security', 'admin-diagnostics', 'admin-audit'],
  audit: ['admin-role', 'admin-audit', 'admin-audit-event'],
} as const);

export const adminRoleCanAccess = (role, routeId): boolean =>
  ADMIN_ROLE_ROUTE_ACCESS[role].includes(routeId as never);
```

Preserve the UX map, but enforce the same restriction server-side from session and singular assumed-role claims. The URL `?role=` is navigation state, never authorization. Critical commands additionally require recent action-scoped passkey/MFA, mandatory reason, impact review, confirmation, and an appended immutable audit event.

**Authorize before projection/search pattern** (lines 317-340):

```typescript
// Role admission is deliberately the first operation. Search and filters never see denied rows.
const roleAdmitted = ADMIN_QUEUE_RECORDS.filter(({ permittedRoles }) =>
  (permittedRoles as readonly AdminPreviewRole[]).includes(role),
);
const searched = normalizedQuery
  ? roleAdmitted.filter((record) =>
      [record.id, record.auditEventId, record.redactedTarget[locale]].some((field) =>
        field.toLocaleLowerCase(locale).includes(normalizedQuery),
      ),
    )
  : roleAdmitted;
```

Apply admission before query/filter/sort and project redacted targets only. The production support stream must continuously revalidate case + purpose + field-class consent and abort/clear the operator view immediately on revoke/expiry; do not hand the browser durable presigned object URLs.

---

### Shared mutation workflow in `packages/web-features/src/preview-machine.ts`

**Analog:** the file itself.

Keep the established review sequence and explicit interruption states. The issuing state already demonstrates the adapter seam (lines 735-765):

```typescript
issuing: {
  invoke: {
    id: 'issuePreview',
    input: ({ context }) => ({ context }),
    onDone: [
      { guard: ({ event }) => isNoChangeResult(event.output), target: 'complete' },
      { target: 'partial-failure' },
    ],
    onError: {
      actions: assign(({ context }) => ({
        ...context,
        failureCode: 'AUTHORITY_UNAVAILABLE' as const,
      })),
      target: 'partial-failure',
    },
    src: 'issuePreview',
  },
}
```

Generalize the result guard from fixture `NoChangeReceipt` to generated authoritative receipt/error variants. Preserve cancellation, abort, offline, stale, expired-session, partial failure, and retry semantics. A checkout return must remain pending until reconciled provider state reaches the projection.

## Shared Patterns

### Authentication and Step-Up

**Sources:** `packages/web-features/src/preview-machine.ts` lines 79-132 and 701-733; `apps/admin/src/admin-preview-model.ts` lines 45-53.

- Centralize action policy; do not scatter `if (role)` or `if (mfa)` checks across routes.
- Ordinary account access and Premium device binding are distinct authorities.
- Admin role assumption is singular and audited.
- Sensitive account and all critical admin commands require recent, action-scoped strong authentication.
- Existing preview reauthentication is a UX sequence only. It is not a server auth pattern to copy.

### Error Handling

**Source:** `packages/web-preview/src/no-change-adapter.ts` lines 25-56 and 96-106.

Use bounded machine-readable codes and discriminated results. Translate provider/SQL/crypto failures at adapter boundaries, retain correlation IDs, redact secrets/provider payloads, and map retryability explicitly. Do not expose raw provider exceptions or collapse conflict, stale, offline, unauthenticated, unauthorized, consent-expired, and internal errors into one generic failure.

### Runtime Validation and Immutability

**Sources:** `packages/contracts-source/src/web.tsp` lines 5-23 and 95-109; `packages/web-preview/src/no-change-adapter.ts` lines 82-94 and 111-142.

Validate generated schemas at ingress, webhook admission, provider retrieval, persisted document load, and desktop IPC. Use immutable projections/results (`Readonly`, frozen collections) and keep raw serials, tokens, card data, and diagnostic bytes outside PostgreSQL DTOs.

### Authority, Transactions, and Versioning

Every mutation carries an expected version, authorizes before loading sensitive detail, locks the aggregate, derives a pure decision, and commits aggregate + audit + outbox atomically. Conflict responses include the remote projection while the client retains its local draft. PostgreSQL is authority; cache or `LISTEN/NOTIFY` can only accelerate reconciliation.

### Fixture Boundary

The current account/admin/desktop previews remain valid fixture and visual-regression compositions. Production entrypoints must not import `@liiiraa/web-preview`, but Storybook/test entrypoints may. Extend `architecture/module-boundaries.json` near the existing `contracts-source`, `web-preview`, `apps/account`, and `apps/admin` entries (searched at lines 54-58, 171-175, 210-220) to encode inward dependencies for the three new control-plane packages and prohibit production-to-fixture imports.

### Testing

- Copy the user-facing journey style and accessibility-first locators from `tooling/web-evidence/tests/account.spec.ts` and `admin.spec.ts`; change only the authority expectations. The existing tests explicitly exercise reauthentication (account lines 52-59), disconnected authority (account line 449), role-preserving admin navigation (admin lines 49-67), and consent/audit UI.
- Domain tests use deterministic clocks/IDs and state tables for recovery, commerce, entitlement, device, consent, and admin decisions.
- PostgreSQL tests must exercise real concurrent transactions, row locks, partial indexes, unique constraints, and migration upgrades; an in-memory substitute is not sufficient.
- Stripe tests permute duplicate, delayed, replayed, and reordered events and verify the raw request signature before parsing.
- Cross-language fixtures must verify exact signed bytes and cover tamper, wrong key, wrong device, wrong version, clock rollback, and expiry.
- Desktop E2E distinguishes starting a new paid action from completing an in-flight operation and from always-available safety/history/restoration.

## No Analog Found

These areas are greenfield in the repository. The planner should use the concrete architecture and code patterns in `04-RESEARCH.md`, not force a frontend analog.

| File/Area | Role | Data Flow | Required Research Pattern |
| --- | --- | --- | --- |
| Fastify composition and routes | controller/route | request-response + streaming | thin HTTP boundary; generated validation; raw webhook capture; route-to-use-case mapping |
| PostgreSQL repositories and migrations | service/migration | CRUD + batch | explicit transactions, locks, partial unique indexes, append-only audit privileges |
| Webhook inbox/outbox and worker | service | event-driven + batch | verify raw signature, insert unique provider/event ID, acknowledge, reconcile provider state, then project |
| Better Auth candidate adapter | provider | request-response | terminating spike for native PKCE, passkey step-up, MFA/recovery, revocation, and abuse resistance |
| Stripe/SES/S3 adapters | provider | event-driven + file-I/O | narrow ports, provider idempotency, encrypted object lifecycle, no provider-owned product policy |
| Desktop credential/device/entitlement Rust modules | provider/utility | request-response + file-I/O | Windows Credential Manager, protected component evidence, exact-byte Ed25519 verification before parsing |
| Consent-gated diagnostics stream | route/service | streaming | continuous consent revalidation, `Cache-Control: no-store`, abort and clear on revoke/expiry |
| Audit chain and external anchor | service/model | event-driven + file-I/O | canonical length-prefixed bytes, sequence/previous hash, append-only DB privileges, immutable object checkpoint |
| API/PostgreSQL test harness | config/utility | CRUD | Testcontainers in CI plus synthetic Neon mode; real PostgreSQL semantics |
| OCI/Vercel/staging deployment files | config | batch | same immutable container promoted by digest; separate origins; invitation-only synthetic environments |

## Do Not Copy

- Do not copy `remoteStateChanged: false`, `nextPhase: "Phase 4"`, fixture provenance, or `simulated-no-change` into production authority records.
- Do not treat browser URL role state, client-side route admission, or the preview reauthentication button as authorization.
- Do not parse Stripe webhook JSON before raw-body signature verification.
- Do not grant Premium from checkout navigation or from an unreconciled webhook event.
- Do not expose S3 presigned diagnostic URLs to operators.
- Do not hash one concatenated HWID, store raw serials, or verify a reserialized entitlement JSON object.
- Do not put PostgreSQL, Fastify, provider SDKs, React, or Tauri imports in the pure domain package.

## Metadata

**Primary analogs (5):**

1. `packages/contracts-source/src/web.tsp`
2. `packages/web-preview/src/no-change-adapter.ts`
3. `packages/web-features/src/preview-machine.ts`
4. `apps/account/src/account-preview-model.ts`
5. `apps/admin/src/admin-preview-model.ts`

**Supporting test witnesses:** `tooling/web-evidence/tests/account.spec.ts`, `tooling/web-evidence/tests/admin.spec.ts`, `apps/desktop/tests/browser/account-profile.spec.ts`.

**Analog search scope:** `apps/`, `packages/`, `tooling/`, `architecture/`; generated/build/vendor directories excluded from selection.

**Pattern extraction date:** 2026-08-04
