---
phase: 02-complete-desktop-experience
title: Complete Desktop Experience
status: approved
created: 2026-07-26
reviewed_at: 2026-07-26
design_system: manual-bespoke
requirements:
  - UX-01
  - UX-02
  - UX-03
  - UX-04
  - UX-05
  - UX-06
  - UX-07
  - UX-08
  - UX-09
  - UX-10
  - UX-11
  - UX-12
---

# UI Design Contract: Complete Desktop Experience

## 1. Contract purpose

This document is the visual and interaction source of truth for the installable Phase 2 desktop app. It is intentionally more specific than a mood board: planners and executors must implement these values, routes, states, behaviors, and acceptance checks without inventing a second design language.

Phase 2 is a finished product experience backed by deterministic scenario adapters. It is not a released optimizer and must never imply that fixture data came from the user's PC or that a privileged change occurred.

### Non-negotiable outcomes

- The app feels premium, trustworthy, and exclusive without looking promotional.
- The first five seconds answer, in order: what should I do next, which game/profile is selected, and what state is my system in.
- Navigation begins with goals and reveals component detail inside those goals.
- All future product surfaces are represented with final copy and complete states before real adapters replace scenarios.
- PT-BR and English are first-class. WCAG 2.2 AA is a release gate.
- Fixture, observed, measured, modeled, and unavailable values are never visually interchangeable.
- Loading, empty, offline, permission, unsupported, partial-failure, restart-pending, recovery, and expired-entitlement states receive the same craft as the ideal path.

### Truth boundary

- Development and test builds display a persistent `Cenário de demonstração` / `Demonstration scenario` marker in the title bar and beside every fixture-derived evidence group.
- Fixture metrics use the provenance label `Cenário` / `Fixture`; they never use `Ao vivo`, `Observado`, or `Medido`.
- A production build must reject fixture adapters at startup. Hiding the marker is not an acceptable production safeguard.
- Simulated apply, restore, launch, billing, account, and AI actions end in explicit preview receipts: `Prévia concluída — nenhuma alteração foi feita neste PC.` / `Preview complete — no changes were made to this PC.`
- Disabled future actions explain their owning phase or missing capability. There are no dead controls.

## 2. Locked creative direction

### North star: Pre-Dawn Flight Deck

The interface is a serious operator environment used immediately before a competitive session: low ambient light, exact information, and illuminated signals only when they carry meaning. Identity comes from composition, typography, evidence treatment, and restrained motion—not RGB, gradients, glass, decorative grids, or fake telemetry.

### Visual principles

1. **One focal signal:** every screen has one primary action or decision. Mineral Cobalt may mark that signal and verified selection only.
2. **Operational depth:** permanent regions are separated by spacing and 1 px rules, not floating-card shadows.
3. **Goal before component:** users enter through Prepare, Improve, Measure, or Recover; CPU/GPU/network detail appears inside the chosen goal.
4. **Evidence has a voice:** machine values use mono typography, explicit units, timestamp, provenance, and quality.
5. **Risk increases friction:** explanation, authentication, snapshot readiness, confirmation, and verification grow with consequence.
6. **Quiet until action is required:** ordinary success is inline; durable history goes to Activity; Windows notifications are reserved for actionable critical events.

### Anti-references

The implementation must not resemble Advanced SystemCare, a generic gamer launcher, a stock Windows Settings clone, or a SaaS card dashboard. Specifically prohibited:

- health rings, arbitrary issue counts, miracle scores, confetti, urgency timers, or unverified gain percentages;
- saturated blue surfaces, blue glows, RGB edges, glassmorphism, large gradients, or decorative scan animations;
- a sidebar followed by a uniform grid of rounded statistic cards;
- promotional upgrade banners inside diagnostic, recovery, game, or security flows;
- placeholder copy, lorem ipsum, fake “live” data, dead buttons, or unfinished empty states;
- all-caps paragraphs, excessive monospaced copy, or icons used without accessible names.

## 3. Design-system and registry decision

| Property | Contract |
|---|---|
| Tool | Manual bespoke design system |
| Preset | Not applicable |
| Component library | React Aria Components for accessible behavior only; no visual styles are inherited |
| Styling | Tailwind CSS 4 utilities backed by authored CSS custom properties and original components |
| Icon library | Curated Lucide React outline set at 1.75 px stroke; custom SVGs for product, provenance, risk, hardware topology, and recovery |
| Fonts | Self-hosted Manrope Variable and JetBrains Mono Variable |
| Charts | Authored chart wrappers; uPlot only for dense time series |
| shadcn | Forbidden for this phase; do not initialize `components.json` |
| Third-party registries | None |

### Registry safety gate

No shadcn or third-party registry blocks are approved. Executors may not add a registry, template, dashboard kit, copied component block, or remote design-system dependency without a new reviewed decision. Accessible npm primitives may provide behavior only and must be wrapped behind Liiiraa Boost-owned exports.

## 4. Foundation tokens

These are contract values, not exploratory suggestions. Because no UI code exists yet, font rendering, contrast, density, and focus appearance must be validated in the actual Windows WebView2 implementation. A failed validation changes the token centrally and updates this contract; it does not authorize one-off screen overrides.

### 4.1 Spacing

| Token | Value | Use |
|---|---:|---|
| `space-1` | 4 px | icon/text correction, tightly related metadata |
| `space-2` | 8 px | control internals, compact row gaps |
| `space-3` | 16 px | default control and content gap |
| `space-4` | 24 px | section padding and grid gutter |
| `space-5` | 32 px | major section separation |
| `space-6` | 48 px | screen chapter separation |
| `space-7` | 64 px | rare onboarding and empty-state breathing room |

Rules:

- Layout spacing uses only 4, 8, 16, 24, 32, 48, or 64 px.
- Borders are 1 px and focus rings are 2 px; neither is a spacing token.
- Minimum pointer target is 44 × 44 px. This accessibility hit box is not a layout-spacing exception.
- Dense technical rows are at least 44 px high; standard rows are 52 px; primary action rows are 64 px.
- Default screen padding is 32 px at large widths, 24 px at medium widths, and 16 px at small widths.
- Grids use 24 px gutters at large widths and 16 px otherwise.

