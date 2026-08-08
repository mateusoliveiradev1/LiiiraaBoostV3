import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const APP_STYLES = fileURLToPath(new URL('../../src/app.css', import.meta.url));
const FIRST_RUN_STYLES = fileURLToPath(
  new URL('../../src/premium-experience.css', import.meta.url),
);
const OPERATION_STYLES = fileURLToPath(
  new URL('../../src/premium-operations.css', import.meta.url),
);

test('@premium-first-run stays inside the resized window', async ({ page }) => {
  await page.setContent(`
    <div class="desktop-app-shell desktop-first-run-shell" data-route-path="/first-run">
      <div class="desktop-title-region">
        <header class="lb-title-bar">Liiiraa Boost</header>
      </div>
      <main class="desktop-premium-first-run">
        <section class="desktop-first-run-intro">
          <div class="desktop-first-run-brand">Liiiraa Boost</div>
          <div class="desktop-first-run-copy">
            <h1>Tudo pronto para sua primeira sessão.</h1>
            <p>A interface abre sem privilégios elevados.</p>
          </div>
        </section>
        <section class="desktop-first-run-checkpoint">
          <header><div></div><h2>Instalação verificada</h2></header>
          <div class="desktop-first-run-status">
            <article><span>Windows</span><strong>Compatível</strong><small>Windows 11</small></article>
          </div>
          <div class="desktop-first-run-actions">
            <button class="lb-button">Entrar no Liiiraa Boost</button>
            <button class="lb-button">Revisar verificação</button>
          </div>
        </section>
      </main>
    </div>
  `);
  await page.addStyleTag({ path: APP_STYLES });
  await page.addStyleTag({ path: FIRST_RUN_STYLES });
  await page.addStyleTag({ path: OPERATION_STYLES });

  for (const viewport of [
    { height: 800, width: 1280 },
    { height: 700, width: 960 },
    { height: 600, width: 760 },
  ]) {
    await page.setViewportSize(viewport);

    const geometry = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('.desktop-premium-first-run');
      const checkpoint = document.querySelector<HTMLElement>('.desktop-first-run-checkpoint');
      const shell = document.querySelector<HTMLElement>('.desktop-first-run-shell');
      const actions = [...document.querySelectorAll<HTMLElement>('.desktop-first-run-actions > *')];
      if (root === null || checkpoint === null || shell === null) {
        throw new Error('Fixture incompleta');
      }
      const rootBox = root.getBoundingClientRect();
      const checkpointBox = checkpoint.getBoundingClientRect();
      return {
        actionRightEdges: actions.map((action) => action.getBoundingClientRect().right),
        actionWidths: actions.map((action) => action.getBoundingClientRect().width),
        checkpointRight: checkpointBox.right,
        rootClientWidth: root.clientWidth,
        rootHeight: rootBox.height,
        rootRight: rootBox.right,
        rootScrollWidth: root.scrollWidth,
        shellHeight: shell.getBoundingClientRect().height,
      };
    });

    expect(geometry.shellHeight).toBe(viewport.height);
    expect(geometry.rootHeight).toBeGreaterThan(viewport.height - 80);
    expect(geometry.rootScrollWidth).toBeLessThanOrEqual(geometry.rootClientWidth);
    expect(geometry.checkpointRight).toBeLessThanOrEqual(geometry.rootRight);
    expect(Math.max(...geometry.actionRightEdges)).toBeLessThanOrEqual(geometry.rootRight);
    expect(Math.min(...geometry.actionWidths)).toBeGreaterThan(0);
  }
});
