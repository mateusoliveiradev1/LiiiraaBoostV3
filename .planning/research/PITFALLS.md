# Pitfalls Research

**Domain:** Security-sensitive Windows 10/11 gaming optimizer, subscription control plane, and AI-assisted support  
**Project:** Liiiraa Boost  
**Researched:** 2026-07-26  
**Overall confidence:** MEDIUM  

Official Microsoft, IETF, PostgreSQL, Tauri, W3C, OWASP, AWS, SLSA, and regulatory sources support the platform and security findings below. Confidence remains MEDIUM overall because real performance effects, OEM behavior, anti-cheat policy, and undocumented Windows changes can only be established for a specific build, driver, game, and hardware combination.

## Roadmap Phase Labels Used Here

These are research labels for roadmap construction, not a final roadmap:

| Label | Phase topic |
|---|---|
| P0 | Product claims, threat model, contracts, evidence model, and quality gates |
| P1 | Complete desktop UX, design system, simulator, accessibility, and E2E |
| P2 | Public web, account, documentation, and isolated administration UX |
| P3 | Identity, licensing, billing, device binding, and control-plane foundations |
| P4 | Read-only Windows inventory, compatibility catalog, and measurement research |
| P5 | Privileged service boundary, installer, IPC, code signing, and security spike |
| P6 | Durable transaction journal, snapshot, verification, rollback, and recovery |
| P7 | Verified optimization operation families and hardware lab promotion |
| P8 | Game detection, session automation, external measurement, and anti-cheat validation |
| P9 | Signed profile supply chain, update channels, revocation, and staged rollout |
| P10 | Advisory AI, privacy-preserving diagnostics, and support workflows |
| P11 | Production infrastructure, observability, incident response, and regional scaling |

## Critical Pitfalls

### Pitfall 1: Performance Theatre and Unsubstantiated Gain Claims

**Confidence:** HIGH for the need to substantiate claims; MEDIUM for any individual gaming-performance method.

**What goes wrong:**  
The product reports “FPS gained,” “latency removed,” “problems fixed,” or an overall optimization score that was inferred from changed settings rather than measured. A polished before/after screen makes synthetic or noisy numbers look authoritative. Users cannot reproduce the result, reviewers classify the product as a placebo cleaner, and performance advertising becomes legally and reputationally risky.

**Why it happens:**  
Configuration changes are easy to count while controlled performance measurement is expensive. FPS varies with scene, shader compilation, server state, thermal state, power source, background tasks, driver caches, and normal run-to-run noise. Teams are tempted to convert “a tweak was applied” into “performance improved.”

**Consequences:**  
The core value proposition becomes unverifiable; regressions can be celebrated as gains; optimization profiles are promoted on bad evidence; refund and consumer-protection exposure increases.

**Prevention:**

- Define a claim taxonomy before UI work: **observed fact**, **configuration change**, **modeled expectation**, **measured outcome**, **inconclusive**, and **unsupported**.
- Never convert freed RAM, disabled services, registry changes, or a vendor recommendation directly into FPS or latency claims.
- Store measurement provenance: tool and version, sampling interval, game/build/map/scenario, resolution/settings, driver, power/thermal state, warm-up, sample count, invalid samples, uncertainty, and optimizer overhead.
- Compare paired, repeatable runs and show distributions/frametime percentiles rather than one favorable average.
- Require a minimum practical effect and repeatability gate before an optimization can be advertised as a gain.
- Keep fixture metrics in an explicit development/demo data source; production builds must never present fixture results as observations from the user's PC.

**Warning signs:**

- A percentage appears without a measurement-run identifier.
- Every plan claims improvement and the UI has no “no measurable change” or “regression” state.
- Marketing totals settings changed as “issues fixed.”
- A single run is compared against a different scene, patch, driver, or thermal state.
- The metric improves when sampling is disabled or the app is closed.

**Detection:**

- Contract tests require provenance for every measured claim and reject measured language for predicted values.
- Golden test cases include improvement, no change, regression, missing data, interrupted run, and high-variance outcomes.
- Independent benchmark replay compares UI conclusions with stored raw samples.
- Release review audits a sample of marketing and in-product claims back to reproducible evidence.

**Phase to address:** P0 defines claim semantics; P1 makes provenance and uncertainty first-class UI states; P4 validates measurement methods; P8 establishes game-specific protocols; P9 blocks profile promotion without evidence.

---

### Pitfall 2: Shipping Placebo or Unsafe “Universal Tweaks”

**Confidence:** HIGH that Windows behavior is version- and capability-dependent; MEDIUM for the net effect of any specific tweak.

**What goes wrong:**  
The optimizer applies internet folklore—global timer forcing, HPET/BCD changes, blanket service disabling, page-file removal, TCP “gaming” values, core-parking changes, cache cleaners, priority escalation, or security-feature disabling—to every PC. Some changes do nothing on current Windows; others increase power use, stutter, crashes, network instability, or data-loss risk.

**Why it happens:**  
Old guides are copied without checking current API behavior. For example, `timeBeginPeriod` stopped acting as a global system-wide request for unaffected processes beginning with Windows 10 version 2004, and Windows 11 may not honor the higher resolution for an occluded process. A tweak can also appear effective because the test warmed caches or changed thermal conditions.

**Consequences:**  
Placebo value, support burden, degraded 1% lows, battery drain, broken sleep/updates/peripherals, and loss of trust.

**Prevention:**

- Treat each operation as a versioned experiment with mechanism, prerequisites, contraindications, exact scope, expected direction, evidence grade, expiry/revalidation date, and rollback definition.
- Use capability detection plus build/edition/driver/OEM allowlists; absence of evidence means Experimental or unavailable, never Stable.
- Ban arbitrary BCD, boot-timer, page-file, service, network, and scheduler recipes from the stable catalog until physical-lab evidence and vendor documentation support them.
- Apply one independently reversible operation family at a time so attribution remains possible.
- Preserve Windows/OEM defaults as a supported path but restore the user's exact prior state, not a presumed default.

**Warning signs:**

- The same plan is generated for unrelated hardware.
- Operations are named after registry paths rather than a tested user outcome.
- Evidence is a forum post, old video, or another optimizer.
- The catalog lacks build ranges and contraindications.
- “More aggressive” is treated as synonymous with “faster.”

**Detection:**

- Static catalog lint rejects stable operations without compatibility predicates, evidence, snapshot, verify, and revert implementations.
- Hardware-matrix tests compare operation versus control and flag statistically noisy or negative families.
- Production effectiveness monitoring is opt-in, aggregate, and able to demote or revoke profiles.

**Phase to address:** P0 operation evidence schema; P4 capability inventory; P6 reversible protocol; P7 one-family-at-a-time validation; P9 profile promotion and revocation.

---

### Pitfall 3: Promising That Microsoft Defender Can Be Disabled “Permanently”

**Confidence:** HIGH.

**What goes wrong:**  
The UI says Defender was permanently disabled when Tamper Protection, managed policy, platform updates, passive mode rules, or Windows servicing ignored or later reverted the requested setting. Worse, the app weakens protection without proving the resulting state or preserving an obvious route back.

**Why it happens:**  
Registry and PowerShell calls may return without demonstrating the effective security state. Microsoft explicitly documents that Tamper Protection can make changes appear successful while blocking them, and that protected Group Policy changes can be ignored. Defender platform behavior is controlled by supported Windows security mechanisms, not by the optimizer's promise.

**Consequences:**  
False status, unexpected reactivation, exposed users, enterprise-policy conflict, damaged trust, and a high-value abuse path if the app or profile pipeline is compromised.

**Prevention:**

