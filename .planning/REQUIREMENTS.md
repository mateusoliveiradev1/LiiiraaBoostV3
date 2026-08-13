# Requirements: Liiiraa Boost

**Defined:** 2026-07-26  
**Core Value:** Produce measurable performance gains adapted to the exact hardware without sacrificing system stability, while keeping every change explainable, auditable, and reversible.

## v1 Requirements

### Product Foundation

- [x] **FOUND-01**: The product uses one versioned contract source to generate TypeScript and Rust transport models and runtime validators
- [x] **FOUND-02**: The desktop simulator and future real adapters pass the same contract conformance suite
- [x] **FOUND-03**: Every displayed diagnostic or performance value identifies whether it is fixture, observed, measured, modeled, or unavailable
- [x] **FOUND-04**: Production mode cannot expose deterministic fixture data as if it came from the user's PC
- [x] **FOUND-05**: Automated architecture checks reject forbidden cross-module imports and circular dependencies
- [x] **FOUND-06**: Security, privacy, accessibility, performance, and recovery criteria are part of each affected feature's acceptance tests

### Desktop Experience

- [x] **UX-01**: User can install and open the non-elevated Windows desktop app through a signed Tauri package
- [x] **UX-02**: User completes a guided first-run calibration covering inventory, diagnosis, restore readiness, goals, and priority games
- [x] **UX-03**: User sees a contextual home prioritizing the next recommended action, selected game profile, and current system state
- [x] **UX-04**: User can navigate primary areas by goal and drill into technical details by hardware or Windows component
- [x] **UX-05**: User can search modules, games, settings, history, documentation, and safe actions from a global command center
- [x] **UX-06**: User can pin games, metrics, and actions without breaking the curated information hierarchy
- [x] **UX-07**: User sees complete loading, empty, offline, permission, unsupported, partial-failure, restart-pending, recovery, and expired-entitlement states
- [x] **UX-08**: User can review current activity and prior notifications through a priority-based activity center
- [x] **UX-09**: User receives discreet normal feedback and Windows-level notifications only for actionable or critical events
- [x] **UX-10**: User can operate the complete desktop experience with keyboard and assistive technology at WCAG 2.2 AA
- [x] **UX-11**: User can use the desktop experience in PT-BR or English without clipped or untranslated product-critical content
- [x] **UX-12**: User can enable reduced motion, scale the interface, and understand every status without relying on color alone

### Web Platform

- [x] **WEB-01**: Visitor can understand the product, its evidence policy, supported capabilities, plans, and limitations on the public site
- [x] **WEB-02**: Visitor can read versioned technical documentation linked from relevant desktop features
- [x] **WEB-03**: User can inspect release channel, version, integrity, and compatibility and complete a fail-closed download-eligibility journey; Phase 3 exposes no installer until a publicly trusted artifact is approved, and any future approved record must pass every trust and integrity check before download is enabled
- [x] **WEB-04**: User can manage profile, security methods, subscription, invoices, active device, and support requests
- [x] **WEB-05**: User can revoke the active PC and bind a replacement subject to the 30-day reset cooldown
- [x] **WEB-06**: Authorized staff can use an isolated administrative application with role-specific access
- [x] **WEB-07**: Administrative access to user-provided diagnostics requires explicit, time-limited consent and creates an immutable audit event
- [x] **WEB-08**: Public, account, and administrative surfaces have separate deployment and security policies

### Identity, Subscription, and Devices

- [x] **IDEN-01**: User can authenticate through verified email, supported social providers, or passkeys
- [x] **IDEN-02**: User can enable MFA and recover an account through a security-reviewed flow
- [x] **IDEN-03**: Administrative users must use MFA and stronger authentication for critical actions
- [x] **IDEN-04**: Premium subscription permits exactly one active PC at a time
- [x] **IDEN-05**: Device identity uses a privacy-preserving derived identifier rather than storing raw hardware serials
- [x] **IDEN-06**: Premium remains available for a cryptographically verifiable seven-day offline window
- [x] **IDEN-07**: Expired Premium blocks new paid actions without automatically reverting existing system changes
- [x] **IDEN-08**: Diagnostic history, security warnings, and restoration remain available after Premium expires
- [x] **IDEN-09**: Payment-provider events are idempotently reconciled so delayed or duplicated webhooks cannot corrupt entitlement state

