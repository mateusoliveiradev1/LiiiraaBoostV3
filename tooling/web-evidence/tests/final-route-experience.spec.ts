import { readFileSync } from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  routeHref,
  WEB_LOCALES,
  webRoutes,
  type WebLocale,
  type WebRoute,
} from '@liiiraa/web-core';

type Surface = 'public' | 'account' | 'admin';

const MATRIX_SOURCE = readFileSync(
  new URL(
    '../../../.planning/phases/03-complete-web-experience/03-ROUTE-EXPERIENCE-MATRIX.md',
    import.meta.url,
  ),
  'utf8',
);

const COVERED_AXES = ['wide-1440', 'desktop-960', 'mobile-390', 'reflow-320'] as const;
const ERROR_ROUTE = /-error-(?:403|404|410|500)$/u;
const FORBIDDEN_ORDINARY_COPY =
  /\b(?:phase|fase|fixture|adapter|illustrative|ilustrativo|raw[- ]?enum|enum(?:eração)? bruta)\b/iu;

const routeParameters = Object.freeze({
  article: 'getting-started',
  caseId: 'case-preview',
  channel: 'stable',
  code: 'lb-err-0x80070005',
  diagnosticId: 'diagnostic-preview',
  eventId: 'event-preview',
  locale: 'pt-BR',
  reference: 'evidence-identifiers',
  reviewId: 'review-preview',
  section: 'preparing',
  version: 'current',
} as const);

const surfaceFor = (route: WebRoute): Surface => route.surface as Surface;

const roleFor = (routeId: string): string | undefined => {
  if (routeId === 'admin-support') return 'support';
  if (routeId === 'admin-operations') return 'operations';
  if (routeId === 'admin-security' || routeId === 'admin-diagnostics') return 'security';
  if (routeId === 'admin-audit' || routeId === 'admin-audit-event') return 'audit';
  if (routeId === 'admin-role') return 'operations';
  return undefined;
};

const pathFor = (route: WebRoute, locale: WebLocale): string => {
  const placeholders = [...route.pathnameTemplate.matchAll(/\[([A-Za-z][A-Za-z0-9]*)\]/gu)].map(
    (match) => match[1],
  );
  const parameters = Object.fromEntries(
    placeholders.map((name) => {
      const value =
        name === 'locale'
          ? locale
          : name === 'version' && route.id === 'docs-history'
            ? '1.0.0'
            : name === 'article' && route.id === 'docs-history'
              ? 'legacy-capture'
              : routeParameters[name as keyof typeof routeParameters];
      if (value === undefined) throw new Error(`No final-route value for ${route.id}:${name}`);
      return [name, value];
    }),
  );
  const href = routeHref(route.id, parameters);
  if (!href.ok) throw new Error(`Unable to project ${route.id}: ${href.error.code}`);
  const role = roleFor(route.id);
  return role === undefined ? href.value : `${href.value}?role=${role}`;
};

const isHighRisk = (route: WebRoute): boolean =>
  route.id === 'public-home' ||
  route.id === 'public-evidence' ||
  route.owner === 'public-navigation' ||
  route.id === 'releases-integrity' ||
  route.id === 'releases-download' ||
  route.owner.endsWith('-errors') ||
  route.owner === 'account-auth' ||
  route.id === 'account-security' ||
  route.id === 'account-subscription' ||
  route.id === 'account-device' ||
  route.id === 'account-privacy' ||
  route.surface === 'admin';

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

const visibleLocaleControl = (page: Page) => page.locator('a.lb-web-locale-switcher:visible');

