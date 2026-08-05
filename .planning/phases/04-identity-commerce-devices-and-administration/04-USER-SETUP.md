# Phase 04 External Setup

Plan 04-23 defines the staging surfaces and restricted desktop channel without provisioning or publishing them. Complete these steps before running the hosted workflow.

## Vercel staging projects

Create three separate Vercel projects with these repository roots:

| Surface | Project root   | GitHub environment | Required values                                                                         |
| ------- | -------------- | ------------------ | --------------------------------------------------------------------------------------- |
| Public  | `apps/web`     | `staging-public`   | `PUBLIC_STAGING_ORIGIN`, `VERCEL_PUBLIC_PROJECT_ID`, `VERCEL_TEAM_ID`, `VERCEL_TOKEN`   |
| Account | `apps/account` | `staging-account`  | `ACCOUNT_STAGING_ORIGIN`, `VERCEL_ACCOUNT_PROJECT_ID`, `VERCEL_TEAM_ID`, `VERCEL_TOKEN` |
| Admin   | `apps/admin`   | `staging-admin`    | `ADMIN_STAGING_ORIGIN`, `VERCEL_ADMIN_PROJECT_ID`, `VERCEL_TEAM_ID`, `VERCEL_TOKEN`     |

- Keep every origin HTTPS, origin-only, and distinct from the other two surfaces.
- Connect all three projects only to `https://liiiraa-api-staging.onrender.com` through the checked-in same-origin `/v1` proxy.
- Do not configure production provider, database, cookie-domain, or public indexing values.
- Configure the `staging-surfaces` GitHub environment for the deployed isolation smoke.

## Google and Discord sandbox identity

- Create separate test/private OAuth applications and store `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DISCORD_CLIENT_ID`, and `DISCORD_CLIENT_SECRET` only in the owning protected staging environment.
- Register the exact account staging callback emitted by the staging identity configuration; do not use wildcard callbacks or a production callback identity.
- Permit the desktop loopback callback only through the native flow's exact `http://127.0.0.1:<ephemeral-port>/oauth/callback` redirect contract. Keep the provider application in test/private mode and allow only invited testers.
- Never place provider secrets in Vercel client-visible variables, the desktop renderer, the Tauri overlay, or repository files.

## Restricted desktop environment

- Create a protected GitHub environment named `desktop-internal` and restrict approvals to invited internal builds.
- Do not publish `internal-023001` to Stable, Beta, Experimental, a public download page, or a trusted installer feed.
- Preserve the checked-in `internal-023001` build identity and `internal-023000` rollback target. Any new build requires a new monotonic manifest identity and change notes.

## Broader closed-beta promotion gate

Before selecting `broader-closed-beta`, configure the protected `broader-beta-promotion` environment with `OWNED_PUBLIC_ORIGIN`, `OWNED_ACCOUNT_ORIGIN`, `OWNED_ADMIN_ORIGIN`, `OWNED_CALLBACK_ORIGINS`, and `OWNED_EMAIL_IDENTITY`. Provider preview domains and example identities are rejected by the workflow.

## Verification

Run the `Phase 4 isolated staging surfaces` workflow only after the protected environments are configured. A successful run must complete contract verification, three isolated deployments, live origin/session/consent probes, and restricted Internal manifest admission. Hosted execution, OAuth configuration, and publication were intentionally not performed by Plan 04-23.
