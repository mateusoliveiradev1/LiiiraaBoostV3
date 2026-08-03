---
phase: quick-260803-n0d
plan: '01'
subsystem: web-trust
tags: [nextjs, i18n, lgpd, gdpr, legal-copy, accessibility, playwright, evidence-ledger]
requires:
  - phase: 03-complete-web-experience
    provides: public route manifest, bilingual content admission, public shell, and browser evidence harness
provides:
  - bilingual pre-launch Terms, Privacy, Security, Essential Storage, and Responsible Disclosure experiences
  - canonical Essential Storage and Principles routes in PT-BR and English
  - fail-closed policy admission and responsive browser evidence across four viewport widths
  - complete bilingual claim-to-evidence ledgers and 480 hash-bound canonical visual candidates
affects: [phase-04-auth-data, checkout, licensing, privacy-operations, release-preflight]
tech-stack:
  added: []
  patterns:
    [fail-closed bilingual content admission, claim-to-evidence legal copy, canonical trust routes]
key-files:
  created:
    - apps/web/src/content/public/policy-claims.pt-BR.json
    - apps/web/src/content/public/policy-claims.en.json
    - apps/web/src/content/public/generate-policy-claims.mjs
    - tooling/web-evidence/write-canonical-visual-evidence.mjs
  modified:
    - apps/web/src/content/public/policies.pt-BR.json
    - apps/web/src/content/public/policies.en.json
    - apps/web/src/features/public-catalog.tsx
    - apps/web/src/public-navigation.tsx
    - packages/web-core/src/routes.ts
    - tooling/web-evidence/tests/final-route-experience.spec.ts
key-decisions:
  - 'Present-tense policy claims remain limited to repository-backed product facts; unimplemented account, checkout, telemetry, AI, and disclosure operations are conditional.'
  - 'Essential Storage and Principles use independent canonical localized routes instead of aliases to Privacy or About.'
  - 'Publishing remains blocked until Plan 03-46 verifies formal supplier/controller identity and provisions, authenticates, and monitors every public contact channel.'
patterns-established:
  - 'Trust documents must preserve exact locale parity for route IDs, section IDs, privacy-practice IDs, versions, and dates.'
  - 'Long-form public policy layouts are tested for semantic headings, keyboard access, minimum target size, overlap, and horizontal overflow.'
requirements-completed: []
duration: 1h38min
completed: 2026-08-03
status: complete
---

# Quick 260803-n0d: Final Legal, Trust, and Documentation Experience Summary

**Bilingual, evidence-bounded trust documents with independent Essential Storage and Principles routes, fail-closed admission, and responsive browser coverage from 1440 px to 320 px**

## Performance

- **Duration:** 1 h 38 min (including verification-gap closure)
- **Started:** 2026-08-03T17:02:16-03:00
- **Completed:** 2026-08-03T18:40:00-03:00
- **Tasks:** 3
- **Files modified:** 21

## Accomplishments

- Replaced provisional legal copy with complete PT-BR and English pre-launch documents for Terms, Privacy, Security, Essential Storage, and Responsible Disclosure.
- Added exact, fail-closed admission for policy kinds, canonical route IDs, localized section structure, privacy practices, versions, history, and conditional disclosure coordination.
- Added a dedicated Essential Storage route and kept Privacy, Security, and Responsible Disclosure as distinct localized destinations.
- Added a dedicated Principles route, separated it from the About story, and synchronized the canonical route matrix and phase verifier to 60 routes.
- Corrected Quick Guides and long-form policy layout for wrap, focus, 44 px targets, overlap, and horizontal overflow at 1440, 960, 390, and 320 px.
- Inventoried every policy narrative sentence into 488 bilingual claim records with exact source location, temporal status, and repository-backed evidence.
- Restored the complete canonical visual evidence set to 480 candidates, including Principles and Essential Storage in both locales at all four widths.

## Task Commits

