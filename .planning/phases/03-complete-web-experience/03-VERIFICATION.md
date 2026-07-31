---
phase: 03-complete-web-experience
verified: 2026-07-31T15:58:15Z
status: gaps_found
score: 68/71 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "W01-W18 prove every route, link, state, locale, boundary, receipt, and error with no dead controls."
    status: failed
    reason: "The final verifier counts canonical route IDs but does not prove route reachability. Account 403/410/500 and admin 410 are declared in webRoutes yet are not implemented as distinct authored states; their catch-all guards reject error route IDs and fall through to 404."
    artifacts:
      - path: "apps/account/src/app/[locale]/[[...responsibility]]/page.tsx"
        issue: "isAccountPreviewRoute accepts only ten account responsibility IDs, so account-error-403, account-error-410, and account-error-500 resolve through notFound()."
      - path: "apps/account/src/account-errors.ts"
        issue: "AccountFailureKind implements only 404 and 500, and there is no explicit 500 route page; 403 and 410 have no authored model."
      - path: "apps/admin/src/app/[locale]/[[...workspace]]/page.tsx"
        issue: "isAdminPreviewRoute excludes admin-error-410, so /[locale]/errors/410 falls through to notFound()."
      - path: "apps/admin/src/admin-errors.ts"
        issue: "AdminFailureKind implements 403/404/500 but not the canonical admin 410 state."
      - path: "tooling/web-evidence/src/verify-phase.ts"
        issue: "PHASE_3_ROUTES validates closed-set presence in routes.ts, not executable route handling or HTTP outcome."
    missing:
      - "Implement localized, redacted, recoverable account 403, 410, and explicit 500 routes."
      - "Implement the localized, redacted, recoverable admin 410 route."
      - "Add browser assertions that each canonical error route renders its own status and does not collapse to 404."
      - "Make the final verifier consume route-reachability evidence instead of accepting manifest membership alone."
  - truth: "Every locked D-01 through D-86 decision has observed or executable final evidence and no deferred Phase 4/10 idea is implemented."
    status: failed
    reason: "D-25 requires distinct authored 404/403/410/500 states with safe recovery and forbids hiding failures. The missing account/admin error implementations make the claimed all-decisions evidence incomplete."
    artifacts:
      - path: ".planning/phases/03-complete-web-experience/03-CONTEXT.md"
        issue: "D-25 explicitly requires distinct authored 404, 403, 410, and 500 states."
      - path: "tooling/web-evidence/tests/account.spec.ts"
        issue: "W17 exercises only the account 404 route."
      - path: "tooling/web-evidence/tests/admin.spec.ts"
        issue: "W17 exercises admin 403/404/500 but omits admin 410."
    missing:
      - "Close D-25 on every canonical surface and extend W17/final evidence to cover all declared error states."
---

# Phase 3: Complete Web Experience Verification Report

**Phase Goal:** Visitors and future account users can traverse a polished, truthful web ecosystem whose public, account, and administrative surfaces are independently deployable and visually consistent with the desktop product.

**Verified:** 2026-07-31T15:58:15Z  
**Status:** gaps_found  
**Re-verification:** No — initial verification

## Goal Achievement

The primary public, documentation, release, account-preview, and admin-preview journeys are substantive, wired, independently buildable, truthfully labeled, and strongly tested. However, the phase's own route/error contract is not complete: four canonical account/admin error outcomes collapse into incomplete or 404 behavior. This falsifies two final PLAN truths even though the repository's final verifier passes.

### Observable Truths

