import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { release } from 'node:os';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, type Browser, type Page } from '@playwright/test';
import { validateWebDocument } from '@liiiraa/contracts-ts';

const APPROVED_VIEWPORT = Object.freeze({ height: 900, width: 1440 });
const CANONICAL_SCENARIO_ID = 'S01';
const CAPTURE_MANIFEST_PATH = 'tooling/web-evidence/capture-manifest.json';
const CAPTURE_COMMAND =
  'pnpm --filter @liiiraa/web-evidence verify -- --capture-manifest tooling/web-evidence/capture-manifest.json --capture';
const EXECUTABLE_URL = 'http://127.0.0.1:4173';
const FROZEN_CLOCK = '2030-01-15T18:00:00.000Z';
const FONTS = Object.freeze(['Manrope Variable', 'JetBrains Mono Variable']);
const SOURCE_INPUT_ROOTS = Object.freeze(['apps/desktop/src', 'apps/desktop/public/fonts']);
const SOURCE_INPUT_FILES = Object.freeze([
  'apps/desktop/index.html',
  'apps/desktop/package.json',
  'apps/desktop/vite.config.ts',
  'contracts/scenarios/desktop-scenarios.json',
  'pnpm-lock.yaml',
]);

type CaptureLocale = 'en' | 'pt-BR';
type Sha256 = string;

export interface DesktopCaptureEntry {
  readonly buildId: string;
  readonly captureCommand: string;
  readonly crop: Readonly<{ height: number; width: number; x: number; y: number }>;
  readonly height: number;
  readonly id: string;
  readonly imageSha256: Sha256;
  readonly locale: CaptureLocale;
  readonly outputPath: string;
  readonly review: Readonly<{ approvedBy: string; state: string }>;
  readonly scenarioId: string;
  readonly sidecarPath: string;
  readonly version: string;
  readonly viewport: Readonly<{ height: number; width: number }>;
  readonly width: number;
}

export interface DesktopCaptureManifest {
  readonly captures: readonly DesktopCaptureEntry[];
  readonly environment: Readonly<{
    animations: string;
    browser: string;
    browserVersion: string;
    fonts: readonly string[];
    frozenClock: string;
    operatingSystem: string;
  }>;
  readonly schemaVersion: number;
  readonly source: Readonly<{
    buildId: string;
    executableUrl: string;
    kind: string;
    launchCommand: string;
    sourceCommit: string;
    sourceInputs: readonly Readonly<{ path: string; sha256: Sha256 }>[];
  }>;
}

export interface CaptureVerificationResult {
  readonly captures: number;
  readonly diagnostics: readonly string[];
  readonly ok: boolean;
}

export interface CaptureToolOptions {
  readonly manifestPath: string;
  readonly repositoryRoot: string;
}

interface WebpDimensions {
  readonly height: number;
  readonly width: number;
}

const sha256 = (value: Uint8Array | string): Sha256 =>
  createHash('sha256').update(value).digest('hex');

const isSha256 = (value: unknown): value is Sha256 =>
  typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);

