import { describe, expect, it } from 'vitest';

import {
  DIAGNOSTIC_VALUE_SCHEMA_ID,
  HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
  RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
  validateDiagnosticValue,
  validateHostToRendererShellEvent,
  validateRendererToHostShellCommand,
  type DiagnosticValueJson,
  type HostToRendererShellEventJson,
  type RendererToHostShellCommandJson,
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
