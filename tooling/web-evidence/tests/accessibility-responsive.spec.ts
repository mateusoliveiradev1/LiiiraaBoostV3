import { createHash } from 'node:crypto';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

type Surface = 'public' | 'account' | 'admin';

type VisualOrigin =
  'http://public.localhost:3100' | 'http://account.localhost:3101' | 'http://admin.localhost:3102';

type Scenario = Readonly<{
  clock: string;
  id: string;
  locale: 'pt-BR' | 'en';
  routeId: string;
  viewport: string;
}>;

type VisualEntry = Readonly<{
  approved: false;
  candidatePurpose: 'revised-geometry-focal-state-review';
  captureId: string;
  comparisonSource: 'phase-02-approved-desktop-captures';
  forcedColors: 'none' | 'active';
  locale: Scenario['locale'];
  localeReview: 'pt-BR-default' | 'en-parity';
  motion: 'no-preference' | 'reduce';
  priorEvidenceStatus: 'invalidated-rejected-pixels';
  published: false;
  rebaselineOwner: 'plan-03-62';
  reviewPurpose: string;
  route: string;
  routeId: string;
  scenarioId?: string;
  snapshotPath: string;
  sourceBinding: 'current-source-candidate';
  sourceHash?: string;
  state: string;
  status: 'candidate';
  surface: Surface;
  textScale: number;
  visualTarget: false;
  viewport: string;
  zoom: number;
}>;

const scenarioDocument = JSON.parse(
  readFileSync(new URL('../../../contracts/scenarios/web-scenarios.json', import.meta.url), 'utf8'),
) as Readonly<{ scenarios: readonly Scenario[] }>;

const visualManifest = JSON.parse(
  readFileSync(new URL('../visual-manifest.json', import.meta.url), 'utf8'),
) as Readonly<{
  entries: readonly VisualEntry[];
  origins: Readonly<Record<Surface, VisualOrigin>>;
  schemaVersion: number;
  source: string;
}>;

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const REACT_EVAL_CSP_ERROR =
  /(?:eval\(\) is not supported in this environment|React requires eval\(\) in development mode)/iu;

const developmentSurfaces = Object.freeze([
  {
    app: '@liiiraa/web',
    existingOrigin: 'http://public.localhost:3000',
    origin: 'http://public.localhost:3200',
    route: '/en',
  },
  {
    app: '@liiiraa/account',
    existingOrigin: 'http://account.localhost:3001',
    origin: 'http://account.localhost:3201',
    route: '/en/account/security',
  },
  {
    app: '@liiiraa/admin',
    existingOrigin: 'http://admin.localhost:3002',
    origin: 'http://admin.localhost:3202',
    route: '/en/admin/audit?role=audit',
  },
] as const);

const waitForDevelopmentServer = async (
  child: ChildProcessWithoutNullStreams,
  url: string,
  output: readonly string[],
): Promise<void> => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Development server exited early (${child.exitCode}).\n${output.join('')}`);
    }
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {
      // The server is still compiling its first route.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Development server did not become ready: ${url}\n${output.join('')}`);
};

const stopDevelopmentServer = (child: ChildProcessWithoutNullStreams): void => {
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  process.kill(-child.pid, 'SIGTERM');
};

const AXIS_BY_VIEWPORT = Object.freeze({
  '1280x800': 'wide-1280',
  '1440x900': 'wide-1440',
  '320x800': 'reflow-320',
  '390x844': 'mobile-390',
  '960x900': 'desktop-960',
} as const);

const surfaceFor = (routeId: string): Surface =>
  routeId.startsWith('account-') ? 'account' : routeId.startsWith('admin-') ? 'admin' : 'public';

