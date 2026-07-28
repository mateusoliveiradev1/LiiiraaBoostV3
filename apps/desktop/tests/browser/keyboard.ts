import { expect, type Page } from '@playwright/test';

export type KeyboardJourneyStep =
  | Readonly<{ key: string; kind: 'press' }>
  | Readonly<{ kind: 'focus'; selector: string }>
  | Readonly<{ kind: 'visible'; selector: string }>;

export const runKeyboardJourney = async (
  page: Page,
  steps: readonly KeyboardJourneyStep[],
): Promise<void> => {
  for (const step of steps) {
    switch (step.kind) {
      case 'focus':
        await page.locator(step.selector).focus();
        break;
      case 'press':
        await page.keyboard.press(step.key);
        break;
      case 'visible':
        await expect(page.locator(step.selector)).toBeVisible();
        break;
    }
  }
};

export const expectKeyboardFocus = async (page: Page, selector: string): Promise<void> => {
  await expect(page.locator(selector)).toBeFocused();
};
