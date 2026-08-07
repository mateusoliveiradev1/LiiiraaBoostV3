---
phase: 04-identity-commerce-devices-and-administration
plan: '61'
subsystem: admin-platform
tags: [nextjs, react, postgresql, totp, storybook, playwright, tauri, accessibility]

requires:
  - phase: 04-55-through-04-60
    provides: Seven-domain Admin workspaces, shell, operational states, and UI-SPEC compositions
  - phase: 04-62
    provides: Production Admin authority provider and PostgreSQL-backed administrative contracts
provides:
  - Canonical production registry for every seven-domain Admin route and record composition
  - Real TOTP-gated administrative enrollment, authority projection, and durable PostgreSQL proof
  - Browser-to-API-to-Neon production-authority E2E with fixtures and preview authority disabled
  - Bounded desktop projection and system-browser Open Admin handoff without Admin data in the WebView
  - Exact-commit responsive, accessibility, screen-reader, and visual UAT approved at 9/9
affects: [phase-04-verification, admin, desktop, identity, private-beta]

tech-stack:
  added: []
  patterns:
    - Canonical route registry backed by one fail-closed Admin authority provider
    - Invalidation-only live delivery followed by authoritative HTTP refetch
    - Preview-only Storybook navigation containment with polite assistive-technology status
    - Desktop administrative handoff limited to bounded labels and an allowlisted external origin

key-files:
  created:
    - apps/api/src/staging/strong-auth.ts
    - packages/control-plane-adapters/src/postgres/migrations/0007_identity_strong_auth.sql
    - packages/control-plane-adapters/src/postgres/migrations/0008_admin_authority_grants.sql
    - apps/admin/src/features/admin-workspace-registry.tsx
    - tooling/web-evidence/real-admin-harness.mjs
    - tooling/web-evidence/tests/admin-operations.spec.ts
    - apps/admin/.storybook/story-navigation.ts
    - apps/admin/.storybook/story-navigation.test.ts
    - .planning/phases/04-identity-commerce-devices-and-administration/04-ADMIN-VISUAL-UAT.md
  modified:
    - apps/admin/src/features/admin-authority.tsx
    - apps/admin/src/app/[locale]/[[...workspace]]/page.tsx
    - apps/admin/src/admin-navigation.tsx
    - apps/admin/src/app/admin-shell.css
    - apps/desktop/src/account-authority.ts
    - apps/desktop/src/features/account-experience.tsx
    - apps/desktop/src-tauri/src/identity.rs

key-decisions:
  - Real TOTP enrollment and recent strong authentication gate administrative authority before protected reads or commands.
  - The desktop receives only authoritative plan, membership, and active-function labels; Admin authority and records stay in the isolated browser origin.
  - Storybook preserves production-shaped links but contains preview navigation and announces destinations instead of resolving application routes as static files.
  - Exact-commit manual assistive-technology evidence is combined with automated axe, responsive, link, and production-authority receipts.

patterns-established:
  - Production Admin composition never falls back to Storybook fixtures or client-declared role authority.
  - Record identity, locale, function, view, cursor, and version survive route composition without serializing authorization claims.
  - Storybook-only navigation boundaries prevent preview-server 404s while retaining link roles, names, focus, and live announcements.

requirements-completed: [WEB-06, WEB-07, IDEN-01, IDEN-03]

duration: 8h 56m
completed: 2026-08-07
status: complete
---

# Phase 04 Plan 61: Integrated Admin Workspace and Desktop Handoff Summary

**Seven-domain production Admin with real TOTP/PostgreSQL authority, responsive accessibility evidence, and a strictly bounded desktop-to-browser handoff**

## Performance

- **Duration:** 8h 56m
- **Started:** 2026-08-07T10:52:26Z
- **Completed:** 2026-08-07T19:48:37Z
- **Tasks:** 3
- **Files modified:** 74

## Accomplishments

- Integrated every redesigned Admin domain and record route through the canonical production registry and fail-closed authority provider.
- Added real TOTP enrollment, strong-auth admission, durable Admin grants, migrations, and a browser-to-API-to-PostgreSQL E2E that exercises the complete operational matrix with fixtures disabled.
- Shipped the desktop Admin handoff as bounded account labels plus an allowlisted system-browser action, with no Admin records, commands, cookies, or secrets entering desktop state.
- Completed the Briefing Focus visual reformulation across desktop, tablet, mobile, 320 px, 200% text, forced colors, and reduced motion.
- Closed the final Storybook route-escape defect and approved the exact build through Narrator/Edge, NVDA/Chromium, automated axe, link, focus, and persistence evidence.

## Task Commits

Each task was committed atomically:

1. **Task 04-61-01: Compose the production Admin workspace and full evidence matrix**
   - `cdae1c6` migration-chain correction
   - `336831d`, `026ce32`, `929ccd6` RED/GREEN real strong-auth and TOTP authority
   - `1d2ee18` canonical workspace registry
   - `cdc7f88` durable Admin authority grants
   - `a513c3d` live production-authority harness and E2E
   - `fb2896e`, `0807382`, `9e1d5d9` final responsive visual reformulation and polish
   - `c8553c6`, `98da17f`, `ea70636`, `bbc74cc` RED/GREEN Storybook navigation containment
2. **Task 04-61-02: Add the bounded desktop-to-Admin handoff**
   - `eb7faf0` failing desktop boundary witnesses
   - `6734fa3` bounded projection and external-browser handoff
3. **Task 04-61-03: Approve the final Briefing Focus compositions**
   - `82297db` initial exact-commit visual UAT record
   - `0f3ac59` completed 9/9 accessibility UAT and resolved route-escape evidence

