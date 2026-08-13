# Phase 6 Multi-Source Coverage Audit

All required source items are planned. Deferred items are excluded explicitly: executable Extremo, the broad Phase 7 optimizer catalog, Phase 8 game automation, and unresolved Phase 4 public-distribution evidence.

| SOURCE | ID | Feature / constraint | Plan(s) | Status |
|---|---|---|---|---|
| GOAL | — | Personalized approval/execution with proportional risk, exact journal, verification, recovery | 05–22 | COVERED |
| REQ | PLAN-01 | Personalized plan from goals, capability, evidence | 01, 05, 10, 19, 22 | COVERED |
| REQ | PLAN-02 | Add/remove/inspect operations | 01, 05, 11, 19, 22 | COVERED |
| REQ | PLAN-03 | Complete operation metadata | 01, 05, 15, 17, 19, 22 | COVERED |
| REQ | PLAN-04 | Risk ceiling with per-operation control | 01, 06, 19, 22 | COVERED |
| REQ | PLAN-05 | Proportional confirmation/auth/recovery/verification | 01, 06, 12–14, 16–19, 22 | COVERED |
| REQ | PLAN-06 | Prior-state journal and verified apply/rollback | 01–04, 08, 09, 13–15, 18, 21, 22 | COVERED |
| REQ | PLAN-07 | Individual/plan/checkpoint recovery after failure/reboot | 01, 07–11, 14–19, 21, 22 | COVERED |
| REQ | PLAN-08 | Safe partial failure, scoped rollback, explanation, diagnostic | 01–03, 07, 08, 10, 11, 14, 17–22 | COVERED |
| RESEARCH | R-01 | Pure contract-conformant authority before Windows effects | 01–14 | COVERED |
| RESEARCH | R-02 | Durable prepare -> effect -> observe without open DB transaction | 08, 09, 14, 18 | COVERED |
| RESEARCH | R-03 | IPC identity/user context/replay resistance/no generic authority | 01, 04, 13, 15, 18, 22 | COVERED |
| RESEARCH | R-04 | Dedicated WAL + synchronous FULL append-only SQLite | 09 | COVERED |
| RESEARCH | R-05 | Fresh action-scoped strong-auth proof | 06, 12, 18, 19 | COVERED |
| RESEARCH | R-06 | One PowrProf operation plus complementary System Restore | 15, 16, 22 | COVERED |
| RESEARCH | R-07 | Ordered native progress plus snapshot-on-reconnect | 11, 14, 18–20 | COVERED |
| RESEARCH | R-08 | Fault matrix and exact-version four-stage promotion | 10, 14, 20–22 | COVERED |
| RESEARCH | R-09 | `[ASSUMED]` windows-service legitimacy gate | 04, 13 | COVERED |
| CONTEXT | D-01 | Sequential simulation -> clean VM -> owner -> friends | 10, 20–22 | COVERED |
| CONTEXT | D-02 | Full prepare/apply/verify/restart/restore/verify each stage | 10, 14, 20–22 | COVERED |
| CONTEXT | D-03 | Separate `Liiiraa Verificado` and exact prior identity | 15, 18, 22 | COVERED |
| CONTEXT | D-04 | State persists; recovery never subscription-blocked | 03, 06, 11, 14, 18, 19 | COVERED |
| CONTEXT | D-05 | Drift pauses with exact diff and safe choices | 01, 08, 14, 15, 19, 20 | COVERED |
| CONTEXT | D-06 | Failure blocks version; correction restarts at simulation | 10, 21, 22 | COVERED |
| CONTEXT | D-07 | Local redacted previewable friend diagnostic; no auto send | 10, 18–22 | COVERED |
| CONTEXT | D-08 | Signed revocation blocks apply, preserves recovery, no remote rollback | 01, 10, 13, 19, 21 | COVERED |
| CONTEXT | D-09 | Risk progression; Extreme visible but blocked | 01, 06, 17, 19 | COVERED |
| CONTEXT | D-10 | Global policy is ceiling only | 03, 05, 06, 19 | COVERED |
| CONTEXT | D-11 | Proportional confirmation/auth/recovery/phrase | 01, 06, 12, 16, 19 | COVERED |
| CONTEXT | D-12 | Immutable technical risk; bad evidence restricts | 03, 05, 06, 19 | COVERED |
| CONTEXT | D-13 | Device-local Advanced preference and revalidation | 06, 12, 18, 19 | COVERED |
| CONTEXT | D-14 | Experimental consent per version and apply | 01, 06, 12, 19 | COVERED |
| CONTEXT | D-15 | Mixed maximum risk and dependency/risk groups | 03, 05–07, 19 | COVERED |
| CONTEXT | D-16 | Changed evidence/compatibility/risk invalidates approval | 01, 05, 06, 12, 19 | COVERED |
| CONTEXT | D-17 | Partial failure restores affected group only | 03, 07, 14, 18–20 | COVERED |
| CONTEXT | D-18 | Protected restart checkpoint and boot-first verification | 01, 09, 14, 18–20, 22 | COVERED |
| CONTEXT | D-19 | Crash/power-loss observes journal; no blind repeat | 01, 08, 09, 14, 18, 20, 22 | COVERED |
| CONTEXT | D-20 | Failed restore/unknown prior blocks and guides recovery | 01, 03, 07–09, 14, 16, 18–20 | COVERED |
| CONTEXT | D-21 | Safe-boundary cancel; timeout is unknown | 01, 08, 14, 18–20 | COVERED |
| CONTEXT | D-22 | Serialized mutation; independent reads may parallelize | 03, 07, 13, 14, 18 | COVERED |
| CONTEXT | D-23 | Reads retry boundedly; mutation retry observes/new transaction | 03, 07, 08, 13, 14, 18 | COVERED |
| CONTEXT | D-24 | Close-to-tray continuity and next-boot recovery | 03, 11, 14, 18–20 | COVERED |
| CONTEXT | D-25 | One Recovery Center and three restore target types | 01, 03, 11, 17–20 | COVERED |
| CONTEXT | D-26 | Exact Liiiraa manifest is primary recovery authority | 01, 03, 08, 09, 14–16, 18 | COVERED |
| CONTEXT | D-27 | Windows Restore is complementary and truthful | 06, 16, 19, 22 | COVERED |
| CONTEXT | D-28 | Three-state conflict and explicit choice | 01, 08, 14, 15, 17, 19, 20 | COVERED |
| CONTEXT | D-29 | Apply/restore are new immutable transactions | 01, 03, 08, 09, 14, 18, 19 | COVERED |
| CONTEXT | D-30 | Immutable verified exact-state receipt | 01, 03, 08, 09, 14, 15, 17–20 | COVERED |
| CONTEXT | D-31 | Non-elevated UI; narrow broker; no generic/script/remote | 01–03, 11, 13, 15, 18, 20 | COVERED |
| CONTEXT | D-32 | Migrated append-only SQLite; no plaintext secrets | 01–03, 09, 12–14, 18 | COVERED |
| CONTEXT | D-33 | Phase 5 evidence required; unknown/degraded blocks | 01, 03, 05, 06, 19 | COVERED |
| CONTEXT | D-34 | No Docker; deterministic + Hyper-V/real Windows | 02, 10, 20–22 | COVERED |
| CONTEXT | D-35 | No universal hardware claim; physical gaps visible | 10, 21, 22 | COVERED |

## Deferred exclusions

- Executable Extremo remains absent; only its explanation and blocked state are planned.
- The broad Windows/CPU/GPU/network/audio optimizer catalog remains Phase 7.
- Game discovery/session automation remains Phase 8.
- Unfinished Phase 4 public-distribution evidence remains an explicit release gate, not Phase 6 implementation scope.
