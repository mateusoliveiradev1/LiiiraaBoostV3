---
status: resolved
trigger: 'Invited registration accepted an edited email, returned repeated 401 responses and one 500 response, while the browser reported an inline-style CSP violation. The invitation token was exposed in the report and must be replaced.'
created: 2026-08-09T00:00:00-03:00
updated: 2026-08-09T06:45:00-03:00
---

## Symptoms

- expected: An invited recipient creates an account with the exact invited identity, one controlled request, a persistent session, and no CSP violation.
- actual: The recognized invitation allowed the email to be changed to a plus-address variant, the authority returned multiple 401 responses and one 500 response, and the browser blocked an inline style under the nonce-only CSP.
- errors: `POST /v1/identity/sign-up` returned 401 and 500; inline style blocked by `style-src 'self'` plus a request nonce.
- reproduction: Open a protected registration link, change the invited email to a different address, complete the form, and submit. The raw token from this reproduction is now compromised and must not be reused.

## Current Focus

- hypothesis: Confirmed. The existing owner identity caused PostgreSQL's unique identity constraint to escape as 500, while the edited plus-address correctly failed the email-bound invitation check. React Aria's visually hidden checkbox wrapper emitted the exact inline style blocked by CSP.
- test: Focused account, API, identity-adapter, invitation-recovery, and design-system regressions plus ESLint, affected TypeScript checks, and a browser hash match for the blocked style.
- expecting: Duplicate signup is rejected without consuming the invitation, authority exceptions are a controlled 503, the replacement link locks the exact plus-address recipient, repeated submission is guarded, and the checkbox emits no inline style.
- next_action: None. The replacement invitation created the account and the owner confirmed successful login.

## Evidence

- timestamp: 2026-08-09T00:00:00-03:00
  checked: User-provided registration screenshot and browser console.
  found: The form email differs from the invited owner email by a plus-address suffix; the invitation is explicitly individual and email-bound.
  implication: The 401 is expected authority protection, but the UI failed to prevent or explain the mismatch.

- timestamp: 2026-08-09T00:00:00-03:00
  checked: Security impact of the report.
  found: The invitation bearer token appeared in the report URL.
  implication: Reusing that token is unsafe; revoke exactly that active invitation and issue a new protected replacement.

- timestamp: 2026-08-09T05:07:30-03:00
  checked: Deployed registration DOM and the CSP hash from the browser console.
  found: The React Aria checkbox wrapper style hashes to exactly the browser-reported SHA-256 value.
  implication: The warning is a product defect in the shared checkbox primitive, not browser-extension noise; a class-based native checkbox preserves semantics under the strict policy.

- timestamp: 2026-08-09T05:07:30-03:00
  checked: Real identity signup and PostgreSQL invitation redemption flow.
  found: The protected owner recipient already has an identity; the signup path attempted a duplicate identity insert and the route did not catch authority exceptions.
  implication: Preflight existing identities before redemption and map unexpected authority failures to controlled temporary unavailability.

- timestamp: 2026-08-09T05:07:30-03:00
  checked: TDD verification for account, API, identity adapter, recovery, and design system.
  found: 61 focused tests pass; affected account/design-system TypeScript checks and affected ESLint pass. The broader control-plane adapter typecheck retains an unrelated pre-existing exact-optional-property error in `better-auth-spike.ts`.
  implication: The changed behavior is covered without weakening CSP or disclosing invitation secrets.

- timestamp: 2026-08-09T05:10:00-03:00
  checked: Protected recovery run 31302825077 at exact revision 9837d11.
  found: The exact exposed token/recipient match succeeded, but a separate active invitation already exists for the plus-address replacement, so the created-count gate rejected and rolled the transaction back.
  implication: Supersede at most one active replacement-recipient invitation inside the same transaction before issuing the owner-visible replacement; abort if more than one exists.

- timestamp: 2026-08-09T05:25:00-03:00
  checked: Protected recovery run 31302923313 and local decrypted output.
  found: The exact exposed invitation and at most one stale owner-test invitation were superseded; exactly one replacement passed origin, recipient-digest, fragment, and token-shape validation. The remote encrypted artifact was deleted after local validation.
  implication: The compromised bearer is no longer usable and the only owner-test replacement remains local and protected.

- timestamp: 2026-08-09T05:25:00-03:00
  checked: API promotion run 31303054707, surface promotion run 31303291728, direct deployment endpoints, and browser DOM/console on the replacement URL.
  found: API, Public, Account, and Admin all report exact revision 943445ecf2d635e0bc9eea3c7e4de934dc7c2e15; fail-closed probes passed; the invited email is read-only, the checkbox is a native class-styled input, and the browser console is empty.
  implication: Automated and visual regression checks pass in exact staging; only the owner's real submission and persistence observation remain.

- timestamp: 2026-08-09T06:45:00-03:00
  checked: Owner execution of the replacement invitation and subsequent desktop authentication.
  found: Account creation and login completed successfully without the prior CSP, 401-loop, or 500 behavior.
  implication: The invited-signup defect is resolved in real authority.

## Resolution

- root_cause: Existing owner identity was invited for signup, duplicate persistence escaped as HTTP 500, the UI allowed a different plus-address that the authority correctly rejected, and the React Aria checkbox emitted a CSP-blocked inline visually-hidden style.
- fix: Reject duplicate signup before redemption, catch unexpected signup authority failures as 503, distinguish invitation rejection in the client, lock recipient-bearing replacement links, guard concurrent submission, replace the checkbox with a class-styled native semantic input, and add digest-bound one-invitation recovery.
- verification: Local focused tests, TypeScript checks, ESLint, formatting, exact staging promotion, protected replacement recovery, browser UAT, and owner-confirmed account creation/login pass.
- files_changed:
  - apps/account/src/account-auth.ts
  - apps/account/src/features/account-auth.tsx
  - apps/api/src/modules/identity/real-routes.ts
  - apps/api/src/staging/provision-invitations.ts
  - packages/control-plane-adapters/src/postgres/real-identity.ts
  - packages/design-system/src/primitives.tsx
  - packages/design-tokens/src/tokens.css
