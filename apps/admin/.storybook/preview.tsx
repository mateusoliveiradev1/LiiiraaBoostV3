import '@liiiraa/design-tokens/tokens.css';
import '../src/app/admin-shell.css';

import type { Decorator, Preview } from '@storybook/react-vite';

import { ADMIN_STORY_CLOCK, ADMIN_STORY_SEED } from '../src/testing/admin-state-fixtures';

const viewports = {
  desktop1440: {
    name: 'Desktop 1440 × 900',
    styles: { height: '900px', width: '1440px' },
  },
  tablet1024: {
    name: 'Tablet 1024 × 768',
    styles: { height: '768px', width: '1024px' },
  },
  mobile390: {
    name: 'Mobile 390 × 844',
    styles: { height: '844px', width: '390px' },
  },
} as const;

const withAdminAxes: Decorator = (Story, context) => {
  const contrast = String(context.globals['contrast'] ?? 'normal');
  const density = String(context.globals['density'] ?? 'comfortable');
  const locale = String(context.globals['locale'] ?? 'pt-BR');
  const motion = String(context.globals['motion'] ?? 'responsive');

  Object.assign(globalThis, {
    __LIIIRAA_ADMIN_STORY__: Object.freeze({
      clock: ADMIN_STORY_CLOCK,
      contrast,
      density,
      locale,
      motion,
      provenance: 'storybook-fixture',
      seed: ADMIN_STORY_SEED,
    }),
  });

  return (
    <div
      data-contrast={contrast}
      data-density={density}
      data-forced-colors={contrast === 'forced' || undefined}
      data-locale={locale}
      data-motion={motion}
      data-storybook-fixture="admin-state-matrix-v1"
      lang={locale}
      style={{ minHeight: '100vh' }}
    >
      <style>{`
        *, *::before, *::after {
          animation-delay: 0ms !important;
          animation-iteration-count: 1 !important;
          caret-color: transparent !important;
          transition-delay: 0ms !important;
        }

        [data-motion='reduced'] *,
        [data-motion='reduced'] *::before,
        [data-motion='reduced'] *::after {
          animation-duration: 0ms !important;
          scroll-behavior: auto !important;
          transition-duration: 0ms !important;
          transform: none !important;
        }

        [data-forced-colors='true'] {
          --lb-forced-canvas: Canvas;
          --lb-forced-canvas-text: CanvasText;
          --lb-forced-focus: Highlight;
          --lb-admin-canvas: Canvas;
          --lb-admin-surface: Canvas;
          --lb-admin-surface-raised: Canvas;
        }
      `}</style>
      <Story />
    </div>
  );
};

const preview = {
  decorators: [withAdminAxes],
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
    density: {
      description: 'Comfortable or compact operational density',
      toolbar: {
        items: [
          { title: 'Comfortable', value: 'comfortable' },
          { title: 'Compact', value: 'compact' },
        ],
      },
    },
    locale: {
      description: 'Admin locale',
      toolbar: {
        items: [
          { title: 'Português (Brasil)', value: 'pt-BR' },
          { title: 'English', value: 'en' },
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
  },
  initialGlobals: {
    contrast: 'normal',
    density: 'comfortable',
    locale: 'pt-BR',
    motion: 'responsive',
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
