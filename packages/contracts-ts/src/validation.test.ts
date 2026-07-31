import { describe, expect, it } from 'vitest';

import {
  DIAGNOSTIC_VALUE_SCHEMA_ID,
  HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
  RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
  WEB_DOCUMENT_SCHEMA_ID,
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
