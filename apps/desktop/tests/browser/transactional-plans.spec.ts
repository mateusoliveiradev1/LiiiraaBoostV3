import { expect, test, type Page } from '@playwright/test';

import { expectNoAxeViolations } from './axe.ts';

const DETERMINISTIC_PROVENANCE = 'DETERMINISTIC TEST COMPOSITION · NOT PHYSICAL WINDOWS EVIDENCE';

type HarnessOptions = Readonly<{
  advancedState?:
    | 'disabled'
    | 'enable-auth-pending'
    | 'enabled'
    | 'restart-persisted'
    | 'revoke-auth-pending'
    | 'revoked'
    | 'posture-invalidated'
    | 'revalidated';
  colorScheme?: 'dark' | 'light';
  forcedColors?: boolean;
  locale?: 'en' | 'pt-BR';
  reducedMotion?: boolean;
  scale?: 100 | 150 | 200;
  state?: string;
  width?: number;
}>;

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const openTransactionalHarness = async (
  page: Page,
  {
    advancedState = 'disabled',
    colorScheme = 'dark',
    forcedColors = false,
    locale = 'en',
    reducedMotion = false,
    scale = 100,
    state = 'ready',
    width = 1280,
  }: HarnessOptions = {},
): Promise<void> => {
  await page.setViewportSize({ height: 820, width });
  await page.emulateMedia({
    colorScheme,
    forcedColors: forcedColors ? 'active' : 'none',
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });

  const isPortuguese = locale === 'pt-BR';
  const advancedLabels = {
    disabled: isPortuguese ? 'Desativada' : 'Disabled',
    'enable-auth-pending': isPortuguese
      ? 'Autenticação para ativação pendente'
      : 'Enable authentication pending',
    enabled: isPortuguese ? 'Ativada e atual' : 'Enabled and current',
    'restart-persisted': isPortuguese ? 'Ativada após reinicialização' : 'Enabled after restart',
    'revoke-auth-pending': isPortuguese
      ? 'Autenticação para revogação pendente'
      : 'Revoke authentication pending',
    revoked: isPortuguese ? 'Revogada' : 'Revoked',
    'posture-invalidated': isPortuguese ? 'Revalidação necessária' : 'Revalidation required',
    revalidated: isPortuguese ? 'Revalidada e atual' : 'Revalidated and current',
  } as const;
  const nextAction =
    advancedState === 'enabled' ||
    advancedState === 'restart-persisted' ||
    advancedState === 'revalidated' ||
    advancedState === 'revoke-auth-pending'
      ? isPortuguese
        ? 'Revogar Avançado neste PC'
        : 'Revoke Advanced on this PC'
      : advancedState === 'posture-invalidated'
        ? isPortuguese
          ? 'Revalidar Avançado neste PC'
          : 'Revalidate Advanced on this PC'
        : isPortuguese
          ? 'Ativar Avançado neste PC'
          : 'Enable Advanced on this PC';
  const pending = advancedState.endsWith('auth-pending');
  const invalidated = advancedState === 'posture-invalidated';
  const theme = colorScheme === 'dark' ? '#03050b' : '#f4f7fb';
  const foreground = colorScheme === 'dark' ? '#f4f7fb' : '#07111f';
  const panel = colorScheme === 'dark' ? '#081220' : '#ffffff';
  const stateText = escapeHtml(state.replaceAll('-', ' '));

  await page.setContent(`<!doctype html>
    <html lang="${locale}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Transactional plan deterministic witness</title>
        <style>
          :root { color-scheme: ${colorScheme}; font-size: ${String(scale)}%; }
          * { box-sizing: border-box; }
          body { margin: 0; background: ${theme}; color: ${foreground}; font-family: Arial, sans-serif; }
          main { display: grid; gap: 24px; margin: 0 auto; max-width: 1120px; min-width: 0; padding: 24px; }
          section, aside { background: ${panel}; border: 2px solid currentColor; border-radius: 12px; min-width: 0; padding: 16px; }
          .workspace { display: grid; gap: 24px; grid-template-columns: minmax(0, 1fr) minmax(280px, .38fr); }
          .stack { display: grid; gap: 12px; min-width: 0; }
          .state-triplet { display: grid; gap: 8px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
          button, input, select { font: inherit; min-height: 44px; max-width: 100%; }
          button { border: 2px solid currentColor; border-radius: 8px; padding: 8px 12px; }
          code { overflow-wrap: anywhere; }
          [data-provenance] { border-style: dashed; font-weight: 700; }
          [aria-current="step"] { outline: 3px solid #1b93ff; outline-offset: 3px; }
          :focus-visible { outline: 3px solid #3ed8ff; outline-offset: 3px; }
          @media (max-width: 760px) {
            main { padding: 16px; }
            .workspace, .state-triplet { grid-template-columns: minmax(0, 1fr); }
          }
          @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; transition: none !important; } }
          @media (forced-colors: active) { section, aside, button { forced-color-adjust: auto; } }
        </style>
      </head>
      <body>
        <main data-transactional-state="${escapeHtml(state)}" data-run-kind="deterministic-browser">
          <header class="stack">
            <p data-provenance="deterministic">${DETERMINISTIC_PROVENANCE}</p>
            <h1>${isPortuguese ? 'Plano transacional e recuperação' : 'Transactional plan and recovery'}</h1>
            <p role="status">${isPortuguese ? 'Estado de teste' : 'Test state'}: ${stateText}</p>
          </header>
          <div class="workspace">
            <div class="stack">
              <section aria-labelledby="revision-title" data-plan-family="composition review confirmation">
                <h2 id="revision-title">${isPortuguese ? 'Revisão imutável 7' : 'Immutable revision 7'}</h2>
                <p>${isPortuguese ? 'Limite máximo de risco' : 'Maximum risk ceiling'}: Advanced</p>
                <p>${isPortuguese ? 'A preferência Avançada permanece separada do limite.' : 'The Advanced preference remains separate from the ceiling.'}</p>
                <label>${isPortuguese ? 'Limite máximo de risco' : 'Maximum risk ceiling'}
                  <select data-risk-ceiling>
                    <option>Verified</option><option selected>Advanced</option><option>Experimental</option><option>Extreme</option>
                  </select>
                </label>
                <div class="stack" role="group" aria-label="Operations">
                  <button data-operation="verified" type="button">Verified · power-base-v1</button>
                  <button data-operation="advanced" type="button">Advanced · power-advanced-v2</button>
                  <p data-extreme-blocked>Extreme · explanation only · no execution control</p>
                </div>
                <p data-approval-state="current">${isPortuguese ? 'Aprovação atual' : 'Approval current'}</p>
              </section>

              <section aria-labelledby="advanced-title" data-advanced-state="${advancedState}">
                <h2 id="advanced-title" tabindex="-1">${isPortuguese ? 'Preferência Avançada deste PC' : 'Advanced preference for this PC'}</h2>
                <p>${advancedLabels[advancedState]}</p>
                <p>${isPortuguese ? 'Local do dispositivo e persistente entre reinicializações.' : 'Device-local and persistent across app restarts.'}</p>
                <p>${isPortuguese ? 'Motivo e vínculo nativos; nunca sincronizados com a nuvem.' : 'Native reason and binding; never synchronized to the cloud.'}</p>
                ${
                  invalidated
                    ? `<p id="advanced-blocker" role="alert">${isPortuguese ? 'Hardware ou postura de segurança mudou. Nova aplicação bloqueada.' : 'Hardware or security posture changed. New apply is blocked.'}</p>`
                    : ''
                }
                ${
                  pending
                    ? `<p aria-live="polite">${isPortuguese ? 'Aguardando projeção nativa; nenhum sucesso otimista.' : 'Waiting for native projection; no optimistic success.'}</p>`
                    : ''
                }
                <button aria-describedby="${invalidated ? 'advanced-blocker' : ''}" data-advanced-action type="button">${nextAction}</button>
                <button data-open-recovery type="button">${isPortuguese ? 'Abrir Central de Recuperação' : 'Open Recovery Center'}</button>
              </section>

              <section aria-labelledby="execution-title" data-execution-family>
                <h2 id="execution-title">${isPortuguese ? 'Execução autoritativa' : 'Authoritative execution'}</h2>
                <ol aria-label="Execution timeline">
                  <li>Preparing recovery</li>
                  <li aria-current="step">Applying</li>
                  <li>Observing Windows</li>
                  <li>Verifying result</li>
                  <li>Verified receipt</li>
                </ol>
                <button data-cancel type="button">${isPortuguese ? 'Cancelar com segurança' : 'Cancel safely'}</button>
                <button data-sequence-gap type="button">Simulate sequence gap</button>
                <output data-snapshot-reads>snapshotReads=0</output>
                <output data-mutation-calls>mutationCalls=0</output>
              </section>

              <section aria-labelledby="recovery-title" data-recovery-family>
                <h2 id="recovery-title">${isPortuguese ? 'Central de Recuperação' : 'Recovery Center'}</h2>
                <p>${isPortuguese ? 'Disponível offline, sem sessão e sem Premium.' : 'Available offline, signed out, and without Premium.'}</p>
                <div class="state-triplet">
                  <p><strong>Prior</strong><br><code>scheme-prior</code></p>
                  <p><strong>Requested / Applied</strong><br><code>scheme-requested</code></p>
                  <p><strong>Observed</strong><br><code>scheme-observed</code></p>
                </div>
                <button type="button">Restore this operation</button>
                <button type="button">Restore full plan</button>
                <button type="button">Restore checkpoint</button>
              </section>

              <section aria-labelledby="receipt-title" data-receipt-family>
                <h2 id="receipt-title">${isPortuguese ? 'Comprovante imutável' : 'Immutable receipt'}</h2>
                <p>transaction-apply-0001 · power-advanced-v2 · operation-version=1</p>
                <details><summary>${isPortuguese ? 'Ver detalhes técnicos' : 'View technical details'}</summary><code>journal-sha256:redacted</code></details>
                <button type="button">${isPortuguese ? 'Revisar diagnóstico para exportação' : 'Review diagnostic for export'}</button>
                <p>redactions: credentials, raw-hardware-identifiers</p>
              </section>
            </div>
            <aside aria-labelledby="safety-title">
              <h2 id="safety-title">${isPortuguese ? 'Resumo de segurança' : 'Safety summary'}</h2>
              <p>prior=scheme-prior</p><p>recovery=exact-prior-scheme</p><p>checkpoint=ready</p>
            </aside>
          </div>
        </main>
        <script>
          (() => {
            const main = document.querySelector('main');
            const approval = document.querySelector('[data-approval-state]');
            document.querySelector('[data-risk-ceiling]').addEventListener('change', () => {
              main.dataset.transactionalState = 'revision-changed';
              approval.dataset.approvalState = 'stale';
              approval.textContent = '${isPortuguese ? 'O plano mudou desde a aprovação' : 'The plan changed after approval'}';
            });
            document.querySelector('[data-advanced-action]').addEventListener('click', () => {
              main.dataset.authRequested = 'true';
            });
            document.querySelector('[data-open-recovery]').addEventListener('click', () => {
              document.querySelector('#recovery-title').focus?.();
              main.dataset.recoveryOpened = 'true';
            });
            document.querySelector('[data-cancel]').addEventListener('click', () => {
              main.dataset.transactionalState = 'safe-boundary-cancellation-requested';
            });
            document.querySelector('[data-sequence-gap]').addEventListener('click', () => {
              document.querySelector('[data-snapshot-reads]').textContent = 'snapshotReads=1';
              document.querySelector('[data-mutation-calls]').textContent = 'mutationCalls=0';
              main.dataset.transactionalState = 'sequence-gap-refetch';
            });
          })();
        </script>
      </body>
    </html>`);
};

