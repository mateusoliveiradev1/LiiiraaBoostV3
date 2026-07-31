import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  type DesktopCaptureManifest,
  verifyDesktopCapture,
} from './capture-desktop.js';

const temporaryDirectories: string[] = [];
const sha256 = (value: Uint8Array | string): string =>
  createHash('sha256').update(value).digest('hex');

const writeExactCaptureFixture = async () => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), 'liiiraa-desktop-capture-'));
  temporaryDirectories.push(repositoryRoot);

  const imagePath = 'apps/web/public/product/desktop-home.pt-BR.webp';
  const sidecarPath = 'apps/web/public/product/desktop-home.pt-BR.json';
  const sourcePath = 'apps/desktop/src/app.tsx';
  const image = Buffer.from('RIFF-real-executable-desktop-webp-fixture');
  const source = 'export const executableDesktop = true;\n';
  const checksum = sha256(image);
  const sourceChecksum = sha256(source);
  const captureCommand =
    'pnpm --filter @liiiraa/web-evidence verify -- --capture-manifest tooling/web-evidence/capture-manifest.json --capture';
  const sidecar = {
    captureCommand,
    checksum,
    crop: 'x=0,y=0,width=1440,height=900; non-destructive full-frame',
    locale: 'pt-BR',
    reviewState: 'approved',
    scenarioId: 'S01',
    sourceCommit: 'abcdef1234567890',
    version: '1.0.0',
    viewport: '1440x900',
  } as const;
  const manifest = {
    captures: [
      {
        buildId: 'desktop-production-abcdef123456',
        captureCommand,
        crop: { height: 900, width: 1440, x: 0, y: 0 },
        height: 900,
        id: 'desktop-home-pt-BR',
        imageSha256: checksum,
        locale: 'pt-BR',
        outputPath: imagePath,
        review: {
          approvedBy: 'phase-03-ui-contract',
          state: 'approved',
        },
        scenarioId: 'S01',
        sidecarPath,
        version: '1.0.0',
        viewport: { height: 900, width: 1440 },
        width: 1440,
      },
    ],
    environment: {
      animations: 'disabled',
      browser: 'chromium',
      browserVersion: '142.0.0.0',
      fonts: ['Manrope Variable', 'JetBrains Mono Variable'],
      frozenClock: '2030-01-15T18:00:00.000Z',
      operatingSystem: 'Windows 11',
    },
    schemaVersion: 1,
    source: {
      buildId: 'desktop-production-abcdef123456',
      executableUrl: 'http://127.0.0.1:4173',
      kind: 'executable-desktop',
      launchCommand:
        'pnpm --filter @liiiraa/desktop build && pnpm --filter @liiiraa/desktop exec vite preview --host 127.0.0.1 --port 4173',
      sourceCommit: 'abcdef1234567890',
      sourceInputs: [{ path: sourcePath, sha256: sourceChecksum }],
    },
  } satisfies DesktopCaptureManifest;
  const manifestPath = 'tooling/web-evidence/capture-manifest.json';

  await Promise.all([
    writeFile(join(repositoryRoot, imagePath), image, { recursive: false }).catch(async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(repositoryRoot, 'apps/web/public/product'), { recursive: true });
      await writeFile(join(repositoryRoot, imagePath), image);
    }),
    writeFile(join(repositoryRoot, sourcePath), source, { recursive: false }).catch(async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(repositoryRoot, 'apps/desktop/src'), { recursive: true });
      await writeFile(join(repositoryRoot, sourcePath), source);
    }),
  ]);
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(repositoryRoot, 'tooling/web-evidence'), { recursive: true });
  await Promise.all([
    writeFile(join(repositoryRoot, sidecarPath), `${JSON.stringify(sidecar, null, 2)}\n`, 'utf8'),
    writeFile(join(repositoryRoot, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
  ]);

  return { imagePath, manifest, manifestPath, repositoryRoot, sidecarPath, sourcePath };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('desktop capture provenance', () => {
  it('admits an exact executable desktop capture with generated provenance', async () => {
    const fixture = await writeExactCaptureFixture();

    await expect(
      verifyDesktopCapture({
        manifestPath: fixture.manifestPath,
        repositoryRoot: fixture.repositoryRoot,
      }),
    ).resolves.toEqual({ captures: 1, diagnostics: [], ok: true });
  });

  it.each([
    ['generated image', (manifest: DesktopCaptureManifest) => ({
      ...manifest,
      source: { ...manifest.source, kind: 'generated-image' },
    })],
    ['visual probe', (manifest: DesktopCaptureManifest) => ({
      ...manifest,
      source: { ...manifest.source, executableUrl: 'file:///visual-probes/desktop-home.html' },
    })],
    ['non-canonical scenario', (manifest: DesktopCaptureManifest) => ({
      ...manifest,
      captures: manifest.captures.map((capture) => ({ ...capture, scenarioId: 'W01' })),
    })],
    ['non-approved viewport', (manifest: DesktopCaptureManifest) => ({
      ...manifest,
      captures: manifest.captures.map((capture) => ({
        ...capture,
        crop: { height: 768, width: 1024, x: 0, y: 0 },
        height: 768,
        viewport: { height: 768, width: 1024 },
        width: 1024,
      })),
    })],
    ['path outside the product allowlist', (manifest: DesktopCaptureManifest) => ({
      ...manifest,
      captures: manifest.captures.map((capture) => ({
        ...capture,
        outputPath: 'apps/web/public/mockups/desktop-home.pt-BR.webp',
      })),
    })],
    ['destructive crop', (manifest: DesktopCaptureManifest) => ({
      ...manifest,
      captures: manifest.captures.map((capture) => ({
        ...capture,
        crop: { height: 800, width: 1280, x: 40, y: 20 },
      })),
    })],
  ] as const)('rejects %s provenance', async (_name, mutate) => {
    const fixture = await writeExactCaptureFixture();
    await writeFile(
      join(fixture.repositoryRoot, fixture.manifestPath),
      `${JSON.stringify(mutate(fixture.manifest), null, 2)}\n`,
      'utf8',
    );

    const result = await verifyDesktopCapture({
      manifestPath: fixture.manifestPath,
      repositoryRoot: fixture.repositoryRoot,
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).not.toEqual([]);
  });

  it('rejects tampered image bytes, sidecar provenance, and stale source inputs', async () => {
    const fixture = await writeExactCaptureFixture();
    const originalImage = await readFile(join(fixture.repositoryRoot, fixture.imagePath));
    const originalSidecar = await readFile(
      join(fixture.repositoryRoot, fixture.sidecarPath),
      'utf8',
    );

    await writeFile(join(fixture.repositoryRoot, fixture.imagePath), Buffer.concat([
      originalImage,
      Buffer.from('tampered'),
    ]));
    expect((await verifyDesktopCapture({
      manifestPath: fixture.manifestPath,
      repositoryRoot: fixture.repositoryRoot,
    })).ok).toBe(false);

    await writeFile(join(fixture.repositoryRoot, fixture.imagePath), originalImage);
    await writeFile(
      join(fixture.repositoryRoot, fixture.sidecarPath),
      originalSidecar.replace('"approved"', '"pending"'),
      'utf8',
    );
    expect((await verifyDesktopCapture({
      manifestPath: fixture.manifestPath,
      repositoryRoot: fixture.repositoryRoot,
    })).ok).toBe(false);

    await writeFile(join(fixture.repositoryRoot, fixture.sidecarPath), originalSidecar, 'utf8');
    await writeFile(join(fixture.repositoryRoot, fixture.sourcePath), 'stale source\n', 'utf8');
    expect((await verifyDesktopCapture({
      manifestPath: fixture.manifestPath,
      repositoryRoot: fixture.repositoryRoot,
    })).ok).toBe(false);
  });
});