const isInsideRepository = (repositoryRoot: string, path: string): boolean => {
  const absoluteRoot = resolve(repositoryRoot);
  const absolutePath = resolve(repositoryRoot, path);
  const pathFromRoot = relative(absoluteRoot, absolutePath);
  return (
    pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`) && !pathFromRoot.includes('\0')
  );
};

const expectedPaths = (locale: CaptureLocale) => ({
  outputPath: `apps/web/public/product/desktop-home.${locale}.webp`,
  sidecarPath: `apps/web/public/product/desktop-home.${locale}.json`,
});

const parseWebpDimensions = (image: Buffer): WebpDimensions | undefined => {
  if (
    image.length < 30 ||
    image.toString('ascii', 0, 4) !== 'RIFF' ||
    image.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return undefined;
  }

  const chunk = image.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      height: image.readUIntLE(27, 3) + 1,
      width: image.readUIntLE(24, 3) + 1,
    };
  }
  if (chunk === 'VP8L' && image[20] === 0x2f) {
    const dimensions = image.readUInt32LE(21);
    return {
      height: ((dimensions >>> 14) & 0x3fff) + 1,
      width: (dimensions & 0x3fff) + 1,
    };
  }
  if (chunk === 'VP8 ') {
    const marker = image.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
    if (marker !== -1 && marker + 7 <= image.length) {
      return {
        height: image.readUInt16LE(marker + 5) & 0x3fff,
        width: image.readUInt16LE(marker + 3) & 0x3fff,
      };
    }
  }
  return undefined;
};

const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, 'utf8')) as unknown;

const asManifest = (value: unknown): DesktopCaptureManifest => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Capture manifest must be a JSON object.');
  }
  return value as DesktopCaptureManifest;
};

const pushManifestDiagnostics = (
  manifest: DesktopCaptureManifest,
  repositoryRoot: string,
  diagnostics: string[],
): void => {
  if (manifest.schemaVersion !== 1) diagnostics.push('MANIFEST_SCHEMA_INVALID');
  if (manifest.source.kind !== 'executable-desktop') diagnostics.push('SOURCE_NOT_EXECUTABLE');
  if (manifest.source.executableUrl !== EXECUTABLE_URL) diagnostics.push('EXECUTABLE_URL_INVALID');
  if (!/(?:@liiiraa\/desktop).*(?:vite preview)/iu.test(manifest.source.launchCommand)) {
    diagnostics.push('LAUNCH_COMMAND_INVALID');
  }
  if (
    /(?:generated|mockup|visual[- ]?probe|source-tree|\.html?\b)/iu.test(
      `${manifest.source.kind} ${manifest.source.executableUrl}`,
    )
  ) {
    diagnostics.push('FABRICATED_SOURCE_REJECTED');
  }
  if (!/^[a-f0-9]{7,40}$/u.test(manifest.source.sourceCommit)) {
    diagnostics.push('SOURCE_COMMIT_INVALID');
  }
  if (!/^desktop-production-[a-f0-9]{7,40}$/u.test(manifest.source.buildId)) {
    diagnostics.push('BUILD_ID_INVALID');
  }
  if (
    manifest.environment.animations !== 'disabled' ||
    manifest.environment.browser !== 'chromium' ||
    manifest.environment.frozenClock !== FROZEN_CLOCK ||
    manifest.environment.fonts.join('|') !== FONTS.join('|') ||
    !/^Windows\s/u.test(manifest.environment.operatingSystem)
  ) {
    diagnostics.push('ENVIRONMENT_NOT_PINNED');
  }
  if (manifest.source.sourceInputs.length === 0) diagnostics.push('SOURCE_INPUTS_MISSING');
  for (const input of manifest.source.sourceInputs) {
    if (!isInsideRepository(repositoryRoot, input.path) || !isSha256(input.sha256)) {
      diagnostics.push(`SOURCE_INPUT_INVALID:${input.path}`);
    }
  }
};

const verifySourceInputs = async (
  manifest: DesktopCaptureManifest,
  repositoryRoot: string,
  diagnostics: string[],
): Promise<void> => {
  for (const input of manifest.source.sourceInputs) {
    try {
      const checksum = sha256(await readFile(resolve(repositoryRoot, input.path)));
      if (checksum !== input.sha256) diagnostics.push(`SOURCE_INPUT_STALE:${input.path}`);
    } catch {
      diagnostics.push(`SOURCE_INPUT_MISSING:${input.path}`);
    }
  }
};

const verifyCaptureEntry = async (
  entry: DesktopCaptureEntry,
  manifest: DesktopCaptureManifest,
  repositoryRoot: string,
  diagnostics: string[],
): Promise<void> => {
  const expected = expectedPaths(entry.locale);
  if (!['pt-BR', 'en'].includes(entry.locale)) diagnostics.push(`LOCALE_INVALID:${entry.id}`);
  if (entry.outputPath !== expected.outputPath || entry.sidecarPath !== expected.sidecarPath) {
    diagnostics.push(`OUTPUT_NOT_ALLOWLISTED:${entry.id}`);
  }
  if (
    !isInsideRepository(repositoryRoot, entry.outputPath) ||
    !isInsideRepository(repositoryRoot, entry.sidecarPath)
  ) {
    diagnostics.push(`OUTPUT_ESCAPES_REPOSITORY:${entry.id}`);
  }
  if (entry.scenarioId !== CANONICAL_SCENARIO_ID) diagnostics.push(`SCENARIO_INVALID:${entry.id}`);
  if (
    entry.viewport.width !== APPROVED_VIEWPORT.width ||
    entry.viewport.height !== APPROVED_VIEWPORT.height
  ) {
    diagnostics.push(`VIEWPORT_INVALID:${entry.id}`);
  }
  if (
    entry.crop.x !== 0 ||
    entry.crop.y !== 0 ||
    entry.crop.width !== entry.viewport.width ||
    entry.crop.height !== entry.viewport.height
  ) {
    diagnostics.push(`CROP_DESTRUCTIVE:${entry.id}`);
  }
  if (
    entry.width !== entry.crop.width ||
    entry.height !== entry.crop.height ||
    entry.captureCommand !== CAPTURE_COMMAND ||
    entry.buildId !== manifest.source.buildId ||
    entry.review.state !== 'approved' ||
    entry.review.approvedBy !== 'phase-03-ui-contract' ||
    !isSha256(entry.imageSha256)
  ) {
    diagnostics.push(`CAPTURE_METADATA_INVALID:${entry.id}`);
  }

  try {
    const [image, sidecar] = await Promise.all([
      readFile(resolve(repositoryRoot, entry.outputPath)),
      readJson(resolve(repositoryRoot, entry.sidecarPath)),
    ]);
    const dimensions = parseWebpDimensions(image);
    if (dimensions?.width !== entry.width || dimensions.height !== entry.height) {
      diagnostics.push(`IMAGE_DIMENSIONS_INVALID:${entry.id}`);
    }
    if (sha256(image) !== entry.imageSha256) diagnostics.push(`IMAGE_TAMPERED:${entry.id}`);

    const validation = validateWebDocument(sidecar);
    if (!validation.ok || !('scenarioId' in validation.value)) {
      diagnostics.push(`SIDECAR_SCHEMA_INVALID:${entry.id}`);
      return;
    }
    const provenance = validation.value;
    const expectedCrop = `x=${String(entry.crop.x)},y=${String(entry.crop.y)},width=${String(entry.crop.width)},height=${String(entry.crop.height)}; non-destructive full-frame`;
    if (
      provenance.version !== entry.version ||
      provenance.locale !== entry.locale ||
      provenance.scenarioId !== entry.scenarioId ||
      provenance.viewport !== `${String(entry.viewport.width)}x${String(entry.viewport.height)}` ||
      provenance.captureCommand !== entry.captureCommand ||
      provenance.sourceCommit !== manifest.source.sourceCommit ||
      provenance.checksum !== entry.imageSha256 ||
      provenance.crop !== expectedCrop ||
      provenance.reviewState !== entry.review.state
    ) {
      diagnostics.push(`SIDECAR_MISMATCH:${entry.id}`);
    }
  } catch {
    diagnostics.push(`CAPTURE_MISSING:${entry.id}`);
  }
};

export const verifyDesktopCapture = async (
  options: CaptureToolOptions,
): Promise<CaptureVerificationResult> => {
  const diagnostics: string[] = [];
  if (options.manifestPath.replaceAll('\\', '/') !== CAPTURE_MANIFEST_PATH) {
    return { captures: 0, diagnostics: ['MANIFEST_PATH_NOT_ALLOWLISTED'], ok: false };
  }
  if (!isInsideRepository(options.repositoryRoot, options.manifestPath)) {
    return { captures: 0, diagnostics: ['MANIFEST_ESCAPES_REPOSITORY'], ok: false };
  }

  let manifest: DesktopCaptureManifest;
  try {
    manifest = asManifest(await readJson(resolve(options.repositoryRoot, options.manifestPath)));
  } catch {
    return { captures: 0, diagnostics: ['MANIFEST_INVALID'], ok: false };
  }
  pushManifestDiagnostics(manifest, options.repositoryRoot, diagnostics);
  await verifySourceInputs(manifest, options.repositoryRoot, diagnostics);
  await Promise.all(
    manifest.captures.map((entry) =>
      verifyCaptureEntry(entry, manifest, options.repositoryRoot, diagnostics),
    ),
  );
  return { captures: manifest.captures.length, diagnostics, ok: diagnostics.length === 0 };
};

const listFiles = async (repositoryRoot: string, relativeRoot: string): Promise<string[]> => {
  const absoluteRoot = resolve(repositoryRoot, relativeRoot);
  const entries = await readdir(absoluteRoot, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const child = `${relativeRoot}/${entry.name}`;
      return entry.isDirectory() ? listFiles(repositoryRoot, child) : [child];
    }),
  );
  return paths.flat();
};

const collectSourceInputs = async (repositoryRoot: string) => {
  const paths = [
    ...(
      await Promise.all(SOURCE_INPUT_ROOTS.map((root) => listFiles(repositoryRoot, root)))
    ).flat(),
    ...SOURCE_INPUT_FILES,
  ].sort((left, right) => left.localeCompare(right, 'en'));
  return Promise.all(
    paths.map(async (path) => ({
      path,
      sha256: sha256(await readFile(resolve(repositoryRoot, path))),
    })),
  );
};

const runPnpm = (arguments_: readonly string[], repositoryRoot: string): void => {
  const pnpmRuntime = process.env['npm_execpath'];
  if (pnpmRuntime === undefined) throw new Error('pnpm lifecycle runtime is unavailable.');
  const result = spawnSync(process.execPath, [pnpmRuntime, ...arguments_], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: 180_000,
  });
  if (result.status !== 0) throw new Error(`pnpm command failed: ${arguments_.join(' ')}`);
};

const ensureTrackedDesktopSource = (repositoryRoot: string): void => {
  const result = spawnSync(
    'git',
    ['status', '--porcelain', '--', ...SOURCE_INPUT_ROOTS, ...SOURCE_INPUT_FILES],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  if (result.status !== 0 || result.stdout.trim() !== '') {
    throw new Error(
      'Desktop capture source is dirty; commit the exact product source before capture.',
    );
  }
};

const currentCommit = (repositoryRoot: string): string => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' });
  const commit = result.stdout.trim();
  if (result.status !== 0 || !/^[a-f0-9]{40}$/u.test(commit)) {
    throw new Error('Unable to resolve the source commit for capture provenance.');
  }
  return commit;
};

const waitForExecutable = async (url: string): Promise<void> => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'error' });
      if (response.ok) return;
    } catch {
      // The production preview has not started listening yet.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Executable desktop preview did not become ready at ${url}.`);
};

