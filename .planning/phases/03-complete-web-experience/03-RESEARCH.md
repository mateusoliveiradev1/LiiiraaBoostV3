# Phase 3: Complete Web Experience - Research

**Researched:** 2026-07-30  
**Domain:** Independently deployable Next.js web surfaces, repository-owned content, deterministic authority previews, release integrity UX, accessibility, and publication gates  
**Confidence:** MEDIUM

<user_constraints>

## User Constraints (from CONTEXT.md)

The following content is copied verbatim from `03-CONTEXT.md`.

### Locked Decisions

### Complete web contract and truth boundary

- **D-01:** The complete ecosystem is in scope: public marketing, documentation, compatibility, plans, releases, download, account, support previews, privacy surfaces, and the isolated administrative experience.
- **D-02:** Every planned route, menu, breadcrumb, link, filter, form, state transition, confirmation, cancellation, and recovery path must work. Dead controls, `#` links, empty pages, generic “coming soon” destinations, and unimplemented navigation are forbidden.
- **D-03:** Capabilities that depend on Phase 4 still receive complete, typed, deterministic journeys. They terminate at an explicit authority boundary and produce a receipt stating that no remote state changed.
- **D-04:** Simulated data and scenarios are persistently and contextually labeled. The UI may demonstrate complete workflows but must never fabricate an authenticated session, payment, device change, support upload, diagnostic access, administrative mutation, or customer result.
- **D-05:** The full scenario catalog is available only in development, Storybook, visual tests, and E2E. A published preview exposes a coherent scenario without a public scenario switcher.
- **D-06:** PT-BR and English ship with complete parity across routes, copy, metadata, errors, screenshots, legal content, documentation, releases, and critical notices.
- **D-07:** Public, account, and admin use coordinated but distinct shells and security boundaries. Public/documentation/download share a shell, account uses an authenticated-product shell, and admin remains isolated.
- **D-08:** The exact route inventory must become a canonical manifest that validates navigation, sitemap, redirects, contextual desktop links, test coverage, and route ownership from one authority.

### Public narrative, conversion, and visual direction

- **D-09:** The public Home follows the narrative “Prepare, prove, restore” and uses the approved primary promise: **“Prepare seu PC. Prove o resultado. Restaure com controle.”**
- **D-10:** The Home is a long-form editorial sales experience divided into intentional chapters, not a short SaaS hero followed by repetitive card grids.
- **D-11:** The primary journey ends in “Verificar compatibilidade” while distribution is gated. It becomes “Verificar compatibilidade e baixar” only when a public artifact is approved.
- **D-12:** Plans use a transparent capability comparison. No artificial discounts, countdowns, pressure, hidden renewal terms, or safety paywalls are allowed.
- **D-13:** Capabilities and limitations use an explicit support matrix with states such as available, demonstrative preview, under validation, planned, unsupported, and unavailable.
- **D-14:** Every material claim carries contextual evidence: source, provenance, scope, applicable version, validation state, and what remains unproven.
- **D-15:** Credibility comes from release notes, methodology, product decisions, evidence, compatibility, and recovery—not fabricated testimonials, customer gains, issue counts, or urgency.
- **D-16:** Product visuals use real screenshots captured from the executable desktop application in deterministic scenarios. Generated mockups and visual probes are direction references only and must never be published as the real product.
- **D-17:** Screenshot composition may crop or frame the real product, but must not alter values, states, copy, or provenance inside the captured application.
- **D-18:** The approved Impeccable direction is a hybrid of **Command Runway** and **Evidence Stage**: the commercial impact, asymmetry, and strong hierarchy of the first combined with the evidence discipline and product credibility of the second.
- **D-19:** The hero evokes a serious PC ready for a competitive session: near-black, graphite, controlled cobalt focus, calm power, and the real product as the dominant proof. Remove generic headset/city imagery, RGB, neon, glassmorphism, gradient text, decorative grids, repeated cards, oversized radii, and theatrical gamer cliché.
- **D-20:** The Home uses the brand register and may be more cinematic; account and admin use the product register with denser, familiar, task-first interfaces. All surfaces preserve the same tokens, status language, accessibility, and provenance rules.
- **D-21:** Impeccable is mandatory for web shaping, visual hierarchy, UX copy, responsive behavior, accessibility review, hardening, and final polish. The website must not ship as a generic Next.js or component-library template.

### Information architecture and discovery

- **D-22:** Public navigation uses a small set of intent-driven pillars: Product, Evidence, Compatibility, Plans, Documentation, and Download/Releases.
- **D-23:** Public search spans product content, capabilities, compatibility, plans, documentation, releases, and support. Results respect locale, version, availability, and indexing policy.
- **D-24:** Transitions between public, documentation, download, and account preserve safe context such as locale, version, channel, requested destination, and return path. Origin and security-boundary changes remain explicit.
- **D-25:** 404, 403, 410, and 500 are distinct authored states with safe recovery, preserved locale, redacted diagnostics, and relevant destinations. Automatic redirection that hides the failure is forbidden.
- **D-26:** During partial outages, public content and documentation remain available where safe. Account and admin identify the affected capability, preserve valid local work, and block ambiguous actions.

### Versioned documentation

- **D-27:** Documentation is organized by user task and intent—getting started, preparing, measuring, optimizing, restoring, and troubleshooting—with technical references nested inside the relevant domain.
- **D-28:** Each document uses progressive disclosure: concise purpose and next action first, followed by evidence, risks, compatibility, recovery, and deeper technical detail.
- **D-29:** Documentation is bound to application version and release channel. Contextual desktop links open the exact canonical section in the correct locale and compatible version.
- **D-30:** Historical documentation remains accessible with explicit stale/unsupported notices and canonical treatment.
- **D-31:** Documentation search covers natural-language terms, technical identifiers, and error codes, with filters for version, platform, risk, and domain.
- **D-32:** Every document displays applicable version, last review, accountable owner, validation state, and evidence or release references.
- **D-33:** Troubleshooting begins from an observed state or error code, confirms evidence, offers safe steps, and ends in recovery or escalation.
- **D-34:** Documentation explains technical concepts and safe verification but does not distribute generic remote mutation scripts, registry recipes, or PowerShell commands as an execution channel.

### Download, integrity, and releases

- **D-35:** Before public-trust signing and distribution approval exist, the complete download page remains available but the public artifact is blocked. Development self-signed installers remain outside the public flow.
- **D-36:** Stable is the default channel, Beta requires explicit opt-in, and Experimental is separated with its risk, audience, support, and update policy.
- **D-37:** A release provides a human-readable page and a signed machine-readable manifest covering channel, version, artifacts, hashes, size, compatibility, provenance, and release state.
- **D-38:** Users receive independent verification guidance for Authenticode signature, publisher, SHA-256, size, version, compatibility, and the canonical release manifest.
- **D-39:** Signature, hash, publisher, artifact, or manifest disagreement blocks the flow completely. There is no “continue anyway” path.
- **D-40:** Windows 10 and Windows 11 share one compatibility and installer flow because the application behavior is equivalent. Show a difference only when lifecycle, architecture, or verified compatibility evidence genuinely differs.
- **D-41:** Stable downloads do not require an account. Authentication begins only when a capability genuinely depends on account or entitlement authority.
- **D-42:** Only controlled official origins may present an artifact as official. Third-party mirrors and unrelated release hosts never receive the product’s official trust mark.
- **D-43:** Historical releases retain notes, hashes, status, and evidence. Old binaries remain downloadable only while supported and safe; the UI does not encourage downgrade.
- **D-44:** Release notes prioritize changes, risks, corrections, compatibility, migration needs, and recovery. They are not promotional changelogs.
- **D-45:** After download, the user sees signature verification, safe installation steps, expected warnings, cancellation guidance, and support paths.
- **D-46:** Download analytics are minimal, aggregate, and purpose-bound. They must not identify the PC or silently bind a public download to an account.

### Account and support preview

- **D-47:** Account navigation is organized by responsibility: Overview, Profile, Security, Subscription and invoices, Device, Downloads, Privacy, and Support.
- **D-48:** Every account surface is complete in deterministic preview, including forms, validation, loading, empty, offline, expired session, stale data, failure, consent, confirmation, cancellation, and receipt states.
- **D-49:** Preview provenance is persistent globally and repeated at sensitive actions. The interface must not look authoritative until the user reaches the final button.
- **D-50:** The pre-Phase-4 sign-in journey validates input, presents future email/social/passkey choices, explains security, and reaches the browser/session boundary without inventing a session.
- **D-51:** Account security includes complete stateful previews for verified email, passkeys, MFA, sessions, recovery, and security alerts.
- **D-52:** Remote account actions such as subscription changes, device revocation, privacy requests, or support submission allow complete review and confirmation, then end with a no-change receipt naming the future authority.
- **D-53:** The account includes a complete privacy center for consent review, export, correction, and deletion requests, with honest Phase 4 boundaries.

### Isolated administration

