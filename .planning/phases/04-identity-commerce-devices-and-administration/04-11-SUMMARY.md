---
phase: 04-identity-commerce-devices-and-administration
plan: '11'
subsystem: identity
tags: [better-auth, pkce, postgres, fastify, sessions, security, vitest]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: Generated identity and session contracts from Plan 04-03
  - phase: 04-identity-commerce-devices-and-administration
    provides: Reviewed PostgreSQL identity and session schema from Plan 04-04
  - phase: 04-identity-commerce-devices-and-administration
    provides: Approved Better Auth provider port and native-client spike from Plan 04-05
  - phase: 04-identity-commerce-devices-and-administration
    provides: Generated contract validators and control-plane adapter seams from Plan 04-32
provides:
  - Closed invitation and verified-email admission for password, Google, Discord, and passkey authentication
  - API-owned one-shot desktop PKCE authorization and provider code exchange
  - Hashed PostgreSQL session authority with owner-scoped list and individual revocation
  - Generated-contract Fastify identity routes with web-cookie and Windows credential custody
affects: [04-12, 04-13, 04-14, 04-16, 04-30, desktop-auth, account, administration]
tech-stack:
  added: []
  patterns:
    - Keep provider sessions and tokens behind IdentityProviderPort while issuing independent local credentials
    - Bind provider account identity exactly to the invited local identity before session issuance
    - Validate generated projections at HTTP output boundaries and redact provider failures generically
key-files:
  created:
    - packages/control-plane-domain/src/identity/authentication.ts
    - packages/control-plane-application/src/use-cases/authenticate.ts
    - packages/control-plane-adapters/src/identity/better-auth-adapter.ts
    - apps/api/src/modules/identity/routes.ts
  modified:
    - packages/control-plane-domain/src/identity/authentication.test.ts
    - packages/control-plane-application/src/ports/identity.ts
    - packages/control-plane-adapters/src/identity/better-auth-spike.ts
    - apps/api/src/modules/identity/identity-conformance.test.ts
key-decisions:
  - 'Email verification authority comes only from the invitation identity record; request bodies cannot grant verified status.'
  - 'Provider completion must return the exact invited account ID before an independently credentialed local session is issued.'
  - 'The API alone owns PKCE verifier, state, issuer, callback validation, provider exchange, and desktop credential issuance.'
  - 'Session revocation is owner-scoped and independent of Premium device binding.'
patterns-established:
  - 'Identity admission: collapse method, invitation, verification, state, origin, CSRF, and risk rejection into one generic failure.'
  - 'Credential custody: secure HttpOnly cookie for web; explicit Windows Credential Manager handoff for desktop.'
  - 'Session authority: store only local credential digests and bounded provider-session references.'
requirements-completed: [IDEN-01]
duration: 24 min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 11: Invited Identity and Session Authority Summary

**Invited password, Google, Discord, and passkey authentication now produces provider-bound local sessions through API-owned PKCE exchange, hashed PostgreSQL authority, secure web cookies, and independently revocable web/desktop projections.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-05T01:34:00Z
- **Completed:** 2026-08-05T01:58:25Z
- **Tasks:** 1 TDD task
- **Files modified:** 12

## Accomplishments

- Added fail-closed domain admission for the four approved methods while rejecting Microsoft, missing invitations, unverified email, disabled/revoked identities, origin/CSRF/risk failures, public registration, and replay with provider-independent responses.
- Implemented transactional authenticate, list, and owner-scoped revoke use cases that issue independent local credentials, persist only their digest, and keep session revocation separate from device binding.
- Added a Better Auth adapter that retains provider runtime objects and tokens internally, binds provider account identity to the invited local account, and owns one-shot PKCE verifier/state/issuer/loopback-callback validation.
- Added thin Fastify web and desktop routes that validate generated session documents, use secure HttpOnly cookie custody for web, and return only Windows Credential Manager custody data for desktop.

## TDD Gates

