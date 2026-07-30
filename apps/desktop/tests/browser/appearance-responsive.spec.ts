import { expect, test } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.ts';

test('@appearance text at 200% keeps route content and navigation in one scroll axis', async ({
  page,
}) => {
  await page.setViewportSize({ height: 515, width: 960 });
  await openDesktopTestCase(page, {
    appScale: 100,
    initialPath: '/home',
    operationalState: 'fixture',
    scenarioId: 'S01',
    textScale: 200,
    viewportWidth: 960,
    windowsLocale: 'pt-BR',
  });

  const geometry = await page.evaluate(() => {
    const goalRegion = document.querySelector<HTMLElement>('.desktop-goal-region');
    const goalRail = document.querySelector<HTMLElement>('.lb-goal-rail');
    const readinessButton = document.querySelector<HTMLElement>(
      '.premium-readiness-next .premium-button',
    );
    const readinessNext = document.querySelector<HTMLElement>('.premium-readiness-next');
    const readinessStrong = document.querySelector<HTMLElement>('.premium-readiness-next strong');
    const routeHeader = document.querySelector<HTMLElement>('.premium-route-header');
    const routeContent = document.querySelector<HTMLElement>('.premium-route-content');
    const shell = document.querySelector<HTMLElement>('.desktop-app-shell');
    const workCanvas = document.querySelector<HTMLElement>('.desktop-work-canvas');

    if (
      goalRegion === null ||
      goalRail === null ||
      readinessButton === null ||
      readinessNext === null ||
      readinessStrong === null ||
      routeHeader === null ||
      routeContent === null ||
      shell === null ||
      workCanvas === null
    ) {
      throw new Error('A composição responsiva da área de trabalho está incompleta.');
    }

    const headerBox = routeHeader.getBoundingClientRect();
    const contentBox = routeContent.getBoundingClientRect();
    const readinessBox = readinessNext.getBoundingClientRect();
    const readinessButtonBox = readinessButton.getBoundingClientRect();
    const readinessStrongBox = readinessStrong.getBoundingClientRect();

    return {
      contentTop: contentBox.top,
      goalRegionClientWidth: goalRegion.clientWidth,
      goalRegionScrollWidth: goalRegion.scrollWidth,
      goalRailClientWidth: goalRail.clientWidth,
      goalRailScrollWidth: goalRail.scrollWidth,
      headerBottom: headerBox.bottom,
      readinessButtonBottom: readinessButtonBox.bottom,
      readinessButtonLeft: readinessButtonBox.left,
      readinessButtonRight: readinessButtonBox.right,
      readinessButtonTop: readinessButtonBox.top,
      readinessNextRight: readinessBox.right,
      readinessStrongBottom: readinessStrongBox.bottom,
      readinessStrongFontSize: Number.parseFloat(
        globalThis.getComputedStyle(readinessStrong).fontSize,
      ),
      readinessStrongLeft: readinessStrongBox.left,
      readinessStrongRight: readinessStrongBox.right,
      readinessStrongTop: readinessStrongBox.top,
      shellClientWidth: shell.clientWidth,
      shellScrollWidth: shell.scrollWidth,
      workCanvasClientWidth: workCanvas.clientWidth,
      workCanvasScrollWidth: workCanvas.scrollWidth,
    };
  });

  expect(geometry.headerBottom).toBeLessThanOrEqual(geometry.contentTop + 1);
  expect(geometry.readinessStrongFontSize).toBeGreaterThanOrEqual(28);
  expect(geometry.readinessStrongRight).toBeLessThanOrEqual(geometry.readinessNextRight);
  expect(geometry.readinessButtonRight).toBeLessThanOrEqual(geometry.readinessNextRight);
  const readinessItemsOverlap =
    geometry.readinessStrongLeft < geometry.readinessButtonRight &&
    geometry.readinessStrongRight > geometry.readinessButtonLeft &&
    geometry.readinessStrongTop < geometry.readinessButtonBottom &&
    geometry.readinessStrongBottom > geometry.readinessButtonTop;
  expect(readinessItemsOverlap).toBe(false);
  expect(geometry.goalRegionScrollWidth).toBeLessThanOrEqual(geometry.goalRegionClientWidth);
  expect(geometry.goalRailScrollWidth).toBeLessThanOrEqual(geometry.goalRailClientWidth);
  expect(geometry.shellScrollWidth).toBeLessThanOrEqual(geometry.shellClientWidth);
  expect(geometry.workCanvasScrollWidth).toBeLessThanOrEqual(geometry.workCanvasClientWidth);
});

test('@appearance Windows text enlargement reflows readiness by available width', async ({
  page,
}) => {
  await page.setViewportSize({ height: 700, width: 960 });
  await openDesktopTestCase(page, {
    appScale: 100,
    initialPath: '/home',
    operationalState: 'fixture',
    scenarioId: 'S01',
    textScale: 100,
    viewportWidth: 960,
    windowsLocale: 'pt-BR',
  });

  await page.addStyleTag({
    content: `
      .premium-readiness-next > .premium-readiness-next-copy > .premium-section-label {
        font-size: 18px;
      }

      .premium-readiness-next > .premium-readiness-next-copy > strong {
        font-size: 30px;
        line-height: 1.35;
      }

      .premium-readiness-next > .premium-readiness-next-copy > p {
        font-size: 20px;
        line-height: 1.5;
      }
    `,
  });

  const geometry = await page.evaluate(() => {
    const readinessButton = document.querySelector<HTMLElement>(
      '.premium-readiness-next .premium-button',
    );
    const readinessNext = document.querySelector<HTMLElement>('.premium-readiness-next');
    const readinessPrimary = document.querySelector<HTMLElement>('.premium-readiness-primary');
    const readinessStrong = document.querySelector<HTMLElement>('.premium-readiness-next strong');
    const shell = document.querySelector<HTMLElement>('.desktop-app-shell');

    if (
      readinessButton === null ||
      readinessNext === null ||
      readinessPrimary === null ||
      readinessStrong === null ||
      shell === null
    ) {
      throw new Error('O painel de prontidão ampliado não foi renderizado por completo.');
    }

    const buttonBox = readinessButton.getBoundingClientRect();
    const nextBox = readinessNext.getBoundingClientRect();
    const primaryBox = readinessPrimary.getBoundingClientRect();
    const strongBox = readinessStrong.getBoundingClientRect();

    return {
      buttonBottom: buttonBox.bottom,
      buttonLeft: buttonBox.left,
      buttonTop: buttonBox.top,
      nextWidth: nextBox.width,
      primaryWidth: primaryBox.width,
      shellTextScale: shell.dataset.textScale,
      strongBottom: strongBox.bottom,
      strongFontSize: Number.parseFloat(globalThis.getComputedStyle(readinessStrong).fontSize),
      strongRight: strongBox.right,
      strongTop: strongBox.top,
    };
  });

  expect(geometry.shellTextScale).toBe('100');
  expect(geometry.strongFontSize).toBeGreaterThanOrEqual(28);
  expect(geometry.nextWidth).toBeGreaterThanOrEqual(geometry.primaryWidth - 50);

  const titleIntersectsButton =
    geometry.strongRight > geometry.buttonLeft &&
    geometry.strongTop < geometry.buttonBottom &&
    geometry.strongBottom > geometry.buttonTop;

  expect(titleIntersectsButton).toBe(false);
});

test('@appearance scale, density and data contrast visibly change the interface', async ({
  page,
}) => {
  await openDesktopTestCase(page, {
    initialPath: '/settings/appearance',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const scaleControl = page.getByRole('combobox', { name: 'Escala da interface' });
  const densityControl = page.getByRole('combobox', { name: 'Densidade da interface' });
  const settingsRow = page.locator('.premium-settings-list article').filter({ has: scaleControl });
  const dataPreview = page.locator('.premium-appearance-preview strong');

  const initialRowHeight = await settingsRow.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  const initialPreviewHeight = await dataPreview.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  const initialDataColor = await dataPreview.evaluate(
    (element) => globalThis.getComputedStyle(element).color,
  );

  await scaleControl.selectOption('150');
  await expect(page.locator('.desktop-app-shell')).toHaveAttribute('data-app-scale', '150');

  const scaledPreviewHeight = await dataPreview.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(scaledPreviewHeight).toBeGreaterThan(initialPreviewHeight * 1.35);
  const scaledHorizontalLayout = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.desktop-app-shell');
    if (shell === null) {
      throw new Error('A área de trabalho não foi renderizada.');
    }
    return {
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      shellClientWidth: shell.clientWidth,
      shellScrollWidth: shell.scrollWidth,
    };
  });
  expect(scaledHorizontalLayout.documentScrollWidth).toBeLessThanOrEqual(
    scaledHorizontalLayout.documentClientWidth,
  );
  expect(scaledHorizontalLayout.shellScrollWidth).toBeLessThanOrEqual(
    scaledHorizontalLayout.shellClientWidth,
  );

  await scaleControl.selectOption('100');
  await densityControl.selectOption('compact');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');

  const compactRowHeight = await settingsRow.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(compactRowHeight).toBeLessThan(initialRowHeight);

  await page.getByRole('switch', { name: 'Ativar Contraste de dados' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-data-text', 'increased-contrast');

  const increasedDataColor = await dataPreview.evaluate(
    (element) => globalThis.getComputedStyle(element).color,
  );
  expect(increasedDataColor).not.toBe(initialDataColor);
});

test('@appearance power plans remain reachable at 150% interface scale', async ({ page }) => {
  await page.setViewportSize({ height: 871, width: 1432 });
  await openDesktopTestCase(page, {
    appScale: 150,
    initialPath: '/power',
    operationalState: 'fixture',
    scenarioId: 'S01',
    textScale: 100,
    viewportWidth: 1432,
    windowsLocale: 'pt-BR',
  });

  const routeContent = page.locator('.premium-route-content');
  const finalPlan = page.locator('.premium-power-grid article').last();

  await expect(routeContent).toBeVisible();
  await expect(finalPlan).toBeVisible();

  const beforeScroll = await routeContent.evaluate((element) => ({
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    scrollWidth: element.scrollWidth,
    scrollTop: element.scrollTop,
  }));

  expect(beforeScroll.scrollHeight).toBeGreaterThan(beforeScroll.clientHeight);
  expect(beforeScroll.scrollWidth).toBeLessThanOrEqual(beforeScroll.clientWidth);

  const recommendedGeometry = await page.evaluate(() => {
    const article = document.querySelector<HTMLElement>(
      '.premium-power-grid article[data-recommended="true"]',
    );
    const button = article?.querySelector<HTMLElement>('.premium-button');
    const stats = article?.querySelector<HTMLElement>('.premium-power-plan-stats');

    if (article === null || button === null || stats === null) {
      throw new Error('O plano recomendado não foi renderizado por completo.');
    }

    const articleBox = article.getBoundingClientRect();

    return {
      articleRight: articleBox.right,
      buttonRight: button.getBoundingClientRect().right,
      statsRight: stats.getBoundingClientRect().right,
    };
  });

  expect(recommendedGeometry.buttonRight).toBeLessThanOrEqual(recommendedGeometry.articleRight + 1);
  expect(recommendedGeometry.statsRight).toBeLessThanOrEqual(recommendedGeometry.articleRight + 1);

  await routeContent.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  await expect
    .poll(async () => routeContent.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  const geometry = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('.premium-route-content');
    const operations = document.querySelector<HTMLElement>('.premium-operations');
    const finalCard = document.querySelector<HTMLElement>('.premium-power-grid article:last-child');
    const shell = document.querySelector<HTMLElement>('.desktop-app-shell');
    const shellBody = document.querySelector<HTMLElement>('.desktop-shell-body');
    const workCanvas = document.querySelector<HTMLElement>('.desktop-work-canvas');

    if (
      content === null ||
      operations === null ||
      finalCard === null ||
      shell === null ||
      shellBody === null ||
      workCanvas === null
    ) {
      throw new Error('A rota de planos de energia não foi renderizada por completo.');
    }

    const contentBox = content.getBoundingClientRect();
    const finalCardBox = finalCard.getBoundingClientRect();
    return {
      contentBottom: contentBox.bottom,
      finalCardBottom: finalCardBox.bottom,
      operationsBottom: operations.getBoundingClientRect().bottom,
      shellBodyBottom: shellBody.getBoundingClientRect().bottom,
      shellBottom: shell.getBoundingClientRect().bottom,
      shellClientWidth: shell.clientWidth,
      shellScrollWidth: shell.scrollWidth,
      viewportBottom: globalThis.innerHeight,
      workCanvasBottom: workCanvas.getBoundingClientRect().bottom,
    };
  });

  expect(geometry.finalCardBottom).toBeLessThanOrEqual(geometry.contentBottom + 1);
  expect(geometry.shellBottom).toBeGreaterThanOrEqual(geometry.viewportBottom - 1);
  expect(geometry.shellBodyBottom).toBeGreaterThanOrEqual(geometry.shellBottom - 1);
  expect(geometry.workCanvasBottom).toBeGreaterThanOrEqual(geometry.shellBodyBottom - 1);
  expect(geometry.operationsBottom).toBeGreaterThanOrEqual(geometry.workCanvasBottom - 1);
  expect(geometry.contentBottom).toBeGreaterThanOrEqual(geometry.operationsBottom - 1);
  expect(geometry.shellScrollWidth).toBeLessThanOrEqual(geometry.shellClientWidth);
});
