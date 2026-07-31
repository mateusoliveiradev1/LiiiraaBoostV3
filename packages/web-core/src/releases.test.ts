import { describe, expect, it } from 'vitest';

import {
  decideDownload,
  selectReleaseChannel,
  verifyReleaseIntegrity,
  type InspectedReleaseArtifact,
  type ReleaseManifestEvidence,
} from './releases.js';

const publishedReleaseRecord = {
  channel: 'stable',
  version: '1.0.0',
  compatibility: ['Windows 10', 'Windows 11'],
  manifest: 'stable-current',
  availability: 'unavailable',
  publicDistributionApproved: false,
  officialArtifact: 'unavailable',
} as const;

const futureManifest = {
  manifestId: 'future-public-manifest',
  artifactId: 'future-public-artifact',
  channel: 'stable',
  version: '1.0.0',
  architecture: 'x86_64-pc-windows-msvc',
  windowsLifecycle: ['windows-10-supported', 'windows-11-supported'],
  compatibility: ['Windows 10', 'Windows 11'],
  publisher: 'Liiiraa Boost',
  sha256: 'a'.repeat(64),
  sizeBytes: '4096',
  signatureState: 'verified',
  origin: 'liiiraa-download-origin',
  provenance: 'public-trust-production',
  publicDistributionApproved: true,
  artifactAvailable: true,
  downloadUri: 'https://download.liiiraa.com/artifacts/future-public-artifact',
} as const satisfies ReleaseManifestEvidence;

const futureArtifact = {
  ...futureManifest,
  artifactName: 'future-public-artifact',
  sourcePath: 'official/future-public-artifact',
  trustClass: 'public-trust-production',
} as const satisfies InspectedReleaseArtifact;

