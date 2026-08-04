---
status: pending-human-approval
phase: 03-complete-web-experience
source: [03-VERIFICATION.md]
started: 2026-07-31T15:22:13-03:00
updated: 2026-08-03T21:36:43-03:00
---

# Phase 03 UAT

## Current Test

[pending-human-approval — the prior literal signal `aprovado` remains valid audit history only for fingerprint `2685ff26f5e65a89269a730e2257ab7ed149f1f8fad9d3e0d0f59f6f2445d42e`. A controlled consent-copy recapture changed eight canonical `account-privacy` candidates plus W13/W18, so those ten current byte identities require a renewed literal `aprovado`; Plan 03-46 and publication remain blocked.]

## Plan 03-45 Preflight

date: 2026-08-01T00:44:03-03:00
result: passed — automated stability only; human approval remains pending and every existing gap stays open.

| Command | Result |
| --- | --- |
| `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/accessibility-responsive.spec.ts` | PASS — 39 applicable tests passed, 312 project-matrix skips were expected; W01-W18 and G01-G07 replayed without update mode. |
| `rtk pnpm --filter @liiiraa/web build` | PASS — optimized Next.js webpack build and TypeScript completed. |
| `rtk pnpm --filter @liiiraa/account build` | PASS — isolated account build and TypeScript completed. |
| `rtk pnpm --filter @liiiraa/admin build` | PASS — isolated admin build and TypeScript completed. |
| `rtk pnpm test` | PASS — Turbo completed 49/49 workspace tasks. |
| `rtk pnpm --filter @liiiraa/admin exec vitest run src/admin-security.test.ts` | PASS — 13/13 admin boundary tests; document navigation remains localized HTML while bounded JSON is reserved for programmatic requests. |

## Plan 03-45 Preflight — Post-03-52

date: 2026-08-01T03:59:33-03:00
result: passed — automated stability only; human approval remains pending and every existing gap stays open.

| Command | Result |
| --- | --- |
| `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/accessibility-responsive.spec.ts` | PASS — 41 applicable tests passed and 328 project-matrix skips were expected; no update mode was used, and all 25 W01-W18/G01-G07 PNGs were confirmed present and non-empty. |
| `rtk pnpm --filter @liiiraa/web build` | PASS — optimized Next.js webpack build and TypeScript completed. |
| `rtk pnpm --filter @liiiraa/account build` | PASS — isolated account build and TypeScript completed. |
| `rtk pnpm --filter @liiiraa/admin build` | PASS — isolated admin build and TypeScript completed. |
| `rtk pnpm test` | PASS — Turbo completed 49/49 workspace tasks; 46 were served from cache. |

## Plan 03-45 Human Review Verdict

date: 2026-08-01T00:52:41-03:00
verdict: rejected — no W01-W18 or G01-G07 visual approval was granted; Plan 03-46 remains blocked.
reported: "ainda nao ficou legal nao nao tem cara de web app forte navegaçao ruim na troca de idioma tem q ser a bandeira e tals na area logada tbm tem q ser melhor e tals"
runtime_reported: "Console Error: eval() is not supported in this environment... React requires eval() in development mode... Next.js 16.2.12 (Turbopack)"

The clean preflight proves deterministic rendering and regression stability only. The reviewer explicitly rejected the qualitative result and reported these unresolved defects:

1. Public, account, and admin still lack one strong, authored Liiiraa Boost web-application identity.
2. Navigation is weak across the three surfaces; account/admin mobile navigation is especially poor and overlong instead of collapsing into a task-oriented pattern.
3. The locale switcher must preserve the current route and visibly combine a flag with the language label. The accessible name must contain language text because a flag alone is insufficient.
4. Logged-in account/admin surfaces need a stronger premium application shell, clearer hierarchy, useful density, and task-oriented navigation.
5. Development CSP conflicts with React/Next 16 Turbopack's eval-based debugging. Any `unsafe-eval` allowance must be development-only; production CSP must remain strict, and automated tests must prove the split.

## Plan 03-45 Human Review Verdict — Post-03-52

date: 2026-08-01T07:46:14-03:00
verdict: rejected — none of W01-W18 or G01-G07 received human visual approval; Plan 03-46 remains blocked and every existing visual gap stays failed.
reported: "gostei ainda nao olha https://app.bravoboost.com.br/ como e bem mais bonito td"
qualitative_reference: `https://app.bravoboost.com.br/` is a user-named reference for stronger overall beauty, finish, and composition only. It must inform the quality bar without copying its layout, branding, assets, wording, or proprietary expression.

## Plan 03-45 Human Review Verdict — Post-03-66