const startExecutableDesktop = async (repositoryRoot: string): Promise<ChildProcess> => {
  runPnpm(['--filter', '@liiiraa/desktop', 'build'], repositoryRoot);
  const pnpmRuntime = process.env['npm_execpath'];
  if (pnpmRuntime === undefined) throw new Error('pnpm lifecycle runtime is unavailable.');
  const child = spawn(
    process.execPath,
    [
      pnpmRuntime,
      '--filter',
      '@liiiraa/desktop',
      'exec',
      'vite',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '4173',
      '--strictPort',
    ],
    { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
  await waitForExecutable(EXECUTABLE_URL);
  return child;
};

const stopExecutableDesktop = (child: ChildProcess): void => {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    child.kill('SIGTERM');
  }
};

const composeDesktop = async (page: Page, locale: CaptureLocale): Promise<void> => {
  await page.addInitScript(
    ({ clock, composition }) => {
      const OriginalDate = Date;
      const frozenEpoch = OriginalDate.parse(clock);
      let randomState = 2_001;
      let idCounter = 0;
      class FrozenDate extends OriginalDate {
        public constructor(value: string | number = frozenEpoch) {
          super(value);
        }
        public static override now(): number {
          return frozenEpoch;
        }
      }
      Object.defineProperty(globalThis, 'Date', { configurable: false, value: FrozenDate });
      Object.defineProperty(Math, 'random', {
        configurable: false,
        value: () => {
          randomState = (randomState * 1_664_525 + 1_013_904_223) >>> 0;
          return randomState / 0x1_0000_0000;
        },
      });
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        configurable: false,
        value: () => {
          idCounter += 1;
          return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
        },
      });
      Object.defineProperty(globalThis, '__LIIIRAA_DESKTOP_COMPOSITION__', {
        configurable: false,
        value: Object.freeze(composition),
      });
      Object.assign(globalThis, {
        __LIIIRAA_DESKTOP_TEST__: Object.freeze({
          chartData: Object.freeze([
            { frame: 0, milliseconds: 8.2 },
            { frame: 1, milliseconds: 8.5 },
            { frame: 2, milliseconds: 8.1 },
            { frame: 3, milliseconds: 8.4 },
          ]),
          scenario: Object.freeze({
            clock,
            id: 'S01',
            latencyMs: 120,
            marker: 'SIMULATED SCENARIO',
            seed: 2_001,
          }),
        }),
      });
    },
    {
      clock: FROZEN_CLOCK,
      composition: {
        appScale: 100,
        forcedColors: false,
        initialPath: '/home',
        operationalState: 'fixture',
        reducedMotion: true,
        scenarioId: CANONICAL_SCENARIO_ID,
        textScale: 100,
        viewportWidth: APPROVED_VIEWPORT.width,
        windowsLocale: locale === 'en' ? 'en-US' : locale,
      },
    },
  );
  await page.goto(EXECUTABLE_URL, { waitUntil: 'networkidle' });
  await page.locator('.desktop-app-shell').waitFor({ state: 'visible' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const style = document.createElement('style');
    style.dataset['captureFreeze'] = 'true';
    style.textContent =
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
    document.head.append(style);
  });
};

