# Phase 2: Complete Desktop Experience - Research

**Researched:** 2026-07-27  
**Domain:** Windows Tauri desktop shell, deterministic React product UI, accessibility, localization, and scenario-driven verification  
**Confidence:** HIGH for project architecture and UX contract; MEDIUM for external implementation details; LOW where explicitly marked `[ASSUMED]`

<user_constraints>
## User Constraints (from CONTEXT.md)

_The following decisions, discretion, and deferred-idea text is copied verbatim from `02-CONTEXT.md`._ [VERIFIED: .planning/phases/02-complete-desktop-experience/02-CONTEXT.md]

### Locked Decisions

### Calibration gates

- **D-01:** Require only trust/privacy and a basic system inventory before normal Home access. The remaining calibration steps may be deferred.
- **D-02:** When a deferred step becomes necessary, block only the dependent action, identify the missing evidence, open the exact required step, and preserve a return path to the original task.
- **D-03:** Reopening an incomplete calibration lands on contextual Home. “Continue calibration” becomes the dominant next action and saved progress remains visible.
- **D-04:** Home personalizes progressively as valid evidence arrives. Each region must distinguish trusted content from incomplete or unavailable content.
- **D-05:** If the mandatory inventory fails or permission is denied, enter a safe limited mode. Show no recommendations, state the exact cause, retain safe local functions, and offer a retry.
- **D-06:** Explain necessary local processing separately from optional connected processing. Telemetry, cloud AI, and diagnostic sharing each require independent consent and start disabled.
- **D-07:** Stale evidence or hardware change triggers partial revalidation. Preserve evidence that remains valid and reopen only affected calibration steps with an explanation.
- **D-08:** Keep incomplete optional steps visible without persistent nagging. Increase prominence only when a current decision depends on the missing step.

### Deterministic scenario narratives

- **D-09:** The golden journey uses a mid-range competitive Windows 11 PC with Intel CPU, NVIDIA GPU, a competitive shooter, safe opportunities, and partially complete evidence.
- **D-10:** Use a hybrid game model. A well-defined fictional game anchors the golden journey; real games and launchers may appear in discovery scenarios without implying an unvalidated integration.
- **D-11:** The golden recommendation story contains one ready Verified operation, one Advanced operation requiring review, and one excluded option with insufficient evidence. It ends in a no-change preview receipt.
- **D-12:** Organize S01-S24 into coherent scenario families built from a small set of recognizable PCs, games, and profiles. Each scenario should mutate a focused condition instead of inventing an unrelated world.

### Previews of future capabilities

- **D-13:** Implement complete no-effect journeys for critical workflows, including review, confirmation, failure, recovery, and receipt states. Secondary controls may terminate at a clear phase-boundary explanation.
- **D-14:** Account, subscription, support, and cloud-AI surfaces behave as functional deterministic shells. Navigation, forms, validation, and local states work, but authentication, submission, or remote effect ends at an explicit boundary without simulated external success.
- **D-15:** Privileged-action previews end with an auditable scenario receipt that says no change occurred, lists what would have been requested, and creates a scenario-marked Activity entry.
- **D-16:** A secondary control without a complete journey opens a concise, actionable explanation naming the unavailable capability, its owning future phase, and relevant documentation or an available demonstration scenario.

### First-launch defaults

- **D-17:** Detect the Windows locale on first launch: use PT-BR for Brazilian Portuguese and English otherwise. Language switching must be visible before consent decisions.
- **D-18:** Start with Comfortable density. Compact remains an explicit user preference.
- **D-19:** Closing the window exits the interface by default. Remaining in the tray requires explicit opt-in during calibration or later in Settings.
- **D-20:** A clean development/test installation starts in S01 at first calibration. The scenario selector may switch scenarios and remember the most recent selection afterward.

### The agent's Discretion

- Choose exact fictional game, profile, operation, hardware model, evidence source, and localized names within the scenario narrative constraints.
- Decide the precise family membership for S02-S24 while keeping each scenario's required condition and the UI-SPEC matrix intact.
- Decide which secondary controls receive a complete journey after all critical workflows are covered; every abbreviated path must follow D-16.
- Choose implementation details, component boundaries, state-machine structure, and test decomposition while preserving the canonical contracts and architecture policy.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within the Phase 2 boundary.
</user_constraints>

## Summary

Phase 2 should be planned as four cooperating products, not as one long screen-building effort: (1) a least-privilege Windows/Tauri shell, (2) an authored token and accessible component system, (3) typed feature workflows and route compositions, and (4) a deterministic scenario plus verification platform. The repository already enforces the dependency order `generated + application + design <- feature <- composition`, provides a validated desktop-client boundary, and rejects fixture-backed production composition. Phase 2 must activate the reserved `design-tokens`, `design-system`, `feature-shell`, and `desktop-app` roots without bypassing those authorities. [VERIFIED: architecture/module-boundaries.json] [VERIFIED: packages/desktop-client/src/client.ts] [VERIFIED: architecture/decisions/0004-truth-provenance-and-fixture-boundary.md]

The most important planning rule is to implement reusable state semantics before multiplying routes. Every surface must consume the same provenance, freshness, quality, operational-state, phase-boundary, receipt, and Activity models. The S01-S24 catalog should be a small set of immutable scenario families plus focused deltas, with frozen time, seed, locale, latency, and adapter identity. Screens then become projections of typed scenario state rather than isolated mockups. [VERIFIED: .planning/phases/02-complete-desktop-experience/02-UI-SPEC.md] [VERIFIED: .planning/phases/02-complete-desktop-experience/02-CONTEXT.md]