date: 2026-08-02T01:13:09-03:00
verdict: rejected — the reviewer supplied five screenshots and explicitly rejected the packet. None of W01-W18 or G01-G07 is approved; no publication authority exists and Plan 03-46 remains blocked.
scope: all 25 candidates are rejected as one review set. The screenshots specifically expose a catastrophic public landing failure, and that false-negative is sufficient to invalidate confidence in the shared visual/capture gate even though the reviewer did not cite individual account or admin pixels.
approval_boundary: `humanApproved`, `publicationApproved`, manifest approval state, screenshot bytes, and publication artifacts remain unchanged.

### Failure Classes

| Class | Severity | Human evidence |
| --- | --- | --- |
| Public stylesheet/composition parity | blocking | The shared header remains visibly styled while the authored landing composition appears absent or collapsed. The hero reads as raw, left-aligned, default-sized content without the intended measure, spacing, or focal geometry. |
| Header/full-page capture contamination | blocking | The sticky header duplicates or overlaps content during the long capture instead of remaining one stable, non-obstructing shell. |
| Product staging and narrative hierarchy | blocking | The desktop screenshot is pasted nearly full-viewport as a raw artifact, repeats later, and does not behave as one authored proof stage inside a coherent landing narrative. |
| Rhythm, disclosure, and content formatting | major | Long sparse ruled sections, very large dead regions, raw disclosure markers, collapsed label/value pairs such as `CompatívelA análise...`, and a plain unfinished footer/content treatment make the page read as broken documentation rather than a finished product. |
| Locale-control coherence | major | English locale UI is duplicated in `us English`-style output instead of one clear route-preserving flag-plus-language control. |
| Qualitative gate false negative | blocking | Plans 03-63 through 03-66 passed the same set that the human screenshots expose as systemically broken. Pixel stability, hashes, accessibility, and agent inspection did not prove runtime stylesheet parity or finished visual composition. |
| Cross-surface approval integrity | blocking | Because the shared review gate missed the public failure, account and admin cannot inherit approval from their prior non-human PASS records; all 25 identities require renewed human review after gate repair. |

### Mandatory Correction Route Before Any Re-capture

1. **Public source/style owner (`apps/web`)** — reproduce every reviewer screenshot at the same route, viewport, runtime mode, and source revision. Compare loaded CSS chunks, import order, DOM class bindings, computed styles, and bounding boxes for `public-header`, `home-ignition-hero`, `home-prepare-band`, `home-context-stage`, `home-compatibility-field`, and `home-release-ribbon`. Distinguish a source composition defect from stylesheet delivery/hydration/capture mismatch before changing pixels.
2. **Public composition owner (`apps/web/src/features/home.tsx`, `apps/web/src/app/public-shell.css`, `apps/web/src/styles/public.css`)** — correct hero measure/alignment/spacing, product-stage scale and repetition, section rhythm, label/value gaps, disclosure treatment, footer finish, and full-page sticky-header behavior. The product artifact must be staged as proof, not pasted as an uncontrolled raw viewport.
3. **Locale/shared-control owner (`apps/web/src/public-navigation.tsx`, `@liiiraa/web-features`)** — reproduce and remove duplicate `us English`-style output while preserving one visible flag-plus-language label, an explicit accessible language name, and the current route.
4. **Capture-parity owner (`tooling/web-evidence`)** — add fail-closed computed-style and geometry sentinels that fail if the authored landing stylesheet is absent, selectors fall back, header instances overlap, labels collapse, locale text duplicates, or the product stage becomes uncontrolled. Prove these sentinels fail against an intentionally missing/disabled authorial stylesheet.
5. **Inspection owners (03-63/64/65 and 03-66)** — treat their prior PASS records as non-human historical results only. After source and gate repair, inspect public/account/admin at original resolution again and confirm runtime/capture parity; do not infer an account/admin pixel defect that the reviewer did not name.
6. **Sequence owner** — do not run Plan 03-62 capture yet. First complete the root-cause investigation and gate-hardening work, then run the full `03-61 -> 03-62 -> 03-63/64/65 -> 03-66 -> 03-45` chain. Plan 03-46 stays blocked until a later literal `approved` response covers all 25 identities.

## Plan 03-45 Human Review Verdict — Route language and navigation

date: 2026-08-02T14:13:49-03:00
verdict: rejected — the public route set remains unapproved; Plan 03-46 remains blocked.
reported: "vamos melhorar as rotas ? muito termos tecnicos e tals ee sinto que da para melhorar e muitooooo tudo e no seletor te temos ainda nao esta as banderinhas"
scope: `/product`, `/evidence`, `/compatibility`, `/plans`, `/documentation`, and `/releases`, plus the shared public navigation and locale control in PT-BR and English.
approval_boundary: no candidate, manifest approval state, screenshot, or publication artifact is approved or promoted by this feedback.

The reviewer supplied seven route screenshots. They show a structurally styled but visitor-hostile public experience:

