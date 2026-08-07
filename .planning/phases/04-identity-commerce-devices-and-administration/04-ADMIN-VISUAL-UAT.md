---
status: passed
phase: 04-identity-commerce-devices-and-administration
plan: 04-61
tested_commit: bbc74cc
storybook_iframe_sha256: b8720177e2e1df3a128f24065b0d709f66e24c0a8887d6396b3ba663c9667a6d
started: 2026-08-07T18:40:31.4628839Z
updated: 2026-08-07T19:45:55.0289281Z
---

# Admin visual and accessibility UAT

## Approval boundary

The owner delegated the final visual direction to Codex and replied `perfeito` after the
dual-agent critique, final polish, refreshed screenshots, and real production-authority E2E.
This approves the visual direction at commit `9e1d5d9`; it does not fabricate assistive-
technology evidence that has not been observed.

## Current Test

number: 9
name: Complete
expected: |
  Every automated and manual visual/accessibility acceptance row passes on the exact
  tested commit and Storybook build.
awaiting: none

## Evidence identity

- Commit: `bbc74cc`
- Storybook iframe SHA-256: `b8720177e2e1df3a128f24065b0d709f66e24c0a8887d6396b3ba663c9667a6d`
- Manual assistive technology: Narrator 10.0.26100.8521 / Edge 151.0.4129.59 and NVDA 2026.1.1 / Chromium on Windows
- Automated browser: Playwright 1.62 / Chromium on Windows
- Authority: production flags, real API, PostgreSQL on Neon branch `br-holy-credit-avgpp494`
- Locales: PT-BR and English
- Viewports: 1600x1000, 1280x800, 1024x768, 768x1024, 390x844, 320x568
- Additional modes: 200% text, forced colors, reduced motion

## Tests

### 1. Briefing Focus composition across seven domains
expected: Overview, Queue, invitations, access governance, Revenue/Support, and Operation/Security/System use domain-appropriate ledgers, work regions, tables, inspectors, and high-risk decision surfaces without generic dashboard repetition.
result: pass
evidence: Owner-delegated visual approval; dual-agent critique; refreshed desktop/mobile Storybook captures.

### 2. Responsive layout and production insets
expected: Every prescribed viewport preserves navigation, readable hierarchy, stable record identity, and full recovery actions without horizontal overflow or duplicate shell/workspace padding.
result: pass
evidence: Production E2E viewport matrix, no-overflow assertions, and final 320px Overview capture after production-shell inset correction.

### 3. Long content, locales, and 200% text
expected: PT-BR/English, long names, identifiers, dates, amounts, and time zones reflow at 320 CSS px and 200% text without clipping, overlap, or lost actions.
result: pass
evidence: Playwright 320px/200% matrix and refreshed compact definition-list composition.

### 4. Touch targets and mobile command access
expected: Navigation, search, account, drawers, rows, pagination, filters, inspectors, and dialogs expose at least 44x44px targets with safe separation and accessible names.
result: pass
evidence: Shell regression tests, rendered 320px geometry, and axe WCAG 2.2 AA with zero violations.

### 5. Keyboard, focus restoration, and search shortcut
expected: Keyboard traversal reaches navigation, search, tables/lists, inspectors, sheets, dialogs, filters, selection, pagination, timelines, and function controls; Escape and route transitions restore visible focus.
result: pass-automated
evidence: Shell interaction contracts, focus-handoff tests, drawer focus restoration, mobile search reveal, and production E2E.

### 6. Contrast, forced colors, and reduced motion
expected: Text, focus, status, destructive actions, and recovery remain perceivable in normal and forced colors; reduced motion removes translation/stagger without hiding state.
result: pass
evidence: Forced-colors/reduced-motion Playwright matrix and axe with zero violations.

### 7. Narrator and secondary screen-reader pairing
expected: Narrator/Edge and one additional pairing announce semantic structure, status changes, errors, risk, approval, tables, selections, dialogs, and focus restoration without hidden-content leakage.
result: pass
evidence: Owner observed Narrator/Edge and NVDA/Chromium across the shell, table, critical approval, error, and inspector/focus stories. The only reported discrepancy was a Storybook-local route escape; commits `c8553c6`, `98da17f`, `ea70636`, and `bbc74cc` added RED regressions, a preview-only navigation boundary, polite live announcements, and query-state containment. Browser verification exercised 34 internal links across all seven domains with zero escapes or HTTP failures.

### 8. Real authority, degraded states, and durable refetch
expected: Login/TOTP, invitations, governance, approvals, jobs, search, incidents, configuration, privacy, emergency, consent, audit, reconnecting/degraded blocking, persistence, and HTTP refetch use API/PostgreSQL authority with preview and fixtures disabled.
result: pass
evidence: `admin-operations.spec.ts` production-authority test passed against Neon in 1.8 minutes.

### 9. Bounded desktop-to-Admin handoff
expected: Eligible desktop administrators open the isolated HTTPS Admin in the system browser; ineligible/offline/revoked states expose no actionable handoff and no Admin payload or secret enters the WebView.
result: pass-automated
evidence: 18/18 focused desktop account-authority and account-experience tests.

## Summary

total: 9
passed: 9
pending: 0
issues: 0
blocked: 0

## Resolved issue

- Activating `Abrir revisões de acesso` originally navigated the static Storybook origin to
  `/pt-BR/admin/people/access-reviews` and returned HTTP 404. The preview-only boundary now
  preserves the active story, retains real accessible link semantics, and announces the
  validated destination through a polite status region. The production Admin router is
  unchanged.

## Completion evidence

- Admin verify: 13 files, 165 tests, TypeScript, and Next.js production build passed.
- Storybook production build passed and the seven-domain link sweep checked 34 routes with
  zero escapes.
- Desktop bounded handoff: 18/18 focused tests passed.
- Real production-authority E2E: 1/1 passed in 1.8 minutes against API/PostgreSQL on Neon with
  preview and fixture authority disabled.
