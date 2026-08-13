# Phase 6: Transactional Plans and Recovery - Research

**Researched:** 2026-08-12  
**Domain:** Local transactional execution, Windows power-scheme mutation, durable recovery, and proportional-risk approval  
**Confidence:** HIGH for the repository architecture and transaction model; MEDIUM for privileged Windows integration until the required real-machine spikes pass

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Aplicação real e progressão do alfa

- **D-01:** Toda versão de operação percorre quatro estágios obrigatórios: simulação determinística, VM Windows limpa, PC do proprietário e PCs dos amigos. Não existe promoção direta para uma etapa posterior.
- **D-02:** Cada estágio deve provar o ciclo completo: preparar recuperação, aplicar, verificar, reiniciar quando necessário, restaurar e verificar novamente.
- **D-03:** A primeira operação real cria e ativa um plano de energia separado chamado **Liiiraa Verificado**. O plano de energia atual permanece intacto e sua identidade exata é registrada para restauração.
- **D-04:** Uma alteração aplicada permanece ativa até restauração explícita. Fechar o aplicativo, ficar offline ou perder Premium não desfaz a alteração. Recuperação nunca será bloqueada por assinatura.
- **D-05:** Mudança externa detectada entre preparação, aplicação ou restauração é drift. O executor pausa, mostra a diferença exata e oferece manter o estado atual, restaurar o anterior ou reaplicar quando seguro; nunca sobrescreve silenciosamente.
- **D-06:** Falha em qualquer estágio bloqueia aquela versão da operação em todas as etapas posteriores. Uma correção cria nova versão e reinicia a validação desde a simulação, sem override manual.
- **D-07:** Resultados dos amigos são reunidos em pacote diagnóstico local, redigido e verificável. O usuário vê o conteúdo antes de exportar ou enviar; dados brutos nunca são enviados automaticamente.
- **D-08:** Uma operação distribuída considerada insegura recebe revogação assinada: novas aplicações são bloqueadas, usuários afetados são alertados e a recuperação local continua disponível. Não haverá rollback remoto automático nem execução remota arbitrária.

#### Níveis de risco e consentimento

- **D-09:** A progressão é controlada: **Verificado** disponível por padrão; **Avançado** mediante ativação consciente; **Experimental** somente para alfa/beta; **Extremo** visível e explicado, porém bloqueado até existir uma fase futura com controles dedicados.
- **D-10:** A política global é somente um teto máximo de risco. Ela não seleciona operações automaticamente e não remove o controle individual por operação.
- **D-11:** A confirmação é proporcional: Verificado exige revisão clara e uma confirmação; Avançado exige detalhes e autenticação forte; Experimental exige autenticação forte, recuperação comprovada e frase digitada; Extremo não pode ser executado.
- **D-12:** A classificação de risco é técnica e imutável por versão. O usuário não pode reduzi-la. Evidência ausente, degradada, contraditória ou incompatível restringe ou bloqueia a operação.
- **D-13:** Ativar Avançado é uma preferência local, persistente e revogável por PC, protegida por autenticação forte. Mudança relevante de hardware ou postura de segurança exige revalidação.
- **D-14:** Experimental exige consentimento para cada versão e para cada aplicação. Participar do beta apenas torna a operação visível.
- **D-15:** Um plano misto herda o maior risco presente, é apresentado em grupos de risco e dependência e preserva confirmações individuais nas operações sensíveis.
- **D-16:** Mudança de evidência, compatibilidade ou risco entre composição e aplicação invalida a aprovação anterior. A interface mostra o diff e exige nova revisão.

#### Falhas, reinício, retomada e fechamento

- **D-17:** Falha parcial restaura automaticamente apenas o grupo de dependências afetado, interrompe novas operações, preserva operações independentes já verificadas e explica o estado final exato.
- **D-18:** Operações que exigem reinício criam checkpoint protegido. O aplicativo nunca força o reinício; o usuário escolhe quando reiniciar. No próximo boot, a verificação ocorre antes de concluir o plano ou admitir novas mutações.
- **D-19:** Após crash, queda de energia ou desligamento inesperado, a recuperação tem prioridade sobre qualquer nova ação. O executor compara o estado real do Windows com o diário durável e apenas conclui uma verificação segura ou restaura o grupo afetado; nunca repete uma mutação às cegas.
- **D-20:** Restauração falha ou estado anterior desconhecido bloqueia novas mutações, encerra repetições automáticas, preserva toda a evidência e abre recuperação guiada com opções seguras, Ponto de Restauração quando aplicável e diagnóstico exportável.
- **D-21:** Cancelamento só ocorre em fronteira segura. Novos estágios param, enquanto a mutação atômica atual termina ou é limitada. Timeout produz estado desconhecido e recuperação, nunca sucesso presumido.
- **D-22:** Mutações são serializadas. Apenas leituras e verificações comprovadamente independentes podem executar em paralelo.
- **D-23:** Somente operações de leitura podem repetir automaticamente de forma limitada. Uma mutação nunca é repetida sem observar antes o estado real; nova tentativa cria nova entrada de diário e exige nova confirmação quando houver incerteza.
- **D-24:** Fechar a janela durante aplicação ou recuperação não interrompe o executor protegido. A UI vai para a bandeja e, quando reaberta, apresenta o progresso atual. Desligamento do Windows é tratado pelo diário durável e pela retomada no próximo boot.

#### Central de Recuperação, checkpoints e comprovantes

- **D-25:** A experiência de recuperação fica reunida em uma Central de Recuperação única, com linha do tempo do plano ativo, checkpoints, restauração de operação individual e restauração completa do plano.
- **D-26:** O manifesto próprio do Liiiraa Boost, contendo o estado exato observado, é a autoridade primária de recuperação para toda mutação.
- **D-27:** Ponto de Restauração do Windows é uma segunda camada complementar e nunca a única garantia. Ele é preparado antes de operações Avançadas ou Experimentais quando o Windows permitir. Ausência ou falha dessa camada deve ser explícita e pode bloquear a operação conforme o risco.
- **D-28:** Se, durante a restauração, o valor atual diferir tanto do valor aplicado quanto do valor anterior registrado, há conflito. O sistema pausa, mostra o conflito e permite manter o atual ou restaurar o anterior; nunca sobrescreve silenciosamente.
- **D-29:** Aplicar e restaurar são novas transações auditáveis; o histórico anterior não é apagado nem reescrito.
- **D-30:** Cada aplicação e restauração gera comprovante imutável com resumo humano, detalhes técnicos expansíveis, estado anterior, estado solicitado, estado observado após verificação, método de recuperação e identificador auditável. Mensagem de sucesso sem verificação não é comprovante.

#### Restrições herdadas e invariantes

- **D-31:** A UI continua não elevada. Somente um broker privilegiado mínimo pode efetuar comandos específicos, tipados e permitidos; não haverá RPC genérico, scripts remotos, PowerShell arbitrário nem primitivas genéricas de registro, arquivo ou serviço.
- **D-32:** SQLite local, migrado e append-oriented, é a autoridade para diário transacional, retomada e comprovantes. Segredos não são armazenados em texto simples.
- **D-33:** A evidência da Fase 5 é requisito de admissão. Dados desconhecidos ou degradados nunca se transformam silenciosamente em compatibilidade.
- **D-34:** Nenhum teste ou ambiente desta fase usará Docker. A matriz local usa simulação determinística e Hyper-V/Windows real.
- **D-35:** Não declarar suporte de hardware como 100% sem evidência física. Os testes do proprietário e dos amigos alimentam a promoção do alfa e mantêm lacunas visíveis.

### the agent's Discretion

- Escolher nomes de crates, módulos, tabelas SQLite, índices, comandos Tauri e mensagens TypeSpec, desde que respeitem os limites tipados, a serialização de mutações e a autoridade append-oriented.
- Definir o layout visual final da revisão do plano, progresso, linha do tempo e comprovantes, preservando o design bespoke existente, WCAG 2.2 AA, teclado completo, leitor de tela e movimento reduzido.
- Definir limites numéricos de retry apenas para leituras, timeouts técnicos, retenção de logs não necessários à recuperação e política de compactação, sem apagar estado necessário para restaurar ou auditar.
- Definir a implementação Windows específica do plano de energia e do Ponto de Restauração usando APIs documentadas e comandos estreitos, com testes de propriedade, falha injetada e upgrade de banco.

### Deferred Ideas (OUT OF SCOPE)

- Liberar operações de risco Extremo fica adiado até uma fase futura com controles dedicados e evidência própria.
- O catálogo amplo de otimizações de Windows, CPU, GPU, rede, áudio e demais famílias pertence à Fase 7; a Fase 6 entrega a infraestrutura transacional e a primeira operação de energia.
- Descoberta de jogos e automação por sessão pertencem à Fase 8.
- As validações físicas pendentes da Fase 4 permanecem dívida explícita e serão retomadas com os amigos durante o alfa; não bloqueiam o planejamento da Fase 6, mas impedem afirmar cobertura total.
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID                    | Description                                                                                                                          | Research Support                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PLAN-01               | User can generate a personalized optimization plan from current goals, hardware capabilities, and system evidence                    | Immutable plan revisions, Phase 5 evidence fingerprints, deterministic composition, and fail-closed admission are specified below. [VERIFIED: `.planning/REQUIREMENTS.md`; codebase grep]                                              |
| PLAN-02               | User can add, remove, and inspect individual operations before approving a plan                                                      | Every edit creates a new immutable revision; the existing `ImproveFeature` operation inspector is retained and connected to real authority. [VERIFIED: `.planning/REQUIREMENTS.md`; codebase grep]                                     |
| PLAN-03               | Every operation shows purpose, expected impact, risk, evidence, compatibility, restart effect, previous value, and recovery method   | The canonical operation contract and review projection include every required field, with requested/observed/verified states kept distinct. [VERIFIED: `.planning/REQUIREMENTS.md`; `packages/feature-shell/src/features/improve.tsx`] |
| PLAN-04               | User chooses a global Verificado, Avançado, Experimental, or Extremo policy while retaining per-operation control                    | A pure risk-ceiling policy, immutable per-version risk, mixed-plan maximum risk, and an uncallable Extremo execution path are specified. [VERIFIED: `06-CONTEXT.md` D-09–D-16]                                                         |
| PLAN-05               | High-risk operations require proportional confirmation, authentication, completed recovery preparation, and post-change verification | Approval fingerprints bind the exact revision, evidence, risk, compatibility, recovery readiness, and fresh action-scoped authentication proof. [VERIFIED: `06-CONTEXT.md` D-11–D-16]                                                  |
| PLAN-06               | The engine journals exact prior state before every side effect and verifies apply and rollback outcomes                              | A durable prepare/observe/reconcile protocol, WAL + `synchronous=FULL`, and no database transaction held across an OS call are specified. [CITED: https://sqlite.org/wal.html]                                                         |
| PLAN-07               | User can restore an individual operation, a complete plan, or a recovery checkpoint after failure or reboot                          | Restore is a new transaction, walks the dependency graph in reverse order, checks drift, and is available without Premium. [VERIFIED: `06-CONTEXT.md` D-04, D-18–D-20, D-25–D-30]                                                      |
| PLAN-08               | Partial failure pauses safely, reverts only the necessary dependency set, explains the cause, and preserves an auditable diagnostic  | Dependency closures, safe cancellation boundaries, immutable receipts, fault injection, and diagnostic export are specified. [VERIFIED: `06-CONTEXT.md` D-17, D-20–D-23, D-30]                                                         |
| </phase_requirements> |

## Summary

Phase 6 should be planned as two deliberately separate layers: a deterministic, contract-conformant plan/recovery authority that can exercise every branch without touching Windows, and one production adapter that exposes exactly one real operation version: create, name, activate, verify, and exactly restore the dedicated `Liiiraa Verificado` power scheme. The broad optimizer catalog remains Phase 7; simulated operations must never become a production fallback or make a performance claim. [VERIFIED: `06-CONTEXT.md` D-01–D-03 and Deferred Ideas; `AGENTS.md`]

The core design is an application-level transaction protocol around non-transactional Windows APIs. Commit an immutable `prepared` journal event containing exact prior and requested state before each side effect; release the SQLite transaction; invoke one narrow broker command; re-observe Windows; then append the observed verdict. A crash after `prepared` is intentionally ambiguous and must be reconciled by observation (`prior` means not applied, `requested` means applied, anything else means conflict), never by replay. [VERIFIED: `06-CONTEXT.md` D-05, D-19, D-21–D-23, D-26–D-30; CITED: https://www.sqlite.org/lang_transaction.html]

The highest-risk planning work is not the UI. It is proving privileged IPC identity and replay resistance, proving that user-scoped power APIs operate on the intended interactive user when invoked through the broker, obtaining fresh action-scoped strong-auth proof, surviving disk-full/power-loss windows, and validating reboot recovery in the prepared Hyper-V lab. These require explicit spikes and blocking gates before production authority is admitted. [VERIFIED: `.planning/STATE.md`; codebase grep; `C:\Users\Liiiraa\VM-Lab\Evidence\20260812-213313-audit.json`]

**Primary recommendation:** Build and property-test the pure transaction/recovery kernel and deterministic adapter first; add the minimal allowlisted Windows service and `Liiiraa Verificado` adapter only after IPC, user-context, journal-durability, and strong-auth spikes pass. [VERIFIED: `06-CONTEXT.md` D-01, D-06, D-31–D-34]

## Architectural Responsibility Map

| Capability                                                     | Primary Tier                                 | Secondary Tier                      | Rationale                                                                                                                                                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan review, per-operation controls, progress, Recovery Center | Browser / Client                             | API / Backend (Tauri core)          | React presents generated projections and sends intent; it never decides compatibility, risk, authentication, or success. [VERIFIED: `AGENTS.md`; Tauri boundary pattern in codebase]                                              |
| Plan composition and admission                                 | API / Backend (unprivileged Tauri Rust core) | Database / Storage                  | Trusted native code combines goals with Phase 5 evidence and immutable operation definitions, then persists revisions. [VERIFIED: `06-CONTEXT.md` Integration Points]                                                             |
| Risk policy and approval fingerprint                           | API / Backend (unprivileged Tauri Rust core) | Cloud identity authority            | The core recomputes policy; fresh strong-auth evidence is referenced, not asserted by the renderer. [VERIFIED: `06-CONTEXT.md` D-09–D-16; codebase grep]                                                                          |
| Transaction journal, checkpoints, receipts                     | Database / Storage (local SQLite)            | API / Backend                       | SQLite is the locked authority; the executor appends events and derives projections. [VERIFIED: `06-CONTEXT.md` D-26, D-29, D-32]                                                                                                 |
| Mutation orchestration and reconciliation                      | API / Backend (unprivileged Tauri Rust core) | Privileged Windows broker           | The executor owns plan semantics; the broker owns only allowlisted atomic observe/apply/restore effects. [VERIFIED: `06-CONTEXT.md` D-19, D-22, D-31 and Integration Points]                                                      |
| Power-scheme observation/mutation                              | Privileged Windows broker                    | Windows Power Manager               | Use documented PowrProf APIs, not `powercfg`, scripts, or generic registry primitives. [CITED: https://learn.microsoft.com/en-us/windows/win32/power/managing-power-schemes]                                                      |
| System Restore preparation                                     | Privileged Windows broker                    | Windows System Restore              | It is a complementary recovery layer; the Liiiraa manifest remains primary. [VERIFIED: `06-CONTEXT.md` D-26–D-27; CITED: https://learn.microsoft.com/en-us/windows/win32/api/srrestoreptapi/nf-srrestoreptapi-srsetrestorepointw] |
| Reboot/close-to-tray continuity                                | API / Backend (Tauri core)                   | Database / Storage; Windows service | The core stays alive when the window closes; startup consults durable journal before accepting mutation; an in-flight broker call finishes independently of the renderer. [VERIFIED: `06-CONTEXT.md` D-18–D-24]                   |
| Evidence eligibility                                           | API / Backend (Phase 5 native authority)     | Database / Storage                  | Unknown, stale, degraded, contradictory, or incompatible evidence fails closed and invalidates prior approval. [VERIFIED: `06-CONTEXT.md` D-12, D-16, D-33; Phase 5 SPEC]                                                         |

## Project Constraints (from AGENTS.md)

- Target Windows 10/11 with Tauri 2, Rust, React, and strict TypeScript; keep the renderer unprivileged. [VERIFIED: `AGENTS.md`]
- Preserve the modular pnpm/Turborepo and Cargo Workspace; add explicit module ownership and dependency rules before adding a broker app/crate. [VERIFIED: `AGENTS.md`; `architecture/module-boundaries.json`]
- Define critical cross-process contracts once in TypeSpec and generate TypeScript/Rust transports and validators; do not duplicate DTOs. [VERIFIED: `AGENTS.md`; `packages/contracts-source/src/main.tsp`]
- Use local migrated SQLite for transactional recovery and audit; never put secrets in plaintext rows. [VERIFIED: `AGENTS.md`; `06-CONTEXT.md` D-32]
- Enforce least privilege, signed artifacts, isolated privileged service, declarative allowlisted operations, runtime validation, immutable audit trails, and no arbitrary remote execution. [VERIFIED: `AGENTS.md`]
- Preserve local-first behavior, minimum retention, explicit consent for diagnostic sharing, PT-BR/English, WCAG 2.2 AA, full keyboard/screen-reader support, scalable UI, non-color-only status, and reduced motion. [VERIFIED: `AGENTS.md`]
- Stay inside background/tray/UI resource targets and avoid high-frequency game-time work; transaction progress should be event-driven rather than polled aggressively. [VERIFIED: `AGENTS.md`; Phase 5 decisions]
- Use deterministic simulated adapters before admitting real mutation, but do not substitute fixtures in production. The only real Phase 6 operation is the dedicated power plan; catalog expansion is Phase 7. [VERIFIED: `AGENTS.md`; `06-CONTEXT.md`]
- Use no Docker in this phase; use deterministic simulation and Hyper-V/physical Windows. [VERIFIED: `06-CONTEXT.md` D-34]
- TDD mode is enabled. State machines, validation rules, dependency algorithms, admission, reconciliation, and journal behavior need one-feature RED/GREEN/REFACTOR plans; visual layout and glue remain standard tasks with tests. [VERIFIED: `.planning/config.json`; `C:/Users/Liiiraa/.codex/get-shit-done/references/tdd.md`]
- Prefix shell commands with `rtk`. Preserve unrelated worktree changes. [VERIFIED: `C:/Users/Liiiraa/.codex/RTK.md`; current git status]

## Standard Stack

### Core

| Library                                   | Version / publish date | Purpose                                                                                                 | Why Standard                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeSpec compiler and JSON Schema emitter | 1.14.0 / 2026-07-14    | Canonical plan, executor, broker, recovery, receipt, and diagnostic contracts                           | Already the repository’s single contract source; generated TS/Rust parity is an architectural invariant. [VERIFIED: npm registry; codebase grep]                                                                                                                                                                                                                                                                               |
| Tauri                                     | 2.11.5 / 2026-07-01    | Unprivileged native host, narrow renderer commands, tray continuity, ordered progress channel           | Already pinned; commands and channels fit request/response plus ordered progress, while capabilities constrain webview access. [VERIFIED: crates.io API; CITED: https://v2.tauri.app/develop/calling-rust/]                                                                                                                                                                                                                    |
| `windows`                                 | 0.62.2 / 2025-10-06    | PowrProf, named-pipe security, process/token verification, mutex, System Restore types, and DLL loading | Already pinned. Use generated Power bindings, but follow Microsoft’s explicit System Restore requirement to resolve `SRSetRestorePointW` dynamically from `SrClient.dll` rather than relying on load-time linking. [VERIFIED: crates.io API; local cargo source; CITED: https://microsoft.github.io/windows-docs-rs/; https://learn.microsoft.com/en-us/windows/win32/api/srrestoreptapi/nf-srrestoreptapi-srsetrestorepointw] |
| `rusqlite`                                | 0.40.1 / 2026-06-06    | Durable local journal and projections                                                                   | Already pinned and used by the Phase 5 store; the recovery connection must use a stronger durability policy. [VERIFIED: crates.io API; `apps/desktop/src-tauri/Cargo.toml`]                                                                                                                                                                                                                                                    |
| `rusqlite_migration`                      | 2.6.0 / 2026-05-28     | Append-only journal schema upgrades and upgrade-path tests                                              | Already pinned and used by Phase 5 migrations. [VERIFIED: crates.io API; codebase grep]                                                                                                                                                                                                                                                                                                                                        |
| `windows-service`                         | 0.8.1 / 2026-05-08     | Minimal Windows service lifecycle and SCM control handling                                              | Use for the broker host instead of hand-writing SCM plumbing. It is not installed yet and slopcheck was unavailable, so the planner must add a human legitimacy checkpoint before install. [ASSUMED; registry existence verified but legitimacy gate incomplete]                                                                                                                                                               |

### Supporting

| Library                   | Version / publish date                  | Purpose                                                                             | When to Use                                                                                                                                                                                                                            |
| ------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XState / `@xstate/react`  | 5.32.5 / 2026-07-14; 6.1.0 / 2026-02-26 | Renderer interaction states                                                         | Use only to project/review authoritative native state; do not duplicate the transaction state machine in the renderer. [VERIFIED: npm registry; local lockfile]                                                                        |
| `sha2`, `hmac`, `keyring` | existing exact pins                     | Hash-chained receipts, bounded authenticated IPC material, OS-backed secret custody | Reuse existing dependencies; recovery data itself must stay readable even if an optional integrity key is unavailable, while new mutations fail closed. [VERIFIED: `apps/desktop/src-tauri/Cargo.toml`; ASSUMED design recommendation] |
| `proptest`                | 1.11.0 / 2026-03-24                     | State-machine, dependency-closure, idempotency, and crash-boundary properties       | Use for the pure Rust kernel and journal model. [VERIFIED: crates.io API; local Cargo.toml]                                                                                                                                            |
| Vitest                    | 4.1.10 / 2026-07-06                     | TypeScript policy, client, adapter-conformance, and component tests                 | Existing JS/TS unit framework. [VERIFIED: npm registry; package scripts]                                                                                                                                                               |
| Playwright                | 1.62.0 / 2026-07-24                     | Keyboard, accessibility, drift/recovery, reconnect, and responsive journeys         | Existing browser E2E; run deterministic harness journeys before packaged Windows tests. [VERIFIED: npm registry; codebase grep]                                                                                                        |

### Alternatives Considered

| Instead of                                 | Could Use                                     | Tradeoff                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documented PowrProf APIs                   | `powercfg.exe`                                | `powercfg` is convenient for manual diagnostics, but subprocess text parsing, locale variation, and broad command authority conflict with the locked typed/no-script boundary. Use native APIs. [CITED: https://learn.microsoft.com/en-us/windows/win32/power/managing-power-schemes; VERIFIED: `06-CONTEXT.md` D-31] |
| Application journal + narrow broker        | Full plan engine inside LocalSystem service   | A service-owned engine improves boot autonomy but greatly widens privileged business logic. Keep composition, approvals, dependency policy, and UI projections unprivileged; privilege only exact effects. [VERIFIED: `06-CONTEXT.md` D-31 and Integration Points]                                                    |
| WAL + `synchronous=FULL` recovery database | Existing Phase 5 `synchronous=NORMAL` setting | `NORMAL` can lose the latest WAL transaction on power loss; recovery intent cannot accept that risk. Do not silently change the evidence store—use a dedicated recovery connection/database policy. [CITED: https://sqlite.org/pragma.html; VERIFIED: `apps/desktop/src-tauri/src/evidence_store.rs`]                 |
| Append-only events + derived projections   | Mutable “current status” rows as authority    | Projection rows are efficient but cannot be the audit truth. Status changes must append events; projections may be rebuilt and verified. [VERIFIED: `06-CONTEXT.md` D-29, D-32]                                                                                                                                       |
| Windows System Restore as secondary layer  | System Restore as the sole rollback           | System Restore may be disabled, unavailable in safe mode, or skip a new point because of frequency; the exact Liiiraa manifest remains primary. [CITED: https://learn.microsoft.com/en-us/windows/win32/api/srrestoreptapi/nf-srrestoreptapi-srsetrestorepointw]                                                      |

**Installation:**

```bash
# After the required human legitimacy checkpoint only
cargo add windows-service@=0.8.1 --package <broker-package>

# Existing windows crate: add features, not a second Win32 package
# Win32_System_Power, Win32_System_Restore, Win32_System_Pipes,
# Win32_Security_Authorization, Win32_System_Services, Win32_System_Registry,
# Win32_System_LibraryLoader
```

All other recommended packages are already pinned in the repository. [VERIFIED: Cargo.toml/package.json/pnpm-lock.yaml]

## Package Legitimacy Audit

| Package           | Registry  | Age                                            | Downloads                                           | Source Repo                             | slopcheck                       | Disposition                                                                                                            |
| ----------------- | --------- | ---------------------------------------------- | --------------------------------------------------- | --------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `windows-service` | crates.io | Created 2018-06-04; 0.8.1 published 2026-05-08 | 6,188,878 total; 442,447 for 0.8.1 at research time | `github.com/mullvad/windows-service-rs` | Unavailable (Python/pip absent) | `[ASSUMED]` — planner must add `checkpoint:human-verify` before install. [VERIFIED: crates.io API; ASSUMED legitimacy] |

**Packages removed due to slopcheck [SLOP] verdict:** none; slopcheck did not run.  
**Packages flagged as suspicious [SUS]:** none were classified because slopcheck did not run.

_Because slopcheck was unavailable, the new package remains `[ASSUMED]` even though Cargo registry metadata and official crate documentation were verified._

## Architecture Patterns

### System Architecture Diagram

```text
User goals + Phase 5 evidence + operation catalog
                    |
                    v
       [Pure plan composer / admission]
          | invalid -> explain blockers
          v
 [Immutable plan revision + evidence fingerprint]
          |
          v
 [React review UI] -> edit -> new immutable revision
          |
          v
 [Risk/recovery/auth gates in Tauri Rust core]
          | changed evidence/risk -> diff + re-review
          | Extremo -> blocked
          v
 [SQLite append: transaction + prior + requested + approval fingerprint]
          | commit fails -> NO OS CALL
          v
 [Narrow authenticated local IPC]
          |
          v
 [Minimal privileged broker]
   | observe -> precondition drift? -> pause/conflict
   | exact allowlisted power/restore-point call
   v
 [Windows PowrProf / System Restore]
          |
          v
 [Re-observe Windows] -> prior / requested / other
          |                 |           |
          |                 |           +-> conflict/guided recovery
          |                 +-> append verified receipt
          +-> append not-applied/paused; never blind retry
                              |
                              v
             [Ordered Tauri channel + Recovery Center]
```

The diagram separates renderer intent, unprivileged policy/orchestration, durable storage, and the privileged OS boundary. [VERIFIED: `AGENTS.md`; `06-CONTEXT.md` D-19, D-22, D-31–D-33]

### Recommended Project Structure

```text
packages/contracts-source/src/
└── transactional-plans.tsp       # canonical closed messages/documents
packages/desktop-client/src/
└── plans.ts                       # generated-validation client and deterministic adapter port
crates/plan-engine/
├── src/domain.rs                  # pure plan/risk/dependency rules
├── src/executor.rs                # pure event/state reducer
└── src/reconcile.rs               # prior/requested/conflict decisions
apps/optimizer-service/
├── Cargo.toml                     # Windows service binary; explicit architecture owner
└── src/
    ├── ipc.rs                     # local authenticated, replay-resistant pipe
    ├── operations/power_scheme.rs # exact observe/apply/restore only
    └── restore_point.rs           # complementary preparation only
apps/desktop/src-tauri/src/
├── plan_commands.rs               # narrow renderer API and ordered progress channel
├── plan_executor.rs               # unprivileged orchestration and serialization
└── recovery_store/
    ├── mod.rs                     # FULL-durability connection
    └── migrations.rs              # append-only authority + derived projections
packages/feature-shell/src/features/
├── improve.tsx                    # connect existing review experience
└── recover.tsx                    # evolve into single Recovery Center
```

Add both Cargo membership and `architecture/module-boundaries.json` ownership before implementation; do not hide the broker inside the desktop crate. [VERIFIED: repository workspace/module-boundary conventions; ASSUMED naming under agent discretion]

### Pattern 1: Immutable Plan Revision + Approval Fingerprint

**What:** Composition produces a plan revision whose operation versions, dependency graph, Phase 5 evidence IDs/hashes/freshness, risk classes, compatibility verdicts, restart effects, prior observations, and recovery methods are canonicalized and hashed. Any edit or changed evidence produces a new revision/fingerprint. [VERIFIED: `06-CONTEXT.md` D-10, D-12, D-15–D-16]

**When to use:** Every review, approval, apply, retry, and restore request. [VERIFIED: `06-CONTEXT.md` D-14, D-16, D-23, D-29]

**Rules:**

- Never accept renderer-supplied `compatible`, `risk`, `authenticated`, or `verified` booleans as authority. Recompute them from the registered operation version, evidence authority, and trusted proof reference. [VERIFIED: project boundary patterns; ASSUMED concrete enforcement]
- Bind fresh strong-auth proof to `action + device + planFingerprint + operationVersionSet + expiry`; the existing desktop `authenticationStrength` projection is not proof of fresh action-scoped reauthentication. [VERIFIED: codebase grep; ASSUMED concrete proof shape]
- Extremo has no executable command variant in the broker contract, not merely a disabled button. [VERIFIED: `06-CONTEXT.md` D-09, D-11]

### Pattern 2: Durable Intent / External Effect / Observation

**What:** Treat each Windows side effect as a saga step, not as a database transaction. [ASSUMED terminology; VERIFIED behavior from D-19/D-23]

```rust
// Source: SQLite transaction semantics + Phase 6 D-19/D-23.
fn execute_step(store: &mut RecoveryStore, broker: &Broker, step: PreparedStep) -> Result<Verdict> {
    // WAL + synchronous=FULL; this commit must complete before the OS call.
    store.append_prepared(&step)?;

    // No SQLite transaction is held across the external call.
    let dispatch = broker.apply_exact(step.command.clone());

    // Success is determined by observation, never by the dispatch return alone.
    let observed = broker.observe_exact(step.observation.clone())?;
    let verdict = reconcile(&step.prior, &step.requested, &observed, dispatch);
    store.append_observation(&step.id, &observed, &verdict)?;
    Ok(verdict)
}
```

The journal must distinguish `prepared`, `dispatch-returned`, `observed`, `verified`, `not-applied`, `unknown`, `drift`, `conflict`, `restore-prepared`, and `restored`; collapsing these into `pending/success/error` loses recovery truth. [VERIFIED: `06-CONTEXT.md` D-05, D-19–D-21, D-28, D-30]

### Pattern 3: Observation-First Crash Reconciliation

```rust
// Source: Phase 6 D-19, D-23, D-28.
fn reconcile(prior: &State, requested: &State, observed: &State) -> ReconcileDecision {
    if observed == requested {
        ReconcileDecision::AppliedNeedsReceipt
    } else if observed == prior {
        ReconcileDecision::NotAppliedDoNotRetry
    } else {
        ReconcileDecision::ConflictRequiresUserChoice
    }
}
```

This reducer should be exhaustively unit-tested and property-tested. An abandoned interprocess mutex is also a recovery signal: Windows documents the protected resource as indeterminate after abandonment, so reconcile before continuing. [CITED: https://learn.microsoft.com/en-us/windows/win32/sync/mutex-objects]

### Pattern 4: Dependency-Scoped Rollback

Validate an acyclic graph at composition. Apply in topological order. On failure, stop admitting new steps, compute the affected dependency closure, and restore only verified/applied nodes in reverse topological order; independently verified groups remain active. [VERIFIED: `06-CONTEXT.md` D-15, D-17, D-22]

Property tests should prove: no rollback outside the failed closure, every restored dependent precedes its dependency, cycles are rejected, permutations with the same graph yield the same closure, and a restore failure blocks all later mutation. [VERIFIED: `06-CONTEXT.md` D-17, D-20; ASSUMED test formulation]

### Pattern 5: One Real Power-Scheme Operation as Multiple Journaled Effects

Use GUIDs as identity; names are presentation only. The operation should: [CITED: https://learn.microsoft.com/en-us/windows/win32/power/managing-power-schemes]

1. Observe and persist the exact active scheme GUID plus a canonical snapshot of relevant scheme metadata/settings. [CITED: https://learn.microsoft.com/en-us/windows/win32/api/powersetting/nf-powersetting-powergetactivescheme]
2. Generate the destination GUID before mutation, so the requested identity is journaled. `PowerDuplicateScheme` accepts a destination GUID and reports `ERROR_ALREADY_EXISTS`, enabling deterministic reconciliation. [CITED: https://learn.microsoft.com/en-us/windows/win32/api/powrprof/nf-powrprof-powerduplicatescheme]
3. Duplicate the current scheme, set the friendly name/description to `Liiiraa Verificado`, and verify the created scheme. [CITED: https://learn.microsoft.com/en-us/windows/win32/api/powrprof/nf-powrprof-powerwritefriendlyname]
4. Re-observe the active GUID, then activate the target and verify active GUID equality. A successful API return alone is not a receipt. [CITED: https://learn.microsoft.com/en-us/windows/win32/power/managing-power-schemes]
5. Restore by reactivating the exact prior GUID. Delete the created target only when its identity and canonical state still match the owned snapshot; otherwise show drift/conflict. [CITED: https://learn.microsoft.com/en-us/windows/win32/api/powrprof/nf-powrprof-powerdeletescheme; VERIFIED: `06-CONTEXT.md` D-05, D-28]

Do not claim a performance gain merely for cloning/activating a scheme. Phase 6 proves transactional infrastructure and reversibility; setting-level optimizer claims belong to Phase 7 unless a separately versioned, evidence-backed setting is explicitly admitted. [VERIFIED: `06-CONTEXT.md` Deferred Ideas]

### Pattern 6: Narrow Broker with Local Authenticated IPC

The broker contract should expose operation-specific messages such as `observePowerScheme`, `duplicateManagedPowerScheme`, `activatePowerScheme`, `deleteOwnedPowerScheme`, and `prepareRestorePoint`; it must not expose command lines, file paths, registry paths, service names, arbitrary GUID/value writes, or generic JSON “operations.” [VERIFIED: `06-CONTEXT.md` D-31]

Pipe creation needs an explicit DACL rather than defaults: Microsoft documents that the default named-pipe descriptor grants read access to Everyone and anonymous users. Verify the client token, session, and process; reject remote clients; fail closed if impersonation fails; then use nonce/counter/request-ID binding so a captured mutation request cannot be replayed. [CITED: https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights; https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-impersonatenamedpipeclient; ASSUMED replay protocol]

`PowerSetActiveScheme` sets the scheme for the current user, so a LocalSystem service must prove which user context the PowrProf call affects. The planner should schedule a blocking spike that observes the interactive user’s active GUID, invokes through verified impersonation, and verifies the same user’s state changed—first in the clean VM. [CITED: https://learn.microsoft.com/en-us/windows/win32/power/power-management-functions; ASSUMED broker mechanism pending spike]

### Pattern 7: Ordered Native Progress, Snapshot on Reconnect

Use a Tauri command to subscribe and a `tauri::ipc::Channel` for ordered executor events carrying `transactionId`, monotonic `sequence`, `state`, and bounded display data. On a gap, reload, or reopen-from-tray, discard inferred progress and fetch the authoritative snapshot from SQLite. Tauri documents channels as ordered and faster than global events; global events are dynamic and not type-safe. [CITED: https://v2.tauri.app/develop/calling-rust/; https://v2.tauri.app/develop/calling-frontend/]

Explicitly configure Tauri capabilities for only the main trusted webview: registered application commands are allowed to all windows/webviews by default unless capability boundaries are applied. [CITED: https://v2.tauri.app/security/capabilities/]

### Pattern 8: System Restore Is Prepared and Verified, Never Assumed

Resolve `SRSetRestorePointW` dynamically from `SrClient.dll` as Microsoft requires, then call it with begin/end change semantics through the narrow broker, record its sequence/status, and verify whether a new usable point actually exists. The API fails when System Restore is disabled or in safe mode and may return success while reusing/skipping a new point because of the default frequency. Do not modify `SystemRestorePointCreationFrequency` as a hidden workaround. [CITED: https://learn.microsoft.com/en-us/windows/win32/api/srrestoreptapi/nf-srrestoreptapi-srsetrestorepointw; https://learn.microsoft.com/en-us/windows/win32/sr/using-system-restore]

### Recommended SQLite Authority

| Table / projection     | Authority rule                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan_revisions`       | Immutable canonical plan and fingerprint; edit means new row. [VERIFIED: D-16, D-29]                                                                                 |
| `plan_operations`      | Immutable operation version, dependency group, risk, evidence refs, restart/recovery metadata. [VERIFIED: PLAN-03; D-12, D-15]                                       |
| `approval_events`      | Append only; proof reference and fingerprint, never credentials or typed phrase plaintext. [VERIFIED: D-11, D-14, D-32]                                              |
| `recovery_checkpoints` | Exact protected pre-state, restore-point status/sequence where applicable, and coverage verdict. [VERIFIED: D-18, D-26–D-27]                                         |
| `transactions`         | Immutable apply/restore/retry identity and parent relationship. [VERIFIED: D-23, D-29]                                                                               |
| `journal_events`       | Strict increasing sequence, canonical JSON, previous hash, event hash, transaction/step IDs; no update/delete API. [VERIFIED: D-29, D-32; ASSUMED hash-chain design] |
| `receipts`             | Immutable requested/prior/observed/verification/recovery/audit projection bound to journal head. [VERIFIED: D-30]                                                    |
| `executor_projection`  | Rebuildable current-state cache, never audit authority. [ASSUMED implementation pattern]                                                                             |
| `operation_promotions` | Immutable four-stage evidence and block/revocation status per exact operation version. [VERIFIED: D-01, D-06, D-08]                                                  |

Open every recovery connection with `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=FULL`, a bounded busy timeout, and explicit verification that the pragmas took effect. SQLite requires foreign keys per connection, and in WAL mode only `FULL` syncs the WAL on every transaction commit for power-loss durability. [CITED: https://www.sqlite.org/foreignkeys.html; https://sqlite.org/wal.html]

### Anti-Patterns to Avoid

- **Holding SQLite open transaction across a Win32 call:** it creates long locks without making the external effect atomic. Commit intent, call, then append observation. [CITED: https://www.sqlite.org/lang_transaction.html; ASSUMED orchestration conclusion]
- **Blind mutation retry:** a timeout or crash yields unknown state; observe first and create a new auditable retry only after explicit admission. [VERIFIED: D-19, D-21, D-23]
- **Success from return code:** return code proves only dispatch result, not final Windows state. [VERIFIED: D-30]
- **Name-based power-plan identity:** friendly names are mutable and non-unique; persist GUID and canonical state. [CITED: https://learn.microsoft.com/en-us/windows/win32/power/managing-power-schemes]
- **Deleting a changed target during restore:** external edits are conflicts, not Liiiraa-owned cleanup. [VERIFIED: D-05, D-28]
- **A second renderer state machine as truth:** XState may drive interaction affordances, but native journal projection owns transaction state. [VERIFIED: D-32; ASSUMED UI rule]
- **Fixture fallback in production:** the production registry contains only the admitted power operation; every other catalog item stays explicitly unavailable. [VERIFIED: `AGENTS.md`; Phase 1/5 established pattern]
- **Remote or generic rollback:** revocation blocks new applications and warns; it never triggers remote execution or silent rollback. [VERIFIED: D-08]
- **Compacting away recovery evidence:** receipts/checkpoints required for restoration/audit are outside ordinary log retention. [VERIFIED: agent discretion in `06-CONTEXT.md`]

## Don't Hand-Roll

| Problem                   | Don't Build                                           | Use Instead                                                                                                                | Why                                                                                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows service lifecycle | Raw SCM registration/control plumbing                 | `windows-service` after legitimacy approval                                                                                | Service dispatcher/status/control semantics are already wrapped; still follow Microsoft SCM lifecycle rules. [CITED: https://docs.rs/windows-service/0.8.1/windows_service/; https://learn.microsoft.com/en-us/windows/win32/services/multithreaded-services] |
| Power schemes             | `powercfg` subprocess/parser or direct registry edits | PowrProf APIs through `windows` bindings                                                                                   | APIs expose GUID identities, duplication, activation, access checks, enumeration, and deletion without generic execution. [CITED: https://learn.microsoft.com/en-us/windows/win32/power/managing-power-schemes]                                               |
| Restore-point creation    | PowerShell/WMI scripts or direct load-time linking    | Narrow dynamic `SrClient.dll`/`SRSetRestorePointW` wrapper using generated Windows types                                   | The documented dynamic API path exposes begin/end/status/sequence and failure/skip behavior while following Microsoft’s loading requirement. [CITED: https://learn.microsoft.com/en-us/windows/win32/api/srrestoreptapi/nf-srrestoreptapi-srsetrestorepointw] |
| Contract duplication      | Handwritten TS and Rust DTOs                          | TypeSpec -> JSON Schema -> generated transports + runtime validation                                                       | This is the project’s locked language-neutral contract architecture. [VERIFIED: `AGENTS.md`; Phase 1 decisions]                                                                                                                                               |
| Transaction durability    | JSON files, localStorage, Tauri Store                 | `rusqlite` + migrations + append-only journal                                                                              | Recovery needs transactions, constraints, migration tests, and power-loss-aware durability. [VERIFIED: `AGENTS.md`; CITED: https://sqlite.org/wal.html]                                                                                                       |
| Workflow proof            | Ad hoc booleans spread across React                   | Pure Rust reducer + deterministic adapter; XState only for interaction projection                                          | The same failure/recovery semantics must be testable without Windows and authoritative outside the renderer. [VERIFIED: D-01, D-31–D-33; ASSUMED concrete split]                                                                                              |
| Dependency rollback       | “Undo everything” loop                                | Validated DAG + reverse affected closure                                                                                   | Locked behavior preserves independently verified operations. [VERIFIED: D-17]                                                                                                                                                                                 |
| IPC authorization         | Renderer flag or pipe-name secrecy                    | Explicit DACL, token/session/process verification, action-bound proof, nonce/counter/request ID, runtime schema validation | Named pipe defaults are too broad and replay must fail closed. [CITED: https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights; ASSUMED composed protocol]                                                                  |

**Key insight:** OS calls are not database transactions. Safety comes from durable intent, exact observation, narrow idempotency/preconditions, and explicit reconciliation—not from pretending the database can roll Windows back automatically. [VERIFIED: D-19, D-23, D-26–D-30]

## Common Pitfalls

### Pitfall 1: The Last Durable Intent Disappears on Power Loss

**What goes wrong:** Windows changes, but the latest `prepared` journal record was committed with WAL + `synchronous=NORMAL` and is lost after power failure. [CITED: https://sqlite.org/pragma.html]  
**Why it happens:** The existing evidence store correctly optimizes ordinary evidence with `NORMAL`; recovery has a different durability requirement. [VERIFIED: `apps/desktop/src-tauri/src/evidence_store.rs`]  
**How to avoid:** Use a dedicated recovery connection/database with `FULL`; verify pragmas; commit before every effect; inject `SQLITE_FULL`, `SQLITE_IOERR`, and crash boundaries. [CITED: https://www.sqlite.org/lang_transaction.html]  
**Warning signs:** Any broker call reachable before a successful journal commit, or tests that cover process crash but not host power loss/disk full. [ASSUMED test warning]

### Pitfall 2: LocalSystem Changes the Wrong User’s Power Scheme

**What goes wrong:** `PowerSetActiveScheme` is user-scoped, but the broker executes under a service account rather than the intended interactive user. [CITED: https://learn.microsoft.com/en-us/windows/win32/power/power-management-functions]  
**Why it happens:** Service identity and connected client identity differ. [CITED: https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-impersonatenamedpipeclient]  
**How to avoid:** Make user-context behavior a blocking spike; verify pipe client token/session and test observe/apply/restore against the same user in the clean VM. [ASSUMED implementation gate]  
**Warning signs:** Unit tests pass but the interactive user’s Control Panel still shows the old active scheme. [ASSUMED warning]

### Pitfall 3: TOCTOU Drift Between Review and Mutation

**What goes wrong:** Evidence or active state changes after approval, but the executor applies the stale request. [VERIFIED: D-05, D-16]  
**Why it happens:** Approval is stored as a UI boolean rather than bound to exact state. [ASSUMED root cause]  
**How to avoid:** Bind approval fingerprint to revision/evidence/risk/recovery state and re-observe immediately before broker mutation; mismatch pauses with an exact diff. [VERIFIED: D-05, D-16]  
**Warning signs:** Commands accept only `planId`, or broker commands have no expected-prior precondition. [ASSUMED warning]

### Pitfall 4: Duplicate Apply After Timeout or Reboot

**What goes wrong:** A completed mutation is issued again because the client did not receive/persist the response. [VERIFIED: D-19, D-21, D-23]  
**Why it happens:** Transport retry is mistaken for safe operation retry. [ASSUMED root cause]  
**How to avoid:** One-time transaction/step IDs, per-session nonce/counter, broker deduplication, deterministic target GUID, and observation-first reconciliation. [CITED: PowerDuplicateScheme docs; ASSUMED IPC details]  
**Warning signs:** Generic retry middleware wraps mutation commands. [ASSUMED warning]

### Pitfall 5: Restore Point “Success” Is Treated as Recovery Proof

**What goes wrong:** The API returns success but no new restore point was created due to the frequency rule, or System Restore is disabled. [CITED: https://learn.microsoft.com/en-us/windows/win32/api/srrestoreptapi/nf-srrestoreptapi-srsetrestorepointw]  
**Why it happens:** Only the Boolean return is checked. [ASSUMED root cause]  
**How to avoid:** Record sequence/status and verify availability; show `created`, `reused/skipped`, `disabled`, `failed`, or `unverified`; block according to locked risk policy. [VERIFIED: D-27; ASSUMED concrete enum]  
**Warning signs:** A single `restorePointReady: true` field. [ASSUMED warning]

### Pitfall 6: Partial Failure Rolls Back Too Much—or Too Little

**What goes wrong:** Independent verified work is lost, or a failed dependency leaves dependents active. [VERIFIED: D-17]  
**Why it happens:** Operations are treated as a flat list. [ASSUMED root cause]  
**How to avoid:** Validate DAG/group membership at composition and property-test reverse affected closure. [VERIFIED: D-15, D-17; ASSUMED test method]  
**Warning signs:** Rollback iterates `allApplied.reverse()` without a closure calculation. [ASSUMED warning]

### Pitfall 7: “Immutable” Means Only “The UI Has No Delete Button”

**What goes wrong:** Updates, migrations, or file tampering rewrite receipts or break the chain. [VERIFIED: D-29, D-30, D-32]  
**Why it happens:** Mutable status rows are treated as history. [ASSUMED root cause]  
**How to avoid:** Append events, reject update/delete through repository API and triggers, authenticate canonical event bytes and the previous MAC with HMAC-SHA-256, protect key epochs and the independent head anchor in Windows Credential Manager, verify chain + anchor on open, and keep derived projections rebuildable. Test an attacker rewriting the whole database and recomputing all unkeyed hashes. [RESOLVED by Plan 06-09]  
**Warning signs:** A receipt is updated from `pending` to `success`, or an actor who can rewrite SQLite can recompute every integrity value without protected key custody. [ASSUMED warning]

### Pitfall 8: Strong Authentication Is Only Session Metadata

**What goes wrong:** An old session labeled `passkey` authorizes a new high-risk plan. [VERIFIED: codebase grep shows projection-only desktop strength]  
**Why it happens:** Authentication strength is confused with fresh, action-scoped step-up. [ASSUMED root cause]  
**How to avoid:** Add a Phase 6 security spike and native proof boundary; bind proof to plan fingerprint/action/device/expiry and consume once. [ASSUMED concrete design]  
**Warning signs:** The renderer sends `strongAuth: true`, or authorization checks only `authenticationStrength`. [ASSUMED warning]

### Pitfall 9: Real and Simulated Authorities Bleed Together

**What goes wrong:** A production failure silently falls back to deterministic fixtures and displays fabricated progress/success. [VERIFIED: project fixture-guard policy]  
**Why it happens:** One adapter is selected by availability rather than explicit build/runtime identity. [VERIFIED: established Phase 1/5 concern]  
**How to avoid:** Closed adapter identity; production exposes only the power operation and fail-closed unavailable states; simulator is permitted only under explicit scenario markers/test roots. [VERIFIED: `AGENTS.md`; codebase patterns]  
**Warning signs:** `catch { return fixtureResult }`. [ASSUMED warning]

## Code Examples

Verified patterns from official sources and locked project decisions:

### Commit intent before the external effect

```rust
use rusqlite::{Connection, TransactionBehavior};

fn append_prepared(connection: &mut Connection, event: &PreparedEvent) -> rusqlite::Result<()> {
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    transaction.execute(
        "INSERT INTO journal_events
         (event_id, transaction_id, sequence, kind, canonical_json, previous_hash, event_hash)
         VALUES (?1, ?2, ?3, 'prepared', ?4, ?5, ?6)",
        event.sql_params(),
    )?;
    transaction.commit()
}
```

Source: SQLite transaction behavior and repository `EvidenceStore` pattern. The executor must not invoke the broker until this function returns success. [CITED: https://www.sqlite.org/lang_transaction.html; VERIFIED: codebase grep]

### Closed production operation registry

```rust
enum BrokerMutation {
    DuplicateManagedPowerScheme(DuplicateManagedPowerScheme),
    ActivatePowerScheme(ActivatePowerScheme),
    DeleteOwnedPowerScheme(DeleteOwnedPowerScheme),
    PrepareRestorePoint(PrepareRestorePoint),
}

fn dispatch(command: BrokerMutation) -> BrokerResult {
    match command {
        BrokerMutation::DuplicateManagedPowerScheme(value) => power::duplicate(value),
        BrokerMutation::ActivatePowerScheme(value) => power::activate(value),
        BrokerMutation::DeleteOwnedPowerScheme(value) => power::delete_owned(value),
        BrokerMutation::PrepareRestorePoint(value) => restore_point::prepare(value),
    }
}
```

Source: locked no-generic-RPC boundary. Do not add an “extreme” or generic command variant. [VERIFIED: `06-CONTEXT.md` D-09, D-11, D-31]

### Reconnect-safe ordered renderer subscription

```typescript
// Types are generated from TypeSpec; renderer state is a projection only.
const snapshot = await planAuthority.readExecution(transactionId);
setProjection(snapshot);

const unsubscribe = await planAuthority.subscribe(transactionId, (event) => {
  setProjection((current) =>
    event.sequence === current.sequence + 1
      ? reduceExecutionProjection(current, event)
      : current.markStale(),
  );
});
```

On `markStale`, refetch the native snapshot before showing further progress. Tauri recommends channels for ordered streaming and requires listener cleanup. [CITED: https://v2.tauri.app/develop/calling-frontend/]

### Power-scheme recovery precondition

```rust
match observe_active_scheme()? {
    current if current == journal.applied_scheme_guid => {
        set_active_scheme(journal.prior_scheme_guid)?;
        verify_active_scheme(journal.prior_scheme_guid)
    }
    current if current == journal.prior_scheme_guid => Ok(AlreadyRestored),
    current => Err(RecoveryConflict {
        previous: journal.prior_scheme_guid,
        applied: journal.applied_scheme_guid,
        observed: current,
    }),
}
```

Source: PowrProf active-scheme APIs and D-28 conflict rule. [CITED: https://learn.microsoft.com/en-us/windows/win32/power/managing-power-schemes; VERIFIED: `06-CONTEXT.md` D-28]

## State of the Art

| Old Approach                                                    | Current Approach                                                                                                              | When Changed                      | Impact                                                                                                                                                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview-only no-change receipts                                 | Real verified apply/restore receipts for one allowlisted power operation; deterministic preview remains a conformance adapter | Phase 6 boundary                  | Reuse the visual oracle but remove “simulated success” from production. [VERIFIED: codebase; `06-CONTEXT.md`]                                                                                  |
| `GetActivePwrScheme` / `SetActivePwrScheme` legacy indexed APIs | GUID-based `PowerGetActiveScheme` / `PowerSetActiveScheme`                                                                    | Windows Vista-era API replacement | GUIDs provide stable exact identity for journal/recovery. [CITED: https://learn.microsoft.com/en-us/windows/win32/api/powrprof/nf-powrprof-getactivepwrscheme]                                 |
| WAL + `synchronous=NORMAL` evidence persistence                 | Dedicated WAL + `synchronous=FULL` recovery authority                                                                         | Phase 6 durability requirement    | Latest prepared intent is synced at commit for power-loss durability. [CITED: https://sqlite.org/wal.html]                                                                                     |
| Global Tauri events for progress                                | Typed command + ordered Channel + authoritative snapshot on reconnect                                                         | Tauri 2 current guidance          | Avoid untyped/broadcast progress and recover from missed events. [CITED: https://v2.tauri.app/develop/calling-rust/]                                                                           |
| Boolean restore-point success                                   | Sequence/status plus verification and explicit unavailable/skipped states                                                     | Current Windows API behavior      | Avoids claiming recovery preparation when Windows did not create a new point. [CITED: https://learn.microsoft.com/en-us/windows/win32/api/srrestoreptapi/nf-srrestoreptapi-srsetrestorepointw] |

**Deprecated/outdated:**

- `GetActivePwrScheme` and `SetActivePwrScheme`: Microsoft directs Vista-and-later applications to the GUID-based Power APIs. [CITED: https://learn.microsoft.com/en-us/windows/win32/api/powrprof/nf-powrprof-getactivepwrscheme]
- Preview receipts with `changed: false` cannot satisfy PLAN-06/PLAN-07; retain them only for the deterministic adapter and visual scenarios. [VERIFIED: `packages/desktop-client/src/experience.ts`; `.planning/REQUIREMENTS.md`]
- `synchronous=NORMAL` is not appropriate for the recovery intent log because WAL commits can be lost on power failure. [CITED: https://sqlite.org/pragma.html]

## Assumptions Log

| #   | Claim                                                                                                                                       | Section                           | Risk if Wrong                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `windows-service` 0.8.1 is the approved broker-host dependency; slopcheck could not run.                                                    | Standard Stack / Package Audit    | A malicious or unsuitable dependency would compromise the privileged boundary; planner must block install on human verification. |
| A2  | The broker can safely execute user-scoped PowrProf calls under a verified impersonated client context.                                      | Architecture Pattern 6            | Wrong-user mutation or privilege confusion; mandatory VM spike must prove it.                                                    |
| A3  | A per-install authenticated IPC handshake can be designed without exposing reusable mutation authority to the renderer/same-user processes. | Architecture Pattern 6 / Security | Replay/spoofing risk; mandatory threat-model spike must specify secret custody and process identity checks.                      |
| A4  | The existing identity authority can issue a fresh action-scoped proof usable by the native plan executor.                                   | Pattern 1 / Pitfall 8             | High-risk confirmation would be only cosmetic; mandatory strong-auth spike must resolve the boundary.                            |
| A5  | Append-only HMAC-SHA-256 chaining with a required Windows Credential Manager key and externally stored head anchor is the local tamper-evidence design. | SQLite Authority | If key custody or recovery semantics fail, history remains readable for guided recovery but every new mutation fails closed; rotation and whole-history rewrite tests are mandatory. |
| A6  | The dedicated Phase 6 power scheme initially proves isolation/reversibility without making setting-level performance claims.                | Pattern 5                         | Product copy could overpromise; user/product owner should confirm the expected-impact wording.                                   |

## Open Questions (RESOLVED)

1. **How is the privileged client identity authenticated beyond the pipe DACL?**
   - What we know: explicit pipe ACLs, client-token impersonation, process/session inspection, runtime schema validation, and replay resistance are required. [CITED: Microsoft named-pipe docs; VERIFIED: `.planning/STATE.md`]
   - **RESOLVED by Plan 06-13:** use an explicit local-only pipe DACL plus impersonated token, logon SID, session, and process identity checks; authenticate canonical request bytes with per-install OS-protected material, a server nonce, monotonic counter, and one-time transaction/step ID; durably deduplicate before dispatch. Any identity, custody, replay, schema, or dedup failure blocks privileged mutation and downstream physical promotion. Authenticode publisher verification is additional packaged evidence, not a substitute for this protocol.

2. **How does desktop strong reauthentication produce a fresh action-scoped native proof?**
   - What we know: the desktop currently exposes session authentication strength, while existing action-scoped step-up patterns live in control-plane/admin code. [VERIFIED: codebase grep]
   - **RESOLVED by Plan 06-12:** reuse the Phase 4 cloud identity authority through the system browser and authenticated HTTPS. The server issues and atomically consumes a one-use proof bound to account, session, device, `apply-transactional-plan`, plan fingerprint, exact operation-version set, and a five-minute maximum lifetime. Native code reads the existing Windows Credential Manager session credential; React receives only state/next-action projections. New high-risk apply fails closed offline, while local recovery remains callable without proof per D-04.

3. **What exact configuration does `Liiiraa Verificado` contain in Phase 6?**
   - What we know: it must be a separate duplicated plan and the broad optimization catalog is Phase 7. [VERIFIED: D-03; Deferred Ideas]
   - **RESOLVED by Plan 06-15:** duplicate the exact active scheme into a deterministic owned GUID, name it `Liiiraa Verificado`, activate and re-observe it, then restore the exact prior GUID and delete only an unchanged owned target. Phase 6 changes no setting-level value and makes no performance-gain claim; such changes require separately versioned Phase 7 operations.

4. **Which restore-point failure states block Avançado versus Experimental?**
   - What we know: Experimental requires proven recovery; restore point is complementary and may block according to risk. [VERIFIED: D-11, D-27]
   - **RESOLVED by Plans 06-06 and 06-16:** Experimental blocks unless the operation manifest/rollback proof and an observed usable complementary restore point are both present. Avançado may proceed without the complementary point only when exact operation-manifest rollback is proven and the user explicitly acknowledges the unavailable second layer; disabled, safe-mode, frequency-skipped, begin/end failure, and unverified outcomes remain distinct evidence.

5. **Can the broker finish safely during Windows preshutdown without widening shutdown delays?**
   - What we know: SCM requires timely control handling and accurate checkpoints/wait hints; shutdown should minimize unsaved work. [CITED: https://learn.microsoft.com/en-us/windows/win32/services/multithreaded-services]
   - **RESOLVED by Plan 06-13:** handle preshutdown by atomically closing admission, allowing only the already-dispatched bounded call to reach its configured deadline, persisting its exact in-flight identity/reconciliation marker, and returning control without extending shutdown indefinitely. Next boot observes and reconciles before any new mutation.

## Environment Availability

| Dependency              | Required By                            | Available            | Version / Evidence                                                                                                                                                 | Fallback                                                                             |
| ----------------------- | -------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Project Node runtime    | TypeSpec, TS tests, generation         | ✓                    | `pnpm exec node` = 24.18.0 exact project pin; ambient `node` = 24.19.0. [VERIFIED: local commands/package.json]                                                    | Always run through pnpm/devEngines.                                                  |
| pnpm                    | Monorepo scripts                       | ✓                    | 11.17.0. [VERIFIED: local command]                                                                                                                                 | —                                                                                    |
| Rust / Cargo            | Native core and broker                 | ✓                    | rustc/cargo 1.97.1. [VERIFIED: local commands]                                                                                                                     | —                                                                                    |
| Windows host            | PowrProf, service, restore-point tests | ✓                    | Windows 11 Pro build 26200 x64. [VERIFIED: local CIM query]                                                                                                        | Clean VM and later physical matrix.                                                  |
| Hyper-V module/services | Clean Windows stage                    | Partially            | Hyper-V module present; `vmms` and `vmcompute` running. Current non-elevated shell cannot query VMs. [VERIFIED: local commands]                                    | Run existing lab scripts from an elevated checkpoint task.                           |
| Clean VM checkpoint     | D-01/D-02 VM stage                     | ✓ by persisted audit | `LiiiraaBoost-W11-25H2-Clean`, Gen 2, Secure Boot/TPM, checkpoint `Clean-Windows-Ready`. [VERIFIED: `C:\Users\Liiiraa\VM-Lab\Evidence\20260812-213313-audit.json`] | Re-audit elevated immediately before test.                                           |
| System Restore          | Advanced/Experimental preparation      | Unverified           | VSS providers exist but are stopped/manual; `Get-ComputerRestorePoint` returned access denied in current shell. [VERIFIED: local commands]                         | Explicit unavailable state; elevated VM spike; never rely on it as primary recovery. |
| Python/slopcheck        | Package legitimacy gate                | ✗                    | Python command absent; slopcheck could not install/run. [VERIFIED: local command]                                                                                  | Human verification checkpoint before `windows-service` install.                      |
| Docker                  | None; explicitly prohibited            | Not used             | Phase constraint forbids Docker. [VERIFIED: D-34]                                                                                                                  | Deterministic adapter + Hyper-V/physical Windows.                                    |

**Missing dependencies with no fallback:**

- Fresh action-scoped strong-auth native proof is not present; high-risk real execution must remain blocked until the spike supplies it. [VERIFIED: codebase grep; ASSUMED gate conclusion]
- Privileged IPC identity/replay protocol is not implemented; no broker mutation should be enabled before the security spike passes. [VERIFIED: `.planning/STATE.md`; ASSUMED gate conclusion]

**Missing dependencies with fallback:**

- Live Hyper-V inspection requires an elevated shell; persisted audit proves the lab exists, and an elevated checkpoint can revalidate it before destructive scenarios. [VERIFIED: local command and lab audit]
- System Restore availability is unknown in the current shell; deterministic unavailable states cover development, while elevated VM tests establish real behavior. [VERIFIED: local command; D-27]

## Validation Architecture

### Test Framework

| Property                       | Value                                                                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust unit/property             | Built-in `cargo test` + `proptest` 1.11.0. [VERIFIED: Cargo.toml]                                                                                                                   |
| TypeScript/component           | Vitest 4.1.10 through existing desktop/feature-shell scripts. [VERIFIED: package scripts]                                                                                           |
| Browser accessibility/journeys | Playwright 1.62.0 + existing axe helper and harness project. [VERIFIED: codebase grep]                                                                                              |
| Packaged Windows               | Existing `apps/desktop/tests/packaged` driver plus a new Phase 6 scenario family; real destructive proof runs in Hyper-V/physical checkpoints. [VERIFIED: codebase grep; D-01–D-02] |
| Config files                   | Existing package Vitest configs and `apps/desktop/playwright.config.ts`; Rust uses Cargo tests. [VERIFIED: codebase grep]                                                           |
| Quick run command              | `cargo test -p liiiraa-plan-engine` for the pure kernel; `pnpm --filter @liiiraa/feature-shell test -- --run -t "phase 6"` for UI policy. [ASSUMED future package/test names]       |
| Full suite command             | `pnpm verify:foundation && pnpm --filter @liiiraa/desktop test && cargo test --workspace` plus packaged/VM gates. [VERIFIED: root/desktop scripts; ASSUMED Phase 6 aggregation]     |

### TDD Plan Boundaries

Use one `type: tdd` plan per behavior-heavy feature: [VERIFIED: TDD guidance]

1. Plan revision/fingerprint and evidence invalidation. [VERIFIED: D-12, D-16]
2. Risk ceiling/proportional approval rules, including no Extremo transition. [VERIFIED: D-09–D-15]
3. Dependency closure and reverse rollback ordering. [VERIFIED: D-17]
4. Journal append/durability and migration upgrade. [VERIFIED: D-19, D-29, D-32]
5. Crash reconciliation reducer across every prepared/effect/observation boundary. [VERIFIED: D-19, D-23, D-28]
6. Deterministic adapter conformance and fault injection. [VERIFIED: D-01, D-06]
7. IPC authentication/replay rejection before the broker can mutate. [VERIFIED: `.planning/STATE.md`; ASSUMED exact test grouping]
8. Power-scheme observe/apply/restore adapter behind a fake PowrProf port, then Windows integration. [VERIFIED: D-03]

UI layout/composition, Tauri registration, capability config, and story wiring are standard tasks, but each receives focused component/browser tests after implementation. [VERIFIED: TDD guidance]

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                                    | Test Type                                     | Automated Command                                                            | File Exists?                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| PLAN-01 | Same goals/capabilities/evidence produce deterministic immutable plan; degraded evidence blocks             | Rust unit/property + adapter conformance      | `cargo test -p liiiraa-plan-engine plan_composition`                         | ❌ Wave 0                                                           |
| PLAN-02 | Add/remove/inspect creates new revision and preserves previous revision                                     | Rust unit + Vitest component                  | `cargo test -p liiiraa-plan-engine plan_revision`                            | ❌ Wave 0                                                           |
| PLAN-03 | Every operation field is contract-required and rendered in both locales                                     | Contract fixtures + Vitest + Playwright       | `pnpm --filter @liiiraa/feature-shell test -- --run -t "operation metadata"` | ❌ Wave 0; current simulated fields exist [VERIFIED: codebase grep] |
| PLAN-04 | Global policy is a ceiling; mixed plan inherits max risk; Extremo cannot execute                            | Rust property + Vitest interaction            | `cargo test -p liiiraa-plan-engine risk_policy`                              | ❌ Wave 0                                                           |
| PLAN-05 | Stale/wrong-action auth, missing recovery, changed fingerprint, and missing verification all block          | Rust unit/security + browser                  | `cargo test -p liiiraa-plan-engine approval`                                 | ❌ Wave 0                                                           |
| PLAN-06 | Prior state commits before call; apply/restore observe; disk-full/crash becomes recoverable unknown         | Rust integration/fault injection + migration  | `cargo test -p liiiraa-desktop --test recovery_store`                        | ❌ Wave 0                                                           |
| PLAN-07 | Individual/plan/checkpoint restore works after restart and conflicts pause                                  | Rust integration + packaged Windows + Hyper-V | `cargo test -p liiiraa-desktop --test recovery_executor`                     | ❌ Wave 0                                                           |
| PLAN-08 | Failure rolls back only affected closure, preserves independent verified nodes, exports redacted diagnostic | Rust property + adapter conformance + browser | `cargo test -p liiiraa-plan-engine partial_failure`                          | ❌ Wave 0                                                           |

### Fault-Injection Matrix

The deterministic adapter must have named failpoints before/after every durable or external boundary: before prepare insert, during commit (`BUSY`, `FULL`, `IOERR`), after prepare commit, before broker dispatch, broker timeout before/after effect, after effect before response, after response before observation append, during verification, during dependency rollback, during receipt append, renderer disconnect, process crash, Windows shutdown, and reboot reconciliation. [VERIFIED: D-19–D-23; CITED: SQLite transaction error docs; ASSUMED enumerated matrix]

For each failpoint assert: no blind retry, exact derived state, mutation gate status, affected dependency closure, immutable evidence retained, and deterministic next safe action. [VERIFIED: D-17, D-19–D-23, D-30]

### Four-Stage Promotion Matrix

| Stage                    | Gate                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic simulation | Complete prepare/apply/verify/restart/restore/verify with every fault branch and adapter conformance. [VERIFIED: D-01–D-02]                                                                                               |
| Clean Windows VM         | Restore `Clean-Windows-Ready`, install exact build, snapshot `LiiiraaBoost-Installed`, execute full real power cycle including reboot/crash/disk-full drills, and preserve evidence. [VERIFIED: lab artifacts; D-01–D-02] |
| Owner PC                 | Repeat only after the exact operation version passes VM; capture hardware/Windows identity and gaps without universal claims. [VERIFIED: D-01, D-35]                                                                      |
| Friends’ PCs             | Per-machine consented local redacted diagnostic package, preview before export; any failure blocks the version and a fix restarts at simulation. [VERIFIED: D-06–D-07, D-35]                                              |

Promotion state must be per exact operation version and monotonic; there is no manual override. [VERIFIED: D-06]

### Sampling Rate

- **Per TDD RED/GREEN/REFACTOR commit:** focused test command for that one feature, under 30 seconds where possible. [VERIFIED: TDD guidance]
- **Per standard UI task:** focused Vitest/component test plus lint/typecheck for touched package. [VERIFIED: project quality pattern]
- **Per wave merge:** `cargo test --workspace`, relevant package tests, TypeSpec generation/drift checks, and deterministic adapter conformance. [VERIFIED: repository scripts; ASSUMED phase aggregation]
- **Phase gate:** full repository suite green, packaged desktop journey green, then sequential simulation → VM → owner → friends evidence for the exact operation version. Physical gates cannot be parallelized or skipped. [VERIFIED: D-01–D-02, D-06]

### Wave 0 Gaps

- [ ] `packages/contracts-source/src/transactional-plans.tsp` plus valid/invalid cross-runtime corpus — PLAN-01 through PLAN-08.
- [ ] `crates/plan-engine/tests/{plan_revision,risk_policy,dependency_rollback,reconcile}.rs` — pure RED witnesses.
- [ ] `apps/desktop/src-tauri/tests/{recovery_store,recovery_executor,broker_protocol}.rs` — migration, durability, crash, IPC RED witnesses.
- [ ] `packages/desktop-client/src/plans.test.ts` — deterministic/production conformance and fixture guard.
- [ ] `packages/feature-shell/src/features/transactional-plans.test.tsx` — required fields, controls, risk groups, Recovery Center.
- [ ] `apps/desktop/tests/browser/transactional-plans.spec.ts` — keyboard, screen-reader semantics, reduced motion, drift/reconnect/recovery.
- [ ] `apps/desktop/tests/packaged/transactional-plans.ts` — packaged schema/command and real-Windows journey hooks.
- [ ] `architecture/module-boundaries.json` records for the pure engine and privileged broker before source files are added. [VERIFIED: project architecture gate]
- [ ] Human package-legitimacy checkpoint for `windows-service`. [ASSUMED due unavailable slopcheck]

## Security Domain

### Applicable ASVS Categories

| ASVS Category                 | Applies         | Standard Control                                                                                                                                                                              |
| ----------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication             | yes             | Fresh action-scoped passkey/MFA proof for Avançado/Experimental; never renderer Boolean. Recovery remains available without subscription/auth blockage. [VERIFIED: D-04, D-11, D-13–D-14]     |
| V3 Session Management         | yes             | Short-lived, device/action/fingerprint-bound, one-use proof reference; invalidate on evidence/security posture change. [VERIFIED: D-13, D-16; ASSUMED proof encoding]                         |
| V4 Access Control             | yes             | Closed operation/version registry, risk ceiling, beta visibility, no Extremo command, Tauri capability scoping, broker allowlist. [VERIFIED: D-09–D-15, D-31; CITED: Tauri capabilities docs] |
| V5 Input Validation           | yes             | TypeSpec-generated JSON Schema validation before generated transport mapping at renderer/Tauri and Tauri/broker boundaries. [VERIFIED: `AGENTS.md`; Phase 1 pattern]                          |
| V6 Cryptography               | yes             | Existing SHA-256/HMAC/keyring primitives for fingerprints, replay binding, and tamper-evident anchors; no custom cipher. [VERIFIED: local Cargo.toml; ASSUMED use]                            |
| V7 Error Handling and Logging | yes             | Bounded redacted diagnostics; exact technical cause in local receipt; no secret/raw hardware leakage. [VERIFIED: D-07, D-20, D-30, D-32]                                                      |
| V8 Data Protection            | yes             | Local-first journal, purpose-limited export preview/consent, secrets outside plaintext SQLite. [VERIFIED: D-07, D-32; `AGENTS.md`]                                                            |
| V13 API and Web Service       | yes (local IPC) | Explicit pipe DACL, verified client identity/session/process, local-only transport, nonce/counter/dedup, bounded messages. [CITED: Microsoft named-pipe docs; ASSUMED composed protocol]      |

### Known Threat Patterns for Tauri + Privileged Windows Broker

| Pattern                                         | STRIDE                  | Standard Mitigation                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spoofed same-machine pipe client                | Spoofing / Elevation    | Explicit service/logon SID DACL, reject remote clients, impersonate/check token and session/process, authenticated handshake; fail closed on any identity failure. [CITED: Microsoft named-pipe security/impersonation docs; ASSUMED full composition] |
| Replayed mutation request                       | Spoofing / Tampering    | Server nonce, monotonic counter, exact canonical request MAC, one-time transaction/step ID, durable dedup, observation-first retry. [ASSUMED mitigation; VERIFIED: D-23 requires behavior]                                                             |
| Renderer forges compatibility/risk/auth/success | Tampering / Elevation   | Native recomputation from registered operation version/evidence/proof; runtime contract validation; renderer only sends intent. [VERIFIED: project trust boundary; D-12, D-31–D-33]                                                                    |
| Journal edited or latest intent lost            | Tampering / Repudiation | FULL-durable append, domain-separated HMAC chain, Windows Credential Manager key epochs plus independent head anchor, whole-history rewrite tests, verify on open, and fail-closed mutation with readable recovery evidence on custody mismatch. [CITED: SQLite WAL/pragma docs; RESOLVED by Plan 06-09] |
| External Windows drift                          | Tampering               | Compare exact precondition immediately before apply/restore; pause and show requested/prior/observed diff. [VERIFIED: D-05, D-28]                                                                                                                      |
| Generic operation becomes arbitrary execution   | Elevation               | No command line, script, file/registry/service primitive, or remote operation; closed typed enum compiled into broker. [VERIFIED: D-08, D-31]                                                                                                          |
| Disk-full after OS effect                       | Denial / Repudiation    | Prepared intent already durable; mark executor unhealthy, block new mutation, reconcile by observation, export diagnostic. [VERIFIED: D-19–D-20; CITED: SQLite transaction errors]                                                                     |
| UI closes or misses progress                    | Denial / Repudiation    | Native executor continues; ordered channel is advisory; authoritative snapshot refetch on reopen/reconnect. [VERIFIED: D-24; CITED: Tauri channels docs]                                                                                               |
| Signed revocation abused for remote rollback    | Elevation               | Revocation only blocks new apply and warns; local recovery remains, no remote effect. [VERIFIED: D-08]                                                                                                                                                 |

## Sources

### Primary (HIGH confidence)

- `06-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `AGENTS.md` — locked scope, requirements, safety decisions, and project constraints.
- Phase 5 SPEC/CONTEXT and current TypeSpec/Tauri/feature-shell/evidence-store source — existing authority, UI oracle, contracts, SQLite policy, and test patterns. [VERIFIED: codebase grep/read]
- [Microsoft: Power Scheme Management](https://learn.microsoft.com/en-us/windows/win32/power/managing-power-schemes) — GUID identity, duplicate, activate, delete.
- [Microsoft: PowerDuplicateScheme](https://learn.microsoft.com/en-us/windows/win32/api/powrprof/nf-powrprof-powerduplicatescheme) — deterministic destination and return semantics.
- [Microsoft: PowerGetActiveScheme](https://learn.microsoft.com/en-us/windows/win32/api/powersetting/nf-powersetting-powergetactivescheme) — exact active GUID and memory ownership.
- [Microsoft: PowerWriteFriendlyName](https://learn.microsoft.com/en-us/windows/win32/api/powrprof/nf-powrprof-powerwritefriendlyname) — managed plan naming.
- [Microsoft: PowerSettingAccessCheckEx](https://learn.microsoft.com/en-us/windows/win32/api/powrprof/nf-powrprof-powersettingaccesscheckex) — policy/access preflight.
- [Microsoft: SRSetRestorePointW](https://learn.microsoft.com/en-us/windows/win32/api/srrestoreptapi/nf-srrestoreptapi-srsetrestorepointw) and [Using System Restore](https://learn.microsoft.com/en-us/windows/win32/sr/using-system-restore) — begin/end, COM, disabled/safe-mode, and frequency behavior.
- [Microsoft: Named Pipe Security](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights) and [ImpersonateNamedPipeClient](https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-impersonatenamedpipeclient) — ACL/client identity boundary.
- [SQLite WAL](https://sqlite.org/wal.html), [PRAGMA synchronous](https://sqlite.org/pragma.html), [Transactions](https://www.sqlite.org/lang_transaction.html), and [Foreign Keys](https://www.sqlite.org/foreignkeys.html) — durability, error, writer, and connection rules.
- [Tauri Calling Rust](https://v2.tauri.app/develop/calling-rust/), [Calling Frontend](https://v2.tauri.app/develop/calling-frontend/), and [Capabilities](https://v2.tauri.app/security/capabilities/) — commands, ordered channels, and webview permissions.
- [Microsoft-generated Rust bindings 0.62.2](https://microsoft.github.io/windows-docs-rs/) — exact Rust modules/signatures for Power and Restore.

### Secondary (MEDIUM confidence)

- [windows-service 0.8.1 docs](https://docs.rs/windows-service/0.8.1/windows_service/) and crates.io metadata — service lifecycle API/version/source. Package legitimacy remains `[ASSUMED]` because slopcheck was unavailable.
- Persisted Hyper-V lab audit at `C:\Users\Liiiraa\VM-Lab\Evidence\20260812-213313-audit.json` — VM/checkpoint existence; revalidate elevated before testing.

### Tertiary (LOW confidence)

- None. Unresolved design claims are recorded in the Assumptions Log rather than presented as authoritative.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH for existing pins and official Windows/SQLite/Tauri APIs; MEDIUM for `windows-service` legitimacy until human verification.
- Architecture: HIGH for renderer/core/storage separation and transaction/reconcile semantics because they are locked by context and existing patterns; MEDIUM for exact broker identity/user-context mechanism pending spikes.
- Pitfalls: HIGH for SQLite durability, Power/System Restore API behavior, drift/replay, and project-specific fixture risks; MEDIUM for proposed local audit anchoring.

**Research date:** 2026-08-12  
**Valid until:** 2026-09-11 for stable Win32/SQLite architecture; recheck Tauri/crate versions and Windows restore behavior immediately before implementation.
