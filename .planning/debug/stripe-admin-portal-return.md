---
status: resolved
trigger: "nao da pra assinar pq ja sou premium e tals mais apertando na logo ali no checkout da esse erro ai"
created: 2026-08-06T17:02:00-03:00
updated: 2026-08-06T17:15:09-03:00
---

# Stripe admin portal return

## Symptoms

- expected: The administrative lifetime-Premium account must explain that it has no recurring charge, and every Stripe Portal brand/back link must return to an existing localized account route.
- actual: The account is Premium but opens an empty Stripe Portal with no payment method or invoices; clicking the Liiiraa Boost logo navigates to `/pt-BR/plan`, which returns a Next.js 404.
- errors: `404 This page could not be found` at `https://liiiraa-boost-account-staging.vercel.app/pt-BR/plan`.
- timeline: First observed during the initial published Stripe UAT on 2026-08-06.
- reproduction: Sign in as the administrator, open Plano e pagamentos, click Gerenciar cobranca no Stripe, then click the Liiiraa Boost logo in the Stripe Portal.

## Current Focus

- hypothesis: Confirmed. Checkout/Portal return URLs used the obsolete `/plan` path, and billing UI treated every active Premium entitlement as a Stripe-backed subscription.
- test: Regression coverage for canonical localized return URLs, the legacy redirect, permanent-versus-Stripe billing classification, and the administrative Premium presentation; focused/full tests plus the Account production build.
- expecting: Administrative Premium remains active without a billing Portal or fabricated charge history, while both new Stripe sessions and legacy `/plan` links resolve to the canonical subscription area.
- next_action: Publish the verified fix and execute staging UAT after Vercel and Render finish deploying.
- reasoning_checkpoint: Root cause is proven in source and the corrected account production build accepts the localized redirect configuration.
- tdd_checkpoint: GREEN

## Evidence

- timestamp: 2026-08-06T17:02:00-03:00
  observation: Screenshots show an empty Stripe Portal for the administrator and a 404 at `/pt-BR/plan` after clicking the brand logo.
- timestamp: 2026-08-06T17:06:00-03:00
  observation: RED coverage failed on the legacy route, canonical Checkout/Portal return URLs, and permanent Premium classification before the implementation change.
- timestamp: 2026-08-06T17:15:09-03:00
  observation: API 181/181, Account 99/99, and control-plane adapters 46/46 (with 4 intentional skips) pass; focused regression suites pass 22/22; Account typecheck and production build pass; changed application files pass ESLint and all changed files pass Prettier.
  implication: The fix is buildable and preserves Stripe authority while removing the false billing affordance from permanent administrative Premium.

## Eliminated

- Stripe itself was not failing to create a Portal session; it correctly opened a customer with no billing history because the administrator has no Stripe-backed subscription.
- The 404 was not caused by locale middleware; `/pt-BR/plan` was an obsolete application path, while `/pt-BR/account/subscription` is the canonical route.
- The React changes introduce no new effect, event-listener, request waterfall, or client bundle dependency; billing kind is a synchronous projection-derived value.

## Resolution

- root_cause: Checkout and Portal sessions emitted the removed localized `/plan` route, and account UI inferred Stripe billing from only `plan=premium` plus `state=active`. The PostgreSQL administrative entitlement is intentionally permanent and has no paid period, invoices, or Stripe subscription to manage.
- fix: Centralized the canonical `/{locale}/account/subscription` URL for Checkout and Portal, added a permanent redirect from the legacy localized `/plan` route, classified billing as free/permanent/Stripe from authoritative subscription projection data, and removed the Stripe Portal affordance and paid-subscription claims for permanent administrative Premium.
- verification: Focused regression tests 22/22; API 181/181; Account 99/99; adapters 46/46 with 4 intentional skips; Account TypeScript check and Next.js production build pass; changed application files pass ESLint; all changed files pass Prettier.
- files_changed: Account redirect, commerce classifier, subscription/account presentation; API commerce URL construction and staging Portal return; Stripe provider fixtures and regression tests.