| # | Plan | Truth | Status | Evidence |
|---:|:---:|---|---|---|
| 1 | 01 | No install before human review of the three SUS identities | VERIFIED | Approval record is human-bound to evidence hash/commit and predates the approved install scope. |
| 2 | 01 | Approval is exact-version/repository scoped | VERIFIED | `03-DEPENDENCY-APPROVAL.md` locks three exact identities and forbids substitutions/additions. |
| 3 | 02 | Seven web roots have unique ownership/layer/runtime reservations | VERIFIED | Canonical module graph and 46 passing architecture tests. |
| 4 | 02 | Public cannot depend on preview; admin is not a public route | VERIFIED | Live graph mutations reject production-to-fixture, cross-composition, deep-import, and duplicate ownership. |
| 5 | 03 | Critical routes/content/releases/receipts use one closed contract source | VERIFIED | `web.tsp` is imported by `main.tsp`; generated TS/Rust/schema artifacts drift-check cleanly. |
| 6 | 03 | Mutation/approved artifact cannot be represented without authority fields | VERIFIED | Literal false/unavailable contract fields and mutation tests. |
| 7 | 04 | Production core and fixture preview have separate roots/exports | VERIFIED | Separate manifests/public roots and enforced one-way dependency. |
| 8 | 04 | Neither package introduces an unapproved external identity | VERIFIED | Workspace-only runtime edges; supply-chain pin verification passes. |
| 9 | 05 | Shared UI and evidence tooling have different ownership/runtime classes | VERIFIED | `web-features` production vs `web-evidence` tooling boundaries. |
| 10 | 05 | Feature code consumes public production roots; tooling does not enter runtime | VERIFIED | Architecture graph and manifests enforce direction. |
| 11 | 06 | Public/docs/releases is independently buildable static-first production composition | VERIFIED | Fresh standalone build succeeded; 2,070 files under public standalone root. |
| 12 | 06 | Public manifest uses approved identities and no preview adapter | VERIFIED | Exact Next/MDX/intl pins; no `@liiiraa/web-preview` dependency. |
| 13 | 07 | Account is independently buildable and fixture-classified until Phase 4 | VERIFIED | Fresh standalone account build and literal disconnected fixture composition. |
| 14 | 07 | Account scaffold issues no session/mutation/shared cookie authority | VERIFIED | No cookies/mutations; proxy and E2E enforce disconnected authority. |
| 15 | 08 | Admin is a separate fixture deployable with no ordinary navigation edge | VERIFIED | Fresh distinct standalone build; no public/account navigation in artifact tests. |
| 16 | 08 | Admin exposes no auth/diagnostic/consent/mutation authority | VERIFIED | Strict proxy rejects cross-surface state; no uploads or remote mutations. |
| 17 | 09 | One generation command emits deterministic schema/TS/Rust transports | VERIFIED | Contract generation and drift tests pass for nine artifacts. |
| 18 | 09 | Existing desktop/shell schemas remain semantically unchanged | VERIFIED | Contract compatibility and desktop emitting consumer build pass. |
| 19 | 10 | Untrusted web documents validate before transport mapping | VERIFIED | TS/Rust validators invoke generated schema before narrowing/deserialization. |
| 20 | 10 | TS and Rust return equivalent bounded/redacted results | VERIFIED | Cross-language validation suites pass. |
| 21 | 11 | Seven roots are active, discovered, exact-pinned, and legal | VERIFIED | Workspace test graph and lockfile/architecture checks pass. |
| 22 | 11 | Public/account/admin check/test/build independently | VERIFIED | Fresh `pnpm web:build`: 10/10 tasks and three distinct BUILD_IDs. |
| 23 | 12 | One manifest owns public/docs/release/account/admin/error route identity | VERIFIED | Closed 53-route manifest and projection tests. |
| 24 | 12 | Navigation/sitemap/redirects/deep links are projections | VERIFIED | Route helpers and omission/mutation tests consume one manifest. |
| 25 | 13 | W01-W18 is closed, bilingual, deterministic, and fixture-only | VERIFIED | Scenario tests pass; final verifier reports 18 scenarios. |
| 26 | 13 | Phase 4 commands cancel/fail/no-change only | VERIFIED | Adapter tests prove abort, invalid, cancellation, failure, and schema-valid no-change behavior. |
| 27 | 14 | Each requirement has runnable five-dimension evidence | VERIFIED | Four final quality manifests resolve 20 evidence dimensions. |
| 28 | 14 | Missing route/content/release/security/visual/preview evidence fails | VERIFIED | Omission/mutation suites in `verify-phase.test.ts` and publication tests pass. |
| 29 | 15 | Public shell is static-first, bilingual, cacheable, and cookie/script-origin constrained | VERIFIED | Public build, headers, no cookie issuance, route tests; strict inline policy remains transparently report-only. |
| 30 | 15 | Navigation/sitemap/robots/alternates/404 derive from route manifest | VERIFIED | Indexing mutation tests and production metadata routes pass. |
| 31 | 16 | Account owns dynamic CSP/origin/noindex/cookie policy/shell/failures | VERIFIED | Nonce policy tests, private headers, distinct origin, 404/500 models. |
| 32 | 16 | Account persistently labels deterministic preview/disconnected authority | VERIFIED | Layout/provenance rail and E2E assertions. |
| 33 | 17 | Admin owns distinct strict policy/access boundary with no ordinary cross-link | VERIFIED | Proxy, access-boundary tests, and artifact scans pass. |
| 34 | 17 | Admin persists role and preview provenance | VERIFIED | Role-scoped shell and E2E coverage. |
| 35 | 18 | Surfaces share authored tokens/status/accessibility without shared authority | VERIFIED | Shared token/component package, distinct shells, detector clean, automated a11y evidence. |
| 36 | 18 | Brand/product registers are visibly related and not generic templates | UNCERTAIN | Screenshots and anti-pattern scan are strong, but visual polish/consistency has no explicit human sign-off. |
| 37 | 19 | Only valid bilingual/current/evidenced route-owned content is public/searchable | VERIFIED | Admission mutation tests pass. |
| 38 | 19 | Search respects locale/version/availability/indexing and excludes preview/private data | VERIFIED | Search tests and W06 browser assertions. |
| 39 | 20 | Home sells through evidence/recovery without invented gain or urgency | VERIFIED | Truth-copy scan and W01/W02 tests; no deceptive percentage/urgency claims. |
| 40 | 20 | Compatibility CTA and admitted real desktop capture dominate proof | VERIFIED | Capture sidecars/hashes and Home E2E/screenshot evidence. |
| 41 | 21 | Product/evidence/plans/search/support/policies/status/errors are bilingual | VERIFIED | Public catalog content, route builds, and browser tests. |
| 42 | 21 | Plans expose limits and commercial terms before simulated confirmation | VERIFIED | Bilingual policy/catalog content and admission tests. |
| 43 | 21 | Public 403/410/500 are distinct authored recoverable states | VERIFIED | W17 browser test exercises four public errors and redaction. |
| 44 | 22 | Docs resolve exact locale/version/channel/task/section and preserve history | VERIFIED | Documentation resolver/search tests pass. |
| 45 | 22 | Desktop contextual links accept canonical compatible sections only | VERIFIED | Unsafe/stale/unknown link tests fail closed. |
| 46 | 23 | Visitors traverse current/historical task-led docs in both locales | VERIFIED | 16-record parity corpus and W03-W05 browser tests. |
| 47 | 23 | Mobile preserves docs controls/evidence/risk/recovery | VERIFIED | 320/390 reflow and accessibility evidence. |
| 48 | 24 | Release metadata may exist while Phase 3 artifact stays blocked | VERIFIED | 57 release policy tests; current record returns distribution-not-approved. |
| 49 | 24 | Missing/mismatched trust fields have no bypass branch | VERIFIED | Exhaustive integrity disagreement tests and no-continue E2E. |
| 50 | 25 | Visitors inspect channels/notes/compatibility/integrity without dev installer | VERIFIED | Release routes, artifact scans, and W07/W08. |
| 51 | 25 | Visible Phase 3 journey terminates at localized blocking gate | VERIFIED | No executable links; gate asserts unavailable approval/artifact. |
| 52 | 26 | Sensitive preview journey follows guarded review-to-authority sequence | VERIFIED | 20 workflow tests exercise state transitions and receipts. |
| 53 | 26 | Illegal/ambiguous/stale/offline/consent cases fail closed and preserve safe work | VERIFIED | Statechart transition tests and safe-draft allowlist. |
| 54 | 27 | Every account responsibility/degraded state is traversable with provenance | VERIFIED | W11 covers all ten responsibility routes; account tests pass. |
| 55 | 27 | Account confirmations end in cancellation/no-change receipts | VERIFIED | W10/W13 and adapter tests; zero mutation requests. |
| 56 | 28 | Admin roles see scoped deterministic navigation/data only | VERIFIED | Role matrix and admin tests. |
| 57 | 28 | Diagnostics require scoped consent; critical actions end in no-change/audit | VERIFIED | W14/W15 and immutable audit/receipt assertions. |
| 58 | 28 | Mobile preserves safe review and blocks high-risk admin below 960px | VERIFIED | W16 and responsive policy tests. |
| 59 | 29 | Published product images come from deterministic desktop capture with provenance | VERIFIED | Bilingual image/sidecar hashes and approved S01 capture manifest. |
| 60 | 29 | Framing cannot alter values/copy/provenance; stale captures fail | VERIFIED | Capture invalidation/checksum tests pass. |
| 61 | 30 | W01-W18 prove every route/state/error with no dead controls | FAILED | Canonical account 403/410/500 and admin 410 are not distinct executable states; final verifier only counts IDs. |
| 62 | 30 | Three apps pass accessibility/responsive/visual/security/performance gates | VERIFIED | 18 goldens, zero blocking Axe findings, reflow/forced-colors/reduced-motion/CWV evidence. |
| 63 | 30 | Built artifacts expose no scenarios/private indexes/dev installers/authority | VERIFIED | Artifact scans and security E2E. |
| 64 | 31 | Publication admits code/content/routes/manifests/assets/evidence atomically | VERIFIED | Publication and bundle tests pass. |
| 65 | 31 | Any declared publication-axis failure blocks | VERIFIED | 30 publication tests cover mutation failure classes. |
| 66 | 31 | Rollback selects one approved immutable bundle, not external-data revert | VERIFIED | Nine rollback tests pass. |
| 67 | 32 | Visitor understands product/evidence/capabilities/plans/limits truthfully | VERIFIED | WEB-01 evidence and inspected public content. |
| 68 | 32 | Visitor reads versioned docs through exact desktop links | VERIFIED | WEB-02 resolver/E2E evidence. |
| 69 | 32 | Visitor completes integrity/compatibility verification while download is blocked | VERIFIED | WEB-03 policy/E2E evidence. |
| 70 | 32 | Three apps build independently, differ by policy, and label disconnected previews | VERIFIED | Fresh builds, proxy policies, composition identities, and E2E. |
| 71 | 32 | Every D-01–D-86 decision has observed/executable evidence | FAILED | D-25 is not closed on account/admin error routes despite the verifier reporting 86 decisions. |