## Files Created/Modified

- `apps/admin/src/features/admin-workspace-registry.tsx` - Canonical seven-domain production route and record registry.
- `apps/admin/src/features/admin-authority.tsx` - Real session, strong-auth, API query, mutation, and refetch authority.
- `tooling/web-evidence/tests/admin-operations.spec.ts` - Real login/TOTP, API/PostgreSQL, responsive, accessibility, persistence, and degraded-state proof.
- `tooling/web-evidence/real-admin-harness.mjs` - Local HTTPS composition for fixture-off Admin E2E.
- `apps/desktop/src/account-authority.ts` - Bounded database-backed administrative membership projection.
- `apps/desktop/src/features/account-experience.tsx` - Allowlisted system-browser Open Admin action.
- `apps/admin/.storybook/preview.tsx` - Exact fixture axes and preview-only navigation boundary.
- `apps/admin/.storybook/story-navigation.ts` - Safe resolution of localized Admin and query-only preview navigation.
- `.planning/phases/04-identity-commerce-devices-and-administration/04-ADMIN-VISUAL-UAT.md` - Exact-build 9/9 manual and automated acceptance record.

## Decisions Made

- Administrative authority requires real enrolled TOTP and recent strong-auth proof; URL role, preview role, and client claims never grant access.
- Production uses API/PostgreSQL as the only source of truth. Storybook fixtures stay under explicit testing composition and are absent from the emitted production authority path.
- Live delivery carries invalidation metadata only. The UI marks data stale and performs an authoritative HTTP refetch before permitting critical mutations.
- The desktop remains an account client, not an Admin client: it renders bounded labels and opens an isolated HTTPS origin in the system browser.
- Storybook intercepts only application-shaped localized Admin routes and query-only view transitions, leaving fragments and external links untouched while announcing the validated target.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added real TOTP and durable Admin grant authority**
- **Found during:** Task 04-61-01 production-authority integration
- **Issue:** The production workspace could not honestly pass the required strong administrative authentication and persisted grant checks with the existing staging composition.
- **Fix:** Added TOTP enrollment/confirmation, recent strong-auth admission, migrations, repositories, runtime wiring, and failure witnesses.
- **Verification:** API and adapter suites plus the real production-authority E2E passed against Neon.
- **Committed in:** `336831d`, `026ce32`, `929ccd6`, `cdc7f88`

**2. [Rule 1 - Bug] Corrected final responsive composition and production insets**
- **Found during:** Task 04-61-01 visual review
- **Issue:** Duplicate shell/workspace spacing, record restoration, mobile search, and 320 px density diverged from the approved Briefing Focus composition.
- **Fix:** Reworked shell/workspace ownership, route identity, mobile command access, and compact Overview presentation.
- **Verification:** Admin tests, viewport matrix, axe, screenshots, long-content, forced-colors, and reduced-motion checks passed.
- **Committed in:** `fb2896e`, `0807382`, `9e1d5d9`

**3. [Rule 1 - Bug] Contained Storybook application navigation**
- **Found during:** Task 04-61-03 manual Narrator/Edge verification
- **Issue:** Activating a production-shaped link made the static Storybook server resolve `/pt-BR/admin/...` as a file and return HTTP 404; query-only invitation filters could also drop story identity.
- **Fix:** Added a Storybook-only navigation boundary that preserves accessible links, blocks preview escape, and announces the target through a polite status region.
- **Verification:** RED/GREEN unit tests, TypeScript, Storybook build, and a browser sweep of 34 links across seven domains passed with zero escapes.
- **Committed in:** `c8553c6`, `98da17f`, `ea70636`, `bbc74cc`

---

**Total deviations:** 3 auto-fixed (1 missing-critical authority gap, 2 correctness defects).
**Impact on plan:** All fixes were required to satisfy the plan's real-authority, responsive, accessibility, and zero-dead-control acceptance boundary; no production fixture fallback or desktop authority expansion was introduced.

## Issues Encountered

- The broad Desktop `verify` command reaches the repository-wide foundation lint and currently reports unrelated pre-existing lint debt plus generated `storybook-static` artifacts. The plan-owned desktop boundary is green in its prescribed focused suite (`18/18`), and no final navigation fix touches desktop production code.
- Neon credentials were reacquired ephemerally through the connected Neon integration and passed only in the E2E process environment; they were neither printed nor persisted.

## User Setup Required

None - no new external service configuration is required.

## Verification Receipts

- Admin verify: 13 files, `166/166` tests, TypeScript, and Next.js production build passed.
- Storybook build: passed; iframe SHA-256 `b8720177e2e1df3a128f24065b0d709f66e24c0a8887d6396b3ba663c9667a6d`.
- Storybook navigation: 34 links across seven domains, zero route escapes.
- Desktop handoff: `18/18` focused account-authority/account-experience tests passed.
- Production authority: `1/1` Playwright E2E passed in 1.8 minutes against API and Neon PostgreSQL with preview/fixtures disabled.
- Manual UAT: `9/9`, including Narrator/Edge and NVDA/Chromium.

## Next Phase Readiness

- Plan 04-61 is complete and ready for phase-level reconciliation.
- Phase 04 must not be declared complete yet: Plans 04-25, 04-26, and 04-40 still lack SUMMARY artifacts and require safe-resume reconciliation rather than automatic re-execution.

## Self-Check: PASSED

- Key files exist and every Plan 04-61 implementation/UAT commit is present.
- WEB-06, WEB-07, IDEN-01, and IDEN-03 are covered by real production composition and exact-build evidence.
- All plan-scoped automated acceptance criteria and the blocking human checkpoint pass.

---
*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-07*
