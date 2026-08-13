---
phase: 6
slug: transactional-plans-and-recovery
status: pending-review
reviewed_at: 2026-08-12T23:58:47.6539196-03:00
shadcn_initialized: false
preset: none
created: 2026-08-12
---

# Phase 6 - UI Design Contract

> Visual and interaction contract for personalized plan approval, verified execution, interruption recovery, and exact restoration on Windows.

## Design Intent

Phase 6 is an authority transition, not a dashboard redesign. Preserve the existing Liiiraa Boost desktop shell, Cobalt visual language, Improve information architecture, Recovery surfaces, and authored evidence primitives. Replace preview-only claims with native projections from the plan and recovery authority, while keeping deterministic scenarios explicitly marked in test composition.

The experience must feel calm during consequential work. It must never use urgency, celebratory animation, optimistic success, or generic error copy to conceal uncertainty. The user must be able to answer these five questions from the primary layer of every plan or recovery screen:

1. What exact operation or dependency group is under review?
2. What evidence admits or blocks it, and how fresh is that evidence?
3. What will change, what is the highest risk, and will Windows need a restart?
4. What exact prior state and recovery method are protected?
5. What is the next safe action now?

Source: `06-CONTEXT.md` D-03 through D-30, PLAN-01 through PLAN-08, and the existing Phase 2/5 desktop contracts.

## Design System

| Property | Value |
| --- | --- |
| Tool | Existing bespoke Liiiraa Boost design system; no shadcn |
| Preset | Existing Cobalt token authority |
| Component library | Product-owned `Lb*` components with React Aria behavior for complex controls |
| Icon library | Existing `ProductIcon` vocabulary and approved Lucide-backed status icons; icons always accompany text |
| Body font | Manrope Variable |
| Data font | JetBrains Mono Variable |
| Display font | Saira Semi Condensed Variable only for the product identity; routine desktop headings remain Manrope |

No third-party dashboard template, registry block, parallel token system, or stock component-library styling may be introduced. Extend the current primitives through their public package exports.

## Information Architecture

### Improve: Plan workspace

- The plan route opens with the current immutable revision identity, evidence freshness, highest included risk, recovery readiness, operation count, and one next safe action.
- Plan composition proceeds from current goals, Phase 5 capabilities, and admitted evidence. Unknown, stale, degraded, contradictory, incompatible, or revoked evidence remains visible and blocks affected operations; it never disappears or becomes compatible by default.
- The plan review groups operations first by risk (`Verificado`, `Avançado`, `Experimental`, `Extremo`) and then by dependency group. Preserve topological apply order within each group.
- Each operation row shows name, purpose summary, expected direction, risk text/pattern, compatibility verdict, evidence quality, restart effect, recovery readiness, inclusion control, and an explicit `Revisar operação` / `Review operation` affordance.
- Operation detail exposes all PLAN-03 fields without a secondary navigation hop: purpose, expected impact, immutable risk/version, evidence and freshness, compatibility reason, restart effect, exact prior value, requested value, dependency group, and recovery method.
- Editing inclusion or risk ceiling creates a new revision and announces that prior approval is no longer valid. Never mutate an approved revision in place.
- `Extremo` remains visible with its explanation and blocked state, but no execution or confirmation control exists in the DOM.

### Execution workspace

- Use one stable composition throughout preparation, apply, observation, verification, pause, restart, and recovery. Do not replace the whole page for every event.
- The primary region shows the current operation, its dependency group, and the exact human state. A compact ordered timeline shows completed, current, and pending stages.
- A persistent safety summary shows protected prior state, recovery method, checkpoint status, and whether new mutations are admitted.
- Progress is transaction-based, not percentage theater. Show named stages such as `Preparing recovery`, `Applying`, `Observing Windows`, and `Verifying result`; never infer completion from elapsed time.
- `Cancel safely` requests a stop at the next safe boundary. While an atomic operation is finishing, explain that no new operation will start and keep the current stage visible.
- Closing the window during active execution or recovery presents one concise explanation that work continues in the protected executor, then sends the UI to the tray. Reopening restores the authoritative snapshot before rendering progress.
- Restart-required work creates a protected checkpoint and offers `Restart later` and `Open restart plan`. The app never starts or schedules a restart without a separate user choice.

### Recovery Center