**Score:** 68/71 truths verified; 2 failed; 1 requires human visual review.

### Required Artifacts

The canonical artifact probe found **63/63 artifacts present and substantive**. Level-3 wiring and Level-4 data flow were then traced manually for runtime artifacts.

| Plans | Artifact group | Status | Wiring/data evidence |
|---|---|---|---|
| 01–03 | Approval, architecture, TypeSpec source | VERIFIED | Approval→evidence hash; architecture tests→module graph; `main.tsp`→`web.tsp`. |
| 04–08 | Four packages and three app manifests/configs | VERIFIED | Public excludes preview; account/admin explicitly consume fixture adapter; standalone outputs observed. |
| 09–11 | Generated schema/transports/validators/lock/root scripts | VERIFIED | One-source generation, cached validators, exact lock identities, terminating lifecycle. |
| 12–14 | Routes/content/scenarios/evidence harness | VERIFIED | Manifest projections, runtime validation, W01-W18 frozen catalog, four quality manifests. |
| 15–18 | Public/account/admin shells and shared semantic UI | VERIFIED | Layouts import composition identities; proxy policies protect live app route trees; shared tokens/components render across shells. |
| 19–25 | Admission/search/Home/catalog/docs/releases | VERIFIED | Repository content → admission/resolvers → page rendering; release record → decision engine → blocking gate. |
| 26–28 | Preview machine/account/admin workflows | VERIFIED | Fixture authority injected into guarded machine; terminal no-change receipts render in both apps. |
| 29–32 | Captures, browser evidence, publication, final verifier | PARTIAL | Assets/evidence/builds exist and verifier runs, but final route-reachability evidence is incomplete for D-25. |

