# Feature Research

**Domain:** Premium Windows 10/11 gaming optimizer and companion SaaS platform  
**Researched:** 2026-07-26  
**Confidence:** MEDIUM

## Research Framing

This landscape separates:

1. **Advertised competitor capabilities** — useful for understanding user expectations, but not proof of performance.
2. **Official Windows and measurement capabilities** — useful for defining what can be measured or controlled credibly.
3. **Recommended Liiiraa Boost scope** — product decisions derived from the project constraints, safety model, and dependencies.

No competitor FPS percentage, “zero input lag,” “PC novo,” or similar marketing statement is treated as independent evidence. A feature is not considered effective merely because a landing page names it.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing these would make a premium optimizer feel incomplete even if its low-level engine were technically capable.

| Feature | Why Expected | Complexity | Notes |
|---|---|---:|---|
| Hardware and Windows inventory | Recommendations cannot be credible without knowing the exact CPU, GPU, memory, storage, network, display, notebook/desktop topology, Windows build, drivers, and security posture | HIGH | Show capability and support status, not only model names; Windows 10 must carry an explicit lifecycle warning because general support ended on 2025-10-14 |
| Guided initial calibration | Users need a trustworthy baseline before the first recommendation | HIGH | Inventory, compatibility, conflicts, restore readiness, priority games, goals, and a measurement baseline; resumable with elapsed/remaining state |
| Contextual home | A static telemetry wall does not answer what the user should do now | HIGH | Priority order already chosen: next recommended action, selected game/profile, current system state; critical risk/recovery can pre-empt the normal hierarchy |
| Game and launcher library | Game-specific optimization is a core market expectation | HIGH | Detect Steam, Epic, Xbox/Microsoft Store, Riot, Battle.net, EA, Ubisoft, GOG, emulators, and user-added executables without touching protected game files |
| Per-game profile lifecycle | Competitors advertise automated per-game behavior; users expect the same whether they launch through the optimizer or elsewhere | HIGH | Prepare, validate, apply temporary operations, observe game process, and restore desktop state after exit; make launcher/process ambiguity visible |
| Editable optimization plans | Technical users require control and less experienced users need a safe recommended starting point | HIGH | Group by goal, reveal components beneath it, show dependencies, restart requirements, eligibility, risk, and reversibility per operation |
| Progressive explanation for every operation | A premium system utility must explain what it intends to change | MEDIUM | Plain-language impact first; implementation target, evidence, compatibility, uncertainty, previous value, and rollback details on demand |
| Risk and compatibility classification | Users must distinguish stable operations from advanced, experimental, and extreme changes | HIGH | Global plan level plus per-operation status; unsupported operations are unavailable, not silently attempted |
| Measured session monitoring | FPS, frame time, 1% lows, CPU/GPU/display timing, utilization, temperatures, and resource pressure are expected where capture is reliable | HIGH | Capture externally through permitted mechanisms; always attach collector, sampling window, environment, and data-quality status |
| Before/after comparison and history | Users need a credible way to see what changed and whether it helped | HIGH | Compare matched sessions and system state; never convert incomparable or insufficient samples into a gain claim |
| Change ledger and recovery center | Deep system changes are unacceptable without a visible path back | HIGH | Per-operation previous state, plan snapshot, partial-failure recovery, Windows restore point where applicable, and post-rollback verification |
| Safe failure handling | A failed plan cannot leave the user guessing which changes were applied | HIGH | Pause transaction, isolate failure, reverse only what is necessary, preserve diagnostics, and present a guided next action |
| Search and command center | A deep product needs fast access without exposing every module in primary navigation | MEDIUM | Find games, modules, operations, documentation, history, and safe actions; risky actions still require their full confirmation flow |
| Activity and notification center | Background service, game activation, updates, restart needs, and recovery create asynchronous events | MEDIUM | Quiet feedback for normal events, durable activity history, and Windows notifications only when user action is needed |
| Settings, privacy, accessibility, and localization | Global paid software is expected to respect language, consent, accessibility, density, and notification preferences | HIGH | PT-BR and English first; WCAG 2.2 AA, keyboard, screen reader, reduced motion, scalable density, color-independent status |
| Account, subscription, and device status | Premium access must be understandable inside the desktop app and web account | HIGH | One active PC, 30-day device reset cooldown, seven-day offline entitlement, clear grace/expired states, and safety/recovery never paywalled |
| Signed update channels | Stable, Beta, and Experimental users need trustworthy version delivery | HIGH | Signed artifacts, channel promotion, release notes, compatibility status, recovery from failed update, and no unsigned downgrade |
| Documentation and secure support | A technical optimizer needs evidence and a safe escalation path | HIGH | Contextual versioned docs plus a local diagnostic bundle with preview, redaction, consent, encryption, and limited retention |
| Lightweight background behavior | An optimizer that consumes game resources defeats its purpose | HIGH | Enforce the approved service, tray, UI, startup, and adaptive-sampling budgets with visible self-diagnostics |