const routeFor = ({ locale, routeId }: Scenario): string => {
  switch (routeId) {
    case 'public-home':
      return `/${locale}`;
    case 'docs-index':
      return `/${locale}/docs/current`;
    case 'docs-history':
      return `/${locale}/docs/history/1.0.0/legacy-capture`;
    case 'docs-troubleshooting':
      return `/${locale}/docs/current/troubleshooting/lb-err-0x80070005`;
    case 'public-search':
      return `/${locale}/search?q=no-such-trusted-record&availability=available`;
    case 'releases-download':
      return `/${locale}/download/stable/current`;
    case 'releases-integrity':
      return `/${locale}/releases/stable/current/integrity`;
    case 'public-status':
      return `/${locale}/status`;
    case 'account-sign-in':
      return `/${locale}/login`;
    case 'account-overview':
      return `/${locale}/account`;
    case 'account-privacy':
      return `/${locale}/account/privacy`;
    case 'admin-support':
      return `/${locale}/admin/support/case-preview?role=support`;
    case 'admin-security':
      return `/${locale}/admin/security/review-preview?role=security`;
    case 'admin-operations':
      return `/${locale}/admin/operations/review-preview?role=operations`;
    case 'public-error-404':
      return `/${locale}/errors/404`;
    default:
      throw new Error(`No visual route projection for ${routeId}.`);
  }
};

const onlyAxis = (testInfo: TestInfo, axis: string): void => {
  test.skip(testInfo.project.metadata['axis'] !== axis, `Covered by the ${axis} project.`);
};

const expectNoBlockingAxeViolations = async (page: Page): Promise<void> => {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations
    .filter(({ impact }) => impact === 'critical' || impact === 'serious')
    .map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map(({ target }) => target),
    }));
  expect(blocking, `Blocking axe findings:\n${JSON.stringify(blocking, null, 2)}`).toEqual([]);
};

