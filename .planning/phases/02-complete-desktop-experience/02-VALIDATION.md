---
phase: 02
slug: complete-desktop-experience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-27
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for fast feedback during execution and complete Phase 2 acceptance.

---

## Test Infrastructure

| Property | Value |
|---|---|
| **Unit and machine tests** | Vitest 4.1.10 |
| **Component and interaction tests** | Storybook 10.5.4 with React-Vite |
| **Browser E2E and visual tests** | Playwright 1.62.0 with `@axe-core/playwright` 4.12.1 |
| **Packaged desktop tests** | `tauri-driver` 2.0.6 on Windows 10 and Windows 11 |
| **Config files** | None yet — Wave 0 creates package-local Vitest, Storybook, Playwright, and packaged-driver configuration |
| **Quick run command** | `pnpm verify:quick` |
| **Full suite command** | `pnpm verify` |
| **Estimated quick runtime** | Under 120 seconds after Wave 0 |

---

## Sampling Rate

- **After every task commit:** Run the owning package's typecheck and requirement-scoped Vitest target.
- **After every plan wave:** Run `pnpm verify:quick`, affected Storybook interactions, axe checks, and deterministic scenario screenshots.
- **Before `$gsd-verify-work`:** Run `pnpm verify`, the complete S01–S24 route/state matrix, packaged Windows 10/11 journeys, signature and non-elevation checks, and the manual accessibility evidence set.
- **Maximum task feedback latency:** 120 seconds.

---

## Per-Requirement Verification Map

Plan and task IDs are assigned by the planner. Every resulting task must retain an automated command or an explicit Wave 0 dependency.

| Requirement | Planned behavior | Test type | Automated command | File exists | Status |
|---|---|---|---|---|---|
| UX-01 | Signed, installable, non-elevated Tauri shell with safe capabilities | config/unit + packaged smoke | `pnpm --filter @liiiraa/desktop test -- --run -t UX-01` | No — Wave 0 | pending |
| UX-02 | Guarded calibration workflow from inventory through game priorities | machine/unit + E2E | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-02` | No — Wave 0 | pending |
| UX-03 | Contextual home prioritizes the next recommended action and current system/game state | component + visual | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-03` | No — Wave 0 | pending |
| UX-04 | Goal-oriented typed navigation reaches every product module | route unit + E2E | `pnpm --filter @liiiraa/desktop test -- --run -t UX-04` | No — Wave 0 | pending |
| UX-05 | Command center ranks search results and prevents unsafe direct actions | unit + keyboard E2E | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-05` | No — Wave 0 | pending |
| UX-06 | Controlled favorites enforce limits, reorder correctly, and persist benign preferences | reducer/unit + E2E | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-06` | No — Wave 0 | pending |
| UX-07 | Every module renders all required operational states using deterministic scenarios | manifest/unit + visual matrix | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-07` | No — Wave 0 | pending |
| UX-08 | Activity is prioritized, acknowledged, filterable, and correlated to user-visible work | reducer/unit + E2E | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-08` | No — Wave 0 | pending |
| UX-09 | Feedback channels expose privacy and simulated/real-state truth clearly | unit + E2E | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-09` | No — Wave 0 | pending |
| UX-10 | Complete keyboard, focus, screen-reader, contrast, zoom, and reduced-motion behavior | axe + keyboard E2E + manual NVDA | `pnpm --filter @liiiraa/desktop test:e2e -- --grep UX-10` | No — Wave 0 | pending |
| UX-11 | PT-BR and English catalogs have parity and no missing-key fallback in shipped flows | catalog unit + pseudo-locale visual | `pnpm --filter @liiiraa/desktop test -- --run -t UX-11` | No — Wave 0 | pending |
| UX-12 | Appearance/accessibility preferences persist and status meaning never relies on color alone | reducer/unit + forced-colors visual | `pnpm --filter @liiiraa/desktop test:e2e -- --grep UX-12` | No — Wave 0 | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [ ] Activate `packages/design-tokens`, `packages/design-system`, `packages/feature-shell`, and `apps/desktop` in the executable architecture policy.
- [ ] Add Tauri, Vite, React, and Rust workspace manifests, deny-by-default capabilities, and bundle configuration.
- [ ] Add package-local Vitest configuration plus shared deterministic clock, seed, locale, and scenario helpers.
- [ ] Add Storybook configuration with accessibility, locale, scale, reduced-motion, and forced-colors decorators.
- [ ] Add Playwright configuration, screenshot projects, axe fixtures, keyboard helpers, and frozen dynamic data.
- [ ] Add a packaged desktop driver harness and clean-install scripts for Windows 10 and Windows 11.
- [ ] Add the S01–S24 scenario manifest and coverage tests asserting each required route/state pair.
- [ ] Add `quality/features/ux-01.json` through `quality/features/ux-12.json` evidence manifests.
- [ ] Extend required-artifact and reachability verification so new quality gates cannot silently disappear.

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Test instructions |
|---|---|---|---|
| Authenticode trust, clean installation, update behavior, and non-elevated process boundary | UX-01 | Requires signed packaged artifacts and clean Windows machines | Install the signed bundle on supported Windows 10/11 images; verify signature chain, SmartScreen behavior, normal-user launch, capability denial, upgrade, and uninstall residue |
| NVDA announcements, reading order, focus recovery, and live-region behavior | UX-10 | Screen-reader usability cannot be established by axe alone | Run the canonical calibration, command-center, module-state, activity, and recovery journeys with NVDA using keyboard only |
| 200% UI scaling, Windows text scaling, forced colors, and high-contrast themes | UX-10, UX-12 | OS rendering and assistive settings require visual/human judgment | Execute the visual matrix on packaged Windows builds and attach annotated evidence for clipping, overlap, focus visibility, and non-color status meaning |
| Perceived startup and desktop memory budgets | UX-01 | Requires packaged process telemetry on target hardware | Capture cold/warm launch timing and working-set evidence on the supported hardware tiers |

---

## Security and Truth-Boundary Checks

- [ ] The UI and WebView run without administrator privileges.
- [ ] Tauri capabilities are deny-by-default and expose only operation-specific commands.
- [ ] Production builds reject fixture or simulated adapters at the desktop-client boundary.
- [ ] Simulated states are visibly labeled and never claim that a privileged optimization occurred.
- [ ] No plan introduces arbitrary remote scripts, generic registry/file/service RPC methods, or unsigned profile execution.
- [ ] Accessibility and localization evidence contains no user secrets or sensitive diagnostics.

---

## Validation Sign-Off

- [ ] Every plan task has an automated verification command or an explicit Wave 0 dependency.
- [ ] No three consecutive implementation tasks lack automated verification.
- [ ] Wave 0 covers every currently missing test/config reference.
- [ ] Watch mode is disabled in all CI and phase-gate commands.
- [ ] Quick feedback latency is below 120 seconds.
- [ ] Full UX-01 through UX-12 evidence manifests are green.
- [ ] Packaged Windows, accessibility, localization, recovery, signing, and truth-boundary evidence is attached.
- [ ] `nyquist_compliant: true` and `wave_0_complete: true` are set only after the corresponding checks pass.

**Approval:** pending