### Companion SaaS Table Stakes

| Surface | Required Capabilities | Why It Belongs in the Product Contract |
|---|---|---|
| Public web | Original premium landing experience, transparent feature claims, pricing, compatibility, download verification, documentation, status, legal/privacy pages | Acquisition must reflect the same trust standard as the desktop app |
| Account portal | Profile and security, passkeys/MFA/social login, subscription, invoices, one-device management, cooldown status, downloads, sessions, privacy/export/deletion | Users need self-service control without contacting support |
| Documentation | Versioned operation catalog, evidence, compatibility, known limitations, changelog, recovery guidance | Explanations in the app need a canonical, linkable source |
| Support | Ticket lifecycle, consent-bound diagnostic upload, expiry, user-visible access history | Technical support cannot imply blanket access to local PC data |
| Admin | Isolated deployment, strict RBAC, MFA/security-key policy, temporary consent-bound support access, immutable audit, releases/profile publishing | An “admin route” hidden inside the public site is not an adequate security boundary |
| Release/profile control plane | Signed declarative profile publication, staged channels, compatibility targeting, revocation, release metadata | Desktop behavior must be governed without enabling arbitrary remote execution |

### Differentiators (Competitive Advantage)

These should carry the positioning. A larger count of tweaks is not a defensible differentiator.

| Feature | Value Proposition | Complexity | Notes |
|---|---|---:|---|
| Capability-aware optimization graph | Replaces generic recipes with recommendations tied to the exact machine and Windows state | HIGH | Eligibility, conflicts, dependencies, expected direction of impact, reversibility, evidence version, and confidence are first-class data |
| Claim and evidence ledger | Makes “prove every claim” operational rather than a marketing phrase | HIGH | Separates measured result, observed system change, modeled expectation, and unsupported marketing; exposes methodology and uncertainty |
| Transactional plan execution and verified rollback | Makes deep optimization safer than applying disconnected tweak buttons | HIGH | Preflight, snapshot, ordered operations, checkpoints, partial rollback, restart continuation, idempotency, and postcondition verification |
| Composed game profiles | Combines official signed baseline, local hardware adaptation, and controlled user customization | HIGH | Result is inspectable and diffable; remote data can reference only allowlisted engine operations |
| Measurement quality gate | Prevents weak data from becoming a success claim | HIGH | Detect warm-up, sample duration, game/version/settings mismatch, capture loss, HAGS-related accuracy limits, thermal drift, and background interference |
| Trust-calibrated risky-action UX | Makes safety friction proportional to actual consequences | HIGH | Extreme actions require explanation, authentication, completed snapshot, typed confirmation, post-change check, persistent warning, and direct restore path |
| Goal-first command architecture with component depth | Serves gamers and experts without becoming a generic sidebar of hardware categories | HIGH | Primary goals: prepare a game, improve performance, reduce latency, diagnose stability, protect/recover; component-level detail lives inside each |
| Complete operational state model | Makes the app feel finished during failure, offline, unsupported, permission, restart, recovery, expired-subscription, and experimental states | HIGH | These states are designed and tested before privileged execution exists |
| Advisory AI with deterministic handoff | Lets users ask technical questions naturally without granting an LLM command execution | HIGH | AI produces explanation or a typed plan proposal; policy and operation engine validates everything; local filtering precedes consented cloud use |
| Optimizer self-impact budget | Proves the product does not become the performance problem | MEDIUM | Show and test service/tray/UI overhead, collector mode, and adaptive sampling; degrade gracefully during gameplay |
| Reproducible performance reports | Gives users and support a shared artifact instead of unverifiable screenshots | HIGH | Export environment identity, profile/operation versions, test protocol, raw/derived metrics, exclusions, uncertainty, and change diff |
| Security continuity after billing changes | Builds trust beyond typical subscription utilities | MEDIUM | Existing changes stay in place; diagnostic, history, alerts, and restoration remain available after Premium expires |

## Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Universal “safe tweaks” bundle | Fast one-click story and impressive tweak count | The same registry/service/power change can be irrelevant, harmful, or unavailable across Windows builds and hardware | Capability-gated plans with visible exclusions and per-operation evidence |
| Guaranteed FPS percentage or “input lag zero” | Easy sales message | Results vary by bottleneck, game, settings, drivers, thermals, and measurement quality; absolute claims destroy trust | Report only matched measured sessions with methodology and uncertainty |
| Synthetic health score built from arbitrary issue counts | Gives the dashboard a dramatic number | Encourages fake urgency and cannot prove game performance | Show concrete findings, severity, affected games, and next action |
| Black-box one-click execution | Appears simple | Hides scope, risk, restart, and recovery implications | Recommended editable plan with concise summary and progressive disclosure |
| Arbitrary remote or community scripts | Makes the catalog grow quickly | Converts profile delivery into a remote-code-execution channel | Signed declarative profiles referencing a versioned allowlist of Rust operations |
| DLL injection, game-file patches, or anti-cheat hooks | Promises richer telemetry or stronger optimization | Creates ban, integrity, compatibility, and security risk | External ETW/PresentMon-compatible capture and documented game/anti-cheat compatibility |
| Automatic BIOS, firmware, undervolt, or overclock mutation | Suggests “maximum” optimization | Recovery, vendor variance, warranty, brick, and thermal risk exceed the product boundary | Diagnose capabilities and provide manual, vendor-specific guidance only |
| Silent or ordinary-path Defender weakening | Can reduce some background security work | Tamper protection, policy, updates, malware exposure, and misleading permanence make this security-critical | Keep it isolated as Extreme, require proportional confirmation and recovery, verify actual state, and never promise Windows cannot re-enable protection |
| Always-on high-frequency telemetry/overlay | Produces visually rich dashboards | Adds overhead, privacy cost, storage growth, and measurement interference | Adaptive sampling; detailed capture only for explicit diagnostic or game sessions |
| “Benchmark” animation without a controlled workload | Gives instant before/after theater | It measures the animation or invented score, not game behavior | Baseline system diagnostics plus matched real-game capture when reliable |
| Automatic deletion labeled optimization | Creates visible disk-space wins | Temporary and shader caches may be useful; user files can be misclassified | Categorized scan, provenance, preview, exclusions, and recoverable deletion |
| Automatic rollback when subscription expires | Enforces paid access | Can interrupt games, re-enable conflicting settings, or destabilize a tuned system | Block new Premium actions while leaving history and restoration free |
| Public site and admin in one security perimeter | Reduces deployment work | Expands blast radius and makes authorization mistakes more consequential | Separate admin deployment, identity policy, network controls, and audit |
| “Fully simulated” app released as if it optimized the PC | Makes the first visual milestone marketable sooner | Would fabricate results and violate the product’s core trust promise | Keep the visual milestone internal/closed; deterministic fixtures drive states and tests, never public performance claims |
| Unlimited dashboard customization | Feels powerful | Lets users destroy hierarchy, increases support/test combinations, and creates visual disorder | Curated layout with controlled favorites, pinned games, metrics, and actions |

## Feature Dependencies

```text
[Design tokens + accessible primitives]
    -> [Desktop shell + goal-first navigation]
        -> [Complete visual feature surfaces]

[Language-neutral contracts + runtime validation]
    -> [Deterministic scenario adapters]
        -> [Visual regression + desktop E2E]
    -> [Privileged engine adapters]
    -> [Web/API/profile contracts]

[Hardware/OS inventory]
    -> [Capability graph]
        -> [Compatible recommendations]
            -> [Editable optimization plan]

[Allowlisted operation catalog + policy engine]
    -> [Signed official profiles]
    -> [Local profile adaptation]
    -> [AI plan validation]

[Rollback manifest + restore readiness]
    -> [Transactional execution]
        -> [Safe partial-failure recovery]

[Game/launcher discovery]
    -> [Game identity]
        -> [Per-game profile composition]
            -> [External-launch detection + automatic activation/restoration]

[Measurement baseline + environment identity]
    -> [Session capture]
        -> [Data-quality gate]
            -> [Before/after claims + reproducible report]

[Identity + subscription + device binding]
    -> [Premium entitlements]
        -> [Seven-day offline lease]

[Consent + local redaction]
    -> [Cloud AI context]
    -> [Secure support bundle]

[Event/audit model]
    -> [Activity center + history]
    -> [Support access history]
    -> [Administrative audit]
```