- Never use “permanent” in the contract or UI; use precise effective-state language such as “requested,” “active until changed by Windows or policy,” “blocked by Tamper Protection,” or “managed externally.”
- Detect Tamper Protection and device-management state before presenting the action. Do not attempt bypasses.
- Treat security reductions as Extreme, separately approved operations with reauthentication, exact snapshot, explicit consequences, timeout option, persistent warning, post-change verification, and independent restore path.
- Refuse silent or remotely triggered security changes. Cloud profiles and AI may never authorize them.
- Keep Defender/firewall/update restoration available without Premium and after subscription expiry.
- Re-check the effective state after restart and Windows/security-platform updates.

**Warning signs:**

- The implementation validates a process exit code rather than Defender's effective state.
- A registry key is the sole source of truth.
- The UI shows “disabled forever.”
- Security operations are bundled with unrelated FPS tweaks.
- A license failure prevents re-enabling protection.

**Detection:**

- Clean-VM tests cover Tamper Protection on/off, managed/unmanaged devices, restart, offline state, platform update, and denied policy.
- The operation verifier compares requested, observed, and externally managed states.
- Security-state drift produces a clear local alert and audit event without attempting an unauthorized bypass.

**Phase to address:** P0 security policy and language; P1 risk/managed-state UX; P5 privileged authorization boundary; P6 snapshot/recovery; P7 security-operation research; P9 remote-profile prohibition and revocation.

---

### Pitfall 4: Treating a Restore Point as Rollback

**Confidence:** HIGH.

**What goes wrong:**  
The product claims reversibility because it attempted to create a Windows restore point. Restore may be disabled, unavailable, throttled, incomplete for the changed resource, or too coarse. A crash, power loss, disk-full event, restart, or partial plan failure leaves a mixture of old and new state with no reliable continuation.

**Why it happens:**  
System Restore is easy to invoke in a demo; correct compensating transactions across registry values, service configuration, scheduled tasks, files, power settings, device properties, and restart boundaries are much harder.

**Consequences:**  
Unbootable or degraded systems, destroyed user customization, support emergencies, and inability to prove the safety promise.

**Prevention:**

- Implement a durable per-operation journal before real mutations: exact before-state, provenance, plan/version, expected after-state, idempotency key, dependency edges, timestamps, verification result, and compensation status.
- Write and flush the journal before mutation. Treat disk-full, corruption, cancellation, service crash, process kill, power loss, and reboot as normal test cases.
- Restore captured state, including “value absent,” ownership/ACLs where applicable, and user/OEM custom values; never write guessed defaults.
- Define non-reversible operations as unsupported until an independently tested recovery procedure exists.
- Use restore points only as an additional coarse safety layer, never the primary rollback mechanism.
- Provide a recovery path that does not depend on the full React UI or active subscription.

**Warning signs:**

- “Undo” is one function at the end of a plan.
- Snapshot data lives only in memory or in a UI store.
- The journal records the desired default, not the observed prior state.
- Cancellation during step N is undefined.
- Uninstall deletes recovery data while modifications remain.

**Detection:**

- Fault-injection tests interrupt before/after every durable write and operation boundary.
- Property tests verify apply twice is safe and apply→revert returns to the captured state.
- Recovery tests run after reboot, service upgrade, disk pressure, corrupted entries, and missing external resources.
- A reconciliation command reports incomplete, diverged, externally changed, and safely restored states.

**Phase to address:** P0 transaction invariants; P1 recovery states; P5 recovery executable/permissions; P6 full journal and fault injection; every P7 operation must pass snapshot/apply/verify/revert before promotion.

---

### Pitfall 5: Elevating the UI or Exposing a Generic Privileged Bridge

**Confidence:** HIGH.

**What goes wrong:**  
The Tauri/WebView process runs as administrator, or IPC exposes helpers such as `runCommand`, `runPowerShell`, `writeRegistry`, or unrestricted file/service mutation. XSS, a compromised frontend dependency, malicious local process, or stolen admin session becomes privileged code execution.

**Why it happens:**  
It greatly accelerates the first prototype and makes every future feature look easy.

**Consequences:**  
Machine-wide compromise, credential theft, security-product tampering, persistence, and an architecture that cannot be repaired without rewriting the desktop boundary.

**Prevention:**

- Keep React and the Tauri application host unprivileged.
- Isolate a minimal Windows service with the least-capable service identity and narrowly scoped ACLs.
- Expose typed use cases compiled into the service, not command interpreters or generic registry/file primitives.
- Authenticate IPC caller, user/session, executable identity, protocol version, nonce/idempotency key, freshness, and approval token; protect against same-user rogue processes and replay.
- Authorize each operation again inside the service using local policy, current capabilities, risk approval, and operation allowlist.
- Treat Tauri capabilities/CSP as defense in depth, not as permission to trust frontend input.

**Warning signs:**

- The app manifest requests elevation for normal launch.
- IPC accepts command strings, paths outside a strict scope, arbitrary registry keys, or serialized shell fragments.
- Authorization is “request came from localhost.”
- UI and service share one broad secret or run under the same powerful account.
- A cloud/admin/AI payload maps directly to privileged parameters.

**Detection:**

- Architecture tests prohibit generic command APIs and direct privileged imports from UI modules.
- Adversarial IPC tests use malformed, replayed, downgraded, cross-session, low-integrity, and same-user calls.
- Installation tests inspect service and named-pipe ACLs.
- Threat-model review is a release gate for every new privileged operation type.

**Phase to address:** P0 trust-boundary contract; P1 simulator uses the same narrow ports; P5 dedicated security spike; P6 service-mediated transaction protocol; P7 no operation bypass.

---

### Pitfall 6: Introducing a Kernel Driver Before It Is Unavoidably Necessary

**Confidence:** HIGH for signing/security cost; MEDIUM for whether a future measurement feature might justify a driver.

**What goes wrong:**  
A custom driver is added to manipulate timers, input, scheduling, hardware, or telemetry. A defect or compromised update causes a blue screen or kernel compromise; HVCI compatibility fails; signing and release operations become substantially harder; anti-cheat products view the component as suspicious.

**Why it happens:**  
Kernel access is marketed as “deeper optimization” and can appear to differentiate the product even when supported user-mode APIs would suffice.

**Consequences:**  
System crashes, security advisories, EV/attestation signing burden, incompatible Secure Boot/HVCI configurations, anti-cheat conflicts, and an enormous solo-maintainer burden.

**Prevention:**

- Set a v1 architectural rule: no custom kernel driver.
- Require a written impossibility proof for supported user-mode/service APIs, a user benefit that cannot be achieved otherwise, a separate threat model, external security review, fuzzing, Driver Verifier/HLK testing, HVCI compatibility, and independent release approval before reconsideration.
- Never bundle third-party vulnerable drivers to obtain privileged hardware access.
- Prefer vendor-supported APIs and read-only ETW/performance sources.

**Warning signs:**

- A planned feature requires disabling Secure Boot, HVCI, or driver blocklists.
- The team proposes loading an old signed driver.
- Driver privileges exceed one narrowly defined capability.
- No crash dump, symbol, revocation, or emergency-update process exists.

**Detection:**

- Dependency and artifact scanning rejects `.sys` files and known vulnerable driver hashes by default.
- Installer tests verify no unexpected kernel component is registered.
- Any driver proposal requires an explicit roadmap decision, not an incidental implementation task.

**Phase to address:** P0 records the no-driver default; P4/P8 establish whether supported telemetry is sufficient; P5 validates user-mode service limits; a separate future phase is mandatory if evidence ever justifies a driver.

---

### Pitfall 7: Assuming Anti-Cheat Safety Is Universal

**Confidence:** MEDIUM.

**What goes wrong:**  
An overlay, hook, input path, process handle, priority change, telemetry collector, or bundled low-level component works in one game and is blocked or treated as suspicious in another. The product claims “ban safe” without vendor confirmation, or a profile keeps running after the game/anti-cheat changes.