### Key Link Verification

| Result | Count | Details |
|---|---:|---|
| Automated VERIFIED | 27/32 | Declared source→target patterns found. |
| Manual VERIFIED after matcher false negative | 5/32 | 03-01 exact approval identities; 03-03 `main.tsp` import; 03-06 exact Next pin; 03-10 schema import; 03-11 lock/approval parity. |
| Runtime wiring gap beyond declared PLAN link | 1 concern | Canonical error IDs are not connected to distinct account/admin renderers; this is the blocker above. |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Status |
|---|---|---|---|
| Public Home/catalog | Bilingual claims, limitations, policies | Repository JSON → `admitContentBundle` → page compositions | FLOWING |
| Documentation | Versioned records/search/deep links | MDX + metadata → resolver/search → docs routes | FLOWING |
| Releases | Release metadata and integrity state | Validated `ReleaseRecord` → `decideDownload` → exhaustive gate UI | FLOWING, fail-closed |
| Account preview | W10–W13 scenario state | Frozen scenario → fixture authority → workflow machine → receipt UI | FLOWING, simulated label persistent |
| Admin preview | W14–W16 role/consent/audit state | Frozen scenario/role → guarded workflow → immutable simulated audit/receipt | FLOWING, simulated label persistent |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Final recursive Phase 3 evidence | `pnpm web:verify:phase -- --mode final` | Fingerprint `423389…970a2`; 86 decisions, 53 routes, 18 scenarios | PASS, but route-count semantic gap found manually |
| Workspace regression | `pnpm test` | Turbo 49/49 tasks successful | PASS |
| Web-core release/docs behavior | `pnpm --filter @liiiraa/web-core test ...` | 97/97 package tests pass | PASS |
| Raw-source Turbopack + NodeNext split | `vitest run src/source-import-resolution.test.ts` | 3/3 pass | PASS |
| Desktop emitted-contract compatibility | `pnpm --filter @liiiraa/desktop-production-reference build` | TypeScript emit succeeds | PASS |
| Independent production builds | `pnpm web:build` | 10/10 tasks; public/account/admin standalone roots freshly generated | PASS |
| Repository quality aggregate | `pnpm verify` | Fails at ESLint with 68 errors | WARNING |