### Diagnostics and Capability Detection

- [x] **DIAG-01**: User can inventory CPU, GPU, memory, storage, network, display, audio, USB, Windows build, drivers, security state, and installed games
- [x] **DIAG-02**: The system distinguishes Windows 11, Windows 10 LTSC/ESU, and unsupported Windows 10 consumer lifecycle states
- [x] **DIAG-03**: User sees lifecycle and compatibility warnings before receiving recommendations for an unsupported or unverified environment
- [x] **DIAG-04**: The engine derives recommendations from detected capabilities and evidence freshness rather than device-name recipes
- [x] **DIAG-05**: Unknown, stale, contradictory, or unavailable evidence fails closed and cannot silently become a compatible recommendation
- [x] **DIAG-06**: User can see why an operation is compatible, unsupported, hidden, or restricted to Experimental
- [x] **DIAG-07**: Read-only collection respects explicit resource budgets and reduces sampling during active games

### Plans, Execution, and Recovery

- [x] **PLAN-01**: User can generate a personalized optimization plan from current goals, hardware capabilities, and system evidence
- [x] **PLAN-02**: User can add, remove, and inspect individual operations before approving a plan
- [x] **PLAN-03**: Every operation shows purpose, expected impact, risk, evidence, compatibility, restart effect, previous value, and recovery method
- [x] **PLAN-04**: User chooses a global Verificado, Avançado, Experimental, or Extremo policy while retaining per-operation control
- [x] **PLAN-05**: High-risk operations require proportional confirmation, authentication, completed recovery preparation, and post-change verification
- [x] **PLAN-06**: The engine journals exact prior state before every side effect and verifies apply and rollback outcomes
- [x] **PLAN-07**: User can restore an individual operation, a complete plan, or a recovery checkpoint after failure or reboot
- [x] **PLAN-08**: Partial failure pauses safely, reverts only the necessary dependency set, explains the cause, and preserves an auditable diagnostic

### Games and Profiles

- [ ] **GAME-01**: User can discover games from Steam, Epic, Xbox/Microsoft Store, Riot, Battle.net, EA, Ubisoft, GOG, emulators, and manual executables
- [ ] **GAME-02**: The system maintains stable game identity across launcher updates and bootstrap executables
- [ ] **GAME-03**: User can compose a game profile from an official signed base, local hardware adaptation, and controlled personal customization
- [ ] **GAME-04**: Starting a game from Liiiraa Boost applies its approved profile before launch
- [ ] **GAME-05**: Starting a game from an external launcher activates the same approved profile automatically
- [ ] **GAME-06**: Ending a game triggers verified restoration of temporary operations and records the resulting session
- [ ] **GAME-07**: Game integration never injects code, modifies game files, or interferes with anti-cheat software

### Measurement and Evidence

- [x] **MEAS-01**: User can capture a system baseline with methodology, timestamp, environment identity, and collector overhead
- [x] **MEAS-02**: User can capture supported game-session FPS, 1% lows, frame time, utilization, thermals, and latency-related evidence when reliable
- [x] **MEAS-03**: The system rejects before/after comparisons when workload, environment, sample quality, or collector health are not comparable
- [x] **MEAS-04**: User sees uncertainty, missing coverage, degraded capture, and unsupported-game states instead of fabricated estimates
- [x] **MEAS-05**: User can compare sessions through a summary, detailed diff, timeline, and exportable technical report
- [x] **MEAS-06**: Marketing or in-product performance claims can reference only quality-approved reproducible evidence

### Optimization Domains

- [ ] **OPTM-01**: User can receive capability-gated recommendations for Windows services, tasks, startup, telemetry, and background behavior
- [ ] **OPTM-02**: User can receive capability-gated recommendations for CPU scheduling, power, GPU, memory, storage, and thermal behavior
- [ ] **OPTM-03**: User can receive capability-gated recommendations for network, DNS, adapters, audio, USB, input devices, displays, VRR, and HDR
- [ ] **OPTM-04**: User can receive capability-gated recommendations for launchers, DirectX/Vulkan-related settings, shader caches, and per-game configuration
- [ ] **OPTM-05**: Stable operations are promoted only after hardware-matrix, fault-injection, recovery, and measurable-benefit gates pass
- [ ] **OPTM-06**: Any future supported Defender-related operation reports requested and actually observed states, never bypasses Tamper Protection, and never promises permanent removal

