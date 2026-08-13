# Phase 6 Multi-Source Coverage Audit

All required source items are planned. Security and physical-promotion gates are completion-blocking: missing audit anchor/key custody, privileged IPC/strong-auth failure, or an unavailable/failed mandatory physical stage leaves Phase 6 incomplete. Plan 06-22's UI authority is also fail-closed: downstream UI execution requires a frozen canonical substantive review input rederived from the live UI-SPEC on every check, exact subject path/SHA-256 agreement in both independent checker report and schema-valid approval record, verified report bytes/semantics, a distinct human acknowledgement strictly after checker completion, and exact agreement with UI-SPEC approval metadata/sign-offs. Deferred items are excluded explicitly: executable Extremo, the broad Phase 7 optimizer catalog, Phase 8 game automation, and unresolved Phase 4 public-distribution evidence.

| SOURCE | ID | Feature / constraint | Plan(s) | Status |
|---|---|---|---|---|
| GOAL | — | Personalized approval/execution with proportional risk, exact journal, verification, recovery | 05–28 | COVERED |
| REQ | PLAN-01 | Personalized plan from goals, capability, evidence | 01, 05, 10, 19, 20, 26–28 | COVERED |
| REQ | PLAN-02 | Add/remove/inspect operations | 01, 05, 11, 19, 20, 26–28 | COVERED |
| REQ | PLAN-03 | Complete operation metadata | 01, 05, 15, 17, 19, 20, 26–28 | COVERED |
| REQ | PLAN-04 | Risk ceiling with per-operation control and device-local Advanced preference | 01, 06, 19, 22–25, 26–28 | COVERED |
| REQ | PLAN-05 | Proportional confirmation/auth/recovery/verification | 01, 06, 12–14, 16–25, 26–28 | COVERED |
| REQ | PLAN-06 | Prior-state journal and verified apply/rollback | 01–04, 08, 09, 13–15, 18, 21, 23, 24, 26–28 | COVERED |
| REQ | PLAN-07 | Individual/plan/checkpoint recovery after failure/reboot | 01, 07–11, 14–22, 26–28 | COVERED |
| REQ | PLAN-08 | Safe partial failure, scoped rollback, explanation, diagnostic | 01–03, 07, 08, 10, 11, 14, 17–22, 26–28 | COVERED |
| RESEARCH | R-01 | Pure contract-conformant authority before Windows effects | 01–14 | COVERED |
| RESEARCH | R-02 | Durable prepare -> effect -> observe without open DB transaction | 08, 09, 14, 18 | COVERED |
| RESEARCH | R-03 | IPC identity/user context/replay resistance/no generic authority, with broker-owned restart-durable dedup | 01, 04, 13, 15, 18, 26–28 | COVERED |
| RESEARCH | R-04 | Dedicated WAL + synchronous FULL append-only SQLite with HMAC chain, Windows Credential Manager key custody, external head anchor, rotation, and read-only recovery on anchor loss | 09 | COVERED |
| RESEARCH | R-05 | Fresh action-scoped strong-auth proof for apply and D-13 enable/revoke | 06, 12, 18, 19, 23–25 | COVERED |
| RESEARCH | R-06 | One PowrProf operation plus complementary System Restore | 15, 16, 26–28 | COVERED |
| RESEARCH | R-07 | Ordered native progress plus snapshot-on-reconnect | 11, 14, 18–20 | COVERED |
| RESEARCH | R-08 | Fault matrix and exact-version four-stage promotion | 10, 14, 20, 21, 26–28 | COVERED |
| RESEARCH | R-09 | `[ASSUMED]` windows-service legitimacy gate | 04, 13 | COVERED |
| CONTEXT | D-01 | Sequential simulation -> clean VM -> owner -> friends; every stage is required for phase completion | 10, 20, 21, 26–28 | COVERED |
| CONTEXT | D-02 | Full prepare/apply/verify/restart/restore/verify each stage | 10, 14, 20, 21, 26–28 | COVERED |
| CONTEXT | D-03 | Separate `Liiiraa Verificado` and exact prior identity | 15, 18, 26–28 | COVERED |
| CONTEXT | D-04 | State persists; recovery never subscription-blocked | 03, 06, 11, 14, 18, 19 | COVERED |
| CONTEXT | D-05 | Drift pauses with exact diff and safe choices | 01, 08, 14, 15, 19, 20 | COVERED |
| CONTEXT | D-06 | Failure blocks version; correction restarts at simulation | 10, 21, 26–28 | COVERED |
| CONTEXT | D-07 | Local redacted previewable friend diagnostic; no auto send | 10, 18–21, 28 | COVERED |
| CONTEXT | D-08 | Signed revocation blocks apply, preserves recovery, no remote rollback | 01, 10, 13, 19, 21 | COVERED |
| CONTEXT | D-09 | Risk progression; Extreme visible but blocked | 01, 06, 17, 19 | COVERED |
| CONTEXT | D-10 | Global policy is ceiling only | 03, 05, 06, 19 | COVERED |
| CONTEXT | D-11 | Proportional confirmation/auth/recovery/phrase | 01, 06, 12, 16, 19 | COVERED |
| CONTEXT | D-12 | Immutable technical risk; bad evidence restricts | 03, 05, 06, 19 | COVERED |
| CONTEXT | D-13 | Append-audited device-local Advanced preference; strong-auth enable/revoke; restart persistence; posture invalidation; closed native/client commands; accessible UI | 01, 06, 12, 23–25 | COVERED |
| CONTEXT | D-14 | Experimental consent per version and apply | 01, 06, 12, 19 | COVERED |
| CONTEXT | D-15 | Mixed maximum risk and dependency/risk groups | 03, 05–07, 19 | COVERED |
| CONTEXT | D-16 | Changed evidence/compatibility/risk invalidates approval | 01, 05, 06, 12, 19 | COVERED |
| CONTEXT | D-17 | Partial failure restores affected group only | 03, 07, 14, 18–20 | COVERED |
| CONTEXT | D-18 | Protected restart checkpoint and boot-first verification | 01, 09, 14, 18–20, 26–28 | COVERED |
| CONTEXT | D-19 | Crash/power-loss observes journal; no blind repeat | 01, 08, 09, 13, 14, 18, 20, 26–28 | COVERED |
| CONTEXT | D-20 | Failed restore/unknown prior blocks and guides recovery | 01, 03, 07–09, 14, 16, 18–20 | COVERED |
| CONTEXT | D-21 | Safe-boundary cancel; timeout is unknown | 01, 08, 14, 18–20 | COVERED |
| CONTEXT | D-22 | Serialized mutation; independent reads may parallelize | 03, 07, 13, 14, 18 | COVERED |
| CONTEXT | D-23 | Reads retry boundedly; mutation retry observes/new transaction | 03, 07, 08, 13, 14, 18 | COVERED |
| CONTEXT | D-24 | Close-to-tray continuity and next-boot recovery | 03, 11, 14, 18–20 | COVERED |
| CONTEXT | D-25 | One Recovery Center and three restore target types | 01, 03, 11, 17–20 | COVERED |
| CONTEXT | D-26 | Exact Liiiraa manifest is primary recovery authority | 01, 03, 08, 09, 14–16, 18 | COVERED |
| CONTEXT | D-27 | Windows Restore is complementary and truthful | 06, 16, 19, 26–28 | COVERED |
| CONTEXT | D-28 | Three-state conflict and explicit choice | 01, 08, 14, 15, 17, 19, 20 | COVERED |
| CONTEXT | D-29 | Apply/restore are new immutable transactions | 01, 03, 08, 09, 14, 18, 19 | COVERED |
| CONTEXT | D-30 | Immutable verified exact-state receipt | 01, 03, 08, 09, 14, 15, 17–20 | COVERED |
| CONTEXT | D-31 | Non-elevated UI; narrow broker; no generic/script/remote | 01–03, 11, 13, 15, 18, 20 | COVERED |
| CONTEXT | D-32 | Migrated append-only SQLite; no plaintext secrets | 01–03, 09, 12–14, 18 | COVERED |
| CONTEXT | D-33 | Phase 5 evidence required; unknown/degraded blocks | 01, 03, 05, 06, 19 | COVERED |
| CONTEXT | D-34 | No Docker; deterministic + Hyper-V/real Windows | 02, 10, 20, 21, 26–28 | COVERED |
| CONTEXT | D-35 | No universal hardware claim; physical gaps visible | 10, 21, 26–28 | COVERED |