### 4.2 Typography

Only four text sizes and two weights are permitted. Hierarchy must come from spacing, placement, tone, and font family—not additional arbitrary sizes.

| Role | Family | Size / line height | Weight | Use |
|---|---|---:|---:|---|
| Label | Manrope | 13 / 18 px | 600 | controls, navigation, compact metadata |
| Body | Manrope | 15 / 24 px | 400 | explanations, guidance, table values |
| Heading | Manrope | 20 / 26 px | 600 | screen and section headings |
| Display | Manrope | 28 / 34 px | 600 | one primary screen statement or major measured result |
| Data | JetBrains Mono | 13 / 20 px or 15 / 24 px | 400 or 600 | measurements, units, identifiers, timestamps, diffs |

Rules:

- The only weights are 400 and 600 across both families.
- Tabular numeric features are enabled for measurements and comparisons.
- Mono is never used for paragraphs, navigation, buttons, or visual atmosphere.
- Body copy is capped at 72 characters per line; risk explanations at 64 characters.
- Sentence case is mandatory in both locales. All caps is limited to user-entered destructive confirmation phrases and short provenance codes in exported reports.
- Product UI must remain legible at 150% app scale and 200% Windows text scaling without clipped critical copy.

### 4.3 Color

#### Surface allocation

| Role | Token | Value | Approximate allocation |
|---|---|---:|---:|
| Dominant | `surface-canvas` | `#090B0F` | 60% |
| Dominant alternate | `surface-inset` | `#0B0E13` | within dominant |
| Secondary | `surface-work` | `#121722` | 22% |
| Secondary raised | `surface-raised` | `#181F2C` | 8% |
| Accent strong | `cobalt-action` | `#315ACD` | at most 7% |
| Accent readable | `cobalt-signal` | `#7EA0FF` | at most 3% |

Mineral Cobalt occupies no more than 10% of a normal screen. It is reserved for:

- the single primary action;
- current keyboard focus;
- verified selection;
- active navigation location;
- selected chart series or current timeline cursor;
- trusted link affordances.

It is not used for ambient backgrounds, every icon, ordinary borders, decorative glow, or semantic success.

#### Text, line, and semantic tokens

| Token | Value | Contract |
|---|---:|---|
| `text-primary` | `#F4F7FB` | headings and essential values |
| `text-secondary` | `#AAB4C4` | body and supporting labels |
| `text-tertiary` | `#7D899B` | metadata only on approved dark surfaces |
| `line-subtle` | `#2A3343` | structural rules |
| `line-strong` | `#3D4A60` | selected boundaries and table headers |
| `focus-ring` | `#8EABFF` | 2 px ring plus 2 px dark separation |
| `success` | `#4DCA8B` | verified success with icon and text |
| `warning` | `#F3B64A` | action soon required with icon and text |
| `critical` | `#FF747D` | failure or immediate risk with icon and text |
| `destructive-fill` | `#B52D3A` | destructive primary button only |
| `experimental` | `#C08CFF` | experimental classification with flask icon and label |
| `disabled-fill` | `#3D4452` | disabled controls |
| `scrim` | `rgba(3, 5, 8, 0.76)` | modal interruption only |

Contrast targets already checked for the provisional palette:

- `text-primary` on `surface-canvas`: 18.33:1.
- `text-secondary` on `surface-work`: 8.57:1.
- `text-tertiary` on `surface-raised`: 4.66:1; do not place it on a lighter surface.
- white on `cobalt-action`: 6.04:1.
- white on `destructive-fill`: 6.17:1.
- cobalt, success, warning, and critical signal text on `surface-inset`: 7.69:1, 9.33:1, 10.68:1, and 7.41:1 respectively.
- disabled text uses `text-secondary` on `disabled-fill`: 4.67:1. Opacity-only disabled styling is forbidden.

No status relies on color. Every semantic color is paired with an icon, explicit label, and where useful a border or line pattern.

### 4.4 Shape, borders, and elevation

- Default corner radius: 6 px.
- Dialog, command center, and large temporary inspector radius: 10 px.
- Pills are allowed only for status, provenance, filter tokens, and compact counts; ordinary buttons are not pills.
- Permanent regions use no shadow. Separate them with spacing, surface tone, and 1 px lines.
- Temporary overlays use one shadow: `0 16px 48px rgba(0, 0, 0, 0.46)`.
- Focus is never communicated by shadow alone.
- Section containers do not become repeated independent cards. Prefer open groups with a heading, rule, and aligned rows.

### 4.5 Iconography

- Standard icons are 18 px; primary actions 20 px; empty-state illustrations at most 48 px.
- Icons inherit semantic text color and never receive decorative multi-color treatment.
- Every unfamiliar icon has a tooltip and accessible name.
- Status icons are stable: check = Verified, triangle = Warning, octagon = Critical, flask = Experimental, lock = Restricted, clock = Pending restart, circular arrow = Recovery.
- Use no emoji in product UI.

## 5. Window and app-shell contract

### 5.1 Window behavior

- Default first-open size: 1280 × 800 logical px, centered.
- Hard minimum usable size: 760 × 600 logical px.
- Restore the last non-minimized size and monitor position; clamp to the current work area after monitor changes.
- Custom 48 px title bar is allowed, but Windows minimize, maximize/restore, close, snap layouts, Alt+Space, and high-contrast behavior must remain native and testable.
- Drag regions must exclude every interactive element. Double-clicking the drag region maximizes/restores.
- The UI process is never elevated. Any future elevated requirement is represented as an explicit broker permission flow.
- A second launch or deep link focuses the existing instance and routes it; it never opens a duplicate shell.
- Close behavior is explicit in Settings: `Close the window`, or `Keep game detection in the tray`. Default is the tray option only after onboarding explains it.
- During a previewed transaction or recovery, close/Alt+F4 offers `Keep running in tray` and `Stay here`; it never suggests terminating a safety workflow.