**Why it happens:**  
Anti-cheat behavior and policies are vendor-, game-, mode-, and version-specific; much of the detection logic is intentionally undocumented. “External” does not automatically mean allowed.

**Consequences:**  
Game launch failures, false-positive detections, account sanctions, emergency disablement, and severe reputational damage.

**Prevention:**

- Preserve the stated conservative policy: no DLL injection, game-file modification, memory manipulation, automation of gameplay, or anti-cheat interference.
- Build a per-game/per-anti-cheat compatibility catalog with tested versions, allowed measurement path, known conflicts, and kill switch.
- Prefer OS-supported external observation; disable overlays by default and do not ship one until explicit compatibility evidence exists.
- Provide a safe mode that stops all nonessential game-session integration.
- Use cautious wording: “tested compatible with version X under conditions Y,” never “cannot cause a ban.”
- Establish vendor contact/approval where possible for any integration beyond passive process detection.

**Warning signs:**

- A single global “anti-cheat compatible” flag exists.
- Testing covers only game launch, not a full session, update, and shutdown.
- The app opens powerful process handles or injects/hook APIs.
- Community reports are the only compatibility evidence.
- There is no remote revocation path for a game profile.

**Detection:**

- Clean-machine tests cover each supported anti-cheat/game pair and launcher tree.
- Release monitoring treats launch errors, anti-cheat warnings, and user sanctions as critical signals.
- Signed profile rollback can disable the relevant integration without shipping an arbitrary script.

**Phase to address:** P0 anti-feature contract; P4 identify anti-cheat presence read-only; P8 dedicated compatibility research and full-session tests; P9 rapid revocation and staged rollout.

---

### Pitfall 8: Ignoring Windows, Driver, OEM, and Hardware Variability

**Confidence:** HIGH.

**What goes wrong:**  
Compatibility is keyed only by “Windows 10/11,” CPU vendor, or GPU vendor. The same operation behaves differently by Windows build/edition, security posture, processor generation, scheduler topology, laptop firmware, MUX/Optimus mode, chipset, driver branch, storage controller, power source, and OEM management software.

**Why it happens:**  
Marketing categories are much simpler than the capability matrix required by a safe optimizer.

**Consequences:**  
Stable operations become experimental in production, laptops lose sleep/battery behavior, hybrid GPUs launch on the wrong adapter, devices malfunction, and Windows updates silently invalidate profiles.

**Prevention:**

- Build a typed capability model from observed APIs and supported vendor signals; do not infer capability from marketing names alone.
- Store applicability as explicit positive predicates with supported build/driver ranges and contraindications. Unknown is not compatible.
- Include notebook/desktop, AC/battery, hybrid graphics, virtualization/security state, thermal headroom, OEM services, and managed-device state.
- Version the inventory schema and retain source/confidence for every detection.
- Revalidate affected capabilities after OS cumulative/feature updates, driver updates, BIOS changes, and hardware changes.
- Promote support in rings: simulator → VM → physical lab → opt-in beta → stable.

**Warning signs:**

- `if vendor == NVIDIA` is treated as sufficient compatibility.
- Stable profiles use negative matching such as “all devices except known failures.”
- A Windows update changes observed state with no catalog invalidation.
- The test matrix contains only one desktop per vendor.

**Detection:**

- Contract fixtures represent generations, unsupported values, managed PCs, notebooks, hybrid GPUs, and partial inventory.
- CI rejects stable operations without explicit tested capability tuples.
- Drift monitoring compares effective results after Windows/driver releases and automatically pauses promotion.

**Phase to address:** P0 capability schema; P1 unsupported/partial/managed UI states; P4 inventory and matrix; P7 physical validation; P9 compatibility-aware profile delivery.

---

### Pitfall 9: Trading Security, Thermals, or Stability for a Misleading Peak Number

**Confidence:** HIGH that the trade-offs exist; MEDIUM for profile-specific impact.

**What goes wrong:**  
Maximum-performance plans disable VBS/Memory Integrity, raise sustained power, prevent idle states, force high clocks, increase fan/noise, or suppress thermal protections. A short benchmark improves while long sessions throttle, battery health worsens, security is reduced, or frame pacing becomes less stable.

**Why it happens:**  
Peak FPS is easier to market than sustained frametime, energy, acoustic, security, and temperature trade-offs. Older processors can have a larger VBS/HVCI performance cost, but Microsoft also documents these features as meaningful kernel protections.

**Consequences:**  
Worse real sessions, overheating/noise, shortened battery life, instability, and users unknowingly accepting a security downgrade.

**Prevention:**

- Define multi-objective outcomes: sustained FPS/frametime, 1% lows, temperature, clocks, power, throttling, stability, security change, and battery mode.
- Never disable hardware safety limits. Treat OEM thermal controls and firmware as authoritative.
- Separate security choices from ordinary performance plans and display the protection lost, not only possible performance effect.
- Validate after thermal steady state and across a meaningful session duration.
- Provide distinct plugged-in notebook profiles and immediately restore temporary session changes.

**Warning signs:**

- Only the first benchmark minute is recorded.
- Temperatures, throttling flags, power source, and fan behavior are absent.
- The plan labels disabled security as a generic “background optimization.”
- Higher clocks are reported as success despite worse frametime.

**Detection:**

- Lab protocols include cold/warm runs, sustained load, AC/battery, sleep/resume, and post-session restoration.
- The results model can declare “faster but hotter,” “lower average but better frame pacing,” or “security cost exceeds measured gain.”
- Stability and thermal regressions block stable promotion.

**Phase to address:** P0 outcome/risk model; P1 honest trade-off UI; P4 telemetry feasibility; P7 sustained physical tests; P8 session-duration measurement.

---

### Pitfall 10: Windows Update Drift and Unsupported Windows 10

**Confidence:** HIGH.

**What goes wrong:**  
The product assumes Windows behavior remains stable and presents Windows 10 as uniformly supported. Microsoft ended support for Windows 10 Home and Pro on 2025-10-14; 22H2 was the final version. In 2026, ordinary consumer Windows 10 without ESU is outside normal security support, while LTSC editions have separate lifecycles. Windows 11 builds also have different servicing end dates and known issues.

**Why it happens:**  
“Windows 10/11” is treated as a permanent platform label rather than a set of build, edition, channel, and support-lifecycle states.

**Consequences:**  
The optimizer promises “extreme security” on an unsupported OS, operations drift after cumulative updates, and support/testing expands without a defensible boundary.

**Prevention:**

- Detect edition, build, servicing channel, support status, ESU/LTSC status where reliably observable, and relevant update level.
- Distinguish **detected**, **limited/legacy**, **supported**, and **verified**. Do not give unsupported consumer Windows 10 the same badge as a supported build.
- Keep recovery and safe diagnostics available, but gate risky stable operations on a supported/tested tuple.
- Subscribe the compatibility process to Windows release-health and lifecycle changes; re-run affected lab suites before profile promotion.
- Make profile expiry/revalidation automatic when OS/driver prerequisites change.

**Warning signs:**

- The compatibility table has one row called “Windows 10.”
- A build not present in the lab receives Stable operations.
- Update detection exists but does not invalidate evidence.
- The UI implies the OS is secure because the optimizer is installed.

**Detection:**

- CI fixtures cover EOL Home/Pro, ESU, LTSC, supported Windows 11 builds, Insider/unrecognized builds, and partial update state.
- Catalog queries fail closed for unknown or expired build ranges.
- Release operations regularly reconcile lifecycle metadata and test evidence.

**Phase to address:** P0 support policy; P1 lifecycle warning states; P4 exact inventory; P7 support matrix; P9 profile expiry; P11 lifecycle runbook.

