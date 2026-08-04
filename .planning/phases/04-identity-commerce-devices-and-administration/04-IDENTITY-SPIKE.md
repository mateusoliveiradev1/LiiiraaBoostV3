# Phase 04 Identity Adapter Spike

- **Candidate:** Better Auth 1.6.25 behind `IdentityProviderPort`
- **Automated verdict:** PASS
- **Human adoption decision:** PASS — approved at the blocking Plan 04-05 checkpoint only within the D-01 through D-10 evidence and conditions recorded here
- **Human response recorded:** `pass`
- **Evidence date:** 2026-08-04
- **Focused command:** `rtk pnpm --filter @liiiraa/control-plane-adapters test -- --run better-auth.spike`
- **Result:** 13/13 tests passed, including every locked D-01 through D-10 row

The automated PASS means the exact candidate versions and the Liiiraa Boost adapter satisfy the complete executable matrix. The user's `pass` response approves production adoption of Better Auth 1.6.25 behind `IdentityProviderPort` only within the evidence and conditions proven by D-01 through D-10. It does not approve credentials, provider accounts, commercial terms, future upgrades, substitutions, or untested behavior.

## Binary evidence matrix

| Decision                                     | Verdict | Executable evidence                                                                                                                                                                                                                                                | Boundary ownership                                                                                                                                                                                                                                   |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 launch methods                          | PASS    | `D-01 admits only verified password, Google, Discord, and passkey launch methods` proves unverified password denial, the four launch methods, and Microsoft rejection.                                                                                             | Better Auth email/social/passkey APIs plus port allowlist.                                                                                                                                                                                           |
| D-02 verified registration and passkey offer | PASS    | `D-02 offers passkey enrollment only after verified email login` proves no authoritative unverified session and no pre-verification passkey enrollment.                                                                                                            | Better Auth `requireEmailVerification`, `verifyEmail`, and passkey registration surfaces; adapter ordering policy.                                                                                                                                   |
| D-03 cross-method scoped step-up             | PASS    | The parameterized `D-03` cases exercise password, Google, and passkey sessions across security-method, device-transfer, refund, and protected-data scopes; stale proof fails closed.                                                                               | Adapter policy applies Better Auth factor primitives uniformly instead of relying on the framework's sign-in-only 2FA redirect behavior.                                                                                                             |
| D-04 approved factors                        | PASS    | `D-04` accepts TOTP, passkey, and one-use recovery code while rejecting SMS and email as factors.                                                                                                                                                                  | Better Auth TOTP/backup-code endpoints and passkey endpoints; closed factor union in the port.                                                                                                                                                       |
| D-05 reviewed total-factor recovery          | PASS    | `D-05` admits verified-email and recovery-code routes but requires security review when all factors are lost.                                                                                                                                                      | Product recovery policy remains outside provider defaults.                                                                                                                                                                                           |
| D-06 recovery hold and contest               | PASS    | `D-06` proves a 24-hour critical-action hold, trusted-session notice, contestability, and hold enforcement.                                                                                                                                                        | Product recovery policy behind the port.                                                                                                                                                                                                             |
| D-07 independently revocable sessions        | PASS    | `D-07` lists web and desktop sessions, revokes only the selected desktop session, and preserves the web session.                                                                                                                                                   | Better Auth `listSessions` and `revokeSession` surfaces plus redacted port projection.                                                                                                                                                               |
| D-08 separated administrative roles          | PASS    | `D-08` proves Support, Operations, Security, and Audit scopes separately and rejects `super-admin`.                                                                                                                                                                | Product authorization policy; Better Auth session/factor evidence only.                                                                                                                                                                              |
| D-09 audited non-production role assumption  | PASS    | `D-09` proves one active role projection at a time and emits a distinct redacted audit receipt for each assumption.                                                                                                                                                | Product authorization and audit policy behind the port.                                                                                                                                                                                              |
| D-10 Windows system-browser PKCE             | PASS    | `D-10` binds an actual ephemeral `127.0.0.1` listener, emits an external-browser authorization URL with random state and S256 challenge, receives only code/state/issuer, closes after one callback, rejects the second callback, and rejects replayed completion. | Better Auth OAuth provider exposes `/oauth2/token`, S256 PKCE, public native clients, revocation, and a token body that accepts authorization code + verifier without `client_secret`; the API-owned port completion performs the exchange boundary. |

## Exact runtime capability probe

The spike-only package `tooling/identity-adapter-spike` owns the only three candidate dependencies:

- `better-auth@1.6.25`
- `@better-auth/passkey@1.6.25`
- `@better-auth/oauth-provider@1.6.25`

The committed lockfile preserves the inherited 43-line importer synchronization for `apps/api` and the three control-plane packages created by earlier Phase 04 work, then adds only the identity-spike importer and the exact transitive resolution of these three approved Better Auth identities. No inherited importer entry was discarded or rewritten.

`runtime-evidence.mjs` loads those exact installed packages, instantiates `betterAuth` with email verification, Google, Discord, `twoFactor`, `passkey`, `jwt`, and `oauthProvider`, then emits a bounded JSON record. The adapter refuses all operations with `ADAPTER_UNAVAILABLE` unless that record proves:

- Exact package versions and the exact plugin set.
- `signInEmail`, `signInSocial`, `verifyEmail`, TOTP, backup-code, passkey, list-session, revoke-session, OAuth authorize/token/revoke APIs.
- Native public-client configuration with `token_endpoint_auth_method=none`, mandatory PKCE, and S256.
- `/oauth2/token` is POST and its documented request schema accepts `authorization_code`, `client_id`, `code`, `code_verifier`, and exact loopback `redirect_uri` without `client_secret`.

No Better Auth user, session, plugin, endpoint, or provider object crosses `IdentityProviderPort`. The port returns only closed Liiiraa Boost values and redacted failure codes. Production control-plane package manifests contain no Better Auth dependency; all framework packages remain isolated in the tooling runtime.

## Adversarial evidence

The focused suite also proves generic recovery responses for known and unknown addresses, exact issuer and redirect validation, state mismatch rejection, one-shot authorization challenge replay rejection, stale step-up rejection, recovery-code reuse rejection, and bounded rate-abuse denial.

## Verdict boundary

Every D-01 through D-10 row is executable and green, so the automated candidate verdict is PASS with no untested method-wide MFA or native-client caveat. The user recorded `pass` at Task 04-05-02, approving production adoption only for the exact candidate, adapter boundary, executable behaviors, and conditions described in this evidence file. Any later credential, provider-account, commercial, upgrade, substitution, or previously untested decision requires its own evidence and authority; this checkpoint does not grant it.

## Human checkpoint record

- **Task:** 04-05-02 — Accept PASS or stop for replacement identity planning
- **Response:** `pass`
- **Recorded verdict:** PASS
- **Scope:** Better Auth 1.6.25 behind `IdentityProviderPort`, limited to the executable D-01 through D-10 evidence and conditions in this document.
- **Explicit exclusions:** credentials, provider accounts, commercial terms, future upgrades, substitutions, and untested behaviors.
- **Replacement artifact:** Not created because every locked row passed and the human verdict is PASS.