const expectRoutePreservingLocale = async (
  page: Page,
  route: WebRoute,
  locale: WebLocale,
): Promise<void> => {
  const targetLocale = locale === 'pt-BR' ? 'en' : 'pt-BR';
  const control = visibleLocaleControl(page);
  await expect(control).toHaveCount(1);
  await expect(control.locator('[data-locale-flag]')).toHaveCount(1);
  await expect(control).toContainText(targetLocale === 'pt-BR' ? 'Português' : 'English');
  const expected = pathFor(route, targetLocale);
  const actual = await control.getAttribute('href');
  expect(actual).not.toBeNull();
  const actualUrl = new URL(actual ?? '', page.url());
  const expectedUrl = new URL(expected, page.url());
  expect(`${actualUrl.pathname}${actualUrl.search}`).toBe(
    `${expectedUrl.pathname}${expectedUrl.search}`,
  );
};

const expectCurrentLocation = async (
  page: Page,
  route: WebRoute,
): Promise<void> => {
  if (
    ERROR_ROUTE.test(route.id) ||
    ['account-sign-in', 'account-sign-up', 'account-onboarding'].includes(route.id)
  ) {
    return;
  }

  const surface = surfaceFor(route);
  const desktopSelector =
    surface === 'public'
      ? 'nav.public-navigation--desktop:visible'
      : surface === 'account'
        ? 'nav.account-nav__desktop:visible'
        : 'nav.admin-nav__desktop:visible';
  const mobileSelector =
    surface === 'public'
      ? 'details.public-mobile-menu:visible'
      : surface === 'account'
        ? 'details.account-nav__mobile:visible'
        : 'details.admin-nav__mobile:visible';
  const desktop = page.locator(desktopSelector);
  let current = desktop.locator('a[aria-current="page"]:visible');
  if ((await desktop.count()) === 0) {
    const disclosure = page.locator(mobileSelector);
    await expect(disclosure).toHaveCount(1);
    if (surface === 'public') {
      if ((await disclosure.getAttribute('open')) === null) await disclosure.locator('summary').click();
      current = disclosure.locator('a[aria-current="page"]:visible');
    } else {
      await expect(disclosure.locator('summary strong:visible')).toHaveText(/\S/u);
      current = page.locator('a[aria-current="page"]');
    }
  }
  await expect(current, `Missing current navigation for ${route.id}`).toHaveCount(1);
};