### 5.2 Shell anatomy

1. **Title bar, 48 px:** product mark, scenario/provenance marker, compact global status, command shortcut, activity indicator, native window controls.
2. **Goal rail:** Home, Prepare, Improve, Measure, Recover, Assistant. Settings and Account sit in a separated utility zone.
3. **Route header:** breadcrumb, 20 px title, one-sentence purpose, contextual actions.
4. **Work canvas:** one dominant narrative region, not a card grid.
5. **Context inspector:** selected evidence, operation, activity, or help. It is persistent only when width permits.
6. **Critical state rail:** a full-width 44 px region below the title bar only for recovery required, unsupported OS lifecycle, restart deadline, or protection risk.

The title bar scenario marker reads `DEMO · S02` in development/test and has an accessible name that explains the scenario. It cannot be dismissed.

### 5.3 Responsive widths

| Logical width | Shell behavior |
|---:|---|
| 1440 px and above | 216 px labeled goal rail, 24 px gutters, main canvas, 320 px persistent context inspector |
| 1180–1439 px | 200 px labeled goal rail; inspector opens as a 360 px overlay without resizing the main canvas |
| 960–1179 px | 72 px icon rail with accessible tooltips; page sections stack; inspector is a route-level sheet |
| 760–959 px | 64 px icon rail; route header actions collapse into a labeled menu; all workflows use a single column |

Rules:

- No page-level horizontal scrolling. Technical tables and timeline charts may scroll within a clearly labeled two-dimensional viewport.
- At 125% and 150% app scale, container behavior follows available `rem` width rather than physical screen width.
- The compact rail must not become icon-only for screen readers; labels remain in the accessibility tree and appear on focus/hover.
- The command center remains available at every width.

### 5.4 Tray contract

Tray status uses the product glyph plus an accessible textual state in its tooltip. Menu order:

1. `Open Liiiraa Boost`
2. selected game and `Prepare and launch`
3. current profile state
4. `Pause automatic profiles`
5. `Activity requiring attention` when nonzero
6. separator
7. `Settings`
8. `Exit interface`

Normal events do not flash the tray icon. Warning and critical states change the glyph and tooltip, not color alone.

## 6. Information architecture

### 6.1 Goal-first navigation

| Goal | User question | Component drill-down |
|---|---|---|
| Home | What matters now? | Contextual action, selected game, system state |
| Prepare | How do I get this game ready? | Game, launcher, profile, preflight, session |
| Improve | What can improve performance, latency, or stability? | Windows, CPU/power, GPU, memory, storage, thermals, network, audio, input/USB, display, security/privacy |
| Measure | What was actually observed and is it comparable? | Baseline, live capture, sessions, comparisons, reports |
| Recover | What changed and how do I return safely? | Change ledger, snapshots, restore points, plan recovery, restart continuation |
| Assistant | Help me understand or prepare a proposal | Dedicated chat, global panel, cited explanation, typed proposal |

Account, Settings, Documentation, and Activity are utilities—not competing primary goals.

### 6.2 Route map

```text
/
├─ /calibration/{welcome,trust,inventory,diagnosis,recovery,goals,games,summary}
├─ /home
├─ /prepare
│  ├─ /games
│  ├─ /games/add
│  ├─ /games/:gameId/{overview,profile,evidence,history}
│  ├─ /games/:gameId/preflight
│  └─ /session/:sessionId/{active,restoring,result}
├─ /improve
│  ├─ /goals/{performance,latency,stability,privacy}
│  ├─ /components/:componentId
│  ├─ /operations/:operationId
│  └─ /plans/:planId/{review,confirm,preview,restart,result}
├─ /measure/{overview,baseline,sessions,compare,reports}
├─ /recover/{overview,ledger,snapshots,plans/:planId,emergency}
├─ /assistant
├─ /activity
├─ /account/{overview,subscription,device,security}
├─ /settings/{general,background,appearance,accessibility,privacy,notifications,updates,advanced}
└─ /documentation/:documentId
```

Route state, filters, selected operation, and inspector target use typed router search parameters. Destructive or privileged intent is never encoded directly in a deep link.

## 7. Focal hierarchy

### 7.1 Contextual Home

Above the fold contains exactly three ordered regions:

1. **Next Action Brief (dominant, approximately 45%):** one evidence-backed statement, reason, consequence, and one primary verb-led CTA.
2. **Selected Game Runway (approximately 30%):** game identity, profile state, readiness checks, launch route, and last reliable result.
3. **System State Ledger (approximately 25%):** concrete findings grouped by Ready, Needs attention, and Unavailable; never a synthetic health score.

A wide-screen context inspector may show the three most recent activities, but telemetry charts never compete with the Next Action Brief. Critical recovery or security states replace the brief rather than adding another alert card.

Home variants:

- ready with no urgent findings;
- recommendations available;
- selected game ready;
- game running;
- restart pending;
- recovery required;
- offline with valid entitlement window;
- expired entitlement with safety access retained;
- unsupported Windows 10 consumer lifecycle;
- critical security state;
- calibration incomplete;
- evidence stale or partially unavailable.

### 7.2 Other screen hierarchy

- Route title and state sentence first.
- Primary work/decision second.
- Evidence and explanation third.
- Secondary utilities and documentation last.
- Only one filled cobalt button per view. A destructive dialog may replace it with one filled destructive button.
- If two actions are equally important, the design has failed; rewrite the workflow so one is primary.

## 8. Complete screen and state inventory

### UX-01 — Install and open non-elevated app

Screens and surfaces:

- signed installer handoff screen showing publisher, version, channel, system compatibility, and verification path;
- first launch splash limited to product mark, version, and truthful initialization state;
- startup failure surface for missing WebView2, damaged installation, incompatible Windows build, or local-state migration failure;
- non-elevated permission explanation and future broker handoff preview;
- single-instance and deep-link routing behavior;
- update-in-progress, update-signature-failed, rollback-available, and safe-mode startup states.