const expectPublicHomeAuthoringParity = async (page: Page): Promise<void> => {
  if ((await page.locator('.public-home').count()) === 0) return;

  const parity = await page.evaluate(() => {
    const requiredSelectors = [
      '.public-header',
      '.home-ignition-hero',
      '.home-ignition-hero__promise',
      '.home-ignition-hero__stage',
      '.home-player-problem',
      '.home-workflow > header',
      '.home-proof-sequence > li',
      '.home-mode-split',
      '.home-results-method',
      '.home-final-cta',
    ] as const;
    const missing = requiredSelectors.filter(
      (selector) => document.querySelector(selector) === null,
    );
    const elementFor = (selector: (typeof requiredSelectors)[number]): HTMLElement => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`PUBLIC_HOME_AUTHORING_PARITY:missing:${selector}`);
      }
      return element;
    };
    const boxAndStyle = (selector: (typeof requiredSelectors)[number]) => {
      const element = elementFor(selector);
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        bottom: box.bottom,
        columnGap: Number.parseFloat(style.columnGap),
        display: style.display,
        fontSize: Number.parseFloat(style.fontSize),
        height: box.height,
        left: box.left,
        position: style.position,
        right: box.right,
        textAlign: style.textAlign,
        top: box.top,
        width: box.width,
      };
    };
    const visibleLocaleCount = [...document.querySelectorAll('.lb-web-locale-switcher')].filter(
      (node) => {
        if (!(node instanceof HTMLElement)) return false;
        if (node.closest('details:not([open])') !== null) return false;
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return (
          box.width > 0 &&
          box.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      },
    ).length;

    return {
      context: boxAndStyle('.home-results-method'),
      header: boxAndStyle('.public-header'),
      headerCount: document.querySelectorAll('.public-header').length,
      heading: boxAndStyle('.home-ignition-hero__promise'),
      hero: boxAndStyle('.home-ignition-hero'),
      missing,
      modes: boxAndStyle('.home-mode-split'),
      prepare: boxAndStyle('.home-workflow > header'),
      release: boxAndStyle('.home-final-cta'),
      stage: boxAndStyle('.home-ignition-hero__stage'),
      workflowRow: boxAndStyle('.home-proof-sequence > li'),
      viewportWidth: document.documentElement.clientWidth,
      visibleLocaleCount,
    };
  });

  expect(parity.missing, 'PUBLIC_HOME_AUTHORING_PARITY: required nodes must exist').toEqual([]);
  expect(parity.headerCount, 'PUBLIC_HOME_AUTHORING_PARITY: exactly one header').toBe(1);
  expect(parity.visibleLocaleCount, 'PUBLIC_HOME_AUTHORING_PARITY: one locale projection').toBe(1);
  expect(parity.header.position, 'PUBLIC_HOME_AUTHORING_PARITY: sticky shell').toBe('sticky');
  expect(
    parity.header.height,
    'PUBLIC_HOME_AUTHORING_PARITY: authored header height',
  ).toBeGreaterThanOrEqual(60);
  expect(
    parity.header.height,
    'PUBLIC_HOME_AUTHORING_PARITY: authored header height',
  ).toBeLessThanOrEqual(74);
  expect(
    Math.abs(parity.header.bottom - parity.hero.top),
    'PUBLIC_HOME_AUTHORING_PARITY: header must not overlap initial hero geometry',
  ).toBeLessThanOrEqual(1);
  expect(parity.hero.display, 'PUBLIC_HOME_AUTHORING_PARITY: hero grid binding').toBe('grid');
  expect(parity.hero.position, 'PUBLIC_HOME_AUTHORING_PARITY: hero positioning binding').toBe(
    'relative',
  );
  expect(parity.heading.textAlign, 'PUBLIC_HOME_AUTHORING_PARITY: centered promise').toBe('center');
  expect(
    parity.heading.fontSize,
    'PUBLIC_HOME_AUTHORING_PARITY: authored promise scale',
  ).toBeGreaterThanOrEqual(parity.viewportWidth >= 960 ? 51.5 : 36);
  expect(
    parity.heading.fontSize,
    'PUBLIC_HOME_AUTHORING_PARITY: bounded promise scale',
  ).toBeLessThanOrEqual(80);
  expect(
    parity.hero.width,
    'PUBLIC_HOME_AUTHORING_PARITY: bounded hero measure',
  ).toBeLessThanOrEqual(1_320);
  expect(
    Math.abs(parity.hero.left + parity.hero.width / 2 - parity.viewportWidth / 2),
    'PUBLIC_HOME_AUTHORING_PARITY: centered hero measure',
  ).toBeLessThanOrEqual(2);
  expect(parity.stage.position, 'PUBLIC_HOME_AUTHORING_PARITY: staged product positioning').toBe(
    'relative',
  );
  expect(
    parity.stage.width,
    'PUBLIC_HOME_AUTHORING_PARITY: controlled product width',
  ).toBeGreaterThanOrEqual(parity.hero.width * (parity.viewportWidth >= 960 ? 0.75 : 0.8));
  expect(parity.prepare.display, 'PUBLIC_HOME_AUTHORING_PARITY: sequence grid binding').toBe(
    'grid',
  );
  expect(parity.context.display, 'PUBLIC_HOME_AUTHORING_PARITY: context grid binding').toBe('grid');
  expect(parity.modes.display, 'PUBLIC_HOME_AUTHORING_PARITY: plan split binding').toBe('block');
  expect(
    parity.release.display,
    'PUBLIC_HOME_AUTHORING_PARITY: responsive final CTA layout binding',
  ).toBe(parity.viewportWidth >= 960 ? 'flex' : 'grid');
  expect(
    parity.workflowRow.display,
    'PUBLIC_HOME_AUTHORING_PARITY: workflow row grid binding',
  ).toBe('grid');
  expect(
    parity.workflowRow.columnGap,
    'PUBLIC_HOME_AUTHORING_PARITY: workflow row gap',
  ).toBeGreaterThanOrEqual(16);
};