- Recovery is one top-level workspace and remains available offline, signed out, or without Premium.
- When unresolved recovery exists, the Recovery Center becomes the first content presented after startup and all new-mutation controls elsewhere are disabled with a direct link back.
- The overview orders content as: current safety verdict, next safe action, active transaction timeline, affected dependency group, available recovery targets, then immutable history.
- Recovery targets are separate explicit actions: restore one operation, restore the complete plan, or restore a checkpoint. Never place them behind one ambiguous `Restore` action.
- Applying and restoring are both new auditable transactions. History rows are immutable and ordered; no UI offers edit, delete, or status rewriting.
- A receipt opens with a human summary and verification result. Technical detail is a disclosure containing transaction ID, operation version, prior/requested/observed state, recovery method, journal correlation, timestamps, and diagnostic/export identity.
- Diagnostic export always opens a local preview/redaction review before a file is created or shared. Nothing uploads automatically.

## Layout Contract

- Preserve the existing desktop route header, goal rail, native window controls, and route canvas.
- At ordinary desktop width, use the existing unequal two-column work pattern: the plan/timeline occupies the flexible focal column and a minimum 280px safety summary occupies the secondary column. The summary may be sticky only inside the route canvas and must never cover the final action.
- Operation review uses dense authored rows, not independent floating cards. One raised focal panel may identify the current operation or blocking decision; surrounding content remains tonal.
- Technical identifiers and exact state diffs use an inspector or disclosure after the human conclusion. They never lead the page.
- At the existing compact desktop breakpoint, the safety summary follows the focal content in DOM order. At the existing narrow container breakpoint, controls become full-width, operation metadata stacks, and no horizontal page scroll is allowed.
- Dialogs are reserved for fresh authentication and final risk confirmation. Drift, conflict, partial failure, restart, and guided recovery are route-level states because they require durable context and navigation.
- No nested page-level scroll container. An inspector/dialog may scroll internally only when focus is trapped and its close/cancel control remains reachable.

## Spacing Scale

Declared values reuse the existing design-token authority; all new spacing is a multiple of 4.

| Token | Value | Usage |
| --- | --- | --- |
| `--lb-space-1` | 4px | Icon/text micro-gap and inline status separation |
| `--lb-space-2` | 8px | Compact metadata, timeline markers, related status labels |
| `--lb-space-3` | 16px | Control groups and operation-row internal spacing |
| `--lb-space-4` | 24px | Panel padding and section rhythm |
| `--lb-space-5` | 32px | Route-level grouping and desktop canvas padding |
| `--lb-space-6` | 48px | Major workflow separation |
| `--lb-space-7` | 64px | Exceptional page-level separation only |

Exceptions: icon-only and ordinary controls retain the existing 44px minimum target; standard rows remain 52px and primary rows 64px. Timeline connector width and status borders may reuse existing 1px/2px component internals. No arbitrary new spacing values.

## Typography

Use exactly the existing four product sizes and two language weights.

| Role | Size | Weight | Line Height | Font |
| --- | --- | --- | --- | --- |
| Body | 16px | 400 | 24px (1.5) | Manrope Variable |
| Label | 14px | 600 | 20px | Manrope Variable |
| Task heading | 24px | 600 | 30px | Manrope Variable |
| Page heading | 32px | 600 | 38px | Manrope Variable |

JetBrains Mono uses the 14px label size or 16px body size with weights 400/600 for transaction IDs, operation versions, exact values, timestamps, and hashes. It never styles whole paragraphs. Long PT-BR labels wrap; controls expand vertically instead of clipping. Do not use Saira Semi Condensed for routine plan, risk, recovery, or receipt headings.

## Color

| Role | Token/value | Usage |
| --- | --- | --- |
| Dominant (60%) | `--lb-canvas` / `#03050b` fallback | Route background and uninterrupted outer field |
| Secondary (30%) | `--lb-canvas-inset`, `--lb-panel`, `--lb-panel-raised` / `#050a14`, `#081220`, `#0d1c30` | Plan rows, safety summary, timeline, inspector, Recovery Center |
| Accent (10%) | `--lb-accent-electric` / `#1b93ff`; evidence signal `--lb-accent-cyan` / `#3ed8ff` | The single primary action, current selection/stage, evidence links, and focus only |
| Success | `--lb-success` / `#4bcb71` | Verified observed result with icon, text, and solid pattern |
| Warning | `--lb-warning` / `#f7b828` | Drift, degraded evidence, safe-boundary wait, restart pending with icon/text/pattern |
| Critical | `--lb-critical` / `#ff5f5b` | Conflict, unknown state, failed verification, blocked recovery with icon/text/pattern |
| Destructive | `--lb-destructive` / `#df202e` | Final confirmation that intentionally replaces a conflicting current state or removes a local draft only; never a status fill |

