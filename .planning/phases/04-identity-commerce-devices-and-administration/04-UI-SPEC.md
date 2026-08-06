---
phase: 04
slug: identity-commerce-devices-and-administration
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-06
---

# Phase 04 — UI Design Contract

> Visual and interaction contract for the production-grade Admin Web redesign and its bounded desktop handoff. This contract does not authorize implementation until verification passes.

## Scope and surface boundary

- The designed product is the isolated **Admin Web** application at its own origin and deployment, not a route embedded in the public/account site and not an embedded desktop panel.
- The Windows desktop remains the customer optimizer. For an authorized identity it may render database-backed plan, administrator membership, and active-function labels plus an **Open Admin** action that launches the secure Admin Web in the system browser.
- Administrative data, commands, role assumption, approvals, and audit views never render inside the desktop WebView.
- The contract covers the whole Admin surface: overview, people, revenue, operation, support, security, system, invitations, team access, jobs, incidents, audit, search, inbox, inspectors, dialogs, sheets, and all responsive/degraded states.

## Approved visual direction

**Selected lane:** hybrid of the three owner-reviewed probes.

- **Base:** Calm Briefing — premium calm, strong typographic hierarchy, and one clear operational priority.
- **Structure:** Mission Control — stable domain navigation, central work queue, and contextual inspector.
- **Power-user density:** Operational Ledger — compact density mode, exact data alignment, saved views, durable jobs, and evidence-rich detail.

**Scene sentence:** A Security or Operations administrator works before dawn in a low-light room, focused or under pressure; the interface must reduce uncertainty, surface the next consequential action, and remain calm when systems are degraded.

**Color strategy:** Restrained. Perceptually neutral black/graphite carries at least 90% of an ordinary screen. Mineral cobalt marks focus, verified selection, and the current primary action only.

**Anti-direction:** No generic SaaS dashboard, repeated metric-card grid, giant KPI tile, RGB gamer treatment, purple gradient, decorative glow, glassmorphism, ornamental chart, fake urgency, or reskinned component-library template.

## Design system

| Property               | Contract                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Tool                   | Existing bespoke Liiiraa Boost design system; no shadcn initialization                                           |
| Interaction primitives | React Aria Components for menus, dialogs, sheets, tables/grids, tabs, comboboxes, tooltips, and focus behavior   |
| Icon library           | Existing `ProductIcon` mapping backed by Phosphor; one consistent weight per context                             |
| Language font          | Manrope Variable, weights 400 and 600                                                                            |
| Data font              | JetBrains Mono Variable, weights 400 and 600; identifiers, timestamps, diffs, and aligned numeric evidence only  |
| Display font           | Saira Semi Condensed Variable only for the product wordmark or rare environment identity; never routine headings |
| State management       | Existing typed route/search state and workflow machines; server data remains outside client-global UI state      |
| Theme                  | Dark-only for this phase; forced-colors and OS contrast modes remain fully operable                              |

Existing tokens in `packages/design-tokens/src/tokens.css` are the starting authority. Refinements must preserve token names or migrate them centrally; page-local hex values are forbidden.

## Information architecture

### Stable domains

1. **Visão geral** — daily briefing, operational priorities, environment health, capacity warnings, and business context.
2. **Pessoas** — users, beta invitations, administrative team, functions, capabilities, scopes, sessions, and access reviews.
3. **Receita** — subscriptions, invoices, payments, refunds, disputes, and provider reconciliation.
4. **Operação** — work queue, jobs, imports, exports, releases, configurations, and capacity.
5. **Atendimento** — cases, consent-bound diagnostics, handoffs, and response obligations.
6. **Segurança** — alerts, authentication, recovery, break-glass, privacy requests, policies, and incident containment.
7. **Sistema** — integrations, webhooks, audit, environments, feature/configuration versions, and service health.

The domain tree stays stable. Server-authorized visibility removes inaccessible destinations; it does not replace the hierarchy with a role-specific product.

### Cross-domain utilities

