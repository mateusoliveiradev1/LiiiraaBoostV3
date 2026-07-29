import { expect, test } from '@playwright/test';

const OPERATION_STYLES = decodeURIComponent(
  new URL('../../src/premium-operations.css', import.meta.url).pathname.slice(1),
);
const LIGHT_THEME_STYLES = decodeURIComponent(
  new URL('../../src/light-theme.css', import.meta.url).pathname.slice(1),
);

test('@premium-game-selector keeps native options legible in light theme', async ({ page }) => {
  await page.setContent(`
    <main class="desktop-app-shell">
      <label class="premium-game-select-control">
        <span>Jogo</span>
        <select aria-label="Jogo">
          <option>Fortnite</option>
        </select>
      </label>
    </main>
  `);
  await page.addStyleTag({ path: OPERATION_STYLES });
  await page.addStyleTag({ path: LIGHT_THEME_STYLES });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });

  const selector = page.getByRole('combobox', { name: 'Jogo' });
  await expect(selector).toHaveCSS('color-scheme', 'light');
  await expect(selector.locator('option')).toHaveCSS('background-color', 'rgb(248, 250, 252)');
  await expect(selector.locator('option')).toHaveCSS('color', 'rgb(17, 24, 39)');
});