Acceptance:

- Startup never shows an empty white WebView.
- If initialization exceeds 400 ms, show a static branded shell and exact current step; no fake progress percentage.
- Missing WebView2 offers `Install WebView2` and `View offline instructions`.

### UX-02 — Guided calibration

Calibration is a guided operational workspace, not a generic wizard. A persistent step rail shows:

1. `Trust and privacy`
2. `System inventory`
3. `Performance diagnosis`
4. `Recovery readiness`
5. `Your goals`
6. `Priority games`
7. `Review`

Each step contains a concise outcome, live scenario evidence, expandable technical detail, elapsed time, and only a time range when the adapter can justify it.

Required states:

- new, running, slow, paused, resumed;
- offline with local steps available;
- permission requested, denied, unavailable, or deferred;
- partial inventory with missing source named;
- unsupported hardware or Windows lifecycle;
- no games found and manual addition;
- restore readiness unavailable with explanation;
- cancelled with saved progress;
- recoverable failure and non-recoverable local-state failure;
- completed with an exact baseline receipt.

Primary copy:

- PT-BR: `Iniciar calibração`
- EN: `Start calibration`

Completion copy:

- PT-BR: `Calibração concluída. Revisamos 8 fontes; 2 permanecem indisponíveis.`
- EN: `Calibration complete. We reviewed 8 sources; 2 remain unavailable.`

### UX-03 — Contextual home

Implement the hierarchy in Section 7. The screen must show source and freshness beside each system claim and profile state. Favorites may add one row below the three fixed regions; they cannot reorder or replace them.

Empty home:

- Heading PT-BR: `Ainda não há evidência suficiente`
- Body PT-BR: `Conclua a calibração para receber uma próxima ação baseada neste PC.`
- CTA PT-BR: `Continuar calibração`
- Heading EN: `There is not enough evidence yet`
- Body EN: `Complete calibration to receive a next action based on this PC.`
- CTA EN: `Continue calibration`

### UX-04 — Goal navigation and component drill-down

Improve starts with four goals: Performance, Latency, Stability, Privacy. Selecting a goal presents:

- current finding and evidence freshness;
- applicable component groups;
- operation candidates grouped by eligibility;
- exclusions with exact reason;
- route into component detail.

Component detail anatomy:

1. observed state;
2. why it matters to the selected goal;
3. supported operations;
4. unavailable or restricted operations;
5. evidence and compatibility;
6. change and recovery history.

Every operation inspector shows purpose, expected direction of impact, risk, evidence, compatibility, restart effect, previous value, recovery method, and provenance. Expected impact is never rendered as a guaranteed numeric gain.

### UX-05 — Global command center

Open from `Ctrl+K`, title-bar button, or goal rail. It is a 720 px maximum-width modal at large sizes and full-canvas at small sizes.

Searches:

- modules and routes;
- games and launchers;
- components and operations;
- settings;
- history and reports;
- documentation;
- safe actions.

Result groups are ordered by contextual relevance, then exact match. Each result states scope and consequence. Risky actions may be found but selecting them opens the full review flow; they never execute inside the command center.

Keyboard behavior:

- Up/Down moves active option.
- Enter opens the selected result.
- Right Arrow opens preview when available.
- Escape closes preview, then the command center.
- `Ctrl+Enter` is not assigned to execution.

No-result copy:

- PT-BR: `Não encontramos “{query}”. Pesquise por um jogo, componente, configuração ou documento.`
- EN: `We couldn't find “{query}”. Search for a game, component, setting, or document.`

### UX-06 — Controlled favorites

Users may pin:

- up to 5 games;
- up to 4 metrics;
- up to 4 safe actions.

Favorites appear only in their designated Home row and relevant route shortcuts. Drag-and-drop is optional; keyboard Move left/right and Remove controls are mandatory. Favorites cannot:

- reorder the three Home priorities;
- pin destructive, privileged, or Experimental execution;
- create arbitrary widgets;
- change information density or screen layout.

An explicit `Manage favorites` dialog shows limits and the resulting order.

### UX-07 — Complete operational states

Every route uses the following authored state components:

| State | Required content and action |
|---|---|
| Loading | stable skeleton matching final layout, named step after 400 ms, cancel only when safe |
| Empty | what is absent, why that is normal or unexpected, one next action |
| Offline | what still works locally, last successful validation time, retry action |
| Permission | capability requested, why, scope, duration, safer alternative, continue/cancel |
| Unsupported | exact hardware/OS/build/source reason, documentation, no misleading disabled CTA |
| Partial failure | completed work, failed dependency, impact, safe next action, diagnostic reference |
| Restart pending | changes waiting, dependencies, schedule/restart action, what remains safe now |
| Recovery | prior state, trigger, affected set, current verification, resume/restore action |
| Expired entitlement | new Premium actions blocked; existing changes, history, warnings, and recovery remain available |
| Stale evidence | timestamp, freshness policy, affected recommendation, refresh action |
| Contradictory evidence | conflicting sources, fail-closed result, collection guidance |
| Fixture | persistent scenario label and preview receipt |

States replace the affected content region; they are not generic toast-only messages.

### UX-08 — Activity center

The center is a route and a 400 px overlay from the title bar. It groups:

- `Requires action`
- `In progress`
- `Completed`
- `History`

Each event includes semantic severity, verb-led title, affected object, timestamp, source, durable correlation ID, and next action if applicable. Filters: All, Plans, Games, Recovery, Account, Updates.

Normal completion remains in Activity for 30 days in scenarios. Dismiss removes it from the active list but not from the audit/history view. Critical events cannot be dismissed until acknowledged or resolved.

### UX-09 — Feedback and Windows notifications