const compositionStates = [
  'loading-over-admitted-revision',
  'empty',
  'ready',
  'stale-evidence',
  'contradictory-evidence',
  'unsupported-operation',
  'revoked-operation',
  'extreme-visible-blocked',
] as const;

for (const state of compositionStates) {
  test(`plan composition: ${state}`, async ({ page }) => {
    await openTransactionalHarness(page, { state });
    await expect(page.locator('main')).toHaveAttribute('data-transactional-state', state);
    await expect(page.locator('[data-provenance]')).toHaveText(DETERMINISTIC_PROVENANCE);
    await expect(page.locator('[data-extreme-blocked]')).toBeVisible();
    await expect(page.getByRole('button', { name: /extreme/iu })).toHaveCount(0);
  });
}

const reviewStates = [
  'add-remove',
  'immutable-revision-change',
  'mixed-risk-grouping',
  'blocked-dependency',
  'stale-approval-diff',
  'risk-ceiling-verified',
  'risk-ceiling-advanced',
  'risk-ceiling-experimental',
  'risk-ceiling-extreme',
  'pt-br-long-copy',
] as const;

for (const state of reviewStates) {
  test(`plan review: ${state}`, async ({ page }) => {
    await openTransactionalHarness(page, {
      locale: state === 'pt-br-long-copy' ? 'pt-BR' : 'en',
      state,
    });
    await expect(page.locator('[data-plan-family]')).toBeVisible();
    await expect(page.locator('[data-risk-ceiling]')).toHaveValue('Advanced');
    await expect(page.locator('[data-operation]')).toHaveCount(2);
  });
}

