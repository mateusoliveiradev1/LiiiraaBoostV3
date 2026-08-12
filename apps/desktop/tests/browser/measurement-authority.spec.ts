import { expect, test, type Page } from '@playwright/test';

import { expectNoAxeViolations } from './axe.ts';
import { openDesktopTestCase } from './fixtures.ts';

type EvidenceHarnessMode = 'ready' | 'stale-after-refresh';

const installDeterministicEvidence = async (
  page: Page,
  mode: EvidenceHarnessMode = 'ready',
): Promise<void> => {
  await page.addInitScript((harnessMode) => {
    const now = '2030-01-15T18:00:00.000Z';
    const inventoryHash = `sha256:${'a'.repeat(64)}`;
    const execution = Object.freeze({
      sourceCapability: 'native-readonly',
      deadlineAt: '2030-01-15T18:00:10.000Z',
      cancellationState: 'not-requested',
      health: Object.freeze({
        state: 'healthy',
        checkedAt: now,
        detail: 'The local Windows collector is ready.',
      }),
      overhead: Object.freeze({
        sampleWindowMs: 1_000,
        cpuTimeMs: 8,
        peakWorkingSetBytes: '8388608',
        quality: 'valid',
      }),
    });
    const observed = (value: string) =>
      Object.freeze({
        state: 'observed',
        value,
        source: 'windows-native-api',
        observedAt: now,
      });
    const inventory = Object.freeze({
      kind: 'inventory-snapshot',
      schemaVersion: '1.0',
      evidenceId: 'inventory-browser-authority-1',
      evidenceVersion: 1,
      collectedAt: now,
      evidenceHash: inventoryHash,
      execution,
      cpu: observed('AMD Ryzen 7 7800X3D'),
      gpu: observed('NVIDIA GeForce RTX 4070'),
      memory: observed('32 GB DDR5'),
      storage: observed('NVMe SSD'),
      network: observed('Ethernet 2.5 GbE'),
      display: observed('2560 × 1440 · 144 Hz'),
      audio: Object.freeze({
        state: 'unavailable',
        reasonCode: 'not-reported',
        detail: 'Windows did not report an active audio endpoint.',
      }),
      usb: observed('4 controllers'),
      windows: observed('Windows 11 Pro · 24H2'),
      drivers: observed('12 signed packages'),
      security: observed('Secure Boot enabled'),
      games: Object.freeze({
        state: 'unavailable',
        reasonCode: 'not-discovered',
        detail: 'No supported game was discovered.',
      }),
    });

    const evidenceInvoke = async (
      command: string,
      argumentsValue?: Readonly<Record<string, unknown>>,
    ): Promise<unknown> => {
      if (command === 'read_hardware_inventory') return inventory;
      if (command === 'refresh_hardware_inventory') {
        if (harnessMode === 'stale-after-refresh') {
          throw new Error('The deterministic refresh source became unavailable.');
        }
        return Object.freeze({
          ...inventory,
          evidenceId: 'inventory-browser-authority-2',
          evidenceVersion: 2,
        });
      }
      if (command === 'start_measurement_capture') {
        const request = (argumentsValue?.['request'] ?? {}) as Readonly<Record<string, unknown>>;
        return Object.freeze({
          kind: 'measurement-session',
          schemaVersion: '1.0',
          sessionId: request['sessionId'] ?? 'session-browser-authority-1',
          evidenceVersion: request['evidenceVersion'] ?? 1,
          status: 'incomplete',
          startedAt: request['startedAt'] ?? now,
          execution,
          baseline: Object.freeze({
            baselineId: request['baselineId'] ?? 'baseline-browser-authority-1',
            inventoryEvidenceId: request['inventoryEvidenceId'] ?? 'inventory-browser-authority-1',
            inventoryEvidenceHash: request['inventoryEvidenceHash'] ?? inventoryHash,
            capturedAt: request['startedAt'] ?? now,
          }),
          chunks: Object.freeze([]),
          reason: 'Capture is active.',
        });
      }
      if (command === 'sample_measurement_capture') {
        return Object.freeze({
          schemaVersion: '1.0',
          readOnly: true,
          cpu: Object.freeze({
            state: 'observed',
            value: 21,
            unit: 'percent',
            source: 'deterministic-browser-authority',
            detail: 'Deterministic browser sample.',
          }),
          memory: Object.freeze({
            state: 'observed',
            usedBytes: 10_737_418_240,
            totalBytes: 34_359_738_368,
            loadPercent: 31,
            source: 'deterministic-browser-authority',
            detail: 'Deterministic browser sample.',
          }),
          gpu: Object.freeze({
            state: 'unavailable',
            value: null,
            unit: 'percent',
            source: 'none',
            detail: 'No trustworthy GPU source is admitted.',
            reasonCode: 'source-not-admitted',
          }),
          collectionLatency: Object.freeze({
            state: 'observed',
            value: 0.4,
            unit: 'milliseconds',
            source: 'deterministic-browser-authority',
            detail: 'Deterministic browser sample.',
          }),
        });
      }
      if (command === 'finish_measurement_capture') {
        const request = (argumentsValue?.['request'] ?? {}) as Readonly<Record<string, unknown>>;
        const completedAt = request['completedAt'] ?? '2030-01-15T18:01:00.000Z';
        return Object.freeze({
          kind: 'measurement-session',
          schemaVersion: '1.0',
          sessionId: 'session-browser-authority-1',
          evidenceVersion: 1,
          status: 'completed',
          startedAt: now,
          completedAt,
          execution,
          baseline: Object.freeze({
            baselineId: 'baseline-browser-authority-1',
            inventoryEvidenceId: 'inventory-browser-authority-1',
            inventoryEvidenceHash: inventoryHash,
            capturedAt: now,
          }),
          chunks: Object.freeze([
            Object.freeze({
              chunkId: 'session-browser-authority-1-chunk-0',
              sequence: 0,
              startedAt: now,
              endedAt: completedAt,
              metric: 'cpu-utilization-percent',
              unit: 'percent',
              values: Object.freeze([18, 21, 19]),
              evidenceHash: `sha256:${'b'.repeat(64)}`,
              quality: 'valid',
            }),
          ]),
          evidenceHash: `sha256:${'c'.repeat(64)}`,
          limitations: Object.freeze(['Deterministic browser authority fixture.']),
        });
      }
      if (command === 'cancel_measurement_capture') {
        return Object.freeze({ state: 'acknowledged', latencyMs: 16 });
      }
      if (command === 'read_evidence_health') {
        return Object.freeze({
          authority: 'available',
          inventory: 'ready',
          capture: 'idle',
          comparisons: 0,
          reports: 0,
          overhead: Object.freeze({
            counterPollCeilingHz: 1,
            cancellationBudgetMs: 250,
            elevated: false,
          }),
        });
      }
      throw new Error(`Unexpected deterministic evidence command: ${command}`);
    };

    Object.defineProperty(globalThis, '__LIIIRAA_DESKTOP_EVIDENCE_INVOKE__', {
      configurable: false,
      enumerable: false,
      value: evidenceInvoke,
      writable: false,
    });
  }, mode);
};