1. Primary headings and body copy expose internal validation, authority, origin, version, manifest, implementation, and phase vocabulary before explaining visitor benefit.
2. Product, evidence, compatibility, and plans share the same sparse document template instead of distinct task-led compositions and clear next actions.
3. Plans leaks `Fase 3`/`Fase 4` implementation chronology into commercial copy.
4. Documentation exposes raw identifiers such as `current`, `stable`, and English slugs as visible primary content.
5. Releases leads with generated-record and approval mechanics instead of a plain download-status explanation and safe visitor choices.
6. The locale control still renders `us English`-style text rather than one visible `🇧🇷 Português` / `🇺🇸 English` control with a full textual accessible name.
7. Dense technical evidence remains necessary for trust, but it must move into closed, contextual disclosures after the plain-language outcome and next action.

Mandatory correction: rewrite both locales around visitor task and benefit, remove phase/implementation chronology from ordinary copy, create route-specific hierarchy and CTAs, subordinate provenance/version/integrity detail to disclosures, and prove a route-preserving flag-plus-language locale control before any recapture.

## Plan 03-45 Preflight — Route language and navigation remediation

date: 2026-08-02T15:10:09-03:00
result: passed — automated and non-human visual inspection only. Human approval remains false; every prior UAT issue stays open until the reviewer evaluates the refreshed packet, and Plan 03-46 remains blocked.

| Command or gate | Result |
| --- | --- |
| Immutable rejected archive verification | PASS — 3/3 archived G01/G04/G06 hashes still match their recorded bytes. |
| Mechanical candidate update | PASS — exactly one 25-candidate update-mode execution completed; 45 applicable tests passed and 160 project-matrix skips were expected. |
| `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/accessibility-responsive.spec.ts` | PASS — 44 applicable tests passed, 161 project-matrix skips were expected, and no update mode was used. |
| Candidate inspection records | PASS — public 12/12, account 8/8, and admin 5/5 hashes, byte sizes, and dimensions match the current PNGs; all records remain `humanApproved: false`. |
| `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/motion-contract.spec.ts` | PASS — 5 applicable tests passed and 40 project-matrix skips were expected. |
| `rtk pnpm --filter @liiiraa/web-features exec vitest run src/components.test.tsx -t "qualitative-review metadata\|visual contract"` | PASS — 6 tests passed and 10 unrelated tests were skipped. |
| Public, account, and admin independent production builds | PASS — all three Next.js webpack builds and strict TypeScript gates completed. |
| `rtk pnpm test` | PASS — Turbo completed 49/49 workspace tasks; public tests passed 95/95 and web-features passed 36/36. |

### Remediation presented for review

- Public navigation now uses visitor goals: `Como funciona`, `Como comprovamos`, `Seu PC`, `Planos`, `Ajuda`, and `Baixar`, with localized English equivalents.
- Locale controls preserve the current route and render one inline graphical Brazil or United States flag with a full language label and accessible name; emoji rendering is not relied upon.
- Product, proof, compatibility, plans, documentation, and releases lead with plain visitor outcomes and next actions; advanced provenance, integrity, and error-code material is subordinate or disclosed contextually.
- Documentation search leads with `Como podemos ajudar?`, groups primary goals under `Escolha o que você quer fazer`, and keeps technical/error-code navigation secondary.
- Account and admin retain their task-first shells and graphical route-preserving locale controls; publication and remote authority remain unavailable in preview.

## Plan 03-72 Complete Route Matrix Preflight

date: 2026-08-03T02:56:04-03:00
result: passed — automated stability and bounded non-human visual inspection only. Human approval remains false, the prior review issues remain open for renewed review, and Plan 03-46 remains blocked.

| Command or gate | Result |
| --- | --- |
| `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/final-route-experience.spec.ts` | PASS — 18 applicable route-matrix cases passed, 144 project-axis skips were expected, and every canonical public, account, and admin destination was observed in PT-BR/English at its required width/state. |
| Original-resolution candidate inspection | PASS — 25/25 W01-W18 and G01-G07 records match their current PNG hashes, dimensions, locale, route, viewport, state, and brand/product register; `humanApproved: false` and `publicationApproved: false`. |
| `rtk pnpm --filter @liiiraa/web-evidence exec playwright test` | PASS — 272 applicable tests passed and 665 project-axis skips were expected across 937 matrix cases; CSP, accessibility, navigation, locale, motion, forced colors, reflow, screenshots, and isolated origins closed with zero failures. |
| Canonical route reachability replay | PASS — 24/24 localized public/account/admin 403/404/410/500 outcomes were regenerated through the allowlisted writer with current source hashes and `status: passed`. |
| `rtk pnpm test` | PASS — Turbo completed 49/49 workspace tasks; web 108/108, account 59/59, admin 60/60, web-core 110/110, and web-evidence 142 passed with one intentionally skipped CLI capture test. |
| `rtk pnpm web:verify:phase -- --mode planned` | PASS — Phase 3 planned-mode verification closed 101 decisions, 57 routes, 24 observed route outcomes, and 18 scenarios. |
| Production builds and `/download` route | PASS — web/account/admin production builds completed; Next generated `/pt-BR/download` and `/en/download` as localized SSG routes, while executable distribution remained gated. |
| Impeccable detector | PASS — zero banned visual-pattern findings across the changed UI sources. |