## Deferred exclusions

- Executable Extremo remains absent; only its explanation and blocked state are planned.
- The broad Windows/CPU/GPU/network/audio optimizer catalog remains Phase 7.
- Game discovery/session automation remains Phase 8.
- Unfinished Phase 4 public-distribution evidence remains an explicit release gate, not Phase 6 implementation scope.

# Execution-blocker remediation addendum — 2026-08-13

The prior 28-plan source audit remains unchanged for completed plan coverage. Plans 06-29 through 06-34 close the newly observed physical execution reachability gap without adding product scope or weakening 06-26 through 06-28.

| SOURCE | ID | Feature / Constraint | Plan | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Users can execute and safely reverse the admitted physical operation | 06-29, 06-30, 06-31, 06-33, 06-34, 06-26 | COVERED | Dispatcher, service host, exact installable artifact, guest runner, Hyper-V bridge, then physical review. |
| REQ | PLAN-01 | Exact version/build promotion evidence | 06-32, 06-33, 06-34, 06-26 | COVERED | Physical source and predecessor bindings cannot be relabeled. |
| REQ | PLAN-02 | Approved operation selection remains exact | 06-33, 06-26 | COVERED | Runner invokes the installed approved plan, not a generic effect. |
| REQ | PLAN-03 | Prior/requested/observed/restored operation details | 06-33, 06-26 | COVERED | GUID/state lifecycle and reviewer-visible evidence remain required. |
| REQ | PLAN-04 | Risk policy remains enforced during execution | 06-33, 06-26 | COVERED | Exact existing native admission and physical checkpoint are prerequisites. |
| REQ | PLAN-05 | Authentication, recovery preparation, and verification | 06-29, 06-30, 06-32, 06-33, 06-34, 06-26 | COVERED | Exact local identity and post-effect observation fail closed. |
| REQ | PLAN-06 | Journal prior state before effect and verify outcome | 06-29 through 06-34, 06-26 | COVERED | Real service/runner path preserves prepare-before-dispatch and observed verdict. |
| REQ | PLAN-07 | Exact restore after reboot/failure | 06-29 through 06-34, 06-26 | COVERED | Artifact lifecycle preserves recovery; runner resumes observation-first and restores exact GUID. |
| REQ | PLAN-08 | Safe partial failure and auditable diagnostics | 06-29, 06-30, 06-32, 06-33, 06-34, 06-26 | COVERED | No blind retry; bounded physical evidence retains faults and blockers. |
| CONTEXT | D-01, D-02, D-06 | Sequential exact-version four-stage promotion and full cycle | 06-32, 06-33, 06-34, 06-26–06-28 | COVERED | The 26→27→28 order is unchanged; correction still restarts at simulation. |
| CONTEXT | D-03–D-05 | Dedicated reversible power scheme, persistence, and drift | 06-29, 06-33, 06-26 | COVERED | Existing PowrProf operation is connected with exact GUID/state preconditions. |
| CONTEXT | D-07, D-35 | Redacted honest physical evidence and visible gaps | 06-32, 06-34, 06-26–06-28 | COVERED | Simulation/callback fixtures cannot claim physical provenance. |
| CONTEXT | D-08, D-31 | No remote rollback, generic RPC, scripts, PowerShell, or generic primitives | 06-29, 06-30, 06-31, 06-33, 06-34 | COVERED | Every request, installer action, process launch, and guest action is closed and exact. |
| CONTEXT | D-17–D-24 | Failure, reboot, cancellation, serialization, and resume safety | 06-29, 06-30, 06-33 | COVERED | Durable unknown-before-dispatch and observation-first reboot continuation remain mandatory. |
| CONTEXT | D-26–D-30, D-32 | Immutable recovery authority, receipts, and SQLite custody | 06-31, 06-32, 06-33 | COVERED | Install/update/uninstall preserve journal/evidence; writer never overwrites runs/reviews. |
| CONTEXT | D-34 | No Docker; Hyper-V/Windows physical path | 06-34, 06-26 | COVERED | Exact audited VM/checkpoint path only. |
| RESEARCH | — | Privileged IPC identity/replay and PowrProf user context | 06-29, 06-30, 06-33 | COVERED | Real authenticated service path replaces the disconnected shell. |
| RESEARCH | — | Install exact build and retain attributable evidence | 06-31, 06-32, 06-34 | COVERED | MSI plus input/file hashes and closed guest evidence chain. |

Deferred Extreme execution, the Phase 7 operation catalog, and Phase 8 game automation remain excluded exactly as recorded in 06-CONTEXT.md.