- **D-54:** Admin uses a separate origin, deployment, security policy, cookie boundary, CSP, access policy, and operational shell. It is not linked from ordinary public or account navigation.
- **D-55:** Development and test scenarios represent role-specific access for support, operations, security, and audit rather than one omnipotent administrator.
- **D-56:** Admin navigation and role states are complete even though authoritative permissions arrive in Phase 4.
- **D-57:** User-provided diagnostics remain blocked without explicit, scoped, time-limited consent. The preview shows purpose, permitted fields, expiration, actor, and immutable audit event.
- **D-58:** Administrative history is an immutable, correlatable timeline including actor, role, action, redacted target, reason, consent, timestamp, result, and correlation.
- **D-59:** Critical admin actions require purpose, impact review, simulated reauthentication, and proportional confirmation. They end with a no-change receipt until real authority exists.
- **D-60:** Admin mobile permits safe review, alert triage, case reading, audit inspection, and support responses. High-risk administration requires a suitable desktop-class viewport.

### Responsive and accessible behavior

- **D-61:** The public mobile shell uses a compact header and full-screen menu preserving all pillars, search, locale, and an unobtrusive primary CTA.
- **D-62:** Documentation preserves its full depth on mobile through a collapsible index, version controls, search, readable examples, and authored alerts.
- **D-63:** Dense compatibility/account/admin tables prioritize essential columns and expose complete row detail progressively. They must not become generic card walls or require horizontal scrolling for ordinary use.
- **D-64:** Mobile Home places copy and CTA first, followed by responsive crops of the real desktop screenshot; the full real image remains available.
- **D-65:** Content, navigation, and actions load before heavy imagery. No essential understanding or action depends on video, animation, or a high-bandwidth asset.
- **D-66:** The entire web ecosystem supports reflow through 400% browser zoom and 200% text scaling without clipping, overlap, or two-dimensional scrolling except where a technical data surface makes one axis unavoidable.
- **D-67:** No information or action depends exclusively on hover. Tooltips, menus, evidence, and progressive detail work through keyboard focus, explicit activation, and touch.
- **D-68:** Reduced motion, forced colors, visible focus, semantic status labels, keyboard operation, screen-reader structure, and WCAG 2.2 AA contrast are release-blocking across public, account, and admin surfaces.

### Privacy, transparency, and commercial trust

- **D-69:** Do not show a cookie banner when the site uses only strictly necessary storage. Any optional measurement requires prior, granular, reversible consent.
- **D-70:** Privacy, Terms, and Security are clear, versioned documents with a plain-language summary, full text, effective date, history, and accountable contact.
- **D-71:** Every data collection point explains purpose, required fields, retention, sharing, revocation, and the path to the full policy.
- **D-72:** Provide a public responsible-disclosure policy with a secure reporting channel, scope, prohibited content, expected response, and no invented bounty promise.
- **D-73:** Provide public operational status and incident history with affected components, user impact, updates, and resolution while excluding sensitive internal detail.
- **D-74:** Incorrect or stale public claims and compatibility entries are corrected with traceability, known impact, and history when they could have influenced user decisions.
- **D-75:** Plan pages disclose price, billing period, renewal, applicable taxes, cancellation, refund terms, device rules, and expiration effects before confirmation. Pre-Phase-4 checkout remains explicitly simulated.

### Content, release, and publication operations

- **D-76:** Public content, documentation, compatibility, policies, and releases are versioned in the repository and validated through schemas, review, localization, links, and evidence. A mutable runtime CMS is not the authority.
- **D-77:** Release publication is atomic: manifest, release notes, compatible documentation, support matrix, approved artifacts, screenshots, and channel metadata must agree before appearing.
- **D-78:** Indexing is explicit by content class. Current public content is indexable; private surfaces, previews, internal search results, and obsolete versions receive appropriate blocking or canonical handling.
- **D-79:** Home, product, documentation, and release URLs use content-specific social metadata and imagery without unproven performance claims.
- **D-80:** Publication is blocked when PT-BR or English content, metadata, imagery, warnings, or critical copy is missing or stale.
- **D-81:** Real desktop screenshots come from a deterministic capture pipeline that records version, locale, scenario, viewport, and provenance. Relevant product changes invalidate stale screenshots.
- **D-82:** Commercial copy follows an editorial contract. Material claims require evidence, scope, state, version, and bilingual review; copy remains strong without becoming sensational or deceptive.
- **D-83:** Content that passes its review date or loses supporting evidence fails closed: remove actionable claims, label it stale, preserve historical context where useful, and route to valid information.
- **D-84:** A complete release gate blocks publication on route/link drift, contract or type failure, security, privacy, accessibility, responsive, performance, SEO, localization, screenshot, evidence, visual, or E2E failure.
- **D-85:** A faulty deployment rolls back code, content, manifests, and assets as one previously approved version. External data or migrations are never reverted blindly.
- **D-86:** The cinematic Home uses progressive delivery and a strict performance budget. Copy, navigation, compatibility, and CTA never wait for imagery, animation, or decorative effects.

### the agent's Discretion

- Choose exact component boundaries, Next.js route-group layout, breakpoint values, cache behavior, state-machine decomposition, and test partitioning while preserving all locked surface, truth, security, and completeness decisions.
- Refine typography within the existing Liiiraa Boost identity and committed font licenses; retain the two-voice human/data rule and avoid reflexive AI-design font choices.
- Choose exact atmospheric treatment and motion choreography for the approved Command Runway + Evidence Stage direction, subject to reduced motion, performance, contrast, and the prohibition on fabricated product imagery.
- Choose the precise development scenario families and fixture content used to prove each web route, provided the scenario catalog is closed, deterministic, typed, and unavailable to ordinary production users.

### Deferred Ideas (OUT OF SCOPE)

- Real email/social/passkey authentication, MFA authority, session issuance, account recovery, and security-method mutation — Phase 4.
- Real billing, invoices, subscription changes, entitlement reconciliation, device binding/reset, and checkout — Phase 4.
- Real support submissions, diagnostic upload/access, consent enforcement, and administrative mutations — Phase 4.
- Publicly trusted commercial signing, SmartScreen/reputation claims, staged public distribution, and production release promotion — Phase 10.
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID                    | Description                                                                                                                | Research Support                                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WEB-01                | Visitor can understand the product, its evidence policy, supported capabilities, plans, and limitations on the public site | Static-first public application, repository-owned bilingual content, typed claim/evidence records, capability-state vocabulary, global search, and publication gates                                                    |
| WEB-02                | Visitor can read versioned technical documentation linked from relevant desktop features                                   | Version/locale/channel route identities, task-led MDX documents, canonical desktop-link contract, stale-version handling, and a route-manifest coverage gate                                                            |
| WEB-03                | User can securely download a signed installer and verify release information                                               | Complete release/integrity UX, TypeSpec release-manifest contract, verification guidance, mismatch state, and a fail-closed availability gate; actual publicly trusted distribution remains Phase 10 by locked decision |
| WEB-08                | Public, account, and administrative surfaces have separate deployment and security policies                                | Three independent Next.js applications, separate standalone artifacts/origins/CSP/robots/cookie policies, fixture-classified account/admin previews, and artifact-level isolation tests                                 |
| </phase_requirements> |

## Summary

Phase 3 should be planned as three independently built Next.js App Router applications—`apps/web`, `apps/account`, and `apps/admin`—supported by one typed route/content authority, one fixture-only preview adapter, and one cross-surface evidence toolchain. The repository currently contains no web, account, or admin applications, and `architecture/module-boundaries.json` has no declared web modules, so the first implementation wave must establish and test those boundaries before route work fans out. [VERIFIED: codebase grep]

