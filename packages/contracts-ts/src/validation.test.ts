import { describe, expect, it } from 'vitest';

import {
  DIAGNOSTIC_VALUE_SCHEMA_ID,
  HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
  RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
  WEB_DOCUMENT_SCHEMA_ID,
  controlPlaneDocumentValidator,
  validateDiagnosticValue,
  validateHostToRendererShellEvent,
  validateRendererToHostShellCommand,
  validateWebDocument,
  type DiagnosticValueJson,
  type HostToRendererShellEventJson,
  type RendererToHostShellCommandJson,
  type WebDocument,
} from '@liiiraa/contracts-ts';
import invalidCorpus from '../../../contracts/corpus/invalid/rejection-vectors.json' with { type: 'json' };
import validCorpus from '../../../contracts/corpus/valid/provenance-vectors.json' with { type: 'json' };

describe('public diagnostic value validator', () => {
  it.each(validCorpus.vectors)('accepts $id through the package root', (vector) => {
    const result = validateDiagnosticValue(vector.schema, vector.payload);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const transport: DiagnosticValueJson = result.value;
      expect(transport).toEqual(vector.payload);
    }
  });

  it.each(invalidCorpus.vectors)('rejects $id through the package root', (vector) => {
    const result = validateDiagnosticValue(vector.schema, vector.payload);

    expect(result.ok).toBe(false);
  });

  it('returns bounded structural errors without payload values', () => {
    const secret = 'SENSITIVE_PAYLOAD_VALUE_MUST_NOT_LEAK';
    const result = validateDiagnosticValue(DIAGNOSTIC_VALUE_SCHEMA_ID, {
      kind: 'unavailable',
      reason: 'SYNTHETIC reason',
      unexpected: secret,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues.length).toBeLessThanOrEqual(8);
      expect(
        result.error.issues.every(
          (issue) => issue.path.length <= 256 && issue.keyword.length <= 64,
        ),
      ).toBe(true);
      expect(JSON.stringify(result.error)).not.toContain(secret);
    }
  });
});

const shellEnvelope = {
  schemaVersion: '1.0',
  requestId: 'request-shell-validation-0001',
  correlationId: 'correlation-shell-validation-0001',
  issuedAt: '2026-07-27T12:00:00.000Z',
} as const;

const validHostEvent = {
  ...shellEnvelope,
  messageType: 'desktop.shell.locale-changed.event',
  payload: {
    locale: 'pt-BR',
  },
} as const;

const validRendererCommand = {
  ...shellEnvelope,
  messageType: 'desktop.shell.show-notification.command',
  payload: {
    category: 'recovery-required',
    title: 'Recovery required',
    body: 'Review the recovery state.',
    action: {
      kind: 'goal',
      destination: 'recover',
    },
  },
} as const;