- Universal search and command center.
- Persistent actionable inbox.
- Saved official and personal views.
- Durable jobs/activity center.
- Current environment, freshness, and active administrative function.
- Account/function menu and safe function switch.

## Responsive composition

| Width         | Navigation                                                                 | Work surface                                                                            | Inspector and complex flows                                                              |
| ------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `>= 1440px`   | Expanded sidebar, 232–256px; user may persist compact mode                 | Briefing or table/list uses remaining width; max-width is removed for data workspaces   | Docked 360–440px inspector; complex workflows remain full routes                         |
| `1180–1439px` | Compact 72px sidebar by default, expandable without covering work          | Tables prioritize essential columns and allow governed column selection                 | Inspector becomes a fixed side sheet; route state remains canonical                      |
| `960–1179px`  | Compact rail; labels available through accessible tooltips and expansion   | List/table switches to fewer columns; no information is discarded without a detail path | Side sheet up to 420px or full route for review/approval                                 |
| `640–959px`   | True modal drawer opened by a labelled menu control                        | Operational list rows replace desktop tables; filters open in a sheet                   | Full route by default; no squeezed three-column composition                              |
| `< 640px`     | Full-height drawer with domain groups, environment, function, and sign-out | Single-column task feed, 16px page inset, 44px minimum targets                          | Every record, approval, invitation, job, and incident uses a dedicated full-screen route |

Rules:

- Sidebar preference persists per administrator and environment.
- Mobile parity means equivalent capability and evidence, not identical desktop geometry.
- No horizontal page scrolling. Data tables may use an explicitly labelled internal viewport only at desktop/tablet widths.
- At 200% text zoom and 320 CSS px viewport, reading order, focus order, actions, and error recovery remain complete.
- Safe filters, sorting, page/cursor, active tab, saved view, density, and opaque record ID remain in the URL. Secrets, email addresses, reasons, drafts, and sensitive values do not.

## Layout contracts

### Admin shell

- Top bar height: 52px desktop/tablet, minimum 56px mobile.
- Expanded sidebar: 240px target; compact rail: 72px target.
- Global search occupies the flexible center of the top bar and opens the command center without navigating.
- Environment and freshness are always visible on desktop and one action away on mobile.
- Current administrative function is visible at all sizes and must never be inferred from color alone.
- Sidebar and top bar use tonal separation and one-pixel dividers, not floating cards or wide shadows.

### Overview / Calm Briefing

- One concise priority statement leads; it describes real work, never marketing or a fake metric.
- The next-action queue follows immediately and supports drill-in without losing place.
- Business context appears as restrained inline facts or a compact ledger after operational priorities.
- Capacity warnings and incident state appear only when actionable and link directly to the responsible workflow.

### List plus inspector

- Desktop list/table is the canonical browsing surface; selection opens a docked inspector while preserving filters, scroll, and focus origin.
- Inspector sections are Summary, Timeline, Evidence, Related records, and Actions. Tabs appear only when every tab has meaningful content.
- A full-route affordance is always present; mobile opens that route directly.
- Closing returns focus to the previously selected row. Browser Back restores the previous selection and URL state.
- Bulk actions appear in one sticky action strip only after selection and always state the selected count.

### Forms and risky workflows

- Ordinary forms use one primary action, an explicit cancel/back path, inline field errors, and a top summary only when multiple fields fail.
- Sensitive actions add reason and fresh reauthentication.
- Critical actions add impact review and an independent approval state.
- Irreversible or mass actions show exact scope, consequences, approvers, short validity, and final receipt; they never use a one-click shortcut.
- Break-glass is visually distinct through language, boundary pattern, and explicit time limit, not theatrical red glow.

## Spacing scale

All layout spacing uses the established 4px-derived scale.

| Token          | Value | Usage                                                           |
| -------------- | ----- | --------------------------------------------------------------- |
| `--lb-space-1` | 4px   | Icon/text micro-gap, focus separation                           |
| `--lb-space-2` | 8px   | Compact controls, row metadata, tag internals                   |
| `--lb-space-3` | 16px  | Default control grouping and mobile page inset                  |
| `--lb-space-4` | 24px  | Desktop section rhythm and comfortable panel padding            |
| `--lb-space-5` | 32px  | Page-level desktop padding and briefing separation              |
| `--lb-space-6` | 48px  | Major route transitions and empty-state breathing room          |
| `--lb-space-7` | 64px  | Rare structural dimension, never repeated decorative whitespace |