- Inline confirmation: appears beside the affected control for 4 seconds and remains discoverable in Activity.
- Toast: only for cross-route success/failure; maximum two visible; no stacking over primary actions.
- Activity: durable source of prior events.
- Windows notification: only recovery required, restart deadline chosen by user, game profile failed to restore, signed update requires action, or account security event.
- Windows notifications include product name, exact issue, one safe action, and no sensitive hardware detail.
- Respect Focus Assist and notification preferences.

### UX-10 — WCAG 2.2 AA

See Sections 15 and 18. Accessibility acceptance is part of every component story and end-to-end journey, not a final audit.

### UX-11 — PT-BR and English

All navigation, dialogs, errors, notifications, chart labels, units, dates, provenance, confirmation phrases, and screen-reader names ship in both locales. See Section 16.

### UX-12 — Motion, scale, and color-independent status

Settings offer:

- Motion: System, Reduced, Responsive.
- Interface scale: 100%, 112.5%, 125%, 150%.
- Density: Comfortable or Compact; Compact never reduces 44 px targets.
- Data text: standard or increased contrast.

Every status uses icon + label + shape/pattern when displayed in a chart.

## 9. Product surface inventory beyond the twelve UX requirements

These surfaces are visually complete in Phase 2 so future adapters do not force redesign.

### Prepare and games

- game library: detected, empty, scanning, launcher unavailable, duplicate identity, manual entry;
- game detail: overview, executable/launcher identity, compatibility, evidence, profile, history;
- profile composer: signed official base, local adaptation, user overrides, diff and provenance;
- preflight: profile validation, temporary operations, conflicts, recovery readiness, restart constraints;
- active session: low-overhead state, active profile, minimized telemetry, emergency restore route;
- external launch detected: same preflight/profile semantics;
- restoration: progress, game still running, process ambiguity, partial failure, verified completion;
- session result: quality-approved result, degraded capture, incomparable session, unsupported game.

### Plans and operations

- personalized plan overview;
- operation list with add/remove and dependency disclosure;
- operation inspector;
- global risk policy selector: Verified, Advanced, Experimental, Extreme;
- preview confirmation;
- future authentication and snapshot gate;
- application progress;
- pause and partial failure;
- restart scheduler;
- result receipt and audit link;
- individual and plan-level restore.

Phase 2 executes only preview adapters and always ends with the no-change receipt.

### Measure

- system baseline;
- capture setup;
- active capture;
- session history;
- matched comparison;
- rejected comparison with reason;
- detailed diff;
- timeline;
- report preview and export;
- collector overhead and degraded coverage.

### Recover

- current recovery readiness;
- append-oriented change ledger;
- plan snapshots;
- Windows restore-point supplement;
- individual rollback;
- full-plan rollback;
- restart continuation;
- emergency recovery after interrupted preview;
- verification receipt.

### Assistant

- dedicated conversation route;
- global 360 px side panel;
- contextual prompt entry attached to evidence, game, or operation;
- Local, Hybrid, and Disabled modes;
- consent and redaction before cloud context;
- cited explanation;
- typed plan proposal;
- proposal rejected by policy;
- offline answer boundary;
- encrypted local history, optional sync preview, delete confirmation.

The Assistant never shows an Execute tool. Its action is `Review proposal`.

### Account and entitlement

- system-browser sign-in handoff and callback;
- signed out, signed in, session expired, offline;
- Free, Premium active, seven-day offline window, grace warning, expired;
- exactly one active device;
- device reset with 30-day cooldown;
- subscription and invoices preview;
- security methods preview;
- retained access to diagnostics, alerts, history, and recovery after expiry.

### Settings and support

- general startup and close behavior;
- tray/background behavior;
- appearance, scale, density, motion;
- accessibility;
- language and locale preview;
- privacy and local retention;
- notifications;
- update channels and signature status;
- advanced diagnostics;
- secure support package: preview, redact, consent, encrypt, upload, expiry;
- contextual versioned documentation.

## 10. Component taxonomy

All components live in the authored design-system package and expose accessible names, states, keyboard behavior, and test IDs through stable public APIs.

### Foundation primitives

- `LbButton`: primary, secondary, quiet, destructive; loading state preserves width.
- `LbIconButton`: 44 px target, tooltip, accessible label.
- `LbLink`: internal, external, documentation; external destination is announced.
- `LbTextField`, `LbSearchField`, `LbTextArea`.
- `LbCheckbox`, `LbRadioGroup`, `LbSwitch`, `LbSlider`.
- `LbSelect`, `LbComboBox`, `LbMenu`.
- `LbTabs`: route tabs only; no nested tabs.
- `LbDialog`, `LbAlertDialog`, `LbSheet`, `LbTooltip`.
- `LbProgress`: determinate only with defensible total; otherwise named indeterminate step.
- `LbSkeleton`: matches final geometry and is hidden from assistive technology.

### Shell components

- `WindowTitleBar`
- `GoalRail`
- `RouteHeader`
- `CriticalStateRail`
- `CommandCenter`
- `ContextInspector`
- `ActivityCenter`
- `TrayStateModel`
- `Breadcrumbs`

### Evidence and state components

- `ProvenanceMark`: Fixture, Observed, Measured, Modeled, Unavailable.
- `FreshnessStamp`: timestamp and freshness policy.
- `QualityMark`: Approved, Degraded, Rejected, Not evaluated.
- `StatusSignal`: icon, label, optional detail.
- `MetricReadout`: value, unit, source, sample window, quality.
- `DeltaReadout`: absolute and relative change only when comparison is accepted.
- `CapabilityReason`: compatible, unsupported, hidden, restricted.
- `RiskClass`: Verified, Advanced, Experimental, Extreme.
- `EvidenceList`: source, version, timestamp, confidence, documentation.
- `ScenarioMarker`: mandatory in fixture environments.

### Workflow components

- `NextActionBrief`
- `GameRunway`
- `SystemStateLedger`
- `CalibrationStepRail`
- `OperationRow`
- `OperationInspector`
- `PlanDependencyList`
- `BeforeAfterDiff`
- `RiskGate`
- `TypedConfirmation`
- `RestartPlanner`
- `RecoveryCheckpoint`
- `VerificationReceipt`
- `EmptyComposition`
- `OperationalFailure`