The final gate must include both browser-level visual/accessibility coverage and packaged Windows journeys. A browser test cannot prove installer signing, non-elevation, single-instance routing, tray behavior, native window controls, WebView2 startup, or production fixture rejection. Conversely, packaged E2E is too slow to own every component state. [VERIFIED: .planning/phases/02-complete-desktop-experience/02-UI-SPEC.md] [CITED: https://v2.tauri.app/develop/tests/webdriver/]

**Primary recommendation:** plan vertical waves around shared contracts and state machines, but establish tokens, scenario infrastructure, test harnesses, and Tauri capabilities in Wave 0 before feature routes fan out.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Installer, signing, WebView2, native window, tray, deep links, notifications | Tauri composition / Rust host | Windows packaging and CI | These are OS-bound behaviors and must not be modeled as browser-only UI. [CITED: https://v2.tauri.app/distribute/windows-installer/] |
| Scenario selection and deterministic fixture transport | Adapter (`packages/desktop-simulator`) | Desktop client application boundary | Fixture construction remains outside production UI composition; both adapter types conform to the client port. [VERIFIED: architecture/module-boundaries.json] |
| Provenance validation and domain-facing truth | Application/generated (`desktop-client`, `contracts-ts`) | Feature presentation | Validation precedes mapping to frozen native truth; features render but do not reinterpret provenance. [VERIFIED: packages/desktop-client/src/client.ts] |
| Tokens and behavior-wrapped UI primitives | Design (`design-tokens`, `design-system`) | Feature shell | The executable boundary reserves these roots and allows feature code to depend on design, not the reverse. [VERIFIED: architecture/module-boundaries.json] |
| Calibration, preview, recovery, favorites, Activity workflows | Feature (`feature-shell`) | Adapter ports and design primitives | Workflow state belongs above application ports and below composition. [VERIFIED: architecture/module-boundaries.json] |
| Route tree, locale/provider wiring, scenario-vs-production composition | Composition (`apps/desktop`) | Feature and adapter public roots | Only composition selects adapters and assembles the application. [VERIFIED: architecture/module-boundaries.json] |
| Remote authentication, billing, AI, support upload, real optimization | Future backend/privileged phases | Phase-boundary UI only | Phase 2 may validate local form flow but must not simulate external success or effects. [VERIFIED: 02-CONTEXT.md D-13 through D-16] |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| UX-01 | User can install and open the non-elevated Windows desktop app through a signed Tauri package | Tauri shell/package wave; explicit capabilities; WebView2 and Authenticode gates; packaged smoke and non-elevation assertion. [VERIFIED: .planning/REQUIREMENTS.md] |
| UX-02 | User completes a guided first-run calibration covering inventory, diagnosis, restore readiness, goals, and priority games | XState calibration machine, resumable progress, limited mode, partial revalidation, S01/S06/S14/S22. [VERIFIED: 02-CONTEXT.md D-01 through D-08] |
| UX-03 | User sees a contextual home prioritizing the next recommended action, selected game profile, and current system state | Fixed three-region Home projection with progressive evidence and one focal CTA. [VERIFIED: 02-UI-SPEC.md sections 7 and 8] |
| UX-04 | User can navigate primary areas by goal and drill into technical details by hardware or Windows component | Typed route tree and goal-to-component feature model. [VERIFIED: 02-UI-SPEC.md section 6] |
| UX-05 | User can search modules, games, settings, history, documentation, and safe actions from a global command center | Local deterministic search index, React Aria dialog/listbox semantics, safe-action routing rather than inline execution. [VERIFIED: 02-UI-SPEC.md UX-05] |
| UX-06 | User can pin games, metrics, and actions without breaking the curated information hierarchy | Typed bounded favorites model plus keyboard reorder; limits enforced in domain logic and tests. [VERIFIED: 02-UI-SPEC.md UX-06] |
| UX-07 | User sees complete loading, empty, offline, permission, unsupported, partial-failure, restart-pending, recovery, and expired-entitlement states | Shared operational-state union and reusable state compositions exercised by S01-S24. [VERIFIED: 02-UI-SPEC.md UX-07] |
| UX-08 | User can review current activity and prior notifications through a priority-based activity center | Deterministic Activity store/model with priority groups, correlation IDs, filters, acknowledgement rules, and overlay/route projections. [VERIFIED: 02-UI-SPEC.md UX-08] |
| UX-09 | User receives discreet normal feedback and Windows-level notifications only for actionable or critical events | Feedback policy mapper separates inline, toast, Activity, and native notification channels. [VERIFIED: 02-UI-SPEC.md UX-09] |
| UX-10 | User can operate the complete desktop experience with keyboard and assistive technology at WCAG 2.2 AA | React Aria behavior wrappers, route-focus protocol, axe/keyboard automation, NVDA and forced-colors manual gates. [VERIFIED: 02-UI-SPEC.md sections 16 and 19] |
| UX-11 | User can use the desktop experience in PT-BR or English without clipped or untranslated product-critical content | Semantic catalogs, Intl formatters, pseudo-locale, missing-key gate, 35–40% expansion tests, full matrix sampling. [VERIFIED: 02-UI-SPEC.md section 17] |
| UX-12 | User can enable reduced motion, scale the interface, and understand every status without relying on color alone | Central preference model, token-level scale/density/motion modes, icon+label+pattern status API, forced-colors and 150% scale tests. [VERIFIED: 02-UI-SPEC.md UX-12] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Use Windows 10/11, Tauri 2, Rust, React, Vite, and strict TypeScript; the desktop renderer is not Next.js. [VERIFIED: AGENTS.md]
- Use the pinned mutually compatible stack, including Node 24.18.0, pnpm 11.17.0, Rust 1.97.1, TypeScript 6.0.3, React 19.2.8, Vite 8.1.5, and Tauri 2.11. [VERIFIED: AGENTS.md]
- Critical contracts come from one language-neutral source and generated TypeScript/Rust artifacts; do not create parallel handwritten DTOs. [VERIFIED: AGENTS.md]
- The UI remains non-elevated; future privileged work is isolated, operation-specific, allowlisted, explainable, auditable, and reversible. [VERIFIED: AGENTS.md]
- No arbitrary scripts, generic registry/file/service RPCs, fake privileged operations, or remote execution. [VERIFIED: AGENTS.md]
- Fixture, observed, measured, modeled, and unavailable truth must remain explicit; production may not fall back to fixture data. [VERIFIED: architecture/decisions/0004-truth-provenance-and-fixture-boundary.md]
- Accessibility is WCAG 2.2 AA with keyboard, screen-reader, scaling, forced-colors, reduced-motion, and color-independent status behavior. [VERIFIED: AGENTS.md]
- PT-BR and English ship together; privacy-sensitive connected features remain consent-bound and disabled by default. [VERIFIED: AGENTS.md]
- Cross-cutting acceptance must cover security, privacy, accessibility, performance, and recovery for each UX requirement. [VERIFIED: architecture/decisions/0005-cross-cutting-acceptance-policy.md]
- Activate only declared roots and dependency directions; imports use public roots and no production-to-fixture edge is allowed. [VERIFIED: architecture/module-boundaries.json]
- Use RTK-prefixed shell commands. Repository edits must run through a GSD workflow and use `apply_patch`; this research was dispatched by the GSD plan workflow. [VERIFIED: AGENTS.md]
- Do not introduce shadcn, dashboard templates, third-party component registries, inherited visual systems, generic card grids, glass/RGB decoration, fake live telemetry, or dead controls. [VERIFIED: 02-UI-SPEC.md]

## Standard Stack

### Core

| Library/tool | Version | Purpose | Planning rule |
|---|---:|---|---|
| React / React DOM | 19.2.8 | Renderer and component composition | Use strict concurrent-safe components; never store adapter truth in DOM-only state. Exact version exists in npm registry but was flagged `SUS` only because the release is less than 30 days old; add a pre-install checkpoint. [VERIFIED: npm registry] |
| Vite | 8.1.5 | Desktop renderer build | Use as the Tauri frontend; Node 24.18.0 satisfies the project compatibility decision. `SUS` too-new checkpoint required. [VERIFIED: npm registry] |
| Tauri Rust / JS / CLI | 2.11.5 / 2.11.1 / 2.11.4 | Native shell, window, capabilities, build and bundle | Keep OS integration in Rust/Tauri composition and grant minimum command permissions. [CITED: https://v2.tauri.app/security/capabilities/] |
| TypeScript | 6.0.3 | Strict UI and scenario typing | Keep the project pin; do not advance to TypeScript 7 while the locked lint range excludes it. [VERIFIED: package.json] |
| Tailwind CSS / Vite plugin | 4.3.3 | Token-backed utility infrastructure | Utilities consume authored CSS variables; tokens stay in `design-tokens`. `SUS` too-new checkpoint required. [VERIFIED: npm registry] |
| React Aria Components | 1.19.0 | Accessible behavior primitives | Wrap behavior behind `Lb*` exports and author all visuals. [CITED: https://react-spectrum.adobe.com/react-aria/styling.html] |
| TanStack Router / router plugin | 1.170.18 / 1.168.23 | Typed route tree and generated route integration | Validate route search state; use params/search/state separately; never encode privileged intent. [CITED: https://tanstack.com/router/latest/docs/guide/search-params.md] |
| XState / `@xstate/react` | 5.32.5 / 6.1.0 | Safety-critical workflows | Own calibration, plan preview, restart, interruption, recovery, and resume as explicit machines. `xstate` requires a too-new checkpoint; React binding passed legitimacy. [VERIFIED: npm registry] |
| `@liiiraa/desktop-client` | workspace | Validated application port and frozen truth values | All feature data enters through public client contracts; do not import simulator constructors into production features. [VERIFIED: packages/desktop-client/src/index.ts] |

### Supporting

| Library/tool | Version | Purpose | When to use |
|---|---:|---|---|
| TanStack Query | 5.101.4 | Async cache and cancellation | Wrap desktop-client requests and future API state, not workflow state. `SUS` too-new checkpoint required. [VERIFIED: npm registry] |
| Motion | 12.42.2 | Purposeful transitions | Only the locked durations/transforms; reduced motion removes translation/scale/interpolation. `SUS` too-new checkpoint required. [VERIFIED: npm registry] |
| uPlot | 1.6.32 | Dense time-series rendering | Only after measurement shows authored DOM/SVG is insufficient; always provide summary/table. [VERIFIED: npm registry] |
| React Hook Form | 7.83.0 | Complex settings/account/support shell forms | Combine with contract-derived validation; preserve input after recoverable failures. `SUS` too-new checkpoint required. [VERIFIED: npm registry] |
| Lucide React | 1.27.0 | Curated outline icons | Use only the approved outline subset; custom SVG for product/provenance/risk/topology/recovery. `SUS` too-new checkpoint required. [VERIFIED: npm registry] |
| React Intl / FormatJS CLI | 10.1.18 / 6.16.14 | Semantic messages, ICU formatting, extraction and compilation | Recommended for desktop catalogs and missing-message checks. This is an agent-discretion choice and both packages require a too-new checkpoint. [CITED: https://formatjs.github.io/docs/react-intl/] |
| Storybook React-Vite | 10.5.4 | Component and state catalog | Catalog every primitive/workflow component across locale, scale, motion, forced-colors, and operational state. `SUS` too-new checkpoint required. [VERIFIED: npm registry] |
| Playwright / axe Playwright | 1.62.0 / 4.12.1 | Browser E2E, screenshots, keyboard and automated accessibility | Freeze clock/seed/locale/animation before screenshots. Playwright requires a too-new checkpoint; axe passed legitimacy. [VERIFIED: npm registry] |
| Vitest | 4.1.10 | Unit, contract, machine and component logic tests | Already installed at root; use fast requirement-scoped tests per task. [VERIFIED: package.json] |
| Tauri plugins | see audit | Single instance, deep link, notification, updater, window state, process | Register only required plugins and capabilities; single-instance must be registered first. [CITED: https://v2.tauri.app/plugin/single-instance/] |
| `tauri-driver` | 2.0.6 | Direct packaged desktop automation | Keep the locked project choice unless a reviewed stack change adopts the currently recommended WebdriverIO service. [CITED: https://v2.tauri.app/develop/tests/webdriver/] |

### Installation boundaries

Install packages in their owning workspace, never at root by convenience. The planner should split installs into `packages/design-system`, `packages/feature-shell`, and `apps/desktop`, then update `architecture/module-boundaries.json` statuses and public roots in the same wave. [VERIFIED: architecture/decisions/0003-module-ownership-and-direction.md]

Do not install `@tauri-apps/plugin-single-instance`: the npm package does not exist; the integration is the Rust crate `tauri-plugin-single-instance`. [VERIFIED: package-legitimacy seam] Use `@tauri-apps/plugin-deep-link`, `@tauri-apps/plugin-notification`, `@tauri-apps/plugin-updater`, and `@tauri-apps/plugin-window-state` only when frontend APIs are required. [VERIFIED: npm registry]

## Package Legitimacy Audit

The audit was executed against npm and crates.io on 2026-07-27. Weekly downloads are the values returned by the audit seam and are a point-in-time signal. [VERIFIED: package-legitimacy seam]

| Package group | Registry | Latest/pin checked | Downloads/source | Verdict | Disposition |
|---|---|---|---|---|---|
| React, React DOM | npm | 19.2.8, published 2026-07-21 | 162.7M/153.8M weekly; `react/react` | SUS: too-new | Keep project pin; checkpoint before install |
| Vite, React plugin | npm | 8.1.5 / 6.0.4 | 156.9M/75.5M weekly; official Vite repos | SUS: too-new | Keep; checkpoint |
| Tauri JS API | npm | 2.11.1 | 2.08M weekly; `tauri-apps/tauri` | OK | Approved |
| Tauri CLI | npm | 2.11.4 | 1.78M weekly; `tauri-apps/tauri` | SUS: too-new | Keep; checkpoint |
| Tailwind and Vite plugin | npm | 4.3.3 | 115.1M/41.8M weekly; `tailwindlabs/tailwindcss` | SUS: too-new | Keep project pin; checkpoint |
| React Aria Components | npm | 1.19.0 | 3.57M weekly; `adobe/react-spectrum` | OK | Approved |
| TanStack Router/plugin/Query | npm | 1.170.18 / 1.168.23 / 5.101.4 | 20M+ / 61.4M weekly; official TanStack repos | SUS: too-new | Keep compatible pins; checkpoint |
| XState / React binding | npm | 5.32.5 / 6.1.0 | 5.06M/3.02M weekly; `statelyai/xstate` | SUS / OK | Checkpoint XState; approve binding |
| Motion | npm | 12.42.2 | 16.3M weekly; official repo | SUS: too-new | Keep; checkpoint |
| uPlot | npm | 1.6.32 | 490K weekly; `leeoniya/uPlot` | OK | Approved |
| React Hook Form | npm | 7.83.0 | 57.6M weekly; official repo | SUS: too-new | Keep; checkpoint |
| Lucide React | npm | 1.27.0 | 96.8M weekly; official repo | SUS: too-new | Keep; checkpoint |
| React Intl / FormatJS CLI | npm | 10.1.18 / 6.16.14 | 3.37M/847K weekly; `formatjs/formatjs` | SUS: too-new | Agent-discretion recommendation; checkpoint |
| Storybook / React-Vite | npm | 10.5.4 | 19.98M/12.24M weekly; official repo | SUS: too-new | Keep project pin; checkpoint |
| Playwright / axe | npm | 1.62.0 / 4.12.1 | 48.4M/6.88M weekly; official repos | SUS / OK | Checkpoint Playwright; approve axe |
| Tauri core and required Rust plugins | crates.io | core 2.11.5; single-instance 2.4.3; deep-link 2.4.9; notification 2.3.3; updater 2.10.1; window-state 2.4.1; process 2.3.1 | Established official Tauri repositories | OK | Approved |
| `@tauri-apps/plugin-single-instance` | npm | Does not exist | none | SLOP | REMOVED; use Rust crate |
| `msw` | npm | Registry package exists | 19.35M weekly; local postinstall was flagged | SLOP by required seam | REMOVED from Phase 2 plan; use the existing deterministic adapter port |

**Packages removed due to SLOP verdict:** `@tauri-apps/plugin-single-instance`, `msw`.

**Packages flagged as suspicious:** all rows marked SUS. The signal was `too-new`, not missing repository or low adoption. The planner must put a human verification checkpoint immediately before the atomic install containing each flagged pin. [VERIFIED: package-legitimacy seam]

The removal of `msw` conflicts with the broader stack document's visual-milestone suggestion. The phase can proceed without request interception because the repository already has a deterministic desktop adapter port; if HTTP mocking becomes necessary, resolve the package-gate conflict through a reviewed dependency decision rather than silently installing it. [VERIFIED: packages/desktop-simulator/src/index.ts]

## Architecture Patterns

### System Architecture Diagram

```text
Windows launch / deep link / tray / notification
                      |
                      v
             Tauri Rust composition
       capabilities + single instance + window
                      |
          selects build-time adapter identity
             /                         \
   development/test                 production
 desktop-simulator S01-S24    production-reference (fail closed)
             \                         /
                      v
            desktop-client validation
       generated schemas -> frozen truth values
                      |
                      v
        TanStack Query + XState feature actors
                      |
             +--------+---------+
             |                  |
      feature-shell       design-system
     routes/workflows     behavior + visuals
             \                  /
                      v
             apps/desktop renderer
                      |
        Storybook/browser tests + packaged E2E
```

[VERIFIED: architecture/module-boundaries.json] [VERIFIED: architecture/decisions/0004-truth-provenance-and-fixture-boundary.md]

### Recommended Project Structure

```text
packages/
  design-tokens/
    src/                 # color, spacing, type, scale, density, motion contracts
  design-system/
    src/primitives/      # Lb* React Aria wrappers
    src/evidence/        # provenance, quality, freshness, status
    src/workflows/       # reusable workflow compositions
    src/data/            # charts, tables, timelines with text alternatives
  feature-shell/
    src/model/           # operational state, favorites, activity, phase boundaries
    src/machines/        # calibration, preview, recovery, restart
    src/features/        # home/prepare/improve/measure/recover/assistant/etc.
    src/routes/          # route-facing feature exports, no adapter construction
  desktop-simulator/
    src/scenarios/       # families, deltas, frozen clock/seed/locale/latency
apps/
  desktop/
    src/composition/     # providers and adapter selection
    src/routes/          # TanStack route tree
    src-tauri/           # Rust shell, plugins, capabilities, bundle config
    e2e/                 # browser and packaged journeys
```

[VERIFIED: architecture/module-boundaries.json] [ASSUMED: exact internal folder names are a planner-level recommendation]

### Pattern 1: Ports, projections, and receipts

The simulator returns validated transport data through `desktop-client`; feature selectors project it into view models; the UI never constructs fixture truth. Future-action previews return a scenario receipt and append a scenario-marked Activity event through the same typed workflow outcome. [VERIFIED: packages/desktop-client/src/client.ts] [VERIFIED: 02-CONTEXT.md D-15]

### Pattern 2: One closed union for operational states

Define loading, empty, offline, permission, unsupported, partial failure, restart pending, recovery, expired entitlement, stale, contradictory, fixture, and ready as a discriminated union with state-specific required fields. Each route renders the shared state composition inside the affected region. This prevents generic toasts and missing recovery actions. [VERIFIED: 02-UI-SPEC.md UX-07]

### Pattern 3: Explicit workflow machines

Use separate but composable machines:

- calibration: mandatory gates, optional steps, save/resume, limited mode, partial revalidation;
- plan preview: review → validate → recovery-ready → confirm → preview → verify → receipt;
- interruption/recovery: paused → guided recovery → verified;
- restart: pending → scheduled/deferred → resumed/verified;
- overlay/navigation focus: command center, inspector, Activity, dialogs.

[VERIFIED: 02-UI-SPEC.md section 11] [CITED: https://stately.ai/docs/xstate]

Persist only stable progress inputs and machine state that can be revalidated; do not persist actors, callbacks, promises, or fixture objects directly. [ASSUMED]

### Pattern 4: Typed route state with return intents

Use route params for stable identities, validated search params for filters/inspector targets, and history state or a typed in-memory return intent for calibration detours. Never place destructive or privileged intent in a link. [VERIFIED: 02-UI-SPEC.md section 6] [CITED: https://tanstack.com/router/latest/docs/guide/navigation.md]

### Pattern 5: Scenario families plus focused deltas

Create reusable PCs, games, entitlement states, evidence sources, and workflow outcomes. S01-S24 select a base family and mutate one or two conditions. Scenario IDs, seeds, clocks, locales, latencies, and expected provenance are immutable and become screenshot/E2E fixture IDs. [VERIFIED: 02-CONTEXT.md D-12] [VERIFIED: 02-UI-SPEC.md section 18]

### Pattern 6: Layered verification

- pure unit tests: reducers, selectors, formatters, limits, policy maps;
- machine tests: every transition, guard, retryability and receipt;
- component stories: visual/semantic state matrix;
- browser journeys: route, keyboard, axe and screenshots;
- packaged Windows journeys: installer/signature/non-elevation/window/tray/deep-link/fixture rejection.

[VERIFIED: 02-UI-SPEC.md section 19]

### Suggested Planning Waves

1. **Wave 0 — toolchain and policy:** correct Node version; activate module roots; create Tauri/Vite skeleton; pin dependencies after checkpoints; add Vitest, Storybook, Playwright, axe and packaged E2E configs; add Phase 2 quality manifests. [VERIFIED: package.json]  
2. **Wave 1 — truth and scenario platform:** extend canonical contracts/client port; implement scenario families and S01-S24 metadata; production fixture rejection and receipts. [VERIFIED: architecture/decisions/0004-truth-provenance-and-fixture-boundary.md]  
3. **Wave 2 — tokens and accessible primitives:** fonts, tokens, scale/density/motion, React Aria wrappers, evidence/status components, forced-colors and pseudo-locale. [VERIFIED: 02-UI-SPEC.md sections 3–4, 10, 15–17]  
4. **Wave 3 — native shell:** startup/splash/failure, window state, title bar, single instance, deep links, tray, notification policy, updater surfaces, bundle/signing. [CITED: https://v2.tauri.app/learn/window-customization/]  
5. **Wave 4 — calibration and Home:** implement D-01–D-08 and Home fixed hierarchy; gate normal Home only on trust/inventory. [VERIFIED: 02-CONTEXT.md]  
6. **Wave 5 — goal shell and core utilities:** route tree, command center, favorites, Activity, settings, locale/accessibility controls. [VERIFIED: 02-UI-SPEC.md sections 5–8]  
7. **Wave 6 — future product surfaces:** Prepare, Improve, Measure, Recover, Assistant, Account, support and documentation with complete critical no-effect journeys and explicit phase boundaries. [VERIFIED: 02-CONTEXT.md D-13–D-16]  
8. **Wave 7 — exhaustive state matrix:** bind every route to required operational states and close scenario/story/screenshot gaps. [VERIFIED: 02-UI-SPEC.md sections 8, 18, 19]  
9. **Wave 8 — packaged acceptance:** signed installer, clean Windows 11/10 runs, NVDA, high contrast, scale, memory/startup measurements, final quality manifests. [VERIFIED: 02-UI-SPEC.md section 19]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Menus, dialogs, comboboxes, tabs, listboxes, tooltips | Custom keyboard/ARIA primitives | React Aria Components behind `Lb*` wrappers | Focus, modality, dismissal and semantic details are deceptively complex. [CITED: https://react-spectrum.adobe.com/react-aria/] |
| Workflow orchestration | Booleans distributed across components | XState machines with explicit guards/events | Safety and recovery states need inspectable transitions. [VERIFIED: project stack] |
| URL/search serialization | Ad hoc parsing and string concatenation | TanStack Router validated search params | Typed structured search state and history behavior are already provided. [CITED: https://tanstack.com/router/latest/docs/guide/search-params.md] |
| Locale formatting and message concatenation | Handwritten plural/date/number rules | React Intl/FormatJS plus native Intl | Product-critical bilingual copy needs extraction and whole-message formatting. [CITED: https://formatjs.github.io/docs/react-intl/] |
| Windows tray/single instance/deep link/window persistence | Browser polyfills or custom Win32 glue | Tauri core and official plugins | These capabilities require native lifecycle integration. [CITED: https://v2.tauri.app/plugin/single-instance/] |
| Fixture truth | UI-local JSON mocks | `desktop-simulator` → `desktop-client` | The repository already enforces adapter identity and runtime validation. [VERIFIED: packages/desktop-simulator/src/index.ts] |
| Visual controls | shadcn, dashboard kits, copied registry blocks | Authored design-system components | The locked visual identity rejects inherited template language. [VERIFIED: 02-UI-SPEC.md] |
| Charts | Canvas decoration without semantics | Owned wrappers and uPlot only for dense series | Every plot needs keyboard cursor, table and summary. [VERIFIED: 02-UI-SPEC.md section 14] |
| Signing or cryptography | Custom signatures or embedded secrets | Authenticode/Tauri updater signing through CI secret provider | Signing identity and private-key custody are security boundaries. [CITED: https://v2.tauri.app/distribute/sign/windows/] |

## Common Pitfalls

### Fixture data becomes “real” through presentation

**What goes wrong:** a component omits the scenario marker or translates `fixture` into “live.”  
**Avoidance:** provenance is a required field in view models, scenario marker is shell-level and evidence-group-level, production composition rejects fixture adapter identity, and screenshots assert labels. [VERIFIED: 02-UI-SPEC.md truth boundary]

### Route count drives duplicated state logic

**What goes wrong:** dozens of routes each implement their own loading/offline/error copy.  
**Avoidance:** build the operational-state union and shared state compositions before route fan-out; require every scenario/state mapping in one manifest. [VERIFIED: 02-UI-SPEC.md UX-07]

### A custom title bar regresses native Windows behavior

**What goes wrong:** snap layouts, Alt+Space, drag exclusions, double-click maximize, touch/pen, or forced-colors behavior breaks.  
**Avoidance:** keep window controls backed by Tauri window APIs, narrowly mark drag regions, test on real Windows, and treat UI-SPEC native behavior as acceptance. [CITED: https://v2.tauri.app/learn/window-customization/]

### Preview success reads like real success

**What goes wrong:** simulated apply/account/upload/AI flows end with generic success copy.  
**Avoidance:** all future-effect journeys terminate in a no-change receipt or explicit phase-boundary explanation and scenario-marked Activity entry. [VERIFIED: 02-CONTEXT.md D-13–D-16]

### Optional calibration becomes a global lock or nag

**What goes wrong:** deferred evidence blocks the app or is permanently promoted.  
**Avoidance:** only trust/privacy and basic inventory gate Home; later actions open the exact missing step with a return intent. [VERIFIED: 02-CONTEXT.md D-01–D-08]

### Accessibility is tested only with axe

**What goes wrong:** automated scans pass while focus order, announcements, chart alternatives, high contrast, 200% text, or keyboard recovery fails.  
**Avoidance:** combine axe with keyboard E2E and required NVDA/forced-colors/scaling manual gates. [VERIFIED: 02-UI-SPEC.md section 19]

### Screenshot matrix becomes unmaintainable

**What goes wrong:** every route × scenario × locale × viewport is captured indiscriminately.  
**Avoidance:** use the locked required-route matrix, pairwise non-critical coverage, and full critical-flow coverage; freeze dynamic inputs and require a design-contract reason for baseline updates. [VERIFIED: 02-UI-SPEC.md section 19]

### Browser tests are mistaken for desktop acceptance

**What goes wrong:** the app looks complete in Chromium but bundle, elevation, WebView2, tray, deep links, or single instance are broken.  
**Avoidance:** reserve packaged journeys for native contracts and keep browser suites for fast UI breadth. [CITED: https://v2.tauri.app/develop/tests/webdriver/]

### Exact toolchain pin is ignored

**What goes wrong:** npm commands fail because the local Node runtime is v24.16.0 while the repository requires 24.18.0.  
**Avoidance:** toolchain correction is the first Wave 0 task and a CI preflight. [VERIFIED: environment probe] [VERIFIED: package.json]

## Code Examples

### Typed search state

```tsx
// Source: https://tanstack.com/router/latest/docs/guide/search-params.md
export const Route = createFileRoute('/improve/components/$componentId')({
  validateSearch: (input): ComponentSearch => ({
    goal: isGoal(input.goal) ? input.goal : 'performance',
    inspector: typeof input.inspector === 'string' ? input.inspector : undefined,
  }),
})
```

### Tauri single-instance first registration

```rust
// Source: https://v2.tauri.app/plugin/single-instance/
tauri::Builder::default()
  .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
    // Parse only allowlisted routes, focus the existing window, then emit navigation intent.
  }))
  // Register remaining plugins after single-instance.
```

### Scenario construction stays outside the feature layer

```ts
// Source pattern: packages/desktop-simulator/src/index.ts
const client = createDesktopSimulatorClient({
  scenario: 'standard',
  clock: () => '2026-07-27T12:00:00.000Z',
  inspectionIds: () => 'fixture-inspection-s01',
})
```

### Closed operational-state model

```ts
// Research recommendation derived from 02-UI-SPEC.md UX-07.
type OperationalState =
  | { kind: 'ready' }
  | { kind: 'loading'; step: MessageId; cancellable: boolean }
  | { kind: 'offline'; lastValidatedAt: string; localCapabilities: readonly CapabilityId[] }
  | { kind: 'unsupported'; reason: MessageId; documentationId: string }
  | { kind: 'partial-failure'; completed: readonly StepId[]; failedDependency: string; diagnosticId: string }
  | { kind: 'restart-pending'; dependencies: readonly OperationId[] }
  | { kind: 'recovery'; trigger: MessageId; affected: readonly OperationId[]; verified: boolean }
  | { kind: 'expired-entitlement'; retained: readonly ('history' | 'warnings' | 'recovery')[] }
```

## State of the Art

| Older/default approach | Current project approach | Impact |
|---|---|---|
| Generic dashboard card grids | Goal-first “Pre-Dawn Flight Deck” composition | Plan screen hierarchy and shared narrative regions, not widgets. [VERIFIED: 02-UI-SPEC.md] |
| UI booleans for multi-step flows | XState v5 explicit machines | Machine tests become the main workflow specification. [VERIFIED: project stack] |
| Flat string query parameters | TanStack Router JSON-first validated search state | Filters and inspectors stay typed and restorable. [CITED: https://tanstack.com/router/latest/docs/guide/search-params.md] |
| Tauri direct driver as general recommendation | Current Tauri docs recommend WebdriverIO with `@wdio/tauri-service`, while still documenting direct `tauri-driver` | Keep the project pin for this phase but isolate the harness and record the divergence. [CITED: https://v2.tauri.app/develop/tests/webdriver/] |
| Hidden fixture switches | Compile/static/runtime/artifact/process fixture defenses | Scenario UI must preserve all five defenses, not only a badge. [VERIFIED: ADR 0004] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The suggested internal folders under each declared package are optimal. | Project Structure | Low; public roots and dependency layers remain authoritative. |
| A2 | Persisting only stable machine inputs/state and revalidating actors is the correct resume strategy. | Architecture Patterns | Medium; exact XState persistence API should be confirmed during implementation. |
| A3 | React Intl/FormatJS is the preferred framework-neutral desktop catalog implementation. | Standard Stack | Medium; project stack requires a framework-neutral catalog but does not lock this package. |
| A4 | One consolidated human checkpoint may review all exact SUS pins in an atomic install. | Package Audit | Medium; the package-gate wording may require individual checkpoint records. |

## Open Questions

1. **Which Authenticode provider and certificate identity will satisfy UX-01?**
   - Known: a signed Tauri package is required and Tauri documents Windows signing flows. [CITED: https://v2.tauri.app/distribute/sign/windows/]
   - Unknown: provider, certificate type, secret custody, timestamp server, and CI access are not defined in repository evidence.
   - Recommendation: make signing-provider selection an early human checkpoint; implementation may proceed with unsigned local builds, but UX-01 cannot pass final acceptance without a verifiable signature.

2. **Keep direct `tauri-driver` or adopt the current recommended WebdriverIO service?**
   - Known: the project stack pins `tauri-driver` 2.0.6; current official Tauri docs recommend `@wdio/tauri-service` and still support direct driving. [VERIFIED: AGENTS.md] [CITED: https://v2.tauri.app/develop/tests/webdriver/]
   - Recommendation: keep the locked pin for planning and isolate the driver adapter; change only through a reviewed stack decision.

3. **How should the `msw` audit conflict be resolved?**
   - Known: the project stack mentions MSW, while the mandatory legitimacy seam returned SLOP because of a postinstall signal. The desktop simulator already provides a deterministic port. [VERIFIED: package-legitimacy seam]
   - Recommendation: omit MSW from Phase 2; reopen only if a concrete HTTP boundary cannot be exercised through the client port.

4. **Which clean Windows 10 images are supported for packaged acceptance?**
   - Known: Windows 10/11 is required; this host is Windows 11 only. [VERIFIED: AGENTS.md] [VERIFIED: environment probe]
   - Recommendation: define CI runner/image provenance before packaged acceptance wave.

## Environment Availability

| Dependency | Required by | Available | Version/evidence | Fallback |
|---|---|---:|---|---|
| Node.js | all TS/UI work | Wrong version | v24.16.0; repo requires 24.18.0 | Upgrade before installs/tests. [VERIFIED: environment probe] |
| pnpm | workspace | Yes | 11.17.0 | — [VERIFIED: environment probe] |
| Rust / Cargo | Tauri shell | Yes | 1.97.1 | — [VERIFIED: environment probe] |
| Windows | packaged development | Yes | Windows 11 Pro 10.0.26200 x64 | Windows 10 still needs CI/VM. [VERIFIED: environment probe] |
| `tauri-driver` | packaged E2E | No | command not found | Install pinned 2.0.6 in Wave 0. [VERIFIED: environment probe] |
| EdgeDriver | direct Windows WebDriver | No | command not found | Install matching driver or use reviewed service change. [VERIFIED: environment probe] |
| WebView2 Runtime | runtime/startup tests | Not detected by probes | registry and standard application path yielded no result | Installer bootstrapper and clean-VM verification. [VERIFIED: environment probe] |
| Visual Studio C++ build tools | Windows Tauri link/bundle | Not detected on PATH/standard probes | `cl`/`link` not found | Install Tauri Windows prerequisites. [CITED: https://v2.tauri.app/start/prerequisites/] |
| Authenticode certificate/provider | signed installer | Unknown | no repository evidence | No final-acceptance fallback. [ASSUMED] |
| NVDA / Windows 10 runner | manual accessibility/support matrix | Not probed/available | no evidence | Provision before final acceptance. [ASSUMED] |

**Missing dependencies with no final fallback:** correct Node version, Authenticode signing identity, supported Windows 10 packaged runner.

**Missing dependencies with implementation fallback:** direct driver, EdgeDriver, WebView2, and build tools can be installed in Wave 0; browser tests can advance UI work but cannot replace packaged acceptance.

## Validation Architecture

Nyquist validation and TDD are enabled. [VERIFIED: .planning/config.json]

### Test Framework

| Property | Value |
|---|---|
| Unit/machine | Vitest 4.1.10; existing root Turbo test graph. [VERIFIED: package.json] |
| Component | Storybook 10.5.4 + React-Vite; config absent, create in Wave 0. [VERIFIED: repo scan] |
| Browser E2E/visual | Playwright 1.62.0 + axe 4.12.1; config absent, create in Wave 0. [VERIFIED: repo scan] |
| Packaged desktop | `tauri-driver` 2.0.6; harness absent, create in Wave 0. [VERIFIED: repo scan] |
| Quick run | `pnpm --filter <owner> test -- --run` |
| Wave run | `pnpm verify:quick` plus requirement-scoped Storybook/Playwright suites |
| Phase gate | `pnpm verify` plus packaged Windows, NVDA, forced-colors, scale, startup/memory and signature evidence |

### Phase Requirements → Test Map

| Req | Primary automated test | Under-30-second task command | Exists? |
|---|---|---|---|
| UX-01 | Tauri config/capability unit + packaged smoke/signature/non-elevation | `pnpm --filter @liiiraa/desktop test -- --run -t UX-01` | No — Wave 0 |
| UX-02 | Calibration machine transition/guard tests | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-02` | No — Wave 0 |
| UX-03 | Home selector/component stories for evidence variants | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-03` | No — Wave 0 |
| UX-04 | Route-generation/type tests and navigation E2E | `pnpm --filter @liiiraa/desktop test -- --run -t UX-04` | No — Wave 0 |
| UX-05 | Search ranking, safe-action routing, keyboard interaction | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-05` | No — Wave 0 |
| UX-06 | Limit/reorder reducer plus keyboard dialog | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-06` | No — Wave 0 |
| UX-07 | Operational-state exhaustiveness and scenario coverage | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-07` | No — Wave 0 |
| UX-08 | Activity priority/ack/filter/correlation model | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-08` | No — Wave 0 |
| UX-09 | Feedback-channel policy plus native notification allowlist | `pnpm --filter @liiiraa/feature-shell test -- --run -t UX-09` | No — Wave 0 |
| UX-10 | axe + keyboard route journeys; manual NVDA gate | `pnpm --filter @liiiraa/desktop test:e2e -- --grep UX-10` | No — Wave 0 |
| UX-11 | catalog parity, missing keys, pseudo-locale and screenshot sampling | `pnpm --filter @liiiraa/desktop test -- --run -t UX-11` | No — Wave 0 |
| UX-12 | preference reducer, forced-colors/status semantics, scale screenshots | `pnpm --filter @liiiraa/desktop test:e2e -- --grep UX-12` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** owner-package Vitest target and typecheck.
- **Per wave merge:** `pnpm verify:quick`, affected Storybook interactions, axe, and scenario screenshots.
- **Phase gate:** root `pnpm verify`, full S01-S24 route matrix, packaged Windows 10/11 journeys, signature verification, NVDA/high-contrast/scale/reduced-motion manual evidence, and final acceptance manifests.

### Wave 0 Gaps

- [ ] Activate `packages/design-tokens`, `packages/design-system`, `packages/feature-shell`, and `apps/desktop` in executable architecture policy.
- [ ] Add Tauri/Vite/React workspace manifests, Rust host, capabilities, and bundle config.
- [ ] Add package-local Vitest configurations and shared deterministic clock/seed/locale helpers.
- [ ] Add Storybook config, a11y integration, locale/scale/motion/forced-colors decorators, and story completeness manifest.
- [ ] Add Playwright config, screenshot project matrix, axe fixture, keyboard helpers, and frozen dynamic data.
- [ ] Add packaged desktop driver harness and clean-install scripts.
- [ ] Add S01-S24 scenario manifest plus coverage test asserting every required route/state.
- [ ] Add `quality/features/ux-01.json` through `ux-12.json` with planned evidence for all five dimensions.
- [ ] Extend root required-artifact and verification reachability tests so new gates cannot be dropped.

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not disable it. [VERIFIED: .planning/config.json]

### Applicable ASVS Categories

| ASVS category | Applies | Phase 2 control |
|---|---|---|
| V1 Architecture | Yes | Executable module boundaries, fixture separation, public-root imports, quality manifests. [VERIFIED: architecture/module-boundaries.json] |
| V2 Authentication | Preview only | No local fake authentication success; system-browser handoff/callback is a deterministic boundary until Phase 4. [VERIFIED: 02-CONTEXT.md D-14] |
| V3 Session Management | Preview only | Signed-out/expired/offline shells only; no authoritative tokens in Phase 2. [VERIFIED: phase boundary] |
| V4 Access Control | Yes | Tauri capabilities are deny-by-default and privileged intent never executes from renderer/deep link/command center. [CITED: https://v2.tauri.app/security/capabilities/] |
| V5 Validation | Yes | Generated contract validators at external/adapter boundaries; validated route search; allowlisted deep links and notification actions. [VERIFIED: packages/desktop-client/src/client.ts] |
| V6 Cryptography | Yes for signing | Authenticode/Tauri updater mechanisms; no custom cryptography. [CITED: https://v2.tauri.app/distribute/sign/windows/] |
| V7 Error/Logging | Yes | Redacted diagnostic IDs, explicit safe failures, no secret/hardware detail in Windows notifications. [VERIFIED: 02-UI-SPEC.md UX-08/UX-09] |
| V8 Data Protection | Yes | Connected consent defaults off; local-only preference persistence; no fake cloud storage. [VERIFIED: 02-CONTEXT.md D-06] |
| V10 Malicious Code | Yes | No arbitrary scripts, remote registries/templates, production fixture bundles, or generic system RPCs. [VERIFIED: AGENTS.md] |
| V14 Configuration | Yes | Exact pins, capabilities, production adapter identity, signed package config, and startup failure states. [VERIFIED: ADR 0004] |

### Known Threat Patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Fixture adapter reaches production | Spoofing | Compile/static/runtime/artifact/process defenses and startup refusal. [VERIFIED: ADR 0004] |
| Malicious deep link encodes action | Tampering/Elevation | Allowlist navigable routes and benign identifiers; require full review/confirmation for risky actions. [VERIFIED: 02-UI-SPEC.md section 6] |
| Over-broad Tauri permissions | Elevation | Explicit per-window capabilities and minimum plugin commands. [CITED: https://v2.tauri.app/security/capabilities/] |
| Renderer executes privileged action | Elevation/Tampering | Phase 2 has no privileged broker; preview ends in no-change receipt. [VERIFIED: 02-CONTEXT.md D-15] |
| Notification leaks hardware/account detail | Information disclosure | Native notification allowlist and minimal copy; details remain inside app. [VERIFIED: 02-UI-SPEC.md UX-09] |
| Supply-chain package confusion | Tampering | Exact pins, legitimacy audit, no third-party registry blocks, root supply-chain gate. [VERIFIED: package.json] |
| Unsigned/damaged installer or update | Tampering | Authenticode, updater signature failure state, continue safe current version, rollback surface. [CITED: https://v2.tauri.app/distribute/sign/windows/] |
| Consent dark pattern | Repudiation/Information disclosure | Separate local/telemetry/cloud-AI/diagnostic-sharing decisions, visible language switch, defaults off. [VERIFIED: 02-CONTEXT.md D-06/D-17] |

## Sources

### Primary — HIGH confidence

- `.planning/phases/02-complete-desktop-experience/02-CONTEXT.md` — locked decisions and phase boundary.
- `.planning/phases/02-complete-desktop-experience/02-UI-SPEC.md` — routes, components, states, scenarios, accessibility and acceptance.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md` — requirement descriptions, dependencies and project history.
- `architecture/module-boundaries.json` and ADRs 0003–0005 — executable ownership, truth boundary and acceptance policy.
- `packages/desktop-client` and `packages/desktop-simulator` — current validated port, truth mapping and deterministic adapter.
- `package.json`, `pnpm-workspace.yaml`, `.planning/config.json` — toolchain, scripts, workspace policy, TDD and Nyquist configuration.
- npm registry, crates.io search, and the GSD package-legitimacy seam — versions, repository metadata, download signals and verdicts queried 2026-07-27.

### Secondary — MEDIUM confidence

- [Tauri capabilities](https://v2.tauri.app/security/capabilities/)
- [Tauri custom windows](https://v2.tauri.app/learn/window-customization/)
- [Tauri single instance](https://v2.tauri.app/plugin/single-instance/)
- [Tauri deep links](https://v2.tauri.app/plugin/deep-linking/)
- [Tauri system tray](https://v2.tauri.app/learn/system-tray/)
- [Tauri window state](https://v2.tauri.app/plugin/window-state/)
- [Tauri Windows installer/WebView2](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri Windows signing](https://v2.tauri.app/distribute/sign/windows/)
- [Tauri WebDriver](https://v2.tauri.app/develop/tests/webdriver/)
- [React Aria styling and behavior](https://react-spectrum.adobe.com/react-aria/styling.html)
- [TanStack Router search params](https://tanstack.com/router/latest/docs/guide/search-params.md)
- [TanStack Router navigation](https://tanstack.com/router/latest/docs/guide/navigation.md)
- [TanStack Router type safety](https://tanstack.com/router/latest/docs/guide/type-safety.md)
- [FormatJS React Intl](https://formatjs.github.io/docs/react-intl/)
- [XState documentation](https://stately.ai/docs/xstate)

### Tertiary — LOW confidence

- Exact internal package folder recommendations, the XState persistence shape, the React Intl selection, and consolidated checkpoint interpretation are listed in the Assumptions Log.
- Context7 was unavailable in this runtime; official documentation pages were fetched directly and cached through the research seam with the seam-classified `LOW` provider confidence. This lowers external implementation-detail confidence but does not affect locked project or codebase findings.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH for project pins and registry existence; MEDIUM for newly recommended React Intl/FormatJS.
- Architecture: HIGH because executable policy, ADRs, client code, CONTEXT, and UI-SPEC agree.
- UX/state patterns: HIGH because the approved UI-SPEC is explicit.
- External Tauri/React Aria/Router implementation details: MEDIUM from current official docs.
- Environment readiness: HIGH for observed versions/missing commands; LOW for unprobed signing/NVDA availability.
- Pitfalls: HIGH where derived from locked acceptance/truth rules; MEDIUM for operational test-cost recommendations.

**Research date:** 2026-07-27  
**Valid until:** 2026-08-03 for package/tooling versions; project decisions remain valid until superseded.