### Exact renewed review index

| Review group | Candidate identities |
| --- | --- |
| Public acquisition | W01, W02, G01, G02 |
| Documentation, search, download, releases, and service | W03, W04, W05, W06, W07, W08, W09 |
| Authentication and first account entry | W10 |
| Signed-in account and profile/privacy | W11, W12, W13, W18, G03, G04, G05 |
| Administration and role-scoped workflows | W14, W15, W16, G06, G07 |
| Error and degraded-state emphasis | W04, W05, W06, W07, W08, W09, W12, W15, W16, W17, W18 |
| Mobile and 320px reflow emphasis | W02, W16, W18, G02, G03, G05, G07 |

Approval boundary: this preflight does not approve pixels, publish candidates, create a publication bundle, execute Plan 03-46, or change any prior human verdict. Plan 03-45 must still receive an explicit human decision over the exact current 25-candidate packet.

## Plan 03-82 Final QA and Complete Pending-Review Packet

date: 2026-08-03T15:30:00-03:00
result: passed — clean builds, complete automated regressions, current route evidence, and exact candidate bindings passed. This is an automated stability result only: every prior human rejection is preserved, `humanApproved` and `publicationApproved` remain false, and Plan 03-46 remains blocked.

### Canonical candidate matrix

| Dimension | Bound result |
| --- | --- |
| Total candidates | 464 original-resolution PNGs |
| Canonical routes | 58 |
| Locales | 232 PT-BR and 232 English candidates |
| Widths | 1440, 960, 390, and 320 CSS pixels for every route/locale identity |
| Surfaces | 248 public, 128 account, and 88 admin candidates |
| States | 368 ready and 96 error-state candidates |
| Candidate binding | `401369ededbe239dc526f2776bac5172507b352a2dfa2288bacee31fbbc4131f` |
| Inspection | 464/464 records match route, locale, width, state, dimensions, byte length, and SHA-256 |
| Approval boundary | `status: pending-human-approval`, `humanApproved: false`, `publicationApproved: false` |

The original-resolution launch-readiness inspection at `visuals/candidate-inspections/03-76-launch-readiness.json` records D-102 through D-110 as `pass`. Those detector verdicts prove the authored contract and candidate integrity; they do not substitute for the reviewer's visual judgment.

### Legacy W01-W18/G01-G07 continuity

| Gate | Result |
| --- | --- |
| Controlled refresh | PASS — 23 screenshots refreshed and W10/G05 remained byte-stable |
| Aggregate 25-image binding | `68620cf4259a074bc0feaba10dc777ffdf58a2700023ddf2b984d80e0d80ccfd` |
| Controlled update replay | PASS — 45 applicable tests passed and 160 project-matrix skips were expected |
| Exact no-update replay | PASS — 44 applicable tests passed and 161 project-matrix skips were expected |

### Final verification

| Command or gate | Result |
| --- | --- |
| Public, account, and admin production builds | PASS — all three independent Next.js builds and strict TypeScript gates completed. |
| Complete canonical Playwright matrix | PASS — all 464 current route/locale/width/state screenshots matched without update mode. |
| Legacy accessibility/responsive Playwright suite | PASS — 44 applicable tests passed and 161 expected project-matrix skips remained. |
| React/Turbopack development CSP gate | PASS — development permits the required eval-based React debugging path; production remains strict and excludes `unsafe-eval`. |
| Workspace regression | PASS — Turbo completed 49/49 tasks. Web: 119 passed; account: 68; admin: 76; web-core: 111; web-evidence: 151 passed with one intentional skip; web-features: 41. |
| Planned phase verification | PASS — 110 decisions, 58 routes, 24 observed route outcomes, 18 scenarios; hash `9ae46bffb42c9083fb900b064539ea00780f8dda54cc8d83837aa6395b412370`. |
| Route reachability | PASS — all 24 localized 403/404/410/500 outcomes remain current and writer-owned. |

### Exact current human-review scope

- Review the complete 464-candidate route matrix as the canonical launch-readiness packet.
- Use W01-W18 and G01-G07 only as named continuity shortcuts into representative public, account, admin, authentication, degraded-state, and responsive compositions.
- Review the public Home as the primary commercial experience: product desire, real desktop proof, Free/Premium clarity, safety/recovery, competitive-mode explanation, FAQ, conversion action, and launch-grade footer.
- Preserve all earlier issue reports until the reviewer explicitly accepts the renewed result. No automated pass rewrites or erases those historical verdicts.

