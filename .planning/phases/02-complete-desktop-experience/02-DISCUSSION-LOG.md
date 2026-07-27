# Phase 2: Complete Desktop Experience - Discussion Log

> **Audit trail only.** Do not use this as input for planning, research, or execution agents. Decisions are captured in `02-CONTEXT.md`; this log preserves the alternatives considered.

**Date:** 2026-07-27  
**Phase:** 02-complete-desktop-experience  
**Areas discussed:** Calibration gates, deterministic scenario narratives, previews of future capabilities, first-launch defaults

---

## Calibration gates

### Required calibration before Home

| Option                | Description                                               | Selected |
| --------------------- | --------------------------------------------------------- | :------: |
| Minimum core          | Require trust/privacy and basic inventory; defer the rest |    ✓     |
| Complete calibration  | Require all seven steps                                   |          |
| Immediate exploration | Open the full interface immediately                       |          |

**User's choice:** Minimum core.

### Dependency on a deferred step

| Option                     | Description                                                         | Selected |
| -------------------------- | ------------------------------------------------------------------- | :------: |
| Contextual gate            | Explain missing evidence, open the exact step, and return afterward |    ✓     |
| Return to full calibration | Require every remaining step                                        |          |
| Only disable               | Explain the block without redirecting                               |          |

**User's choice:** Contextual gate.

### Reopening incomplete calibration

| Option           | Description                                            | Selected |
| ---------------- | ------------------------------------------------------ | :------: |
| Contextual Home  | Open Home with calibration as the dominant next action |    ✓     |
| Automatic resume | Open the last incomplete step                          |          |
| Opening choice   | Ask whether to resume or enter Home                    |          |

**User's choice:** Contextual Home.

### Home evolution

| Option                      | Description                                    | Selected |
| --------------------------- | ---------------------------------------------- | :------: |
| Progressive personalization | Improve regions as valid evidence arrives      |    ✓     |
| Change only when complete   | Keep Home limited until all seven steps finish |          |
| Controlled preview          | Show simulated recommendations separately      |          |

**User's choice:** Progressive personalization.

### Mandatory inventory failure

| Option              | Description                                                     | Selected |
| ------------------- | --------------------------------------------------------------- | :------: |
| Safe limited mode   | Open without recommendations and provide exact reason and retry |    ✓     |
| Stay in calibration | Do not release Home                                             |          |
| Demonstration mode  | Offer fixture scenarios while real evidence is absent           |          |

**User's choice:** Safe limited mode.

### Optional consent presentation

| Option              | Description                                                     | Selected |
| ------------------- | --------------------------------------------------------------- | :------: |
| Separate by purpose | Independent telemetry, cloud AI, and diagnostic-sharing consent |    ✓     |
| Simplified choice   | One switch for all connected features                           |          |
| Ask at use          | Defer each consent until its feature is invoked                 |          |

**User's choice:** Separate by purpose and disabled by default.

### Evidence aging or hardware change

| Option               | Description                                            | Selected |
| -------------------- | ------------------------------------------------------ | :------: |
| Partial revalidation | Preserve valid evidence and reopen affected steps only |    ✓     |
| Full recalibration   | Restart all seven steps                                |          |
| Warning only         | Keep complete state and offer manual refresh           |          |

**User's choice:** Partial revalidation.

### Optional-step reminders

| Option                | Description                                           | Selected |
| --------------------- | ----------------------------------------------------- | :------: |
| Only when relevant    | Keep progress discreet until a decision depends on it |    ✓     |
| Every launch          | Show a persistent prompt                              |          |
| No automatic reminder | Show pending work only inside calibration             |          |

**User's choice:** Only when relevant.

---

## Deterministic scenario narratives

### Golden-journey PC

| Option                   | Description                                                      | Selected |
| ------------------------ | ---------------------------------------------------------------- | :------: |
| Mid-range competitive PC | Windows 11, Intel + NVIDIA, competitive game, safe opportunities |    ✓     |
| Enthusiast machine       | High-end hardware with subtle stability and latency work         |          |
| Older supported PC       | More limitations and compatibility emphasis                      |          |

**User's choice:** Mid-range competitive PC.

### Game identity

| Option               | Description                                                                | Selected |
| -------------------- | -------------------------------------------------------------------------- | :------: |
| Hybrid model         | Fictional golden-journey game; real games and launchers in discovery cases |    ✓     |
| Real games only      | Use recognizable titles throughout                                         |          |
| Fictional games only | Avoid all external brands                                                  |          |

