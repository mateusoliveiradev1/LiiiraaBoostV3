import { expect, test, type Page } from '@playwright/test';

import { openDesktopTestCase } from './fixtures.js';

interface ResponsiveGeometry {
  readonly compactGoalTitlesComplete: boolean;
  readonly documentClientWidth: number;
  readonly documentScrollWidth: number;
  readonly goalCenterDeviation: number;
  readonly goalMinSize: number;
  readonly interactiveOverflow: readonly string[];
  readonly routeClientWidth: number;
  readonly routeScrollWidth: number;
  readonly toolbarOverlaps: readonly string[];
  readonly workClientWidth: number;
  readonly workScrollWidth: number;
}

const responsiveGeometry = async (page: Page): Promise<ResponsiveGeometry> =>
  page.evaluate(() => {
    const workCanvas = document.querySelector<HTMLElement>('.desktop-work-canvas');
    const routeContent = document.querySelector<HTMLElement>(
      '.premium-route-content, .lb-contextual-home',
    );
    const goalRail = document.querySelector<HTMLElement>('.lb-goal-rail');
    if (workCanvas === null || routeContent === null || goalRail === null) {
      throw new Error('Superfície responsiva incompleta');
    }

    const workRect = workCanvas.getBoundingClientRect();
    const railRect = goalRail.getBoundingClientRect();
    const visibleGoals = [...goalRail.querySelectorAll<HTMLElement>('.lb-goal')].filter(
      (element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
    );
    const interactiveOverflow = [
      ...workCanvas.querySelectorAll<HTMLElement>('button, input, select'),
    ]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .flatMap((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < workRect.left - 1 || rect.right > workRect.right + 1
          ? [element.getAttribute('aria-label') ?? element.textContent.trim()]
          : [];
      });

    const toolbarItems = [
      ...document.querySelectorAll<HTMLElement>('.premium-uninstall-toolbar > *'),
    ].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const toolbarOverlaps: string[] = [];

    for (let leftIndex = 0; leftIndex < toolbarItems.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < toolbarItems.length; rightIndex += 1) {
        const left = toolbarItems[leftIndex];
        const right = toolbarItems[rightIndex];

        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        const intersectsHorizontally =
          Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left) > 1;
        const intersectsVertically =
          Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top) > 1;

        if (intersectsHorizontally && intersectsVertically) {
          toolbarOverlaps.push(
            `${left.textContent.trim() || left.tagName} / ${right.textContent.trim() || right.tagName}`,
          );
        }
      }
    }

    return {
      compactGoalTitlesComplete: visibleGoals.every(
        (goal) => goal.dataset.tooltip === goal.getAttribute('aria-label'),
      ),
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      goalCenterDeviation: Math.max(
        0,
        ...visibleGoals.map((goal) => {
          const rect = goal.getBoundingClientRect();
          return Math.abs(rect.left + rect.width / 2 - (railRect.left + railRect.width / 2));
        }),
      ),
      goalMinSize: Math.min(
        Number.POSITIVE_INFINITY,
        ...visibleGoals.map((goal) => goal.getBoundingClientRect().height),
      ),
      interactiveOverflow,
      routeClientWidth: routeContent.clientWidth,
      routeScrollWidth: routeContent.scrollWidth,
      toolbarOverlaps,
      workClientWidth: workCanvas.clientWidth,
      workScrollWidth: workCanvas.scrollWidth,
    };
  });

const routeCases = [
  { height: 794, path: '/home', scale: 100, width: 760 },
  { height: 794, path: '/competitive', scale: 100, width: 760 },
  { height: 794, path: '/toggles', scale: 100, width: 760 },
  { height: 794, path: '/shortcuts', scale: 100, width: 760 },
  { height: 794, path: '/power', scale: 100, width: 760 },
  { height: 794, path: '/network', scale: 100, width: 760 },
  { height: 794, path: '/tweaks', scale: 100, width: 760 },
  { height: 794, path: '/security', scale: 100, width: 760 },
  { height: 794, path: '/services', scale: 100, width: 760 },
  { height: 794, path: '/restoration', scale: 100, width: 760 },
  { height: 794, path: '/uninstaller', scale: 100, width: 760 },
  { height: 794, path: '/downloads', scale: 100, width: 760 },
  { height: 794, path: '/settings/appearance', scale: 100, width: 760 },
  { height: 794, path: '/about', scale: 100, width: 760 },
  { height: 794, path: '/home', scale: 125, width: 960 },
  { height: 794, path: '/home', scale: 150, width: 1222 },
  { height: 800, path: '/services', scale: 150, width: 760 },
  { height: 800, path: '/uninstaller', scale: 150, width: 760 },
  { height: 800, path: '/settings/appearance', scale: 150, width: 760 },
] as const;