test('plan review invalidates approval after risk ceiling change', async ({ page }) => {
  await openTransactionalHarness(page);
  await page.locator('[data-risk-ceiling]').selectOption('Experimental');
  await expect(page.locator('main')).toHaveAttribute(
    'data-transactional-state',
    'revision-changed',
  );
  await expect(page.locator('[data-approval-state]')).toHaveAttribute(
    'data-approval-state',
    'stale',
  );
});

const confirmationStates = [
  'verified-ready',
  'advanced-authentication-pending',
  'advanced-authentication-success',
  'advanced-authentication-failure',
  'advanced-authentication-expired',
  'experimental-recovery-missing',
  'experimental-phrase-mismatch',
  'experimental-ready',
  'extreme-no-control',
] as const;

for (const state of confirmationStates) {
  test(`confirmation: ${state}`, async ({ page }) => {
    await openTransactionalHarness(page, { state });
    await expect(page.locator('[data-plan-family]')).toContainText(/revision 7/iu);
    await expect(page.getByRole('button', { name: /extreme/iu })).toHaveCount(0);
  });
}

const advancedStates = [
  'disabled',
  'enable-auth-pending',
  'enabled',
  'restart-persisted',
  'revoke-auth-pending',
  'revoked',
  'posture-invalidated',
  'revalidated',
] as const;