**User's choice:** Hybrid model.

### Golden recommendation story

| Option               | Description                                                        | Selected |
| -------------------- | ------------------------------------------------------------------ | :------: |
| Balanced contrast    | One Verified, one Advanced, one excluded for insufficient evidence |    ✓     |
| Fully ready          | Every recommendation is compatible                                 |          |
| Incomplete diagnosis | Make fail-closed evidence the central story                        |          |

**User's choice:** Balanced contrast ending in a no-change receipt.

### Relationship among S01-S24

| Option              | Description                                                         | Selected |
| ------------------- | ------------------------------------------------------------------- | :------: |
| Coherent families   | Reuse a small set of PCs, games, and profiles; mutate one condition |    ✓     |
| Independent cases   | Give every scenario unrelated identities and history                |          |
| One continuous user | Tell one chronological story across all scenarios                   |          |

**User's choice:** Coherent families.

---

## Previews of future capabilities

### Preview depth

| Option                     | Description                                                                  | Selected |
| -------------------------- | ---------------------------------------------------------------------------- | :------: |
| Complete critical journeys | Full review, confirmation, failure, recovery, and receipt for critical flows |    ✓     |
| Every control end-to-end   | Fully simulate every future action                                           |          |
| Representative flows only  | One complete journey per domain                                              |          |

**User's choice:** Complete critical journeys.

### External services

| Option                                  | Description                                                            | Selected |
| --------------------------------------- | ---------------------------------------------------------------------- | :------: |
| Functional shell with explicit boundary | Local navigation and validation work; external effects stop truthfully |    ✓     |
| Fully simulated success                 | Complete login, purchase, upload, and cloud responses                  |          |
| Read-only                               | Display surfaces without starting actions                              |          |

**User's choice:** Functional shell with explicit boundary.

### Privileged preview ending

| Option                    | Description                                                       | Selected |
| ------------------------- | ----------------------------------------------------------------- | :------: |
| Auditable preview receipt | State no change, list intended request, and add scenario Activity |    ✓     |
| Return to review          | End before confirmation without a persistent receipt              |          |
| Temporary simulated state | Pretend the operation is active until scenario reset              |          |

**User's choice:** Auditable preview receipt.

### Secondary controls

| Option                            | Description                                                             | Selected |
| --------------------------------- | ----------------------------------------------------------------------- | :------: |
| Actionable contextual explanation | Name the missing capability, future phase, docs, and available scenario |    ✓     |
| Disabled with tooltip             | Explain only through focus or pointer hover                             |          |
| Concept route                     | Open a detailed but non-startable capability screen                     |          |

**User's choice:** Actionable contextual explanation.

---

## First-launch defaults

### Initial language

| Option         | Description                                                              | Selected |
| -------------- | ------------------------------------------------------------------------ | :------: |
| Detect Windows | PT-BR for Brazilian Portuguese; English otherwise; switch before consent |    ✓     |
| Always PT-BR   | Use the product's authoring locale                                       |          |
| Always ask     | Show language selection before the app                                   |          |

**User's choice:** Detect Windows.

### Initial density

| Option      | Description                                                    | Selected |
| ----------- | -------------------------------------------------------------- | :------: |
| Comfortable | Prioritize explanations and evidence; Compact remains optional |    ✓     |
| Compact     | Prioritize visible data volume                                 |          |
| Adaptive    | Select from available window size                              |          |

**User's choice:** Comfortable.

### Close and tray behavior

| Option             | Description                                   | Selected |
| ------------------ | --------------------------------------------- | :------: |
| Close by default   | Tray behavior requires explicit opt-in        |    ✓     |
| Tray by default    | Enable background detection after explanation |          |
| Ask on first close | Defer the choice until the first close action |          |

**User's choice:** Close by default.

### Clean development/test start

| Option                  | Description                                                    | Selected |
| ----------------------- | -------------------------------------------------------------- | :------: |
| S01 first calibration   | Start the golden onboarding; remember later scenario selection |    ✓     |
| S02 ready experience    | Start directly on calibrated Home                              |          |
| Scenario selector first | Require a scenario choice before opening the app               |          |

**User's choice:** S01 first calibration.

---

## The agent's Discretion

- Exact fictional game and profile names.
- Exact hardware model values and evidence-source labels within the selected golden narrative.
- Distribution of S02-S24 among coherent scenario families.
- Which non-critical secondary controls receive full journeys after critical coverage is complete.

## Deferred Ideas

None — the discussion stayed within the Phase 2 boundary.