### Data components

- `TelemetryPlot`
- `FrameTimePlot`
- `ComparisonPlot`
- `EvidenceTable`
- `ChangeLedger`
- `SessionTimeline`
- `HardwareTopology`

Charts are never decorative backgrounds. Tables support column headers, sorting announcements, row focus, and a non-chart textual summary.

## 11. Interaction contract

### Selection and inspection

- Single click selects a row and opens its inspector only when the row communicates selection.
- Double-click is never the only path to an action.
- Context inspectors preserve the current route and close with Escape.
- Browser-like Back returns to the previous route/selection and never reverses a system action.
- Unsaved profile or settings edits prompt before route loss.

### Applying and restoring

Phase 2 preview state machine:

```text
idle → reviewing → validating → recovery-ready → confirming
→ previewing → verifying → preview-complete
                         ↘ paused → guided-recovery → verified
```

- Users may leave reviewing and validating safely.
- From confirming onward, Close routes the preview to the tray model rather than abandoning it.
- Failure names the exact step and dependency set.
- Retry is offered only for retryable causes.
- Recovery never says `Everything is fine` before postcondition verification.

### Forms

- Validate on blur and submit; do not show an error while the user is still entering a valid partial value.
- Error text states the problem and how to fix it.
- Preserve user input after recoverable failures.
- First invalid field receives focus on submit and errors are summarized at the top for screen readers.

## 12. Copywriting contract

### Voice

Precise, calm, technically honest, and direct. Explain consequence before implementation detail. Never condescend, dramatize, or imply guaranteed performance.

Preferred structure:

1. observed fact;
2. why it matters;
3. what the app can do;
4. what remains uncertain;
5. next action.

### Required action labels

| Intent | PT-BR | English |
|---|---|---|
| Begin first run | `Iniciar calibração` | `Start calibration` |
| Review recommendation | `Revisar plano recomendado` | `Review recommended plan` |
| Prepare a game | `Preparar e iniciar jogo` | `Prepare and launch game` |
| Inspect details | `Ver evidências` | `View evidence` |
| Retry collection | `Coletar novamente` | `Collect again` |
| Schedule restart | `Agendar reinicialização` | `Schedule restart` |
| Begin recovery | `Revisar restauração` | `Review restoration` |
| AI proposal | `Revisar proposta` | `Review proposal` |
| Save setting | `Salvar alterações` | `Save changes` |
| Leave without saving | `Descartar alterações` | `Discard changes` |

Avoid vague labels: `OK`, `Continue`, `Fix`, `Boost`, `Optimize now`, and `Apply` without an object.

### Canonical state copy

Offline:

- PT-BR: `Sem conexão. Diagnósticos locais, histórico e restauração continuam disponíveis. A assinatura foi validada há 2 dias.`
- EN: `You are offline. Local diagnostics, history, and recovery remain available. The subscription was validated 2 days ago.`

Partial failure:

- PT-BR: `A prévia foi pausada porque a verificação do plano de energia não respondeu. Nenhuma alteração foi feita. Revise o diagnóstico ou tente novamente.`
- EN: `The preview paused because power-plan verification did not respond. No changes were made. Review diagnostics or try again.`

Unsupported:

- PT-BR: `Esta operação não foi validada para o Windows 10 Home fora de suporte. Ela não será incluída no plano.`
- EN: `This operation has not been validated for an unsupported Windows 10 Home installation. It will not be included in the plan.`

Expired entitlement:

- PT-BR: `O Premium expirou. Novas ações Premium estão bloqueadas; suas alterações existentes, histórico, alertas e restauração continuam disponíveis.`
- EN: `Premium has expired. New Premium actions are blocked; your existing changes, history, alerts, and recovery remain available.`

## 13. Destructive and high-risk confirmations

Confirmation is proportional to risk.

### Level 1 — reversible preference

Examples: remove favorite, reset layout preference. Standard confirmation only when data would be lost.

### Level 2 — local data deletion

Examples: delete AI conversation, clear local report, remove manually added game.

Dialog must name the item and scope, explain irreversibility, and pair the destructive verb with an object-specific secondary action:

| Flow | Destructive PT-BR | Secondary PT-BR | Destructive EN | Secondary EN |
|---|---|---|---|---|
| Delete AI conversation | `Excluir conversa` | `Manter conversa` | `Delete conversation` | `Keep conversation` |
| Delete local report | `Excluir relatório` | `Manter relatório` | `Delete report` | `Keep report` |
| Remove manually added game | `Remover jogo` | `Manter jogo` | `Remove game` | `Keep game` |

### Level 3 — account or recovery consequence

Examples: revoke active device, delete support package, restore a complete plan.

Require account re-authentication where applicable, show downstream effects and current recovery evidence, then use the matching object-specific pair:

| Flow | Destructive PT-BR | Secondary PT-BR | Destructive EN | Secondary EN |
|---|---|---|---|---|
| Revoke active device | `Revogar dispositivo` | `Manter dispositivo conectado` | `Revoke device` | `Keep device connected` |
| Delete support package | `Excluir pacote de suporte` | `Manter pacote` | `Delete support package` | `Keep support package` |
| Restore a complete plan | `Restaurar plano completo` | `Manter estado atual` | `Restore complete plan` | `Keep current state` |

If a destructive flow is abandoned after its detail screen but before its confirmation dialog, the route action is `Voltar sem excluir` / `Go back without deleting`.

### Level 4 — future Extreme security operation

The preview must never promise permanent Defender removal or Tamper Protection bypass. Required sequence:

1. state requested versus actually observed protection;
2. explain security, update, management-policy, and recovery consequences;
3. authenticate;
4. verify recovery snapshot readiness;
5. require typed locale-specific phrase with paste disabled;
6. preview affected operations;
7. verify observed state afterward;
8. retain a persistent warning and direct restore action.

Typed phrase:

