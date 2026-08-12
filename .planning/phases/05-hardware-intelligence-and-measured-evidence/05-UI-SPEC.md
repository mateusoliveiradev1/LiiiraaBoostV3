---
phase: 5
slug: hardware-intelligence-and-measured-evidence
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-12
---

# Phase 5 - UI Design Contract

> Visual and interaction contract for moving the desktop inventory and measurement experience from fixtures to real local evidence.

## Design Intent

Phase 5 is an authority transition, not a dashboard redesign. Preserve the authored Liiiraa Boost desktop shell, Measure routes, dense technical visual language, and current evidence primitives. Improve orientation by making the current evidence state, next safe action, source health, and limitations obvious before exposing detail.

The user must be able to answer four questions on every screen without opening a secondary panel:

1. Is this value observed, measured, unavailable, stale, or simulated?
2. Can I safely act on it?
3. What evidence produced the conclusion?
4. What should I do next?

## Design System

| Property               | Value                                                                       |
| ---------------------- | --------------------------------------------------------------------------- |
| Tool                   | existing bespoke Liiiraa Boost design system; no shadcn                     |
| Preset                 | existing Cobalt token authority                                             |
| Interaction primitives | existing accessible components; React Aria for new complex behavior         |
| Icon language          | existing `ProductIcon` set; icons support text and never carry status alone |
| Body font              | Manrope Variable                                                            |
| Data font              | JetBrains Mono Variable                                                     |
| Display font           | Saira Semi Condensed Variable                                               |

No third-party dashboard template or new component-library visual language may be introduced.

## Information Architecture

### Inventory

- Summary opens with lifecycle verdict, snapshot freshness, completeness, and a single `Atualizar inventário` action.
- Required classes remain visible even when unavailable. No category silently disappears.
- Category rows show a concise readable identity, support/quality status, and an evidence-details affordance.
- Raw identifiers are never displayed. Redacted or derived references use the data font.
- Compatibility verdicts link directly to the evidence rows and policy reason that produced them.

### Measure

- Overview prioritizes `Linha de base`, `Nova captura`, `Histórico`, and the last accepted comparison.
- Capture setup uses one vertical task flow: environment confirmation, collector readiness, resource budget, start/cancel, live health.
- Live capture keeps one stable layout; status updates do not replace inputs or move the primary cancellation action.
- History supports clear selection of exactly two eligible sessions and explains why ineligible sessions cannot be compared.
- Accepted comparison, diff, timeline, HTML preview, and JSON export share one comparison identity and metric values.
- Rejected comparison lists every blocker and offers the shortest corrective path without rendering deltas.

## Layout Contract

- Desktop work canvas keeps the existing route header and shell navigation.
- Primary content uses a maximum readable width and a 12-column grid where useful; do not stretch dense data across the full window.
- Above the fold: state/quality summary on the left, next safe action on the right.
- Technical metadata belongs in a persistent evidence rail or expandable region after the primary conclusion, never before it.
- Charts stack before collapsing. At narrow widths, controls become full-width and metadata follows the result in DOM order.
- No nested page-level scroll containers. Inspectors/dialogs may scroll internally only when focus remains trapped and their close/cancel action stays reachable.

## Spacing Scale

All new layout spacing must reuse the existing 4 px scale.

| Token          | Value | Usage                             |
| -------------- | ----- | --------------------------------- |
| `--lb-space-1` | 4px   | icon/text micro-gap               |
| `--lb-space-2` | 8px   | compact status and data spacing   |
| `--lb-space-3` | 16px  | controls and related content      |
| `--lb-space-4` | 24px  | card padding and section rhythm   |
| `--lb-space-5` | 32px  | route-level grouping              |
| `--lb-space-6` | 48px  | major workflow separation         |
| `--lb-space-7` | 64px  | exceptional page-level separation |

Exceptions: chart plot padding may use existing chart component internals; no new arbitrary spacing values.

## Typography

| Role             | Size                        | Weight  | Line height   | Font                 |
| ---------------- | --------------------------- | ------- | ------------- | -------------------- |
| Body             | 16px                        | 400     | 24px          | Manrope              |
| Label            | 14px                        | 600     | 20px          | Manrope              |
| Task heading     | 24px                        | 600     | 30px          | Manrope              |
| Page heading     | 32px                        | 600     | 38px          | Manrope              |
| Evidence/data    | 11-14px                     | 400-600 | at least 1.35 | JetBrains Mono       |
| Hero measurement | responsive, existing tokens | 600     | at least 1.0  | Saira Semi Condensed |

Long PT-BR labels must wrap instead of clipping. Units use semantic text, not generated-content-only labels.

## Color and Status

| Role            | Token/value                                            | Usage                                                 |
| --------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| Dominant canvas | `--lb-canvas` / `#03050b` fallback                     | route background                                      |
| Inset/surface   | `--lb-canvas-inset`, `--lb-panel`, `--lb-panel-raised` | hierarchy and evidence regions                        |
| Primary action  | `--lb-accent-electric` / `#1b93ff` fallback            | one primary action per task region                    |
| Evidence signal | `--lb-accent-cyan` / `#3ed8ff` fallback                | provenance, links, selected technical detail          |
| Success         | `--lb-success` / `#4bcb71` fallback                    | admitted/verified status with icon and text           |
| Warning         | `--lb-warning` / `#f7b828` fallback                    | stale/degraded/experimental status with icon and text |
| Critical        | `--lb-critical` / `#ff5f5b` fallback                   | failed authority, contradictory evidence              |
| Destructive     | `--lb-destructive` / `#df202e` fallback                | delete evidence and irreversible local cleanup only   |