---

### Pitfall 11: Trusting Signatures as Proof of Safety

**Confidence:** HIGH.

**What goes wrong:**  
A correctly signed application, updater bundle, or optimization profile is assumed safe. A compromised maintainer, CI job, signing key, admin account, or profile publisher signs malicious or incompatible content, and the desktop accepts it with privileged consequences.

**Why it happens:**  
Digital signatures prove origin/integrity under a key; they do not prove semantic safety, compatibility, authorization, freshness, or that the signing process was uncompromised.

**Consequences:**  
Supply-chain compromise becomes mass privileged compromise. An updater or profile channel becomes remote code execution at scale.

**Prevention:**

- Keep application/update and profile trust roots separate; use KMS/HSM-backed keys, short-lived CI identity, dual control for critical releases, rotation, revocation, and offline recovery procedures.
- Generate SBOM and provenance; pin expected workflow/repository identity when verifying keyless signatures.
- Require reproducible/controlled builds and protected GitHub environments via OIDC, with no long-lived AWS keys.
- Tauri updater signature verification remains mandatory, but also validate version monotonicity, channel, compatibility, hash, rollout authorization, and recovery.
- Profiles remain declarative, schema-limited, engine-versioned, locally capability-checked, risk-approved, and mapped only to compiled allowlisted operations.
- Never let the profile language grow file/registry/script primitives that recreate arbitrary execution.

**Warning signs:**

- One key signs all artifacts and profiles.
- Release administrators can publish and sign alone.
- “Signature valid” is the final policy decision.
- Rollback/revocation is slower than profile propagation.
- CI can print or export signing secrets.

**Detection:**

- Release tests tamper with bundle, signature, identity, channel, version, profile operation, and revocation state.
- Periodic key-compromise exercises prove emergency revocation and safe downgrade/forward-fix.
- Dependency and provenance verification are blocking gates; artifact inventory allows targeted recall.

**Phase to address:** P0 trust model; P5 installer/signing spike; P9 complete supply-chain and profile promotion system; P11 incident response and key rotation.

---

### Pitfall 12: Device Fingerprinting Becomes Fragile Surveillance

**Confidence:** HIGH for privacy status; MEDIUM for the best hardware-change tolerance algorithm.

**What goes wrong:**  
The “UUID” is built from raw serials/MAC addresses and stored centrally. It changes after BIOS, motherboard, storage, VM, or adapter changes; can collide or be spoofed; and creates a durable identifier tied to a person. Legitimate users are locked out by the 30-day reset cooldown while attackers still clone identifiers.

**Why it happens:**  
A stable hardware fingerprint is treated as both identity and anti-abuse security, although hardware attributes are noisy and identifiers are personal/pseudonymous data under privacy law.

**Consequences:**  
Privacy violations, support load, false fraud decisions, account sharing that still succeeds, and users unable to restore or safely use the product.

**Prevention:**

- Generate a local device key and opaque device ID; use hardware signals only as risk/tolerance inputs, not a secret or universal identity.
- Hashing raw serials alone is not anonymization. Minimize, purpose-limit, version, rotate, and document any signals sent to the cloud.
- Store raw hardware inventory locally unless the user explicitly consents to a defined upload.
- Make one-active-device a server-side transactional entitlement invariant; keep an audited MFA-protected reset path and support exception.
- Distinguish routine component change, probable machine replacement, and suspicious cloning through a documented policy with appeal.
- Never couple license binding to rollback, safety alerts, history export, or re-enabling security.

**Warning signs:**

- A raw BIOS/disk serial or MAC is the primary key.
- The fingerprint is called anonymous because it was hashed.
- Any one hardware replacement creates a new paid device.
- Reset decisions cannot be explained or audited.

**Detection:**

- Synthetic tests vary one component, multiple components, virtualization, reinstall, and cloned state.
- Privacy inventory traces each signal, purpose, retention, lawful basis/consent, recipient, and deletion path.
- Support metrics track false device-change detections and cooldown overrides.

**Phase to address:** P0 privacy/invariant design; P1 device-change/recovery UX; P3 device-key spike and schema; P10 support consent; P11 retention/deletion operations.

---

### Pitfall 13: Account, Billing, or Admin Compromise Grants Desktop Power

**Confidence:** HIGH.

**What goes wrong:**  
An account takeover, forged/replayed payment webhook, confused admin role, leaked support session, or compromised public web deployment changes entitlements, device binding, profiles, or releases. Public-site compromise reaches admin APIs because the surfaces share deployment, audience, cookies, or broad backend credentials.

**Why it happens:**  
Identity, billing, support, content, and release administration are collapsed into one convenient “admin” role and one session model. Payment events are trusted as ordered/exactly-once. Desktop OAuth is embedded in a WebView instead of using system-browser native-app protections.

**Consequences:**  
Fraud, account/device hijack, privacy breach, malicious profile release, and potentially fleet-wide machine compromise.

**Prevention:**

- Use system-browser OAuth with Authorization Code + PKCE and exact redirect/state/nonce checks for the desktop; no passwords inside the WebView.
- Make Better Auth pass explicit threat-model, passkey/MFA, session rotation/revocation, recovery, enumeration, CSRF, and desktop-flow gates before production.
- Isolate public/account and admin deployments, hostnames, API audiences, CSPs, identities, and credentials.
- Require phishing-resistant MFA/hardware keys for critical roles, JIT access, short sessions, step-up authentication, least privilege, dual approval for releases/security content, and immutable audit.
- Verify webhook signatures against raw bodies, deduplicate event IDs, tolerate retries/out-of-order events, and derive entitlements from a transactional ledger/reconciliation process.
- Cloud authorization may unlock a catalog capability but can never directly order a privileged local mutation.

**Warning signs:**

- An `isAdmin` boolean controls every privileged function.
- Support can browse diagnostics without user-granted, expiring access.
- A successful payment webhook directly overwrites one `plan` column.
- The desktop shares browser cookies or embeds provider login.
- A content administrator can publish signed operations.

**Detection:**

- Automated role-matrix and cross-audience token tests.
- Webhook replay, duplication, reordering, signature, and reconciliation tests.
- Admin attack simulations cover stolen session, insider misuse, approval bypass, and log tampering.
- Audit alerts detect unusual device resets, profile promotions, release activity, and support access.

**Phase to address:** P0 threat model; P2 separate admin UX/deployment; P3 identity/billing/entitlement implementation; P9 dual-controlled releases; P10 consent-bound support; P11 incident response.

---

### Pitfall 14: Database Convenience Undermines Product Invariants

**Confidence:** HIGH.

**What goes wrong:**  
“One active PC,” entitlement state, reset cooldown, audit immutability, profile promotion, or support consent is enforced only in TypeScript. Concurrent requests, webhook retries, worker races, or a migration create impossible states. Modules query one another's tables directly; preview databases drift from production. Row Level Security is assumed to protect data while the table owner or a `BYPASSRLS` role silently bypasses policies.

**Why it happens:**  
An ORM-generated schema and application checks feel typed, but types do not serialize concurrent decisions or validate persisted invariants.

**Consequences:**  
Multiple active devices, lost entitlements, cross-tenant data exposure, irreproducible billing bugs, migrations that break old clients/workers, and a modular monolith with invisible coupling.

**Prevention:**

- Encode local invariants in PostgreSQL constraints, foreign keys, partial unique indexes, exclusion constraints, and transactions; test concurrency explicitly.
- Use an entitlement ledger/state machine and transactional outbox/inbox; never assume queue/webhook exactly-once delivery.
- Give modules owned schemas/repositories and explicit APIs/events. Forbid cross-module table access in architecture tests.
- Use separate least-privilege runtime and migration roles. If RLS is used, understand owner/`BYPASSRLS` behavior and `FORCE ROW LEVEL SECURITY`; never rely on RLS alone.
- Use expand/migrate/contract migrations compatible with old API/worker versions; rehearse restore and rollback.
- Run the same migrations and PostgreSQL extensions/settings in local containers, Neon previews, staging, and AWS production; detect drift.