Approval boundary: Plan 03-82 does not create `03-45-SUMMARY.md`, approve any candidate, mutate publication artifacts, promote a bundle, or execute Plan 03-46. A later literal human verdict must decide the current packet.

## Quick 260803-n0d Legal, Trust, Documentation, and Principles Remediation

date: 2026-08-03T18:56:26-03:00
reviewer verdict: rejected then remediated — the reviewer reported generic draft-like legal copy, duplicate Storage/Privacy destinations, a broken Quick Guides label, and a Principles destination that still behaved like Our Story. During live review, the first independent Principles route rendered with catastrophic column overlap. None of those reports grants visual or publication approval.

reported:

- "os termos ainda muito generico ... para deixaar claro eu autorizo a vc a fazer os textos finais use um agente de direito"
- "a rota de principios mostra a rota de nossa historia ainda ?"
- Screenshot evidence showed `/pt-BR/principles` with four compressed, overlapping columns.

### Remediation delivered

- A dedicated legal research/writing agent produced complete PT-BR and English pre-launch Terms, Privacy, Security, Essential Storage, and Responsible Disclosure documents from official LGPD/ANPD, Marco Civil, consumer, GDPR/EDPB, CISA/CERT, and ISO disclosure sources.
- Every draft/review banner was removed. No entity, CNPJ/registration, address, forum, processor, certification, audit, bounty, security guarantee, or SLA was invented.
- Essential Storage now owns `/[locale]/policies/essential-storage`; it no longer aliases Privacy.
- Principles now owns `/[locale]/principles`; Our Story remains `/[locale]/about`.
- The broken Principles grid received a dedicated two-column wide composition and one-column reflow below 960px, with overlap sentinels at 1440, 960, 390, and 320.
- Quick Guides wrapping, focus, and 44px target geometry were corrected.
- The fail-closed admission contract now fixes `kind -> routeId`, section order/IDs, PT-BR/English parity, temporal status, and evidence provenance for all 488 legal claims.

### Renewed canonical packet

| Dimension | Bound result |
| --- | --- |
| Canonical routes | 60 |
| Total candidates | 480 original-resolution PNGs |
| Locales | 240 PT-BR and 240 English candidates |
| Widths | 120 each at 1440, 960, 390, and 320 CSS pixels |
| Surfaces | 264 public, 128 account, and 88 admin candidates |
| States | 384 ready and 96 error-state candidates |
| Legal provenance | 244 claims per locale, 488/488 covered |
| Candidate integrity | 480 manifest records and 480 inspections; zero hash, byte, dimension, route, locale, width, state, or approval divergence |
| Evidence fingerprint | `2685ff26f5e65a89269a730e2257ab7ed149f1f8fad9d3e0d0f59f6f2445d42e` |
| Approval boundary | `status: pending-human-approval`, `humanApproved: false`, `publicationApproved: false` |

### Independent verification

- Quick verifier: PASS, 6/6 must-haves.
- Controlled public candidate recapture: 264/264 passed.
- Exact no-update public replay: 264/264 passed.
- Integrated route/browser matrix: 268 passed, 20 non-applicable skips, zero failures.
- `@liiiraa/web-core`: 112/112; `@liiiraa/web`: 125/125; web-evidence: 151/151 plus one intentional skip.
- Documentation Playwright: 3/3; Principles geometry/reflow: 4/4 widths.
- Planned phase verifier: 110 decisions, 60 routes, 24 observed route outcomes, 18 scenarios.

### Publication boundary

The documents are final public-facing pre-launch copy, but are not approved as policies currently in force. Plan 03-46 must still verify the formal supplier/controller identity, required registration/address details, real processors/transfers/retention, affirmative acceptance and commercial conditions, and provisioned/authenticated/monitored contact channels. This remediation does not create checkout, data collection, backend authority, email delivery, legal approval, candidate approval, or publication authority.

## Plan 03-45 Human Approval — Exact Post-Remediation Packet

date: 2026-08-03T19:47:00-03:00
reviewer_signal: `aprovado`
verdict: approved — the human visual checkpoint is satisfied only for the exact canonical packet identified below.

| Approval dimension | Exact bound value |
| --- | --- |
| Canonical routes | 60 |
| Candidates | 480 original-resolution PNGs |
| Locales | 240 PT-BR and 240 English candidates |
| Widths | 1440, 960, 390, and 320 CSS pixels for every route/locale identity |
| Surfaces | 264 public, 128 account, and 88 admin candidates |
| States | 384 ready and 96 error-state candidates |
| Evidence fingerprint | `2685ff26f5e65a89269a730e2257ab7ed149f1f8fad9d3e0d0f59f6f2445d42e` |
| Exact reviewer signal | `aprovado` |

