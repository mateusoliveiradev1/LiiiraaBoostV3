# Phase 3: Complete Web Experience - Context

**Gathered:** 2026-07-30  
**Status:** Ready for planning

<domain>

## Phase Boundary

Deliver a production-quality web ecosystem whose public site, versioned documentation, release and download surfaces, account experience, and isolated administrative application are visually coherent, independently secure, completely navigable, and truthful about every simulated or unavailable authority.

Phase 3 finishes the web UX and its deterministic state contract. It does not create real authentication, billing, device licensing, support authority, diagnostic access, or administrative effects; those remain Phase 4 responsibilities. It also does not authorize public distribution of a development-signed installer. Until a publicly approved artifact exists, the complete download journey must fail closed at the distribution boundary.

</domain>

<decisions>

## Implementation Decisions

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
- **D-19:** The hero evokes a serious PC ready for a competitive session: near-black, graphite, controlled cobalt focus, calm power, and the real product as the dominant proof. Remove generic headset/city imagery, RGB, neon, glassmorphism, gradient text, decorative grids, repeated cards, oversized radii, and theatrical gamer clichés.
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

### Final launch-ready commercial and lifecycle decisions

- **D-87:** Phase 3 now owns the near-final visual, UX, information-architecture, and editorial experience for every public, documentation, authentication-preview, account-preview, and admin-preview route. Ordinary product surfaces must read as a real customer-facing application; implementation terms remain confined to explicit technical disclosures and developer evidence.
- **D-88:** Public primary navigation is Product, Results, Compatibility, Plans, and Download, with `Baixar grátis` / `Download free` as the acquisition CTA. Documentation, Support, Status, Releases, Search, Security, Privacy, and Terms remain reachable through contextual links and the utility footer instead of crowding the primary acquisition path. The locale control always shows flag plus language text and preserves the canonical route.
- **D-89:** The Home sells in this order: real desktop product capture; player problem; analyze/optimize/prove explanation; Essential versus Competitive modes; human-language results methodology; safety and restoration; Free versus Premium; final price; objections/FAQ; and a repeated free-download CTA. Copy leads with customer outcomes and defensible proof, never internal architecture or miracle claims.
- **D-90:** Free is the real Essential Mode: safe basic optimizations, manual application, one active game profile, diagnostics and benchmark, safe process/startup and power-plan work, and complete history/restoration. It works locally without login, advertisements, artificial daily limits, or a card. Free is the product demonstration; there is no trial.
- **D-91:** Premium is Competitive Mode: hardware-specific calibration, advanced optimizations, unlimited profiles, automatic per-game activation, advanced comparisons, personalized assistance, and priority support. Its commercial promise is: prepare Windows to concentrate resources on the game, reduce interference during the match, and restore the previous state when the session ends. Never promise magic FPS; describe frametime consistency, fewer interruptions, and latency only when evidence supports the scope.
- **D-92:** Final launch pricing is R$ 29,90 monthly or R$ 249,90 annually in PT-BR, and US$ 6.99 monthly or US$ 59.99 annually in English. Card supports monthly and annual billing; Pix supports annual billing; boleto is absent at launch. Refund is full within seven days of the first subscription. Cancellation is available at any time with access through the paid cycle. Phase 3 renders the complete decision and simulated checkout experience but performs no charge or remote mutation.
- **D-93:** One Premium subscription activates one PC through the account without a typed license key. The user may transfer/reset the device once every 30 days; reinstallations and minor upgrades do not consume a reset, while a significant identity change such as motherboard replacement normally creates a new device. Raw HWID is never stored; identity is derived and protected. Legitimate exceptions route to support with security confirmation and audit. Premium remains available offline for 30 days, then falls back to Free; history and restoration are never blocked.
- **D-94:** Support expectations are public and specific: Free uses documentation, community, and email with response within 72 business hours; Premium receives an initial response within 24 business hours. Billing, security, and restoration incidents remain prioritized regardless of plan.
- **D-95:** Data stays local by default. Optional telemetry is consented, reviewable, purpose-bound, and never includes personal files or browsing history; high-frequency game-time telemetry is forbidden. Free offers basic contextual help; Premium may provide personalized analysis. Cloud diagnostics require explicit consent for each bounded purpose.
- **D-96:** Web onboarding covers account entry, email verification and passkey/MFA preparation, Free/Premium choice, simulated payment when applicable, download, first-PC activation preview, and account/device/support management. The web performs no deep PC analysis. If the desktop app is installed, the analysis CTA may use `liiiraaboost://analyze`; otherwise it routes to download. Any account summary of the desktop analysis is opt-in.
- **D-97:** Desktop onboarding remains the real machine-analysis journey: language; permissions/privacy/restoration; compatibility; hardware/Windows/driver/process analysis; game detection; priority games; balanced/stability/streaming/competitive objective; baseline benchmark; optimization plan; change review; recovery creation; and apply. There is no aggression slider.
- **D-98:** Distribution presents Stable, opt-in Beta, and internal-only Experimental channels. The signed Tauri updater checks at startup and while idle, never downloads or installs during a game, validates signature/hash/channel/compatibility, downloads in the background, and offers install now, later, on close, or scheduled with failure recovery. Release rollout is 5%, 25%, then 100%, pausable by returning the manifest to the last safe version. Download pages show version, date, supported Windows, size, notes, signature, SHA-256, channel, and supported history.
- **D-99:** `/docs` is the single documentation center, with articles nested below the same family. `/support` is customer service and `/status` is operational health. Commercial routes never use documentation prose as their main sales hierarchy.
- **D-100:** Final route polish covers the complete canonical destination inventory and all loading, empty, offline, stale, partial-failure, expired-session, permission, 403, 404, 410, and 500 states in PT-BR and English at 1440, 960, 390, and 320 CSS pixels. No route may retain placeholder, preview-demonstration, illustrative-price, fixture, phase, adapter, or internal-evidence wording in ordinary UX.
- **D-101:** Phase 4 remains the authority boundary for real identity, billing, subscription, device binding/reset, support submission, and administration. Phase 3 may make every journey visually and editorially final, but all terminal actions remain deterministic no-change previews with the disconnected authority encoded outside the customer-facing copy.
- **D-102:** The final Home borrows commercial intensity, not visual identity or wording, from BravoBoost. Its canonical sequence is: benefit-led hero; large legible real product demonstration; player pain and transformation; Analyze → Optimize → Prove; a visually dominant Competitive Mode chapter; real evidence/methodology; authentic social proof only when evidence exists; Free versus Premium decision; safety/restoration; FAQ; strong final acquisition CTA; and the expanded footer. The hero promise is equivalent to “Play with the performance your hardware can actually deliver,” with `Download and analyze my PC` as the primary action, `See real results` as the secondary action, and a compact trust line covering free start, Windows 10/11, and reversible changes.
- **D-103:** D-47 is superseded for customer-facing account navigation. The final goal-oriented account information architecture is Home, PCs and licenses, Plan and payments, Security and privacy, and Help. Profile moves to the identity menu, invoices live under payments, and downloads live with the product/PC journey. The account overview must answer within five seconds: current plan, linked PC, security state, and one recommended action.
- **D-104:** Account status is coherent and singular. It must never simultaneously present Premium and “no active billing,” an attached PC and an activation CTA, or a signed-in shell with public sign-in/sign-up prompts. Customer copy names outcomes and next actions; specification language such as responsibility, immutable result, remote alteration, adapter, fixture, authority boundary, or decision safety is confined to explicit technical/legal detail.
- **D-105:** Admin is an operational decision tool, not a governance preview. It includes global search, one primary queue with filters and saved views, priority, SLA, case age, owner, localized last event, and a contextual evidence panel containing history, consent, impact, and permitted actions. ISO timestamps and correlation identifiers appear only in audit detail. High-risk work remains available at every supported zoom through a vertical review flow; no viewport or 200% zoom state may hide required controls.
- **D-106:** Public Terms, Privacy, Security, and responsible-disclosure content becomes launch-ready, versioned, plain-language legal content covering controller/contact, legal bases by purpose, retention, processors/subprocessors, international transfers, data-subject rights, consent and revocation, essential authentication storage, and separate optional telemetry, support-diagnostic, and AI consent. Publication remains subject to professional legal review. No cookie banner appears while only strictly necessary storage exists.
- **D-107:** A localized `/about` route tells the real Liiiraa Boost story: the gaming-performance problem that motivated the product, the principle of measurable gains without sacrificing stability, local-first trust, reversibility, and the long-term product ambition. It must not invent founder biography, customer counts, dates, awards, partners, or traction.
- **D-108:** The final footer is a complete utility and trust layer with localized groups: Product (How it works, Your PC, Results, Plans, Download), Resources (Documentation, Help, Releases, Status), Company (Our story, principles/contact), and Legal (Terms, Privacy, Security, essential storage, responsible disclosure). Its closing row contains the concise brand promise, flag-plus-language locale control, copyright/version disclosure, and one discreet acquisition CTA without recreating the header.
- **D-109:** The authenticated privacy center exposes separate, understandable consent controls for telemetry, support diagnostics, and personalized AI; shows purpose, data classes, retention, sharing, current state, consent history, revocation effect, and the data-rights path; and preserves the Phase 4 no-mutation boundary without making the ordinary experience read like a prototype.
- **D-110:** No testimonial, benchmark gain, customer count, review score, hardware result, company milestone, security certification, or operational metric may be fabricated for commercial impact. When authentic proof is unavailable, use product evidence, methodology, transparent limitations, or an explicitly labeled unavailable/coming-later state instead of placeholder social proof.