**Warning signs:**

- “Check then insert” enforces one-device without a database constraint/lock.
- A mutable user row is the billing ledger.
- Modules import another module's query builder/table definitions.
- Tests use SQLite or mocked repositories for PostgreSQL semantics.
- The application connects as database owner.

**Detection:**

- Race tests execute device reset, entitlement update, refund, and webhook delivery concurrently.
- Migration CI boots from empty and prior supported versions, checks locks, and runs old/new application compatibility.
- Schema ownership and forbidden-query checks are automated.
- Backup restore tests verify row counts independently of RLS-filtered application sessions.

**Phase to address:** P0 domain invariants; P3 PostgreSQL schema and concurrency tests; P9 profile/release state machine; P10 consent/retention schema; P11 backup, restore, and scale tests.

---

### Pitfall 15: AI Crosses From Adviser Into Authority

**Confidence:** HIGH.

**What goes wrong:**  
Diagnostics, web documentation, support content, game metadata, or a user prompt inject instructions into the model. The model invents compatibility, requests sensitive data, or produces an operation that reaches the privileged service. Cloud AI receives far more local diagnostic context than the user understood.

**Why it happens:**  
Conversational usefulness is conflated with authorization. Structured output is treated as trusted because it validates syntactically. Retrieval content is treated as instructions.

**Consequences:**  
Prompt-injection-driven system changes, data leakage, false technical guidance, nondeterministic behavior, and inability to audit why a dangerous action occurred.

**Prevention:**

- Keep AI output advisory and untrusted. It may reference catalog operation IDs in a draft, but the deterministic planner independently resolves current capabilities, evidence, policy, risk, approval, and rollback.
- Never expose shell, registry, file, service, profile publishing, admin, billing, or release tools to the model.
- Separate instructions from retrieved/untrusted content and label provenance; do not claim prompt injection can be completely solved.
- Filter/redact locally, show exactly what will be sent, require purpose-specific consent, minimize retention, and allow local-only/disabled modes.
- Store local chat encrypted by default; synchronize only through explicit opt-in and independent deletion controls.
- Record model/version, source references, draft, deterministic decision, and user approval without storing unnecessary raw PC data.

**Warning signs:**

- “Valid JSON” is considered authorization.
- The model can choose arbitrary paths, keys, commands, or URLs.
- Retrieved documents can redefine system policy.
- The consent dialog says only “improve your experience.”
- AI suggestions bypass normal confirmation because the user requested them in chat.

**Detection:**

- Adversarial prompt corpus in diagnostics, filenames, game metadata, support articles, and translated content.
- Contract tests prove every model output is rejected or normalized by the same non-AI planner used elsewhere.
- Data-flow tests assert local redaction and cloud payload allowlists.
- Red-team exercises verify the model cannot reach privileged or administrative capabilities.

**Phase to address:** P0 AI trust/data-flow contract; P1 advisory UI and consent states; P5/P6 no AI IPC authority; P10 dedicated AI security and privacy phase; P11 monitoring/incident response.

---

### Pitfall 16: A Finished-Looking UI Conceals a Fake or Unintegratable Product

**Confidence:** HIGH.

**What goes wrong:**  
The first milestone is visually excellent but buttons are dead, success is hard-coded, fixture data is indistinguishable from machine data, permission/restart/offline/partial-failure states are missing, and UI concepts cannot map to the later Rust engine. The team must rewrite the product surface or ships deceptive behavior.

**Why it happens:**  
The agreed UI-first sequence rewards screenshot completeness. Design mocks model ideal states more quickly than real asynchronous, permissioned, reversible state machines.

**Consequences:**  
False product claims, brittle contracts, expensive engine integration, visual regressions during real implementation, and a demo that cannot become production.

**Prevention:**

- Define application ports and versioned domain states before components; simulator and future Tauri/service adapters must pass the same contract suite.
- Use deterministic scenarios for loading, empty, unsupported, managed, offline, expired license, permission denied, restart pending, partial failure, drift, recovery, and measured regression.
- Every visible number carries provenance (`fixture`, `locally observed`, `cloud metadata`, `modeled`, `measured`). Production cannot render fixture provenance in an operational session.
- Every enabled control has a deterministic outcome; unavailable actions explain why. Do not add ornamental controls.
- Model long-running plans as explicit resumable state machines, not optimistic button spinners.
- Run E2E through the real Tauri shell on Windows, not only a browser-rendered React route.

**Warning signs:**

- Screenshots pass while keyboard/E2E flows fail.
- Components directly import fixture objects.
- All operations end in success.
- “Connect backend later” has no shared port or contract test.
- The design lacks cancellation, elevation, restart, drift, and recovery states.

**Detection:**

- Fixture-import lint prevents product components from bypassing simulator ports.
- Scenario completeness matrix maps every state transition to visual, accessibility, and E2E tests.
- A production-build test asserts no fixture adapters/assets and no simulated claim provenance.
- Contract parity suite is reserved for both simulator and eventual native adapters.

**Phase to address:** P0 state/port/evidence contracts; P1 full implementation and E2E; P4 first read-only native adapter proves parity; P6 first mutation adapter proves recovery parity.

---

### Pitfall 17: The Optimizer Invalidates Its Own Measurements

**Confidence:** HIGH.

**What goes wrong:**  
High-frequency polling, animated WebView surfaces, log storms, overlays, hardware queries, antivirus scans of generated files, or the tray/service itself consume CPU, GPU, RAM, disk, and timers. The optimizer worsens frame pacing and contaminates before/after comparisons.

**Why it happens:**  
Telemetry appears lightweight on a development desktop, while multiple samplers and UI subscriptions compound. Teams measure average CPU but miss wakeups, DPC/ISR effects, GPU composition, allocations, I/O bursts, and during-game behavior.

**Consequences:**  
The product fails its lightness promise, measured gains disappear when the app is open, laptops lose battery, and users disable the product during the task it exists to improve.

**Prevention:**

- Make event-driven detection the default; use adaptive sampling and suspend nonessential UI/diagnostics during games.
- Give service, tray, UI, measurement, logging, and animation separate budgets; include CPU time, working set, wakeups, disk/network I/O, GPU use, allocations, and measurement overhead.
- Measure with the UI closed/open and telemetry off/on; report and subtract only when methodologically justified, never hide overhead.
- Bound log volume/cardinality and use buffered writes outside latency-sensitive windows.
- Respect reduced motion and low-power/thermal states.

**Warning signs:**

- Multiple modules poll the same hardware independently.
- “Near-zero CPU” is based on Task Manager rounding.
- Opening the dashboard changes benchmark results.
- Debug logging or visual effects stay enabled during sessions.
- Idle resource targets are not enforced in CI or physical tests.

**Detection:**

- Long-running idle and active-game soak tests enforce the agreed 25 MB service, 40 MB tray, 250 MB UI, near-zero idle CPU, and startup targets on defined reference hardware.
- ETW/performance traces attribute wakeups, I/O, CPU, GPU, and memory to each process.
- Performance regression tests compare builds and fail on budget breach.

**Phase to address:** P0 budgets/measurement method; P1 render/startup budgets; P4 sampler design; P8 full-session overhead tests; P11 production telemetry budgets.

---

### Pitfall 18: Solo-Developer Scope Becomes an Operational Failure

**Confidence:** HIGH.