### Approval boundary

- This approval applies only to the 60-route/480-candidate canonical packet with the exact fingerprint above. It does not approve a later recapture, changed hash, additional route, different locale/width/state, or any unbound artifact.
- W01-W18/G01-G07 remain legacy continuity evidence. Every earlier human rejection and its reported defect remains preserved below as historical audit evidence; the current signal does not retroactively approve those old packet identities or erase their diagnoses.
- No canonical 480-candidate manifest, candidate JSON, canonical screenshot byte, `humanApproved` field, `publicationApproved` field, publication report, rollback bundle, or deployment artifact is mutated by this checkpoint record.
- The visual human gate for Plan 03-45 is complete, but publication is not authorized. Plan 03-46 remains legally and operationally blocked from promotion until it verifies the formal supplier/controller identity, registration and address details, real processors/transfers/retention, affirmative acceptance and commercial conditions, and provisioned/authenticated/monitored contact channels.
- The bilingual consent-copy adjustments and synchronized W03-W05 legacy continuity PNGs committed with this record do not enlarge the approved canonical fingerprint or confer legal, commercial, backend, checkout, data-collection, email-delivery, or publication authority.

The `Tests`, `Summary`, and `Gaps` sections below are retained as the immutable history of the previously rejected packets. They are not the verdict for the exact post-remediation packet approved in this section.

## Plan 03-46 Approval-Renewal Amendment

date: 2026-08-03T21:36:43-03:00
verdict: pending-human-approval — the previous literal `aprovado` does not cover ten screenshot byte identities changed by the later controlled consent-copy recapture. Plan 03-46 remains blocked and no report or publication bundle may be promoted.

### Scope of the changed evidence

- The canonical route matrix remains exactly 60 routes and 480 candidates with the same route, locale, width, surface, and state cardinalities.
- Eight canonical `account-privacy` PNGs changed: PT-BR and English at 1440, 960, 390, and 320 CSS pixels.
- Two legacy continuity PNGs changed: `W13-account-final-wide-1280.png` and `W18-account-final-reflow-320.png`.
- The canonical writer changed only `sourceHash` in those eight manifest records. The launch-readiness inspection changed only `sourceHash`, `bytes`, `dimensions`, and `sha256` in the corresponding eight records.
- The bounded no-update replay of the ten recaptured identities passed 10/10. That automated result proves deterministic replay only; it does not grant human or publication approval.
- The exact ten current identities, paths, hashes, byte counts, and dimensions are recorded in `visuals/candidate-inspections/03-46-renewed-approval-scope.json`.

### Renewal verification

| Gate | Result |
| --- | --- |
| `rtk pnpm --filter @liiiraa/web-evidence exec vitest run src/candidate-capture-selection.test.ts src/launch-readiness.test.ts` | PASS — 2 files and 5 tests; canonical selection, cardinality, current hashes, and launch-readiness inspection remain aligned. |
| `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/final-route-experience.spec.ts tests/accessibility-responsive.spec.ts --grep "account--account-privacy--\|W13 canonical accessible visual\|W18 canonical accessible visual"` | PASS — exactly 10/10 current screenshot identities replayed without update mode. |
| Independent byte/cardinality replay of the schema-versioned wrappers and ten-record index | PASS — 60 routes, 480 canonical records, 25 legacy records, and 10 indexed changed identities matched the files on disk. |

### Reproducible current canonicalization

Both current digests use SHA-256 over the UTF-8 bytes of compact `JSON.stringify` output. The wrapper property order is exactly `algorithm`, `schemaVersion`, `records`, with `algorithm: "sha256"` and `schemaVersion: 1`. Sorting uses ascending UTF-16 code-unit order.

| Set | Record contract | Count | Current digest |
| --- | --- | ---: | --- |
| Canonical candidates | Sorted by `candidateId`; exactly `candidateId`, `snapshotPath`, `sha256` (equal to current `sourceHash`), `bytes`, `dimensions` in that property order | 480 | `fa594ae3b2bda7ab2d7bea8e475d45e52ee5e350362c6c9315a62c7199ad4f55` |
| Legacy continuity | Sorted by `filename`; exactly `filename`, `sha256`, `bytes` in that property order | 25 | `5c589ac20992b698a1e097ab92f15a7bd9072c8e99a8d01993709b354df341d6` |

### Historical binding preserved

- The previously approved canonical fingerprint `2685ff26f5e65a89269a730e2257ab7ed149f1f8fad9d3e0d0f59f6f2445d42e` remains the immutable identity of the earlier approved packet.
- The historical W01-W18/G01-G07 aggregate `68620cf4259a074bc0feaba10dc777ffdf58a2700023ddf2b984d80e0d80ccfd` remains immutable audit history.
- The historical digest formulas are not reproducible from the current recorded contract, so neither historical value is claimed as reproduced or replaced by the current schema-versioned digests.
- A new literal reviewer signal `aprovado` is required for the ten current byte identities before this UAT may return to `passed`. Even after renewed visual approval, the legal and operational publication boundary above remains independently applicable.