1. **Task 1 RED: define the final legal policy contract** — `71806f6`
2. **Task 1 GREEN: finalize bilingual legal policies** — `a21d94b`
3. **Task 2 RED: require the canonical storage route** — `58a58d8`
4. **Task 2 GREEN: add the canonical Essential Storage route** — `e0955eb`
5. **Task 3: finalize trust, documentation, and Principles experience** — `69c5cb0`
6. **Verification RED: expose legal contract gaps** — `766d111`
7. **Verification GREEN: close claim admission and parity gaps** — `7087f4d`
8. **Evidence closure: restore complete canonical visual evidence** — `bc3e05e`

## Files Created/Modified

- `apps/web/src/content/public/policies.pt-BR.json` and `policies.en.json` — localized policies, privacy ledger, security posture, and coordinated disclosure terms.
- `apps/web/src/features/public-catalog.tsx` and `public-catalog.test.tsx` — exact admission, rendering, parity, and evidence assertions.
- `packages/web-core/src/routes.ts` and `routes.test.ts` — canonical Essential Storage and Principles route identities.
- `apps/web/src/app/[locale]/(public)/[[...slug]]/page.tsx` — public allowlist and dedicated Principles experience.
- `apps/web/src/public-navigation.tsx` and `public-shell.test.ts` — distinct localized footer destinations.
- `apps/web/src/features/documentation.tsx`, `documentation.test.tsx`, `styles/public.css`, and `app/public-shell.css` — resilient Quick Guides and long-form responsive layout.
- `apps/web/src/content/public/catalog.pt-BR.json` and `catalog.en.json` — bilingual Principles content.
- `apps/web/src/content/public/policy-claims.pt-BR.json`, `policy-claims.en.json`, and `generate-policy-claims.mjs` — complete narrative inventory with stable claim IDs, temporal classification, and evidence bindings.
- `tooling/web-evidence/tests/documentation.spec.ts` and `final-route-experience.spec.ts` — keyboard, geometry, copy, route, and locale coverage.
- `tooling/web-evidence/visual-manifest.json`, `write-canonical-visual-evidence.mjs`, and canonical PNGs — 480 collision-free candidates with dimensions, byte lengths, and SHA-256 hashes.
- `tooling/web-evidence/src/verify-phase.ts` and `verify-phase.test.ts` — 60-route phase verification.
- `.planning/phases/03-complete-web-experience/03-ROUTE-EXPERIENCE-MATRIX.md` and `quality/evidence/phase-03/web/route-reachability.json` — synchronized canonical evidence.

## Decisions Made

- Policy text may be final for the pre-launch experience without pretending that future account, payment, telemetry, cloud AI, support-upload, or vulnerability-response operations already exist.
- No legal entity, CNPJ/registration, address, forum, processor, certification, audit, bounty, security guarantee, or response SLA was invented.
- Raw HWID is not presented as stored; the announced licensing design uses a protected derived device identity and a documented reset/transfer rule.
- Optional telemetry, cloud AI, and support diagnostics remain separate future opt-ins; essential storage remains independently explained.
- The public disclosure contact is a designated coordination address subject to launch preflight, never described as a secure or currently monitored channel.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the Principles destination and responsive composition**

- **Found during:** Task 3
- **Issue:** The footer reused the About route for Principles, while the wide and compact compositions did not meet the final route contract.
- **Fix:** Added a dedicated localized Principles route, bilingual admitted content, responsive composition, and geometry assertions.
- **Files modified:** route manifest/tests, public catch-all, catalogs, navigation/tests, public CSS, browser evidence.
- **Verification:** unit tests, four-viewport matrix, route reachability, and phase verifier.
- **Committed in:** `69c5cb0`

**2. [Rule 3 - Blocking] Synchronized canonical route evidence after adding two routes**

- **Found during:** Task 3
- **Issue:** The route matrix and verifier still expected the previous route count and would reject current evidence.
- **Fix:** Updated the canonical matrix, verifier, verifier test, and writer-generated reachability evidence to 60 routes.
- **Committed in:** `69c5cb0`

**3. [Rule 2 - Missing critical functionality] Added complete claim-level evidence admission**

- **Found during:** Independent verification after Task 3
- **Issue:** Policy-level evidence references did not prove every narrative sentence, temporal classification, or PT-BR/English claim parity.
- **Fix:** Added generated claim ledgers for all 488 localized claims, evidence-path and anchor validation, a future-as-current rejection gate, exact ordered section admission, and pairwise locale admission.
- **Committed in:** `766d111`, `7087f4d`

