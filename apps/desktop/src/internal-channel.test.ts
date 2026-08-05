// @ts-expect-error -- Vitest runs this contract in Node; the browser app intentionally excludes Node globals.
import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const repositoryRoot = new URL('../../..', import.meta.url);
const runtimeUrl = new URL('./staging-runtime.ts', import.meta.url);
const schemaUrl = new URL('../staging/internal-channel.schema.json', import.meta.url);
const manifestUrl = new URL('../staging/internal-channel.json', import.meta.url);
const overlayUrl = new URL('../src-tauri/tauri.staging.conf.json', import.meta.url);
const changeNotesUrl = new URL('../staging/CHANGE-NOTES.md', import.meta.url);
const validatorUrl = new URL('../scripts/validate-internal-channel.mjs', import.meta.url);
const workflowUrl = new URL('.github/workflows/phase-4-surfaces.yml', repositoryRoot);

const SHA256 = 'a'.repeat(64);

const manifest = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  schemaVersion: '1.0',
  channel: 'internal',
  buildNumber: 23_001,
  buildId: 'internal-023001',
  commit: '51770454aa1d17647c4fe734ae1e57f3e0b403b0',
  digest: `sha256:${SHA256}`,
  checksum: SHA256,
  accessScope: 'invited-pcs',
  changeNotes: 'CHANGE-NOTES.md',
  rollbackBuildId: 'internal-023000',
  apiOrigin: 'https://liiiraa-api-staging.onrender.com',
  apiVersion: 'v1',
  contractVersion: '1.0',
  entitlementKeyId: 'staging-entitlement-current',
  artifact: {
    availability: 'not-published',
    fileName: 'Liiiraa Boost Internal 023001_x64-setup.exe',
    format: 'nsis',
    signingClass: 'self-signed-development',
  },
  sbom: { digest: `sha256:${'b'.repeat(64)}`, format: 'spdx-json' },
  provenance: {
    attested: false,
    digest: `sha256:${'c'.repeat(64)}`,
    kind: 'github-actions-slsa',
  },
  trust: {
    distributionAllowed: false,
    productionReady: false,
    publicDownload: false,
    publicTrust: false,
    smartScreenReputation: false,
  },
  ...overrides,
});

const runtimeModule = async () => {
  expect(existsSync(runtimeUrl)).toBe(true);
  if (!existsSync(runtimeUrl)) return undefined;
  return import(runtimeUrl.href);
};