## Tests

### 1. Cross-surface visual polish and desktop consistency

expected: Public, account, and admin goldens in both locales have coherent branding, clear hierarchy/readability, and distinctive non-template visual quality when compared with the approved Phase 2 desktop captures.
result: issue
reported: "nao gostei de nenhum dos 3 viu"; follow-up: "ainda nao ficou legal nao nao tem cara de web app forte"
severity: major

### 2. Cross-surface navigation, locale switching, and authenticated shells

expected: Public, account, and admin provide clear current-location and task-oriented navigation; mobile account/admin navigation collapses without an overlong route list; locale switching preserves the current route and exposes a visible flag plus language label with an accessible textual name; logged-in shells feel like premium applications with deliberate hierarchy and useful density.
result: issue
reported: "navegaçao ruim na troca de idioma tem q ser a bandeira e tals na area logada tbm tem q ser melhor e tals"
severity: major

### 3. React/Next development CSP compatibility

expected: Next.js 16.2.12 development under Turbopack supports React's eval-based debugging without console failures, while production responses never allow `unsafe-eval`; tests prove the environment-specific CSP split.
result: issue
reported: "Console Error: eval() is not supported in this environment... React requires eval() in development mode... Next.js 16.2.12 (Turbopack)"
severity: major

### 4. Public route purpose, plain language, and flag locale control

expected: Every public route explains its visitor purpose and next action in plain PT-BR/English before technical detail; implementation chronology is absent; technical evidence is progressively disclosed; locale switching preserves the current canonical route and visibly renders `🇧🇷 Português` or `🇺🇸 English` with an accessible textual name.
result: issue
reported: "vamos melhorar as rotas ? muito termos tecnicos e tals ee sinto que da para melhorar e muitooooo tudo e no seletor te temos ainda nao esta as banderinhas"
severity: major

## Summary

total: 4
passed: 0
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The public Home presents a premium, focused Liiiraa Boost story coherent with the approved desktop product, without exposing internal boundary or evidence metadata as primary interface copy."
  status: failed
  reason: "The reviewer first reported `nao gostei de nenhum dos 3 viu` and, after the 03-38 through 03-44 gap work, explicitly rejected the refreshed result again: `ainda nao ficou legal nao nao tem cara de web app forte`. The public surface still lacks a strong authored web-app identity and its navigation/locale control do not provide the expected product-grade orientation."
  severity: major
  test: 1
  root_cause: "The refreshed public composition is deterministic but still fails the human quality contract: shell, hierarchy, and navigation read as a collection of web pages rather than one authored Liiiraa Boost application. The locale affordance changes language without the required route-preserving, visible flag-plus-label control, and pixel stability cannot certify identity or navigation quality."
  artifacts:
    - path: "apps/web/src/styles/public.css"
      issue: "Off-scale hero typography, oversized spacing, and excessive vertical rhythm create the sparse composition."
    - path: "apps/web/src/app/[locale]/layout.tsx"
      issue: "The shell permanently exposes the internal PUBLIC boundary and placeholder LB branding."
    - path: "apps/web/src/features/home.tsx"
      issue: "The Home duplicates trust messaging and prints raw capture provenance beside the hero artifact."
    - path: "tooling/web-evidence/tests/accessibility-responsive.spec.ts"
      issue: "Screenshot stability is checked against the rejected composition without an explicit quality approval gate."
  missing:
    - "Recompose the public Home around canonical scale, tighter pacing, the approved brand lockup, and a dominant real desktop artifact."
    - "Move origin and capture metadata into contextual disclosure while keeping truthful evidence accessible."
    - "Extend visual gates to app-local CSS and require named human approval for refreshed goldens."
    - "Create a strong authored public application shell with clear current-location and task-oriented navigation."
    - "Replace the locale link with a current-route-preserving control that shows a flag plus language label and retains an explicit accessible text name."
  debug_session: ".planning/debug/phase-03-public-visual-polish.md"