**4. [Rule 3 - Blocking] Restored canonical evidence for every public route**

- **Found during:** Independent verification after Task 3
- **Issue:** Principles had no committed canonical screenshots and Essential Storage had been excluded from candidate generation, while prior About, policy, and documentation images were stale.
- **Fix:** Recaptured all public candidates through Playwright, regenerated hashes and inspection metadata from PNG bytes, and replayed the entire set without snapshot updates.
- **Committed in:** `bc3e05e`

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing critical evidence contract, 2 blocking issues)

**Impact on plan:** Both changes preserve the requested final public trust experience; no backend, authentication, payment, telemetry, AI, email provisioning, or publication operation was added.

## Automated Gate Results

- `@liiiraa/web-core`: 112/112 tests passed.
- `@liiiraa/web`: 125/125 tests passed.
- `@liiiraa/web-evidence`: 151/151 active tests passed (1 intentionally skipped).
- Web and web-evidence TypeScript checks passed.
- Next.js production build passed.
- Documentation Playwright suite: 3/3 passed.
- Final route geometry and behavior passed at 1440, 960, 390, and 320 px.
- Controlled canonical update: 264/264 public candidates passed.
- Exact no-update canonical replay: 264/264 public candidates passed.
- Integrated final-route matrix: 268 passed and 20 non-applicable project combinations skipped as configured.
- Candidate cardinality and launch-integrity gates: 5/5 passed with exactly 480 candidates.
- Route reachability and Phase 3 verifier: 55/55 checks passed.
- Planned verifier: 110 decisions, 60 routes, 24 observed results, and 18 scenarios.
- Evidence fingerprint: `2685ff26f5e65a89269a730e2257ab7ed149f1f8fad9d3e0d0f59f6f2445d42e`.
- Manual visual inspection of Principles in PT-BR and English passed at 1440, 960, 390, and 320 px with no clipping, overlap, or broken copy.
- Prettier and `git diff --check` passed.

## Known Publication Gates

- Before production account collection or checkout, identify the actual supplier/controller, registration, address, processors, transfer safeguards, and final commercial operator details where applicable.
- Provision, authenticate, monitor, and test every published privacy, support, and security contact address.
- Bind policy statements to the implemented production retention/deletion jobs, consent controls, licensing service, checkout, and incident process in Phase 4 and the Plan 03-46 launch preflight.
- The current documents are public-facing pre-launch copy, not a substitute for jurisdiction-specific professional legal review after the business entity and production processors are final.

### Independent legal-research review

A separate read-only legal-research review found the PT-BR and English documents materially coherent, while confirming that publication as policies currently in force must remain blocked. The two blocking facts are the missing formal controller/supplier identity and the Responsible Disclosure contact still being subject to operational preflight. It also identified launch-level revisions for affirmative acceptance, commercial-offer wording, statutory withdrawal versus commercial refund, minor eligibility, the exact storage/cookie inventory, current processors/transfers/retention, treatment of the derived device identifier as pseudonymized personal data, and separation of implemented security controls from future controls. These items require real business and production facts and therefore cannot be solved safely by invented copy in this task.

## Known Stubs

None. Conditional descriptions are intentional launch gates for Phase 4 and Plan 03-46, not empty UI or mock data.

## Threat Flags

No unplanned trust boundary was introduced. The new routes render versioned local content only and do not add network endpoints, authentication, data collection, checkout, or contact-channel provisioning.

## User Setup Required

None for local verification. Production publication still requires the gates listed above.

## Next Phase Readiness

- Phase 4 can bind the declared account, consent, licensing, retention, deletion, and processor contracts to real services without rewriting the public information architecture.
- Launch remains blocked until the legal identity and operational-contact preflight is complete.

## Self-Check: PASSED

- All eight implementation and gap-closure commits exist.
- Both claim ledgers, both canonical route additions, the evidence writer, and all 480 visual candidates exist.
- No tracked files were accidentally deleted by the final task commit.
- Summary status is `complete` and the evidence fingerprint is recorded.

---

_Quick task: 260803-n0d_
_Completed: 2026-08-03_
