import type { ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DownloadBlockedReason, DownloadDecision } from '@liiiraa/web-core';

import {
  DownloadDecisionView,
  getReleaseContent,
  getReleaseMetadata,
  ReleaseExperience,
  releaseBlockedReasonCopy,
  resolveDownloadPage,
  resolveReleasePage,
} from './features/releases';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;

const blockedReasons = [
  'artifact-unavailable',
  'channel-selection-blocked',
  'development-artifact-rejected',
  'distribution-not-approved',
  'historical-release-unavailable',
  'historical-release-unsafe',
  'integrity-disagreement',
  'official-artifact-unavailable',
  'record-invalid',
] as const satisfies readonly DownloadBlockedReason[];

describe('release content and routes', () => {
  it('admits bilingual parity against the generated fail-closed release record', () => {
    const english = getReleaseContent('en');
    const portuguese = getReleaseContent('pt-BR');
    const metadata = getReleaseMetadata();

    expect(english.channels.map(({ id }) => id)).toEqual(portuguese.channels.map(({ id }) => id));
    expect(english.verification.steps.map(({ id }) => id)).toEqual(
      portuguese.verification.steps.map(({ id }) => id),
    );
    expect(metadata.releaseRecord).toMatchObject({
      channel: 'stable',
      availability: 'unavailable',
      publicDistributionApproved: false,
      officialArtifact: 'unavailable',
    });
    expect(metadata.releaseRecord).not.toHaveProperty('artifactEvidence');
    expect(Object.isFrozen(english)).toBe(true);
    expect(Object.isFrozen(portuguese)).toBe(true);
    expect(Object.isFrozen(metadata)).toBe(true);
  });

  it('resolves only canonical release and fail-closed download routes', () => {
    expect(resolveReleasePage({ locale: 'pt-BR' })).toMatchObject({
      routeId: 'releases-index',
      channel: 'stable',
      version: 'current',
    });
    expect(
      resolveReleasePage({
        locale: 'en',
        release: ['stable', 'current', 'integrity'],
      }),
    ).toMatchObject({ routeId: 'releases-integrity' });
    expect(
      resolveDownloadPage({ channel: 'stable', locale: 'pt-BR', version: 'current' }),
    ).toMatchObject({ routeId: 'releases-download' });
    expect(resolveReleasePage({ locale: 'en', release: ['development'] })).toBeUndefined();
    expect(
      resolveDownloadPage({ channel: 'stable', locale: 'en', version: '0.0.0' }),
    ).toBeUndefined();
  });

  it('renders complete localized W07 and W08 information without an artifact link', () => {
    const w07 = resolveDownloadPage({ channel: 'stable', locale: 'pt-BR', version: 'current' });
    const w08 = resolveReleasePage({
      locale: 'en',
      release: ['stable', 'current', 'integrity'],
    });
    if (w07 === undefined || w08 === undefined) throw new Error('release scenario route missing');

    const markup = [
      renderToStaticMarkup(<ReleaseExperience resolution={w07} />),
      renderToStaticMarkup(<ReleaseExperience resolution={w08} />),
    ].join('\n');

    expect(markup).toContain('O download público está bloqueado');
    expect(markup).toContain('Every integrity disagreement blocks download');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('publicDistributionApproved');
    expect(markup).not.toMatch(/<a[^>]+download(?:=|\s|>)/iu);
    expect(markup).not.toMatch(/https?:\/\/[^"<]*\.(?:exe|msi|msix)/iu);
    expect(markup).not.toMatch(/continueAnyway|downloadUri|target\/release|phase-02/iu);
  });
});

describe('exhaustive DownloadDecision rendering', () => {
  it.each(blockedReasons)('renders %s as an assertive gate with no bypass', (reason) => {
    const content = getReleaseContent('en');
    const decision = {
      status: 'blocked',
      reason,
      historyState: 'current',
      verificationSteps: [],
      postDownloadGuidance: [],
    } as const satisfies DownloadDecision;

    const markup = renderToStaticMarkup(
      <DownloadDecisionView content={content} decision={decision} locale="en" />,
    );

    expect(markup).toContain(releaseBlockedReasonCopy(reason, content));
    expect(markup).toContain('role="alert"');
    expect(markup).not.toMatch(/<a[^>]+download(?:=|\s|>)/iu);
  });

  it('renders the forward-compatible available union only as verification guidance', () => {
    const decision = {
      status: 'available',
      channel: 'stable',
      historyState: 'current',
      artifact: { id: 'future-public-artifact', origin: 'liiiraa-download-origin' },
      verificationSteps: [],
      postDownloadGuidance: [
        'verify-before-running',
        'cancel-on-unexpected-warning',
        'contact-support-on-disagreement',
      ],
    } as const satisfies DownloadDecision;

    const markup = renderToStaticMarkup(
      <DownloadDecisionView content={getReleaseContent('en')} decision={decision} locale="en" />,
    );

    expect(markup).toContain('Eligibility verified at the distribution boundary');
    expect(markup).toContain('Independent verification');
    expect(markup).not.toMatch(/<a[^>]+download(?:=|\s|>)/iu);
  });
});