The public application should be static-first: repository-owned content, versioned documentation, localized metadata, search index, sitemaps, and critical notices are generated at build time and remain cacheable. `next-intl` supports this with locale params, `generateStaticParams`, and `setRequestLocale`; locale must also be passed explicitly to metadata translation calls. [CITED: https://next-intl.dev/docs/routing/setup] [CITED: https://next-intl.dev/docs/environments/actions-metadata-route-handlers]

Account and admin are complete deterministic previews, not partial implementations of Phase 4. Each sensitive journey is a typed state machine whose terminal states are cancellation or a `NoChangeReceipt`; neither app creates auth cookies, sessions, billing state, device state, support uploads, diagnostic access, or admin mutations. Admin remains a separate origin and deployable artifact even in preview. [VERIFIED: 03-CONTEXT.md]

WEB-03 requires a deliberate scope interpretation: Phase 3 builds and proves the complete channel, release, integrity, mismatch, verification, and post-download journey, but the canonical public flow ends at `DownloadAvailabilityGate` until trusted signing and distribution are approved. A development/self-signed artifact must never be reachable from public routes, manifests, social metadata, search, or scenario data. [VERIFIED: 03-CONTEXT.md]

**Primary recommendation:** Establish the shared route/content/preview contracts and the multi-app verification harness in Wave 0, then implement public/docs/releases, account preview, and isolated admin preview as parallel vertical slices that all terminate in the same publication gate.

## Project Constraints (from AGENTS.md)

- Use current stable Next.js and React for separate public/account and administrative deployments. [VERIFIED: AGENTS.md]
- Keep the pnpm/Turborepo monorepo modular; every new module needs explicit ownership, root, public root, layer, runtime class, and dependency direction. [VERIFIED: AGENTS.md]
- Extend the language-neutral contract source and generate TypeScript/Rust transports and validators; do not duplicate critical cross-boundary DTOs. [VERIFIED: AGENTS.md]
- Reuse project design tokens and authored React Aria behavior; do not adopt shadcn/ui, dashboard templates, or a generic component-library visual language. [VERIFIED: AGENTS.md]
- Preserve fixture/production separation, explicit provenance, runtime validation, least privilege, no arbitrary remote execution, and fail-closed behavior. [VERIFIED: AGENTS.md]
- Ship PT-BR and English with parity, WCAG 2.2 AA, complete keyboard/screen-reader operation, scalable UI, forced-colors-safe status communication, and reduced motion. [VERIFIED: AGENTS.md]
- Use local tooling/free tiers and do not provision production AWS, Cloudflare, database, cache, queue, or identity infrastructure in this phase. [VERIFIED: AGENTS.md]
- Production-quality work has no exceptions to critical specification, type, test, security, accessibility, recovery, signing, or E2E gates. [VERIFIED: AGENTS.md]
- Prefix shell commands with `rtk`; file-changing work must stay inside a GSD workflow. [VERIFIED: AGENTS.md]
- No project-defined skill directories were present; the locked Phase 3 context explicitly requires the Impeccable design discipline, whose brand guidance applies to the Home and product guidance applies to account/admin. [VERIFIED: codebase grep]

## Architectural Responsibility Map

| Capability                                       | Primary Tier                            | Secondary Tier                 | Rationale                                                                                                                                                                     |
| ------------------------------------------------ | --------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public narrative, evidence, compatibility, plans | Frontend Server (static generation)     | CDN / Static                   | Truthful repository content should render without client JavaScript and remain available during downstream outages. [VERIFIED: 03-CONTEXT.md]                                 |
| Versioned documentation                          | Frontend Server (static generation)     | CDN / Static                   | Version, channel, locale, canonical metadata, and stale notices are build-time content identities. [CITED: https://nextjs.org/docs/app/getting-started/project-structure]     |
| Public search and filters                        | Browser / Client                        | Frontend Server build pipeline | Build emits a public-only typed index; browser performs fast local search and URL-backed filtering without a Phase 4 API. [VERIFIED: 03-CONTEXT.md]                           |
| Release/integrity/download journey               | Frontend Server                         | CDN / Static                   | Release records and manifest views are public content; the artifact boundary fails closed until Phase 10. [VERIFIED: 03-CONTEXT.md]                                           |
| Account preview                                  | Frontend Server shell                   | Browser / Client               | Server owns origin, headers, indexing policy, and initial shell; client state machines own deterministic review/cancel/no-change interactions. [VERIFIED: 03-CONTEXT.md]      |
| Admin preview                                    | Frontend Server shell (separate origin) | Browser / Client               | Isolation policy belongs to deployment/origin; role scenario and no-change workflows run through fixture-only ports. [VERIFIED: 03-CONTEXT.md]                                |
| Canonical route/deep-link identity               | Shared application package              | Frontend Server apps           | One typed manifest feeds navigation, breadcrumbs, sitemap, redirects, desktop links, indexing, ownership, and test enumeration. [VERIFIED: 03-CONTEXT.md]                     |
| Desktop screenshot provenance                    | Tooling / CI                            | CDN / Static                   | Only deterministic captures from the executable desktop may become public assets, and each asset needs version/locale/scenario/viewport provenance. [VERIFIED: 03-CONTEXT.md] |
| Publication and rollback evidence                | Tooling / CI                            | Frontend Server artifacts      | Code, content, manifests, and assets must be admitted and rolled back as one approved version. [VERIFIED: 03-CONTEXT.md]                                                      |

## Standard Stack

### Core

| Library                                                             | Version | Published         | Purpose                                                                  | Why Standard                                                                                                                                                                                         |
| ------------------------------------------------------------------- | ------- | ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next` [WARNING: flagged as suspicious — verify before using.]      | 16.2.12 | 2026-07-25        | Three App Router applications and standalone builds                      | Locked project stack; App Router provides nested layouts, authored error files, metadata, sitemap, robots, images, and fonts. [CITED: https://nextjs.org/docs/app/getting-started/project-structure] |
| `react` / `react-dom`                                               | 19.2.8  | existing lockfile | UI runtime                                                               | Already approved and used by desktop/design packages; keep one workspace version. [VERIFIED: codebase grep]                                                                                          |
| `next-intl` [WARNING: flagged as suspicious — verify before using.] | 4.13.4  | 2026-07-23        | PT-BR/English routing, Server Component translations, localized metadata | Official routing APIs cover a central locale definition, locale-aware navigation, static rendering, and localized sitemap alternates. [CITED: https://next-intl.dev/docs/routing/setup]              |
| `@next/mdx` [WARNING: flagged as suspicious — verify before using.] | 16.2.12 | 2026-07-25        | Repository-owned documentation and policy content                        | Official Next integration keeps long-form content in git while using App Router layouts and metadata. [CITED: https://nextjs.org/docs/app/guides/mdx]                                                |
| `minisearch`                                                        | 7.2.0   | 2025-09-16        | In-browser search over generated public records                          | Provides exact, prefix, fuzzy, boosted, and filtered search over an in-memory index; the package passed the legitimacy gate. [VERIFIED: npm registry]                                                |

### Supporting

| Library                                             | Version         | Purpose                                                            | When to Use                                                                                                                                                                                                  |
| --------------------------------------------------- | --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@liiiraa/design-tokens` / `@liiiraa/design-system` | workspace       | Shared tokens and authored accessible primitives                   | Every surface; import only public roots. [VERIFIED: codebase grep]                                                                                                                                           |
| `@tanstack/react-query`                             | 5.101.4         | Explicit async preview states                                      | Account/admin reads that simulate latency, offline, stale, cancellation, and failure; never as an authority store. [CITED: https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults] |
| `xstate` / `@xstate/react`                          | 5.32.5 / 6.1.0  | Review/confirm/cancel/receipt workflows                            | Sensitive account/admin actions and release verification paths with closed terminal states. [CITED: https://stately.ai/docs/final-states]                                                                    |
| `ajv`                                               | 8.20.0          | Runtime validation of generated JSON Schema and repository content | Route records, release manifests, evidence records, screenshot metadata, and content indexes at build/runtime boundaries. [VERIFIED: npm registry]                                                           |
| `@playwright/test` / `@axe-core/playwright`         | 1.62.0 / 4.12.1 | E2E, visual, accessibility, header, and origin tests               | Shared multi-app web evidence harness; retain approved lockfile pins rather than incidental patch upgrades. [VERIFIED: codebase grep]                                                                        |
| `@storybook/react-vite`                             | 10.5.4          | Deterministic component/state catalog                              | Shared web features and compositions that do not depend on a running Next server; route behavior stays in Playwright. [VERIFIED: codebase grep]                                                              |
| Next `Image`, `next/font/local`, Metadata APIs      | bundled         | Progressive media, self-hosted fonts, SEO artifacts                | Public screenshots, Manrope/JetBrains Mono, localized metadata, sitemap, robots, and social images. [CITED: https://nextjs.org/docs/app/getting-started/images]                                              |

### Alternatives Considered

| Instead of                              | Could Use                                      | Tradeoff                                                                                                                                                                                                                              |
| --------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three independent apps                  | Multiple root layouts in one app               | Root layouts can separate shells, but they do not create independent deployment, origin, cookie, CSP, or rollback boundaries; reject for WEB-08. [VERIFIED: 03-CONTEXT.md]                                                            |
| Static-first public routes              | Nonce-based dynamic rendering everywhere       | Next nonces force dynamic rendering, disable static optimization/ISR and default CDN caching, and are incompatible with PPR; reserve nonce CSP for account/admin. [CITED: https://nextjs.org/docs/app/guides/content-security-policy] |
| MiniSearch over a generated typed index | Phase 4 search API/PostgreSQL full-text search | Server search becomes appropriate when authoritative/private data exists; Phase 3 needs an offline, public-only, deterministic catalog. [VERIFIED: 03-CONTEXT.md]                                                                     |
| Repository MDX plus validated metadata  | Mutable runtime CMS                            | CMS authority contradicts D-76 and introduces availability, preview, and publication drift. [VERIFIED: 03-CONTEXT.md]                                                                                                                 |
| XState terminal receipts                | Ad-hoc `useState` booleans                     | Sensitive workflows require legal transitions, cancellation, failure, and a guaranteed no-change terminal result. [CITED: https://stately.ai/docs/final-states]                                                                       |

**Installation (after required human verification for SUS packages):**

```bash
# Run in each owning package after the packages exist; keep exact pins.
pnpm --filter @liiiraa/web add --save-exact next@16.2.12 react@19.2.8 react-dom@19.2.8 next-intl@4.13.4 minisearch@7.2.0
pnpm --filter @liiiraa/web add --save-dev --save-exact @next/mdx@16.2.12
pnpm --filter @liiiraa/account add --save-exact next@16.2.12 react@19.2.8 react-dom@19.2.8 next-intl@4.13.4
pnpm --filter @liiiraa/admin add --save-exact next@16.2.12 react@19.2.8 react-dom@19.2.8 next-intl@4.13.4
```

Registry checks were run from outside the workspace because the host Node is 24.16.0 and the repository correctly rejects direct `npm` commands below its 24.18.0 runtime pin. All listed versions returned from `npm view`; no listed package exposes a `postinstall` script at the checked version. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package      | Registry | Age                                     | Downloads  | Source Repo                     | Verdict         | Disposition                                                         |
| ------------ | -------- | --------------------------------------- | ---------- | ------------------------------- | --------------- | ------------------------------------------------------------------- |
| `next`       | npm      | 15 years; selected release 5 days old   | 54.8M/week | `github.com/vercel/next.js`     | SUS (`too-new`) | Flagged — planner must add `checkpoint:human-verify` before install |
| `@next/mdx`  | npm      | 7 years; selected release 5 days old    | 1.0M/week  | `github.com/vercel/next.js`     | SUS (`too-new`) | Flagged — planner must add `checkpoint:human-verify` before install |
| `next-intl`  | npm      | 5 years; selected release 7 days old    | 4.8M/week  | `github.com/amannn/next-intl`   | SUS (`too-new`) | Flagged — planner must add `checkpoint:human-verify` before install |
| `minisearch` | npm      | 7 years; selected release 10 months old | 1.9M/week  | `github.com/lucaong/minisearch` | OK              | Approved                                                            |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** `next`, `@next/mdx`, `next-intl` — the signals are recency-only; all have official documentation and established source repositories, but the package gate still requires human verification before installation. [VERIFIED: npm registry]

The phase also reuses already approved lockfile pins for React, TanStack Query, XState, Playwright, axe, Storybook, Motion, React Aria, and Ajv rather than introducing new identities. [VERIFIED: codebase grep]

## Architecture Patterns

### System Architecture Diagram

```text
Repository content + TypeSpec contracts + route manifest + desktop captures
                               |
                               v
                  [schema/localization/evidence gate]
                               |
            +------------------+------------------+
            |                  |                  |
            v                  v                  v
      apps/web build     apps/account build   apps/admin build
      production/static  fixture preview      fixture preview
            |                  |                  |
            v                  v                  v
      public origin       account origin       admin origin
      public CSP/robots   noindex + own CSP     noindex + strict CSP/access
            |                  |                  |
            |            +-----+-----+      +-----+-----+
            |            |           |      |           |
            |         cancel     confirm   cancel     confirm
            |                        |                  |
            |                        v                  v
            |                 NoChangeReceipt   NoChangeReceipt
            |                 (Phase 4 named)   (Phase 4 named)
            |
            +--> docs/search/releases --> integrity decision
                                         /                \
                              approved public artifact   absent/mismatch
                                      (future)                 |
                                         |                     v
                                      download          fail-closed gate
```

The diagram’s right-hand branches are intentionally terminal in Phase 3: no account/admin confirmation may cross into a real authority adapter, and no download branch may expose a development-signed artifact. [VERIFIED: 03-CONTEXT.md]

### Recommended Project Structure

```text
apps/
├── web/                         # Public/docs/search/releases; production, static-first
│   ├── src/app/[locale]/        # One shared public/documentation/download shell
│   ├── src/content/             # Versioned MDX and localized public records
│   └── src/index.ts             # Declared public root
├── account/                     # Independently deployed, fixture-classified preview
│   ├── src/app/[locale]/
│   └── src/index.ts
└── admin/                       # Isolated fixture preview; no public/account navigation link
    ├── src/app/[locale]/
    └── src/index.ts

packages/
├── web-core/                    # Route manifest, content identities, link policy, ports
│   └── src/index.ts
├── web-preview/                 # Closed deterministic scenario catalog + no-change adapter
│   └── src/index.ts
└── web-features/                # Shared semantic features using design-system public root
    └── src/index.ts

tooling/
└── web-evidence/                # Content/build/header/artifact/link/visual/publication gates

quality/features/
├── WEB-01.json
├── WEB-02.json
├── WEB-03.json
└── WEB-08.json
```

Declare `web-core` as `application/production`, `web-preview` as `adapter/fixture`, `web-features` as `feature/production`, `apps/web` as `composition/production`, `apps/account` and `apps/admin` as `composition/fixture` until Phase 4 replaces their authority boundary, and `web-evidence` as `tooling/tooling`. This uses the repository’s existing runtime-class boundary instead of pretending preview compositions are production authority. [VERIFIED: architecture/decisions/0003-module-ownership-and-direction.md] [VERIFIED: architecture/decisions/0004-truth-provenance-and-fixture-boundary.md]

### Pattern 1: One Typed Route Manifest, Three Renderers

**What:** A readonly manifest owns route ID, surface, pathname template, locale behavior, shell, ownership, indexing policy, scenario requirement, security boundary, and safe context keys. Navigation, breadcrumbs, sitemap, redirects, desktop contextual links, and tests consume projections of this manifest; they do not maintain parallel path lists. [VERIFIED: 03-CONTEXT.md]

**When to use:** Every route or cross-origin link.

```typescript
// Source: project D-08 plus Next.js App Router file conventions
// https://nextjs.org/docs/app/getting-started/project-structure
export const webRoutes = [
  {
    id: 'docs.article',
    surface: 'public',
    shell: 'public',
    path: '/[locale]/docs/[version]/[...slug]',
    index: 'canonical',
    safeContext: ['locale', 'version', 'channel', 'section'],
    owner: 'documentation',
    scenario: null,
  },
  {
    id: 'admin.audit.event',
    surface: 'admin',
    shell: 'admin',
    path: '/[locale]/audit/[eventId]',
    index: 'noindex',
    safeContext: ['locale'],
    owner: 'audit-preview',
    scenario: 'W14',
  },
] as const satisfies readonly WebRouteRecord[];
```

The manifest describes route identity but does not itself make a route public; Next exposes only segments with `page` or `route` files, so a test must compare the filesystem route set to the manifest in both directions. [CITED: https://nextjs.org/docs/app/getting-started/project-structure]

### Pattern 2: Static Public Content, Dynamic Sensitive Previews

**What:** Public routes generate every supported locale/version at build time and use Server Components by default. Search/filter controls and compatibility questions become small Client Components with URL state. Account/admin use their own dynamic shells and nonce CSP because they model sensitive product workflows. [CITED: https://next-intl.dev/docs/routing/setup] [CITED: https://nextjs.org/docs/app/guides/content-security-policy]

**When to use:** Public availability and performance must survive downstream outages, while sensitive previews need a stricter per-request policy.

```typescript
// Source: https://next-intl.dev/docs/routing/setup
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return children;
}
```

Do not call request-only APIs such as `headers()` from public routes unless the route is intentionally dynamic; next-intl documents that request-header locale lookup opts a route into dynamic rendering. [CITED: https://next-intl.dev/docs/routing/setup]

### Pattern 3: Authority as a Port, Preview as a Closed Adapter

**What:** Features depend on a `FutureAuthorityPort`, not on fixture data. Phase 3 supplies a deterministic adapter whose only mutation result is a typed `NoChangeReceipt` naming the future authority, requested action, reviewed inputs, timestamp, correlation ID, and `remoteStateChanged: false`. [VERIFIED: 03-CONTEXT.md]

**When to use:** Sign-in, passkey/MFA/session, subscription, device, privacy request, support, consent-scoped diagnostic, and admin actions.

```typescript
// Source: https://stately.ai/docs/final-states
const previewMachine = setup({
  types: {} as {
    context: PreviewContext;
    events: PreviewEvent;
    output: NoChangeReceipt | CancelledReceipt;
  },
}).createMachine({
  initial: 'editing',
  states: {
    editing: { on: { REVIEW: { target: 'reviewing' } } },
    reviewing: {
      on: {
        CANCEL: { target: 'cancelled' },
        CONFIRM: { target: 'issuingReceipt', guard: 'isValid' },
      },
    },
    issuingReceipt: {
      invoke: {
        src: 'previewAuthority',
        onDone: { target: 'complete' },
      },
    },
    cancelled: { type: 'final', output: ({ context }) => cancelledReceipt(context) },
    complete: { type: 'final', output: ({ context }) => noChangeReceipt(context) },
  },
});
```

### Pattern 4: Release Record and Artifact Availability Are Different Truths

**What:** A release page may exist while artifact availability is `unavailable`. Model release metadata, compatibility evidence, manifest integrity state, public-distribution approval, and artifact URL as separate validated fields. An absent approval or any disagreement selects a blocking state, never a fallback URL. [VERIFIED: 03-CONTEXT.md]

**When to use:** Release indexes, channel pages, version pages, machine-readable manifest views, compatibility, and download calls to action.

For the published Phase 3 scenario, expose the complete release/integrity explanation but do not publish a canonical signed manifest or artifact URL that could be mistaken for an official release. A demonstrative manifest must be explicitly labeled and remain outside the official trust path. [VERIFIED: 03-CONTEXT.md]

### Pattern 5: Content Is Compiled Evidence

**What:** MDX body plus structured metadata is admitted only after generated-schema validation, locale parity, route ownership, claim/evidence linkage, review-date, link, indexing, screenshot-provenance, and release-coherence checks. The successful output is a versioned content bundle and public search index tied to the same build ID. [VERIFIED: 03-CONTEXT.md]

**When to use:** Marketing copy, support matrices, plans, policies, documentation, status/incident history, releases, manifests, screenshots, and social metadata.

The search index must be generated from the manifest’s `index: canonical` public projection. Account/admin routes, scenario controls, internal results, obsolete content, and private identifiers never enter it. [VERIFIED: 03-CONTEXT.md]

### Pattern 6: Surface-Specific Security Policy

**What:** Each app owns its own headers snapshot and deployment policy. Public forbids third-party runtime scripts, optional analytics, auth cookies, and sensitive storage; account/admin use request nonces and dynamic rendering, with admin additionally enforcing no framing and an explicit access-policy boundary. [VERIFIED: 03-CONTEXT.md]

**When to use:** `next.config`, `proxy.ts`, deployment manifests, Playwright header checks, and artifact admission.

Next.js documents that nonce CSP requires dynamic rendering, disables static optimization/ISR and default CDN caching, and is incompatible with PPR. Therefore, do not copy the account/admin nonce proxy into the public app. [CITED: https://nextjs.org/docs/app/guides/content-security-policy]

The public static CSP needs a Wave 0 proof because Next’s hash-based SRI alternative remains experimental. Test the exact production build in report-only mode first, record every required directive, prohibit third-party scripts, and promote to enforcement only when the static build and all routes are clean. [CITED: https://nextjs.org/docs/app/guides/content-security-policy]

### Pattern 7: Deterministic Visual Evidence Is a Build Input

**What:** Every real-product image has a sidecar record containing desktop version, locale, scenario, viewport, capture command, source commit/build ID, checksum, crop coordinates, and review/invalidation state. Visual tests compare the sidecar and image as one unit. [VERIFIED: 03-CONTEXT.md]

**When to use:** Home hero, evidence stage, product/detail pages, docs illustrations, release pages, and social imagery.

Playwright notes that screenshot output varies by operating system, browser, fonts, hardware, and settings, so baselines must be generated and compared in the same pinned Windows/Chromium/font environment. [CITED: https://playwright.dev/docs/test-snapshots]

### Anti-Patterns to Avoid

- **One app with hidden admin routes:** route groups are organizational, not deployment or origin isolation. Use three apps. [VERIFIED: 03-CONTEXT.md]
- **Server Actions as fake authority:** a server round-trip can make a preview look real. Keep Phase 3 confirmations in typed preview ports and return no-change receipts. [VERIFIED: 03-CONTEXT.md]
- **Public scenario query parameter:** no production route may accept arbitrary scenario IDs or expose a switcher. Published preview chooses one build-time scenario. [VERIFIED: 03-CONTEXT.md]
- **Duplicate path strings:** handwritten nav, sitemap, breadcrumbs, redirects, desktop links, and tests will drift. Project all of them from the canonical manifest. [VERIFIED: 03-CONTEXT.md]
- **Nonce CSP copied everywhere:** this silently destroys public static rendering and CDN behavior. [CITED: https://nextjs.org/docs/app/guides/content-security-policy]
- **MDX raw HTML or executable recipes:** trusted repository authors still need schema/review gates; do not publish generic registry/PowerShell mutation channels. [VERIFIED: 03-CONTEXT.md]
- **Search over rendered HTML or all routes:** it can leak preview/admin content and loses typed locale/version/availability filters. Generate from admitted public records. [VERIFIED: 03-CONTEXT.md]
- **Card-wall responsiveness:** dense records should collapse columns into explicit row detail; ordinary pages must not require two-axis scrolling. [VERIFIED: 03-UI-SPEC.md]
- **Decorative reveal dependency:** content must be visible before animation and remain complete under reduced motion, disabled JavaScript, slow media, and screenshot capture. [VERIFIED: Impeccable skill]

## Don't Hand-Roll

| Problem                              | Don't Build                                                | Use Instead                                                          | Why                                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locale routing/navigation            | Custom locale parsing and link rewriting                   | `next-intl` routing/navigation                                       | Handles locale segment validation, navigation wrappers, static rendering, metadata, and sitemap alternates. [CITED: https://next-intl.dev/docs/routing/setup]                            |
| Repository MDX wiring                | Custom Markdown parser/JSX loader                          | `@next/mdx`                                                          | Official Next integration composes with App Router layouts and metadata. [CITED: https://nextjs.org/docs/app/guides/mdx]                                                                 |
| Full-text search                     | Tokenizer, fuzzy matcher, ranker, and suggestion engine    | MiniSearch                                                           | Prefix, fuzzy, boosting, filtering, and suggestions are already implemented. [VERIFIED: npm registry]                                                                                    |
| Accessible menus/dialogs/tabs/fields | Custom keyboard, focus, and ARIA behavior                  | Existing React Aria-backed design system                             | The repository already owns authored accessible primitives and public exports. [VERIFIED: codebase grep]                                                                                 |
| Workflow legality                    | Boolean soup across confirmation screens                   | XState final states, guards, and actors                              | Closed statecharts make cancellation, invalid transitions, failure, and receipt termination testable. [CITED: https://stately.ai/docs/final-states]                                      |
| Async preview cache                  | Homegrown request cache/retry/offline store                | TanStack Query with explicit options                                 | Defaults and cancellation semantics are documented and can be overridden per fixture behavior. [CITED: https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults] |
| Runtime validation                   | Type assertions or duplicated validators                   | TypeSpec-generated JSON Schema + Ajv                                 | The repository already treats generated schemas as the language-neutral boundary. [VERIFIED: architecture/decisions/0004-truth-provenance-and-fixture-boundary.md]                       |
| SEO files                            | Separate sitemap/robots/social route inventories           | Next Metadata APIs projected from route manifest                     | Next provides first-class file/API conventions; one manifest prevents drift. [CITED: https://nextjs.org/docs/app/getting-started/project-structure]                                      |
| Image/font delivery                  | CSS background hacks and remote font runtime calls         | Next `Image` and `next/font/local`                                   | Preserve dimensions, progressive loading, self-hosted licenses, and critical-content priority. [CITED: https://nextjs.org/docs/app/getting-started/images]                               |
| Signature or hash bypass             | Client-side “continue anyway” logic or custom cryptography | Validated manifest state + hard gate; trusted signing stays Phase 10 | Integrity disagreement is a terminal failure and signing is outside this phase. [VERIFIED: 03-CONTEXT.md]                                                                                |

**Key insight:** the deceptively hard parts are not page rendering; they are keeping route, locale, evidence, scenario, security, and release truth synchronized across three artifacts. Central contracts and generated projections are the safety feature.

## Common Pitfalls

### Pitfall 1: Treating WEB-03 as Permission to Publish the Dev Installer

**What goes wrong:** A plan points the download button or manifest at the Phase 2 development/self-signed artifact to make the requirement “pass.”  
**Why it happens:** The requirement sentence says “download,” but the later locked context explicitly withholds public distribution approval.  
**How to avoid:** Implement the entire journey and prove the unavailable/mismatch terminal states; keep artifact URL absent until Phase 10 approval. [VERIFIED: 03-CONTEXT.md]  
**Warning signs:** Any public path contains `dev`, `self-signed`, a local build filename, or a bypass action.

### Pitfall 2: Architecture Policy Added After the Apps

**What goes wrong:** New apps/packages exist before module boundaries, allowing deep imports, cycles, or production-to-fixture edges to become entrenched.  
**Why it happens:** Next scaffolding feels like the fastest first task.  
**How to avoid:** Wave 0 edits the canonical module policy, ownership guide, architecture fixtures, and dependency tests before application code. [VERIFIED: architecture/decisions/0003-module-ownership-and-direction.md]  
**Warning signs:** `apps/web`, `apps/account`, or `apps/admin` is unknown to `pnpm test:architecture`.

### Pitfall 3: Preview Composition Classified as Production Authority

**What goes wrong:** Account/admin import a simulator from a production runtime class or return a receipt that implies a real mutation.  
**Why it happens:** A deployable preview is confused with a production authority.  
**How to avoid:** Keep preview adapter and preview compositions fixture-classified; production public app never depends on them. [VERIFIED: architecture/decisions/0004-truth-provenance-and-fixture-boundary.md]  
**Warning signs:** Preview data is labeled `measured`, auth/session cookies appear, or artifact scans contain scenario selectors.

### Pitfall 4: CSP Choice Accidentally Disables the Public Architecture

**What goes wrong:** A nonce proxy forces all public pages dynamic, removes CDN caching, and increases cost/availability risk.  
**Why it happens:** “Strict CSP” is applied uniformly without checking Next rendering consequences.  
**How to avoid:** Prove public static CSP separately; reserve per-request nonces for account/admin. [CITED: https://nextjs.org/docs/app/guides/content-security-policy]  
**Warning signs:** Public pages call `headers()` only to read a nonce, or `next build` reports every route dynamic.

### Pitfall 5: Locale Parity Stops at Visible Body Copy

**What goes wrong:** PT-BR/English routes render, but metadata, errors, manifests, screenshots, policy history, notices, and search records drift.  
**Why it happens:** Translation tests compare message files but not the complete publication graph.  
**How to avoid:** Key parity is only one gate; enumerate every route/content/asset record by locale and fail on missing or stale counterparts. [VERIFIED: 03-CONTEXT.md]  
**Warning signs:** default-locale fallbacks in production, missing alternates, or screenshots without locale sidecars.

### Pitfall 6: Canonical Manifest Is Merely Another List

**What goes wrong:** A manifest exists, but nav/sitemap/redirects/tests remain handwritten.  
**Why it happens:** The manifest is treated as documentation rather than executable authority.  
**How to avoid:** Every consumer is a projection or validation target; tests compare both missing and extra entries. [VERIFIED: 03-CONTEXT.md]  
**Warning signs:** path literals recur across menus, tests, sitemaps, and desktop links.

### Pitfall 7: Search Leaks Non-Public Records

**What goes wrong:** A broad filesystem crawler indexes account/admin previews, scenario IDs, obsolete docs, or internal search pages.  
**Why it happens:** Post-render HTML indexing ignores route ownership and content policy.  
**How to avoid:** Build MiniSearch only from admitted typed public records and assert forbidden route IDs are absent. [VERIFIED: 03-CONTEXT.md]  
**Warning signs:** search fixtures contain `admin`, `scenario`, customer-like identifiers, or noindex content.

### Pitfall 8: Visual Tests Are Non-Deterministic

**What goes wrong:** Fonts, clocks, IDs, media crops, or OS/browser versions produce noisy baselines.  
**Why it happens:** Screenshot tests freeze only viewport size.  
**How to avoid:** Freeze all W01–W18 axes and compare in one pinned Windows/Chromium/font environment. [CITED: https://playwright.dev/docs/test-snapshots]  
**Warning signs:** blanket pixel thresholds, hidden dynamic regions, or baseline updates without a design-contract reason.

### Pitfall 9: 400% Zoom Is Tested as a Screenshot Scale

**What goes wrong:** A CSS transform or high-DPI screenshot is used instead of reducing the layout viewport to the equivalent 320 CSS px.  
**Why it happens:** Zoom and pixel density are conflated.  
**How to avoid:** Test actual browser zoom/reflow and the 320 CSS px equivalent; permit one-axis scrolling only for genuinely two-dimensional technical regions. [CITED: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html]  
**Warning signs:** body-level horizontal scroll, hidden columns without row detail, sticky headers obscuring focus.

### Pitfall 10: UI-SPEC Approval Metadata Drift

**What goes wrong:** Planning assumes the design contract is approved while its frontmatter still says `status: draft` and checker sign-off remains pending.  
**Why it happens:** `.planning/STATE.md` says “Phase 3 UI-SPEC approved,” but the canonical file has not recorded that state. [VERIFIED: codebase grep]  
**How to avoid:** Resolve the metadata/sign-off before execution and treat the content as locked in the meantime.  
**Warning signs:** plan tasks alter design decisions that should already be frozen.

## Code Examples

Verified patterns from official sources and the locked project contract:

### Localized Static Metadata

```typescript
// Source: https://next-intl.dev/docs/environments/actions-metadata-route-handlers
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, version, slug } = await params;
  const article = await content.getArticle({ locale, version, slug });
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return {
    title: `${article.title} — ${t('documentation')}`,
    alternates: {
      canonical: routeHref('docs.article', { locale, version, slug }),
      languages: localeAlternates('docs.article', { version, slug }),
    },
    robots: article.indexing === 'canonical' ? { index: true, follow: true } : { index: false },
  };
}
```

Pass locale explicitly; relying on request headers would make otherwise static metadata dynamic. [CITED: https://next-intl.dev/docs/routing/setup]

### Public-Only Search Index

```typescript
// Source: https://github.com/lucaong/minisearch
const searchableRecords = admittedContent
  .filter((record) => record.indexing === 'canonical' && record.surface === 'public')
  .map(toSearchDocument);

const index = new MiniSearch<SearchDocument>({
  idField: 'routeId',
  fields: ['title', 'summary', 'body', 'identifiers', 'errorCodes'],
  storeFields: ['routeId', 'locale', 'version', 'domain', 'risk', 'availability'],
});

index.addAll(searchableRecords);

export function search(query: string, filters: SearchFilters) {
  return index.search(query, {
    prefix: true,
    fuzzy: 0.2,
    boost: { title: 3, identifiers: 4, errorCodes: 5 },
    filter: (result) =>
      result.locale === filters.locale &&
      matchesVersion(result.version, filters.version) &&
      matchesAvailability(result.availability, filters.availability),
  });
}
```

Freeze normalization rules for PT-BR diacritics and technical identifiers in tests; do not silently strip meaningful punctuation from error codes, versions, or hardware IDs. [VERIFIED: 03-CONTEXT.md]

### Typed No-Change Receipt

```typescript
// Source: project D-03/D-52/D-59 and https://stately.ai/docs/final-states
export const previewAuthority: FutureAuthorityPort = {
  async request(command, { signal }) {
    await deterministicDelay(command.scenario.latencyMs, signal);
    return noChangeReceiptSchema.parse({
      receiptVersion: 1,
      authority: command.futureAuthority,
      requestedAction: command.kind,
      correlationId: command.correlationId,
      reviewedAt: command.clock.now(),
      provenance: { kind: 'simulated', scenarioId: command.scenario.id },
      remoteStateChanged: false,
      nextPhase: 4,
    });
  },
};
```

The actual project validator should be the generated/Ajv validator, not the illustrative `.parse` shorthand above. [VERIFIED: architecture/decisions/0004-truth-provenance-and-fixture-boundary.md]

### Fail-Closed Release Decision

```typescript
// Source: project D-35 through D-45
export function decideDownload(record: ValidatedReleaseRecord): DownloadDecision {
  if (!record.publicDistributionApproved) {
    return { kind: 'blocked', reason: 'distribution-not-approved' };
  }

  const disagreements = compareIntegrity(record.manifest, record.artifactEvidence);
  if (disagreements.length > 0) {
    return { kind: 'blocked', reason: 'integrity-mismatch', disagreements };
  }

  if (!record.artifact?.officialUrl) {
    return { kind: 'blocked', reason: 'artifact-unavailable' };
  }

  return { kind: 'available', artifact: record.artifact };
}
```

The Phase 3 published dataset must always select a blocked decision until trusted distribution approval exists. [VERIFIED: 03-CONTEXT.md]

### Per-Surface Header Contract

```typescript
// Source: https://nextjs.org/docs/app/guides/content-security-policy
export const adminHeaderContract = {
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'nonce-{requestNonce}'", "'strict-dynamic'"],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
  },
  robots: 'noindex, nofollow, noarchive',
  referrerPolicy: 'no-referrer',
  permissionsPolicy: denyUnusedCapabilities(),
} as const;
```

Generate the nonce with a cryptographically secure per-request value; never derive it from a scenario, clock, route, or fixture ID. [CITED: https://nextjs.org/docs/app/guides/content-security-policy]

## State of the Art

| Old Approach                               | Current Approach                                                          | When Changed                          | Impact                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next `middleware.ts`                       | Next 16 `proxy.ts`                                                        | Next.js 16                            | Name the locale/CSP request boundary `proxy.ts`; avoid stale middleware examples. [CITED: https://next-intl.dev/docs/routing/setup]                             |
| Request-header locale on every page        | `generateStaticParams` + `setRequestLocale` for static locale routes      | Current next-intl App Router guidance | Public localized pages and metadata remain static-eligible. [CITED: https://next-intl.dev/docs/routing/setup]                                                   |
| One generic `_error` page                  | Segment `error`, `global-error`, `not-found`, plus authored status routes | App Router                            | Implement 404/403/410/500 as distinct manifest-owned experiences, not one redirect. [CITED: https://nextjs.org/docs/app/getting-started/project-structure]      |
| Uniform nonce CSP across a site            | Rendering-aware per-surface CSP                                           | Current Next guidance                 | Nonces are appropriate for sensitive dynamic apps but conflict with static public delivery. [CITED: https://nextjs.org/docs/app/guides/content-security-policy] |
| Screenshot snapshots on arbitrary machines | Pinned OS/browser/font environment                                        | Current Playwright guidance           | Golden images must be captured and compared in the same deterministic environment. [CITED: https://playwright.dev/docs/test-snapshots]                          |
| Handwritten locale sitemap URLs            | Metadata sitemap language alternates from route helpers                   | Current next-intl/Next guidance       | Canonical locale paths remain aligned with navigation. [CITED: https://next-intl.dev/docs/environments/actions-metadata-route-handlers]                         |

**Deprecated/outdated:**

- `middleware.ts` examples for Next 16: use `proxy.ts`. [CITED: https://next-intl.dev/docs/routing/setup]
- Pages Router `_app`, `_document`, and `_error` patterns: this phase is App Router. [CITED: https://nextjs.org/docs/app/getting-started/project-structure]
- Treating experimental Next SRI as a stable production default: keep it behind a Wave 0 security spike and explicit approval. [CITED: https://nextjs.org/docs/app/guides/content-security-policy]
- TypeScript 7 for this workspace: the approved `typescript-eslint` peer range holds the repository at TypeScript 6.0.3. [VERIFIED: AGENTS.md]

## Assumptions Log

| #   | Claim                                                                                                                             | Section | Risk if Wrong |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------- |
| —   | None. Recommendations are grounded in locked context, live codebase inspection, registry checks, or cited official documentation. | —       | —             |

## Open Questions (RESOLVED)

All five planning questions are resolved below from locked context, official framework constraints, `.planning/STATE.md`, and the package-legitimacy protocol. Execution may still fail closed at the named evidence gate; that is a planned safety outcome, not an unresolved design choice.

| Question | Resolved decision | Enforcement owner |
|---|---|---|
| Static public CSP | Keep public routes static-first. Plan 03-15 uses report-only inspection only as a production-build diagnostic, then ships an enforced, build-proven policy with no third-party runtime scripts, request nonce, silent directive weakening, or experimental SRI dependency. If the exact Next output cannot satisfy that contract, the build blocks rather than adding permissive script sources or making the public tree dynamic. | 03-14 security evidence; 03-15 public shell |
| Demonstrative release manifest route | Render validated demonstrative fields only inside the persistently labeled release UI and fixture evidence. Do not publish sample JSON at the canonical official-manifest URL and do not emit an artifact URL until a publicly trusted record exists, per D-35. | 03-24 decision engine; 03-25 release UI |
| Surface hostnames | Use environment-validated `public.localhost`, `account.localhost`, and `admin.localhost` defaults for deterministic Phase 3 build/E2E policy tests. Real production DNS and edge/IaC hostnames remain owned by the later distribution/operations phase. | 03-14 browser matrix; 03-15 through 03-17 policies |
| UI-SPEC approval | `03-UI-SPEC.md` is approved, reconciling its frontmatter/checklist with `.planning/STATE.md` (`stopped_at: Phase 3 UI-SPEC approved`). Plans consume it as the locked design contract. | Planning artifact reconciliation |
| Recency-flagged package approval | `next@16.2.12`, `@next/mdx@16.2.12`, and `next-intl@4.13.4` remain `SUS` until Plan 03-01 reproduces registry/repository/lifecycle evidence and receives the non-auto-approvable blocking human approval. No install or lockfile resolution may precede it. | 03-01 blocking-human legitimacy gate |

1. **What static CSP is enforceable for the exact public Next 16.2.12 build without weakening the project gate?**
   - What we know: nonce CSP forces dynamic rendering; Next’s static SRI alternative is experimental. [CITED: https://nextjs.org/docs/app/guides/content-security-policy]
   - Prior uncertainty: the minimal directive set required by the final public bundle and whether experimental SRI is acceptable; resolved by the fail-closed build-proven policy above.
   - Resolution implementation: use the Wave 0 security gate plus Plan 03-15 production-build probe; report-only is diagnostic, while the final shipped header is enforced and any unresolved violation blocks completion.

2. **Should the demonstrative release manifest have a public JSON route?**
   - What we know: official manifest and artifact trust must fail closed, while the complete manifest UX must be demonstrated. [VERIFIED: 03-CONTEXT.md]
   - Prior uncertainty: whether a public sample JSON route could be mistaken for an official canonical release; resolved by keeping it inside labeled UI/fixture evidence only.
   - Resolution implementation: render the schema/fields in the labeled scenario UI and fixture tests, but do not publish it at the canonical official-manifest URL until an approved release exists.

3. **Which exact hostnames will represent the three origins?**
   - What we know: distinct origins and policies are locked; infrastructure provisioning is not Phase 3. [VERIFIED: 03-CONTEXT.md]
   - Prior uncertainty: production DNS names and preview-domain conventions; resolved for Phase 3 with validated localhost origins and later-phase production DNS ownership.
   - Resolution implementation: define an environment-validated origin map with test defaults (`public.localhost`, `account.localhost`, `admin.localhost`) and defer real DNS/IaC to the infrastructure phase.

4. **Is `03-UI-SPEC.md` formally approved?**
   - What we know: `.planning/STATE.md` says approved, while UI-SPEC frontmatter and checker boxes say draft/pending. [VERIFIED: codebase grep]
   - Prior uncertainty: which artifact is authoritative for the sign-off state; resolved by reconciling UI-SPEC with the approved state recorded in `.planning/STATE.md`.
   - Resolution implementation: UI-SPEC metadata, checklist, and approval now match the authoritative approved state; executor plans consume the reconciled artifact.

5. **Will the three recency-flagged packages receive approval?**
   - What we know: Next, `@next/mdx`, and next-intl are official projects and current stack choices, but the legitimacy seam returned SUS because selected releases are under one week old. [VERIFIED: npm registry]
   - Prior uncertainty: human acceptance of that recency; resolved procedurally by the blocking-human Plan 03-01 checkpoint before installation authority is granted.
   - Resolution implementation: Plan 03-01 owns the non-auto-approvable `checkpoint:human-verify` before first install and lists registry/repository/postinstall evidence.

## Environment Availability

| Dependency                  | Required By                                     | Available        | Version                                | Fallback                                                                                                                             |
| --------------------------- | ----------------------------------------------- | ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Windows                     | Visual/E2E parity with desktop and target users | ✓                | Windows host                           | —                                                                                                                                    |
| Node.js                     | Next builds, content tooling, tests             | ⚠ wrong host pin | 24.16.0 host; project requires 24.18.0 | Use the repository’s pnpm `devEngines.runtime` download policy or upgrade host before direct npm commands. [VERIFIED: codebase grep] |
| pnpm                        | Workspace/package scripts                       | ✓                | 11.17.0                                | —                                                                                                                                    |
| Git                         | build IDs, provenance, rollback bundle          | ✓                | 2.54.0.windows.1                       | —                                                                                                                                    |
| Playwright                  | Multi-app E2E/visual/accessibility              | ✓                | 1.62.0                                 | —                                                                                                                                    |
| Playwright Chromium bundles | Deterministic browser runs                      | ✓                | chromium 1228 and 1234 present         | Install the lockfile-selected browser if the web config selects a different revision. [VERIFIED: environment probe]                  |
| Next.js packages            | Application build                               | ✗ not installed  | planned 16.2.12                        | Install only after package-legitimacy checkpoint. [VERIFIED: codebase grep]                                                          |

**Missing dependencies with no fallback:** none after the required Node/package preflight.

**Missing dependencies with fallback:**

- Host Node 24.18.0 is absent; the repository already declares a pnpm-managed download fallback, but Wave 0 must prove `pnpm verify:workspace` selects the required runtime. [VERIFIED: codebase grep]
- Next.js packages are absent; installation is gated by the required human verification checkpoint. [VERIFIED: codebase grep]

No Docker, PostgreSQL, Neon, AWS, Cloudflare, Better Auth, payment provider, email provider, object storage, or admin authority is needed to complete Phase 3. [VERIFIED: 03-CONTEXT.md]

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest 4.1.10 + Playwright 1.62.0 + Storybook 10.5.4 + `@axe-core/playwright` 4.12.1 [VERIFIED: codebase grep] |
| Config file        | None for web — create in Wave 0                                                                                |
| Quick run command  | `pnpm web:verify:quick` — create in Wave 0                                                                     |
| Full suite command | `pnpm verify` after root verification graph is extended to include web                                         |

The existing root `verify:quick` delegates to the desktop lifecycle, which in turn reaches foundation gates; Phase 3 must extend the root graph without dropping any foundation or desktop evidence. Required-artifact tests must prove the new web commands remain reachable. [VERIFIED: codebase grep]

### Phase Requirements → Test Map

| Req ID | Behavior                                                                                                     | Test Type                           | Automated Command                               | File Exists? |
| ------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ----------------------------------------------- | ------------ |
| WEB-01 | Public route/content/claim/search/plan matrix is complete, bilingual, truthful, responsive, and navigable    | unit + E2E + visual + accessibility | `pnpm web:verify:quick -- --requirement WEB-01` | ❌ Wave 0    |
| WEB-02 | Locale/version/channel docs routes, stale handling, search, and desktop contextual links agree with manifest | contract + unit + E2E               | `pnpm web:verify:quick -- --requirement WEB-02` | ❌ Wave 0    |
| WEB-03 | Channel/integrity/compatibility/mismatch/unavailable states terminate safely and expose no dev artifact      | state-machine + artifact + E2E      | `pnpm web:verify:quick -- --requirement WEB-03` | ❌ Wave 0    |
| WEB-08 | Three apps build independently with distinct headers, origins, indexing, cookies, and fixture boundaries     | architecture + build + header smoke | `pnpm web:verify:quick -- --requirement WEB-08` | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** focused Vitest file or `pnpm web:verify:quick -- --requirement WEB-0X`
- **Per wave merge:** `pnpm web:verify:quick`
- **Phase gate:** full `pnpm verify` plus final acceptance manifests green before `$gsd-verify-work`

### Wave 0 Gaps

- [ ] Declare `web-core`, `web-preview`, `web-features`, three app modules, and `web-evidence` in `architecture/module-boundaries.json`; extend architecture fixtures.
- [ ] Create package/app manifests, strict tsconfigs, Next configs, and independent `build/start/check/test` scripts.
- [ ] Create `tooling/web-evidence/src/route-manifest.test.ts` — bidirectional route/nav/sitemap/redirect/desktop-link ownership.
- [ ] Create `tooling/web-evidence/src/content-publication.test.ts` — schema, locale, review-date, evidence, policy, screenshot, search-index, and release coherence.
- [ ] Create `tooling/web-evidence/src/security-boundaries.test.ts` — headers, CSP, robots, cookies, origin transitions, preview/artifact leakage.
- [ ] Create `tooling/web-evidence/src/release-gate.test.ts` — unavailable, mismatch, no-bypass, no-development-artifact cases.
- [ ] Create `tooling/web-evidence/playwright.config.ts` — three web servers, W01–W18 projections, pinned Windows/Chromium snapshots.
- [ ] Create Storybook web catalog and parity checks for all locked states/locales/axes.
- [ ] Create `quality/features/WEB-01.json` through `WEB-08.json` (assigned IDs only) with five-dimension planned evidence.
- [ ] Add `web:verify:quick`, `web:verify`, and root reachability; update required-artifact tests so no existing gate is dropped.
- [ ] Add human verification checkpoint for `next`, `@next/mdx`, and `next-intl`.

## Security Domain

ASVS 5.0 reorganized the categories: authentication is V6, sessions V7, authorization V8, while V1–V3 cover encoding, validation/business logic, and web frontend security. The phase should use the current category names rather than copying ASVS 4 numbering. [CITED: https://github.com/OWASP/ASVS/tree/master/5.0]

### Applicable ASVS 5.0 Categories

| ASVS Category                           | Applies  | Standard Control                                                                                                                                                           |
| --------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1 Encoding and Sanitization            | yes      | React escaping, trusted repository MDX only, no raw user HTML, safe URL construction, CSP. [CITED: https://github.com/OWASP/ASVS/tree/master/5.0]                          |
| V2 Validation and Business Logic        | yes      | Generated JSON Schema + Ajv at all inputs; state-machine guards; client validation is UX, not future authority. [CITED: https://github.com/OWASP/ASVS/tree/master/5.0]     |
| V3 Web Frontend Security                | yes      | Per-surface CSP, frame policy, safe rendering, no third-party scripts, tested browser security support. [CITED: https://github.com/OWASP/ASVS/tree/master/5.0]             |
| V4 API and Web Service                  | limited  | Only read-only manifest/metadata route handlers; no authority mutation API in Phase 3. [VERIFIED: 03-CONTEXT.md]                                                           |
| V5 File Handling                        | no       | No public upload or downloadable approved binary is introduced in Phase 3. [VERIFIED: 03-CONTEXT.md]                                                                       |
| V6 Authentication                       | deferred | Sign-in is a labeled preview and cannot issue identity/session state; real controls are Phase 4. [VERIFIED: 03-CONTEXT.md]                                                 |
| V7 Session Management                   | deferred | No real session cookie or session authority in Phase 3. [VERIFIED: 03-CONTEXT.md]                                                                                          |
| V8 Authorization                        | partial  | Separate admin deployment/access boundary and role-specific preview navigation; authoritative permission checks remain Phase 4. [VERIFIED: 03-CONTEXT.md]                  |
| V9 Self-contained Tokens                | no       | Do not introduce preview JWTs or entitlement tokens. [VERIFIED: 03-CONTEXT.md]                                                                                             |
| V10 OAuth and OIDC                      | deferred | Browser/PKCE/social/passkey authority remains Phase 4. [VERIFIED: 03-CONTEXT.md]                                                                                           |
| V11 Cryptography                        | limited  | Do not hand-roll signing; display and compare validated release evidence only. [VERIFIED: 03-CONTEXT.md]                                                                   |
| V12 Secure Communication                | yes      | HTTPS/HSTS-ready origin contracts, explicit cross-origin transitions, no sensitive query transfer. [CITED: https://github.com/OWASP/ASVS/tree/master/5.0]                  |
| V13 Configuration                       | yes      | Separate CSP, robots, permissions, referrer, cache, cookie, and build/deployment policies per app. [CITED: https://github.com/OWASP/ASVS/tree/master/5.0]                  |
| V14 Data Protection                     | yes      | No optional analytics without consent; minimal storage; preview data is synthetic/redacted; no sensitive URL state. [CITED: https://github.com/OWASP/ASVS/tree/master/5.0] |
| V15 Secure Coding and Architecture      | yes      | Module boundaries, fixture defenses, contract generation, isolated origins, no arbitrary execution. [CITED: https://github.com/OWASP/ASVS/tree/master/5.0]                 |
| V16 Security Logging and Error Handling | yes      | Authored 403/410/500, opaque correlation IDs, redacted diagnostics, immutable simulated audit timeline. [CITED: https://github.com/OWASP/ASVS/tree/master/5.0]             |
| V17 WebRTC                              | no       | No real-time media or peer connection capability in scope. [VERIFIED: 03-CONTEXT.md]                                                                                       |

### Known Threat Patterns for Next.js Preview Surfaces

| Pattern                                  | STRIDE                            | Standard Mitigation                                                                                                                                                                                 |
| ---------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixture appears authoritative            | Spoofing                          | Persistent preview provenance, fixture runtime class, no-change terminal receipts, artifact/process leakage scans. [VERIFIED: architecture/decisions/0004-truth-provenance-and-fixture-boundary.md] |
| MDX/content injection                    | Tampering / Elevation             | Repository review, generated metadata schema, no untrusted raw HTML/JS, React escaping, CSP. [CITED: https://github.com/OWASP/ASVS/tree/master/5.0]                                                 |
| Open redirect through return path        | Spoofing                          | Resolve only route-manifest IDs and allowlisted origins; never accept arbitrary URL schemes/hosts. [VERIFIED: 03-CONTEXT.md]                                                                        |
| Cross-origin state leakage               | Information Disclosure            | Preserve only enumerated safe context; never put sessions, diagnostics, consent payloads, or forms in URLs. [VERIFIED: 03-CONTEXT.md]                                                               |
| Public search indexes preview/admin data | Information Disclosure            | Generate index from admitted public manifest projection; artifact test forbidden identifiers/routes. [VERIFIED: 03-CONTEXT.md]                                                                      |
| Admin clickjacking                       | Spoofing / Elevation              | `frame-ancestors 'none'`, no public navigation link, separate access policy/origin. [CITED: https://nextjs.org/docs/app/guides/content-security-policy]                                             |
| Locale/scenario cache confusion          | Information Disclosure            | Locale-specific static paths for public; `private/no-store` dynamic previews; no public scenario selector. [VERIFIED: 03-CONTEXT.md]                                                                |
| Development installer becomes public     | Tampering / Spoofing              | No artifact URL in Phase 3 record, allowlisted official origin, manifest mismatch gate, artifact scan, no bypass. [VERIFIED: 03-CONTEXT.md]                                                         |
| Error page leaks internals               | Information Disclosure            | Authored redacted states with opaque correlation IDs; details only in bounded local evidence. [VERIFIED: 03-CONTEXT.md]                                                                             |
| Sticky UI obscures keyboard focus        | Denial of Service (accessibility) | Scroll padding, focus restoration, viewport tests; WCAG requires focused component not entirely hidden. [CITED: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html]        |

## Sources

### Primary (authoritative project and registry evidence)

- `.planning/phases/03-complete-web-experience/03-CONTEXT.md` — locked scope, truth, release, preview, accessibility, and publication decisions.
- `.planning/phases/03-complete-web-experience/03-UI-SPEC.md` — route families, components, scenario matrix, visual/accessibility/performance acceptance.
- `architecture/decisions/0003-module-ownership-and-direction.md` — module and dependency authority.
- `architecture/decisions/0004-truth-provenance-and-fixture-boundary.md` — provenance and five fixture defenses.
- `architecture/decisions/0005-cross-cutting-acceptance-policy.md` — five-dimension evidence and root reachability.
- npm registry plus `package-legitimacy check` — exact versions, publish times, repositories, downloads, postinstall signals, and verdicts.

### Secondary (official documentation, MEDIUM confidence)

- https://nextjs.org/docs/app/getting-started/project-structure — App Router structure, special files, route groups, metadata conventions.
- https://nextjs.org/docs/app/guides/content-security-policy — nonce CSP, dynamic-rendering consequences, and experimental SRI.
- https://nextjs.org/docs/app/guides/mdx — repository MDX integration.
- https://nextjs.org/docs/app/getting-started/images — responsive/optimized local image patterns.
- https://next-intl.dev/docs/routing/setup — locale segment, static rendering, navigation, and Next 16 proxy naming.
- https://next-intl.dev/docs/environments/actions-metadata-route-handlers — localized metadata and sitemap alternates.
- https://playwright.dev/docs/test-webserver — application server orchestration.
- https://playwright.dev/docs/test-snapshots — deterministic visual comparison constraints.
- https://stately.ai/docs/final-states — typed final-state workflow design.
- https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults — async cache defaults.
- https://www.w3.org/WAI/WCAG22/Understanding/reflow.html — 320 CSS px/400% reflow.
- https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html — focus visibility.
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — 24 CSS px AA minimum.
- https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html — programmatic status messages.
- https://github.com/OWASP/ASVS/tree/master/5.0 — current ASVS categories and controls.

### Tertiary (LOW confidence)

- No training-only package or architecture claims were used. Context7 was unavailable and the configured web-search provider had no API key, so official documentation was fetched directly and cached through the research seam; time-sensitive framework details should be rechecked at execution.

## Metadata

**Confidence breakdown:**

- Standard stack: MEDIUM — versions are live-registry verified and aligned with the locked stack, but three newly published identities require human recency approval.
- Architecture: HIGH — driven primarily by locked context and executable repository policies.
- Pitfalls: MEDIUM — grounded in official Next/W3C/Playwright behavior and observed codebase gaps.
- Security: MEDIUM — ASVS 5.0 categories were checked against the official source; final public CSP remains a Wave 0 spike.

**Research date:** 2026-07-30  
**Valid until:** 2026-08-06 (fast-moving Next.js and package recency)