describe('internal-channel manifest contract', () => {
  it('requires a closed schema, one manifest, change notes, and a CI validator', () => {
    for (const artifact of [schemaUrl, manifestUrl, overlayUrl, changeNotesUrl, validatorUrl]) {
      expect(existsSync(artifact)).toBe(true);
    }
    if (!existsSync(schemaUrl)) return;
    const schema = JSON.parse(readFileSync(schemaUrl, 'utf8')) as {
      additionalProperties?: boolean;
      properties?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
      required?: readonly string[];
    };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties?.['channel']?.['const']).toBe('internal');
    expect(schema.required).toEqual(
      expect.arrayContaining([
        'buildNumber',
        'buildId',
        'commit',
        'digest',
        'checksum',
        'accessScope',
        'changeNotes',
        'rollbackBuildId',
        'apiVersion',
        'contractVersion',
      ]),
    );
    if (!existsSync(manifestUrl)) return;
    const checkedInManifest = JSON.parse(readFileSync(manifestUrl, 'utf8')) as {
      commit?: string;
    };
    expect(checkedInManifest.commit).toBe('51770454aa1d17647c4fe734ae1e57f3e0b403b0');
  });

  it('admits one exact restricted runtime and visibly identifies its numbered build', async () => {
    const runtime = await runtimeModule();
    if (runtime === undefined) return;
    expect(
      runtime.admitStagingRuntime(manifest(), {
        apiOrigin: 'https://liiiraa-api-staging.onrender.com',
        apiVersion: 'v1',
        contractVersion: '1.0',
        entitlementKeyIds: ['staging-entitlement-current'],
      }),
    ).toEqual({
      ok: true,
      value: expect.objectContaining({
        badge: 'Internal #023001',
        buildId: 'internal-023001',
        channel: 'internal',
      }),
    });
  });

  it.each([
    ['missing identity', { buildId: undefined }],
    ['Stable channel', { channel: 'stable' }],
    ['Beta channel', { channel: 'beta' }],
    ['Experimental channel', { channel: 'experimental' }],
    ['public access', { accessScope: 'public' }],
    ['mutable rollback', { rollbackBuildId: 'internal-023001' }],
    ['trusted publisher claim', { trust: { ...manifest().trust, publicTrust: true } }],
    ['public download claim', { trust: { ...manifest().trust, publicDownload: true } }],
    ['production-ready claim', { trust: { ...manifest().trust, productionReady: true } }],
    ['distribution claim', { trust: { ...manifest().trust, distributionAllowed: true } }],
    ['wrong API authority', { apiOrigin: 'https://api.liiiraa.com' }],
    ['wrong contract', { contractVersion: '2.0' }],
    ['wrong key', { entitlementKeyId: 'production-key' }],
  ])('rejects %s', async (_name, override) => {
    const runtime = await runtimeModule();
    if (runtime === undefined) return;
    const candidate = manifest(override) as Record<string, unknown>;
    if ('buildId' in override && override.buildId === undefined) delete candidate['buildId'];
    expect(
      runtime.admitStagingRuntime(candidate, {
        apiOrigin: 'https://liiiraa-api-staging.onrender.com',
        apiVersion: 'v1',
        contractVersion: '1.0',
        entitlementKeyIds: ['staging-entitlement-current'],
      }),
    ).toMatchObject({ ok: false });
  });

  it('requires monotonic build numbering and selects rollback by immutable identity', async () => {
    const runtime = await runtimeModule();
    if (runtime === undefined) return;
    const current = manifest();
    const previous = manifest({
      buildId: 'internal-023000',
      buildNumber: 23_000,
      checksum: 'd'.repeat(64),
      digest: `sha256:${'d'.repeat(64)}`,
      rollbackBuildId: 'internal-022999',
    });
    expect(runtime.admitInternalChannelManifest(current, [previous])).toMatchObject({ ok: true });
    expect(
      runtime.admitInternalChannelManifest(current, [
        manifest({ buildId: 'internal-023000', buildNumber: 23_001 }),
      ]),
    ).toMatchObject({ ok: false });
    expect(runtime.selectRollbackManifest(current, [previous])).toEqual(previous);
    expect(runtime.selectRollbackManifest(current, [])).toBeUndefined();
    expect(runtime.internalManifestIdentity(previous)).not.toBe(
      runtime.internalManifestIdentity(current),
    );
  });

  it('keeps the Tauri overlay and CI projection restricted and production-distinct', () => {
    expect(existsSync(overlayUrl)).toBe(true);
    expect(existsSync(workflowUrl)).toBe(true);
    if (!existsSync(overlayUrl)) return;
    const overlay = JSON.parse(readFileSync(overlayUrl, 'utf8')) as {
      identifier?: string;
      productName?: string;
      plugins?: Readonly<Record<string, unknown>>;
    };
    const serializedOverlay = JSON.stringify(overlay);
    expect(overlay.identifier).toBe('com.liiiraa.boost.internal');
    expect(overlay.productName).toContain('Internal #023001');
    expect(serializedOverlay).toContain('"channel":"internal"');
    expect(serializedOverlay).toContain('"publicTrust":false');
    expect(serializedOverlay).toContain('"productionReady":false');
    expect(serializedOverlay).not.toMatch(/"channel":"(?:stable|beta|experimental)"/iu);

    const workflow = readFileSync(workflowUrl, 'utf8');
    expect(workflow).toContain('--channel internal');
    expect(workflow).toContain('--build-id internal-023001');
    expect(workflow).toContain('--rollback-build-id internal-023000');
    expect(workflow).toContain('environment: desktop-internal');
    expect(workflow).not.toContain('--channel stable');
    expect(workflow).not.toContain('--channel beta');
  });

  it('keeps the checked-in manifest admitted by the same runtime used in CI', async () => {
    const runtime = await runtimeModule();
    if (runtime === undefined || !existsSync(manifestUrl)) return;
    const checkedInManifest = JSON.parse(readFileSync(manifestUrl, 'utf8')) as unknown;
    expect(
      runtime.admitStagingRuntime(checkedInManifest, {
        apiOrigin: 'https://liiiraa-api-staging.onrender.com',
        apiVersion: 'v1',
        contractVersion: '1.0',
        entitlementKeyIds: ['staging-entitlement-current'],
      }),
    ).toMatchObject({ ok: true });
  });
});