### Dependency Notes

- **The visual milestone requires the contracts and state model, not the privileged engine.** Otherwise the UI will be rewritten when real operations reveal missing states.
- **Recommendations require capability detection.** “Unsupported” must be determined before plan construction, not discovered during execution.
- **Execution requires recovery readiness.** A plan cannot enter an applying state until its reversible operations have captured valid previous state and required restore protection is confirmed.
- **Performance claims require measurement quality.** A captured number is not automatically comparable evidence.
- **AI requires the same policy boundary as remote profiles.** It may propose identifiers and parameters, never new executable behavior.
- **Game automation requires stable game identity.** Executable paths alone are insufficient across launchers, anti-cheat bootstrap processes, and updates.
- **Offline Premium requires a signed lease and trusted-time strategy.** Cache presence alone cannot establish entitlement.
- **Support and AI upload require prior local redaction and explicit consent.** Cloud features must not silently broaden local-first data handling.

## First Visual-App Milestone Scope

This milestone is a **production-quality interaction and state contract**, not the public performance release.

### Must Deliver

- [ ] Real installable Tauri 2 shell with the approved lightweight startup and window behavior
- [ ] Original Liiiraa Boost design system with tokens, typography, iconography, motion, charts, focus, contrast, density, and responsive-window rules
- [ ] Goal-first navigation, global command center, contextual tabs, activity center, tray states, and deep-link behavior
- [ ] Guided first-run calibration with normal, slow, paused, permission, partial-result, unsupported, offline, and failure scenarios
- [ ] Contextual home variants for healthy, recommendations available, game-ready, game-running, restart pending, recovery needed, offline, expired Premium, and critical security states
- [ ] Game library, launcher discovery states, manual game addition, game detail, profile composition, launch preparation, active session, automatic restoration, and results
- [ ] Optimization exploration by goal with component drill-down across Windows, CPU/power, GPU, memory, storage, network, input/USB, display, audio, security/privacy, virtualization, thermals, and firmware guidance
- [ ] Editable plan builder with compatibility, evidence, risk, dependency, restart, Premium, Experimental, and Extreme presentation
- [ ] Full confirmation flows, including the high-risk security-change pattern, without performing privileged mutations
- [ ] Monitoring, baseline, matched comparison, insufficient-data, capture-degraded, unsupported-game, and reproducible-report states
- [ ] Change ledger, plan history, restore point, individual rollback, transaction recovery, and rollback-verification experiences
- [ ] AI dedicated view, global side panel, contextual prompt entry, consent, local/cloud mode, cited explanation, typed plan proposal, rejection, and safety boundary states
- [ ] Account, sign-in handoff, subscription, one-device binding, 30-day reset cooldown, seven-day offline window, expiry, and retained safety access
- [ ] Settings for privacy, data retention, accessibility, language, updates/channels, notifications, background/tray behavior, and advanced preferences
- [ ] Secure support package preview/redaction/consent/upload/expiry flow and versioned contextual documentation links
- [ ] Typed domain contracts and deterministic scenario adapters for every screen; fixtures cover multiple hardware classes and Windows 10/11 capability differences
- [ ] Visual regression, keyboard/screen-reader semantics, WCAG 2.2 AA checks, locale expansion, reduced motion, error recovery, and end-to-end desktop journeys

### Explicitly Not in This Milestone

- Real registry, service, scheduled-task, security-policy, driver, power, network, or game-configuration mutation
- Production claims that the app increased FPS, reduced latency, or changed system health
- Real cloud subscription billing, profile publishing, or administrative control plane
- Public optimizer launch; scenario data is test/development data and must never be represented as a user’s measured PC result
- Automatic BIOS/firmware/overclock operations, injection, anti-cheat integration, or arbitrary script execution

### Milestone Exit Gate

The milestone is complete only when replacing deterministic adapters with real read/execute adapters does not require changing screen information architecture, core state machines, or cross-boundary contracts. Copy and visuals must feel final, while all unavailable execution remains honestly unavailable outside controlled fixture environments.

