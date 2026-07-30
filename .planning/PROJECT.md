# Liiiraa Boost

## What This Is

Liiiraa Boost is a premium Windows 10/11 gaming performance platform for demanding players, competitive gamers, streamers, PC technicians, and hardware enthusiasts. It combines a deeply technical desktop optimizer, game-specific profiles, measurable diagnostics, safe recovery, an AI assistant, and a global web platform for accounts, subscriptions, releases, documentation, and support.

The first milestone delivers the complete visual and UX foundation of the installable Tauri desktop app. Every future module, state, permission, error, and recovery flow will be represented through typed contracts and deterministic simulated adapters before the real optimization engine is connected.

## Core Value

Produce measurable performance gains adapted to the exact hardware without sacrificing system stability, while keeping every change explainable, auditable, and reversible.

## Business Context

- **Customer**: Global PC gamers and professionals who want deep, trustworthy control over Windows gaming performance
- **Revenue model**: Freemium product with a Premium subscription, one active PC per subscription
- **Success metric**: Users can measure a meaningful improvement, understand why it happened, and safely restore the previous state
- **Strategy notes**: Brazil-origin global launch; PT-BR and English first, with the product ready for broader localization

## Requirements

### Validated

- [x] Phase 1 established one versioned TypeSpec truth source, generated TypeScript/Rust transports, equivalent runtime validation, truthful adapter provenance, executable acceptance coverage, and live modular architecture enforcement. — Validated in Phase 1: Product Truth and Modular Contracts

- [x] Deliver a production-quality, installable Windows desktop UI covering the complete planned product surface before implementing privileged optimizations. — Validated in Phase 2: Complete Desktop Experience
- [x] Provide a contextual home experience centered on the next recommended action, selected game profile, and current system state. — Validated in Phase 2: Complete Desktop Experience

### Active

- [ ] Support complete, editable optimization plans with verified, advanced, experimental, and extreme risk levels
- [ ] Detect hardware capabilities and expose only compatible operations, with unsupported work isolated from stable flows
- [ ] Support game-specific profiles activated whether a game launches from Liiiraa Boost or an external launcher
- [ ] Show measured diagnostics, before/after comparisons, technical evidence, history, and recovery options without fabricated performance claims
- [ ] Make every applied change individually auditable and reversible through a proprietary rollback manifest plus Windows restore points where applicable
- [ ] Provide a global web platform for marketing, documentation, authentication, subscriptions, downloads, device management, support, and isolated administration
- [ ] Provide a conversational AI assistant that can explain and suggest structured plans but can never execute arbitrary commands
- [ ] Enforce end-to-end contracts, runtime validation, SDD, TDD, visual testing, accessibility testing, contract testing, and Windows/web E2E gates

### Out of Scope

- Automatic BIOS or firmware modification — the product may diagnose and guide, but firmware changes remain manual
- DLL injection, game file modification, or anti-cheat interference — performance measurement must use permitted external mechanisms
- Arbitrary community or remotely supplied scripts — downloadable profiles must be signed, declarative, and restricted to allowlisted engine operations
- Generic optimization recipes applied without capability detection — unsupported hardware must never receive speculative stable changes
- Silent security changes — extreme actions such as persistent Defender changes require proportional confirmation, recovery readiness, and post-change verification
- Advertising-supported or pressure-driven monetization — the product must remain premium, trustworthy, and free from deceptive urgency

## Context

The product is inspired by the technical ambition and gaming energy of BravoBoost/StarBoost and the polish and clarity of Hone, but must not copy either. It must be visibly more complete, transparent, secure, modular, and refined.

The desktop app is the first deliverable. Its real Tauri shell, shared design system, complete feature surfaces, typed boundaries, deterministic fixtures, visual regression tests, accessibility checks, and end-to-end flows must be complete before privileged optimization implementation begins. The web platform is the second major milestone, followed by authentication/licensing infrastructure and then the real Windows diagnosis and optimization engine.

The optimizer covers Windows services and tasks, CPU and power, GPU vendors, memory, storage, networking, games and launchers, input devices, security and privacy, displays, audio, USB, VBS/virtualization, scheduler behavior, shader caches, thermal behavior, notebooks, desktops, drivers, firmware guidance, monitoring, history, and recovery. Hardware support is capability-driven across Intel/AMD CPUs, NVIDIA/AMD/Intel GPUs, notebooks/desktops, SATA/NVMe/HDD storage, Ethernet/Wi-Fi, and different Windows generations.

The user is a solo developer working with AI assistance. The project will advance by verified milestones without a fixed release date. Early infrastructure cost must remain minimal; production-scale AWS resources are provisioned only when beta demand justifies them.

## Current State

Phase 1 is complete: the repository now has a verified, generated cross-language contract foundation, truthful simulator/production adapter boundary, executable five-dimension acceptance policy, and live pnpm/Cargo architecture enforcement. Phase 2 can build the complete desktop experience on these contracts without inventing parallel DTOs or bypassing provenance and module gates.