for (const routeCase of routeCases) {
  test(`@appearance ${routeCase.path} reflows at ${String(routeCase.scale)}% in a ${String(routeCase.width)}px window`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: routeCase.height, width: routeCase.width });
    await openDesktopTestCase(page, {
      appScale: routeCase.scale,
      initialPath: routeCase.path,
      operationalState: 'fixture',
      scenarioId: 'S01',
      windowsLocale: 'pt-BR',
    });

    await expect(page.locator('.desktop-app-shell')).toHaveAttribute('data-shell-width', 'minimum');

    const geometry = await responsiveGeometry(page);
    expect(geometry.compactGoalTitlesComplete).toBe(true);
    expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.documentClientWidth);
    expect(geometry.goalCenterDeviation).toBeLessThanOrEqual(1);
    expect(geometry.goalMinSize).toBeGreaterThanOrEqual(40);
    expect(geometry.workScrollWidth).toBeLessThanOrEqual(geometry.workClientWidth);
    expect(geometry.routeScrollWidth).toBeLessThanOrEqual(geometry.routeClientWidth);
    expect(geometry.interactiveOverflow).toEqual([]);
    expect(geometry.toolbarOverlaps).toEqual([]);
  });
}

test('@appearance live window resizing switches shell modes without stale geometry', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await openDesktopTestCase(page, {
    appScale: 100,
    initialPath: '/uninstaller',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const shell = page.locator('.desktop-app-shell');
  await expect(shell).toHaveAttribute('data-shell-width', 'wide');
  await expect(shell).toHaveAttribute('data-responsive-width', '1440');

  await page.setViewportSize({ height: 600, width: 760 });
  await expect(shell).toHaveAttribute('data-shell-width', 'minimum');
  await expect(shell).toHaveAttribute('data-responsive-width', '760');

  const compactGeometry = await responsiveGeometry(page);
  expect(compactGeometry.documentScrollWidth).toBeLessThanOrEqual(
    compactGeometry.documentClientWidth,
  );
  expect(compactGeometry.workScrollWidth).toBeLessThanOrEqual(compactGeometry.workClientWidth);
  expect(compactGeometry.routeScrollWidth).toBeLessThanOrEqual(compactGeometry.routeClientWidth);
  expect(compactGeometry.interactiveOverflow).toEqual([]);
  expect(compactGeometry.toolbarOverlaps).toEqual([]);

  await page.setViewportSize({ height: 900, width: 1440 });
  await expect(shell).toHaveAttribute('data-shell-width', 'wide');
  await expect(shell).toHaveAttribute('data-responsive-width', '1440');
});

test('@appearance sidebar and route scrollbars share the premium visual treatment', async ({
  page,
}) => {
  await page.setViewportSize({ height: 600, width: 760 });
  await openDesktopTestCase(page, {
    appScale: 150,
    initialPath: '/settings/appearance',
    operationalState: 'fixture',
    scenarioId: 'S01',
    windowsLocale: 'pt-BR',
  });

  const scrollbarStyles = await page.evaluate(() => {
    const route = document.querySelector<HTMLElement>('.premium-route-content');
    const rail = document.querySelector<HTMLElement>('.lb-goal-rail [role="toolbar"]');
    if (route === null || rail === null) {
      throw new Error('Regiões com rolagem não encontradas');
    }

    return {
      railColor: getComputedStyle(rail).scrollbarColor,
      railThumb: getComputedStyle(rail, '::-webkit-scrollbar-thumb').backgroundColor,
      routeColor: getComputedStyle(route).scrollbarColor,
      routeThumb: getComputedStyle(route, '::-webkit-scrollbar-thumb').backgroundColor,
    };
  });

  expect(scrollbarStyles.routeColor).toBe(scrollbarStyles.railColor);
  expect(scrollbarStyles.routeColor).not.toBe('auto');
  expect(scrollbarStyles.routeThumb).toBe(scrollbarStyles.railThumb);
  expect(scrollbarStyles.routeThumb).not.toBe('rgba(0, 0, 0, 0)');
});