## Product Delivery Recommendation

### Foundation / Visual Contract (Milestone 1)

- [ ] Complete the visual-app scope above — eliminates the highest early product risk without pretending the optimizer engine exists

### Companion Web Contract (Milestone 2)

- [ ] Public site, account, docs, support, downloads, device and isolated admin surfaces
- [ ] Share design primitives and domain contracts while preserving separate deployment/security policies
- [ ] Use deterministic service adapters for billing, identity, device, release, and support failure states

### Control Plane and Licensing (Milestone 3)

- [ ] Identity, passkeys/MFA/social login, one-device enforcement, offline lease, subscription abstraction, audit, release/profile signing, and support consent
- [ ] Preserve free access to diagnostics, history, alerts, and restoration after entitlement expiry

### Read-Only Diagnostic Engine (Milestone 4)

- [ ] Real inventory, capabilities, game discovery, Windows state, restore readiness, and measurement collectors
- [ ] Validate UI contracts against diverse physical Windows hardware before any deep mutation

### Safe Optimization Engine (Milestone 5+)

- [ ] Allowlisted reversible operations, policy engine, transaction journal, idempotent apply/rollback, signed profiles, game automation, and matched measurement
- [ ] Promote domains gradually from Verified to Advanced/Experimental only with hardware evidence and recovery coverage

### Defer Until Evidence and Operations Mature

- [ ] Cloud AI beyond explanation and typed proposals — requires privacy, cost, safety, and evaluation gates
- [ ] Community sharing — user presets may share declarative intent only after operation/version compatibility is solved
- [ ] Broad firmware guidance catalog — requires vendor/generation-specific research and maintenance
- [ ] Any Extreme security operation in stable release — requires dedicated threat modeling, legal review, recovery tests, and unmistakable risk UX

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---:|---:|---:|
| Typed state model and complete visual-app contract | HIGH | HIGH | P1 |
| Inventory and capability graph | HIGH | HIGH | P1 |
| Editable plan with explanation/risk/compatibility | HIGH | HIGH | P1 |
| Transaction ledger and verified rollback | HIGH | HIGH | P1 |
| Game discovery and per-game profile lifecycle | HIGH | HIGH | P1 |
| Measurement quality gate and before/after report | HIGH | HIGH | P1 |
| Accessibility, localization, privacy, and all degraded states | HIGH | HIGH | P1 |
| Account, one-device license, offline entitlement | HIGH | HIGH | P1 |
| Signed updates and declarative profile delivery | HIGH | HIGH | P1 |
| Secure support and versioned documentation | HIGH | MEDIUM | P1 |
| Advisory AI surfaces and typed proposal handoff | MEDIUM | HIGH | P2 |
| Controlled user profile customization | HIGH | HIGH | P2 |
| Advanced/Experimental operation catalog breadth | HIGH | HIGH | P2 |
| Reproducible exportable performance reports | MEDIUM | HIGH | P2 |
| Controlled favorites and pinned-game personalization | MEDIUM | MEDIUM | P2 |
| Community preset discovery | MEDIUM | HIGH | P3 |
| Extensive firmware guidance catalog | MEDIUM | HIGH | P3 |

**Priority key:**

- **P1:** Required for a credible product launch or its prerequisite milestone
- **P2:** Add after the corresponding P1 capability is validated
- **P3:** Consider only after product-market and operational evidence

## Competitor and Official-Tool Analysis