Accent is reserved for the single primary action in the current task region, selected operation/revision, current timeline stage, evidence/detail links, and keyboard focus. It is not applied to every interactive control. Risk and state always combine localized text, an icon, and the existing solid/dashed/double/dotted pattern vocabulary; color alone is never authoritative.

## Component Contract

### Reuse without visual forks

- `RouteHeader`, `LbButton`, `LbIconButton`, `LbSwitch`, `LbRadioGroup`, `LbTextField`, `LbDialog`, `LbAlertDialog`, `LbDisclosure`, `LbProgress`, `LbOperationalNotice`, `LbPanel`, and `LbInspector`.
- `OperationRow`, `OperationInspector`, `PlanDependencyList`, `BeforeAfterDiff`, `RiskClass`, `RiskGate`, `RestartPlanner`, `RecoveryCheckpoint`, `VerificationReceipt`, `ChangeLedger`, `SystemStateLedger`, `StatusSignal`, `QualityMark`, and `ProvenanceMark`.
- Existing `ProductIcon` names and evidence/status projections. A new icon requires product-icon registration and an accessible text label.

### Required extensions

- `PlanRevisionSummary`: revision identity, evidence fingerprint state, highest risk, operation count, recovery readiness, and approval validity.
- `ExecutionTimeline`: ordered semantic list with one `aria-current="step"`; stages expose text and timestamps without simulated percentages.
- `RecoveryTargetList`: separate operation, full-plan, and checkpoint restore choices with current-state preconditions.
- `StateTripletDiff`: exact `Prior`, `Requested`, and `Observed` values for drift/conflict; do not force the three-way case through a two-column before/after component.
- `VerifiedReceiptDetails`: human summary plus a closed technical disclosure; receipt content is immutable.

Extend existing product components where their semantics already match. Create a new public component only for the genuinely new revision, three-state diff, or transactional timeline concepts above.

## Risk and Confirmation Contract

| Risk | Review and confirmation |
| --- | --- |
| Verificado | Clear full-plan review, visible recovery readiness, then one `Aplicar plano verificado` / `Apply verified plan` confirmation. |
| Avançado | Expanded consequences and exact recovery detail, completed recovery preparation, then fresh action-scoped strong authentication. Confirmation remains unavailable until proof is accepted. |
| Experimental | Everything in Avançado, proven operation recovery plus complementary Windows restore-point status, consent for the exact operation version and this apply, fresh strong authentication, and the exact localized phrase `APLICAR PLANO EXPERIMENTAL` / `APPLY EXPERIMENTAL PLAN`. |
| Extremo | Visible explanation and blocked status only. No enabled or disabled execution button, no typed phrase, and no broker command path. |

- The global risk policy is labeled `Limite máximo de risco` / `Maximum risk ceiling`; helper copy states that it does not select operations automatically.
- A mixed plan displays its highest risk in the revision summary and retains per-operation confirmations for sensitive operations.
- Any revision, evidence, compatibility, recovery-readiness, or risk change invalidates approval. Show the exact diff, move focus to its heading, and require a fresh review.
- Strong authentication UI may open the approved system-browser flow, but the renderer never displays or accepts a `strongAuth: true` shortcut.

## Copywriting Contract

Copy states what happened, what remains uncertain, and the next safe action. Primary copy avoids raw transport enums, implementation vocabulary, urgency, and unverified performance claims.