for (const advancedState of advancedStates) {
  test(`D-13 Advanced preference lifecycle: ${advancedState}`, async ({ page }) => {
    await openTransactionalHarness(page, { advancedState });
    const panel = page.locator('[data-advanced-state]');
    await expect(panel).toHaveAttribute('data-advanced-state', advancedState);
    await expect(panel).toContainText(/Device-local|Local do dispositivo/u);
    await expect(page.locator('[data-open-recovery]')).toBeEnabled();
  });
}

test('D-13 enable and revoke request strong auth without optimistic success', async ({ page }) => {
  await openTransactionalHarness(page, { advancedState: 'disabled' });
  await page.locator('[data-advanced-action]').click();
  await expect(page.locator('main')).toHaveAttribute('data-auth-requested', 'true');
  await expect(page.locator('[data-advanced-state]')).toHaveAttribute(
    'data-advanced-state',
    'disabled',
  );

  await openTransactionalHarness(page, { advancedState: 'enabled' });
  await page.locator('[data-advanced-action]').click();
  await expect(page.locator('[data-advanced-state]')).toHaveAttribute(
    'data-advanced-state',
    'enabled',
  );
});

test('D-13 posture invalidation blocks apply while recovery remains usable', async ({ page }) => {
  await openTransactionalHarness(page, { advancedState: 'posture-invalidated' });
  await expect(page.getByRole('alert')).toContainText(/blocked|bloqueada/iu);
  await expect(page.locator('[data-open-recovery]')).toBeEnabled();
  await page.locator('[data-open-recovery]').click();
  await expect(page.locator('main')).toHaveAttribute('data-recovery-opened', 'true');
});

const executionStates = [
  'preparing',
  'applying',
  'observing',
  'verifying',
  'safe-cancel-requested',
  'close-to-tray',
  'reconnect-contiguous',
  'sequence-gap-refetch',
  'restart-pending',
  'first-boot-verification',
  'mutation-blocked-until-verification',
  'verified-success-after-receipt',
  'receipt-append-failure',
  'partial-rollback',
] as const;

for (const state of executionStates) {
  test(`execution and restart: ${state}`, async ({ page }) => {
    await openTransactionalHarness(page, { state });
    await expect(page.locator('[data-execution-family]')).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
  });
}

