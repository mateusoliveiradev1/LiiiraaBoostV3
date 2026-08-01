import { readFileSync } from 'node:fs';

import { expect, test, type TestInfo } from '@playwright/test';

const tokensCss = readFileSync(
  new URL('../../../packages/design-tokens/src/tokens.css', import.meta.url),
  'utf8',
);
const sharedCss = readFileSync(
  new URL('../../../packages/web-features/src/web.css', import.meta.url),
  'utf8',
);
const publicCss = readFileSync(
  new URL('../../../apps/web/src/app/public-shell.css', import.meta.url),
  'utf8',
);
const accountCss = readFileSync(
  new URL('../../../apps/account/src/app/account-shell.css', import.meta.url),
  'utf8',
);
const adminCss = readFileSync(
  new URL('../../../apps/admin/src/app/admin-shell.css', import.meta.url),
  'utf8',
);

const onlyAxis = (testInfo: TestInfo, axis: string) => {
  test.skip(testInfo.project.metadata['axis'] !== axis, `Covered by the ${axis} project.`);
};

const customProperty = (source: string, name: string): string => {
  const value = new RegExp(`${name}:\\s*(?<value>[^;]+);`, 'u').exec(source)?.groups?.['value'];
  if (value === undefined) throw new Error(`Missing motion custom property: ${name}`);
  return value.trim();
};

test('@final @public Section 17 motion contract closes every exact role and cap', async ({}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');

  expect(
    Object.fromEntries(
      [
        '--lb-motion-hover-duration',
        '--lb-motion-control-duration',
        '--lb-motion-panel-duration',
        '--lb-motion-route-duration',
        '--lb-motion-headline-duration',
        '--lb-motion-product-stage-duration',
      ].map((name) => [name, customProperty(tokensCss, name)]),
    ),
  ).toEqual({
    '--lb-motion-control-duration': '160ms',
    '--lb-motion-headline-duration': '360ms',
    '--lb-motion-hover-duration': '100ms',
    '--lb-motion-panel-duration': '200ms',
    '--lb-motion-product-stage-duration': '480ms',
    '--lb-motion-route-duration': '220ms',
  });
  expect(customProperty(tokensCss, '--lb-motion-easing-standard')).toBe(
    'cubic-bezier(0.2, 0, 0, 1)',
  );
  expect(customProperty(tokensCss, '--lb-motion-easing-entrance')).toBe(
    'cubic-bezier(0.16, 1, 0.3, 1)',
  );
  expect(sharedCss).toMatch(/var\(--lb-motion-hover-duration\) linear/u);
  expect(customProperty(tokensCss, '--lb-motion-translate-max')).toBe('8px');
  expect(customProperty(tokensCss, '--lb-motion-entrance-scale-min')).toBe('0.985');
  expect(customProperty(tokensCss, '--lb-motion-stage-delay-max')).toBe('80ms');

  expect(publicCss).toContain(
    'transition: transform var(--lb-motion-control-duration) var(--lb-motion-easing);',
  );
  expect(publicCss).toContain(
    'animation: home-headline-enter 360ms cubic-bezier(0.16, 1, 0.3, 1) both;',
  );
  expect(publicCss).toContain(
    'animation: home-stage-enter 480ms 80ms cubic-bezier(0.16, 1, 0.3, 1) both;',
  );
  expect(publicCss).toMatch(/transform:\s*translateY\(8px\)/u);
  expect(publicCss).toMatch(/transform:\s*scale\(0\.985\)/u);

  const motionSources = [tokensCss, sharedCss, publicCss, accountCss, adminCss].join('\n');
  expect(motionSources).not.toMatch(
    /(?:animation|transition)[^;]*(?:bounce|spring|parallax|scanline|particles?|count-up|puls(?:e|ing)|ambient-loop|animated-grid)/iu,
  );
  expect(motionSources).not.toMatch(/animation[^;]*\binfinite\b/iu);
  expect(accountCss).not.toMatch(/(?:^|[;{])\s*animation(?:-[a-z-]+)?:/imu);
  expect(adminCss).not.toMatch(/(?:^|[;{])\s*animation(?:-[a-z-]+)?:/imu);
});

test('@final @public content and actions are available before entrance animation completes', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'wide-1440');
  await page.goto('/en', { waitUntil: 'domcontentloaded' });

  const primaryAction = page.getByRole('link', { name: 'Check compatibility', exact: true }).first();
  await expect(primaryAction).toBeVisible();
  expect(
    await primaryAction.evaluate((element) => {
      const style = getComputedStyle(element);
      return { animationName: style.animationName, opacity: style.opacity, visibility: style.visibility };
    }),
  ).toEqual({ animationName: 'none', opacity: '1', visibility: 'visible' });
});

test('@final @public reduced motion removes transform scale stagger and glow animation', async ({
  page,
}, testInfo) => {
  onlyAxis(testInfo, 'reduced-motion');
  await page.goto('/pt-BR', { waitUntil: 'domcontentloaded' });

  const reduced = await page.locator('.home-ignition-hero__stage').evaluate((stage) => {
    const root = getComputedStyle(document.documentElement);
    const stageStyle = getComputedStyle(stage);
    const headlineStyle = getComputedStyle(document.querySelector('.home-ignition-hero__promise')!);
    return {
      actionGlow: root.getPropertyValue('--lb-action-glow').trim(),
      delay: root.getPropertyValue('--lb-motion-stage-delay-max').trim(),
      headlineAnimation: headlineStyle.animationName,
      headlineTransform: headlineStyle.transform,
      opacity: stageStyle.opacity,
      scaleFloor: root.getPropertyValue('--lb-motion-entrance-scale-min').trim(),
      stageAnimation: stageStyle.animationName,
      stageTransform: stageStyle.transform,
      translate: root.getPropertyValue('--lb-motion-translate-max').trim(),
    };
  });

  expect(reduced).toEqual({
    actionGlow: 'none',
    delay: '0ms',
    headlineAnimation: 'none',
    headlineTransform: 'none',
    opacity: '1',
    scaleFloor: '1',
    stageAnimation: 'none',
    stageTransform: 'none',
    translate: '0px',
  });
  await expect(
    page.getByRole('link', { name: 'Verificar compatibilidade', exact: true }).first(),
  ).toBeVisible();
});

for (const surface of ['account', 'admin'] as const) {
  test(`@final @${surface} ${surface} page load has no choreography and keeps actions visible`, async ({
    page,
  }, testInfo) => {
    onlyAxis(testInfo, 'wide-1440');
    await page.goto(surface === 'account' ? '/en/account/profile' : '/en/admin?role=operations', {
      waitUntil: 'domcontentloaded',
    });

    const animated = await page.locator('main, main h1, main a, main button').evaluateAll((elements) =>
      elements.filter((element) => getComputedStyle(element).animationName !== 'none').map((element) => element.tagName),
    );
    expect(animated).toEqual([]);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main a, main button').first()).toBeVisible();
  });
}