Exceptions: 52px top bar, 72px compact navigation rail, 240px expanded sidebar, 360–440px inspector. These are structural dimensions, not spacing tokens.

Density changes row and grouping rhythm only:

- Comfortable: 52px standard row, 16px control gap, 24px section gap.
- Compact: 44px dense row, 8px control gap, 16px section gap.
- Touch layouts retain at least 44×44px targets regardless of selected density.

## Typography

| Role         | Family         | Size    | Weight  | Line height | Contract                                                            |
| ------------ | -------------- | ------- | ------- | ----------- | ------------------------------------------------------------------- |
| Data/meta    | JetBrains Mono | 12–13px | 400/600 | 18px        | IDs, timestamps, hashes, amounts, aligned figures; never paragraphs |
| Label        | Manrope        | 14px    | 400/600 | 20px        | Controls, columns, status labels, metadata                          |
| Body         | Manrope        | 16px    | 400     | 24px        | Explanations, form help, inspector narrative; 65–75ch max           |
| Task heading | Manrope        | 24px    | 600     | 30px        | Inspector, workflow, and section purpose                            |
| Page heading | Manrope        | 32px    | 600     | 38px        | One per route; letter spacing no tighter than `-0.025em`            |

- Sentence case is standard. Uppercase is reserved for machine codes where the code itself is uppercase.
- Headings use balanced wrapping; prose uses pretty wrapping where supported.
- Tabular numbers use stable numeric alignment.
- Muted text must retain at least 4.5:1 contrast; placeholder text follows the same threshold.

## Color

Use the existing OKLCH tokens and their sRGB fallbacks. Neutral chroma may be reduced centrally during implementation if visual verification shows a blue cast; it may not be increased.

| Role                     | Token / baseline                                 | Usage                                                                   |
| ------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------- |
| Canvas                   | `--lb-canvas`, `oklch(0.115 0.018 260)`          | Application background                                                  |
| Inset                    | `--lb-canvas-inset`, `oklch(0.145 0.024 260)`    | Sidebar, top bar, recessed regions                                      |
| Work surface             | `--lb-panel`, `oklch(0.180 0.032 258)`           | Tables, inspectors, forms, queue regions                                |
| Raised temporary surface | `--lb-panel-raised`, `oklch(0.225 0.045 257)`    | Menus, sheets, selected/pressed controls; not permanent card decoration |
| Primary text             | `--lb-text-primary`, `oklch(0.965 0.012 255)`    | Headings, values, active labels                                         |
| Secondary text           | `--lb-text-secondary`, `oklch(0.760 0.030 255)`  | Explanations and metadata after contrast verification                   |
| Cobalt action            | `--lb-accent-electric`, `oklch(0.670 0.210 255)` | One current primary action, active progress, selected control           |
| Cobalt signal/focus      | `--lb-accent-cyan`, `oklch(0.820 0.135 220)`     | Focus ring, verified selection, rare link emphasis                      |
| Success                  | `--lb-success`, `oklch(0.750 0.170 150)`         | Completed/verified with icon and label                                  |
| Warning                  | `--lb-warning`, `oklch(0.820 0.160 82)`          | Degraded/approaching limit with icon and label                          |
| Critical                 | `--lb-critical`, `oklch(0.700 0.200 25)`         | Active critical risk with icon and label                                |
| Destructive              | `--lb-destructive`, `oklch(0.580 0.220 25)`      | Destructive action boundary only                                        |

Accent is reserved for current focus, verified selection, the single primary action in a region, and active progress. If the screen reads blue at a glance, the contract fails.

Semantic state always combines label, icon, and the established solid/dashed/dotted/double pattern vocabulary. Color alone never carries meaning.

## Radius, border, and elevation