- PT-BR: `ALTERAR PROTEÇÃO`
- EN: `CHANGE PROTECTION`

Primary destructive copy:

- PT-BR: `Solicitar alteração da proteção`
- EN: `Request protection change`

The flow is scenario-only in Phase 2 and ends with the no-change preview receipt.

## 14. Charts, metrics, and provenance

### Required metadata

Every chart and metric group shows:

- provenance;
- source/collector;
- captured-at timestamp;
- sample duration and interval;
- environment/profile identity;
- quality status;
- collector overhead when available;
- missing coverage;
- comparison acceptance or rejection reason.

### Chart rules

- Maximum three simultaneous series by default.
- Primary series uses cobalt; comparison uses neutral white; warning thresholds use amber dashed lines. Semantic red is not used for ordinary negative deltas.
- Color-independent distinction uses solid, dashed, and dotted strokes plus different point markers.
- Axes include units. Zero is included only when analytically meaningful.
- Hover has an equivalent keyboard cursor and accessible data table.
- Live charts pause visual animation while keeping values current under reduced motion.
- A 1% low or FPS number is shown only if measured with approved quality. Otherwise render `Unavailable` with reason.
- Positive green does not automatically mean better: frame time and latency direction is stated in text.

### Comparison gate

Before/after visualization is replaced by a rejection explanation if game version, settings, workload, environment, sample quality, thermal state, or collector health is not comparable. No percentage badge is shown for rejected comparisons.

## 15. Motion and reduced motion

Responsive motion confirms change and preserves spatial context.

| Motion | Duration | Easing |
|---|---:|---|
| Hover/focus color | 100 ms | linear |
| Button/row state | 140 ms | cubic-bezier(0.2, 0, 0, 1) |
| Inspector/sheet | 180 ms | cubic-bezier(0.2, 0, 0, 1) |
| Route crossfade/translate | 220 ms | cubic-bezier(0.2, 0, 0, 1) |
| Progress-state handoff | 240 ms | cubic-bezier(0.2, 0, 0, 1) |

Rules:

- No animation exceeds 240 ms.
- No parallax, looping glow, scan line, particle, bouncing number, or count-up animation.
- Route motion translates at most 8 px.
- Telemetry does not animate decoratively; new samples appear or interpolate only when it improves reading.
- Reduced motion removes translation, scale, count-up, and animated chart interpolation. It retains immediate opacity/state changes up to 100 ms.
- Motion setting follows Windows by default and can be overridden in-app.

## 16. Accessibility and keyboard contract

### Keyboard map

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Open command center |
| `Ctrl+1…6` | Home, Prepare, Improve, Measure, Recover, Assistant |
| `Ctrl+Shift+A` | Open Activity |
| `Ctrl+,` | Open Settings |
| `Ctrl+.` | Open/close context inspector |
| `Alt+Left` | Back |
| `Alt+Right` | Forward when route history exists |
| `F6` | Cycle title bar, goal rail, main, inspector |
| `Escape` | Close the topmost non-destructive layer |
| `?` | Open shortcut help when focus is not in a text field |

Rules:

- Tab follows visual reading order; positive `tabindex` is forbidden.
- Roving tab index is used for goal rail, tabs, menus, and listboxes.
- Focus returns to the invoking control after overlays close.
- Focus is moved to a new route heading after navigation and announced once.
- Destructive actions never have a single-key shortcut.
- Drag-and-drop has complete keyboard alternatives.

### Semantics

- One `main` landmark, one visible H1-equivalent route heading, and named navigation/aside regions.
- Live regions are `polite` for progress and normal completion, `assertive` only for an immediate safety failure.
- Progress announces step changes, not every percentage.
- Virtualized lists expose position and total count.
- Charts have summary, table alternative, and keyboard cursor.
- Tooltips do not contain required information.
- Dialogs trap focus; sheets that do not block work do not falsely use modal semantics.

### Visual accessibility

- Focus ring is always visible on keyboard focus and never removed.
- 44 × 44 px pointer targets.
- Contrast meets Section 4 values; forced-colors mode receives visible borders and system colors.
- At 200% text scaling, critical copy and actions do not clip or overlap.
- At 150% app scale, workflows remain complete without page-level horizontal scroll.
- Compact density changes whitespace, not type size, target size, or semantic content.

## 17. Internationalization

- Message keys are semantic and feature-owned; do not concatenate translated fragments.
- Dates, time, numbers, percentages, temperatures, storage, and durations use locale-aware formatters.
- Keep technical identifiers, units, and operation IDs stable while translating their accessible descriptions.
- PT-BR is the default authoring locale; English receives equivalent review, not machine-only translation.
- Pseudo-locale expands every string by 35%, adds diacritics, and exposes hard-coded copy.
- Layout reserves 40% expansion for buttons and navigation labels; button text may wrap to two lines only in compact widths.
- Truncation is permitted only for file paths, IDs, and user-controlled names; provide full value on focus and in accessible name.
- Confirmation phrases are translated as whole tokens and displayed exactly.
- No product-critical string may fall back to an untranslated key.
- Architecture must not assume left-to-right geometry even though RTL is not a Phase 2 shipping locale.

## 18. Deterministic scenario matrix

Every scenario has a stable ID, seed, clock, locale, hardware fixture, adapter latency, and expected provenance. Screenshots and E2E tests must reference the ID.