### AI and Support

- [ ] **AIST-01**: User can ask the AI assistant questions from a dedicated workspace, a global panel, or contextual entry points
- [ ] **AIST-02**: AI receives locally filtered context and sends data to cloud processing only after explicit consent
- [ ] **AIST-03**: AI can return explanations and typed plan proposals but cannot create operations or invoke the privileged service
- [ ] **AIST-04**: AI proposals pass the same capability, risk, approval, and policy validation as manually composed plans
- [ ] **AIST-05**: AI history is encrypted locally by default and can be optionally synchronized or completely deleted
- [ ] **AIST-06**: User can preview, redact, encrypt, consent to, and expire a diagnostic support package before upload

### Release and Operations

- [ ] **RELS-01**: User receives only signed Stable, Beta, or Experimental application updates from the selected channel
- [ ] **RELS-02**: Application updates and optimization-profile updates use separate signing identities and revocation paths
- [ ] **RELS-03**: Downloaded profiles are signed declarative data referencing only operations compiled into the installed engine
- [ ] **RELS-04**: Releases include SBOM, provenance, signature verification, staged rollout, health monitoring, and rollback
- [ ] **RELS-05**: The background Windows service remains within the agreed idle CPU and memory budgets on the supported hardware matrix
- [ ] **RELS-06**: Server and web operations emit privacy-bounded OpenTelemetry logs, metrics, and traces without collecting local PC diagnostics by default
- [ ] **RELS-07**: Production deployment requires passing specification, type, unit, property, contract, migration, security, accessibility, visual, recovery, and E2E gates

## v2 Requirements

### Extreme and Community Capabilities

- **XTRM-01**: User can access stable Extreme operations only after dedicated threat, legal, recovery, and compatibility gates pass
- **COMM-01**: User can share declarative profile intent without distributing executable code
- **FWRM-01**: User can browse a maintained vendor- and generation-specific firmware guidance catalog
- **AICL-01**: User can use broader cloud AI analysis only after privacy, cost, evaluation, and safety gates pass

## Out of Scope

| Feature                                                       | Reason                                                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Arbitrary remote or community scripts                         | Would turn the profile system into a remote-code-execution channel                              |
| DLL injection or anti-cheat hooks                             | Creates ban, security, and compatibility risks                                                  |
| Automatic BIOS, firmware, voltage, or overclock mutation      | Cannot provide reliable universal recovery through a Windows application                        |
| Kernel driver in the initial product                          | Expands signing, attack surface, crash, and maintenance risk before user-mode limits are proven |
| Universal “safe tweak” bundle                                 | Hardware, Windows build, drivers, thermals, and workload change the effect of each operation    |
| Guaranteed FPS percentages or “zero latency”                  | Such claims cannot be universal or honestly proven                                              |
| Synthetic health score based on arbitrary issue counts        | Encourages fake urgency rather than actionable evidence                                         |
| Public release of the visual milestone as a working optimizer | Scenario adapters must never be represented as real machine measurements or mutations           |
| Automatic rollback when a subscription expires                | Billing state must not destabilize or interrupt the user's PC                                   |
| Unsupported Defender removal or Tamper Protection bypass      | Conflicts with the product's security, integrity, recovery, and truthful-state requirements     |

## Definition of Done

A v1 requirement is complete only when:

1. Its behavior and edge states are specified.
2. Cross-boundary contracts and runtime validation are versioned.
3. Required unit, property, contract, accessibility, visual, security, recovery, migration, and E2E tests pass.
4. The implementation stays within defined performance and privacy budgets.
5. User-facing copy accurately distinguishes observed, measured, modeled, fixture, and unavailable information.
6. Relevant threat-model controls and audit evidence are updated.
7. The work is committed and independently verified against its acceptance criteria.

## Traceability