- Controls: 6px radius.
- Panels/inspectors: 10px radius only when a boundary is required.
- Large interrupting stage/dialog: 14px maximum.
- Pills: status or compact filters only.
- Permanent surfaces use tonal separation or a one-pixel divider. Do not pair a one-pixel border with a decorative shadow wider than 8px blur.
- Wide shadow is permitted only for modal, drawer, command center, tooltip, or inspector overlay that temporarily occludes another layer.

## Component and interaction contracts

### Sidebar and mobile drawer

- Domain groups are semantic navigation lists with group labels, current-page state, counts only when actionable, and no hidden hover-only destinations.
- Compact mode retains accessible names and visible tooltips on pointer/focus.
- Mobile menu control announces expanded state; drawer traps focus, closes on Escape, and restores focus to its trigger.

### Universal search and command center

- Search results are grouped by permitted domain and show result type, safe identifier, primary label, and why it matched.
- Commands are separate from records and never execute critical actions directly. They navigate to a prefilled review route.
- Empty search explains accepted queries; denied or nonexistent records use indistinguishable safe copy.

### Tables and lists

- Column headers support keyboard sorting and announce direction.
- Checkboxes select rows without making the whole row a hidden checkbox.
- Row activation opens detail; secondary actions live in a labelled menu.
- Pagination/cursor and result count remain visible. Infinite scroll is forbidden for administrative ledgers.
- Mobile list rows expose the same status, risk, owner, deadline, and primary reference needed to choose a record.

### Inspector and full detail

- Inspector opens without page flash or full reload and may be deep-linked.
- Stale detail marks itself and disables affected mutations until refreshed or conflict-reviewed.
- Sensitive values stay masked; reveal states purpose, time limit, and audit consequence.

### Notifications and jobs

- Toasts confirm immediate local outcomes only and never replace durable work status.
- Inbox items persist, have severity, owner, deadline, related record, and acknowledgement state.
- Job center shows queued/running/paused/completed/partial/failed/cancelled, numeric progress when truthful, item counts, failure subset, and receipt.

## Invitation management composition

### Invitation list

- Official views: Active, Queue, Delivery problems, Expiring soon, Accepted, Declined, Revoked, and All history.
- Columns/row facts: safe recipient label, masked email by default where scope requires, campaign, locale, lifecycle state, expiry, delivery, reminders, owner, and last event.
- Capacity appears as an operational statement such as **18 of 25 active**, paired with queued count and forecast; it is not a hero metric.

### Create invitation

- Entry chooses Individual or Batch/CSV without splitting into separate products.
- Preflight stage shows valid, duplicate, already-active, invalid, and ineligible rows before issue.
- Review states exactly how many become active and how many enter the queue.
- Success provides issued, queued, skipped, and failed counts plus a durable job/receipt link.

### Invitation inspector/detail

- Header: lifecycle state, recipient, expiry/accepted time, campaign, and owner.
- Timeline: created, queued, issued, delivery, reminders, re-sends, acceptance/decline, expiry/revocation, and protected suspicious attempts.
- Actions: re-send with secret rotation, revoke, copy safe support reference, and open resulting account only after acceptance.
- Re-send review explicitly chooses keep or restart the 14-day window and requires reason when restarting.
- Revocation never claims to suspend an already-created account.

## Team and permission composition

- Team list shows identity, administrative functions, active delegation, scopes, MFA/passkey readiness, last active, recertification, and access state.
- Permission editor begins with function and bounded scope templates; explicit capabilities are visible as a diff, not a wall of unconstrained switches.
- Impact review states gains, losses, conflicts, affected data, sessions to revoke, approvals, and effective time.
- Read-only role simulation carries a persistent **Simulation — no actions can run** banner and a clear exit.
- Access reviews use one record at a time plus a queue summary; approve, narrow, suspend, or request clarification remain distinct actions.

## Incidents, recovery, and degraded states

