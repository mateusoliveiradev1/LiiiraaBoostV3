import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isValidElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CommandRunwayHome,
  getHomeContent,
  resolveHomeProductCapture,
  type HomeLocale,
} from './features/home';
import { getPublicCatalog } from './features/public-catalog';

const temporaryDirectories: string[] = [];

const readSource = (path: string) =>
  import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL(path, import.meta.url), 'utf8'),
  );

const createCaptureDirectory = async (
  locale: HomeLocale,
  overrides: Readonly<Record<string, unknown>> = {},
) => {
  const directory = await mkdtemp(join(tmpdir(), 'liiiraa-home-capture-'));
  temporaryDirectories.push(directory);
  const content = getHomeContent(locale);
  const image = Buffer.from(`executable-desktop-capture:${locale}`);
  const checksum = createHash('sha256').update(image).digest('hex');
  const imageName = content.productStage.expectedPath.split('/').at(-1);
  const sidecarName = content.productStage.sidecarPath.split('/').at(-1);
  if (imageName === undefined || sidecarName === undefined) {
    throw new Error('Home capture names are missing.');
  }

  await Promise.all([
    writeFile(join(directory, imageName), image),
    writeFile(
      join(directory, sidecarName),
      JSON.stringify({
        captureCommand: `pnpm desktop:capture --scenario ${content.productStage.scenarioId}`,
        checksum,
        crop: 'full-frame',
        locale,
        reviewState: 'approved',
        scenarioId: content.productStage.scenarioId,
        sourceCommit: 'abcdef123456',
        version: content.document.version,
        viewport: '1440x900',
        ...overrides,
      }),
      'utf8',
    ),
  ]);

  return { directory, imageName };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('Home layout and screenshot evidence gate', () => {
  it('exposes the complete D-102 journey and equivalent acquisition intents in both locales', () => {
    const expectedSequence = [
      'problem',
      'workflow',
      'competitive',
      'methodology',
      'plans',
      'safety',
      'faq',
      'acquisition',
    ];

    expect(getHomeContent('pt-BR')).toMatchObject({
      acquisition: {
        primaryAction: { label: 'Baixar e analisar meu PC', routeId: 'public-download' },
        secondaryAction: { label: 'Ver resultados reais', routeId: 'public-results' },
      },
      conversionJourney: expectedSequence.map((id) => ({ id })),
    });
    expect(getHomeContent('en')).toMatchObject({
      acquisition: {
        primaryAction: { label: 'Download and analyze my PC', routeId: 'public-download' },
        secondaryAction: { label: 'See real results', routeId: 'public-results' },
      },
      conversionJourney: expectedSequence.map((id) => ({ id })),
    });

    for (const locale of ['pt-BR', 'en'] as const) {
      const content = getHomeContent(locale);
      expect(content.conversionJourney.map(({ id }) => id)).toEqual(expectedSequence);
      expect(
        content.conversionJourney.every(({ body, title }) => body.length > 40 && title.length > 8),
      ).toBe(true);
      expect(content.faq).toHaveLength(4);
    }
  });

  it('leads with the approved bilingual promise and a download action before heavy media', async () => {
    expect(getHomeContent('pt-BR').hero).toMatchObject({
      primaryAction: { label: 'Verificar compatibilidade' },
      promise: 'Prepare seu PC. Prove o resultado. Restaure com controle.',
    });
    expect(getHomeContent('en').hero).toMatchObject({
      primaryAction: { label: 'Check compatibility' },
      promise: 'Prepare your PC. Prove the result. Restore with control.',
    });

    const homeSource = await readSource('./features/home.tsx');
    expect(homeSource).toContain('data-hero-layout="centered-product-stage"');
    expect(homeSource).toContain('className="home-ignition-hero__promise"');
    expect(homeSource).toContain("publicBoundaryHref('public-download', locale)");
    expect(homeSource).toContain("? 'Liiiraa Boost para Windows 10 e 11'");
    expect(homeSource).toContain(": 'Liiiraa Boost for Windows 10 and 11'");
    expect(homeSource.indexOf('className="home-ignition-hero__copy"')).toBeLessThan(
      homeSource.indexOf('className="home-ignition-hero__stage"'),
    );
  });

  it('stages the real desktop capture as the dominant centered proof object', async () => {
    const home = await CommandRunwayHome({ locale: 'en' });
    if (!isValidElement(home)) {
      throw new Error('Home did not return a React element.');
    }

    const props = home.props as Readonly<Record<string, ReactNode>>;
    expect(props['data-capture-state']).toBe('CAPTURE_ADMITTED');

    const [homeStyles, homeSource] = await Promise.all([
      readSource('./styles/home.css'),
      readSource('./features/home.tsx'),
    ]);

    expect(homeSource).toContain('data-stage-max-width="1120"');
    expect(homeSource).toContain('data-stage-max-top="640"');
    expect(homeSource).toContain('data-stage-min-visible="260"');
    expect(homeStyles).toMatch(
      /\.home-ignition-hero__stage\s*\{[\s\S]*grid-column:\s*2 \/ 12;[\s\S]*inline-size:\s*min\(calc\(100vw - 64px\), 1120px\);/u,
    );
    expect(homeStyles).toMatch(
      /\.home-ignition-hero__stage \.lb-web-product-stage img\s*\{[\s\S]*aspect-ratio:\s*16 \/ 9/u,
    );
  });

  it('uses a bounded three-line display promise and one dominant free-download action', async () => {
    const [homeSource, homeStyles, tokenStyles] = await Promise.all([
      readSource('./features/home.tsx'),
      readSource('./styles/home.css'),
      readSource('../../../packages/design-tokens/src/tokens.css'),
    ]);

    expect(homeSource).toContain('splitHeroPromise');
    expect(homeSource).toContain('primary>');
    expect(homeStyles).toMatch(
      /\.home-ignition-hero__promise\s*\{[\s\S]*font-size:\s*clamp\(48px, 5\.4vw, 76px\);[\s\S]*line-height:\s*0\.96/u,
    );
    expect(tokenStyles).toMatch(/--lb-public-hero-display-size:\s*clamp\(52px, 6vw, 76px\);/u);
    const shellStyles = await readSource('./app/public-shell.css');
    expect(shellStyles).toMatch(
      /\.home-action--primary\s*\{[\s\S]*background:\s*var\(--lb-accent-electric\);/u,
    );
  });

  it('keeps mobile copy first with 16px edges, a full capture, and 48px controls', async () => {
    const [homeSource, homeStyles, sharedSource] = await Promise.all([
      readSource('./features/home.tsx'),
      readSource('./styles/home.css'),
      readSource('../../../packages/web-features/src/components.tsx'),
    ]);

    expect(homeSource.indexOf('className="home-ignition-hero__copy"')).toBeLessThan(
      homeSource.indexOf('className="home-ignition-hero__stage"'),
    );
    expect(homeStyles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.home-ignition-hero__stage\s*\{[\s\S]*inline-size:\s*100%/u,
    );
    expect(homeStyles).toMatch(
      /@media \(width < 640px\)[\s\S]*\.home-ignition-hero\s*\{[\s\S]*padding-inline:\s*16px/u,
    );
    expect(homeStyles).toMatch(/\.home-action\s*\{[\s\S]*min-block-size:\s*48px/u);
    expect(sharedSource).toContain('completeScreenshotLabel');
  });

  it('uses the exact bounded first-load motion roles with a complete reduced-motion override', async () => {
    const shellStyles = await readSource('./app/public-shell.css');

    expect(shellStyles).toMatch(
      /\.home-ignition-hero__promise\s*\{[\s\S]*animation:[^;]*360ms[^;]*cubic-bezier\(0\.16, 1, 0\.3, 1\)/u,
    );
    expect(shellStyles).toMatch(
      /\.home-ignition-hero__stage\s*\{[\s\S]*animation:[^;]*480ms[^;]*80ms[^;]*cubic-bezier\(0\.16, 1, 0\.3, 1\)/u,
    );
    expect(shellStyles).toContain('transform: translateY(8px)');
    expect(shellStyles).toContain('transform: scale(0.985)');
    expect(shellStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.home-ignition-hero__promise,[\s\S]*\.home-ignition-hero__stage\s*\{[\s\S]*animation:\s*none/u,
    );
  });

  it('keeps evidence provenance contextual instead of exposing raw capture metadata', async () => {
    const [homeSource, sharedSource] = await Promise.all([
      readSource('./features/home.tsx'),
      readSource('../../../packages/web-features/src/components.tsx'),
    ]);

    expect(homeSource.match(/className="home-trust-boundary"/gu)).toHaveLength(1);
    expect(homeSource).toContain('className="home-evidence-disclosure"');
    expect(homeSource).not.toContain('ClaimEvidenceRow');
    expect(sharedSource).toContain('className="lb-web-product-provenance"');
    expect(sharedSource.indexOf('className="lb-web-product-provenance"')).toBeLessThan(
      sharedSource.indexOf('detail={provenance}'),
    );
  });

  it('uses authored movements instead of a repeated card or chapter wall', async () => {
    const homeSource = await readSource('./features/home.tsx');
    const styles = await readSource('./styles/home.css');

    expect(homeSource).toContain('className="home-workflow"');
    expect(homeSource).toContain('className="home-proof-sequence"');
    expect(homeSource).not.toContain('className="home-chapter"');
    expect(styles).not.toContain('.home-chapter');
    expect(styles).not.toMatch(/border-radius:\s*(?:2[4-9]|[3-9]\d)px/u);
  });

  it('orders the complete public sales journey from product proof to final CTA', async () => {
    const homeSource = await readSource('./features/home.tsx');
    const movementHooks = [
      'home-ignition-hero',
      'home-player-problem',
      'home-workflow',
      'home-competitive-mode',
      'home-results-method',
      'home-mode-split',
      'home-safety-runway',
      'home-faq',
      'home-final-cta',
    ];

    for (const [index, hook] of movementHooks.entries()) {
      expect(homeSource).toContain(`className="${hook}`);
      if (index > 0) {
        expect(homeSource.indexOf(hook)).toBeGreaterThan(
          homeSource.indexOf(movementHooks[index - 1] ?? ''),
        );
      }
    }
    expect(homeSource).not.toContain('home-feature-card');
    expect(homeSource).not.toContain('home-chapter-card');
  });

  it('uses only product evidence and methodology, never fabricated commercial proof', async () => {
    const homeSource = await readSource('./features/home.tsx');
    const fabricatedProof =
      /(?:\b\d+(?:[.,]\d+)?\s*%|\b\d+(?:[.,]\d+)?\s*(?:fps|ms)\b|\b\d+(?:[.,]\d+)?\/5\b|\b\d+[km]\+?\s+(?:customers|users|players|clientes|usuários|jogadores)|certified by|certificado por)/iu;

    expect(JSON.stringify(getHomeContent('pt-BR'))).not.toMatch(fabricatedProof);
    expect(JSON.stringify(getHomeContent('en'))).not.toMatch(fabricatedProof);
    expect(homeSource).toContain('data-proof-policy="product-methodology-only"');
    expect(homeSource).toContain('data-proof-object="checksum-admitted-desktop-capture"');
    expect(homeSource).not.toMatch(/testimonial|review-score|customer-count|benchmark-gain/iu);
  });

  it('locks the 1440/960/390/320 reading order and horizontal containment contract', async () => {
    const [homeSource, styles] = await Promise.all([
      readSource('./features/home.tsx'),
      readSource('./styles/home.css'),
    ]);

    expect(homeSource).toContain('data-responsive-widths="1440 960 390 320"');
    expect(homeSource.indexOf('className="home-ignition-hero__copy"')).toBeLessThan(
      homeSource.indexOf('data-proof-object="checksum-admitted-desktop-capture"'),
    );
    expect(styles).toMatch(/\.public-home\s*\{[\s\S]*overflow-x:\s*clip/u);
    expect(styles).toMatch(/@media \(width < 960px\)/u);
    expect(styles).toMatch(/@media \(width <= 390px\)/u);
    expect(styles).toMatch(/@media \(width <= 320px\)/u);
    expect(styles).toMatch(/\.home-action--primary\s*\{[\s\S]*min-inline-size:/u);
  });

  it('hints the next movement directly below the hero without an unexplained large gap', async () => {
    const [homeSource, styles] = await Promise.all([
      readSource('./features/home.tsx'),
      readSource('./styles/home.css'),
    ]);

    expect(homeSource).toContain('href="#player-problem"');
    expect(homeSource).toContain('className="home-next-movement"');
    expect(styles).toMatch(/\.home-next-movement\s*\{[\s\S]*margin-block-start:\s*8px/u);
    expect(styles).not.toMatch(
      /\.home-next-movement\s*\{[\s\S]*margin-block-start:\s*(?:[7-9]\d|\d{3,})px/u,
    );
  });

  it('keeps evidence contextual while plans, pricing, and objections stay customer-facing', async () => {
    const homeSource = await readSource('./features/home.tsx');
    const ptBrPlans = getPublicCatalog('pt-BR').records.find(
      ({ routeId }) => routeId === 'public-plans',
    )?.plans;
    const enPlans = getPublicCatalog('en').records.find(
      ({ routeId }) => routeId === 'public-plans',
    )?.plans;

    expect(homeSource).toContain('className="home-evidence-disclosure"');
    expect(homeSource).toContain('className="home-mode-split__plans"');
    expect(homeSource).toContain('className="home-faq"');
    expect(getHomeContent('pt-BR').faq.map(({ question }) => question)).toEqual(
      expect.arrayContaining(['O app garante mais FPS?', 'Onde o PC é analisado?']),
    );
    expect(ptBrPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          billingPeriod: 'grátis para sempre',
          name: 'Free · Modo Essencial',
          price: 'R$ 0',
        }),
        expect.objectContaining({
          billingPeriod: 'ou R$ 249,90/ano',
          name: 'Premium · Modo Competitivo',
          price: 'R$ 29,90/mês',
        }),
      ]),
    );
    expect(enPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          billingPeriod: 'free forever',
          name: 'Free · Essential Mode',
          price: 'US$ 0',
        }),
        expect.objectContaining({
          billingPeriod: 'or US$ 59.99/year',
          name: 'Premium · Competitive Mode',
          price: 'US$ 6.99/month',
        }),
      ]),
    );
    expect(homeSource).not.toMatch(
      /<h[1-3][^>]*>[^<]*(?:fixture|adapter|manifest|route|Phase 4)/iu,
    );
    expect(homeSource).not.toMatch(
      /<HomeAction[^>]*>[^<]*(?:fixture|adapter|manifest|route|Phase 4)/iu,
    );
  });

  it('routes both dominant entry points to canonical Download without exposing an installer path', async () => {
    const homeSource = await readSource('./features/home.tsx');

    expect(homeSource.match(/<HomeAction href=\{downloadHref\} primary>/gu)).toHaveLength(2);
    expect(homeSource).toContain("publicBoundaryHref('public-download', locale)");
    expect(homeSource).not.toContain("publicBoundaryHref('releases-download'");
    expect(homeSource).not.toMatch(/['"`]\/[^'"`\s]+\.exe|development installer|self-signed/iu);
  });

  it('admits only an approved executable capture with a matching image checksum', async () => {
    const { directory } = await createCaptureDirectory('pt-BR');
    const result = await resolveHomeProductCapture('pt-BR', directory);

    expect(result).toMatchObject({
      code: 'CAPTURE_ADMITTED',
      height: 900,
      ok: true,
      width: 1440,
    });
  });

  it.each([
    ['wrong scenario', { scenarioId: 'S99' }, 'PROVENANCE_MISMATCH'],
    ['unapproved review', { reviewState: 'pending' }, 'PROVENANCE_MISMATCH'],
    ['non-desktop source', { captureCommand: 'generate mockup' }, 'PROVENANCE_MISMATCH'],
    ['invalid checksum', { checksum: '0'.repeat(64) }, 'CHECKSUM_MISMATCH'],
  ] as const)('rejects %s evidence', async (_name, overrides, expectedCode) => {
    const { directory } = await createCaptureDirectory('en', overrides);
    await expect(resolveHomeProductCapture('en', directory)).resolves.toEqual({
      code: expectedCode,
      ok: false,
    });
  });
});