**What goes wrong:**  
One developer attempts a complete desktop UX, web/account/admin, payments, global compliance, multi-account AWS, hardware lab, signed releases, support, AI, and dozens of optimization families at once. Architecture and infrastructure stay impressive on paper while no vertical slice becomes supportable. Security alerts, key rotation, failed payments, compatibility incidents, and user support exceed available attention.

**Why it happens:**  
“Born ready to scale” is mistaken for “provision and operate every final system now.” Full modularity becomes many packages, environments, and pipelines with no owner capacity.

**Consequences:**  
Abandoned modules, stale dependencies, delayed security patches, expensive idle infrastructure, shallow testing, burnout, and production without incident coverage.

**Prevention:**

- Build a modular monolith and target-state CDK modules, but provision expensive/multi-account production infrastructure only at explicit alpha/beta gates.
- Limit work in progress to one thin, releasable vertical slice; every phase has a stop condition, maintenance cost, and explicit deferrals.
- Automate dependency updates, security scanning, build/sign/release, database migration checks, backup restore, key rotation rehearsal, and compatibility regression.
- Prefer managed services only when they reduce total operations; every service needs owner, cost ceiling, SLO, runbook, backup/export, and exit path.
- Separate “designed for scale” from “scaled now.” Load-test seams and invariants before distributing services.
- Budget recurring maintenance and incident time before adding another hardware family, provider, language, or region.

**Warning signs:**

- More packages/workflows than tested user journeys.
- No weekly capacity remains for updates and vulnerabilities.
- Production requires manual console steps remembered by one person.
- Multiple critical services have no restore or vendor-exit rehearsal.
- Roadmap phases are horizontal layers that produce no user-verifiable result.

**Detection:**

- Quarterly operational inventory measures monthly cost, patch age, alerts, runbook coverage, restore evidence, and manual toil.
- Roadmap gate rejects a new subsystem without a maintenance budget and decommission path.
- Game-day exercises verify a solo operator can revoke a release/profile, restore data, rotate a key, and communicate status.

**Phase to address:** P0 roadmap/cost/ownership rules; every phase enforces one vertical outcome; P3 limits identity/payment scope; P9 automates release response; P11 provisions production only when beta demand and runbooks justify it.

## Moderate Pitfalls

### Moderate 1: Accessibility and Localization Added After Visual Approval

**What goes wrong:**  
Fixed widths, condensed typography, icon-only controls, animated telemetry, tiny targets, color-only risk states, and concatenated strings pass screenshots but fail WCAG 2.2 AA, keyboard/screen-reader use, PT-BR expansion, and future locales.

**Prevention:**  
Use semantic headless primitives, visible focus, non-color status cues, reduced motion, target-size and contrast tests, locale-aware formatting, message IDs with complete sentences, pseudo-localization, 200% text/zoom tests, and PT-BR/English screenshot/E2E coverage from P1. Treat WebView screen-reader and keyboard behavior as Windows tests, not browser assumptions.

### Moderate 2: Risk Labels Become Decoration

**What goes wrong:**  
Verified/Advanced/Experimental/Extreme colors look clear, but the levels have no enforceable promotion criteria, approval policy, or expiration.

**Prevention:**  
Define machine-readable gates for evidence, compatibility breadth, reversibility, security impact, confirmation, rollout ring, and expiry. Derive badges from catalog state; never hand-author them in UI copy.

### Moderate 3: “Full Modular” Degenerates Into Package Proliferation

**What goes wrong:**  
Every folder becomes a package, cross-cutting “shared” modules own everything, generated contracts leak domain internals, and solo development slows without real isolation.

**Prevention:**  
Split by cohesive domain and independent reason to change. Enforce public entry points and dependency direction. Keep a small kernel of primitives; prohibit a generic `shared/services/utils` dumping ground. Extract a deployable service only on measured isolation/scale need.

### Moderate 4: Contract Generation Creates False Type Safety

**What goes wrong:**  
Generated TypeScript and Rust types compile, but runtime unknown fields, numeric bounds, tagged-union evolution, date/UUID formats, backward compatibility, and semantic invariants drift.

**Prevention:**  
Use one language-neutral transport source, runtime validation on both ends, golden payloads, invalid corpus, compatibility policy, generator pinning, drift checks, and semantic domain constructors after transport parsing.

### Moderate 5: Neon Preview and AWS PostgreSQL Drift

**What goes wrong:**  
Preview branches use different extensions, roles, connection pooling, migration order, or configuration than production; a query or migration fails only on AWS.

**Prevention:**  
Pin supported PostgreSQL major version and extensions, run migrations against disposable PostgreSQL and staging AWS-compatible configuration, keep environment capability checks, and test connection exhaustion/failover separately.

### Moderate 6: Cache or Queue Becomes Hidden Source of Truth

**What goes wrong:**  
Valkey locks, cached entitlements, SQS/EventBridge ordering, or a worker projection is treated as authoritative. Expiry, duplicate delivery, or eviction creates access and billing inconsistency.

**Prevention:**  
Keep PostgreSQL authoritative, use transactional state transitions and outbox/inbox, idempotency keys, bounded cache TTL, fencing tokens for locks, reconciliation jobs, DLQs, and user-visible pending states.

### Moderate 7: Subscription Expiry Accidentally Strands the PC

**What goes wrong:**  
An offline validation failure or expired subscription automatically reverts changes mid-game, disables safety controls, hides history, or prevents restoration.

**Prevention:**  
Implement the agreed rule: already-applied state remains; new Premium actions are blocked after the seven-day offline window; diagnostics, audit, warnings, export, and rollback remain local and free. Test clock skew and server outage.

### Moderate 8: Uninstall Semantics Are Undefined

**What goes wrong:**  
Removing the UI leaves a service, scheduled tasks, profiles, active session changes, or no recovery data; alternatively, uninstall silently reverts risky changes at a bad time.

**Prevention:**  
Design explicit choices: keep current system state with exportable recovery package, safely restore selected/all changes, or cancel. Stop game sessions, verify recovery, remove service/artifacts, and retain only consented recovery evidence.

### Moderate 9: Support Packages Leak Personal Data

**What goes wrong:**  
Paths, usernames, process lists, game libraries, serials, network information, logs, and AI conversations are uploaded under a vague “diagnostics” label.

**Prevention:**  
Use a schema allowlist, local redaction, user preview, per-category consent, client-side encryption to a case-bound recipient, expiring upload/access, purpose-specific retention, immutable access audit, and deletion proof.

### Moderate 10: The Admin Audit Log Is Mutable or Too Noisy

**What goes wrong:**  
Critical release/device/support events are editable, omitted, or buried in high-volume application logs; attackers can erase evidence or operators cannot investigate.

**Prevention:**  
Define canonical security events, append-only delivery to a separately protected log account/store, clock/source identity, correlation IDs, retention controls, alert rules, access reviews, and periodic reconstruction exercises.

### Moderate 11: Update UX Interrupts Games or Recovery

**What goes wrong:**  
The app/service updates during an active plan or game session, changes the operation catalog mid-transaction, or leaves incompatible UI/service/journal versions.

**Prevention:**  
Use compatibility handshakes, defer noncritical updates during sessions, require quiescent transaction state, migrate journals forward safely, keep rollback/forward-fix artifacts, and test interrupted installer/updater paths.

### Moderate 12: Experimental Features Quietly Become Stable

**What goes wrong:**  
High adoption or positive anecdotes cause an operation to be relabeled without sufficient hardware/build evidence; old evidence survives relevant OS/driver changes.

**Prevention:**  
Promotion is a signed auditable state transition with minimum matrix coverage, repeatability, rollback success, security review, expiry, and canary thresholds. Usage is not proof of effectiveness.

### Moderate 13: Documentation Drifts From the Operation Catalog