- **RED — `40e7efd`:** Added 12 closed-admission domain cases and replaced 13 API owner placeholders with executable identity/session cases. RED failed only through explicit missing-authority assertions.
- **GREEN — `f1632c3`:** Implemented domain admission, transactional use cases, Better Auth/PostgreSQL adapters, generated-contract routes, public seams, and the authoritative identity-binding security corrections. All 38 focused cases pass.
- **REFACTOR:** Route parsing, provider failure mapping, projections, and session-row validation were consolidated during GREEN. No separate behavior-neutral commit was needed after type, lint, contract, and architecture gates passed.

## Task Commits

1. **Task 04-11-01 RED: Add failing identity authority witnesses** — `40e7efd` (`test`)
2. **Task 04-11-01 GREEN: Implement invited identity session authority** — `f1632c3` (`feat`)

## Files Created/Modified

- `packages/control-plane-domain/src/identity/authentication.ts` — Closed authentication-method and admission decision.
- `packages/control-plane-domain/src/identity/authentication.test.ts` — Twelve supported and rejected admission cases.
- `packages/control-plane-application/src/use-cases/authenticate.ts` — Invitation/risk admission, provider completion, local credential issuance, session projection/list/revoke.
- `packages/control-plane-application/src/ports/identity.ts` — Provider session account identity required at the port boundary.
- `packages/control-plane-adapters/src/identity/better-auth-adapter.ts` — Better Auth gateway isolation, PKCE challenge custody, provider redaction, and PostgreSQL session repository.
- `packages/control-plane-adapters/src/identity/better-auth-spike.ts` — Spike fixture aligned with authoritative provider account identity.
- `apps/api/src/modules/identity/routes.ts` — Web authenticate, desktop authorization/exchange, and owner-scoped session routes.
- `apps/api/src/modules/identity/identity-conformance.test.ts` — Thirteen generated-contract, custody, rejection, PKCE, and session-authority cases.
- `packages/control-plane-domain/src/index.ts` — Public domain admission export.
- `packages/control-plane-application/src/index.ts` — Public transactional use-case export.
- `packages/control-plane-adapters/src/index.ts` — Public Better Auth/PostgreSQL adapter export.
- `packages/contracts-ts/src/index.ts` — Public generated session command/projection types.

## Decisions Made

- Invitation lookup is the sole email-verification and local-account authority. The API does not accept an `emailVerified` request field, preventing clients from self-granting admission.
- Provider completion returns a bounded account ID and session reference; local session issuance fails unless that account exactly matches the admitted invitation identity.
- Desktop OAuth uses a public-client identifier without a client secret. The API retains the PKCE verifier and exchanges the authorization code; desktop receives only a separately issued local credential for Windows Credential Manager.
- Local session credentials are independent from Better Auth provider sessions. PostgreSQL stores only their digest, while generated HTTP projections contain neither token.
- Session list and revoke are scoped to the authenticated account and do not touch device binding, preserving the distinction between concurrent sessions and the one-PC Premium rule.

## Verification Results

- Domain admission: **PASS** — 12/12 supported-method and fail-closed cases.
- API identity conformance: **PASS** — 13/13 invitation, redaction, PKCE, credential-custody, generated-projection, list, and revoke cases.
- Better Auth spike: **PASS** — 13/13 approved provider-port and native-public-client cases.
- Strict TypeScript: **PASS** — API, domain, application, and adapter projects.
- Targeted ESLint and Prettier: **PASS** for strict project-owned implementation/proof files; the spike fixture is Prettier-clean and covered by its focused suite.
- Contract drift: **PASS** — all 12 generated artifacts match their sources.
- Architecture: **PASS** — workspace and Cargo adapters executed; 46/46 architecture tests pass.
- PostgreSQL: **PASS (daemon-free)** — the reviewed `sessions` schema and serializable transaction seam are exercised through deterministic query-level authority fakes. No Docker, Testcontainers, or live database was used.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Published identity artifacts through approved package seams**

- **Found during:** Task 04-11-01 GREEN
- **Issue:** The declared use cases and adapters otherwise required forbidden deep imports, and generated session types were not available through the contracts package entry point.
- **Fix:** Added narrow public exports for domain, application, adapter, and generated contract owners.
- **Files modified:** `packages/control-plane-domain/src/index.ts`, `packages/control-plane-application/src/index.ts`, `packages/control-plane-adapters/src/index.ts`, `packages/contracts-ts/src/index.ts`
- **Verification:** Four strict TypeScript projects and all 46 architecture cases pass.
- **Committed in:** `f1632c3`