const openMeasurementAuthority = async (
  page: Page,
  options: Readonly<{
    appScale?: 100 | 125 | 150;
    locale?: 'en-US' | 'pt-BR';
    mode?: EvidenceHarnessMode;
    path?: string;
    reducedMotion?: boolean;
    textScale?: 100 | 200;
  }> = {},
): Promise<void> => {
  await installDeterministicEvidence(page, options.mode);
  await openDesktopTestCase(page, {
    evidenceMode: 'deterministic',
    initialPath: options.path ?? '/measure/overview',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: options.locale ?? 'en-US',
    ...(options.appScale === undefined ? {} : { appScale: options.appScale }),
    ...(options.reducedMotion === undefined ? {} : { reducedMotion: options.reducedMotion }),
    ...(options.textScale === undefined ? {} : { textScale: options.textScale }),
  });
  await expect(page.locator('.lb-native-measure')).toHaveAttribute(
    'data-evidence-origin',
    'deterministic',
  );
};

test('measurement authority renders observed and unavailable facts without invented values', async ({
  page,
}) => {
  await openMeasurementAuthority(page);

  const workspace = page.locator('.lb-native-measure');
  await expect(workspace).toContainText('AMD Ryzen 7 7800X3D');
  await expect(workspace).toContainText('NVIDIA GeForce RTX 4070');
  await expect(workspace).toContainText('Windows 11 Pro · 24H2');
  await expect(workspace).toContainText('DEMO · S01');
  await expect(workspace).toContainText('Controlled test data');

  const unavailableAudio = page.locator('#evidence-audio');
  await expect(unavailableAudio).toHaveAttribute('data-evidence-state', 'unavailable');
  await expect(unavailableAudio).toContainText('Audio unavailable');
  await expect(unavailableAudio).toContainText('Windows did not report an active audio endpoint.');
  await expect(unavailableAudio).not.toContainText(/\b\d+(?:[.,]\d+)?\s*(?:%|ms|Hz|GB)\b/u);

  const unavailableGames = page.locator('#evidence-games');
  await expect(unavailableGames).toHaveAttribute('data-evidence-state', 'unavailable');
  await expect(unavailableGames).not.toContainText(/\b\d+(?:[.,]\d+)?\b/u);

  await expectNoAxeViolations(page, ['.lb-native-measure']);
  await expect(page.locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])')).toHaveCount(0);
});

