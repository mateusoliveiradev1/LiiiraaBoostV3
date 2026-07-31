import { describe, expect, it } from 'vitest';

import { validateWebDocument } from '@liiiraa/web-core';

import {
  FUTURE_AUTHORITY_ACTION_FAMILIES,
  createWebPreviewAuthority,
  type FutureAuthorityActionFamily,
} from './no-change-adapter.ts';
import { getWebScenario } from './scenarios.ts';

const accountScenario = getWebScenario('W13');
const adminScenario = getWebScenario('W14');

const commandFor = (
  family: FutureAuthorityActionFamily,
  surface: 'account' | 'admin' = 'account',
) =>
  ({
    phase: 'Phase 4',
    surface,
    command: `${family}.review`,
    description: `Reviewed ${family} preview boundary`,
  }) as const;

const createAdapter = (
  correlationIds = FUTURE_AUTHORITY_ACTION_FAMILIES.map(
    (family) => `correlation-${family}`,
  ),
) =>
  createWebPreviewAuthority({
    scenario: accountScenario,
    clock: () => accountScenario.clock,
    correlationIds,
  });

describe('no-change authority', () => {
  it('returns a schema-valid deterministic no-change receipt for every action family', async () => {
    for (const family of FUTURE_AUTHORITY_ACTION_FAMILIES) {
      const surface = family === 'admin' ? 'admin' : 'account';
      const authority = createWebPreviewAuthority({
        scenario: family === 'admin' ? adminScenario : accountScenario,
        clock: () => accountScenario.clock,
        correlationIds: [`correlation-${family}`],
      });
      const result = await authority.execute({
        command: commandFor(family, surface),
        disposition: 'confirm',
        reviewedInputs: [`${family}-field-reviewed`],
      });

      expect(result.kind).toBe('no-change');
      if (result.kind !== 'no-change') {
        continue;
      }
      expect(validateWebDocument(result.receipt)).toMatchObject({ ok: true });
      expect(result.receipt).toMatchObject({
        authority: {
          phase: 'Phase 4',
          surface,
          command: `${family}.review`,
        },
        requestedAction: `${family}.review`,
        remoteStateChanged: false,
        nextPhase: 'Phase 4',
        provenance: {
          kind: 'fixture',
          value: 'SIMULATED SCENARIO',
          scenarioId: family === 'admin' ? 'W14' : 'W13',
        },
      });
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.receipt)).toBe(true);
    }
  });

  it('returns a distinct cancellation receipt without presenting cancellation as success', async () => {
    const result = await createAdapter(['correlation-cancel']).execute({
      command: commandFor('privacy'),
      disposition: 'cancel',
      reviewedInputs: ['privacy-request-reviewed'],
    });

    expect(result).toMatchObject({
      kind: 'cancelled',
      receipt: {
        receiptKind: 'cancelled',
        reason: 'user-cancelled',
        correlationId: 'correlation-cancel',
        remoteStateChanged: false,
        nextPhase: 'Phase 4',
      },
    });
    expect(JSON.stringify(result)).not.toContain('"kind":"no-change"');
  });

  it.each(['OFFLINE', 'AUTHORITY_UNAVAILABLE'] as const)(
    'keeps %s failure terminal and no-change',
    async (failureCode) => {
      const result = await createAdapter([`correlation-${failureCode}`]).execute(
        {
          command: commandFor('support'),
          disposition: 'failure',
          failureCode,
          reviewedInputs: ['support-request-reviewed'],
        },
      );

      expect(result).toMatchObject({
        kind: 'failure',
        code: failureCode,
        remoteStateChanged: false,
        nextPhase: 'Phase 4',
      });
      expect(result).not.toHaveProperty('receipt');
    },
  );

  it('fails closed for aborted and invalid commands', async () => {
    const controller = new AbortController();
    controller.abort();
    const aborted = await createAdapter(['correlation-abort']).execute({
      command: commandFor('device'),
      disposition: 'confirm',
      reviewedInputs: ['device-review'],
      signal: controller.signal,
    });

    const invalid = await createAdapter(['correlation-invalid']).execute({
      command: {
        phase: 'Phase 4',
        surface: 'account',
        command: 'unknown.review',
        description: 'Unknown authority family',
      },
      disposition: 'confirm',
      reviewedInputs: ['unknown-review'],
    });

    expect(aborted).toMatchObject({
      kind: 'failure',
      code: 'ABORTED',
      remoteStateChanged: false,
    });
    expect(invalid).toMatchObject({
      kind: 'failure',
      code: 'INVALID_COMMAND',
      remoteStateChanged: false,
    });
  });

  it('preserves only reviewed identifiers and never carries mutation data', async () => {
    const result = await createAdapter(['correlation-redacted']).execute({
      command: commandFor('billing'),
      disposition: 'confirm',
      reviewedInputs: ['plan-id-reviewed', 'billing-period-reviewed'],
    });

    expect(JSON.stringify(result)).not.toMatch(
      /customer|payment-token|card-number|user@example|remoteStateChanged":true/iu,
    );
    expect(result).toMatchObject({
      kind: 'no-change',
      receipt: {
        reviewedInputs: ['plan-id-reviewed', 'billing-period-reviewed'],
      },
    });
  });
});