const expectAccessibleResponsivePage = async (page: Page): Promise<void> => {
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('lang', /^(?:en|pt-BR)$/u);
  await expectPublicHomeAuthoringParity(page);

  const { horizontalOverflow, overflowSources } = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return {
      horizontalOverflow: document.documentElement.scrollWidth - viewportWidth,
      overflowSources: [...document.body.querySelectorAll<HTMLElement>('*')]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.right > viewportWidth + 1 || box.left < -1;
        })
        .slice(0, 10)
        .map(
          (element) =>
            `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${
              element.className ? `.${String(element.className).trim().replace(/\s+/gu, '.')}` : ''
            }`,
        ),
    };
  });
  expect(
    horizontalOverflow,
    `The route must not require ordinary two-axis scrolling. Overflow sources: ${overflowSources.join(', ')}`,
  ).toBeLessThanOrEqual(1);

  const undersizedControls = await page
    .locator('button, input, select, textarea, [role="button"]')
    .evaluateAll((controls) =>
      controls.flatMap((control) => {
        const element = control as HTMLElement;
        const box = element.getBoundingClientRect();
        const visible =
          box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
        return visible && (box.width < 24 || box.height < 24)
          ? [
              `${element.tagName.toLowerCase()}#${element.id || 'unnamed'}:${box.width}x${box.height}`,
            ]
          : [];
      }),
    );
  expect(
    undersizedControls,
    'Interactive controls must meet the 24 CSS px minimum target.',
  ).toEqual([]);

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', {
    name: /(?:skip to (?:(?:main|account|administrative) )?content|ir para o conteúdo (?:principal|da conta|administrativo))/iu,
  });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();

  await page.keyboard.press('Tab');
  const ordinaryFocus = page.locator(':focus');
  await expect(ordinaryFocus).toHaveCount(1);
  await expect(ordinaryFocus).toBeInViewport();
  expect(
    await ordinaryFocus.evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== 'none'
      );
    }),
    'Ordinary keyboard focus must have a visible authored indicator.',
  ).toBe(true);

  await expectNoBlockingAxeViolations(page);
};

const resetForNeutralCapture = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ left: 0, top: 0 });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await expect(page.locator(':focus')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })))
    .toEqual({ x: 0, y: 0 });
};

const isCandidateCaptureUpdate = (testInfo: TestInfo): boolean =>
  ['all', 'changed', 'missing'].includes(testInfo.config.updateSnapshots);

const expectCurrentCandidatePixels = async (page: Page, captureId: string): Promise<void> => {
  await resetForNeutralCapture(page);
  await expect(page).toHaveScreenshot(`${captureId}.png`, {
    animations: 'disabled',
    fullPage: true,
  });
};

const installStalePublicAuthoringSelectors = async (page: Page): Promise<readonly string[]> => {
  const neutralized: string[] = [];
  await page.route('**/*.css*', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const staleBody = body
      .replaceAll('.home-ignition-', '.stale-home-ignition-')
      .replaceAll('.home-player-', '.stale-home-player-')
      .replaceAll('.home-workflow', '.stale-home-workflow')
      .replaceAll('.home-proof-', '.stale-home-proof-')
      .replaceAll('.home-mode-', '.stale-home-mode-')
      .replaceAll('.home-results-', '.stale-home-results-')
      .replaceAll('.home-final-', '.stale-home-final-');
    if (staleBody !== body) neutralized.push(route.request().url());
    await route.fulfill({ body: staleBody, response });
  });
  return neutralized;
};