| Requirement | Phase    | Status   |
| ----------- | -------- | -------- |
| FOUND-01    | Phase 1  | Complete |
| FOUND-02    | Phase 1  | Complete |
| FOUND-03    | Phase 1  | Complete |
| FOUND-04    | Phase 1  | Complete |
| FOUND-05    | Phase 1  | Complete |
| FOUND-06    | Phase 1  | Complete |
| UX-01       | Phase 2  | Complete |
| UX-02       | Phase 2  | Complete |
| UX-03       | Phase 2  | Complete |
| UX-04       | Phase 2  | Complete |
| UX-05       | Phase 2  | Complete |
| UX-06       | Phase 2  | Complete |
| UX-07       | Phase 2  | Complete |
| UX-08       | Phase 2  | Complete |
| UX-09       | Phase 2  | Complete |
| UX-10       | Phase 2  | Complete |
| UX-11       | Phase 2  | Complete |
| UX-12       | Phase 2  | Complete |
| WEB-01      | Phase 3  | Complete |
| WEB-02      | Phase 3  | Complete |
| WEB-03      | Phase 3  | Complete |
| WEB-04      | Phase 4  | Complete |
| WEB-05      | Phase 4  | Complete |
| WEB-06      | Phase 4  | Complete |
| WEB-07      | Phase 4  | Complete |
| WEB-08      | Phase 3  | Complete |
| IDEN-01     | Phase 4  | Complete |
| IDEN-02     | Phase 4  | Complete |
| IDEN-03     | Phase 4  | Complete |
| IDEN-04     | Phase 4  | Complete |
| IDEN-05     | Phase 4  | Complete |
| IDEN-06     | Phase 4  | Complete |
| IDEN-07     | Phase 4  | Complete |
| IDEN-08     | Phase 4  | Complete |
| IDEN-09     | Phase 4  | Complete |
| DIAG-01     | Phase 5  | Complete |
| DIAG-02     | Phase 5  | Complete |
| DIAG-03     | Phase 5  | Complete |
| DIAG-04     | Phase 5  | Complete |
| DIAG-05     | Phase 5  | Complete |
| DIAG-06     | Phase 5  | Complete |
| DIAG-07     | Phase 5  | Complete |
| PLAN-01     | Phase 6  | Complete |
| PLAN-02     | Phase 6  | Complete |
| PLAN-03     | Phase 6  | Complete |
| PLAN-04     | Phase 6  | Complete |
| PLAN-05     | Phase 6  | Complete |
| PLAN-06     | Phase 6  | Complete |
| PLAN-07     | Phase 6  | Complete |
| PLAN-08     | Phase 6  | Complete |
| GAME-01     | Phase 8  | Pending  |
| GAME-02     | Phase 8  | Pending  |
| GAME-03     | Phase 8  | Pending  |
| GAME-04     | Phase 8  | Pending  |
| GAME-05     | Phase 8  | Pending  |
| GAME-06     | Phase 8  | Pending  |
| GAME-07     | Phase 8  | Pending  |
| MEAS-01     | Phase 5  | Complete |
| MEAS-02     | Phase 5  | Complete |
| MEAS-03     | Phase 5  | Complete |
| MEAS-04     | Phase 5  | Complete |
| MEAS-05     | Phase 5  | Complete |
| MEAS-06     | Phase 5  | Complete |
| OPTM-01     | Phase 7  | Pending  |
| OPTM-02     | Phase 7  | Pending  |
| OPTM-03     | Phase 7  | Pending  |
| OPTM-04     | Phase 7  | Pending  |
| OPTM-05     | Phase 7  | Pending  |
| OPTM-06     | Phase 7  | Pending  |
| AIST-01     | Phase 9  | Pending  |
| AIST-02     | Phase 9  | Pending  |
| AIST-03     | Phase 9  | Pending  |
| AIST-04     | Phase 9  | Pending  |
| AIST-05     | Phase 9  | Pending  |
| AIST-06     | Phase 9  | Pending  |
| RELS-01     | Phase 10 | Pending  |
| RELS-02     | Phase 10 | Pending  |
| RELS-03     | Phase 10 | Pending  |
| RELS-04     | Phase 10 | Pending  |
| RELS-05     | Phase 10 | Pending  |
| RELS-06     | Phase 10 | Pending  |
| RELS-07     | Phase 10 | Pending  |

**Coverage:**

- v1 requirements: 82 total
- Mapped to phases: 82
- Unmapped: 0

---

_Requirements defined: 2026-07-26_  
_Last updated: 2026-07-26 after roadmap traceability mapping_