**2. [Rule 2 - Missing Critical] Removed client-controlled verification and bound provider identity**

- **Found during:** Task 04-11-01 GREEN security review
- **Issue:** A request-body verification flag could have granted admission, and provider completion was not yet proven to belong to the invited local account.
- **Fix:** Removed the request flag, sourced verification only from invitation authority, required provider sessions to carry bounded `accountId`, and rejected exact-account mismatches before issuing a local credential.
- **Files modified:** `packages/control-plane-application/src/use-cases/authenticate.ts`, `packages/control-plane-application/src/ports/identity.ts`, `packages/control-plane-adapters/src/identity/better-auth-adapter.ts`, `packages/control-plane-adapters/src/identity/better-auth-spike.ts`, `apps/api/src/modules/identity/routes.ts`, focused tests
- **Verification:** Unverified invitation and provider-account mismatch cases reject generically; all 38 focused cases pass.
- **Committed in:** `f1632c3`

**3. [Rule 3 - Blocking] Corrected the focused API Vitest invocation**

- **Found during:** RED and final verification
- **Issue:** The literal plan command forwards arguments through the package script in a way that collects unrelated owner RED files instead of only identity conformance.
- **Fix:** Used `pnpm --filter @liiiraa/api exec vitest --config vitest.config.ts --run src/modules/identity/identity-conformance.test.ts`.
- **Files modified:** None.
- **Verification:** The intended API suite passes 13/13.
- **Committed in:** No code change; verification command correction only.

---

**Total deviations:** 3 auto-fixed (2 missing critical security/architecture seams, 1 blocking verification seam).
**Impact on plan:** Each deviation was necessary to publish, secure, or verify the declared identity authority. No public registration, provider token exposure, client secret, device-binding mutation, new dependency, database daemon, or external service was introduced.

## Known Stubs

- `packages/control-plane-adapters/src/identity/better-auth-adapter.ts:212` — `verifyEmail`, factor enrollment, step-up, and recovery operations return stable `ADAPTER_UNAVAILABLE` results. They are explicit future identity capabilities outside IDEN-01; invited verified identity, supported sign-in, PKCE, session list, and revoke are fully wired.

## Issues Encountered

- Context7 MCP was unavailable and the documented `ctx7` CLI fallback was not installed. Exact installed Better Auth 1.6.25 declarations and the already approved Plan 04-05 spike evidence were used instead of training-memory API assumptions.
- Installing ambient PostgreSQL types was neither necessary nor authorized. The adapter uses the existing structural serializable transaction seam and is strictly typechecked without adding a package.
- Two overlapping architecture invocations briefly exposed one runner's generated mutation fixture to the other and added that fixture importer to the lockfile. The temporary fixture completed/removed itself, the exact generated lockfile line was removed, and a single clean rerun passed all 46 cases.

## Authentication Gates

None.

## User Setup Required

None - verification is deterministic and daemon-free. No provider account, client secret, Docker daemon, PostgreSQL instance, or external credential was used or provisioned.

## Next Phase Readiness

- Account and desktop compositions can now consume the generated session projections and custody-specific authentication routes.
- MFA enrollment, step-up, recovery, and administrative session policy remain behind the provider port for their dedicated plans; their explicit unavailable results cannot be mistaken for completed runtime behavior.
- Production composition still needs real invitation, risk, credential-generator, Better Auth gateway, and PostgreSQL transaction implementations supplied at the application boundary; no handler silently substitutes mock authority.

## Self-Check: PASSED

- All four plan-declared implementation artifacts and the canonical summary exist on disk.
- RED `40e7efd` and GREEN `f1632c3` exist in repository history in the required order.
- All 38 focused behavior cases, four strict TypeScript projects, targeted lint/format, contract drift, and 46 architecture cases pass.
- No tracked files were deleted; unrelated `.impeccable/` and `apps/desktop/src-tauri/gen/` remain untouched and untracked.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