const projectInternalAccountScenario = async (page: Page, scenario: Scenario): Promise<void> => {
  if (scenario.id !== 'W12') return;
  expect(scenario).toMatchObject({
    locale: 'en',
    routeId: 'account-overview',
    terminalState: 'authority-unavailable',
  });
  const { createW12AccountCaptureProjection } = await import('../../../apps/account/src/index.ts');
  const projection = await createW12AccountCaptureProjection();
  expect(projection).toMatchObject({
    locale: scenario.locale,
    routeId: scenario.routeId,
    scenarioId: scenario.id,
  });

  const staticDocument = await page.evaluate((captureMarkup) => {
    const documentClone = document.documentElement.cloneNode(true) as HTMLElement;
    const currentProjection = documentClone.querySelector('[data-account-preview="deterministic"]');
    const template = document.createElement('template');
    template.innerHTML = captureMarkup.trim();
    const captureProjection = template.content.firstElementChild;
    if (currentProjection === null || captureProjection === null) {
      throw new Error('W12_CAPTURE_PROJECTION_UNAVAILABLE');
    }
    currentProjection.replaceWith(captureProjection);
    documentClone.querySelectorAll('script').forEach((script) => script.remove());
    documentClone.dataset['evidenceProjection'] = 'W12';
    return `<!doctype html>${documentClone.outerHTML}`;
  }, projection.markup);
  await page.setContent(staticDocument, { waitUntil: 'load' });

  const experience = page.locator('[data-account-preview="deterministic"]');
  await expect(page.locator('html')).toHaveAttribute('data-evidence-projection', 'W12');
  await expect(page.locator('script')).toHaveCount(0);
  await expect(experience).toHaveAttribute('data-scenario-id', 'W12');
  await expect(experience.locator('article')).toHaveAttribute(
    'data-account-state',
    'offline stale expired-session partial-failure',
  );
  await expect(experience).toContainText('Account information cannot be refreshed right now.');
  await expect(experience.locator('p[role="status"]')).toContainText(
    'Display name, language, and support subject remain available',
  );
  await expect(
    experience.getByRole('navigation', { name: 'Safe recovery' }).getByRole('link'),
  ).toHaveText(['Review sign-in', 'Open support']);
};

test('@final @public development CSP is browser-clean on every separate origin', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  test.setTimeout(180_000);

  for (const surface of developmentSurfaces) {
    const output: string[] = [];
    let origin = surface.origin;
    let child: ChildProcessWithoutNullStreams | undefined;

    try {
      const existingResponse = await fetch(`${surface.existingOrigin}${surface.route}`);
      if (existingResponse.headers.get('content-security-policy')?.includes("'unsafe-eval'")) {
        origin = surface.existingOrigin;
      }
    } catch {
      // No compatible existing development server; start an isolated evidence server below.
    }

    if (origin === surface.origin) {
      child = spawn(
        process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
        [
          '--filter',
          surface.app,
          'dev',
          '--hostname',
          new URL(surface.origin).hostname,
          '--port',
          new URL(surface.origin).port,
        ],
        {
          cwd: repositoryRoot,
          detached: process.platform !== 'win32',
          env: {
            ...process.env,
            NODE_ENV: 'development',
            ...(surface.app === '@liiiraa/admin' ? { LIIIRAA_ADMIN_ORIGIN: surface.origin } : {}),
          },
          shell: process.platform === 'win32',
          stdio: 'pipe',
        },
      );
      child.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
      child.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
    }

    try {
      const url = `${origin}${surface.route}`;
      if (child !== undefined) await waitForDevelopmentServer(child, url, output);
      const consoleErrors: string[] = [];
      const onConsole = (message: { text(): string }) => {
        if (REACT_EVAL_CSP_ERROR.test(message.text())) consoleErrors.push(message.text());
      };
      page.on('console', onConsole);
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      expect(response).not.toBeNull();
      expect(response?.headers()['content-security-policy']).toContain("'unsafe-eval'");
      await expect(page.locator('main')).toBeVisible();
      if (surface.app === '@liiiraa/web') await expectPublicHomeAuthoringParity(page);
      await page.waitForTimeout(500);
      expect(consoleErrors, `${surface.app} emitted the reported React/Turbopack error`).toEqual(
        [],
      );
      page.off('console', onConsole);
    } finally {
      if (child !== undefined) stopDevelopmentServer(child);
    }
  }
});

test('@final @public CSP origin, noindex, authority, role, and release gates remain closed', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');

  await page.goto('http://public.localhost:3100/en/download/stable/current');
  expect(new URL(page.url()).origin).toBe('http://public.localhost:3100');
  await expect(page.locator('a[href$=".exe"]')).toHaveCount(0);
  await expect(page.locator('[data-release-route="releases-download"]')).toBeVisible();

  await page.goto('http://account.localhost:3101/en/account/security');
  expect(new URL(page.url()).origin).toBe('http://account.localhost:3101');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/iu);
  await expect(page.locator('[data-authority-connected="false"]')).not.toHaveCount(0);
  await expect(page.locator('[data-authority-connected="true"]')).toHaveCount(0);

  await page.goto('http://admin.localhost:3102/en/admin/audit?role=audit');
  expect(new URL(page.url()).origin).toBe('http://admin.localhost:3102');
  await expect(page).toHaveURL(/\?role=audit$/u);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/iu);
  await expect(page.locator('[data-authoritative-access-connected="false"]')).not.toHaveCount(0);
  await expect(page.locator('[data-authoritative-access-connected="true"]')).toHaveCount(0);
});

