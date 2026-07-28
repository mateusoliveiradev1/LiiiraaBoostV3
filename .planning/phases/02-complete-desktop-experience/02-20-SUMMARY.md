---
phase: 02-complete-desktop-experience
plan: '20'
subsystem: desktop-localization-preferences
tags: [desktop, i18n, preferences, accessibility, react, generated-contracts]
requires:
  - phase: 02-08
    provides: Goal-first feature surfaces and calibration message identifiers
  - phase: 02-09
    provides: Technical feature copy categories and chart semantics
  - phase: 02-10
    provides: Recovery, assistant, account, settings, and notification surfaces
  - phase: 02-24
    provides: Generated renderer-to-host locale and tray command contracts
provides:
  - Exact PT-BR, English, and pseudo-locale catalogs with fail-closed critical copy
  - D-17 locale detection, deterministic UTC formatters, and LocaleProvider
  - D-18/D-19 benign preference persistence and appearance application
  - Generated locale and tray command builders for the future native bridge
affects: [desktop-app-shell, settings, calibration, storybook, visual-regression, phase-02-evidence]
tech-stack:
  added: []
  patterns:
    - Shipping catalogs maintain exact runtime-checked key parity
    - Preference persistence delegates validation and defaults to the feature-shell reducer
    - Native-bound preference commands use generated DTOs and caller-injected deterministic metadata
key-files:
  created:
    - apps/desktop/src/locales/pt-BR.json
    - apps/desktop/src/locales/en.json
    - apps/desktop/src/locales/pseudo.json
    - apps/desktop/src/locales/i18n.ts
    - apps/desktop/src/locales/i18n.test.tsx
    - apps/desktop/src/preferences.tsx
    - apps/desktop/src/preferences.test.tsx
  modified:
    - packages/feature-shell/src/index.ts
    - apps/desktop/package.json
    - apps/desktop/tsconfig.json
    - pnpm-lock.yaml
key-decisions:
  - Keep en-US as the renderer preference locale and map it explicitly to generated shell locale en at the native boundary
  - Format dates in explicit UTC so scenario and screenshot evidence remains deterministic across developer machines
  - Persist only the versioned preference reducer shape; consent, entitlement, account, and diagnostic state never enter storage
  - Require callers to inject request metadata before a preference command can be sent to the future native bridge
requirements-completed: [UX-10, UX-11, UX-12]
duration: 17min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 20: Localization and Benign Desktop Preferences Summary

**Complete D-17 through D-19 localization and appearance foundation with parity-checked catalogs, deterministic formatters, safe preference recovery, and explicit tray opt-in**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-28T04:36:14-03:00
- **Completed:** 2026-07-28T04:53:00-03:00
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added 121 semantic messages in PT-BR and English across navigation, dialogs, errors, notifications, charts, units, provenance, confirmations, settings, calibration, and screen-reader names.
- Added an exact-parity pseudo-locale whose every message expands at least 35 percent for clipping detection.
- Implemented fail-closed critical message lookup, whole-token confirmations, D-17 Windows locale detection, and explicit locale-aware UTC date, number, storage, temperature, and duration formatters.
- Implemented a controlled `LocaleProvider` and visible pre-consent language control.
- Implemented a `DesktopPreferencesProvider` over the tested versioned feature reducer with D-18 Comfortable/System defaults and D-19 exit-on-close behavior.
- Restored corrupt or non-benign persisted data to safe defaults and serialized only the approved benign preference fields.
- Applied scale, density, motion, contrast, language, minimum target size, and type size through deterministic root attributes and CSS properties.
- Created exact generated renderer-to-host locale and tray preference commands without granting native authority.

## Task Commits

1. **Task 1 RED: localization contract tests** - `92b9803`
2. **Task 1 GREEN: deterministic localization catalogs** - `852d73b`
3. **Task 2 RED: benign preference provider tests** - `fe50094`
4. **Task 2 GREEN: desktop preference provider** - `0096ee9`

## Verification

- `rtk pnpm --filter @liiiraa/desktop test -- --run -t "locale|catalog parity"` — PASS, 8 focused tests.
- `rtk pnpm --filter @liiiraa/desktop test -- --run -t "preferences|D-18|D-19"` — PASS, 6 focused tests.
- `rtk pnpm --filter @liiiraa/desktop test -- --run` — PASS, 33 tests.
- `rtk pnpm --filter @liiiraa/desktop check` — PASS.
- `rtk pnpm --filter @liiiraa/feature-shell test` — PASS, 86 tests.
- `rtk pnpm --filter @liiiraa/feature-shell check` — PASS.

## Decisions Made

- Renderer preferences keep the established `en-US` locale while the generated native command receives canonical `en`.
- Locale formatting always receives an explicit locale and dates always receive UTC, preventing ambient host settings from changing deterministic evidence.
- The provider emits a native-bound command only when both the sender and deterministic metadata factory are supplied.
- Compact density reduces whitespace only; minimum target and body type sizes remain 44 px and 15 px.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Activated the already approved React type dependency in the desktop consumer**

- **Found during:** Task 1 GREEN type verification
- **Issue:** `LocaleProvider` made `apps/desktop` a direct typed React consumer, but the approved free `@types/react@19.2.17` identity was linked only to `feature-shell`; TypeScript also excluded JSON catalogs from the composite project.
- **Fix:** Added the already approved MIT type package to the desktop manifest, included JSON sources in its TypeScript project, and refreshed the lockfile with lifecycle scripts disabled.
- **Files modified:** `apps/desktop/package.json`, `apps/desktop/tsconfig.json`, `pnpm-lock.yaml`
- **Verification:** Desktop focused tests and strict typecheck pass.
- **Commit:** `852d73b`

**2. [Rule 3 - Blocking] Exposed preference and generated command contracts through the public feature boundary**

- **Found during:** Task 2 GREEN implementation
- **Issue:** The desktop composition could not consume the tested preference reducer or generated preference command types without a forbidden deep import or a duplicate handwritten DTO.
- **Fix:** Re-exported the reducer contract and generated locale/tray command types from `@liiiraa/feature-shell`.
- **Files modified:** `packages/feature-shell/src/index.ts`
- **Verification:** Feature-shell and desktop strict checks pass; both complete test suites pass.
- **Commit:** `0096ee9`

**Total deviations:** 2 auto-fixed blocking integration issues.

**Impact:** Both adjustments preserve existing package ownership, use only the explicitly approved free dependency identity, and avoid duplicate transport or preference authorities.

## Known Stubs

None. The native sender remains an intentionally injected future bridge boundary; no success, permission, entitlement, or system mutation is simulated.

## Threat Model

- Persisted input is parsed defensively and accepted only through the exact versioned benign preference validator.
- Corrupt, extra-field, consent-bearing, or unsupported values restore D-17 through D-19 safe defaults.
- Tray persistence remains false unless the user explicitly opts in.
- Native commands are closed generated DTOs and require explicit caller-provided request metadata.
- No new network endpoint, privileged action, file access path, authentication path, or external service was introduced.

## Next Phase Readiness

- Desktop routes and settings can consume the locale and preference providers without changing the feature reducer contract.
- Storybook and browser matrices can select PT-BR, English, pseudo locale, motion, scale, density, and contrast deterministically.
- The later Tauri bridge can validate and send the generated locale and tray commands without redefining DTOs.

## Self-Check: PASSED

- All seven created implementation and test artifacts exist.
- All four RED/GREEN task commits exist in git history.
- Focused acceptance checks, complete desktop unit tests, feature-shell regression tests, and strict TypeScript checks pass.
