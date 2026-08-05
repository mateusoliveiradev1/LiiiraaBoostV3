import type { AuditAnchorPort } from '@liiiraa/control-plane-application';
import { describe, expect, it } from 'vitest';

import {
  assertSeparatedAuditAnchorCustody,
  runAuditAnchorWorkerOnce,
  type AuditAnchorWorkerDependencies,
} from '../../workers/audit-anchors.js';

describe('audit anchor fail-visible health', () => {
  it('does not allow a forged adapter success to mark an unverified anchor healthy', async () => {
    const health: { healthy: boolean; code?: string }[] = [];
    const forgedPort = {
      write: () =>
        Promise.resolve({
          ok: true,
          verified: false,
          anchor: {
            schemaVersion: '1.0',
            kind: 'audit-anchor',
            streamId: 'admin-security',
            segmentId: 'segment-1',
            sequenceNumber: 1_000,
            eventHash: 'a'.repeat(64),
            segmentStartedAt: '2026-08-05T12:00:00.000Z',
            anchoredAt: '2026-08-05T12:15:00.000Z',
            eventCount: 1_000,
            checksum: 'b'.repeat(64),
            signature: 'forged',
            signatureAlgorithm: 'ECDSA_SHA_256',
            signingKeyId: 'ordinary-api-role',
            objectKey: 'forged',
            retainUntil: '2031-08-05T12:15:00.000Z',
          },
          objectVersion: 'forged',
        }),
      read: () => Promise.reject(new Error('not-called')),
    } as unknown as AuditAnchorPort;
    const dependencies: AuditAnchorWorkerDependencies = {
      port: forgedPort,
      repository: {
        claimDue: () =>
          Promise.resolve([
            {
              claimId: 'claim-forged',
              attemptCount: 0,
              streamId: 'admin-security',
              segmentId: 'segment-1',
              segmentStartedAt: '2026-08-05T12:00:00.000Z',
              lastAnchoredAt: '2026-08-05T12:00:00.000Z',
              lastAnchoredSequence: 0,
              eventsSinceAnchor: 1_000,
              head: {
                streamId: 'admin-security',
                lastSequence: 1_000,
                lastHash: 'a'.repeat(64),
              },
            },
          ]),
        persistReceipt: () => Promise.reject(new Error('forged receipt must not persist')),
        recordAnchorFailure: (_claimId, failure) => {
          health.push({ healthy: false, code: failure.code });
          return Promise.resolve();
        },
        claimVerification: () => Promise.resolve([]),
        recordVerification: () => Promise.resolve(),
      },
    };

    await expect(
      runAuditAnchorWorkerOnce(dependencies, {
        now: '2026-08-05T12:15:00.000Z',
        workerId: 'ordinary-api-worker',
      }),
    ).resolves.toEqual({ anchored: 0, claimed: 1, failed: 1, retried: 0 });
    expect(health).toEqual([{ healthy: false, code: 'ANCHOR_INVALID' }]);
  });

  it('exposes no signing, deletion, retention-shortening, or health-override authority', () => {
    const custody = assertSeparatedAuditAnchorCustody({
      apiRole: 'ordinary-api-role',
      signingRole: 'audit-signing-role',
      storageRole: 'audit-storage-role',
    });
    expect(Object.keys(custody)).toEqual(['apiRole', 'signingRole', 'storageRole']);
    expect(JSON.stringify(custody)).not.toMatch(/delete|sign\(|shorten|markHealthy|privateKey/iu);
  });
});