### The agent's Discretion

- Choose exact component boundaries, Next.js route-group layout, breakpoint values, cache behavior, state-machine decomposition, and test partitioning while preserving all locked surface, truth, security, and completeness decisions.
- Refine typography within the existing Liiiraa Boost identity and committed font licenses; retain the two-voice human/data rule and avoid reflexive AI-design font choices.
- Choose exact atmospheric treatment and motion choreography for the approved Command Runway + Evidence Stage direction, subject to reduced motion, performance, contrast, and the prohibition on fabricated product imagery.
- Choose the precise development scenario families and fixture content used to prove each web route, provided the scenario catalog is closed, deterministic, typed, and unavailable to ordinary production users.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and phase contract

- `.planning/ROADMAP.md` — Phase 3 goal, dependency, success criteria, and WEB-01/02/03/08 assignment.
- `.planning/REQUIREMENTS.md` — authoritative web, identity, device, privacy, accessibility, and cross-phase requirement boundaries.
- `.planning/PROJECT.md` — core value, trust model, global launch, constraints, active requirements, and out-of-scope behavior.
- `PRODUCT.md` — product positioning, audiences, brand personality, anti-references, design principles, and accessibility expectations.
- `DESIGN.md` — “Pre-Dawn Flight Deck” direction, signal rarity, neutral surfaces, typography voices, motion, elevation, and visual prohibitions.
- `.impeccable/critique/2026-08-03T06-54-13Z__authenticated-surfaces-and-footer.md` — scored account/admin baseline, P0 responsive finding, navigation/copy diagnosis, legal gaps, and approved footer direction.

