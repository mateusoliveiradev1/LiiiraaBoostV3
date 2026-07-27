# Phase 2: Complete Desktop Experience - Context

**Gathered:** 2026-07-27  
**Status:** Ready for planning

<domain>

## Phase Boundary

Deliver the production-quality, installable, non-elevated Tauri desktop experience for every planned product surface and state. The phase uses deterministic scenario adapters and truthful provenance throughout; it does not connect real privileged optimization, authoritative cloud services, or fabricated machine observations.

</domain>

<spec_lock>

## Requirements (locked via UI-SPEC.md)

**12 requirements are locked:** UX-01 through UX-12. See `02-UI-SPEC.md` for the complete visual contract, route model, component inventory, state matrix, interaction rules, accessibility requirements, scenario catalog, and acceptance criteria.

Downstream agents MUST read `02-UI-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope:**

- The installable Windows shell, calibration, contextual Home, goal-first navigation, command center, controlled favorites, Activity, settings, tray, and every planned desktop route.
- Authored loading, empty, offline, permission, unsupported, partial-failure, restart-pending, recovery, expired-entitlement, stale, contradictory, and fixture states.
- PT-BR and English, keyboard and assistive-technology operation, responsive scaling, reduced motion, forced colors, deterministic visual regression, and packaged desktop journeys.
- Scenario-backed previews that exercise future workflows without claiming real effects.

**Out of scope:**

- Real privileged optimization, hardware collection, game automation, account authority, commerce, cloud AI, support upload, or production update effects.
- Fixture data presented as observed or measured from the user's PC.
- Arbitrary scripts, dead controls, false success states, or changes to the goal-first route model and locked design language.

</spec_lock>

<decisions>

## Implementation Decisions

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

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and phase contract

- `.planning/phases/02-complete-desktop-experience/02-UI-SPEC.md` — locked visual, interaction, state, route, accessibility, scenario, and acceptance contract for Phase 2.
- `.planning/ROADMAP.md` — Phase 2 boundary, goal, dependencies, success criteria, and requirement assignment.
- `.planning/REQUIREMENTS.md` — authoritative UX-01 through UX-12 requirement definitions and cross-phase boundaries.
- `.planning/PROJECT.md` — product value, trust model, active constraints, out-of-scope behavior, and desktop-first strategy.

### Architecture and truth boundaries

- `architecture/decisions/0003-module-ownership-and-direction.md` — module ownership and permitted dependency direction.
- `architecture/decisions/0004-truth-provenance-and-fixture-boundary.md` — provenance and fixture separation rules that every scenario-backed surface must preserve.
- `architecture/decisions/0005-cross-cutting-acceptance-policy.md` — required security, privacy, accessibility, performance, and recovery acceptance dimensions.
- `architecture/module-boundaries.json` — executable package ownership, layer, runtime class, and dependency policy.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/desktop-client/src/truth.ts`: provides the discriminated truth model for fixture, observed, measured, modeled, and unavailable values.
- `packages/desktop-client/src/index.ts`: exposes the existing desktop client and conformance boundary that UI application adapters should consume.
- `packages/desktop-simulator/src/scenarios.ts`: provides the current deterministic simulator seam and fixture/unavailable construction pattern; Phase 2 must expand beyond its two foundation scenarios.
- `packages/contracts-ts`: provides generated transport models and runtime validation. UI code must not create parallel handwritten DTOs.

### Established Patterns

- Fixture provenance is structurally distinct from production observations and must remain visible through the complete UI composition.
- Simulator and production-reference adapters conform to the same desktop client boundary.
- Architecture policy reserves separate design-token, design-system, feature-shell, and desktop-app ownership roots.
- Cross-cutting acceptance is executable policy rather than a final manual checklist.

### Integration Points

- Activate the reserved `packages/design-tokens`, `packages/design-system`, `packages/feature-shell`, and `apps/desktop` roots according to `architecture/module-boundaries.json`.
- Compose scenario adapters through `packages/desktop-client`; do not import fixture construction into production UI composition.
- Extend canonical contracts when Phase 2 needs new cross-boundary state instead of defining UI-only transport duplicates.
- Expand deterministic scenario coverage from the foundation `standard` and `unavailable` cases to the UI-SPEC S01-S24 matrix with stable IDs, seed, clock, locale, latency, and provenance.

</code_context>

<specifics>

## Specific Ideas

- The primary narrative should feel like preparing a mid-range competitive PC for a serious session, not demonstrating an extreme enthusiast machine or a broken legacy PC.
- The golden plan intentionally teaches trust through contrast: one safe path, one higher-friction path, and one fail-closed exclusion.
- Scenario families should make state differences easy to recognize in screenshots, Storybook stories, and end-to-end journeys.
- Preview receipts and Activity entries are part of the product truth boundary: they demonstrate the workflow while explicitly proving that Phase 2 changed nothing.

</specifics>

<deferred>

## Deferred Ideas

None — discussion stayed within the Phase 2 boundary.

</deferred>

---

_Phase: 02-complete-desktop-experience_  
_Context gathered: 2026-07-27_
