---
phase: 03
slug: complete-web-experience
status: approved
nyquist_compliant: true
wave_0_complete: false
planning_signoff: approved
wave_0_execution: pending
created: 2026-07-30
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + Playwright 1.62.0 + Storybook 10.5.4 + `@axe-core/playwright` 4.12.1 |
| **Config file** | None — Wave 0 installs the web verification configuration |
| **Quick run command** | `pnpm web:verify:quick` |
| **Full suite command** | `pnpm verify` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After task commit:** Run the focused Vitest file or `pnpm web:verify:quick -- --requirement WEB-0X`
- **After plan wave:** Run `pnpm web:verify:quick`
- **Before `$gsd-verify-work`:** Run `pnpm verify` and require all final acceptance manifests to be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-W0-01 | 03-14 Task 1 + Task 2 | 7 | WEB-01 | T-03-02 / T-03-09 | Public content remains truthful, bilingual, navigable, accessible, and isolated from preview data | unit + E2E + visual + accessibility | `pnpm web:verify:quick -- --requirement WEB-01` | ❌ W0 | ⬜ pending |
| 03-W0-02 | 03-14 Task 1 + Task 2 | 7 | WEB-02 | T-03-02 / T-03-04 | Locale, version, channel, search, and desktop links resolve only through the typed manifest | contract + unit + E2E | `pnpm web:verify:quick -- --requirement WEB-02` | ❌ W0 | ⬜ pending |
| 03-W0-03 | 03-14 Task 1 + Task 2 | 7 | WEB-03 | T-03-08 | Download eligibility and integrity flows fail closed and never expose a development artifact | state-machine + artifact + E2E | `pnpm web:verify:quick -- --requirement WEB-03` | ❌ W0 | ⬜ pending |
| 03-W0-04 | 03-14 Task 1 + Task 2 | 7 | WEB-08 | T-03-01 / T-03-04 / T-03-05 / T-03-06 | Public, account, and admin builds retain distinct headers, origins, indexing, cookies, and fixture boundaries | architecture + build + header smoke | `pnpm web:verify:quick -- --requirement WEB-08` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Declare `web-core`, `web-preview`, `web-features`, the three app modules, and `web-evidence` in `architecture/module-boundaries.json`; extend architecture fixtures.
- [ ] Create package and app manifests, strict TypeScript configs, Next.js configs, and independent `build`, `start`, `check`, and `test` scripts.
- [ ] Create `tooling/web-evidence/src/route-manifest.test.ts` for bidirectional route, navigation, sitemap, redirect, and desktop-link ownership.
- [ ] Create `tooling/web-evidence/src/content-publication.test.ts` for schema, locale, review-date, evidence, policy, screenshot, search-index, and release coherence.
- [ ] Create `tooling/web-evidence/src/security-boundaries.test.ts` for headers, CSP, robots, cookies, origin transitions, and preview/artifact leakage.
- [ ] Create `tooling/web-evidence/src/release-gate.test.ts` for unavailable, mismatch, no-bypass, and no-development-artifact cases.
- [ ] Create `tooling/web-evidence/playwright.config.ts` for route states, locales, screenshot coverage, and axe checks.
- [ ] Create `quality/features/WEB-01.json` through `quality/features/WEB-08.json` for the four Phase 3 requirement IDs and their five-dimension evidence.
- [ ] Add `web:verify:quick` and `web:verify`, wire them into root verification, and update required-artifact tests without dropping existing gates.
- [ ] Complete a human verification checkpoint for `next`, `@next/mdx`, and `next-intl` before accepting the recency-flagged packages.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Approve recency-flagged framework packages | WEB-08 | Package identity checks passed, but the research policy requires human approval for unusually recent releases | Review the registry evidence in `03-RESEARCH.md`, confirm official package ownership and compatibility, then record approval for `next`, `@next/mdx`, and `next-intl` in the execution summary |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verification backed by Wave 0 dependencies
- [x] Sampling continuity: no three consecutive tasks without automated verification
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency stays below 120 seconds
- [x] `nyquist_compliant: true` is set in frontmatter

**Planning approval:** approved — every Phase 3 requirement has an explicit Plan 03-14 task mapping and focused automated command before UI fan-out.

**Wave 0 execution:** pending — `wave_0_complete` remains `false` until Plan 03-14 has executed and its evidence harness passes. Planning completeness is not execution evidence.