const captureWebp = async (page: Page): Promise<Buffer> => {
  const session = await page.context().newCDPSession(page);
  const response = (await session.send('Page.captureScreenshot', {
    captureBeyondViewport: false,
    clip: {
      height: APPROVED_VIEWPORT.height,
      scale: 1,
      width: APPROVED_VIEWPORT.width,
      x: 0,
      y: 0,
    },
    format: 'webp',
    fromSurface: true,
    quality: 100,
  })) as Readonly<{ data: string }>;
  return Buffer.from(response.data, 'base64');
};

const writeAtomically = async (path: string, value: Uint8Array | string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.capture-tmp`;
  await writeFile(temporaryPath, value);
  try {
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
};

export const captureDesktopProduct = async (
  options: CaptureToolOptions,
): Promise<CaptureVerificationResult> => {
  if (options.manifestPath.replaceAll('\\', '/') !== CAPTURE_MANIFEST_PATH) {
    return { captures: 0, diagnostics: ['MANIFEST_PATH_NOT_ALLOWLISTED'], ok: false };
  }
  const repositoryRoot = resolve(options.repositoryRoot);
  ensureTrackedDesktopSource(repositoryRoot);
  const commit = currentCommit(repositoryRoot);
  const buildId = `desktop-production-${commit.slice(0, 12)}`;
  const sourceInputs = await collectSourceInputs(repositoryRoot);
  const existing = asManifest(await readJson(resolve(repositoryRoot, options.manifestPath)));
  const server = await startExecutableDesktop(repositoryRoot);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const browserVersion = browser.version();
    const captures: DesktopCaptureEntry[] = [];
    for (const requested of existing.captures) {
      const context = await browser.newContext({
        colorScheme: 'dark',
        deviceScaleFactor: 1,
        locale: requested.locale === 'en' ? 'en-US' : requested.locale,
        reducedMotion: 'reduce',
        viewport: APPROVED_VIEWPORT,
      });
      try {
        const page = await context.newPage();
        await composeDesktop(page, requested.locale);
        const image = await captureWebp(page);
        const dimensions = parseWebpDimensions(image);
        if (
          dimensions?.width !== APPROVED_VIEWPORT.width ||
          dimensions.height !== APPROVED_VIEWPORT.height
        ) {
          throw new Error('Chromium returned a WebP with unexpected dimensions.');
        }
        const checksum = sha256(image);
        const paths = expectedPaths(requested.locale);
        const entry: DesktopCaptureEntry = {
          buildId,
          captureCommand: CAPTURE_COMMAND,
          crop: { ...APPROVED_VIEWPORT, x: 0, y: 0 },
          height: dimensions.height,
          id: `desktop-home-${requested.locale}`,
          imageSha256: checksum,
          locale: requested.locale,
          outputPath: paths.outputPath,
          review: { approvedBy: 'phase-03-ui-contract', state: 'approved' },
          scenarioId: CANONICAL_SCENARIO_ID,
          sidecarPath: paths.sidecarPath,
          version: requested.version,
          viewport: APPROVED_VIEWPORT,
          width: dimensions.width,
        };
        const sidecar = {
          captureCommand: CAPTURE_COMMAND,
          checksum,
          crop: `x=0,y=0,width=${String(dimensions.width)},height=${String(dimensions.height)}; non-destructive full-frame`,
          locale: requested.locale,
          reviewState: 'approved',
          scenarioId: CANONICAL_SCENARIO_ID,
          sourceCommit: commit,
          version: requested.version,
          viewport: `${String(dimensions.width)}x${String(dimensions.height)}`,
        };
        const validation = validateWebDocument(sidecar);
        if (!validation.ok || !('scenarioId' in validation.value)) {
          throw new Error('Generated ScreenshotProvenance validation rejected capture sidecar.');
        }
        await Promise.all([
          writeAtomically(resolve(repositoryRoot, entry.outputPath), image),
          writeAtomically(
            resolve(repositoryRoot, entry.sidecarPath),
            `${JSON.stringify(sidecar, null, 2)}\n`,
          ),
        ]);
        captures.push(entry);
      } finally {
        await context.close();
      }
    }
    const manifest: DesktopCaptureManifest = {
      captures,
      environment: {
        animations: 'disabled',
        browser: 'chromium',
        browserVersion,
        fonts: FONTS,
        frozenClock: FROZEN_CLOCK,
        operatingSystem: `Windows ${release()}`,
      },
      schemaVersion: 1,
      source: {
        buildId,
        executableUrl: EXECUTABLE_URL,
        kind: 'executable-desktop',
        launchCommand:
          'pnpm --filter @liiiraa/desktop build && pnpm --filter @liiiraa/desktop exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
        sourceCommit: commit,
        sourceInputs,
      },
    };
    await writeAtomically(
      resolve(repositoryRoot, options.manifestPath),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  } finally {
    await browser?.close();
    stopExecutableDesktop(server);
  }
  return verifyDesktopCapture(options);
};

const optionValue = (arguments_: readonly string[], name: string): string | undefined => {
  const index = arguments_.indexOf(name);
  return index === -1 ? undefined : arguments_[index + 1];
};

const runCli = async (): Promise<void> => {
  const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--');
  const capture = arguments_.includes('--capture');
  const check = arguments_.includes('--check');
  if (capture === check) throw new Error('Choose exactly one mode: --capture or --check.');
  const repositoryRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
  const manifestPath = optionValue(arguments_, '--capture-manifest') ?? CAPTURE_MANIFEST_PATH;
  const result = capture
    ? await captureDesktopProduct({ manifestPath, repositoryRoot })
    : await verifyDesktopCapture({ manifestPath, repositoryRoot });
  if (!result.ok) {
    throw new Error(`Desktop capture verification failed:\n${result.diagnostics.join('\n')}`);
  }
  process.stdout.write(
    `[desktop-capture] verified ${String(result.captures)} executable capture(s) without regeneration.\n`,
  );
};

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  runCli().catch((error: unknown) => {
    process.stderr.write(
      `[desktop-capture] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