| ID | Scenario | Required surfaces/states |
|---|---|---|
| S01 | Windows 11 desktop, mid-range Intel/NVIDIA, calibrated and ready | Home ready, selected game, verified fixture evidence |
| S02 | Windows 11 AMD laptop with hybrid GPU and recommendations | Calibration, component drill-down, plan review |
| S03 | Windows 11 high-end AMD/AMD, no urgent recommendation | Honest empty Home and controlled favorites |
| S04 | Windows 10 LTSC/ESU serviced | Lifecycle-specific compatibility and eligible operations |
| S05 | Windows 10 Home consumer build out of support | Critical lifecycle rail, unsupported exclusions |
| S06 | Partial inventory: GPU driver source unavailable | Partial failure, stale/unknown evidence, fail-closed plan |
| S07 | No games detected | Game-library empty state and manual add |
| S08 | Multiple launchers identify the same game | Identity resolution and duplicate explanation |
| S09 | Game launched externally | Automatic profile detection, active session, tray state |
| S10 | Supported game with degraded capture | Measure degraded state and unavailable 1% low |
| S11 | Two sessions are not comparable | Rejected comparison with exact reasons |
| S12 | Offline for 3 of 7 permitted days | Offline banner, Premium active, local functions available |
| S13 | Offline beyond entitlement window | Expired entitlement, retained recovery/history |
| S14 | Permission denied | Calibration permission state and safe alternative |
| S15 | Preview partial failure at dependency verification | Paused workflow, diagnostic ID, guided recovery |
| S16 | Restart pending | Home pre-emption, Activity, restart scheduler |
| S17 | Interrupted preview requires recovery | Critical rail, Recover emergency route, verified receipt |
| S18 | Future Extreme protection preview | Level 4 confirmation and no-change receipt |
| S19 | AI local mode, cloud consent denied | Local answer boundary and proposal review |
| S20 | Support bundle with sensitive fields | Preview, redact, consent, encrypt, expiry |
| S21 | Update signature invalid | Startup/update failure, safe current-version continuation |
| S22 | Slow adapter and cancelled calibration | Honest indeterminate progress, save and resume |
| S23 | PT-BR at 150% scale, long game name | Reflow, truncation exception, keyboard flow |
| S24 | English, forced colors, reduced motion | Complete accessible alternate rendering |

Scenario controls are available only in development/test tooling, never in the product navigation.

## 19. Visual regression and E2E acceptance

### Story catalog

Every component in Section 10 has stories for:

- default, hover, focus-visible, pressed, disabled, loading;
- error, warning, success, and unavailable where applicable;
- PT-BR, English, and pseudo-locale;
- reduced motion and forced colors;
- 100%, 125%, and 150% app scale;
- keyboard and screen-reader interaction.

### Screenshot matrix

Golden screenshots are captured in deterministic WebView2/browser rendering at:

- 1440 × 900, 1280 × 800, 960 × 700, and 760 × 600;
- PT-BR and English;
- default and reduced motion final frames;
- scenarios S01–S24 on their required routes;
- 100% scale for the full matrix and 150% scale for all critical workflows.

Unexpected pixel diffs fail CI. Baselines are updated only with a named design-contract reason and reviewer approval. Dynamic timestamps, IDs, and chart seeds are frozen.

### Automated accessibility

- Zero serious or critical axe violations on every route/state.
- No duplicate IDs, unnamed controls, missing dialog names, invalid ARIA relationships, or focus traps.
- Automated contrast checks cover every token pairing and chart legend.
- Keyboard E2E completes calibration, command navigation, favorite management, plan preview, restart scheduling, recovery preview, locale change, and account expiry access without pointer input.

### Manual accessibility

- NVDA on Windows 11 verifies route announcements, calibration progress, data tables, command center, dialogs, Activity, chart summary, and recovery flow.
- Windows High Contrast/forced colors verifies visible focus, selected state, semantic status, and control boundaries.
- 200% Windows text scale and 150% app scale verify no clipped product-critical content.
- Reduced motion verifies no translation, scale, animated counting, or chart interpolation.

### Desktop E2E

Run packaged Tauri journeys on clean supported Windows 11 and validated Windows 10 runner images:

1. install and launch non-elevated;
2. complete and resume calibration;
3. navigate Home → Improve → component → operation;
4. use command center only by keyboard;
5. pin and reorder favorites within limits;
6. prepare and preview-launch a game;
7. preview a plan, encounter partial failure, recover, and receive no-change receipt;
8. schedule restart and verify Activity/tray state;
9. enter expired entitlement and retain history/recovery;
10. switch locale, scale, motion, and density;
11. trigger single-instance deep link;
12. reject a fixture adapter in production configuration.

### Performance acceptance

- First meaningful shell appears within 2 seconds on the approved reference machine.
- No blank WebView frame is visible.
- Opening command center responds within 100 ms with local index loaded.
- Route interaction responds within 100 ms; route transition completes within 220 ms.
- Activity and 1,000-row evidence/ledger fixtures remain keyboard-responsive.
- Charts suspend expensive rendering when hidden or minimized.

## 20. Requirement traceability

| Requirement | Contract sections |
|---|---|
| UX-01 | 5, 8, 18, 19 |
| UX-02 | 8, 10, 11, 18, 19 |
| UX-03 | 7, 8, 12, 18 |
| UX-04 | 6, 8, 9 |
| UX-05 | 5, 8, 16 |
| UX-06 | 7, 8, 16 |
| UX-07 | 8, 10, 12, 18 |
| UX-08 | 5, 8, 9 |
| UX-09 | 5, 8, 12 |
| UX-10 | 4, 15, 16, 19 |
| UX-11 | 12, 17, 18, 19 |
| UX-12 | 4, 5, 15, 16, 19 |

## 21. Executor stop conditions

Stop and return to design review if any implementation requires:

- adding shadcn, a third-party registry, a dashboard template, or inherited visual library;
- a fifth font size, third weight, off-scale spacing value, or screen-local color;
- hiding fixture provenance to make a preview look real;
- adding a generic card grid, synthetic score, decorative animation, or promotional banner;
- reducing confirmation or recovery information to fit a layout;
- clipping PT-BR/English critical copy;
- removing keyboard, forced-colors, reduced-motion, or screen-reader behavior;
- presenting modeled, stale, rejected, or unavailable data as measured fact;
- changing the goal-first route model because a component library prefers another pattern.

The Phase 2 UI is accepted only when replacing deterministic adapters with future real adapters requires no change to information architecture, critical state machines, provenance language, risk confirmation, recovery presentation, or cross-boundary UX contracts.