Phase 2 is complete: the installable desktop visual/UX foundation now includes typed navigation, complete simulated states, PT-BR/English localization, responsive scaling, accessibility coverage, development signing, and explicit truth boundaries. Phase 3 is ready to build the independent public, account, and administrative web experience.

## Constraints

- **Platform**: Windows 10 and Windows 11 desktop — the optimizer depends on Windows-specific behavior
- **Desktop stack**: Tauri 2, Rust, React, and strict TypeScript — lightweight native capabilities with a bespoke web-rendered UI
- **Web stack**: Current stable Next.js and React for separate public/account and administrative deployments
- **Architecture**: Full modular monorepo using pnpm/Turborepo and Cargo Workspace — modules must have explicit ownership and dependency rules
- **Contracts**: One language-neutral source for critical cross-process and network contracts — TypeScript and Rust clients, DTOs, and validators are generated rather than duplicated
- **Data**: PostgreSQL is the source of truth; AWS-managed PostgreSQL in production and Neon for development/preview environments
- **Cloud**: AWS primary infrastructure with Cloudflare at the edge and AWS CDK in TypeScript
- **Compute**: Hybrid ECS/Fargate and Lambda with SQS/EventBridge for asynchronous workflows
- **Cache**: Managed Valkey for cache, rate limiting, and distributed coordination, never as the only source of truth
- **Security**: Local-first desktop data, least privilege, signed artifacts, isolated privileged service, declarative signed profiles, runtime validation, immutable audit trails, and no arbitrary remote execution
- **Authentication**: Better Auth is the preferred candidate, subject to security gates; system-browser login with PKCE, passkeys, MFA, social providers, and stronger administrative authentication
- **Privacy**: Minimum retention by purpose, explicit consent for cloud AI and support diagnostics, encryption, and LGPD/GDPR readiness
- **Accessibility**: WCAG 2.2 AA, complete keyboard operation, screen-reader semantics, scalable UI, color-blind-safe status communication, and reduced motion
- **Internationalization**: Global-ready architecture with PT-BR and English in the first release
- **Performance**: Background service target at or below 25 MB RAM with near-zero idle CPU; tray at or below 40 MB; open UI target below 250 MB; perceived startup target within two seconds on compatible hardware
- **Cost**: Use local tooling, free tiers, and emulators until beta; do not provision expensive scale infrastructure prematurely
- **Quality**: Production releases have no exceptions to critical specification, type, test, security, accessibility, recovery, signing, or E2E gates

## Key Decisions

| Decision                                                                                | Rationale                                                                                                | Outcome   |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------- |
| Build the complete desktop visual and UX surface before the optimization engine         | The visual experience is the primary early risk and future engine integration must not force UI rewrites | — Pending |
| Use a contextual home rather than a static generic dashboard                            | The most relevant action changes with system, game, plan, and recovery state                             | — Pending |
| Organize primary navigation by user goals and deep views by hardware component          | Preserves clarity without flattening a technically deep product into a crowded sidebar                   | — Pending |
| Keep the free tier transparent and keep restoration available after subscription expiry | Safety and trust must never be paywalled                                                                 | — Pending |
| Limit Premium to one active PC with a 30-day self-service device reset cooldown         | Preserves a clear personal license while allowing legitimate hardware changes                            | — Pending |
| Allow seven days of offline Premium access                                              | Balances reliability for users with subscription abuse controls                                          | — Pending |
| Keep applied optimizations after subscription expiry                                    | Automatic rollback on billing state changes could interrupt or destabilize a PC                          | — Pending |
| Use official signed profiles, local adaptation, and user customization                  | Combines validation, hardware specificity, and expert control without arbitrary remote code              | — Pending |
| Use conservative anti-cheat integration                                                 | Avoids injection, game modification, and ban risk                                                        | — Pending |
| Make AI advisory only                                                                   | Natural-language help is useful, but execution remains deterministic and allowlisted                     | — Pending |
| Start as a modular monolith                                                             | A solo developer needs strong boundaries without premature distributed-system overhead                   | — Pending |
| Use OpenTelemetry as the observability standard                                         | Keeps instrumentation portable while allowing the operational backend to evolve                          | — Pending |
| Use AWS Organizations with separate environment, security, and log accounts             | Reduces blast radius and protects production and audit data                                              | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**

1. Requirements invalidated? Move them to Out of Scope with a reason.
2. Requirements validated? Move them to Validated with the phase reference.
3. New requirements emerged? Add them to Active.
4. Decisions to log? Add them to Key Decisions.
5. Is “What This Is” still accurate? Update it if reality has drifted.

**After each milestone:**

1. Review every section.
2. Verify the Core Value is still the correct priority.
3. Review customer, revenue model, and success metric.
4. Audit Out of Scope and its reasons.
5. Update Context with current evidence, users, and feedback.

---

_Last updated: 2026-07-30 after Phase 2 completion_