const expectTargetsAndFocus = async (page: Page): Promise<void> => {
  const undersized = await page
    .locator('main button:visible, main summary:visible, main input:visible, main select:visible, main textarea:visible, main .public-action:visible')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const input = node instanceof HTMLInputElement ? node : undefined;
          const labelledTarget =
            input !== undefined && ['checkbox', 'radio'].includes(input.type)
              ? input.closest('label') ??
                (input.id.length > 0
                  ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`)
                  : null)
              : null;
          const target = labelledTarget ?? node;
          return {
            height: target.getBoundingClientRect().height,
            text: (target.textContent ?? node.getAttribute('aria-label') ?? '').trim().slice(0, 80),
            width: target.getBoundingClientRect().width,
          };
        })
        .filter(({ height, width }) => height < 44 || width < 44),
    );
  expect(undersized, `Interactive targets below 44px:\n${JSON.stringify(undersized, null, 2)}`).toEqual(
    [],
  );

  await page.locator('body').press('Home');
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    const box = active.getBoundingClientRect();
    const style = getComputedStyle(active);
    return {
      height: box.height,
      outline: style.outlineStyle,
      shadow: style.boxShadow,
      width: box.width,
    };
  });
  expect(focus).not.toBeNull();
  expect((focus?.width ?? 0) > 0 && (focus?.height ?? 0) > 0).toBe(true);
  expect(focus?.outline !== 'none' || focus?.shadow !== 'none').toBe(true);
};

const expectSurfaceAuthority = async (page: Page, surface: Surface, route: WebRoute) => {
  if (surface === 'account') {
    await expect(page.locator('[data-authority-connected="false"]')).not.toHaveCount(0);
    if (!['account-sign-in', 'account-sign-up', 'account-onboarding'].includes(route.id)) {
      await expect(page.getByRole('link', { name: /^(?:Entrar|Sign in)$/u })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /^(?:Criar conta|Create account)$/u })).toHaveCount(
        0,
      );
    }
  }
  if (surface === 'admin') {
    await expect(page.locator('[data-authoritative-access-connected="false"]')).not.toHaveCount(0);
    await expect(page.locator('.account-sidebar, .public-navigation')).toHaveCount(0);
  }
};

const inspectRoute = async (
  page: Page,
  route: WebRoute,
  locale: WebLocale,
): Promise<void> => {
  const path = pathFor(route, locale);
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish();
  });
  expect(response, `No response for ${route.id}:${locale}`).not.toBeNull();
  expect(response?.status(), `${route.id}:${locale}`).toBe(
    route.id.endsWith('error-404') ? 404 : 200,
  );
  expect(new URL(page.url()).pathname).toBe(new URL(path, page.url()).pathname);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('main h1:visible'), `One H1 for ${route.id}:${locale}`).toHaveCount(1);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /icon\.svg/u);
  await expect(page.locator('.public-brand:visible, .account-brand:visible, .admin-brand:visible')).not.toHaveCount(0);

  const ordinaryCopy = (
    await page.locator('main h1:visible, main h2:visible, main h3:visible, main button:visible, main .public-action:visible').allInnerTexts()
  ).join(' ');
  expect(ordinaryCopy, `Internal copy on ${route.id}:${locale}`).not.toMatch(FORBIDDEN_ORDINARY_COPY);

  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll, `Horizontal page scroll on ${route.id}:${locale}`).toBeLessThanOrEqual(
    width.client,
  );

  await expectRoutePreservingLocale(page, route, locale);
  await expectCurrentLocation(page, route);
  await expectTargetsAndFocus(page);
  await expectSurfaceAuthority(page, surfaceFor(route), route);
  await expectNoBlockingAxeViolations(page);
};

for (const route of webRoutes) {
  const marker = ERROR_ROUTE.test(route.id)
    ? `${route.surface[0].toUpperCase()}${route.surface.slice(1)} \`${route.surface}-error-403/404/410/500\``
    : `\`${route.id}\``;
  if (ERROR_ROUTE.test(route.id)) {
    expect(MATRIX_SOURCE).toContain(`\`${route.surface}-error-403/404/410/500\``);
  } else {
    expect(MATRIX_SOURCE, `Route missing from final matrix: ${marker}`).toContain(marker);
  }
}

for (const surface of ['public', 'account', 'admin'] as const) {
  for (const axis of COVERED_AXES) {
    test(`@final @${surface} complete canonical route matrix at ${axis}`, async ({ page }, testInfo) => {
      onlyAxis(testInfo, axis);
      test.setTimeout(10 * 60 * 1_000);
      const routes = webRoutes.filter(
        (route) => route.surface === surface && (axis === 'wide-1440' || axis === 'mobile-390' || isHighRisk(route)),
      );

      for (const route of routes) {
        for (const locale of WEB_LOCALES) {
          await test.step(`${route.id}:${locale}`, async () =>
            inspectRoute(page, route, locale),
          );
        }
      }
    });
  }
}

for (const surface of ['public', 'account', 'admin'] as const) {
  for (const axis of ['reduced-motion', 'forced-colors'] as const) {
    test(`@final @${surface} ${axis} keeps the flagship shell operable`, async ({ page }, testInfo) => {
      onlyAxis(testInfo, axis);
      const representative = webRoutes.find((route) =>
        surface === 'public'
          ? route.id === 'public-download'
          : surface === 'account'
            ? route.id === 'account-security'
            : route.id === 'admin-security',
      );
      if (representative === undefined) throw new Error(`Missing ${surface} representative route.`);
      await inspectRoute(page, representative, 'en');

      if (axis === 'reduced-motion') {
        const activeAnimations = await page.evaluate(() =>
          document.getAnimations().filter((animation) => animation.playState === 'running').length,
        );
        expect(activeAnimations).toBe(0);
      }
    });
  }
}