describe('shell messages', () => {
  it('accepts generated host events and renderer commands', () => {
    const hostResult = validateHostToRendererShellEvent(
      HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
      validHostEvent,
    );
    const commandResult = validateRendererToHostShellCommand(
      RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
      validRendererCommand,
    );

    expect(hostResult.ok).toBe(true);
    expect(commandResult.ok).toBe(true);

    if (hostResult.ok) {
      const event: HostToRendererShellEventJson = hostResult.value;
      expect(event).toEqual(validHostEvent);
    }
    if (commandResult.ok) {
      const command: RendererToHostShellCommandJson = commandResult.value;
      expect(command).toEqual(validRendererCommand);
    }
  });

  it.each([
    {
      name: 'unknown schema ID',
      schemaId: 'desktop.shell.unknown.v1',
      payload: validRendererCommand,
    },
    {
      name: 'unknown field',
      schemaId: RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
      payload: {
        ...validRendererCommand,
        unexpected: 'SENSITIVE_UNKNOWN_FIELD',
      },
    },
    {
      name: 'unknown discriminator',
      schemaId: RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
      payload: {
        ...validRendererCommand,
        messageType: 'desktop.shell.execute-arbitrary.command',
      },
    },
    {
      name: 'risky navigation',
      schemaId: RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
      payload: {
        ...validRendererCommand,
        messageType: 'desktop.shell.navigate.command',
        payload: {
          intent: {
            kind: 'documentation',
            documentId: '../../SENSITIVE_NAVIGATION_TARGET',
          },
        },
      },
    },
    {
      name: 'unsupported locale',
      schemaId: RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
      payload: {
        ...validRendererCommand,
        messageType: 'desktop.shell.set-locale.command',
        payload: {
          locale: 'fr-FR',
        },
      },
    },
    {
      name: 'non-opt-in tray behavior',
      schemaId: RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
      payload: {
        ...validRendererCommand,
        messageType: 'desktop.shell.set-tray-preference.command',
        payload: {
          preference: 'always-run-in-tray',
        },
      },
    },
    {
      name: 'unapproved notification category',
      schemaId: RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
      payload: {
        ...validRendererCommand,
        payload: {
          ...validRendererCommand.payload,
          category: 'marketing',
        },
      },
    },
  ])('rejects $name', ({ schemaId, payload }) => {
    const result = validateRendererToHostShellCommand(schemaId, payload);

    expect(result.ok).toBe(false);
  });

  it('returns deterministic bounded structural errors without payload values', () => {
    const secret = 'SENSITIVE_SHELL_PAYLOAD_VALUE_MUST_NOT_LEAK';
    const invalid = {
      ...validHostEvent,
      payload: {
        locale: 'fr-FR',
        unexpected: secret,
      },
    };

    const first = validateHostToRendererShellEvent(
      HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
      invalid,
    );
    const second = validateHostToRendererShellEvent(
      HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
      invalid,
    );

    expect(first).toEqual(second);
    expect(first.ok).toBe(false);
    if (!first.ok) {
      expect(first.error.issues.length).toBeGreaterThan(0);
      expect(first.error.issues.length).toBeLessThanOrEqual(8);
      expect(
        first.error.issues.every(
          (issue) => issue.path.length <= 256 && issue.keyword.length <= 64,
        ),
      ).toBe(true);
      expect(JSON.stringify(first.error)).not.toContain(secret);
      expect(JSON.stringify(first.error)).not.toContain('fr-FR');
    }
  });
});

const fixtureProvenance = {
  kind: 'fixture',
  value: 'deterministic-preview',
  scenarioId: 'web-document-validation',
  fixtureVersion: '1.0',
} as const;

const claimEvidence = {
  source: 'https://liiiraa.dev/docs/performance-methodology',
  provenance: fixtureProvenance,
  scope: 'Published performance methodology',
  applicableVersion: '1.0.0',
  validationState: 'validated',
  unproven: false,
} as const;

const routeDocument = {
  id: 'downloads',
  surface: 'public',
  shell: 'public',
  pathnameTemplate: '/[locale]/downloads',
  localePolicy: 'required',
  indexing: 'index',
  owner: 'web',
  scenarioRequirement: 'available',
  securityBoundary: 'public-origin',
  safeContextKeys: ['locale', 'version', 'channel'],
} as const;

const contentDocument = {
  id: 'performance-methodology',
  routeId: 'performance',
  locale: 'pt-BR',
  version: '1.0.0',
  channel: 'development',
  owner: 'web-content',
  lastReviewedAt: '2026-07-31T00:00:00.000Z',
  validationState: 'validated',
  evidence: [claimEvidence],
  indexing: 'index',
  staleTreatment: 'Mark stale content before it can support a claim.',
} as const;

const artifactEvidence = {
  publisher: 'Liiiraa Boost',
  sha256: 'a'.repeat(64),
  sizeBytes: '1024',
  signatureState: 'verified',
  origin: 'liiiraa-release-origin',
} as const;

const releaseDocument = {
  channel: 'development',
  version: '0.1.0',
  compatibility: ['Windows 10', 'Windows 11'],
  manifest: 'development-release-manifest',
  availability: 'unavailable',
  publicDistributionApproved: false,
  officialArtifact: 'unavailable',
  artifactEvidence,
} as const;

const authority = {
  phase: 'Phase 4',
  surface: 'account',
  command: 'request-subscription-change',
  description: 'Phase 4 authority is required for this operation.',
} as const;

const noChangeReceipt = {
  receiptVersion: '1.0',
  authority,
  requestedAction: 'subscription-change',
  reviewedInputs: ['plan', 'account'],
  reviewedAt: '2026-07-31T00:00:00.000Z',
  provenance: fixtureProvenance,
  remoteStateChanged: false,
  nextPhase: 'Phase 4',
  correlationId: 'web-receipt-correlation',
} as const;

const screenshotDocument = {
  version: '1.0',
  locale: 'en',
  scenarioId: 'downloads-default',
  viewport: '1440x900',
  captureCommand: 'pnpm evidence:capture',
  sourceCommit: 'abcdef1',
  checksum: 'b'.repeat(64),
  crop: 'full viewport',
  reviewState: 'approved',
} as const;

const adminAuditDocument = {
  eventId: 'audit-preview-0001',
  actor: 'fixture-admin',
  role: 'support-reviewer',
  action: 'review-subscription-change',
  redactedTarget: 'account:[redacted]',
  reason: 'Deterministic admin preview review.',
  occurredAt: '2026-07-31T00:00:00.000Z',
  result: 'simulated-no-change',
  correlationId: 'web-receipt-correlation',
  receipt: noChangeReceipt,
} as const;

describe('web document runtime validation', () => {
  it.each([
    ['route', routeDocument],
    ['content', contentDocument],
    ['release', releaseDocument],
    ['no-change receipt', noChangeReceipt],
    ['screenshot provenance', screenshotDocument],
    ['admin audit', adminAuditDocument],
  ])('accepts valid %s web document', (_name, input) => {
    const result = validateWebDocument(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const transport: WebDocument = result.value;
      expect(transport).toEqual(input);
    }
  });

  it.each([
    [
      'unknown field',
      {
        ...routeDocument,
        unexpected: 'SENSITIVE_UNKNOWN_VALUE',
      },
    ],
    [
      'invalid enum or literal',
      {
        ...routeDocument,
        surface: 'marketing',
      },
    ],
    [
      'missing distribution approval',
      {
        channel: releaseDocument.channel,
        version: releaseDocument.version,
        compatibility: releaseDocument.compatibility,
        manifest: releaseDocument.manifest,
        availability: releaseDocument.availability,
        officialArtifact: releaseDocument.officialArtifact,
        artifactEvidence,
      },
    ],
    [
      'missing artifact integrity',
      {
        ...artifactEvidence,
        sha256: undefined,
      },
    ],
    [
      'remote mutation claim',
      {
        ...noChangeReceipt,
        remoteStateChanged: true,
      },
    ],
    [
      'unsafe evidence URL',
      {
        ...claimEvidence,
        source: 'javascript:SENSITIVE_URL_VALUE',
      },
    ],
    [
      'oversized identifier',
      {
        ...routeDocument,
        id: `SENSITIVE_${'x'.repeat(129)}`,
      },
    ],
    [
      'fixture relabeled as measured',
      {
        ...claimEvidence,
        provenance: {
          ...fixtureProvenance,
          kind: 'measured',
        },
      },
    ],
  ])('rejects %s web document', (_name, input) => {
    expect(validateWebDocument(input).ok).toBe(false);
  });

  it('returns stable bounded structural errors without payload values', () => {
    const secret = 'SENSITIVE_WEB_DOCUMENT_VALUE_MUST_NOT_LEAK';
    const input = {
      ...routeDocument,
      id: secret,
      unexpected: secret,
    };

    const first = validateWebDocument(input);
    const second = validateWebDocument(input);

    expect(first).toEqual(second);
    expect(first.ok).toBe(false);
    if (!first.ok) {
      expect(first.error.code).toBe('PAYLOAD_INVALID');
      expect(first.error.schemaId).toBe(WEB_DOCUMENT_SCHEMA_ID);
      expect(first.error.issues.length).toBeGreaterThan(0);
      expect(first.error.issues.length).toBeLessThanOrEqual(8);
      expect(
        first.error.issues.every(
          (issue) =>
            issue.path.startsWith('$') &&
            issue.path.length <= 256 &&
            issue.keyword.length <= 64,
        ),
      ).toBe(true);
      expect(JSON.stringify(first.error)).not.toContain(secret);
    }
  });
});

const adminProjectionMetadata = {
  schemaVersion: '1.0',
  aggregateVersion: '7',
  etag: 'admin-etag-0007',
  correlationId: 'admin-correlation-0007',
  provenance: 'postgres-authority',
  environment: {
    environmentId: 'staging-brasil',
    kind: 'staging',
    label: 'Staging Brasil',
  },
  freshness: {
    state: 'live',
    source: 'admin-api',
    sequence: '42',
    observedAt: '2026-08-06T20:00:00.000Z',
  },
} as const;

const validAdminDocuments = [
  {
    ...adminProjectionMetadata,
    kind: 'admin-access-context-projection',
    actorId: 'administrator-0001',
    activeFunction: 'security',
    domains: ['overview', 'people', 'security', 'system'],
    capabilities: ['incident.review', 'access.recertify'],
    scopes: ['environment:staging', 'region:brasil'],
    authenticationStrength: 'passkey',
  },
  {
    ...adminProjectionMetadata,
    kind: 'admin-saved-view-projection',
    savedViewId: 'saved-view-0001',
    domain: 'people',
    name: 'Convites expirando',
    visibility: 'official',
    state: {
      filters: ['state:active', 'expiry:soon'],
      sort: ['expiresAt:asc'],
      tab: 'active',
      density: 'compact',
    },
  },
  {
    ...adminProjectionMetadata,
    kind: 'admin-inbox-item-projection',
    inboxItemId: 'inbox-0001',
    severity: 'warning',
    state: 'open',
    title: 'Revisar capacidade de convites',
    ownerReference: 'administrator-0001',
    relatedRecordReference: 'invitation-capacity-staging',
    deadlineAt: '2026-08-07T20:00:00.000Z',
    updatedAt: '2026-08-06T20:00:00.000Z',
  },
  {
    ...adminProjectionMetadata,
    kind: 'admin-invitation-projection',
    invitationId: 'invitation-0001',
    lifecycleState: 'active',
    recipientMasked: 'wa***@example.test',
    campaignReference: 'private-beta-01',
    locale: 'pt-BR',
    deliveryState: 'delivered',
    reminderCount: 1,
    ownerReference: 'administrator-0001',
    expiresAt: '2026-08-20T20:00:00.000Z',
    lastEventAt: '2026-08-06T20:00:00.000Z',
  },
  {
    ...adminProjectionMetadata,
    kind: 'admin-invitation-capacity-projection',
    capacityId: 'invitation-capacity-staging',
    activeCount: 18,
    activeLimit: 25,
    queuedCount: 4,
    forecastExhaustionAt: '2026-08-12T20:00:00.000Z',
  },
  {
    ...adminProjectionMetadata,
    kind: 'admin-governance-projection',
    governanceRecordId: 'approval-0001',
    governanceKind: 'approval',
    state: 'pending',
    risk: 'critical',
    authorReference: 'administrator-0001',
    beneficiaryReference: 'administrator-0002',
    eligibleApproverReferences: ['administrator-0003'],
    impactedReferences: ['scope:production-security'],
    expiresAt: '2026-08-06T20:15:00.000Z',
  },
  {
    ...adminProjectionMetadata,
    kind: 'admin-job-projection',
    jobId: 'job-0001',
    jobType: 'invitation-import',
    state: 'running',
    progressPercent: 40,
    totalItems: 25,
    completedItems: 10,
    failedItems: 0,
    ownerReference: 'administrator-0001',
    startedAt: '2026-08-06T19:59:00.000Z',
  },
  {
    ...adminProjectionMetadata,
    kind: 'admin-incident-projection',
    incidentId: 'incident-0001',
    severity: 'critical',
    state: 'contained',
    title: 'Entrega de convites degradada',
    ownerReference: 'administrator-0001',
    substituteReference: 'administrator-0002',
    affectedCapabilities: ['invitation.delivery'],
    impactReferences: ['provider:email'],
    nextUpdateAt: '2026-08-06T20:30:00.000Z',
  },
  {
    ...adminProjectionMetadata,
    kind: 'admin-configuration-projection',
    configurationId: 'invitation-reminder-policy',
    state: 'validated',
    version: 'policy-v3',
    cohortReference: 'private-beta',
    validationReference: 'validation-0003',
    rollbackVersion: 'policy-v2',
  },
  {
    ...adminProjectionMetadata,
    kind: 'admin-privacy-case-projection',
    privacyCaseId: 'privacy-case-0001',
    state: 'verified',
    requestType: 'access',
    subjectReference: 'account-0001',
    legalBasisReference: 'lgpd-access',
    dataCategoryReferences: ['identity', 'billing'],
    retentionReferences: ['invoice-retention'],
    ownerReference: 'administrator-0001',
  },
  {
    ...adminProjectionMetadata,
    kind: 'admin-partial-failure-projection',
    operationId: 'operation-0001',
    completedCount: 23,
    failedCount: 2,
    failures: [
      { recordReference: 'invitation-0024', code: 'provider-unavailable' },
      { recordReference: 'invitation-0025', code: 'conflict' },
    ],
  },
  {
    ...adminProjectionMetadata,
    kind: 'admin-operation-receipt',
    receiptId: 'receipt-0001',
    commandId: 'command-0001',
    outcome: 'partial',
    affectedReferences: ['invitation-0024', 'invitation-0025'],
    approvalReferences: ['approval-0001'],
    auditReference: 'audit-0001',
    recordedAt: '2026-08-06T20:01:00.000Z',
  },
  {
    schemaVersion: '1.0',
    kind: 'admin-operation-command',
    commandId: 'command-0001',
    actorId: 'administrator-0001',
    activeFunction: 'security',
    action: 'revoke-invitations',
    targetReferences: ['invitation-0024', 'invitation-0025'],
    reason: 'Delivery risk confirmed during private beta.',
    expectedVersion: '7',
    expectedEtag: 'admin-etag-0007',
    approvalReferences: ['approval-0001'],
    correlationId: 'admin-correlation-0007',
    requestedAt: '2026-08-06T20:00:30.000Z',
  },
] as const;

describe('generated Admin control-plane documents', () => {
  it.each(validAdminDocuments)('admits $kind through the generated runtime', (document) => {
    expect(controlPlaneDocumentValidator(document)).toBe(true);
  });

  it.each([
    ['unknown lifecycle state', { ...validAdminDocuments[3], lifecycleState: 'mystery' }],
    [
      'record outside admitted scope',
      { ...validAdminDocuments[5], visibility: 'hidden-scope' },
    ],
    [
      'unmasked recipient field',
      { ...validAdminDocuments[3], email: 'private@example.test' },
    ],
    [
      'unbounded collection',
      { ...validAdminDocuments[0], capabilities: Array.from({ length: 65 }, (_, i) => `c${i}`) },
    ],
    ['missing aggregate version', { ...validAdminDocuments[7], aggregateVersion: undefined }],
    [
      'personal or secret URL state',
      {
        ...validAdminDocuments[1],
        state: {
          ...validAdminDocuments[1].state,
          email: 'private@example.test',
          token: 'secret-token',
        },
      },
    ],
  ])('rejects %s', (_name, document) => {
    expect(controlPlaneDocumentValidator(document)).toBe(false);
  });
});
