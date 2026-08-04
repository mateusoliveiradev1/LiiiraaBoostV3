import type { ConsentStateJson, DiagnosticConsentJson } from '@liiiraa/contracts-ts';
import { describe, expect, it } from 'vitest';

const CONSENT_STREAM_RED_OWNER = '04-09-01';

const activeConsent = {
  schemaVersion: '1.0',
  aggregateVersion: '1',
  etag: 'consent-etag-1',
  correlationId: 'correlation-consent-1',
  provenance: 'postgres-authority',
  kind: 'diagnostic-consent',
  consentId: 'consent-synthetic-1',
  accountId: 'account-synthetic-1',
  state: 'active',
  scopes: ['support-diagnostics'],
  purpose: 'synthetic support diagnosis',
  grantedAt: '2026-08-04T18:00:00Z',
  expiresAt: '2026-08-07T18:00:00Z',
} as const satisfies DiagnosticConsentJson;

const consentStreamMatrix = [
  {
    id: 'in-flight-revocation-abort',
    triggerState: 'revoked' as ConsentStateJson,
    behavior:
      'revocation notification during an active operator stream must abort server delivery and signal the client to clear rendered data immediately',
  },
  {
    id: 'in-flight-expiry-abort',
    triggerState: 'expired' as ConsentStateJson,
    behavior:
      'consent expiry at a chunk boundary must stop the active stream before another diagnostic byte reaches the operator',
  },
  {
    id: 'private-no-store-response',
    triggerState: 'active' as ConsentStateJson,
    behavior:
      'an admitted diagnostic response must be private and Cache-Control no-store with no durable object URL, download, export, clipboard, or service-worker authority',
  },
  {
    id: 'temporary-buffer-disposal',
    triggerState: 'revoked' as ConsentStateJson,
    behavior:
      'revocation or expiry must zero or discard server buffers and clear usable client copies after the stream aborts',
  },
  {
    id: 'immutable-access-audit',
    triggerState: 'active' as ConsentStateJson,
    behavior:
      'each admitted field access must append a bounded immutable receipt naming actor, case, purpose, field class, consent version, and access window',
  },
  {
    id: 'revocation-preserves-audit',
    triggerState: 'revoked' as ConsentStateJson,
    behavior:
      'revocation must terminate access and dispose temporary data without erasing the immutable record of already admitted access',
  },
] as const;

const expectedConsentStreamRed = (id: string, behavior: string): never => {
  throw new Error(`EXPECTED_RED[${CONSENT_STREAM_RED_OWNER}][${id}]: ${behavior}`);
};

describe('diagnostic consent stream pre-implementation lifecycle matrix', () => {
  it.each(consentStreamMatrix)('$id', ({ id, triggerState, behavior }) => {
    expect(activeConsent.scopes).toContain('support-diagnostics');
    expect(['active', 'revoked', 'expired']).toContain(triggerState);
    expectedConsentStreamRed(id, behavior);
  });
});