describe('fail-closed release decision', () => {
  it('defaults to stable and requires explicit channel acknowledgements', () => {
    expect(selectReleaseChannel()).toEqual({
      status: 'selected',
      channel: 'stable',
      policy: {
        audience: 'general',
        risk: 'standard',
        support: 'supported',
        updates: 'stable-only',
      },
    });

    expect(selectReleaseChannel({ requested: 'beta' })).toEqual({
      status: 'blocked',
      requested: 'beta',
      reason: 'beta-opt-in-required',
    });
    expect(
      selectReleaseChannel({ requested: 'beta', betaOptIn: true }),
    ).toMatchObject({
      status: 'selected',
      channel: 'beta',
      policy: {
        audience: 'opted-in-testers',
        risk: 'pre-release',
        support: 'best-effort',
        updates: 'beta-track',
      },
    });

    expect(selectReleaseChannel({ requested: 'experimental' })).toEqual({
      status: 'blocked',
      requested: 'experimental',
      reason: 'experimental-policy-acknowledgement-required',
    });
    expect(
      selectReleaseChannel({
        requested: 'experimental',
        experimentalAcknowledgement: {
          risk: 'high-change',
          audience: 'hardware-enthusiasts',
          support: 'limited',
          updates: 'manual-only',
        },
      }),
    ).toMatchObject({
      status: 'selected',
      channel: 'experimental',
      policy: {
        risk: 'high-change',
        audience: 'hardware-enthusiasts',
        support: 'limited',
        updates: 'manual-only',
      },
    });

    expect(selectReleaseChannel({ requested: 'development' })).toEqual({
      status: 'blocked',
      requested: 'development',
      reason: 'development-channel-not-public',
    });
  });

  it.each([
    ['manifestId', { manifestId: 'other-manifest' }],
    ['artifactId', { artifactId: 'other-artifact' }],
    ['channel', { channel: 'beta' }],
    ['version', { version: '1.0.1' }],
    ['architecture', { architecture: 'aarch64-pc-windows-msvc' }],
    ['windowsLifecycle', { windowsLifecycle: ['windows-11-supported'] }],
    ['compatibility', { compatibility: ['Windows 11'] }],
    ['publisher', { publisher: 'Unknown Publisher' }],
    ['sha256', { sha256: 'b'.repeat(64) }],
    ['sizeBytes', { sizeBytes: '4097' }],
    ['signatureState', { signatureState: 'mismatch' }],
    ['origin', { origin: 'https://mirror.invalid' }],
    ['provenance', { provenance: 'unknown' }],
    ['publicDistributionApproved', { publicDistributionApproved: false }],
    ['artifactAvailable', { artifactAvailable: false }],
    ['downloadUri', { downloadUri: 'https://mirror.invalid/setup.exe' }],
  ] as const)(
    'blocks a %s disagreement without disclosing compared values',
    (field, mutation) => {
      const result = verifyReleaseIntegrity(futureManifest, {
        ...futureArtifact,
        ...mutation,
      } as InspectedReleaseArtifact);

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.disagreements.map((item) => item.field)).toContain(field);
      expect(JSON.stringify(result)).not.toContain('Unknown Publisher');
      expect(JSON.stringify(result)).not.toContain('mirror.invalid');
      expect(
        result.disagreements.every(
          (item) =>
            item.manifestValueClass.length > 0 &&
            item.artifactValueClass.length > 0,
        ),
      ).toBe(true);
    },
  );

  it.each([
    {
      artifactName: 'Liiiraa Boost_0.0.0_x64-setup.exe',
      sourcePath:
        'target/release/bundle/nsis/Liiiraa Boost_0.0.0_x64-setup.exe',
      trustClass: 'self-signed-development',
    },
    {
      artifactName: 'liiiraa-desktop.exe',
      sourcePath: 'quality/evidence/phase-02/staged/liiiraa-desktop.exe',
      trustClass: 'self-signed-untrusted-root',
    },
    {
      artifactName: 'future-public-artifact',
      sourcePath: 'ci/output/future-public-artifact',
      trustClass: 'ci',
    },
  ] as const)(
    'hard-rejects Phase 2 and development artifact identities',
    (developmentIdentity) => {
      const result = verifyReleaseIntegrity(futureManifest, {
        ...futureArtifact,
        ...developmentIdentity,
      });

      expect(result).toMatchObject({
        ok: false,
        classification: 'development-artifact',
      });
    },
  );

  it('keeps the published Phase 3 record blocked for distribution approval', () => {
    const decision = decideDownload({
      record: publishedReleaseRecord,
      channelSelection: selectReleaseChannel(),
      historyState: 'current',
    });

    expect(decision).toEqual({
      status: 'blocked',
      reason: 'distribution-not-approved',
      historyState: 'current',
      verificationSteps: [],
      postDownloadGuidance: [],
    });
    expect(decision).not.toHaveProperty('downloadUri');
    expect(decision).not.toHaveProperty('continueAnyway');
  });

  it('does not let approval, artifact, or schema mutations bypass generated validation', () => {
    const mutations: readonly unknown[] = [
      { ...publishedReleaseRecord, publicDistributionApproved: true },
      { ...publishedReleaseRecord, officialArtifact: 'available' },
      {
        ...publishedReleaseRecord,
        publicDistributionApproved: true,
        officialArtifact: 'available',
        artifactEvidence: {
          publisher: futureManifest.publisher,
          sha256: futureManifest.sha256,
          sizeBytes: futureManifest.sizeBytes,
          signatureState: futureManifest.signatureState,
          origin: futureManifest.origin,
        },
      },
      {
        channel: publishedReleaseRecord.channel,
        version: publishedReleaseRecord.version,
        compatibility: publishedReleaseRecord.compatibility,
        manifest: publishedReleaseRecord.manifest,
        availability: publishedReleaseRecord.availability,
        officialArtifact: publishedReleaseRecord.officialArtifact,
      },
    ];

    for (const record of mutations) {
      expect(
        decideDownload({
          record,
          channelSelection: selectReleaseChannel(),
          historyState: 'current',
          manifest: futureManifest,
          artifact: futureArtifact,
        }),
      ).toMatchObject({
        status: 'blocked',
        reason: 'record-invalid',
      });
    }
  });

  it('blocks unsafe or unavailable history without encouraging downgrade', () => {
    for (const historyState of ['unsafe', 'unavailable'] as const) {
      const decision = decideDownload({
        record: publishedReleaseRecord,
        channelSelection: selectReleaseChannel(),
        historyState,
      });

      expect(decision).toMatchObject({
        status: 'blocked',
        reason: `historical-release-${historyState}`,
        historyState,
      });
      expect(decision).not.toHaveProperty('downgrade');
      expect(decision).not.toHaveProperty('downloadUri');
    }
  });

  it('accepts matching future evidence only at the integrity boundary', () => {
    expect(verifyReleaseIntegrity(futureManifest, futureArtifact)).toEqual({
      ok: true,
      classification: 'verified',
    });

    const currentContractDecision = decideDownload({
      record: {
        ...publishedReleaseRecord,
        publicDistributionApproved: true,
        officialArtifact: 'available',
      },
      channelSelection: selectReleaseChannel(),
      historyState: 'current',
      manifest: futureManifest,
      artifact: futureArtifact,
    });

    expect(currentContractDecision).toMatchObject({
      status: 'blocked',
      reason: 'record-invalid',
    });
  });
});