| Feature | Hone (official site) | StarBoost / BravoBoost (official site) | Official Windows / PresentMon Capabilities | Liiiraa Boost Direction |
|---|---|---|---|---|
| System optimization | Advertises system-wide tweaks, bloat/background reduction, and one-click optimization | Advertises hundreds of one-click system/kernel/background optimizations | Windows exposes individual settings and system APIs; effect is configuration- and hardware-dependent | Capability graph, editable plan, exact change diff, no universal recipe |
| Game-specific behavior | Advertises tested game configs and automatic activation/reversion for many titles | Reviewed landing page emphasizes general app boost; exact profile model is not established there | Windows provides some per-app graphics preferences | Official signed base + local adaptation + user customization |
| Performance monitoring | Advertises real-time system-health monitoring | Advertises a low-impact real-time overlay | PresentMon documents external ETW-based CPU/GPU/display frame timing and latency capture across graphics APIs | Adaptive capture with explicit overhead and quality state |
| Performance claims | Publishes headline FPS/latency marketing claims | Uses “input lag zero,” stable FPS, and other marketing comparisons | PresentMon itself documents measurement accuracy limitations in some conditions | Only matched measured evidence; no guarantee or invented score |
| Recovery | Advertises automatic desktop-mode reversion for game activation; full rollback guarantees were not established from the reviewed homepage | Recovery behavior was not established from the reviewed homepage | System Restore can revert system files, registry settings, and installed program state using restore points | Per-operation journal + plan snapshot + Windows restore point where applicable + verification |
| Explanation and audit | Landing page communicates outcomes more than an operation-by-operation evidence model | Landing page communicates outcomes and one-click convenience | Windows settings/docs explain separate features but do not unify a gaming plan | Layered explanation, sources, compatibility, previous value, audit history |
| Hardware breadth | Broad optimization positioning; exact capability matrix not established from the reviewed homepage | Shows basic CPU/RAM/storage/GPU overview; manual service separately advertises BIOS/overclock work | Official features vary by Windows release, GPU topology, display, and app | Detect capabilities across CPU/GPU/storage/network/notebook/desktop; unsupported stays hidden or Experimental |
| Security-sensitive changes | Not established from the reviewed homepage | Not established from the reviewed homepage | Microsoft documents Defender tamper protection preventing protected settings from being changed | Extreme-only isolation, proportional confirmation, snapshot, actual-state verification, persistent warning |
| BIOS / overclock | Not established from the reviewed homepage | Separate manual BravoBoost service advertises BIOS and overclock work beyond the app | Vendor-specific and outside normal Windows app recovery | Guidance only; never automatic |
| Commercial platform | Free allowance, Premium offering, account/sign-in, and support are advertised | Subscription plans and social/support channels are advertised | Not applicable | Global freemium, account/device portal, secure support, isolated admin, transparent entitlements |

## Sources

Primary sources reviewed on 2026-07-26:

- [Hone official site](https://hone.gg/) — current advertised optimizer, game, monitoring, free/Premium, and support features; marketing claims treated as claims, not proof
- [StarBoost / Bravo Technologies official site](https://app.bravoboost.com.br/) — current advertised app, monitoring, subscription, and separate manual optimization-service features; marketing claims treated as claims, not proof
- [PresentMon official repository](https://github.com/GameTechDev/PresentMon) — supported graphics APIs, applications, ETW collection model, metrics, and documented accuracy limitations
- [Microsoft Support: Optimizations for windowed games in Windows 11](https://support.microsoft.com/en-us/windows/hardware/display-graphics/optimizations-for-windowed-games-in-windows-11) — compatible DirectX 10/11 windowed/borderless behavior, frame-latency direction, Auto HDR/VRR, and per-app graphics options
- [Microsoft Support: System Restore](https://support.microsoft.com/en-us/windows/experience/backup-recovery/system-restore) — restore-point scope and recovery behavior
- [Microsoft Learn: Defender tamper protection](https://learn.microsoft.com/en-us/defender-endpoint/prevent-changes-to-security-settings-with-tamper-protection) — protected settings and supported temporary troubleshooting behavior
- [Microsoft Learn: Event Tracing for Windows](https://learn.microsoft.com/en-us/windows/win32/etw/about-event-tracing) — official ETW foundation used by Windows performance collection
- [Microsoft Support: Windows 10 support has ended](https://support.microsoft.com/en-US/Windows/Deployment/Updates-Lifecycle/windows-10-support-has-ended-on-october-14-2025) — Windows 10 lifecycle status relevant to a 2026 product

### Confidence Notes

- **HIGH confidence:** Features and limitations explicitly stated in the cited Microsoft and PresentMon primary documentation.
- **MEDIUM confidence:** Competitor feature presence based on their current official public marketing pages; implementation depth and effectiveness were not independently tested.
- **MEDIUM confidence:** Table-stake/differentiator classification, because it is a product recommendation derived from primary sources and the approved project brief rather than direct market-user research.
- **LOW / intentionally excluded:** Competitor performance percentages, “zero” latency language, and any unverified claim that a named tweak improves all hardware.

---

*Feature research for: Liiiraa Boost*  
*Researched: 2026-07-26*
