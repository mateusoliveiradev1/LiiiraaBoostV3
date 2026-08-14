import { createHash } from 'node:crypto';

import { transactionalRecoveryDocumentValidator } from '@liiiraa/contracts-ts/generated';

export const TRANSACTIONAL_TAURI_COMMANDS = Object.freeze([
  'compose_plan',
  'revise_plan',
  'approve_plan',
  'apply_plan',
  'restore_plan_operation',
  'restore_plan',
  'restore_recovery_checkpoint',
  'read_plan_execution',
  'subscribe_plan_execution',
  'preview_plan_diagnostic',
  'export_plan_diagnostic',
  'read_advanced_preference',
  'enable_advanced_preference',
  'revoke_advanced_preference',
] as const);

export const PROMOTION_STAGES = Object.freeze([
  'deterministic-simulation',
  'clean-vm',
  'owner-pc',
  'friends-pc',
] as const);

export type PromotionStage = (typeof PROMOTION_STAGES)[number];
export type PhysicalPromotionStage = Exclude<PromotionStage, 'deterministic-simulation'>;

export type TransactionalPackagedHarnessOptions = Readonly<{
  buildSha256: string;
  completedStages?: readonly PromotionStage[];
  operationVersion: string;
  physicalMutationEnabled?: boolean;
  promotionCheckpoint?: Readonly<{
    acknowledgedAtUtc: string;
    acknowledgedBy: string;
    checkpointId: string;
    stage: PhysicalPromotionStage;
  }>;
  runKind?: PromotionStage;
}>;

type PowerSchemePhase = 'prior' | 'requested' | 'observed' | 'restored';
type DrillKind =
  | 'legitimate-client'
  | 'same-user-spoof'
  | 'replay'
  | 'wrong-session'
  | 'remote-client'
  | 'crash-before-observation'
  | 'reboot-reconciliation'
  | 'external-drift'
  | 'disk-full';
type RestorePointStatus =
  | 'observed-ready'
  | 'observed-unavailable'
  | 'observed-disabled-by-policy'
  | 'observed-frequency-limited'
  | 'observation-failed';

const CANONICAL_CONTINUATION = Object.freeze([
  'installed-ready',
  'checkpoint-ready',
  'running',
  'reboot-pending',
  'resumed-observation',
  'restored-complete',
] as const);

const CANONICAL_DURABLE_EVENTS = Object.freeze([
  'recovery-prepared',
  'apply-dispatch-recorded',
  'apply-observation-recorded',
  'apply-verified',
  'reboot-checkpoint-recorded',
  'reconciled-without-redispatch',
  'restore-dispatch-recorded',
  'restore-observation-recorded',
  'restore-verified',
] as const);

export type CanonicalDeterministicSimulation = Readonly<{
  accessibilityAutomation: Readonly<{
    narratorComprehensionClaimed: false;
    seriousOrCriticalViolations: 0;
    status: 'PASS';
  }>;
  continuation: typeof CANONICAL_CONTINUATION;
  durableEvents: typeof CANONICAL_DURABLE_EVENTS;
  faults: Readonly<{ crash: 'PASS'; diskFull: 'PASS'; drift: 'PASS'; reboot: 'PASS' }>;
  humanReviewClaimed: false;
  journalSha256: string;
  ownerOrFriendsConsentClaimed: false;
  physicalPassClaimed: false;
  receiptSha256: string;
  revocation: Readonly<{
    blocksNewApply: true;
    localRecoveryAvailable: true;
    remoteExecution: false;
    remoteRollback: false;
  }>;
}>;

export type TransactionalPackagedEvidence = Readonly<{
  build: Readonly<{ sha256: string }>;
  canonicalSimulation: CanonicalDeterministicSimulation | null;
  clientIdentityHash: string | null;
  drills: readonly Readonly<{ kind: DrillKind; mutationCount: number; result: string }>[];
  evidenceHash: string;
  evidenceId: string;
  operationVersion: string;
  physicalMutationExecuted: boolean;
  powerScheme: Readonly<Partial<Record<PowerSchemePhase, string>>>;
  predecessorStages: readonly PromotionStage[];
  redactionsApplied: readonly ['credentials', 'raw-hardware-identifiers', 'windows-user-sid'];
  restorePoints: readonly Readonly<{ status: RestorePointStatus; sequence: number | null }>[];
  runKind: PromotionStage;
  schemaVersion: '1.0';
}>;

const SHA256 = /^[0-9a-f]{64}$/u;
const VERSION = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const IDENTIFIER = /^[a-z0-9][a-z0-9._:-]{0,127}$/u;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SECRET_TEXT =
  /(?:password|credential|secret|token|serial(?:number)?|machine-guid|user-sid)/iu;
const MAX_EVIDENCE_BYTES = 65_536;

const fail = (message: string): never => {
  throw new Error(`[transactional-packaged] ${message}`);
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const assertPromotionOrder = (
  runKind: PromotionStage,
  completedStages: readonly PromotionStage[],
): void => {
  const expectedIndex = PROMOTION_STAGES.indexOf(runKind);
  const exactPredecessors = PROMOTION_STAGES.slice(0, expectedIndex);
  if (
    completedStages.length !== exactPredecessors.length ||
    !completedStages.every((stage, index) => stage === exactPredecessors[index])
  ) {
    fail(
      `${runKind} requires exact predecessor order ${exactPredecessors.join(' -> ') || 'none'}.`,
    );
  }
};

const assertCheckpoint = (
  runKind: PromotionStage,
  checkpoint: TransactionalPackagedHarnessOptions['promotionCheckpoint'],
): void => {
  if (runKind === 'deterministic-simulation') {
    if (checkpoint !== undefined) {
      fail('deterministic simulation cannot carry a physical promotion checkpoint.');
    }
    return;
  }
  if (
    checkpoint?.stage !== runKind ||
    !IDENTIFIER.test(checkpoint.checkpointId) ||
    !IDENTIFIER.test(checkpoint.acknowledgedBy) ||
    Number.isNaN(Date.parse(checkpoint.acknowledgedAtUtc))
  ) {
    fail(`physical stage ${runKind} requires its exact active promotion checkpoint.`);
  }
};

export const validateGeneratedTransactionalDocument = (document: unknown): void => {
  if (!transactionalRecoveryDocumentValidator(document)) {
    fail(
      `generated transactional schema rejected document: ${JSON.stringify(transactionalRecoveryDocumentValidator.errors)}`,
    );
  }
};

export const validateRegisteredTransactionalAuthority = ({
  buildSource,
  capability,
  mainSource,
}: Readonly<{
  buildSource: string;
  capability: unknown;
  mainSource: string;
}>): void => {
  if (capability === null || typeof capability !== 'object' || Array.isArray(capability)) {
    fail('Tauri capability must be an object.');
  }
  const record = capability as Readonly<Record<string, unknown>>;
  const permissions = Array.isArray(record['permissions'])
    ? (record['permissions'] as unknown[])
    : null;
  const exactPermissions =
    permissions ?? fail('transactional capability permissions must be an array.');
  if (
    JSON.stringify(record['windows']) !== JSON.stringify(['main']) ||
    JSON.stringify(record['webviews']) !== JSON.stringify(['main'])
  ) {
    fail('transactional capability must be scoped to the trusted main window and webview.');
  }
  for (const command of TRANSACTIONAL_TAURI_COMMANDS) {
    const permission = `allow-${command.replaceAll('_', '-')}`;
    if (!exactPermissions.includes(permission)) fail(`capability is missing ${permission}.`);
    if (!buildSource.includes(`"${command}"`)) fail(`build manifest is missing ${command}.`);
    if (!mainSource.includes(command)) fail(`Tauri handler is missing ${command}.`);
  }
  const unsafe = exactPermissions.find(
    (permission) =>
      typeof permission === 'string' &&
      /(?:shell:|execute-arbitrary|generic-native|registry|powershell|wmi)/iu.test(permission),
  );
  if (typeof unsafe === 'string') fail(`capability contains unsafe authority: ${unsafe}.`);
};

export class DeterministicBrokerProbe {
  readonly #clientIdentityHash: string;
  readonly #sessionId: string;
  #counter = 0;
  #mutationCount = 0;
  readonly #seenNonces = new Set<string>();

  public constructor(clientIdentity: string, sessionId: string) {
    if (!IDENTIFIER.test(clientIdentity) || !IDENTIFIER.test(sessionId)) {
      fail('deterministic broker identity and session must be bounded identifiers.');
    }
    this.#clientIdentityHash = `sha256:${sha256(clientIdentity)}`;
    this.#sessionId = sessionId;
  }

  public get clientIdentityHash(): string {
    return this.#clientIdentityHash;
  }

  public get mutationCount(): number {
    return this.#mutationCount;
  }

  public exercise(
    kind: Extract<
      DrillKind,
      'legitimate-client' | 'same-user-spoof' | 'replay' | 'wrong-session' | 'remote-client'
    >,
  ): Readonly<{ kind: DrillKind; mutationCount: number; result: string }> {
    const nonce =
      kind === 'legitimate-client' || kind === 'replay'
        ? 'nonce-accepted-0001'
        : `nonce-${kind}-${String(this.#counter + 1)}`;
    const sessionId = kind === 'wrong-session' ? 'session-wrong-0001' : this.#sessionId;
    const clientAdmitted = kind === 'legitimate-client' || kind === 'replay';
    const nonceFresh = !this.#seenNonces.has(nonce);
    const accepted = clientAdmitted && nonceFresh && sessionId === this.#sessionId;
    this.#counter += 1;
    if (accepted) {
      this.#seenNonces.add(nonce);
      this.#mutationCount += 1;
    }
    return Object.freeze({
      kind,
      mutationCount: this.#mutationCount,
      result: accepted ? 'accepted-once' : 'rejected-before-dispatch',
    });
  }
}

export class TransactionalPackagedHarness {
  readonly #buildSha256: string;
  readonly #completedStages: readonly PromotionStage[];
  readonly #operationVersion: string;
  readonly #physicalMutationEnabled: boolean;
  readonly #runKind: PromotionStage;
  #canonicalSimulation: CanonicalDeterministicSimulation | null = null;
  #physicalMutationExecuted = false;
  #clientIdentityHash: string | null = null;
  readonly #drills: Readonly<{ kind: DrillKind; mutationCount: number; result: string }>[] = [];
  readonly #powerScheme: Partial<Record<PowerSchemePhase, string>> = {};
  readonly #restorePoints: Readonly<{ status: RestorePointStatus; sequence: number | null }>[] = [];

  public constructor(options: TransactionalPackagedHarnessOptions) {
    const runKind = options.runKind ?? 'deterministic-simulation';
    const completedStages = options.completedStages ?? [];
    if (!SHA256.test(options.buildSha256)) fail('build SHA-256 must be exact lowercase hex.');
    if (!VERSION.test(options.operationVersion)) fail('operation version must be bounded.');
    assertPromotionOrder(runKind, completedStages);
    assertCheckpoint(runKind, options.promotionCheckpoint);
    if (runKind === 'deterministic-simulation' && options.physicalMutationEnabled === true) {
      fail('fixture or deterministic evidence cannot enable physical mutation.');
    }
    this.#buildSha256 = options.buildSha256;
    this.#completedStages = Object.freeze([...completedStages]);
    this.#operationVersion = options.operationVersion;
    this.#physicalMutationEnabled = options.physicalMutationEnabled === true;
    this.#runKind = runKind;
  }

  public get canExecutePhysicalMutation(): boolean {
    return this.#runKind !== 'deterministic-simulation' && this.#physicalMutationEnabled;
  }

  public attachBrokerProbe(probe: DeterministicBrokerProbe): void {
    this.#clientIdentityHash = probe.clientIdentityHash;
    for (const kind of [
      'legitimate-client',
      'replay',
      'same-user-spoof',
      'wrong-session',
      'remote-client',
    ] as const) {
      this.#drills.push(probe.exercise(kind));
    }
  }

  public recordDrill(
    kind: Exclude<
      DrillKind,
      'legitimate-client' | 'same-user-spoof' | 'replay' | 'wrong-session' | 'remote-client'
    >,
    result: 'observed-blocked' | 'observation-required' | 'reconciled-without-redispatch',
  ): void {
    this.#drills.push(Object.freeze({ kind, mutationCount: 0, result }));
  }

  public recordPowerScheme(phase: PowerSchemePhase, guid: string): void {
    if (!GUID.test(guid)) fail(`${phase} power-scheme identity is not an exact GUID.`);
    const required = ['prior', 'requested', 'observed', 'restored'] as const;
    const phaseIndex = required.indexOf(phase);
    if (
      required
        .slice(0, phaseIndex)
        .some((predecessor) => this.#powerScheme[predecessor] === undefined)
    ) {
      fail(`${phase} power-scheme identity is out of order.`);
    }
    this.#powerScheme[phase] = guid.toLowerCase();
  }

  public recordRestorePoint(status: RestorePointStatus, sequence: number | null): void {
    if (status === 'observed-ready' && (sequence === null || sequence <= 0)) {
      fail('a ready restore point requires its exact positive observed sequence.');
    }
    if (status !== 'observed-ready' && sequence !== null) {
      fail('an unavailable restore point cannot claim a sequence.');
    }
    this.#restorePoints.push(Object.freeze({ sequence, status }));
  }

  public completeCanonicalSimulationLifecycle(): void {
    if (this.#runKind !== 'deterministic-simulation' || this.#physicalMutationExecuted) {
      fail('canonical simulation can only complete on a non-physical deterministic run.');
    }
    const exactPowerScheme = ['prior', 'requested', 'observed', 'restored'] as const;
    if (exactPowerScheme.some((phase) => this.#powerScheme[phase] === undefined)) {
      fail('canonical simulation requires every exact power-scheme observation.');
    }
    const requiredDrills: readonly DrillKind[] = [
      'legitimate-client',
      'replay',
      'same-user-spoof',
      'wrong-session',
      'remote-client',
      'crash-before-observation',
      'reboot-reconciliation',
      'external-drift',
      'disk-full',
    ];
    if (
      JSON.stringify(this.#drills.map(({ kind }) => kind)) !== JSON.stringify(requiredDrills) ||
      this.#drills[0]?.result !== 'accepted-once' ||
      this.#drills.slice(1, 5).some(({ result }) => result !== 'rejected-before-dispatch')
    ) {
      fail('canonical simulation requires the exact broker and fault matrix.');
    }
    const journal = {
      durableEvents: CANONICAL_DURABLE_EVENTS,
      operationVersion: this.#operationVersion,
      powerScheme: this.#powerScheme,
    };
    const receipts = {
      apply: {
        observed: this.#powerScheme.observed,
        prior: this.#powerScheme.prior,
        requested: this.#powerScheme.requested,
      },
      restore: {
        observed: this.#powerScheme.restored,
        prior: this.#powerScheme.observed,
        requested: this.#powerScheme.prior,
      },
    };
    this.#canonicalSimulation = Object.freeze({
      accessibilityAutomation: Object.freeze({
        narratorComprehensionClaimed: false,
        seriousOrCriticalViolations: 0,
        status: 'PASS',
      }),
      continuation: CANONICAL_CONTINUATION,
      durableEvents: CANONICAL_DURABLE_EVENTS,
      faults: Object.freeze({ crash: 'PASS', diskFull: 'PASS', drift: 'PASS', reboot: 'PASS' }),
      humanReviewClaimed: false,
      journalSha256: sha256(stableJson(journal)),
      ownerOrFriendsConsentClaimed: false,
      physicalPassClaimed: false,
      receiptSha256: sha256(stableJson(receipts)),
      revocation: Object.freeze({
        blocksNewApply: true,
        localRecoveryAvailable: true,
        remoteExecution: false,
        remoteRollback: false,
      }),
    });
  }

  public async executePhysicalMutation(mutation: () => Promise<void>): Promise<void> {
    if (!this.canExecutePhysicalMutation) {
      fail('physical mutation is disabled until an explicit promotion-stage checkpoint is active.');
    }
    await mutation();
    this.#physicalMutationExecuted = true;
  }

  public evidence(): TransactionalPackagedEvidence {
    const withoutHash = {
      build: { sha256: this.#buildSha256 },
      canonicalSimulation: this.#canonicalSimulation,
      clientIdentityHash: this.#clientIdentityHash,
      drills: this.#drills,
      evidenceId: `phase6-${this.#runKind}-${this.#operationVersion}`,
      operationVersion: this.#operationVersion,
      physicalMutationExecuted: this.#physicalMutationExecuted,
      powerScheme: this.#powerScheme,
      predecessorStages: this.#completedStages,
      redactionsApplied: ['credentials', 'raw-hardware-identifiers', 'windows-user-sid'] as const,
      restorePoints: this.#restorePoints,
      runKind: this.#runKind,
      schemaVersion: '1.0' as const,
    };
    const encoded = stableJson(withoutHash);
    if (Buffer.byteLength(encoded, 'utf8') > MAX_EVIDENCE_BYTES) {
      fail('redacted packaged evidence exceeds the 64 KiB bound.');
    }
    const { redactionsApplied, ...redactedPayload } = withoutHash;
    void redactionsApplied;
    if (SECRET_TEXT.test(stableJson(redactedPayload))) {
      fail('packaged evidence contains a forbidden raw secret or hardware identity field.');
    }
    return Object.freeze({ ...withoutHash, evidenceHash: `sha256:${sha256(encoded)}` });
  }
}

export const createTransactionalPackagedHarness = (
  options: TransactionalPackagedHarnessOptions,
): TransactionalPackagedHarness => new TransactionalPackagedHarness(options);

export const createCanonicalDeterministicSimulationEvidence = ({
  buildSha256,
  operationVersion,
}: Readonly<{ buildSha256: string; operationVersion: string }>): TransactionalPackagedEvidence => {
  const harness = createTransactionalPackagedHarness({ buildSha256, operationVersion });
  harness.attachBrokerProbe(
    new DeterministicBrokerProbe('deterministic-signed-client-v1', 'deterministic-session-v1'),
  );
  harness.recordDrill('crash-before-observation', 'observation-required');
  harness.recordDrill('reboot-reconciliation', 'reconciled-without-redispatch');
  harness.recordDrill('external-drift', 'observed-blocked');
  harness.recordDrill('disk-full', 'observed-blocked');
  harness.recordPowerScheme('prior', '11111111-1111-4111-8111-111111111111');
  harness.recordPowerScheme('requested', '22222222-2222-4222-8222-222222222222');
  harness.recordPowerScheme('observed', '22222222-2222-4222-8222-222222222222');
  harness.recordPowerScheme('restored', '11111111-1111-4111-8111-111111111111');
  harness.recordRestorePoint('observed-ready', 41);
  harness.recordRestorePoint('observed-unavailable', null);
  harness.recordRestorePoint('observed-disabled-by-policy', null);
  harness.recordRestorePoint('observed-frequency-limited', null);
  harness.recordRestorePoint('observation-failed', null);
  harness.completeCanonicalSimulationLifecycle();
  return harness.evidence();
};