### Upstream desktop experience

- `.planning/phases/02-complete-desktop-experience/02-CONTEXT.md` — locked fixture, preview, truth, consent, localization, and future-authority decisions inherited by web.
- `.planning/phases/02-complete-desktop-experience/02-UI-SPEC.md` — canonical desktop visual, interaction, state, route, accessibility, scenario, and acceptance contract whose real product captures feed the Home.

### Architecture and truth boundaries

- `architecture/decisions/0003-module-ownership-and-direction.md` — module ownership, public roots, dependency direction, and activation rules for new web boundaries.
- `architecture/decisions/0004-truth-provenance-and-fixture-boundary.md` — canonical provenance kinds and five fixture/production defenses.
- `architecture/decisions/0005-cross-cutting-acceptance-policy.md` — mandatory security, privacy, accessibility, performance, and recovery evidence dimensions.
- `architecture/module-boundaries.json` — executable authority for repository modules, layers, roots, runtime classes, and dependency policy.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/design-tokens/src/index.ts`: locked spacing, typography, color, radius, motion, status, scale, and accessibility token foundations for the web design system.
- `packages/design-system/src/index.ts`: public design-system root; web surfaces should extend authored Liiiraa Boost primitives rather than adopt a generic template library appearance.
- `packages/feature-shell/src/features/account-settings.tsx`: existing deterministic account, entitlement, support, update, documentation, privacy-consent, and phase-boundary patterns that web previews can adapt without importing desktop composition.
- `packages/contracts-ts/src/index.ts`: generated TypeScript transports and validators; future web adapters must consume this public root and extend the canonical TypeSpec source when a new cross-boundary contract is required.
- `apps/desktop`: real executable desktop surface, deterministic scenarios, browser/packaged tests, and product screenshots that should feed the web capture pipeline.

### Established Patterns

- Fixture identity is structurally distinct from production authority and must remain visibly labeled through composition, artifacts, and clean-process checks.
- React Aria supplies behavior behind authored Liiiraa Boost components; it is not the visual language.
- PT-BR/English localization, deterministic clocks, explicit UTC formatting, safe external navigation, consent separation, and complete degraded states are already established desktop patterns.
- Architecture and quality acceptance are executable policy, not informal review checklists.
- The repository currently has no `apps/web`, account web application, or `apps/admin`; Phase 3 must declare and activate their exact module boundaries before implementation.

### Integration Points

- Add the public/documentation/download, account, and admin compositions as explicit independently deployable modules with public roots and tested dependency directions in `architecture/module-boundaries.json`.
- Reuse design tokens and authored primitives, but create web-specific brand, documentation, account, and administrative compositions rather than reusing the desktop shell.
- Extend the canonical TypeSpec source for release manifests, route/deep-link identities, documentation/version identities, account/admin preview messages, and any durable cross-process or network document.
- Use deterministic desktop scenario capture as the only source for “real app” images and retain version/locale/scenario/viewport/provenance metadata beside every web asset.
- Connect public, account, and admin through safe contextual links; never share sensitive state merely to create visual continuity.

</code_context>

<specifics>

## Specific Ideas

- The Home should feel like a serious PC being prepared moments before a competitive session: powerful and cinematic, but controlled rather than theatrical.
- The approved hero copy is: **“Prepare seu PC. Prove o resultado. Restaure com controle.”**
- The strongest visual direction combines a bold asymmetric sales hero with an evidence-led product stage immediately below.
- The real desktop application is the hero artifact. Atmospheric imagery is supporting brand material and must not compete with or imitate the product.
- Mobile preserves the sales hierarchy: copy and compatibility CTA first, then responsive real-product details and access to the complete screenshot.
- Account is clear and approachable; admin is denser and operational. Neither may look like a generic SaaS dashboard.
- Copy must sell decisively through proof, compatibility, reversibility, and control—not miracle language, fear, pressure, invented gains, or hidden terms.

</specifics>

<deferred>

## Deferred Ideas

- Real email/social/passkey authentication, MFA authority, session issuance, account recovery, and security-method mutation — Phase 4.
- Real billing, invoices, subscription changes, entitlement reconciliation, device binding/reset, and checkout — Phase 4.
- Real support submissions, diagnostic upload/access, consent enforcement, and administrative mutations — Phase 4.
- Publicly trusted commercial signing, SmartScreen/reputation claims, staged public distribution, and production release promotion — Phase 10.

</deferred>

---

*Phase: 03-complete-web-experience*  
*Context gathered: 2026-07-30*