test('@final @public visual manifest is an exact W01-W18 projection', async ({}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  expect(visualManifest.schemaVersion).toBe(2);
  expect(visualManifest.source).toBe('../../contracts/scenarios/web-scenarios.json');
  const scenarioEntries = visualManifest.entries.filter(
    (entry): entry is VisualEntry & Readonly<{ scenarioId: string; sourceHash: string }> =>
      entry.scenarioId !== undefined && entry.sourceHash !== undefined,
  );
  expect(scenarioEntries.map(({ scenarioId }) => scenarioId)).toEqual(
    scenarioDocument.scenarios.map(({ id }) => id),
  );

  for (const scenario of scenarioDocument.scenarios) {
    const entry = scenarioEntries.find(({ scenarioId }) => scenarioId === scenario.id);
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      captureId: scenario.id,
      locale: scenario.locale,
      route: routeFor(scenario),
      routeId: scenario.routeId,
      scenarioId: scenario.id,
      surface: surfaceFor(scenario.routeId),
      viewport: scenario.viewport,
    });
    expect(entry?.sourceHash).toBe(
      createHash('sha256').update(JSON.stringify(scenario)).digest('hex'),
    );
    expect(entry?.snapshotPath).toContain(`${scenario.id}-${surfaceFor(scenario.routeId)}-final-`);
  }
});

test('@final @public visual manifest closes all 25 records as unapproved Plan 03-62 candidates', async ({}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');

  expect(visualManifest.entries.map(({ captureId }) => captureId)).toEqual([
    ...Array.from({ length: 18 }, (_, index) => `W${String(index + 1).padStart(2, '0')}`),
    ...Array.from({ length: 7 }, (_, index) => `G${String(index + 1).padStart(2, '0')}`),
  ]);
  expect(visualManifest.entries).toHaveLength(25);

  const expectedOrigins = {
    account: 'http://account.localhost:3101',
    admin: 'http://admin.localhost:3102',
    public: 'http://public.localhost:3100',
  } as const satisfies Record<Surface, VisualOrigin>;
  expect(visualManifest.origins).toEqual(expectedOrigins);

  for (const entry of visualManifest.entries) {
    expect(entry).toMatchObject({
      approved: false,
      candidatePurpose: 'revised-geometry-focal-state-review',
      comparisonSource: 'phase-02-approved-desktop-captures',
      priorEvidenceStatus: 'invalidated-rejected-pixels',
      published: false,
      rebaselineOwner: 'plan-03-62',
      sourceBinding: 'current-source-candidate',
      status: 'candidate',
      visualTarget: false,
    });
    expect(entry.route).toMatch(/^\/(?:en|pt-BR)(?:\/|$)/u);
    expect(new URL(entry.route, visualManifest.origins[entry.surface]).origin).toBe(
      expectedOrigins[entry.surface],
    );
    expect(entry.routeId).not.toHaveLength(0);
    expect(entry.state).not.toHaveLength(0);
    expect(entry.viewport).toMatch(/^\d+x\d+$/u);
    expect(entry.reviewPurpose).toMatch(/(?:identity|shell|navigation|hierarchy|state|recovery)/iu);
  }

  for (const captureId of ['G01', 'G04', 'G06'] as const) {
    expect(visualManifest.entries.find((entry) => entry.captureId === captureId)).toMatchObject({
      priorEvidenceStatus: 'invalidated-rejected-pixels',
      visualTarget: false,
    });
  }

  for (const surface of ['public', 'account', 'admin'] as const) {
    const entries = visualManifest.entries.filter((entry) => entry.surface === surface);
    expect(new Set(entries.map(({ locale }) => locale))).toEqual(new Set(['pt-BR', 'en']));
    expect(entries.some(({ viewport }) => viewport === '390x844')).toBe(true);
    expect(entries.some(({ viewport }) => viewport !== '390x844' && viewport !== '320x800')).toBe(
      true,
    );
    expect(visualManifest.origins[surface]).toBe(expectedOrigins[surface]);
  }
});

