# Phase 4 npm Dependency Legitimacy Approval

## Decision record

- **Evidence reviewed:** 2026-08-04
- **Human response:** `aprovado` (approved)
- **Verdict:** APPROVED for the 11 exact npm identities and versions below
- **Approval scope:** Supply-chain package identity and version legitimacy only
- **Install action:** None performed by Plan 04-01

The human approval applies only to the exact names and versions in this record. It does not approve package behavior, credentials, provider accounts, commercial terms, production adoption, or substitutions and upgrades. Better Auth remains a conditional candidate until the security and native OAuth 2.1/PKCE spike in Plan 04-05 passes.

## Exact approved identities

| Exact identity | Exact registry evidence | Source repository | License | Consumer install hooks | Published integrity and provenance evidence | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `fastify@5.10.0` | [npm metadata](https://registry.npmjs.org/fastify/5.10.0) | [fastify/fastify](https://github.com/fastify/fastify) | MIT | None (`preinstall`, `install`, and `postinstall` absent) | SHA-512 integrity and npm registry signature present; no registry SLSA attestation advertised | APPROVED |
| `@fastify/cors@11.3.0` | [npm metadata](https://registry.npmjs.org/%40fastify%2Fcors/11.3.0) | [fastify/fastify-cors](https://github.com/fastify/fastify-cors) | MIT | None (`preinstall`, `install`, and `postinstall` absent) | SHA-512 integrity and npm registry signature present; no registry SLSA attestation advertised | APPROVED |
| `@fastify/helmet@13.1.0` | [npm metadata](https://registry.npmjs.org/%40fastify%2Fhelmet/13.1.0) | [fastify/fastify-helmet](https://github.com/fastify/fastify-helmet) | MIT | None (`preinstall`, `install`, and `postinstall` absent) | SHA-512 integrity and npm registry signature present; no registry SLSA attestation advertised | APPROVED |
| `kysely@0.29.4` | [npm metadata](https://registry.npmjs.org/kysely/0.29.4) | [kysely-org/kysely](https://github.com/kysely-org/kysely) | MIT | None (`preinstall`, `install`, and `postinstall` absent) | SHA-512 integrity, npm registry signature, and SLSA provenance attestation present | APPROVED |
| `testcontainers@12.0.4` | [npm metadata](https://registry.npmjs.org/testcontainers/12.0.4) | [testcontainers/testcontainers-node](https://github.com/testcontainers/testcontainers-node) | MIT | None (`preinstall`, `install`, and `postinstall` absent) | SHA-512 integrity and npm registry signature present; no registry SLSA attestation advertised | APPROVED |
| `better-auth@1.6.25` | [npm metadata](https://registry.npmjs.org/better-auth/1.6.25) | [better-auth/better-auth, packages/better-auth](https://github.com/better-auth/better-auth/tree/v1.6.25/packages/better-auth) | MIT | None (`preinstall`, `install`, and `postinstall` absent) | SHA-512 integrity, npm registry signature, and SLSA provenance attestation present | APPROVED |
| `@better-auth/passkey@1.6.25` | [npm metadata](https://registry.npmjs.org/%40better-auth%2Fpasskey/1.6.25) | [better-auth/better-auth, packages/passkey](https://github.com/better-auth/better-auth/tree/v1.6.25/packages/passkey) | MIT | None (`preinstall`, `install`, and `postinstall` absent) | SHA-512 integrity, npm registry signature, and SLSA provenance attestation present | APPROVED |
| `@better-auth/oauth-provider@1.6.25` | [npm metadata](https://registry.npmjs.org/%40better-auth%2Foauth-provider/1.6.25) | [better-auth/better-auth, packages/oauth-provider](https://github.com/better-auth/better-auth/tree/v1.6.25/packages/oauth-provider) | MIT | None (`preinstall`, `install`, and `postinstall` absent) | SHA-512 integrity, npm registry signature, and SLSA provenance attestation present | APPROVED |
| `stripe@22.4.0` | [npm metadata](https://registry.npmjs.org/stripe/22.4.0) | [stripe/stripe-node](https://github.com/stripe/stripe-node) | MIT | None (`preinstall`, `install`, and `postinstall` absent) | SHA-512 integrity, npm registry signatures, and SLSA provenance attestation present | APPROVED |
| `@aws-sdk/client-s3@3.1102.0` | [npm metadata](https://registry.npmjs.org/%40aws-sdk%2Fclient-s3/3.1102.0) | [aws/aws-sdk-js-v3, clients/client-s3](https://github.com/aws/aws-sdk-js-v3/tree/v3.1102.0/clients/client-s3) | Apache-2.0 | None (`preinstall`, `install`, and `postinstall` absent) | SHA-512 integrity and npm registry signatures present; no registry SLSA attestation advertised | APPROVED |
| `@aws-sdk/client-sesv2@3.1102.0` | [npm metadata](https://registry.npmjs.org/%40aws-sdk%2Fclient-sesv2/3.1102.0) | [aws/aws-sdk-js-v3, clients/client-sesv2](https://github.com/aws/aws-sdk-js-v3/tree/v3.1102.0/clients/client-sesv2) | Apache-2.0 | None (`preinstall`, `install`, and `postinstall` absent) | SHA-512 integrity and npm registry signatures present; no registry SLSA attestation advertised | APPROVED |

## Evidence and boundary notes

- The Phase 4 research legitimacy seam classified these 11 recent official releases as `SUS: too-new`, which required this explicit human decision before installation.
- Exact npm metadata was rechecked on 2026-08-04. Every requested identity resolved at the exact version and matched the source repository shown above.
- All 11 packages publish a SHA-512 integrity value and at least one npm registry signature. Registry SLSA provenance attestations were advertised for Kysely, the three Better Auth packages, and Stripe.
- None declares the consumer-executed `preinstall`, `install`, or `postinstall` lifecycle hooks. Packaging, build, test, and publication scripts do not run during a normal registry consumer install and remain subject to allowlist drift checks when the pins are admitted later.
- This record authorizes Plan 04-04 to admit only these exact identities. Any different name or version requires a new registry/repository review and human verdict.
- `pg@8.22.0` and `@hey-api/openapi-ts@0.99.0` were classified `OK` by the research legitimacy seam and are not part of this blocking approval.
- No dependency manifest, lockfile, package cache, provider account, credential, or external service was changed by this plan.

## Human sign-off

The user responded `aprovado`, explicitly approving all 11 exact identities listed above. The response is recorded as a package-legitimacy verdict only; it does not waive Plan 04-05 or any later security, behavior, integration, commercial, or production gate.
