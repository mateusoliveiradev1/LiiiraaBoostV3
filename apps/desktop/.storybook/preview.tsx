import type { Decorator, Preview } from '@storybook/react-vite';

const FROZEN_CLOCK = '2030-01-15T18:00:00.000Z';
const FROZEN_ID = '00000000-0000-4000-8000-000000000001';
const FROZEN_SEED = 2_001;
const FROZEN_LATENCY_MS = 120;
const FROZEN_CHART_DATA = Object.freeze([
  Object.freeze({ frame: 0, milliseconds: 8.2 }),
  Object.freeze({ frame: 1, milliseconds: 8.5 }),
  Object.freeze({ frame: 2, milliseconds: 8.1 }),
  Object.freeze({ frame: 3, milliseconds: 8.4 }),
]);

const viewports = {
  desktop1440: {
    name: 'Desktop 1440 × 900',
    styles: { height: '900px', width: '1440px' },
  },
  desktop1280: {
    name: 'Desktop 1280 × 800',
    styles: { height: '800px', width: '1280px' },
  },
  compact960: {
    name: 'Compact 960 × 700',
    styles: { height: '700px', width: '960px' },
  },
  compact760: {
    name: 'Compact 760 × 600',
    styles: { height: '600px', width: '760px' },
  },
} as const;

const withDesktopAxes: Decorator = (Story, context) => {
  const locale = String(context.globals.locale ?? 'pt-BR');
  const scale = String(context.globals.scale ?? '100');
  const motion = String(context.globals.motion ?? 'responsive');
  const contrast = String(context.globals.contrast ?? 'normal');

  Object.assign(globalThis, {
    __LIIIRAA_DESKTOP_STORY__: Object.freeze({
      chartData: FROZEN_CHART_DATA,
      clock: FROZEN_CLOCK,
      contrast,
      id: FROZEN_ID,
      latencyMs: FROZEN_LATENCY_MS,
      locale,
      motion,
      scale: Number(scale),
      scenarioMarker: 'SIMULATED SCENARIO',
      seed: FROZEN_SEED,
    }),
  });

  return (
    <div
      data-app-scale={scale}
      data-contrast={contrast}
      data-locale={locale}
      data-motion={motion}
      data-scenario-marker="SIMULATED SCENARIO"
      lang={locale === 'pseudo' ? 'en-XA' : locale}
      style={{
        fontSize: `${String(Number(scale) / 100)}rem`,
        minHeight: '100vh',
      }}
    >
      <style>{`
        *, *::before, *::after {
          animation-delay: 0ms !important;
          animation-iteration-count: 1 !important;
          caret-color: transparent !important;
          transition-delay: 0ms !important;
        }

        [data-motion='reduced'] *, [data-motion='reduced'] *::before,
        [data-motion='reduced'] *::after {
          animation-duration: 0ms !important;
          scroll-behavior: auto !important;
          transition-duration: 0ms !important;
        }

        [data-contrast='forced'] {
          forced-color-adjust: none;
          --liiiraa-canvas: Canvas;
          --liiiraa-canvas-text: CanvasText;
          --liiiraa-highlight: Highlight;
          --liiiraa-highlight-text: HighlightText;
        }
      `}</style>
      <Story />
    </div>
  );
};

const preview = {
  decorators: [withDesktopAxes],
  globalTypes: {
    contrast: {
      description: 'Normal or forced-colors rendering',
      toolbar: {
        items: [
          { title: 'Normal colors', value: 'normal' },
          { title: 'Forced colors', value: 'forced' },
        ],
      },
    },
    locale: {
      description: 'Authored desktop locale',
      toolbar: {
        items: [
          { title: 'Português (Brasil)', value: 'pt-BR' },
          { title: 'English', value: 'en' },
          { title: 'Pseudo locale', value: 'pseudo' },
        ],
      },
    },
    motion: {
      description: 'Responsive or reduced motion',
      toolbar: {
        items: [
          { title: 'Responsive motion', value: 'responsive' },
          { title: 'Reduced motion', value: 'reduced' },
        ],
      },
    },
    scale: {
      description: 'Desktop app scale',
      toolbar: {
        items: [
          { title: '100%', value: '100' },
          { title: '125%', value: '125' },
          { title: '150%', value: '150' },
        ],
      },
    },
  },
  initialGlobals: {
    contrast: 'normal',
    locale: 'pt-BR',
    motion: 'responsive',
    scale: '100',
    viewport: { value: 'desktop1440' },
  },
  parameters: {
    controls: {
      disableSaveFromUI: true,
      expanded: true,
      sort: 'requiredFirst',
    },
    options: {
      storySort: { method: 'alphabetical' },
    },
    viewport: {
      options: viewports,
    },
  },
} satisfies Preview;

export default preview;