- Incident workspace uses severity, current impact, owner/substitute, acknowledged state, timeline, affected capabilities, containment actions, and next update time.
- Recovery actions are selected procedures, never free-form command boxes. Each exposes version, allowed scope, rehearsal status, impact, approvals, progress, validation, and compensation path.
- A capability-specific degraded banner appears near the affected workspace, not as a global modal unless all safe operation is impossible.
- Read-only degraded mode uses explicit freshness timestamps and removes or disables mutations with a reason and recovery path.

## State matrix

| State                        | Required presentation and action                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| First use                    | Explain the domain and offer the safest real next step; no fabricated sample records in production      |
| Empty                        | State what is empty, whether filters caused it, and the one valid creation/reset action                 |
| Loading                      | Preserve shell and geometry with bounded skeleton regions; never hide all content behind a blank screen |
| Live/reconnecting            | Show last synchronization and connection state without blocking safe reading                            |
| Stale                        | Mark affected projection, disable authority-dependent mutations, preserve drafts, offer refresh         |
| Offline                      | Preserve safe cached reading only where allowed; never queue critical mutations silently                |
| Partial failure              | Identify affected capability, keep unaffected work available, provide correlation and retry path        |
| Unauthorized                 | Do not reveal record existence; show function/scope recovery where safe                                 |
| Reauthentication required    | Preserve the reviewed action and return to it after success                                             |
| Approval pending             | Show approver eligibility, request age/expiry, and safe cancellation                                    |
| Conflict                     | Compare remote/current values, preserve local draft, require deliberate reconciliation                  |
| Success                      | Update authoritative projection in place, show durable receipt, and restore logical focus               |
| Partial batch success        | Separate completed and failed subsets; allow retry only for eligible failures                           |
| Rate limited                 | State safe retry time and support/security route without exposing detection rules                       |
| Break-glass                  | Show purpose, scope, expiry, alerts, and enhanced audit continuously                                    |
| Forced-colors/reduced motion | Preserve semantics, focus, and operation with platform colors and instant/crossfade transitions         |

## Motion

- Hover: 100ms linear tonal/border response.
- Controls: 160ms using `cubic-bezier(0.2, 0, 0, 1)`.
- Inspector/drawer: 200ms using `cubic-bezier(0.16, 1, 0.3, 1)`, maximum 8px translation plus opacity/occlusion.
- Route continuity: up to 220ms; never gate initial visibility on animation.
- Job progress animates only between real values; indeterminate animation stops under reduced motion.
- Reduced motion uses 100ms crossfade or instant state change, zero translation, zero glow, and no stagger.
- Layout width/height is not animated for tables, filters, sidebars, or inspectors when transform/opacity/clip can communicate the change.

## Accessibility contract

- WCAG 2.2 AA is the minimum; primary text targets 7:1 where practical.
- Complete keyboard operation covers sidebar, command center, data grid/list, inspector, sheets, dialogs, filters, pagination, bulk selection, timelines, and function switching.
- Focus order follows visual/task order and never enters hidden inspector/drawer content.
- All overlays restore focus to the invoking control or selected record.
- Status never relies on color; icons have accessible names only when they add information.
- Live updates announce concise changes through scoped polite regions and never reread the whole table.
- Tables have captions or programmatic labels, correct row/column semantics, sort state, selected count, and an equivalent mobile list.
- Error summaries link to invalid fields; destructive confirmations state object, consequence, and reversibility.
- PT-BR and English are tested at 200% text, long names/emails, long translated labels, and locale-formatted dates, amounts, and time zones.
- Touch targets are at least 44×44px; adjacent destructive and primary actions require separation.

## Copywriting contract

Voice is precise, calm, and explicit about authority, uncertainty, consequence, and recovery. Never use miracle language, fake urgency, ambiguous **Confirm**, or unexplained provider codes.

