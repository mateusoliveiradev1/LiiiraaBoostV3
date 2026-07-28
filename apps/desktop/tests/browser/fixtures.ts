import { expect, test as base, type Page } from '@playwright/test';

export const FROZEN_DESKTOP_CLOCK = '2030-01-15T18:00:00.000Z';
export const FROZEN_DESKTOP_ID = '00000000-0000-4000-8000-000000000001';
export const FROZEN_DESKTOP_SEED = 2_001;
export const FROZEN_DESKTOP_LATENCY_MS = 120;
export const DESKTOP_SCENARIO_MARKER = 'SIMULATED SCENARIO';

export const FROZEN_CHART_DATA = Object.freeze([
  Object.freeze({ frame: 0, milliseconds: 8.2 }),
  Object.freeze({ frame: 1, milliseconds: 8.5 }),
  Object.freeze({ frame: 2, milliseconds: 8.1 }),
  Object.freeze({ frame: 3, milliseconds: 8.4 }),
]);

export interface DesktopBrowserScenario {
  readonly clock: string;
  readonly id: string;
  readonly latencyMs: number;
  readonly marker: typeof DESKTOP_SCENARIO_MARKER;
  readonly seed: number;
}

const defaultDesktopScenario = Object.freeze({
  clock: FROZEN_DESKTOP_CLOCK,
  id: 'S01',
  latencyMs: FROZEN_DESKTOP_LATENCY_MS,
  marker: DESKTOP_SCENARIO_MARKER,
  seed: FROZEN_DESKTOP_SEED,
}) satisfies DesktopBrowserScenario;

export const freezeDesktopScenario = async (
  page: Page,
  scenario: DesktopBrowserScenario = defaultDesktopScenario,
): Promise<void> => {
  await page.addInitScript(
    ({ chartData, frozenId, scenarioValue }) => {
      const OriginalDate = Date;
      const frozenEpoch = OriginalDate.parse(scenarioValue.clock);
      let randomState = scenarioValue.seed >>> 0;
      let idCounter = 0;

      class FrozenDate extends OriginalDate {
        public constructor(value: string | number = frozenEpoch) {
          super(value);
        }

        public static override now(): number {
          return frozenEpoch;
        }
      }

      const nextRandom = (): number => {
        randomState = (randomState * 1_664_525 + 1_013_904_223) >>> 0;
        return randomState / 0x1_0000_0000;
      };

      Object.defineProperty(globalThis, 'Date', {
        configurable: false,
        value: FrozenDate,
        writable: false,
      });
      Object.defineProperty(Math, 'random', {
        configurable: false,
        value: nextRandom,
        writable: false,
      });

      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        configurable: false,
        value: () => {
          idCounter += 1;
          return idCounter === 1
            ? frozenId
            : `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
        },
        writable: false,
      });

      Object.assign(globalThis, {
        __LIIIRAA_DESKTOP_TEST__: Object.freeze({
          chartData: Object.freeze(chartData),
          scenario: Object.freeze(scenarioValue),
        }),
      });
    },
    {
      chartData: FROZEN_CHART_DATA,
      frozenId: FROZEN_DESKTOP_ID,
      scenarioValue: scenario,
    },
  );
};

interface DesktopFixtures {
  readonly desktopScenario: DesktopBrowserScenario;
  readonly frozenDesktopScenario: undefined;
}

export const desktopTest = base.extend<DesktopFixtures>({
  desktopScenario: [defaultDesktopScenario, { option: true }],
  frozenDesktopScenario: [
    async ({ desktopScenario, page }, use) => {
      await freezeDesktopScenario(page, desktopScenario);
      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect };
