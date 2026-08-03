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
const LEGAL_ROUTE_IDS = new Set([
  'public-terms',
  'public-privacy-policy',
  'public-policies',
  'public-essential-storage',
  'public-responsible-disclosure',
]);
const FORBIDDEN_ORDINARY_COPY =
  /\b(?:phase|fase|fixture|adapter|illustrative|ilustrativo|raw[- ]?enum|enum(?:eração)? bruta)\b/iu;
// D-110 proof classes: testimonial, benchmark gain, customer count, review score,
// hardware result, company milestone, security certification, and operational metric.
const FORBIDDEN_FABRICATED_PROOF =
  /\b(?:testimonial|depoimento|benchmark gain|ganho de benchmark|customer count|contagem de clientes|review score|nota de avaliação|hardware result|resultado de hardware|company milestone|marco da empresa|security certification|certificação de segurança|operational metric|métrica operacional)\b/iu;

const SURFACE_ORIGINS = Object.freeze({
  account: 'http://account.localhost:3101',
  admin: 'http://admin.localhost:3102',
  public: 'http://public.localhost:3100',
} satisfies Record<Surface, string>);

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
  if (routeId === 'admin-support') return undefined;
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

const visibleLocaleControl = (page: Page) =>
  page.locator('header a.lb-web-locale-switcher:visible');

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

