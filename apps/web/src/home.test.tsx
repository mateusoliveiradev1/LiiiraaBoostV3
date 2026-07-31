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
  it('keeps copy, compatibility action, and trust boundary before unavailable media', async () => {
    const home = await CommandRunwayHome({ locale: 'en' });
    if (!isValidElement(home)) {
      throw new Error('Home did not return a React element.');
    }

    const props = home.props as Readonly<Record<string, ReactNode>>;
    expect(props['data-capture-state']).toBe('CAPTURE_MISSING');

    const sharedSource = await import('node:fs/promises').then(({ readFile }) =>
      readFile(
        new URL('../../../packages/web-features/src/components.tsx', import.meta.url),
        'utf8',
      ),
    );
    const copyPosition = sharedSource.indexOf('className="lb-web-command-copy"');
    const actionPosition = sharedSource.indexOf('{cta}', copyPosition);
    const boundaryPosition = sharedSource.indexOf('{boundary}', actionPosition);
    const mediaPosition = sharedSource.indexOf(
      'className="lb-web-command-artifact"',
      boundaryPosition,
    );

    expect(copyPosition).toBeGreaterThanOrEqual(0);
    expect(actionPosition).toBeGreaterThan(copyPosition);
    expect(boundaryPosition).toBeGreaterThan(actionPosition);
    expect(mediaPosition).toBeGreaterThan(boundaryPosition);
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