| Element | PT-BR copy | English copy |
| --- | --- | --- |
| Generate plan CTA | `Gerar plano seguro` | `Generate safe plan` |
| Primary apply CTA | `Aplicar plano verificado` | `Apply verified plan` |
| Safe cancel | `Cancelar com segurança` | `Cancel safely` |
| Recovery entry | `Abrir Central de Recuperação` | `Open Recovery Center` |
| Empty state heading | `Nenhum plano pronto` | `No plan is ready` |
| Empty state body | `Atualize as evidências do PC e escolha seus objetivos para gerar um plano.` | `Refresh this PC's evidence and choose your goals to generate a plan.` |
| Stale approval | `O plano mudou desde a aprovação` | `The plan changed after approval` |
| Stale approval body | `Revise as diferenças antes de confirmar novamente.` | `Review the differences before confirming again.` |
| Applying state | `Aplicando a operação {n} de {total}` | `Applying operation {n} of {total}` |
| Observing state | `Verificando o estado real do Windows` | `Checking the actual Windows state` |
| Success heading | `Plano aplicado e verificado` | `Plan applied and verified` |
| Error heading | `A aplicação foi pausada` | `Application was paused` |
| Error body | `Nenhuma nova operação será iniciada. Revise o estado observado e abra a recuperação guiada.` | `No new operation will start. Review the observed state and open guided recovery.` |
| Unknown heading | `O resultado ainda é desconhecido` | `The result is still unknown` |
| Unknown body | `O Liiiraa Boost observará o Windows antes de oferecer uma nova tentativa.` | `Liiiraa Boost will observe Windows before offering another attempt.` |
| Recovery empty heading | `Nenhuma recuperação pendente` | `No recovery is pending` |
| Recovery empty body | `Aplicações e restaurações verificadas aparecerão aqui com seus comprovantes.` | `Verified applies and restores will appear here with their receipts.` |
| Receipt disclosure | `Ver detalhes técnicos` | `View technical details` |
| Diagnostic CTA | `Revisar diagnóstico para exportação` | `Review diagnostic for export` |
| Restart CTA | `Abrir plano de reinicialização` | `Open restart plan` |

### Consequential confirmations

- Restore one operation: `Restaurar esta operação` / `Restore this operation`. The confirmation names the exact operation and prior state.
- Restore full plan: `Restaurar plano completo` / `Restore full plan`. The confirmation lists the affected dependency groups and states that verified independent work may also be restored by this choice.
- Resolve a conflict by replacing current state: `Restaurar o estado anterior` / `Restore the prior state`. The dialog presents Prior, Applied, and Current values before enabling confirmation.
- Keep external change: `Manter o estado atual` / `Keep current state`. This is a secondary non-destructive action and records a new auditable resolution; it never erases the original receipt.
- Delete an unapproved local draft only: `Excluir rascunho do plano` / `Delete plan draft`. State that receipts, checkpoints, and applied state are unaffected.

## Interaction and State Contract

### Plan lifecycle

- Required visible states: composing, ready, blocked by evidence, blocked by policy, revision changed, recovery preparation, awaiting authentication, awaiting typed consent, approved, and revoked.
- Generate/add/remove actions preserve the last admitted plan while the next revision is composed. Do not blank the workspace or show skeletons over already-known truth.
- Operation inclusion controls remain keyboard operable and announce selected count plus the new highest-risk plan level.
- A plan cannot advance while any included dependency is blocked, recovery preparation is incomplete for its risk, or approval fingerprint is stale.

### Execution lifecycle

- Required visible states: preparing, applying, observing, verifying, safe-boundary cancellation requested, paused, restart pending, reconnecting, partial failure, dependency rollback, recovery required, verified complete, and verified restored.
- Ordered native events update only when the sequence is contiguous. A gap, renderer reload, or tray reopen marks the projection stale and fetches the authoritative snapshot before further progress is shown.
- Mutations have no generic retry button. A retry appears only after observation and is labeled as a new reviewed transaction.
- Partial failure identifies the failed operation, the affected dependency closure, independent operations preserved, rollback outcome, and the next safe action.
- Success is rendered only after observed state equals requested state and the immutable receipt is appended. Dispatch success alone never triggers success copy.

### Drift, conflict, and recovery

- Drift before apply pauses the plan and shows expected prior versus observed current state, with `Keep current state`, `Review updated plan`, or `Reapply when safe` only when native policy admits them.
- A restore conflict shows prior, applied, and observed current state together. No value is preselected and no timeout chooses for the user.
- Failed restoration or unknown prior state disables all new mutations globally, uses an assertive announcement once, and opens guided recovery with safe options, complementary Windows Restore status, and diagnostic preview.
- Signed revocation blocks new apply and warns affected users; local restoration controls remain enabled and no remote rollback occurs.

## Motion and Feedback Contract

- Use existing motion roles: 100ms hover, 160ms control, 200ms panel, and 220ms route transitions. No new transition exceeds the token authority.
- Current-stage changes may use opacity plus at most 8px translation. Progress connectors do not pulse continuously and telemetry is never decorative.
- Reduced motion sets translation to zero, removes glows and staged delays, and changes state immediately while preserving focus and announcements.
- Normal preparation/apply progress uses a polite live region with bounded stage announcements. Conflict, failed verification, and blocked recovery use one assertive announcement on state entry, not on every event.
- Toasts acknowledge background continuity or file export only. Consequential state and recovery instructions remain in the route.