| Element                   | PT-BR contract example                                                                                   | English contract example                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Primary queue action      | `Revisar convite`                                                                                        | `Review invitation`                                                                                         |
| Create action             | `Criar convites`                                                                                         | `Create invitations`                                                                                        |
| Empty active invitations  | `Nenhum convite ativo` — `Crie um convite ou consulte a fila preparada.`                                 | `No active invitations` — `Create an invitation or review the prepared queue.`                              |
| Filtered empty            | `Nenhum resultado para estes filtros` — `Limpar filtros`                                                 | `No results for these filters` — `Clear filters`                                                            |
| Stale state               | `Dados atualizados há {tempo}. Atualize antes de executar esta ação.`                                    | `Data last updated {time} ago. Refresh before running this action.`                                         |
| Partial failure           | `{concluídos} concluídos; {falhas} precisam de revisão.`                                                 | `{complete} completed; {failed} need review.`                                                               |
| Destructive invite action | `Revogar convite` — `Este link deixará de funcionar imediatamente. A conta já criada não será suspensa.` | `Revoke invitation` — `This link will stop working immediately. An existing account will not be suspended.` |
| Break-glass               | `Acesso emergencial por {duração}` — `O uso alertará Segurança e receberá auditoria reforçada.`          | `Emergency access for {duration}` — `Security will be alerted and enhanced audit will apply.`               |
| Safe denial               | `Este registro não está disponível para a função ativa.`                                                 | `This record is not available to the active function.`                                                      |
| Job cancellation          | `Cancelar trabalho` — state which completed effects remain and which pending items stop                  | `Cancel job` — state which completed effects remain and which pending items stop                            |

Primary buttons use verb + object. Generic **OK**, **Submit**, **Yes**, **Continue**, and **Confirm** are forbidden when a precise action name exists.

## Registry safety

| Registry                       | Blocks used   | Safety gate                                                                                                                       |
| ------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| shadcn official                | None          | Project explicitly rejects shadcn/template dashboard composition                                                                  |
| Third-party registries         | None          | Any later proposal requires source review, accessibility verification, dependency review, and visual re-authoring before adoption |
| Existing React Aria primitives | Behavior only | Preserve bespoke tokens/composition; verify keyboard, focus, screen reader, and overlay behavior                                  |

No copied dashboard template, prebuilt admin theme, or remote registry block may determine information architecture or appearance.

## Verification and visual acceptance

- Storybook/state fixtures cover every item in the state matrix for desktop, tablet, and mobile.
- Playwright screenshot baselines cover at least 1600×1000, 1280×800, 1024×768, 768×1024, 390×844, 320×568, 200% text zoom, reduced motion, and forced colors.
- Automated axe checks are supplemented by keyboard-only, focus restoration, screen-reader, zoom, contrast, long-content, and touch-target review.
- Visual review must confirm the selected hybrid direction: Calm Briefing hierarchy, Mission Control structure, and Operational Ledger compact mode.
- Visual review fails if cobalt exceeds its signal role, if cards become the primary page grammar, if mobile shows compressed tables, if loading causes blank/full-page flashing, or if unauthorized content appears before admission.
- No route is complete while it contains fixture labels, hard-coded administrator/plan badges, dead controls, placeholder copy, fake final metrics, or a text-only pseudo-menu.

## Checker sign-off

- [x] Dimension 1 Copywriting: PASS — precise verb/object actions, bilingual examples, safe denial, destructive consequences, and recovery paths are explicit.
- [x] Dimension 2 Visuals: PASS — owner-approved hybrid direction, complete responsive compositions, state matrix, and anti-template constraints are locked.
- [x] Dimension 3 Color: PASS — accent use is bounded and baseline sRGB contrast measures 18.42:1 primary/canvas, 9.48:1 secondary/canvas, 6.29:1 tertiary/canvas, 16.98:1 primary/panel, 8.74:1 secondary/panel, and 6.47:1 canvas/accent.
- [x] Dimension 4 Typography: PASS — existing font assets, roles, sizes, weights, line heights, measure, numeric alignment, and localization behavior are specified.
- [x] Dimension 5 Spacing: PASS — 4px-derived scale, structural exceptions, density modes, touch targets, breakpoints, and zoom behavior are explicit.
- [x] Dimension 6 Registry Safety: PASS — shadcn/templates and third-party blocks are excluded; React Aria is constrained to behavior behind the bespoke system.

**Approval:** approved 2026-08-06 (inline checker; no subagents requested)