test('measurement authority retains inputs and distinguishes finishing from cancelling', async ({
  page,
}) => {
  await openMeasurementAuthority(page, { path: '/measure/capture' });

  const environment = page.getByLabel('Confirmed environment');
  const note = page.getByLabel('Capture note');
  await environment.fill('Northstar controlled route');
  await note.fill('Stable 60 second workload');

  const refresh = page.getByRole('button', { name: 'Refresh inventory' });
  await refresh.focus();
  await page.keyboard.press('Enter');
  await expect(refresh).not.toHaveAttribute('aria-busy', 'true');
  await expect(environment).toHaveValue('Northstar controlled route');
  await expect(note).toHaveValue('Stable 60 second workload');

  const capture = page.locator('.lb-native-capture');
  const start = page.getByRole('button', { name: 'Start capture' });
  await start.focus();
  await page.keyboard.press('Enter');
  await expect(capture).toHaveAttribute('data-capture-active', 'true');
  await expect(page.getByRole('button', { name: 'Finish and save capture' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel collection' })).toBeVisible();
  await expect(environment).toHaveValue('Northstar controlled route');
  await expect(note).toHaveValue('Stable 60 second workload');

  const finish = page.getByRole('button', { name: 'Finish and save capture' });
  await finish.focus();
  await page.keyboard.press('Enter');
  await expect(capture).toHaveAttribute('data-capture-active', 'false');
  await expect(page.getByRole('button', { name: 'Start capture' })).toBeVisible();
  await expect(environment).toHaveValue('Northstar controlled route');
  await expect(note).toHaveValue('Stable 60 second workload');

  await start.click();
  await expect(capture).toHaveAttribute('data-capture-active', 'true');
  const cancel = page.getByRole('button', { name: 'Cancel collection' });
  await cancel.focus();
  await page.keyboard.press('Enter');
  await expect(capture).toHaveAttribute('data-capture-active', 'false');
  await expect(page.getByRole('button', { name: 'Start capture' })).toBeVisible();
  await expect(environment).toHaveValue('Northstar controlled route');
  await expect(note).toHaveValue('Stable 60 second workload');
});

test('measurement authority preserves the last truthful snapshot when refresh fails', async ({
  page,
}) => {
  await openMeasurementAuthority(page, { mode: 'stale-after-refresh' });

  await expect(page.locator('#evidence-cpu')).toContainText('AMD Ryzen 7 7800X3D');
  await page.getByRole('button', { name: 'Refresh inventory' }).click();

  const workspace = page.locator('.lb-native-measure');
  await expect(workspace).toHaveAttribute('data-evidence-stale', 'true');
  await expect(workspace).toContainText('Inventory is out of date');
  await expect(workspace).toContainText('AMD Ryzen 7 7800X3D');
  await expect(workspace).toContainText('Evidence was not updated: COMMAND_FAILED.');
  await expect(page.getByRole('button', { name: 'Start capture' })).toHaveCount(0);
});

test('measurement authority remains readable at 150 percent app scale and narrow width', async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 760 });
  await openMeasurementAuthority(page, {
    appScale: 150,
    locale: 'pt-BR',
    reducedMotion: true,
    textScale: 200,
  });

  const workspace = page.locator('.lb-native-measure');
  await expect(workspace).toContainText('Desempenho real');
  await expect(workspace).toContainText('Hardware observado');
  await expect(page.locator('#evidence-audio')).toContainText('Áudio indisponível');

  const geometry = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    workspaceClientWidth:
      document.querySelector<HTMLElement>('.lb-native-measure')?.clientWidth ?? 0,
    workspaceScrollWidth:
      document.querySelector<HTMLElement>('.lb-native-measure')?.scrollWidth ?? 0,
  }));
  expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.documentClientWidth + 1);
  expect(geometry.workspaceScrollWidth).toBeLessThanOrEqual(geometry.workspaceClientWidth + 1);

  await expectNoAxeViolations(page, ['.lb-native-measure']);
  const screenshot = await workspace.screenshot({ animations: 'disabled' });
  expect(screenshot.byteLength).toBeGreaterThan(10_000);
});

test('measurement authority keeps route navigation keyboard-operable and references stable', async ({
  page,
}) => {
  await openMeasurementAuthority(page);

  const sessions = page.getByRole('button', { name: 'Session history' });
  await sessions.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/measure/sessions',
  );
  await expect(page.getByRole('heading', { name: 'Local history' })).toBeVisible();

  const compare = page.getByRole('button', { name: 'Valid comparison' });
  await compare.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute(
    'data-route-path',
    '/measure/compare',
  );
  await expect(page.locator('[data-comparison-verdict="none"]')).toBeVisible();
  await expect(page.locator('[data-comparison-verdict="none"]')).not.toContainText(
    /\d+(?:\.\d+)?%/u,
  );

  const overview = page.locator('.lb-native-measure-nav').getByRole('button', { name: 'Overview' });
  await overview.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#evidence-cpu')).toContainText('AMD Ryzen 7 7800X3D');
});