**What goes wrong:**  
The website explains an old mechanism or risk while the signed profile and desktop perform a newer one.

**Prevention:**  
Generate stable facts (operation ID, versions, risk, compatibility, state transitions) from the same versioned catalog; require human-reviewed narrative and sources; link documentation to catalog/profile versions.

### Moderate 14: Observability Violates Local-First Privacy

**What goes wrong:**  
OpenTelemetry instrumentation sends process names, game names, device IDs, paths, query parameters, or diagnostic values to the cloud by default; high-cardinality attributes also explode cost.

**Prevention:**  
Create an attribute allowlist, privacy classification and cardinality budget, local opt-in boundary, redaction tests, sampling, separate security audit from product analytics, and never put raw diagnostics in spans.

### Moderate 15: Premature Multi-Account AWS Becomes the Product

**What goes wrong:**  
The solo developer spends months and recurring cost on Organizations, ECS, Aurora/RDS, Valkey, WAF, observability, and region topology before a beta needs them.

**Prevention:**  
Encode target modules and security tests in CDK, run product services locally/cheaply, and activate dev/staging/production accounts/resources at explicit risk and user-count gates. Security boundaries remain designed even when not all infrastructure is provisioned.

## Phase-Specific Warnings

| Phase topic | Likely pitfall | Required mitigation / exit evidence |
|---|---|---|
| P0 — Product claims | Marketing vocabulary hard-codes unprovable “boost” numbers | Claim taxonomy, provenance schema, uncertainty/regression states, and review rule exist before UI copy |
| P0 — Threat model | Cloud/admin/AI implicitly trusted because profiles are signed | Trust-boundary diagram proves only local deterministic allowlisted engine can authorize mutation |
| P0 — Contracts | Shared types are duplicated or generated types replace runtime validation | TS/Rust golden and invalid-corpus tests; compatibility and unknown-field policy documented |
| P0 — Roadmap | “Everything” becomes one first release | Thin phase gates, explicit deferrals, maintenance budget, and no-driver/no-injection constraints |
| P1 — Visual system | Premium becomes RGB/glass/animation-heavy and consumes GPU | Impeccable review plus CPU/GPU/memory/startup budgets, reduced motion, and non-generic hierarchy |
| P1 — Simulator | Fixture values look like real measurements | Provenance visible in dev/demo; production build test has no fixture adapter; all claims map to evidence types |
| P1 — Complete flows | Only happy-path screens look finished | Scenario matrix covers unsupported, managed, offline, expired, permission denied, restart, partial failure, drift, regression, recovery |
| P1 — Accessibility | Automated browser checks substitute for Windows assistive-tech testing | Keyboard, 200% scaling, contrast, reduced motion, screen-reader smoke tests in real Tauri shell |
| P1 — i18n | English layout is approved before PT-BR expansion | Message catalog from first component, pseudo-locale, PT-BR/English visual/E2E tests, locale-safe formatting |
| P2 — Web/admin | Admin is a hidden route in public app | Separate deployment/hostname/audience/CSP/session policy and no shared broad API credential |
| P2 — Documentation | Docs promise behavior before operation evidence exists | Documentation labels planned, simulated, experimental, measured, and supported states explicitly |
| P3 — Better Auth | Library adoption substitutes for identity threat modeling | Desktop PKCE/passkey/MFA/session/recovery spike passes attack tests before commitment |
| P3 — Device binding | Raw hardware serials become account identity | Opaque local device key, privacy review, tolerance tests, transactional one-device invariant |
| P3 — Billing | Webhook order drives entitlement directly | Raw-body signature verification, idempotency, ledger, reconciliation, refund/chargeback race tests |
| P3 — PostgreSQL | App-only invariants and owner-level DB sessions | Constraints/concurrency tests, module ownership, least-privilege roles, migration rehearsals |
| P4 — Inventory | Unsupported/unknown values are coerced into known enums | Preserve unknown plus raw evidence; fail closed for stable operations; versioned fixtures |
| P4 — Windows 10 | EOL consumer builds receive “verified secure” status | Lifecycle-aware support tiers; ESU/LTSC/build distinction; explicit legacy warning |
| P4 — Measurement | Tool overhead and environmental noise are ignored | Method protocol, provenance, paired repeated runs, variance/inconclusive state, self-overhead tests |
| P5 — Service | Elevated UI or generic command bridge slips in | Unprivileged UI, allowlisted typed use cases, least privilege, adversarial named-pipe/ACL tests |
| P5 — Installer/signing | Signed installer is considered sufficient | Provenance, SBOM, protected OIDC build, trust-root separation, revocation drill |
| P5 — Driver temptation | “Deep” access becomes a custom/bundled driver | Explicit no-driver gate; artifact scan; separate future security phase required for exception |
| P6 — Journal | Restore point or guessed defaults stand in for rollback | Durable exact before-state, WAL/flush semantics, reboot recovery, fault injection, apply/revert properties |
| P6 — Compatibility | UI/service/journal upgrades are not version-coordinated | Handshake, migration/forward-fix tests, recovery works without full UI or subscription |
| P7 — Optimization wave | Breadth is prioritized over evidence | Ship one capability family only after snapshot/apply/verify/revert and physical matrix pass |
| P7 — Security/performance | Defender/VBS changes are bundled with normal tweaks | Separate Extreme consent, managed/tamper detection, effective-state verification, security cost displayed |
| P7 — Thermals | Short peak benchmark promotes hotter unstable profile | Sustained warm tests, throttling/power/noise/security outputs, notebook AC/battery coverage |
| P8 — Game detection | Launcher child-process heuristics fail on updates/multi-instance | Explicit state machine, game/launcher fixtures, full-session and cleanup tests |
| P8 — Anti-cheat | “External” measurement is called universally safe | Per-game/anti-cheat catalog, no injection/memory manipulation, safe mode, kill switch, cautious claims |
| P8 — Session rollback | Game crash/reboot leaves temporary optimizations active | Durable session lease, watchdog/reconciliation, restart/crash restoration tests |
| P9 — Profiles | Valid signature bypasses semantic policy | Local schema/capability/policy/risk/engine-version validation and compiled operation allowlist |
| P9 — Channels | Experimental profile reaches Stable by manual mistake | Audited promotion gates, canary, expiry, revocation, channel isolation, dual approval |
| P9 — Updater | Update occurs mid-game or mid-transaction | Quiescence protocol, defer policy, compatibility tests, interrupted update recovery |
| P10 — AI | Structured output is trusted as a plan | Advisory drafts only; deterministic planner and normal approval; adversarial prompt/data-flow tests |
| P10 — Support | Diagnostic upload becomes default telemetry | Local preview/redaction, case-bound consent/encryption, expiring access, deletion proof |
| P11 — AWS | Final global topology is provisioned before demand | Cost/user/risk gates, managed-service runbooks, load evidence before extraction/regions |
| P11 — Operations | Solo operator cannot contain a bad release | Tested profile/app revocation, key rotation, backup restore, incident communications, owner/on-call budget |
| Every phase | Safety is deferred to a later “hardening” phase | Threats, tests, observability, recovery, accessibility, and documentation are acceptance criteria of each slice |

## Cross-Cutting Verification Gates

The roadmap should not mark a relevant phase complete unless these gates are represented:

| Gate | Evidence |
|---|---|
| Claims | Every displayed result is traceable to observed/measured/modeled/fixture provenance; no fabricated gains |
| Compatibility | Positive capability/build/driver predicates; unknown and expired evidence fail closed |
| Privilege | No elevated UI or arbitrary command primitive; adversarial IPC suite passes |
| Recovery | Exact-state journal plus crash/reboot/disk-full/corruption fault injection |
| Security controls | Managed/Tamper Protection state and effective result verified; no bypass behavior |
| Anti-cheat | No injection/game-file/memory manipulation; per-game test evidence and kill switch |
| Supply chain | Signed/provenanced artifacts, separate profile/app trust, semantic local validation, revocation drill |
| Identity and billing | PKCE/MFA/session tests; webhook idempotency/reconciliation; device invariant under races |
| Data | Database constraints, least-privilege roles, migration/restore tests, module-owned access |
| AI/privacy | Advisory-only boundary, local redaction/consent, adversarial prompt suite |
| UX quality | Real Tauri Windows E2E for all risk/error/recovery states, WCAG 2.2 AA, PT-BR/English |
| Resource use | Service/tray/UI/startup budgets measured on reference hardware and during game sessions |
| Operations | Cost ceiling, runbook, owner, alert, backup/export, and decommission path for each production service |

## Sources

Official/primary sources were preferred. Accessed 2026-07-26.

### Windows security, lifecycle, privilege, and compatibility

- Microsoft Learn — Tamper protection: <https://learn.microsoft.com/en-us/defender-endpoint/prevent-changes-to-security-settings-with-tamper-protection>
- Microsoft Learn — Microsoft Defender Antivirus compatibility: <https://learn.microsoft.com/en-us/defender-endpoint/microsoft-defender-antivirus-compatibility>
- Microsoft Learn — Enable memory integrity / HVCI compatibility and generation-dependent performance: <https://learn.microsoft.com/en-us/windows/security/hardware-security/enable-virtualization-based-protection-of-code-integrity>
- Microsoft Learn — `timeBeginPeriod` behavior changes in Windows 10 2004 and Windows 11: <https://learn.microsoft.com/en-us/windows/win32/api/timeapi/nf-timeapi-timebeginperiod>
- Microsoft Learn — Service security and access rights: <https://learn.microsoft.com/en-us/windows/win32/services/service-security-and-access-rights>
- Microsoft Learn — Named pipe security and access rights: <https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights>
- Microsoft Learn — Impersonating a named-pipe client: <https://learn.microsoft.com/en-us/windows/win32/ipc/impersonating-a-named-pipe-client>
- Microsoft Learn — Registry key security and access rights: <https://learn.microsoft.com/en-us/windows/win32/sysinfo/registry-key-security-and-access-rights>
- Microsoft Learn — Driver signing: <https://learn.microsoft.com/en-us/windows-hardware/drivers/install/driver-signing>
- Microsoft Learn — Windows 10 Home and Pro lifecycle (end of support 2025-10-14): <https://learn.microsoft.com/en-us/lifecycle/products/windows-10-home-and-pro>
- Microsoft Learn — Windows 11 release and servicing information: <https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information>
- Microsoft Learn — System Restore API: <https://learn.microsoft.com/en-us/windows/win32/sr/system-restore>
- Microsoft Learn — About the Transactional Registry: <https://learn.microsoft.com/en-us/windows/win32/ktm/about-the-transactional-registry>

### Desktop and software supply chain

- Tauri v2 — Capabilities: <https://v2.tauri.app/security/capabilities/>
- Tauri v2 — Permissions: <https://v2.tauri.app/security/permissions/>
- Tauri v2 — Content Security Policy: <https://v2.tauri.app/security/csp/>
- Tauri v2 — Updater; signature verification cannot be disabled: <https://v2.tauri.app/plugin/updater/>
- SLSA v1.2 — Threats overview and provenance model: <https://www.slsa.dev/spec/v1.2/threats-overview>
- Sigstore — Verifying signatures and signer identity: <https://docs.sigstore.dev/cosign/verifying/verify/>
- GitHub Docs — OIDC in AWS: <https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws>
- Microsoft Security — Vulnerable and malicious driver reporting/blocklist context: <https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/design/microsoft-recommended-driver-block-rules>

### Identity, privacy, payments, and data

- IETF RFC 8252 — OAuth 2.0 for Native Apps; external user-agent and PKCE: <https://www.rfc-editor.org/rfc/rfc8252>
- IETF RFC 9700 — OAuth 2.0 Security Best Current Practice: <https://www.rfc-editor.org/rfc/rfc9700>
- W3C WebAuthn Level 3: <https://www.w3.org/TR/webauthn-3/>
- Stripe Docs — Webhooks: <https://docs.stripe.com/webhooks>
- Stripe Docs — Resolve webhook signature verification errors: <https://docs.stripe.com/webhooks/signature>
- GDPR, Regulation (EU) 2016/679 — Recital 30 online identifiers; Articles 5 and 25 minimization/privacy by design: <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
- Brazil — Lei Geral de Proteção de Dados Pessoais, Lei 13.709/2018: <https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm>
- PostgreSQL — Constraints: <https://www.postgresql.org/docs/current/ddl-constraints.html>
- PostgreSQL — Transaction isolation: <https://www.postgresql.org/docs/current/transaction-iso.html>
- PostgreSQL — Row security policies and owner/`BYPASSRLS` behavior: <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>
- AWS SQS — At-least-once delivery: <https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html>
- AWS SQS — Dead-letter queues: <https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html>

### AI, accessibility, claims, and measurement

- OWASP — Top 10 for LLM Applications; prompt injection, sensitive-information disclosure, excessive agency: <https://owasp.org/www-project-top-10-for-large-language-model-applications/>
- W3C — WCAG 2.2: <https://www.w3.org/TR/WCAG22/>
- W3C — Internationalization techniques and authoring guidance: <https://www.w3.org/International/techniques/authoring-html>
- US FTC — Advertising substantiation policy statement: <https://www.ftc.gov/legal-library/browse/statement-policy-regarding-advertising-substantiation>
- Microsoft Learn — Event Tracing for Windows: <https://learn.microsoft.com/en-us/windows-hardware/test/wpt/event-tracing-for-windows>
- Microsoft Learn — Windows Performance Analyzer: <https://learn.microsoft.com/en-us/windows-hardware/test/wpt/windows-performance-analyzer>
- Intel — PresentMon open-source frame-presentation telemetry: <https://github.com/GameTechDev/PresentMon>

### Anti-cheat confidence limitation

Anti-cheat internals and enforcement are intentionally not fully documented and can change by game. The roadmap must obtain current, game-specific vendor guidance during P8 rather than infer universal safety from generic documentation:

- Epic Online Services — Easy Anti-Cheat overview: <https://onlineservices.epicgames.com/en-US/anti-cheat>
- Riot Games Developer Portal — General policies: <https://developer.riotgames.com/policies/general>
- Steam Support — Valve Anti-Cheat information: <https://help.steampowered.com/en/faqs/view/571A-97DA-70E9-FF74>

## Research Gaps Requiring Phase-Specific Spikes

- A statistically defensible, low-overhead FPS/frametime protocol for each graphics API and anti-cheat family.
- Exact supported Defender/security operation surface on unmanaged consumer, managed enterprise, ESU, and LTSC machines; no “permanent disable” guarantee should be designed.
- Tolerance/privacy trade-off for device binding across reinstalls and legitimate hardware changes.
- Windows named-pipe caller authentication and service identity under adversarial same-user/session scenarios.
- Crash-consistent local journal storage and encryption/ACL strategy under disk-full and recovery-mode conditions.
- OEM-supported thermal/power APIs and safe compatibility boundaries for notebook families.
- Better Auth production readiness against the project's desktop PKCE, passkey, MFA, revocation, admin, and recovery requirements.
- Legally reviewed wording for measured performance, security reductions, unsupported Windows 10, subscriptions, and device cooldown.

---

*Pitfalls research for Liiiraa Boost. The highest-order rule is: no setting change, signature, AI suggestion, or polished UI state is evidence of a safe performance gain. Evidence, compatibility, effective-state verification, and exact recovery must remain independent gates.*