- truth: "The account surface feels like a finished premium product shell with strong task hierarchy, useful density, and a quiet but persistent simulated-authority boundary."
  status: failed
  reason: "The reviewer first reported `nao gostei de nenhum dos 3 viu` and explicitly rejected the refreshed account result again: `navegaçao ruim ... na area logada tbm tem q ser melhor`. The logged-in shell still lacks premium application hierarchy and useful density; navigation remains weak, and the mobile route list is especially poor and overlong."
  severity: major
  test: 1
  root_cause: "The account shell remains route-list-first instead of task-first. At narrow widths its navigation expands into a long wrapped/full-width list rather than a compact disclosure pattern, while the locale link targets a surface default instead of preserving the active responsibility route. The content shell still lacks enough hierarchy, density, and task context to read as a premium logged-in application."
  artifacts:
    - path: "apps/account/src/features/account-preview.tsx"
      issue: "Route compositions are skeletal and repeat provenance at route and field level."
    - path: "apps/account/src/app/[locale]/layout.tsx"
      issue: "Authority messaging is repeated and navigation lacks an explicit current-route cue."
    - path: "apps/account/src/app/account-shell.css"
      issue: "The main workspace is unconstrained and lacks authored wide-screen grouping."
    - path: "tooling/web-evidence/visual-manifest.json"
      issue: "Visual coverage represents only account overview and does not gate Profile or responsibility-route polish."
  missing:
    - "Create a constrained, authored product workspace with active navigation, focal identity/task regions, and route-specific density."
    - "Consolidate preview messaging into one quiet persistent boundary, repeated only for sensitive review and receipts."
    - "Add neutral-state goldens for Profile and representative responsibility routes with hierarchy and density review gates."
    - "Replace the overlong mobile route list with a compact accessible navigation disclosure that preserves current-location context."
    - "Make the locale control preserve the active account route and show a flag plus language label with explicit accessible text."
  debug_session: ".planning/debug/phase-03-account-visual-polish.md"

- truth: "The admin origin renders a designed, localized premium administration shell or authored access state instead of exposing raw transport data."
  status: failed
  reason: "The reviewer first reported `nao gostei de nenhum dos 3 viu` and explicitly rejected the refreshed admin result again: `navegaçao ruim ... na area logada tbm tem q ser melhor`. Even after the origin/access-state corrections, the authenticated admin shell still lacks a strong premium application identity, task hierarchy, useful density, and compact mobile navigation."
  severity: major
  test: 1
  root_cause: "The origin/access-state defect was addressed by the preceding gap plans, but the qualitative shell remains unresolved. Admin navigation is still presented as a broad route inventory instead of a role/task-oriented workflow, its narrow-screen form becomes overlong, and locale switching returns to a role landing rather than preserving the active workspace. Automated goldens prove stability, not premium operational coherence."
  artifacts:
    - path: "apps/admin/proxy.ts"
      issue: "Exact origin enforcement rejects the generic localhost UAT origin before the authored application route can render."
    - path: "apps/admin/src/admin-runtime.ts"
      issue: "The default dedicated admin origin is not aligned with the generic local launch used for visual review."
    - path: "apps/admin/package.json"
      issue: "The ordinary dev command does not configure the dedicated UAT hostname/origin contract."
    - path: "apps/admin/src/features/admin-preview.tsx"
      issue: "The role landing and operational workspaces are sparse and expose internal route-manifest language."
  missing:
    - "Align local/UAT launch and navigation with one declared dedicated admin origin and the canonical /[locale]/admin route."
    - "Preserve fail-closed security while rendering an authored localized access-denied document for browser navigation."
    - "Redesign and re-baseline the role landing and representative workspaces against the approved desktop visual contract."
    - "Replace the overlong mobile admin route list with a compact accessible role/task navigation pattern."
    - "Make the locale control preserve the active admin workspace and show a flag plus language label with explicit accessible text."
  debug_session: ".planning/debug/phase-03-admin-root-interface.md"

- truth: "Development CSP supports React and Next.js 16.2.12 Turbopack debugging without weakening the production security boundary."
  status: failed
  reason: "The reviewer reported `Console Error: eval() is not supported in this environment... React requires eval() in development mode... Next.js 16.2.12 (Turbopack)`. The current development policy blocks React's eval-based debugging path, so the review environment is not clean even though production must continue to reject eval."
  severity: major
  test: 3
  root_cause: "CSP construction is not split by runtime mode for the Next development toolchain. Public headers and the account/admin nonce policies omit `unsafe-eval` unconditionally, which is appropriate for production but conflicts with the reported React/Turbopack development behavior."
  artifacts:
    - path: "apps/web/next.config.ts"
      issue: "Public CSP directives do not expose a tested development-only script policy."
    - path: "apps/account/proxy.ts"
      issue: "Account nonce CSP is strict in every mode and needs an explicit, tested development-only branch if this surface reproduces the error."
    - path: "apps/admin/proxy.ts"
      issue: "Admin nonce CSP is strict in every mode and needs an explicit, tested development-only branch if this surface reproduces the error."
  missing:
    - "Reproduce and identify every affected Next development surface under Turbopack."
    - "Allow `unsafe-eval` only in development CSP where React debugging requires it; never emit it in production."
    - "Add tests that assert the development allowance and the production prohibition independently for public, account, and admin."
  debug_session: ".planning/debug/phase-03-development-csp-turbopack.md"