### Probe Execution

Step 7c: **SKIPPED** — no Phase 03 probe script or declared `probe-*.sh` exists.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| WEB-01 | Truthful product/evidence/capability/plan/limitation understanding | SATISFIED | Bilingual admitted content, no deceptive claims, W01/W02/W06/W09, Home/catalog/policy routes. |
| WEB-02 | Versioned technical docs linked from desktop | SATISFIED | Resolver/deep-link tests, 16-record bilingual corpus, W03–W05. |
| WEB-03 | Release/integrity/compatibility and fail-closed download eligibility | SATISFIED | Exhaustive release tests and W07/W08; no public installer. |
| WEB-08 | Separate deployment/security policies | SATISFIED | Three distinct standalone builds, origins, CSP/indexing policies, fixture labels, no shared cookie/authority. |

All four Phase 03 IDs appear in PLAN frontmatter and REQUIREMENTS.md. No Phase 03 requirement is orphaned.

### Visual and Accessibility Technical Audit

The `impeccable` audit rules were applied to source CSS/components and representative W01/W02/W11/W14 goldens.

| Dimension | Score | Evidence |
|---|---:|---|
| Accessibility | 4/4 | Axe critical/serious = 0; keyboard focus, landmarks, 200% text, 400% zoom, forced colors, reduced motion covered. |
| Performance | 4/4 | CWV and route/image budgets are asserted; production builds pass. |
| Theming | 4/4 | Token-backed Pre-Dawn system, restrained cobalt, semantic non-color labels. |
| Responsive | 4/4 | 320/390/760/960/1440 evidence; no ordinary horizontal overflow; safe admin mobile policy. |
| Anti-patterns | 4/4 | Detector returned no hits; no gradient text, glassmorphism, decorative grid, oversized radii, or generic card-wall structure. |
| **Automated total** | **20/20** | Technical implementation is strong; subjective polish still needs human sign-off. |

### Anti-Patterns and Disconfirmation Findings

| Finding | Severity | Impact |
|---|---|---|
| Canonical error IDs counted without executable-route proof | BLOCKER | Lets final verifier pass while distinct account/admin errors collapse to 404. |
| `pnpm verify` fails with 68 ESLint errors | WARNING | Type/tests/builds pass, but the repository-wide quality command is not green; includes config `any`, deprecated `FormEvent`, and project-service coverage errors. |
| Public strict inline-free CSP remains report-only | INFO | Transparently disclosed; enforced CSP still contains `unsafe-inline` for current Next static bootstrap. |
| No TODO/FIXME/XXX debt markers in Phase 03 runtime files | PASS | `PLACEHOLDER_PATTERN` is route-template parsing, not incomplete work. |

Disconfirmation calibration:

- **Partial requirement:** visual polish/desktop consistency is evidenced by stable goldens and shared tokens but lacks explicit human approval.
- **Misleading passing test:** `verifyPhase3` validates the 53 route IDs in `routes.ts`, not that every route renders the declared outcome.
- **Uncovered error path:** account W17 covers only 404; admin W17 omits 410.

### Human Verification Required

#### 1. Cross-surface visual polish and desktop consistency

**Test:** After the missing error states are implemented, review public wide/mobile, account wide/reflow, and admin wide/mobile goldens beside the Phase 2 desktop captures.

**Expected:** The public brand register and account/admin product register feel intentionally related to the desktop product, remain distinctive rather than template-like, and preserve hierarchy/readability across PT-BR and English.

**Why human:** Screenshot stability, token reuse, and automated anti-pattern checks cannot certify subjective polish or brand coherence.

### Gaps Summary

The implementation achieves the four roadmap requirements and almost all planned behavior, but the phase cannot pass because its final “every route/every error” proof is observably false. Add distinct localized account 403/410/500 and admin 410 routes, extend W17/browser coverage, and make the final verifier depend on executable route evidence. After that, complete the human visual review. The 68-error repository lint backlog is a separate quality warning that should also be resolved before treating the full root verification command as green.

---

_Verified: 2026-07-31T15:58:15Z_  
_Verifier: the agent (gsd-verifier)_
