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
const visibleText = (markup: string): string =>
  markup
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

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
  it('explains download availability in plain language before release mechanics', () => {
    const pt = resolveReleasePage({ locale: 'pt-BR' });
    const en = resolveReleasePage({ locale: 'en' });
    if (pt === undefined || en === undefined) throw new Error('release index route missing');

    const ptMarkup = renderToStaticMarkup(<ReleaseExperience resolution={pt} />);
    const enMarkup = renderToStaticMarkup(<ReleaseExperience resolution={en} />);

    expect(visibleText(ptMarkup)).toContain('O app para Windows ainda não está disponível');
    expect(visibleText(enMarkup)).toContain('The Windows app is not available yet');
    expect(visibleText(ptMarkup)).toContain('Quando estará disponível');
    expect(visibleText(ptMarkup)).toContain('Como conferir a segurança');
    expect(visibleText(ptMarkup)).not.toContain('Status do download');
    expect(ptMarkup).toContain('release-visitor-actions');
    expect(enMarkup).toContain('release-visitor-actions');
    expect(ptMarkup.indexOf('release-state-header')).toBeLessThan(
      ptMarkup.indexOf('release-technical-context'),
    );
  });

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

    expect(markup).toContain('Ainda não há um instalador público');
    expect(markup).toContain('Em preparação');
    expect(markup).not.toContain('>Bloqueado<');
    expect(markup).toContain('Every integrity disagreement blocks download');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('publicDistributionApproved');
    expect(markup).not.toMatch(/<a[^>]+download(?:=|\s|>)/iu);
    expect(markup).not.toMatch(/https?:\/\/[^"<]*\.(?:exe|msi|msix)/iu);
    expect(markup).not.toMatch(/continueAnyway|downloadUri|target\/release|phase-02/iu);
  });

  it('leads W07 and W08 with the human decision and keeps machine evidence secondary', () => {
    const w07 = resolveDownloadPage({ channel: 'stable', locale: 'pt-BR', version: 'current' });
    const w08 = resolveReleasePage({
      locale: 'en',
      release: ['stable', 'current', 'integrity'],
    });
    if (w07 === undefined || w08 === undefined) throw new Error('release scenario route missing');

    const w07Markup = renderToStaticMarkup(<ReleaseExperience resolution={w07} />);
    const w08Markup = renderToStaticMarkup(<ReleaseExperience resolution={w08} />);

    for (const markup of [w07Markup, w08Markup]) {
      const decision = markup.indexOf('lb-web-download-gate');
      const integrity = markup.indexOf('lb-web-release-integrity');
      const manifest = markup.indexOf('release-manifest-disclosure');
      const provenance = markup.indexOf('release-technical-context');

      expect(decision).toBeGreaterThan(-1);
      expect(decision).toBeLessThan(integrity);
      expect(decision).toBeLessThan(manifest);
      expect(decision).toBeLessThan(provenance);
      expect(markup).toContain('<details class="release-manifest-disclosure">');
      expect(markup).not.toContain('<details class="release-manifest-disclosure" open=""');
      expect(markup).toContain('<details class="release-decision-technical-context">');
      expect(markup).not.toMatch(/<p>\s*<code>distribution-not-approved<\/code>/u);
    }

    expect(w07Markup).toContain('Registro técnico da decisão');
    expect(w07Markup).toContain('Integridade e recuperação');
    expect(w07Markup).toContain('Ver detalhes técnicos de integridade');
    expect(w07Markup.indexOf('release-manifest-disclosure')).toBeLessThan(
      w07Markup.indexOf('Campos demonstrativos do manifesto'),
    );
    expect(w08Markup).toContain('Technical decision record');
    expect(w08Markup).toContain('Integrity and recovery');
    expect(w08Markup).toContain('View technical integrity details');
    expect(w08Markup.indexOf('release-manifest-disclosure')).toBeLessThan(
      w08Markup.indexOf('Demonstrative manifest fields'),
    );
  });

  it('prioritizes state, compatibility, integrity, risks, corrections, and recovery', async () => {
    const resolution = resolveReleasePage({ locale: 'en' });
    if (resolution === undefined) throw new Error('release index route missing');
    const markup = renderToStaticMarkup(<ReleaseExperience resolution={resolution} />);
    const hooks = [
      'release-state-header',
      'release-compatibility-movement',
      'release-integrity-movement',
      'release-risks-movement',
      'release-corrections-movement',
      'release-recovery-movement',
    ];

    for (const [index, hook] of hooks.entries()) {
      expect(markup).toContain(hook);
      if (index > 0) {
        expect(markup.indexOf(hook)).toBeGreaterThan(markup.indexOf(hooks[index - 1] ?? ''));
      }
    }

    const source = await import('node:fs/promises').then(({ readFile }) =>
      readFile(new URL('./features/releases.tsx', import.meta.url), 'utf8'),
    );
    expect(source).not.toContain('continueAnyway');
    expect(source).not.toMatch(/<a[^>]+download(?:=|\s|>)/iu);
  });

  it('explains signed idle updates, game exclusion, user timing, recovery, and staged rollout', () => {
    const pt = resolveReleasePage({ locale: 'pt-BR' });
    const en = resolveReleasePage({ locale: 'en' });
    if (pt === undefined || en === undefined) throw new Error('release index route missing');

    const ptMarkup = renderToStaticMarkup(<ReleaseExperience resolution={pt} />);
    const enMarkup = renderToStaticMarkup(<ReleaseExperience resolution={en} />);
    const ptText = visibleText(ptMarkup);
    const enText = visibleText(enMarkup);

    expect(ptText).toContain('Atualizações automáticas sem interromper sua partida');
    expect(ptText).toContain('atualizador assinado do Tauri');
    expect(ptText).toContain('nunca inicia verificação ou instalação durante uma sessão de jogo');
    expect(ptText).toContain('Instalar ao fechar o aplicativo');
    expect(ptText).toContain('Agendar para um horário ocioso');
    expect(ptText).toContain('5%');
    expect(ptText).toContain('25%');
    expect(ptText).toContain('100%');
    expect(enText).toContain('Automatic updates that never interrupt your game');
    expect(enText).toContain('Any mismatch cancels the update with no override');
    expect(enText).toContain('preserves a return path');
  });

  it('shows the complete pre-download fact set without pretending unavailable fields exist', () => {
    const resolution = resolveReleasePage({ locale: 'pt-BR' });
    if (resolution === undefined) throw new Error('release index route missing');
    const markup = renderToStaticMarkup(<ReleaseExperience resolution={resolution} />);
    const text = visibleText(markup);

    for (const label of [
      'Canal escolhido',
      'Versão planejada',
      'Última revisão',
      'Windows compatível',
      'Arquitetura',
      'Tamanho do instalador',
      'Publicador e assinatura',
      'SHA-256',
      'Manifesto oficial',
    ]) {
      expect(text).toContain(label);
    }
    expect(text).toContain('Ainda não publicado');
    expect(markup).not.toMatch(/<a[^>]+download(?:=|\s|>)/iu);
  });

  it('subordinates dense release metadata to an invoked technical disclosure', () => {
    const resolution = resolveReleasePage({ locale: 'pt-BR' });
    if (resolution === undefined) throw new Error('release index route missing');
    const markup = renderToStaticMarkup(<ReleaseExperience resolution={resolution} />);

    expect(markup).toContain('<details class="release-technical-context">');
    expect(markup).not.toContain('<details class="release-technical-context" open=""');
    expect(markup.indexOf('release-state-header')).toBeLessThan(
      markup.indexOf('release-technical-context'),
    );
  });

  it('retains channel navigation and integrity guidance without page-level horizontal scroll', async () => {
    const styles = await import('node:fs/promises').then(({ readFile }) =>
      readFile(new URL('./styles/public.css', import.meta.url), 'utf8'),
    );

    expect(styles).toMatch(
      /@media \(width < 640px\)[\s\S]*\.release-movement[\s\S]*min-inline-size:\s*0/u,
    );
    expect(styles).not.toMatch(/\.release-experience\s*\{[\s\S]*overflow-x:\s*auto/u);
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
