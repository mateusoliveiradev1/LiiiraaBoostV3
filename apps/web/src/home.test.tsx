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
  import('node:fs/promises').then(({ readFile }) => readFile(new URL(path, import.meta.url), 'utf8'));

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
  it('makes the admitted desktop artifact dominant without hiding the next action', async () => {
    const home = await CommandRunwayHome({ locale: 'en' });
    if (!isValidElement(home)) {
      throw new Error('Home did not return a React element.');
    }

    const props = home.props as Readonly<Record<string, ReactNode>>;
    expect(props['data-capture-state']).toBe('CAPTURE_ADMITTED');

    const [styles, sharedSource] = await Promise.all([
      readSource('./styles/public.css'),
      readSource('../../../packages/web-features/src/components.tsx'),
    ]);

    expect(styles).toContain('grid-template-columns: minmax(0, 5fr) minmax(0, 7fr)');
    expect(styles).toMatch(
      /@media \(width < 960px\)[\s\S]*\.public-home \.lb-web-command-artifact\s*\{[\s\S]*order: -1/u,
    );
    expect(sharedSource).toContain('className="lb-web-command-action"');
  });

  it('keeps one trust statement and progressively discloses localized capture metadata', async () => {
    const [homeSource, sharedSource] = await Promise.all([
      readSource('./features/home.tsx'),
      readSource('../../../packages/web-features/src/components.tsx'),
    ]);

    expect(homeSource.match(/className="home-trust-boundary"/gu)).toHaveLength(1);
    expect(sharedSource).toContain('className="lb-web-product-provenance"');
    expect(sharedSource.indexOf('className="lb-web-product-provenance"')).toBeLessThan(
      sharedSource.indexOf('detail={provenance}'),
    );
  });

  it('uses the canonical public type and spacing scale instead of oversized hero values', async () => {
    const styles = await readSource('./styles/public.css');
    const homeStyles = styles.slice(0, styles.indexOf('.public-catalog'));

    expect(homeStyles).not.toMatch(/font-size:\s*clamp\(/u);
    expect(homeStyles).not.toMatch(/(?:gap|padding[^:]*):[^;]*(?:80|88|96|112|144)px/u);
    expect(homeStyles).toContain('font-size: var(--lb-text-display-size)');
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