## Responsive and Scaling Contract

- Support existing app-scale modes through 150%, 200% browser zoom, and Windows text scaling without horizontal page scroll.
- At compact widths, the focal plan/timeline appears before the safety summary in DOM order. Sticky behavior is removed.
- Operation rows preserve name, risk, state, inclusion control, and inspect affordance; secondary evidence detail moves below, never disappears.
- Timeline stages may stack vertically but retain chronological order and `aria-current`.
- Three-state conflict values stack as Prior, Applied/Requested, and Observed; labels repeat with each value so meaning survives reflow.
- Confirmation controls stay reachable with PT-BR long copy, on-screen keyboard, and zoom. No fixed-height dialog may clip the required recovery explanation.

## Accessibility Contract

- Meet WCAG 2.2 AA in dark, light, forced-colors, reduced-motion, 150% app scale, and 200% zoom presentations.
- All plan composition, inclusion, risk selection, operation inspection, confirmation, cancellation, restart, recovery target selection, receipt disclosure, and diagnostic export flows are fully keyboard operable.
- Focus order follows task order. Opening an inspector/dialog moves focus to its heading; closing returns focus to the exact trigger. Route-level conflict/recovery moves focus to the state heading after navigation.
- The execution timeline is an ordered list; only the active stage uses `aria-current="step"`. Decorative connectors are hidden from assistive technology.
- Status and risk never rely on color. Preserve localized text, icon, and border/pattern signals in forced colors.
- Disabled controls expose the specific blocking reason in adjacent text and through `aria-describedby`; do not rely on tooltips.
- Exact IDs and hashes have readable labels and safe wrapping/copy behavior. Screen readers hear the human label before the raw identifier.
- Locale changes preserve plan/recovery route, revision identity, and current focus target where valid. Product-critical copy must exist in PT-BR and English before a state is reachable.

## Performance Contract

- UI progress is event-driven and renders bounded authoritative projections, never raw broker events or aggressive polling.
- A sequence gap causes one deduplicated snapshot fetch. Reconnect does not create a retry loop or duplicate mutation request.
- Long immutable histories use bounded pagination/windowing while preserving semantic totals and stable focus/row identity.
- Hidden inspectors and inactive route panels suspend expensive rendering; the native executor continues independently.
- No motion, status animation, or high-frequency announcement may threaten the desktop memory/startup budgets or game-time idle behavior.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
| --- | --- | --- |
| Existing repository design system | Product-owned plan, evidence, status, form, overlay, ledger, and recovery primitives | Existing package conformance, accessibility, forced-colors, reduced-motion, and visual tests |
| React Aria | Behavior only for dialog, radio, switch, disclosure, focus, and selection semantics | Existing dependency; component and keyboard/focus tests required |
| shadcn official | none | Not initialized; explicitly excluded by project stack decision |
| Third-party visual registries | none | Prohibited for this phase |

## Visual Verification Matrix

- Plan composition: loading over admitted revision, empty, ready, stale evidence, contradictory evidence, unsupported operation, revoked operation, and Extremo visible/blocked.
- Plan review: add/remove, immutable revision change, mixed-risk grouping, blocked dependency, stale approval diff, all four risk policies, and PT-BR long copy.
- Confirmation: Verificado, Avançado authentication pending/success/failure/expired, Experimental recovery missing/phrase mismatch/ready, and no Extremo execution control.
- Execution: preparing, applying, observing, verifying, safe cancel requested, close-to-tray, reconnect with contiguous sequence, sequence gap/refetch, verified success, and receipt append failure.
- Recovery: crash/reboot reconciliation, not applied, applied-needs-receipt, unknown, drift, three-state conflict, partial failure with scoped rollback, restore one, restore full plan, checkpoint restore, restore failure, and signed revocation.
- Restart: checkpoint prepared, no restart chosen, restart pending, first-boot verification, and mutation blocked until verification.
- Receipt/export: apply receipt, restore receipt, technical disclosure, local redacted preview, export success, export failure, and tamper/journal integrity failure.
- Viewports/preferences: standard and compact desktop, narrow route container, 150% app scale, 200% zoom, PT-BR and English, dark/light, reduced motion, forced colors, keyboard-only, and screen-reader semantics.

## Checker Sign-Off

The contract remains `pending-review`; no unchecked dimension is treated as approved, and execution must not claim UI authority until the UI checker records all six PASS results.

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