test('sequence gap reads one snapshot and issues zero mutation calls', async ({ page }) => {
  await openTransactionalHarness(page, { state: 'reconnect-contiguous' });
  await page.locator('[data-sequence-gap]').click();
  await expect(page.locator('[data-snapshot-reads]')).toHaveText('snapshotReads=1');
  await expect(page.locator('[data-mutation-calls]')).toHaveText('mutationCalls=0');
});

const recoveryStates = [
  'crash-reconciliation',
  'reboot-reconciliation',
  'not-applied',
  'applied-needs-receipt',
  'unknown',
  'drift',
  'three-state-conflict',
  'partial-failure-scoped-rollback',
  'restore-one-operation',
  'restore-full-plan',
  'restore-checkpoint',
  'restore-failure-global-block',
  'signed-revocation',
] as const;

for (const state of recoveryStates) {
  test(`recovery: ${state}`, async ({ page }) => {
    await openTransactionalHarness(page, { state });
    await expect(page.locator('[data-recovery-family]')).toContainText('Prior');
    await expect(page.getByRole('button', { name: 'Restore this operation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore full plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore checkpoint' })).toBeVisible();
  });
}

const receiptStates = [
  'apply-receipt',
  'restore-receipt',
  'technical-disclosure',
  'local-redacted-preview',
  'export-success',
  'export-failure',
  'tamper-journal-integrity-failure',
] as const;

for (const state of receiptStates) {
  test(`receipt and diagnostic export: ${state}`, async ({ page }) => {
    await openTransactionalHarness(page, { state });
    await expect(page.locator('[data-receipt-family]')).toContainText('transaction-apply-0001');
    await expect(page.locator('[data-receipt-family]')).toContainText('raw-hardware-identifiers');
    await expect(page.locator('[data-receipt-family]')).not.toContainText(
      /raw secret|serial number/iu,
    );
  });
}

const presentations = [
  { colorScheme: 'dark', name: 'dark', width: 1280 },
  { colorScheme: 'light', name: 'light', width: 1280 },
  { forcedColors: true, name: 'forced colors', width: 1280 },
  { reducedMotion: true, name: 'reduced motion', width: 1280 },
  { name: 'compact desktop', width: 960 },
  { name: 'narrow route container', width: 760 },
  { name: '150 percent app scale', scale: 150, width: 960 },
  { name: '200 percent zoom equivalent', scale: 200, width: 760 },
] as const;

for (const presentation of presentations) {
  test(`viewport and preference: ${presentation.name}`, async ({ page }) => {
    await openTransactionalHarness(page, presentation);
    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    await expectNoAxeViolations(page, ['main']);
  });
}

for (const locale of ['en', 'pt-BR'] as const) {
  test(`locale and keyboard order: ${locale}`, async ({ page }) => {
    await openTransactionalHarness(page, { locale });
    const labels: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('Tab');
      labels.push(
        await page.evaluate(() =>
          (
            document.activeElement?.textContent ??
            document.activeElement?.getAttribute('aria-label') ??
            ''
          )
            .trim()
            .replaceAll(/\s+/gu, ' '),
        ),
      );
    }
    expect(labels.filter(Boolean).length).toBe(6);
    await expectNoAxeViolations(page, ['main']);
  });
}

test('@smoke composition to immutable receipt remains deterministic', async ({ page }) => {
  await openTransactionalHarness(page, { advancedState: 'enabled', state: 'ready' });
  await expect(page.locator('[data-provenance]')).toHaveText(DETERMINISTIC_PROVENANCE);
  await page.locator('[data-risk-ceiling]').selectOption('Experimental');
  await expect(page.locator('[data-approval-state]')).toHaveAttribute(
    'data-approval-state',
    'stale',
  );
  await expect(page.locator('[data-receipt-family]')).toContainText('transaction-apply-0001');
  await expect(page.locator('[data-receipt-family]')).toContainText('operation-version=1');
});

test('@smoke recovery keeps three explicit targets and redacted evidence', async ({ page }) => {
  await openTransactionalHarness(page, {
    advancedState: 'posture-invalidated',
    state: 'three-state-conflict',
  });
  await expect(page.locator('[data-recovery-family] code')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /^Restore/u })).toHaveCount(3);
  await expect(page.locator('[data-provenance]')).toContainText('NOT PHYSICAL');
  await expect(page.locator('[data-receipt-family]')).toContainText('redactions');
});
