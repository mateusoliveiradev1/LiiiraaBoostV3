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
  it('leads with the approved bilingual promise and compatibility action before heavy media', async () => {
    expect(getHomeContent('pt-BR').hero).toMatchObject({
      primaryAction: { label: 'Verificar compatibilidade' },
      promise: 'Prepare seu PC. Prove o resultado. Restaure com controle.',
    });
    expect(getHomeContent('en').hero).toMatchObject({
      primaryAction: { label: 'Check compatibility' },
      promise: 'Prepare your PC. Prove the result. Restore with control.',
    });

    const homeSource = await readSource('./features/home.tsx');
    expect(homeSource).toContain('data-hero-layout="centered-12-column"');
    expect(homeSource).toContain('className="home-ignition-hero__promise"');
    expect(homeSource.indexOf('className="home-ignition-hero__copy"')).toBeLessThan(
      homeSource.indexOf('className="home-ignition-hero__stage"'),
    );
  });

  it('stages a centered 1120px desktop artifact with explicit above-fold geometry hooks', async () => {
    const home = await CommandRunwayHome({ locale: 'en' });
    if (!isValidElement(home)) {
      throw new Error('Home did not return a React element.');
    }

    const props = home.props as Readonly<Record<string, ReactNode>>;
    expect(props['data-capture-state']).toBe('CAPTURE_ADMITTED');

    const [shellStyles, homeSource] = await Promise.all([
      readSource('./app/public-shell.css'),
      readSource('./features/home.tsx'),
    ]);

    expect(homeSource).toContain('data-stage-max-width="1120"');
    expect(homeSource).toContain('data-stage-max-top="560"');
    expect(homeSource).toContain('data-stage-min-visible="260"');
    expect(shellStyles).toMatch(
      /\.home-ignition-hero__stage\s*\{[\s\S]*inline-size:\s*min\(calc\(100vw - 48px\), 1120px\);/u,
    );
    expect(shellStyles).toContain('aspect-ratio: 16 / 9');
  });

  it('uses a 52-76px three-line display promise and unequal compatibility actions', async () => {
    const [homeSource, shellStyles] = await Promise.all([
      readSource('./features/home.tsx'),
      readSource('./app/public-shell.css'),
    ]);

    expect(homeSource).toContain('splitHeroPromise');
    expect(homeSource).toContain('primary>');
    expect(shellStyles).toMatch(
      /\.home-ignition-hero__promise\s*\{[\s\S]*font-family:\s*var\(--lb-font-display\);[\s\S]*font-size:\s*clamp\(52px, 6vw, 76px\);/u,
    );
    expect(shellStyles).toMatch(
      /\.home-action--primary\s*\{[\s\S]*background:\s*var\(--lb-accent-electric\);/u,
    );
  });

  it('keeps mobile copy first with a 16:10 crop, full-image action, and 48px controls', async () => {
    const [homeSource, shellStyles, sharedSource] = await Promise.all([
      readSource('./features/home.tsx'),
      readSource('./app/public-shell.css'),
      readSource('../../../packages/web-features/src/components.tsx'),
    ]);

    expect(homeSource.indexOf('className="home-ignition-hero__copy"')).toBeLessThan(
      homeSource.indexOf('className="home-ignition-hero__stage"'),
    );
    expect(shellStyles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.home-ignition-hero__stage[^\{]*img\s*\{[\s\S]*aspect-ratio:\s*16 \/ 10/u,
    );
    expect(shellStyles).toMatch(/\.home-action\s*\{[\s\S]*min-block-size:\s*48px/u);
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

  it('uses authored evidence stages and rows instead of a repeated card or chapter wall', async () => {
    const homeSource = await readSource('./features/home.tsx');
    const styles = await readSource('./styles/public.css');

    expect(homeSource).toContain('className="home-evidence-stage"');
    expect(homeSource).toContain('className="home-proof-sequence"');
    expect(homeSource).not.toContain('className="home-chapter"');
    expect(styles).not.toContain('.home-chapter');
    expect(styles).not.toMatch(/border-radius:\s*(?:2[4-9]|[3-9]\d)px/u);
  });

  it('orders five distinct public movements from ignition through the release boundary', async () => {
    const homeSource = await readSource('./features/home.tsx');
    const movementHooks = [
      'home-ignition-hero',
      'home-prepare-band',
      'home-context-stage',
      'home-compatibility-field',
      'home-release-ribbon',
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

  it('hints the next movement directly below the hero without an unexplained large gap', async () => {
    const [homeSource, styles] = await Promise.all([
      readSource('./features/home.tsx'),
      readSource('./styles/public.css'),
    ]);

    expect(homeSource).toContain('href="#prepare-prove-restore"');
    expect(homeSource).toContain('className="home-next-movement"');
    expect(styles).toMatch(
      /\.home-next-movement\s*\{[\s\S]*min-block-size:\s*44px[\s\S]*margin-block-start:\s*var\(--lb-space-4\)/u,
    );
    expect(styles).not.toMatch(/\.home-next-movement\s*\{[\s\S]*margin-block-start:\s*(?:[7-9]\d|\d{3,})px/u);
  });

  it('keeps evidence metadata in contextual disclosures while visitor headings stay human', async () => {
    const homeSource = await readSource('./features/home.tsx');

    expect(homeSource).toContain('className="home-evidence-disclosure"');
    expect(homeSource).toContain('className="home-context-stage__proof"');
    expect(homeSource).toContain('className="home-compatibility-field__action"');
    expect(homeSource).not.toMatch(/<h[1-3][^>]*>[^<]*(?:fixture|adapter|manifest|route|Phase 4)/iu);
    expect(homeSource).not.toMatch(/<HomeAction[^>]*>[^<]*(?:fixture|adapter|manifest|route|Phase 4)/iu);
  });

  it('keeps public distribution unavailable without exposing a development installer path', async () => {
    const homeSource = await readSource('./features/home.tsx');

    expect(homeSource).toContain("publicBoundaryHref('releases-index', locale)");
    expect(homeSource).toContain('Distribution blocked');
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