test('@final @public candidate capture update mode enumerates exactly W01-W18 and G01-G07', async ({}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  const expectedCaptureIds = [
    ...Array.from({ length: 18 }, (_, index) => `W${String(index + 1).padStart(2, '0')}`),
    ...Array.from({ length: 7 }, (_, index) => `G${String(index + 1).padStart(2, '0')}`),
  ];
  const captureIdentities = visualManifest.entries.map(
    ({ captureId, snapshotPath, surface, viewport }) => ({
      captureId,
      project: `${surface}-final-${AXIS_BY_VIEWPORT[viewport as keyof typeof AXIS_BY_VIEWPORT]}`,
      snapshotPath,
    }),
  );

  expect(captureIdentities.map(({ captureId }) => captureId)).toEqual(expectedCaptureIds);
  expect(new Set(captureIdentities.map(({ captureId }) => captureId)).size).toBe(25);
  expect(new Set(captureIdentities.map(({ snapshotPath }) => snapshotPath)).size).toBe(25);
  for (const identity of captureIdentities) {
    expect(identity.snapshotPath).toBe(
      `tests/__screenshots__/accessibility-responsive.spec.ts/${identity.captureId}-${identity.project}.png`,
    );
  }
});

test('@final @public candidate update flag activates deterministic capture mode', async ({}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  test.skip(!isCandidateCaptureUpdate(testInfo), 'Proof-only gate runs only with update mode.');
  expect(isCandidateCaptureUpdate(testInfo)).toBe(true);
  expect(visualManifest.entries).toHaveLength(25);
});

test('@final @public authored style parity rejects stale Home selector bindings', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  const neutralized = await installStalePublicAuthoringSelectors(page);

  await page.goto('/pt-BR', { waitUntil: 'networkidle' });

  await expect(expectAccessibleResponsivePage(page)).rejects.toThrow(
    /PUBLIC_HOME_AUTHORING_PARITY/u,
  );
  expect(neutralized.length).toBeGreaterThan(0);
  await expect(page.locator('.public-header__bar')).toBeVisible();
});

for (const scenario of scenarioDocument.scenarios) {
  const surface = surfaceFor(scenario.routeId);
  const axis = AXIS_BY_VIEWPORT[scenario.viewport as keyof typeof AXIS_BY_VIEWPORT];
  if (axis === undefined) throw new Error(`Unsupported canonical viewport: ${scenario.viewport}`);

  test(`@final @${surface} @candidate-capture @project-${surface}-final-${axis} ${scenario.id} canonical accessible visual`, async ({
    page,
  }, testInfo) => {
    onlyAxis(testInfo, axis);
    expect(String(testInfo.project.metadata['frozenClock'])).toBe(scenario.clock);
    await page.goto(routeFor(scenario), { waitUntil: 'networkidle' });
    await projectInternalAccountScenario(page, scenario);
    await expectAccessibleResponsivePage(page);
    expect(visualManifest.entries.find(({ captureId }) => captureId === scenario.id)).toMatchObject(
      {
        priorEvidenceStatus: 'invalidated-rejected-pixels',
        status: 'candidate',
        visualTarget: false,
      },
    );
    await expectCurrentCandidatePixels(page, scenario.id);
  });
}