Accent is reserved for the current selection, evidence links, focus, and the single primary action. Status always combines copy, icon, and the existing solid/dashed/double/dotted pattern vocabulary; color alone is insufficient.

## Copywriting Contract

Copy names the evidence state and the next safe action. Avoid vague `Erro`, fake certainty, and implementation terminology such as WMI, ETW, or PDH in the primary layer.

| Element               | PT-BR copy                                                                    | English copy                                                                |
| --------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Inventory CTA         | `Atualizar inventário`                                                        | `Refresh inventory`                                                         |
| Baseline CTA          | `Capturar linha de base`                                                      | `Capture baseline`                                                          |
| Session CTA           | `Iniciar captura`                                                             | `Start capture`                                                             |
| Active cancel         | `Encerrar captura com segurança`                                              | `Stop capture safely`                                                       |
| Empty history heading | `Nenhuma captura concluída`                                                   | `No completed captures`                                                     |
| Empty history body    | `Faça uma linha de base ou uma captura compatível para começar.`              | `Capture a baseline or supported session to begin.`                         |
| Unavailable metric    | `{Métrica} indisponível` plus named reason and recovery                       | `{Metric} unavailable` plus named reason and recovery                       |
| Rejected comparison   | `Estas sessões não podem ser comparadas` plus all blockers                    | `These sessions cannot be compared` plus all blockers                       |
| Stale snapshot        | `Inventário desatualizado` plus observed time and refresh action              | `Inventory is out of date` plus observed time and refresh action            |
| Export CTA            | `Exportar relatório técnico`                                                  | `Export technical report`                                                   |
| Delete confirmation   | `Excluir evidência local`: state exactly what remains protected by references | `Delete local evidence`: state exactly what remains protected by references |

Use `medido` only for a completed admitted capture, `observado` for inventory, `indisponível` for absent/unreliable data, and `simulado` only in explicit development/test composition.

## Interaction and State Contract

- Refresh preserves the last admitted snapshot while showing progress and its age.
- Inputs never clear because a query revalidates or focus changes.
- Start actions disable only after the request is admitted and expose cancellation immediately.
- Cancellation is idempotent and returns a visible `incompleta` record when evidence was already written.
- Unavailable and degraded metrics render no numeric placeholder that could be read as a measurement.
- Comparison selection announces count and eligibility to assistive technology.
- Charts include text summaries, accessible series names, units, and a tabular/detail alternative.
- Evidence links move focus to the referenced row/region and provide a return path.
- Export success reveals file location and integrity identity; it does not auto-open or upload.
- Reduced motion removes route/chart transitions while retaining state continuity.

## Responsive and Scaling Contract

- Support the existing desktop scale modes through 150% and Windows text scaling without horizontal page scroll.
- At widths below the existing adaptive breakpoint, summary/action columns stack in DOM order.
- Evidence tables use the existing labeled viewport pattern and preserve row identity; do not shrink text below tokens.
- At 200% browser zoom, primary action, cancellation, quality status, and unavailable reasons remain visible without two-dimensional scrolling.

## Accessibility Contract

- WCAG 2.2 AA contrast and focus visibility on dark and light themes.
- Full keyboard operation for refresh, selection, capture, cancel, compare, evidence navigation, and export.
- Live regions are polite for sampling progress and assertive only for capture failure or evidence invalidation.
- No high-frequency numeric announcement; summarize live capture at bounded intervals and on user request.
- Status, quality, provenance, and admission are never encoded by color alone.
- Locale changes preserve the current route and selected evidence where valid.

## Performance Contract

- Hidden charts suspend expensive rendering while native collection continues only according to its explicit capture policy.
- UI progress renders from bounded summaries, not raw high-frequency samples.
- Route transitions never trigger native re-inventory unless the user or freshness policy requests it.
- Large session history and evidence lists use bounded pagination/windowing while keeping accessible row counts.

## Registry Safety

| Registry                          | Blocks used                                                                        | Safety gate                                           |
| --------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Existing repository design system | evidence, data, route header, buttons, icons, status                               | existing conformance, accessibility, and visual tests |
| React Aria                        | only new complex interaction primitives if existing components cannot express them | keyboard and focus tests required                     |
| Third-party visual registries     | none                                                                               | prohibited for this phase                             |

## Visual Verification Matrix

- Inventory: complete, partial, stale, lifecycle unsupported, lifecycle unknown, permission denied, contradictory.
- Baseline: idle, readiness blocked, collecting, cancellation, incomplete, completed, reopen after restart.
- Capture: supported, unsupported workload, source loss, degraded, clock discontinuity, collector termination.
- Comparison: select zero/one/two, accepted, every rejection family, evidence navigation.
- Report: preview, HTML/JSON export success, tamper failure, missing optional metric.
- Viewports: standard desktop, compact desktop, 150% app scale, 200% zoom, PT-BR long copy, reduced motion, light/dark, forced colors.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS - state and recovery language is explicit in both locales.
- [x] Dimension 2 Visuals: PASS - preserves the bespoke product hierarchy and defines responsive evidence composition.
- [x] Dimension 3 Color: PASS - token-bound accent/status use and non-color patterns are locked.
- [x] Dimension 4 Typography: PASS - existing three-font hierarchy and scaling behavior are specified.
- [x] Dimension 5 Spacing: PASS - existing 4 px scale is reused without arbitrary values.
- [x] Dimension 6 Registry Safety: PASS - no template/shadcn dependency; new primitives remain governed.

**Approval:** approved 2026-08-12
