# Phase 2 Windows Signing Decision

**Decision:** APPROVED — free, local, development-only signing  
**Decision date:** 2026-07-27  
**Scope:** Phase 2 — Complete Desktop Experience  
**Production signing gate:** Phase 10 — Distribution and Release Readiness

## Decision

Phase 2 must remain free. Local packaged testing may use a self-signed
Authenticode development certificate created through PowerShell and Windows
CNG. This certificate is only a local integrity aid for the maintainer's
development machine. It is not a publicly trusted release identity.

No paid signing provider, paid certificate, paid HSM, paid timestamp service,
or paid CI resource is required or authorized by this decision.

## Development certificate contract

| Field | Required value |
|---|---|
| Purpose | Local Authenticode development signing only |
| Key technology | Windows CNG |
| Certificate type | Self-signed code-signing certificate |
| Extended Key Usage | Code Signing (`1.3.6.1.5.5.7.3.3`) |
| Digest | SHA-256 |
| Certificate store | `Cert:\CurrentUser\My` |
| Private-key export | Disabled; the private key must be non-exportable |
| Private-key custody | Maintainer's Windows CurrentUser profile only |
| Certificate creation owner | Plan 02-33 |
| Thumbprint and store-path evidence | Generated and recorded only during Plan 02-33 execution |
| Timestamping | `not-applicable` for this self-signed development artifact |
| Cost | Zero |

Plan 02-33 may record the generated certificate's non-secret thumbprint, store
path, provider, EKU, digest, and access result. It must not place a private key,
PFX, password, PIN, token, recovery secret, or other credential in git,
planning artifacts, logs, CI, or test fixtures.

Timestamping remains `not-applicable` unless execution independently verifies
an official, free, Authenticode-compatible timestamp authority. A timestamp
service, timestamp receipt, or timestamp trust claim must never be assumed or
fabricated.

## CI boundary

CI has no access to the development certificate's private key. CI may produce
unsigned development builds for verification, but those artifacts:

- must not be staged, published, promoted, or distributed;
- must not be labeled signed, trusted, production-ready, release-ready, or
  suitable for public installation;
- must not be used as evidence that UX-01 public distribution acceptance has
  passed.

There is no PFX transfer, secret injection, remote signing session, cloud HSM,
or CI signing identity in Phase 2.

## Trust classification

```text
publicTrust=false
smartScreenReputation=false
productionReady=false
distributionAllowed=false
```

Windows may display an unknown-publisher or trust warning for locally signed
development artifacts. That behavior is expected and must not be hidden or
described as a successful production trust result.

## Release deferral

Commercial, publicly trusted Windows code signing is deferred to Phase 10.
Before any public release, distribution, staging promotion, or release-ready
claim, Phase 10 must select and verify the trusted signing provider,
certificate/profile identifier, protected key-custody model, timestamp
service, CI authorization boundary, and rotation/revocation ownership.

This Phase 2 decision does not approve a provider and does not waive any
production signing, SmartScreen, installer, update, or clean-machine
acceptance gate.