const expectCurrentLocation = async (page: Page, route: WebRoute): Promise<void> => {
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
      if ((await disclosure.getAttribute('open')) === null)
        await disclosure.locator('summary').click();
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
    .locator(
      'main button:visible, main summary:visible, main input:visible, main select:visible, main textarea:visible, main .public-action:visible',
    )
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const input = node instanceof HTMLInputElement ? node : undefined;
          const labelledTarget =
            input !== undefined && ['checkbox', 'radio'].includes(input.type)
              ? (input.closest('label') ??
                (input.id.length > 0
                  ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`)
                  : null))
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
  expect(
    undersized,
    `Interactive targets below 44px:\n${JSON.stringify(undersized, null, 2)}`,
  ).toEqual([]);

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
      await expect(
        page.getByRole('link', { name: /^(?:Criar conta|Create account)$/u }),
      ).toHaveCount(0);
    }
  }
  if (surface === 'admin') {
    await expect(page.locator('[data-authoritative-access-connected="false"]')).not.toHaveCount(0);
    await expect(page.locator('.account-sidebar, .public-navigation')).toHaveCount(0);
  }
};

const expectHomeCommercialSequence = async (page: Page): Promise<void> => {
  const movementSelectors = [
    '.home-ignition-hero',
    '.home-player-problem',
    '.home-workflow',
    '.home-competitive-mode',
    '.home-results-method',
    '.home-mode-split',
    '.home-safety-runway',
    '.home-faq',
    '.home-final-cta',
  ] as const;
  const positions: number[] = [];
  for (const selector of movementSelectors) {
    const movement = page.locator(selector);
    await expect(movement).toHaveCount(1);
    positions.push(await movement.evaluate((node) => node.getBoundingClientRect().top + scrollY));
  }
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
  await expect(page.locator('[data-proof-policy="product-methodology-only"]')).toHaveCount(1);
  await expect(page.locator('[data-proof-object="checksum-admitted-desktop-capture"]')).toHaveCount(
    1,
  );
  const copy = await page.locator('main').innerText();
  expect(copy).not.toMatch(FORBIDDEN_FABRICATED_PROOF);
};

const expectAboutTruthBoundary = async (page: Page): Promise<void> => {
  const chapterIds = await page
    .locator('.public-about__chapter')
    .evaluateAll((chapters) => chapters.map((chapter) => chapter.getAttribute('data-chapter')));
  expect(chapterIds).toEqual(['motivation', 'principles', 'trust', 'reversibility', 'ambition']);
  expect(await page.locator('main').innerText()).not.toMatch(
    /\b(?:founder|fundador|founded|fundada|award|prêmio|partner|parceiro|customers?|clientes?|traction|tração)\b/iu,
  );
};

const expectPrinciplesDestination = async (page: Page): Promise<void> => {
  const locale = await page.locator('html').getAttribute('lang');
  const heading = page.locator('.public-principles h1');
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText(
    locale === 'pt-BR'
      ? 'Princípios que orientam cada otimização'
      : 'Principles behind every optimization',
  );
  const hero = page.locator('.public-principles .public-about__hero');
  await expect(hero).toBeVisible();
  const principleIds = await page
    .locator('.public-principles [data-principle]')
    .evaluateAll((principles) =>
      principles.map((principle) => principle.getAttribute('data-principle')),
    );
  expect(principleIds).toEqual(['evidence', 'stability', 'local-first', 'reversibility']);

  const geometry = await page.locator('.public-principles').evaluate((article) => {
    const articleRect = article.getBoundingClientRect();
    const heroRect = article.querySelector('.public-about__hero')?.getBoundingClientRect();
    const principleRects = [...article.querySelectorAll<HTMLElement>('[data-principle]')].map(
      (principle) => {
        const rect = principle.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        };
      },
    );
    const overlaps = principleRects.flatMap((left, leftIndex) =>
      principleRects
        .slice(leftIndex + 1)
        .filter(
          (right) =>
            left.left < right.right &&
            left.right > right.left &&
            left.top < right.bottom &&
            left.bottom > right.top,
        ),
    ).length;

    return {
      articleWidth: articleRect.width,
      heroHeight: heroRect?.height ?? 0,
      heroWidth: heroRect?.width ?? 0,
      minimumPrincipleWidth: Math.min(...principleRects.map(({ width }) => width)),
      overlaps,
      viewportWidth: innerWidth,
    };
  });
  expect(geometry.articleWidth).toBeGreaterThanOrEqual(geometry.viewportWidth * 0.8);
  expect(geometry.heroWidth).toBeGreaterThanOrEqual(
    Math.min(geometry.articleWidth * 0.95, geometry.articleWidth - 32),
  );
  expect(geometry.heroHeight).toBeGreaterThanOrEqual(240);
  expect(geometry.minimumPrincipleWidth).toBeGreaterThanOrEqual(
    Math.min(300, geometry.viewportWidth - 48),
  );
  expect(geometry.overlaps).toBe(0);
};

const expectFooterTrustLayer = async (page: Page): Promise<void> => {
  const footer = page.locator('footer.public-footer');
  await expect(footer).toHaveCount(1);
  await expect(footer.locator('.public-footer__groups > nav')).toHaveCount(4);
  await expect(footer.locator('a.lb-web-locale-switcher')).toHaveCount(1);
  await expect(footer.locator('.public-footer__cta')).toHaveCount(1);
  await expect(footer.locator('.public-footer__closing')).toContainText(/Liiiraa Boost/iu);
  const legalHrefs = await footer
    .locator('.public-footer__groups > nav')
    .filter({ hasText: /Legal/u })
    .locator('a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(legalHrefs).toHaveLength(5);
  expect(new Set(legalHrefs).size).toBe(5);
  const companyHrefs = await footer
    .locator('.public-footer__groups > nav')
    .filter({ hasText: /Empresa|Company/iu })
    .locator('a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(companyHrefs.some((href) => href?.endsWith('/about'))).toBe(true);
  expect(companyHrefs.some((href) => href?.endsWith('/principles'))).toBe(true);
  expect(companyHrefs.some((href) => href?.includes('/about#'))).toBe(false);
};

const expectPublicOutcomes = async (page: Page, route: WebRoute): Promise<void> => {
  await expectFooterTrustLayer(page);
  if (route.id === 'public-home') await expectHomeCommercialSequence(page);
  if (route.id === 'public-about') await expectAboutTruthBoundary(page);
  if (route.id === 'public-principles') await expectPrinciplesDestination(page);
  if (
    [
      'public-privacy-policy',
      'public-terms',
      'public-policies',
      'public-essential-storage',
    ].includes(route.id)
  ) {
    await expect(page.locator('.policy-document__header')).toHaveCount(1);
    await expect(page.locator('.policy-review-notice')).toHaveCount(0);
    await expect(page.locator('.policy-history')).toHaveCount(1);
  }
  if (route.id === 'public-privacy-policy') {
    await expect(page.locator('.privacy-practice-ledger article')).toHaveCount(8);
  }
  if (route.id === 'public-responsible-disclosure') {
    await expect(page.locator('.policy-document')).toHaveCount(1);
    await expect(page.locator('.policy-coordination-boundary')).toContainText(/preflight/iu);
    await expect(page.locator('a[href="mailto:security@liiiraa.com"]')).toHaveCount(0);
  }
  if (LEGAL_ROUTE_IDS.has(route.id)) {
    const locale = (await page.locator('html').getAttribute('lang')) as WebLocale;
    const expectedHeadings = {
      en: {
        'public-essential-storage': 'Essential Storage',
        'public-policies': 'Security and Trust',
        'public-privacy-policy': 'Privacy Policy',
        'public-responsible-disclosure': 'Responsible Disclosure',
        'public-terms': 'Terms of Use',
      },
      'pt-BR': {
        'public-essential-storage': 'Armazenamento Essencial',
        'public-policies': 'Segurança e Confiança',
        'public-privacy-policy': 'Política de Privacidade',
        'public-responsible-disclosure': 'Divulgação Responsável',
        'public-terms': 'Termos de Uso',
      },
    } as const;
    await expect(page.locator('main h1')).toHaveText(
      expectedHeadings[locale][route.id as keyof (typeof expectedHeadings)[WebLocale]],
    );
    const legalCopy = await page.locator('main').innerText();
    expect(legalCopy).not.toMatch(
      /revis[aã]o necess[aá]ria|review required|professional legal review|canal seguro|secure channel/iu,
    );
    expect(legalCopy).not.toMatch(
      /checkout (?:est[aá] ativo|is available)|telemetria (?:est[aá] ativa|is active)|cloud AI is active/iu,
    );
  }
};

const expectPrivacyConsentLedger = async (page: Page): Promise<void> => {
  const records = page.locator('.account-consent-record');
  await expect(records).toHaveCount(3);
  await expect(page.locator('.account-privacy__requests details')).toHaveCount(3);
  for (const record of await records.all()) {
    await expect(record.locator('dl')).toContainText(/\S/u);
    await expect(record.locator('details')).toHaveCount(1);
  }
};

const expectAccountOutcomes = async (page: Page, route: WebRoute): Promise<void> => {
  if (!['account-sign-in', 'account-sign-up', 'account-onboarding'].includes(route.id)) {
    await expect(page.locator('nav.account-nav__desktop .account-nav__group > li > a')).toHaveCount(
      5,
    );
  }
  if (route.id === 'account-overview') {
    await expect(page.locator('[data-account-home-region="primary"]')).toHaveCount(1);
    await expect(page.locator('[data-account-home-fact]')).toHaveCount(3);
    await expect(page.locator('.account-overview__recommendation a')).toHaveCount(1);
  }
  if (route.id === 'account-privacy') await expectPrivacyConsentLedger(page);
};

const expectZoomSafeAdminActions = async (page: Page, route: WebRoute): Promise<void> => {
  if (route.id === 'admin-diagnostics') {
    await expect(page.locator('[data-consent-decision="missing"]')).toBeVisible();
    await expect(page.locator('[data-high-risk-action="true"]')).toHaveCount(0);
    return;
  }
  if (!['admin-operations', 'admin-security'].includes(route.id)) return;
  const review = page.locator('[data-high-risk-action="true"]');
  await expect(review).not.toHaveCount(0);
  await expect(review.first()).toHaveAttribute(
    'data-high-risk-sequence',
    'evidence-impact-reauth-confirm-receipt',
  );
  await expect(review.first()).toBeVisible();
};

const expectAdminOutcomes = async (page: Page, route: WebRoute): Promise<void> => {
  if (route.id === 'admin-role') {
    await expect(page.locator('.admin-queue__filters')).toHaveCount(1);
    await expect(page.locator('.admin-landing__queue table')).toHaveCount(1);
    await expect(page.locator('.admin-queue__selection')).toHaveCount(1);
    await expect(page.locator('.admin-queue__filters select')).toHaveCount(4);
  }
  await expectZoomSafeAdminActions(page, route);
};

const expectIndexingAndDistribution = async (
  page: Page,
  responseHeaders: Readonly<Record<string, string>>,
  route: WebRoute,
): Promise<void> => {
  expect(new URL(page.url()).origin).toBe(SURFACE_ORIGINS[surfaceFor(route)]);
  expect(responseHeaders['content-security-policy']).toMatch(/default-src\s+'self'/u);
  if (route.indexing === 'noindex') {
    const robotPolicies = await page
      .locator('meta[name="robots"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('content') ?? ''));
    expect(robotPolicies.length).toBeGreaterThan(0);
    expect(robotPolicies.every((policy) => /noindex/iu.test(policy))).toBe(true);
  }
  if (route.id === 'releases-download' || route.id === 'public-download') {
    await expect(page.locator('a[href$=".exe"]')).toHaveCount(0);
  }
};

const inspectRoute = async (page: Page, route: WebRoute, locale: WebLocale): Promise<void> => {
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
  await expect(
    page.locator('.public-brand:visible, .account-brand:visible, .admin-brand:visible'),
  ).not.toHaveCount(0);

  const ordinaryCopy = (
    await page
      .locator(
        'main h1:visible, main h2:visible, main h3:visible, main button:visible, main .public-action:visible',
      )
      .allInnerTexts()
  ).join(' ');
  expect(ordinaryCopy, `Internal copy on ${route.id}:${locale}`).not.toMatch(
    FORBIDDEN_ORDINARY_COPY,
  );

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
  await expectIndexingAndDistribution(page, response?.headers() ?? {}, route);
  if (route.surface === 'public') await expectPublicOutcomes(page, route);
  if (route.surface === 'account') await expectAccountOutcomes(page, route);
  if (route.surface === 'admin') await expectAdminOutcomes(page, route);
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
    test(`@final @${surface} complete canonical route matrix at ${axis}`, async ({
      page,
    }, testInfo) => {
      onlyAxis(testInfo, axis);
      test.setTimeout(10 * 60 * 1_000);
      const routes = webRoutes.filter((route) => route.surface === surface);

      for (const route of routes) {
        for (const locale of WEB_LOCALES) {
          await test.step(`${route.id}:${locale}`, async () => inspectRoute(page, route, locale));
        }
      }
    });
  }
}

// canonical-candidate:start
const CANONICAL_CANDIDATES = webRoutes.flatMap((route) =>
  WEB_LOCALES.flatMap((locale) =>
    COVERED_AXES.map((axis) => {
      const surface = surfaceFor(route);
      const state = ERROR_ROUTE.test(route.id)
        ? route.id.slice(route.id.lastIndexOf('error-'))
        : 'ready';
      const snapshotIdentity = [surface, route.id, locale, axis, state].join('--');

      return Object.freeze({ axis, locale, route, snapshotIdentity, state, surface });
    }),
  ),
);

const canonicalCandidateIdentities = new Set(
  CANONICAL_CANDIDATES.map(({ snapshotIdentity }) => snapshotIdentity),
);
if (canonicalCandidateIdentities.size !== CANONICAL_CANDIDATES.length) {
  throw new Error('CANONICAL_CANDIDATE_IDENTITY_COLLISION');
}

for (const candidate of CANONICAL_CANDIDATES) {
  const { axis, locale, route, snapshotIdentity, surface } = candidate;
  test(`@final @${surface} @candidate-capture @project-${surface}-final-${axis} @canonical-candidate ${snapshotIdentity}`, async ({
    page,
  }, testInfo) => {
    onlyAxis(testInfo, axis);
    await page.goto(pathFor(route, locale), { waitUntil: 'networkidle' });
    await expect(page).toHaveScreenshot(`${snapshotIdentity}.png`, {
      animations: 'disabled',
      fullPage: true,
    });
  });
}
// canonical-candidate:end

for (const surface of ['public', 'account', 'admin'] as const) {
  for (const axis of ['reduced-motion', 'forced-colors'] as const) {
    test(`@final @${surface} ${axis} keeps the flagship shell operable`, async ({
      page,
    }, testInfo) => {
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
        const activeAnimations = await page.evaluate(
          () =>
            document.getAnimations().filter((animation) => animation.playState === 'running')
              .length,
        );
        expect(activeAnimations).toBe(0);
      }
    });
  }
}