for (const entry of visualManifest.entries.filter(({ captureId }) => captureId.startsWith('G'))) {
  const axis = AXIS_BY_VIEWPORT[entry.viewport as keyof typeof AXIS_BY_VIEWPORT];
  if (axis === undefined) throw new Error(`Unsupported qualitative viewport: ${entry.viewport}`);

  test(`@final @${entry.surface} @candidate-capture @project-${entry.surface}-final-${axis} ${entry.captureId} qualitative review capture`, async ({
    page,
  }, testInfo) => {
    onlyAxis(testInfo, axis);
    await page.goto(entry.route, { waitUntil: 'networkidle' });
    await expectAccessibleResponsivePage(page);
    expect(entry).toMatchObject({
      priorEvidenceStatus: 'invalidated-rejected-pixels',
      status: 'candidate',
      visualTarget: false,
    });
    await expectCurrentCandidatePixels(page, entry.captureId);
  });
}

const representativeRoutes = Object.freeze({
  account: '/en/account/privacy',
  admin: '/en/admin/audit?role=audit',
  public: '/en',
} satisfies Record<Surface, string>);

for (const surface of ['public', 'account', 'admin'] as const) {
  for (const axis of ['reflow-320', 'text-200', 'reduced-motion', 'forced-colors'] as const) {
    test(`@final @${surface} W18 ${axis} accessibility contract`, async ({ page }, testInfo) => {
      onlyAxis(testInfo, axis);
      if (axis === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'reduce' });
      if (axis === 'forced-colors') await page.emulateMedia({ forcedColors: 'active' });
      await page.goto(representativeRoutes[surface], { waitUntil: 'networkidle' });

      if (axis === 'text-200') {
        const fontSize = await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
          return Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        });
        expect(fontSize).toBeGreaterThanOrEqual(32);
      }
      if (axis === 'reflow-320') {
        expect(testInfo.project.metadata['zoomPercent']).toBe(400);
      }
      if (axis === 'reduced-motion') {
        expect(
          await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
        ).toBe(true);
      }
      if (axis === 'forced-colors') {
        expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
      }

      await expectAccessibleResponsivePage(page);
    });
  }
}

test('@final @public W18 records CWV and route asset budgets with a ten-percent gate', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1280');
  await page.addInitScript(() => {
    const values = { cls: 0, inp: 0, lcp: 0 };
    Object.defineProperty(window, '__liiiraaWebVitals', { configurable: false, value: values });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) values.lcp = Math.max(values.lcp, entry.startTime);
    }).observe({ buffered: true, type: 'largest-contentful-paint' });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!shift.hadRecentInput) values.cls += shift.value;
      }
    }).observe({ buffered: true, type: 'layout-shift' });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const event = entry as PerformanceEntry & { duration: number; interactionId: number };
        if (event.interactionId > 0) values.inp = Math.max(values.inp, event.duration);
      }
    }).observe({ buffered: true, durationThreshold: 16, type: 'event' });
  });

  await page.goto('/en', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /skip to (?:main )?content/iu })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);

  const evidence = await page.evaluate(() => {
    const vitals = (
      window as unknown as { __liiiraaWebVitals: { cls: number; inp: number; lcp: number } }
    ).__liiiraaWebVitals;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return {
      ...vitals,
      imageBytes: resources
        .filter(({ initiatorType }) => initiatorType === 'img')
        .reduce((total, { transferSize }) => total + transferSize, 0),
      routeBytes: resources
        .filter(({ initiatorType }) => ['css', 'fetch', 'img', 'script'].includes(initiatorType))
        .reduce((total, { transferSize }) => total + transferSize, 0),
    };
  });

  const ROUTE_BASELINE_BYTES = 2_000_000;
  const IMAGE_BASELINE_BYTES = 750_000;
  expect(evidence.lcp).toBeGreaterThan(0);
  expect(evidence.lcp).toBeLessThanOrEqual(2_500);
  expect(evidence.inp).toBeLessThanOrEqual(200);
  expect(evidence.cls).toBeLessThanOrEqual(0.1);
  expect(evidence.routeBytes).toBeLessThanOrEqual(ROUTE_BASELINE_BYTES * 1.1);
  expect(evidence.imageBytes).toBeLessThanOrEqual(IMAGE_BASELINE_BYTES * 1.1);
});
